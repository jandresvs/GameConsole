import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameEvent } from "./GameEvent";
import { HttpEventSink } from "./HttpEventSink";

const URL = "/api/ingest/events";

function event(n: number, matchId = "racing-abc"): GameEvent {
  return {
    eventId: `${matchId}-${String(n).padStart(4, "0")}`,
    timestamp: new Date(Date.UTC(2026, 10, 18, 15, 0, 0, n)).toISOString(),
    gameId: "racing",
    gameVersion: "1.0",
    matchId,
    type: "LAP_COMPLETED",
  };
}

/** Respuesta 202 de GameStats, como la arma el ingest. */
function accepted(count: number, rejected = 0): Response {
  return new Response(JSON.stringify({ accepted: count, rejected }), { status: 202 });
}

/** Lo mínimo que estas pruebas leen de un fetch simulado: los argumentos de cada llamada. */
interface FetchMock {
  mock: { calls: unknown[][] };
}

/** Las opciones (método, cuerpo, keepalive) de la llamada número `call` a fetch. */
function callInit(fetchFn: FetchMock, call: number): RequestInit {
  return fetchFn.mock.calls[call]![1] as RequestInit;
}

/** Los eventId que viajaron en la llamada número `call` a fetch. */
function sentIds(fetchFn: FetchMock, call: number): string[] {
  return (JSON.parse(callInit(fetchFn, call).body as string) as GameEvent[]).map((e) => e.eventId);
}

