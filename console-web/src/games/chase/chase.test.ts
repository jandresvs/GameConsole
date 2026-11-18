import { describe, expect, it } from "vitest";
import type { EventSink, GameEvent } from "../../events/GameEvent.ts";
import { MatchEvents } from "../../events/MatchEvents.ts";
import { Board } from "./Board.ts";
import { ChaseEvents } from "./ChaseEvents.ts";
import { ChaseMatch } from "./ChaseMatch.ts";
import type { Direction } from "./Direction.ts";
import { PrologRouteFinder } from "./PrologRouteFinder.ts";
import { CpuRacer, HumanRacer } from "./Racer.ts";
import { Position } from "./Position.ts";
import type { Route, RouteFinder } from "./RouteFinder.ts";

// ---- Apoyos ----------------------------------------------------------------

/**
 * Las pruebas se escribieron con node:assert; este adaptador las corre en
 * Vitest (el marco de pruebas del proyecto) sin cambiar cada verificación.
 */
const assert = {
  equal: (actual: unknown, expected: unknown, message?: string) => expect(actual, message).toBe(expected),
  deepEqual: (actual: unknown, expected: unknown, message?: string) => expect(actual, message).toStrictEqual(expected),
  ok: (value: unknown, message?: string) => expect(value, message).toBeTruthy(),
  match: (value: string, pattern: RegExp, message?: string) => expect(value, message).toMatch(pattern),
  throws: (fn: () => unknown, error: new (...args: never[]) => Error) => expect(fn).toThrow(error),
  rejects: async (promise: Promise<unknown>) => {
    await expect(promise).rejects.toBeTruthy();
  },
};

class Recorder implements EventSink {
  readonly events: GameEvent[] = [];
  send(event: GameEvent): void {
    this.events.push(event);
  }
  types(): string[] {
    return this.events.map((e) => e.type);
  }
}

/** Reemplazo de Prolog en las pruebas: BFS (ruta más corta; el A* real se prueba en ai-prolog/). */
class BfsFinder implements RouteFinder {
  calls = 0;
  async findRoute(board: Board, from: Position): Promise<Route> {
    this.calls++;
    const dirs: Direction[] = ["arriba", "abajo", "izquierda", "derecha"];
    const prev = new Map<string, { from: Position; dir: Direction } | null>([[from.key(), null]]);
    const queue = [from];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (cur.equals(board.target)) break;
      for (const dir of dirs) {
        const next = cur.step(dir);
        if (!board.inBounds(next) || board.isObstacle(next) || prev.has(next.key())) continue;
        prev.set(next.key(), { from: cur, dir });
        queue.push(next);
      }
    }
    if (!prev.has(board.target.key())) return { found: false, steps: 0, turns: 0, path: [] };
    const path: { row: number; col: number; direction: Direction }[] = [];
    for (let p = board.target; prev.get(p.key()); p = prev.get(p.key())!.from) {
      path.unshift({ row: p.row, col: p.col, direction: prev.get(p.key())!.dir });
    }
    let turns = 0;
    for (let i = 1; i < path.length; i++) if (path[i]!.direction !== path[i - 1]!.direction) turns++;
    return { found: true, steps: path.length, turns, path };
  }
}

const P = (r: number, c: number) => new Position(r, c);
const noPause = async () => {};

/**
 * Arma una partida como lo hace ChaseGame: los eventos pasan por MatchEvents
 * (el mismo que usa la clase base Game) y, como hace la base al empezar, se
 * emiten MATCH_STARTED y un PLAYER_JOINED por jugador antes de begin().
 */
function setup(opts: {
  board: Board;
  user: Position;
  cpu: Position;
  finder?: RouteFinder;
  lives?: number;
  matchId?: string;
  sender?: Recorder;
}) {
  const sender = opts.sender ?? new Recorder();
  const lives = opts.lives ?? 3;
  const log = new MatchEvents("chase", opts.matchId ?? "chase-prueba", "1.0", sender);
  const { board } = opts;
  log.add("MATCH_STARTED", { rows: board.rows, cols: board.cols, obstaclePct: board.obstaclePct, lives });
  log.add("PLAYER_JOINED", undefined, "ana");
  log.add("PLAYER_JOINED", undefined, "cpu");

  const match = new ChaseMatch({
    board,
    user: new HumanRacer("ana", opts.user, lives),
    cpu: new CpuRacer("cpu", opts.cpu, lives),
    finder: opts.finder ?? new BfsFinder(),
    events: new ChaseEvents(
      (type, data, playerId) => {
        if (!log.isClosed) log.add(type, data, playerId); // como this.emit: nada después de terminar
      },
      (winnerId) => log.finish(winnerId),
    ),
    pause: noPause,
  });
  return { match, sender };
}

