import { describe, expect, it } from "vitest";
import type { EventSink, GameEvent } from "./GameEvent";
import { MatchEvents } from "./MatchEvents";

/** EventSink de prueba: solo guarda lo que recibe. */
class RecordingSink implements EventSink {
  readonly events: GameEvent[] = [];
  send(event: GameEvent): void {
    this.events.push(event);
  }
}

function newMatch(now: () => number = () => Date.UTC(2026, 10, 18, 15, 0, 0)) {
  const sink = new RecordingSink();
  const match = new MatchEvents("racing", "racing-abc", "1.0", sink, now);
  return { sink, match };
}

describe("MatchEvents", () => {
  it("arma el evento con los campos del contrato de GameStats", () => {
    const { sink, match } = newMatch();
    match.add("LAP_COMPLETED", { lap: 1, lapTimeMs: 61230 }, "andres");

    expect(sink.events).toEqual([
      {
        eventId: "racing-abc-0001",
        timestamp: "2026-11-18T15:00:00.000Z",
        gameId: "racing",
        gameVersion: "1.0",
        matchId: "racing-abc",
        playerId: "andres",
        type: "LAP_COMPLETED",
        data: { lap: 1, lapTimeMs: 61230 },
      },
    ]);
  });

  it("omite playerId y data cuando no vienen", () => {
    const { sink, match } = newMatch();
    match.add("MATCH_STARTED");

    expect(sink.events[0]).not.toHaveProperty("playerId");
    expect(sink.events[0]).not.toHaveProperty("data");
  });

  it("da eventId únicos y timestamps estrictamente crecientes aunque el reloj no avance", () => {
    const { sink, match } = newMatch();
    for (let i = 0; i < 5; i++) match.add("PLAYER_MOVED", undefined, "andres");

    const ids = sink.events.map((e) => e.eventId);
    const times = sink.events.map((e) => e.timestamp);
    expect(new Set(ids).size).toBe(5);
    expect(times).toEqual([...times].sort());
    expect(new Set(times).size).toBe(5);
  });

  it("no retrocede si el reloj del sistema se atrasa", () => {
    let now = 5000;
    const { sink, match } = newMatch(() => now);
    match.add("MATCH_STARTED");
    now = 1000;
    match.add("PLAYER_MOVED", undefined, "andres");

    expect(Date.parse(sink.events[1]!.timestamp)).toBeGreaterThan(Date.parse(sink.events[0]!.timestamp));
  });

  it("cierra con MATCH_FINISHED y el ganador, y después no emite nada más", () => {
    const { sink, match } = newMatch();
    match.add("MATCH_STARTED");
    match.finish("andres");
    match.add("LAP_COMPLETED", { lap: 9 }, "andres");
    match.finish("otro");

    expect(match.isClosed).toBe(true);
    expect(sink.events.map((e) => e.type)).toEqual(["MATCH_STARTED", "MATCH_FINISHED"]);
    expect(sink.events[1]!.data).toEqual({ winnerId: "andres" });
  });

  it("MATCH_FINISHED sin ganador no lleva data", () => {
    const { sink, match } = newMatch();
    match.finish();

    expect(sink.events[0]).not.toHaveProperty("data");
  });

  it("rechaza tipos que no van en MAYUSCULAS_CON_GUION_BAJO y playerId vacío", () => {
    const { sink, match } = newMatch();

    expect(() => match.add("lapCompleted")).toThrow(/MAYUSCULAS/);
    expect(() => match.add("LAP_COMPLETED", undefined, "  ")).toThrow(/playerId/);
    expect(sink.events).toHaveLength(0);
  });
});