describe("HttpEventSink", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("send() no llama a la red: solo encola", () => {
    const fetchFn = vi.fn();
    const sink = new HttpEventSink({ url: URL, fetchFn });

    sink.send(event(1));
    sink.send(event(2));

    expect(fetchFn).not.toHaveBeenCalled();
    expect(sink.stats().pending).toBe(2);
  });

  it("junta lo acumulado en una sola petición, en orden", async () => {
    const fetchFn = vi.fn(async () => accepted(3));
    const sink = new HttpEventSink({ url: URL, fetchFn, flushIntervalMs: 250 });

    sink.send(event(1));
    sink.send(event(2));
    sink.send(event(3));
    await vi.advanceTimersByTimeAsync(250);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect((fetchFn as FetchMock).mock.calls[0]![0]).toBe(URL);
    expect(callInit(fetchFn, 0).method).toBe("POST");
    expect(sentIds(fetchFn, 0)).toEqual(["racing-abc-0001", "racing-abc-0002", "racing-abc-0003"]);
    expect(sink.stats()).toMatchObject({ pending: 0, accepted: 3, state: "idle" });
  });

  it("si la red falla, reintenta el MISMO lote con esperas crecientes hasta que pasa", async () => {
    const fetchFn = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(accepted(2));
    const sink = new HttpEventSink({ url: URL, fetchFn, flushIntervalMs: 100, retryBaseMs: 500, retryMaxMs: 8000 });

    sink.send(event(1));
    sink.send(event(2));
    await vi.advanceTimersByTimeAsync(100); // primer intento: falla
    expect(sink.stats()).toMatchObject({ pending: 2, retries: 1, state: "retrying" });
    expect(sink.stats().lastError).toMatch(/sin conexión/);

    await vi.advanceTimersByTimeAsync(499);
    expect(fetchFn).toHaveBeenCalledTimes(1); // todavía esperando los 500 ms
    await vi.advanceTimersByTimeAsync(1); // segundo intento: falla
    expect(fetchFn).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(999);
    expect(fetchFn).toHaveBeenCalledTimes(2); // ahora la espera es de 1000 ms
    await vi.advanceTimersByTimeAsync(1); // tercer intento: pasa
    expect(fetchFn).toHaveBeenCalledTimes(3);

    // Los tres intentos llevaron exactamente los mismos eventId: GameStats descarta los repetidos.
    expect(sentIds(fetchFn, 1)).toEqual(sentIds(fetchFn, 0));
    expect(sentIds(fetchFn, 2)).toEqual(sentIds(fetchFn, 0));
    expect(sink.stats()).toMatchObject({ pending: 0, accepted: 2, retries: 2, state: "idle" });
    expect(sink.stats().lastError).toBeUndefined();
  });

  it("reintenta cuando el servicio está caído (502 del proxy)", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 502 }))
      .mockResolvedValueOnce(accepted(1));
    const sink = new HttpEventSink({ url: URL, fetchFn, flushIntervalMs: 100, retryBaseMs: 500 });

    sink.send(event(1));
    await vi.advanceTimersByTimeAsync(100);
    expect(sink.stats()).toMatchObject({ pending: 1, retries: 1, lastError: "GameStats respondió 502" });

    await vi.advanceTimersByTimeAsync(500);
    expect(sink.stats()).toMatchObject({ pending: 0, accepted: 1 });
  });

  it("los eventos emitidos durante la caída esperan su turno y salen después, en orden", async () => {
    const fetchFn = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockImplementation(async () => accepted(0));
    const sink = new HttpEventSink({ url: URL, fetchFn, flushIntervalMs: 100, retryBaseMs: 500 });

    sink.send(event(1));
    await vi.advanceTimersByTimeAsync(100); // falla
    sink.send(event(2));
    sink.send(event(3));
    await vi.advanceTimersByTimeAsync(500); // reintento

    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(sentIds(fetchFn, 1)).toEqual(["racing-abc-0001", "racing-abc-0002", "racing-abc-0003"]);
    expect(sink.stats().pending).toBe(0);
  });

  it("no reintenta una petición que GameStats declara inválida (400): la descarta", async () => {
    const fetchFn = vi.fn(async () => new Response('{"error":"JSON ilegible"}', { status: 400 }));
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const sink = new HttpEventSink({ url: URL, fetchFn, flushIntervalMs: 100 });

    sink.send(event(1));
    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(60_000);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(sink.stats()).toMatchObject({ pending: 0, dropped: 1, retries: 0 });
    errors.mockRestore();
  });

  it("cuenta los eventos que GameStats rechaza por formato y no los reenvía", async () => {
    const body = { accepted: 1, rejected: 1, errors: [{ index: 1, eventId: "x", problems: ["falta gameId"] }] };
    const fetchFn = vi.fn(async () => new Response(JSON.stringify(body), { status: 202 }));
    const warnings = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const sink = new HttpEventSink({ url: URL, fetchFn, flushIntervalMs: 100 });

    sink.send(event(1));
    sink.send(event(2));
    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(60_000);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(sink.stats()).toMatchObject({ pending: 0, accepted: 1, rejected: 1 });
    expect(warnings).toHaveBeenCalledOnce();
    warnings.mockRestore();
  });

  it("mantiene una sola petición en curso y parte los lotes grandes", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const fetchFn = vi.fn(async (_url: unknown, init?: RequestInit) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 50)); // la red tarda
      inFlight -= 1;
      return accepted((JSON.parse(init!.body as string) as unknown[]).length);
    });
    const sink = new HttpEventSink({ url: URL, fetchFn, flushIntervalMs: 100, maxBatchSize: 2 });

    for (let n = 1; n <= 5; n++) sink.send(event(n));
    await vi.advanceTimersByTimeAsync(120);
    sink.send(event(6)); // llega mientras el primer lote viaja
    await vi.advanceTimersByTimeAsync(1000);

    expect(maxInFlight).toBe(1);
    expect(fetchFn.mock.calls.map((_, i) => sentIds(fetchFn, i).length)).toEqual([2, 2, 2]);
    expect(fetchFn.mock.calls.flatMap((_, i) => sentIds(fetchFn, i))).toEqual(
      [1, 2, 3, 4, 5, 6].map((n) => `racing-abc-000${n}`),
    );
    expect(sink.stats()).toMatchObject({ pending: 0, accepted: 6 });
  });

  it("con la cola llena pierde los eventos nuevos y lo reporta", () => {
    const sink = new HttpEventSink({ url: URL, fetchFn: vi.fn(), maxQueueSize: 2 });

    sink.send(event(1));
    sink.send(event(2));
    sink.send(event(3));

    expect(sink.stats()).toMatchObject({ pending: 2, dropped: 1 });
  });

  it("flushOnExit() envía todo lo pendiente con keepalive, sin esperar al temporizador", () => {
    const fetchFn = vi.fn(async () => accepted(2));
    const sink = new HttpEventSink({ url: URL, fetchFn });

    sink.send(event(1));
    sink.send(event(2));
    sink.flushOnExit();

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(callInit(fetchFn, 0).keepalive).toBe(true);
    expect(sentIds(fetchFn, 0)).toEqual(["racing-abc-0001", "racing-abc-0002"]);
  });

  it("flushOnExit() parte lo pendiente en trozos de menos de 64 KB", () => {
    const fetchFn = vi.fn(async () => accepted(0));
    const sink = new HttpEventSink({ url: URL, fetchFn });
    const big = { ...event(0), data: { relleno: "x".repeat(1000) } };

    for (let n = 0; n < 150; n++) sink.send({ ...big, eventId: `m-${n}` });
    sink.flushOnExit();

    expect(fetchFn.mock.calls.length).toBeGreaterThan(1);
    fetchFn.mock.calls.forEach((_, i) => {
      expect((callInit(fetchFn, i).body as string).length).toBeLessThan(64 * 1024);
    });
    const total = fetchFn.mock.calls.reduce((sum, _, i) => sum + sentIds(fetchFn, i).length, 0);
    expect(total).toBe(150);
  });

  it("avisa a quien se suscribe cuando cambian los números", async () => {
    const fetchFn = vi.fn(async () => accepted(1));
    const sink = new HttpEventSink({ url: URL, fetchFn, flushIntervalMs: 100 });
    const seen: number[] = [];
    sink.subscribe((stats) => seen.push(stats.accepted));

    sink.send(event(1));
    await vi.advanceTimersByTimeAsync(100);

    expect(seen.at(-1)).toBe(1);
  });
});