/** Reglas del contrato de GameStats que cualquier evento debe cumplir. */
function assertValidContract(events: GameEvent[]): void {
  const ids = new Set<string>();
  for (const e of events) {
    assert.ok(e.eventId && !ids.has(e.eventId), "eventId único");
    ids.add(e.eventId);
    assert.match(e.timestamp, /^\d{4}-\d\d-\d\dT[\d:.]+Z$/, "timestamp UTC con Z");
    assert.equal(e.gameId, "chase");
    assert.match(e.type, /^[A-Z_]+$/);
    if (e.type === "MATCH_STARTED" || e.type === "MATCH_FINISHED") assert.equal(e.playerId, undefined);
    else assert.ok(e.playerId, `${e.type} lleva playerId`);
  }
  const finished = events.map((e) => e.type).indexOf("MATCH_FINISHED");
  if (finished >= 0) assert.equal(finished, events.length - 1, "MATCH_FINISHED es el último");
  assert.equal(new Set(events.map((e) => e.matchId)).size, 1, "un solo matchId");
}

// ---- Tablero ---------------------------------------------------------------

describe("Board.generate", () => {
  it("coloca meta, usuario y CPU en celdas distintas y sin obstáculos", () => {
    for (let i = 0; i < 50; i++) {
      const { board, userStart, cpuStart } = Board.generate(6, 8, 30);
      const cells = [board.target, userStart, cpuStart].map((p) => p.key());
      assert.equal(new Set(cells).size, 3);
      for (const p of [board.target, userStart, cpuStart]) assert.equal(board.isObstacle(p), false);
      assert.equal(board.obstacleList().length, Math.floor((6 * 8 * 30) / 100));
    }
  });

  it("con el mismo generador al azar da el mismo tablero", () => {
    const seq = () => {
      let n = 7;
      return () => ((n = (n * 16807) % 2147483647) / 2147483647);
    };
    const a = Board.generate(5, 5, 20, seq());
    const b = Board.generate(5, 5, 20, seq());
    assert.deepEqual(a.board.obstacleList(), b.board.obstacleList());
  });

  it("rechaza tamaños y porcentajes absurdos", () => {
    assert.throws(() => Board.generate(1, 5, 10), RangeError);
    assert.throws(() => Board.generate(5, 5, 90), RangeError);
  });
});

// ---- Racer -----------------------------------------------------------------

describe("Racer", () => {
  it("cuenta pasos y giros; el primer paso no es giro", () => {
    const r = new HumanRacer("ana", P(0, 0), 3);
    assert.equal(r.advance("derecha").turn, false);
    assert.equal(r.advance("derecha").turn, false);
    assert.equal(r.advance("abajo").turn, true);
    assert.equal(r.steps, 3);
    assert.equal(r.turns, 1);
    assert.ok(r.position.equals(P(1, 2)));
  });

  it("las vidas no bajan de cero", () => {
    const r = new HumanRacer("ana", P(0, 0), 1);
    assert.equal(r.loseLife(), 0);
    assert.equal(r.loseLife(), 0);
  });
});

// ---- Partida ---------------------------------------------------------------

describe("ChaseMatch", () => {
  it("el usuario llega primero: eventos en orden y ganador", async () => {
    const { match, sender } = setup({ board: new Board(1, 5, [], P(0, 4)), user: P(0, 2), cpu: P(0, 0) });
    await match.begin();
    assert.equal(match.phase, "playing");
    assert.equal(await match.userMove("derecha"), "moved");
    assert.equal(await match.userMove("derecha"), "reached");

    assert.deepEqual(sender.types(), [
      "MATCH_STARTED", "PLAYER_JOINED", "PLAYER_JOINED", "ROUTE_COMPUTED", "ROUTE_COMPUTED",
      "PLAYER_MOVED", "PLAYER_MOVED", "PLAYER_MOVED", "TARGET_REACHED", "MATCH_FINISHED",
    ]);
    const last = sender.events.at(-1)!;
    assert.deepEqual(last.data, { winnerId: "ana" });
    assert.equal(match.outcome?.kind, "won");
    assertValidContract(sender.events);
  });

  it("ROUTE_COMPUTED trae los datos del contrato", async () => {
    const { match, sender } = setup({ board: new Board(1, 5, [], P(0, 4), 0), user: P(0, 0), cpu: P(0, 2) });
    await match.begin();
    const route = sender.events.find((e) => e.type === "ROUTE_COMPUTED" && e.playerId === "ana")!;
    assert.deepEqual(route.data, {
      found: true, start: { row: 0, col: 0 }, goal: { row: 0, col: 4 }, optimalSteps: 4, routeTurns: 0,
    });
  });

  it("la CPU gana si llega antes; su jugada sale del buscador de rutas", async () => {
    const finder = new BfsFinder();
    const { match, sender } = setup({ board: new Board(1, 6, [], P(0, 5)), user: P(0, 0), cpu: P(0, 3), finder });
    await match.begin();
    const callsAfterBegin = finder.calls; // una por jugador
    await match.userMove("derecha");
    await match.userMove("derecha");
    assert.equal(match.outcome?.kind, "won");
    assert.deepEqual(sender.events.at(-1)!.data, { winnerId: "cpu" });
    assert.ok(finder.calls > callsAfterBegin, "la CPU consultó la ruta en cada turno");
    assert.ok(sender.events.some((e) => e.type === "TARGET_REACHED" && e.playerId === "cpu"));
    assertValidContract(sender.events);
  });

  it("chocar con un obstáculo cuesta una vida y el turno; sin vidas termina sin ganador", async () => {
    // La CPU está a 3 pasos de La Mala: no alcanza a llegar mientras el usuario choca 3 veces.
    const board = new Board(4, 4, [P(0, 1), P(1, 0)], P(3, 3));
    const { match, sender } = setup({ board, user: P(1, 1), cpu: P(3, 0), lives: 3 });
    await match.begin();
    assert.equal(await match.userMove("arriba"), "hit");
    assert.equal(await match.userMove("izquierda"), "hit");
    assert.equal(match.user.lives, 1);
    assert.equal(await match.userMove("arriba"), "out-of-lives");

    const hits = sender.events.filter((e) => e.type === "OBSTACLE_HIT");
    assert.deepEqual(hits.map((h) => (h.data as { livesLeft: number }).livesLeft), [2, 1, 0]);
    assert.equal(match.outcome?.kind, "out-of-lives");
    assert.equal(sender.events.at(-1)!.data, undefined, "sin winnerId");
    assert.equal(await match.userMove("abajo"), "ignored", "terminada: no acepta jugadas");
    assertValidContract(sender.events);
  });

  it("los choques no cuentan como pasos", async () => {
    const board = new Board(2, 3, [P(0, 1)], P(1, 2));
    const { match, sender } = setup({ board, user: P(0, 0), cpu: P(1, 0) });
    await match.begin();
    await match.userMove("derecha"); // choca
    assert.equal(match.user.steps, 0);
    assert.equal(sender.events.filter((e) => e.type === "PLAYER_MOVED" && e.playerId === "ana").length, 0);
  });

  it("contra el borde no pasa nada: ni evento ni turno de la CPU", async () => {
    const finder = new BfsFinder();
    const { match, sender } = setup({ board: new Board(2, 2, [], P(1, 1)), user: P(0, 0), cpu: P(1, 0), finder });
    await match.begin();
    const before = sender.events.length;
    const calls = finder.calls;
    assert.equal(await match.userMove("arriba"), "edge");
    assert.equal(sender.events.length, before);
    assert.equal(finder.calls, calls);
    assert.equal(match.phase, "playing");
  });

  it("tablero sin ruta: ROUTE_COMPUTED found=false y termina sin ganador", async () => {
    const board = new Board(1, 3, [P(0, 1)], P(0, 2));
    const { match, sender } = setup({ board, user: P(0, 0), cpu: P(0, 0) });
    await match.begin();
    assert.equal(match.outcome?.kind, "no-route");
    const route = sender.events.find((e) => e.type === "ROUTE_COMPUTED")!;
    assert.equal((route.data as { found: boolean }).found, false);
    assert.equal(sender.types().at(-1), "MATCH_FINISHED");
    assertValidContract(sender.events);
  });

  it("abandonar a mitad cierra la partida una sola vez", async () => {
    const { match, sender } = setup({ board: new Board(1, 5, [], P(0, 4)), user: P(0, 0), cpu: P(0, 1) });
    await match.begin();
    match.abandon();
    match.abandon();
    assert.equal(sender.types().filter((t) => t === "MATCH_FINISHED").length, 1);
    assertValidContract(sender.events);
  });

  it("abandonar mientras espera a Prolog cancela la espera sin error", async () => {
    const pending: RouteFinder = {
      findRoute: (_b, _f, signal) =>
        new Promise((_resolve, reject) => signal?.addEventListener("abort", () => reject(signal.reason))),
    };
    const { match, sender } = setup({ board: new Board(1, 5, [], P(0, 4)), user: P(0, 0), cpu: P(0, 1), finder: pending });
    const begin = match.begin();
    match.abandon();
    await begin; // no lanza
    assert.equal(match.outcome?.kind, "abandoned");
    assert.equal(sender.types().at(-1), "MATCH_FINISHED");
  });

  it("dos partidas a la vez no mezclan sus eventos", async () => {
    const sender = new Recorder(); // el MISMO destino para las dos, como en la consola
    const mk = (matchId: string) =>
      setup({ board: new Board(1, 6, [], P(0, 5)), user: P(0, 0), cpu: P(0, 2), matchId, sender }).match;
    const a = mk("chase-A");
    const b = mk("chase-B");
    await Promise.all([a.begin(), b.begin()]);
    for (let i = 0; i < 3; i++) await Promise.all([a.userMove("derecha"), b.userMove("derecha")]);

    for (const id of ["chase-A", "chase-B"]) {
      const mine = sender.events.filter((e) => e.matchId === id);
      assert.equal(mine.filter((e) => e.type === "MATCH_FINISHED").length, 1);
      assertValidContract(mine);
    }
    assert.equal(new Set(sender.events.map((e) => e.eventId)).size, sender.events.length);
  });
});

// ---- Cliente de Prolog -----------------------------------------------------

describe("PrologRouteFinder", () => {
  const board = new Board(3, 3, [P(1, 1)], P(2, 2));
  const okBody = { found: true, steps: 1, turns: 0, path: [{ row: 0, col: 1, direction: "derecha" }] };
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

  it("manda el tablero completo en el formato del contrato", async () => {
    let sent: any;
    const fetchFn = (async (_url: string, init: RequestInit) => {
      sent = JSON.parse(String(init.body));
      return json(okBody);
    }) as unknown as typeof fetch;
    const finder = new PrologRouteFinder({ baseUrl: "/api/prolog", fetchFn });
    const route = await finder.findRoute(board, P(0, 0));
    assert.deepEqual(sent, {
      rows: 3, cols: 3, obstacles: [{ row: 1, col: 1 }], from: { row: 0, col: 0 }, goal: { row: 2, col: 2 },
    });
    assert.equal(route.path[0]!.direction, "derecha");
  });

  it("si Prolog no responde, avisa y reintenta hasta que conteste", async () => {
    let calls = 0;
    const unavailable: number[] = [];
    let recovered = 0;
    const fetchFn = (async () => {
      calls++;
      if (calls === 1) throw new TypeError("network down");
      if (calls === 2) return json({ error: "servicio no disponible" }, 502);
      return json(okBody);
    }) as unknown as typeof fetch;
    const finder = new PrologRouteFinder({
      baseUrl: "/api/prolog",
      fetchFn,
      sleep: async () => {},
      onUnavailable: (n) => unavailable.push(n),
      onRecovered: () => recovered++,
    });
    const route = await finder.findRoute(board, P(0, 0));
    assert.equal(calls, 3);
    assert.deepEqual(unavailable, [1, 2]);
    assert.equal(recovered, 1);
    assert.equal(route.found, true);
  });

  it("un 400 o una respuesta inservible NO se reintenta", async () => {
    let calls = 0;
    const bad = (async () => (calls++, json({ error: "celda fuera del tablero" }, 400))) as unknown as typeof fetch;
    await assert.rejects(new PrologRouteFinder({ baseUrl: "", fetchFn: bad, sleep: async () => {} }).findRoute(board, P(0, 0)));
    assert.equal(calls, 1);

    const junk = (async () => json({ hola: 1 })) as unknown as typeof fetch;
    await assert.rejects(new PrologRouteFinder({ baseUrl: "", fetchFn: junk, sleep: async () => {} }).findRoute(board, P(0, 0)));
  });

  it("cancelar la señal corta los reintentos", async () => {
    const controller = new AbortController();
    const fetchFn = (async () => {
      throw new TypeError("network down");
    }) as unknown as typeof fetch;
    const finder = new PrologRouteFinder({
      baseUrl: "",
      fetchFn,
      sleep: async () => controller.abort(),
    });
    await assert.rejects(finder.findRoute(board, P(0, 0), controller.signal));
  });

  it("found=false se devuelve como ruta vacía", async () => {
    const fetchFn = (async () => json({ found: false })) as unknown as typeof fetch;
    const route = await new PrologRouteFinder({ baseUrl: "", fetchFn }).findRoute(board, P(0, 0));
    assert.deepEqual(route, { found: false, steps: 0, turns: 0, path: [] });
  });
});
