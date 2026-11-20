import { describe, expect, it } from "vitest";
import { Random } from "../core/Random";
import { laPlaza } from "./arenas";
import { BOTS } from "./bots";
import { CombatMatch, type CombatListener } from "./CombatMatch";
import { NO_INPUT } from "./PlayerFighter";
import { CombatAutopilot } from "./testing/CombatAutopilot";

const FRAME_MS = 1000 / 60;

interface Recorded {
  type: "SHOT_FIRED" | "DAMAGE_DEALT" | "PLAYER_ELIMINATED" | "MATCH_FINISHED";
  playerId?: string;
  data: Record<string, string | number | undefined>;
}

/** Juega una partida entera y guarda lo que avisa, como lo haría CombatGame con emit(). */
function play(seed: number, pilot: "autopilot" | "parked", bots = BOTS) {
  const events: Recorded[] = [];
  const listener: CombatListener = {
    onShot: (p, weapon) => events.push({ type: "SHOT_FIRED", playerId: p, data: { weapon } }),
    onDamage: (p, target, amount, weapon) => events.push({ type: "DAMAGE_DEALT", playerId: p, data: { target, amount, weapon } }),
    onElimination: (p, victimId, weapon) => events.push({ type: "PLAYER_ELIMINATED", playerId: p, data: { victimId, weapon } }),
    onFinished: (winnerId) => events.push({ type: "MATCH_FINISHED", data: { winnerId } }),
  };
  const match = new CombatMatch(laPlaza(), "andres", "#f2b441", bots, listener, new Random(seed));
  const autopilot = new CombatAutopilot(match, new Random(seed + 100), 0.7);

  let frames = 0;
  while (match.phase !== "finished" && frames < 60 * 200) {
    match.update(FRAME_MS, pilot === "parked" ? NO_INPUT : autopilot.input());
    frames += 1;
  }
  const before = events.length;
  for (let k = 0; k < 120; k++) match.update(FRAME_MS, autopilot.input());
  expect(events.length).toBe(before); // nada después de terminar
  return { match, events };
}

describe("CombatMatch", () => {
  for (const seed of [1, 2, 3]) {
    it(`partida completa (semilla ${seed}): los eventos cumplen lo que lee CombatAnalyzer.scala`, () => {
      const { match, events } = play(seed, "autopilot");
      expect(match.phase).toBe("finished");
      expect(events.filter((e) => e.type === "MATCH_FINISHED")).toHaveLength(1);
      expect(events.at(-1)!.type).toBe("MATCH_FINISHED");

      const shots = new Map<string, number>();
      const hits = new Map<string, number>();
      const lifeDamage = new Map<string, number>();
      const kills = new Map<string, number>();
      const key = (p: string | undefined, w: unknown) => `${p}/${String(w)}`;

      events.forEach((e, i) => {
        if (e.type === "SHOT_FIRED") shots.set(key(e.playerId, e.data.weapon), (shots.get(key(e.playerId, e.data.weapon)) ?? 0) + 1);

        if (e.type === "DAMAGE_DEALT") {
          const k = key(e.playerId, e.data.weapon);
          hits.set(k, (hits.get(k) ?? 0) + 1);
          // Un impacto siempre viene de un disparo previo del mismo jugador y arma: precisión <= 100 %.
          expect(hits.get(k)!).toBeLessThanOrEqual(shots.get(k) ?? 0);
          expect(e.data.target).not.toBe(e.playerId);
          const amount = Number(e.data.amount);
          expect(Number.isInteger(amount)).toBe(true);
          expect(amount).toBeGreaterThan(0);
          expect(amount).toBeLessThanOrEqual(50);
          const t = String(e.data.target);
          lifeDamage.set(t, (lifeDamage.get(t) ?? 0) + amount);
        }

        if (e.type === "PLAYER_ELIMINATED") {
          const victim = String(e.data.victimId);
          // Justo antes va el impacto que lo eliminó, del mismo atacante y con la misma arma.
          const prev = events[i - 1]!;
          expect(prev.type).toBe("DAMAGE_DEALT");
          expect(prev.playerId).toBe(e.playerId);
          expect(prev.data.target).toBe(victim);
          expect(prev.data.weapon).toBe(e.data.weapon);
          expect(victim).not.toBe(e.playerId);
          // En esa vida recibió exactamente 100 de daño.
          expect(lifeDamage.get(victim)).toBe(100);
          lifeDamage.set(victim, 0);
          kills.set(e.playerId!, (kills.get(e.playerId!) ?? 0) + 1);
        }
      });

      // El ganador es quien llegó a 8 eliminaciones, y la última eliminación es la suya.
      const winner = String(events.at(-1)!.data.winnerId);
      expect(kills.get(winner)).toBe(CombatMatch.KILLS_TO_WIN);
      expect(events.at(-2)!.type).toBe("PLAYER_ELIMINATED");
      expect(events.at(-2)!.playerId).toBe(winner);
      for (const [p, n] of kills) if (p !== winner) expect(n).toBeLessThan(CombatMatch.KILLS_TO_WIN);
    });
  }

  it("si el usuario no hace nada, los bots igual terminan la partida y él no dispara", () => {
    const { match, events } = play(1, "parked");
    expect(match.phase).toBe("finished");
    expect(events.some((e) => e.type === "SHOT_FIRED" && e.playerId === "andres")).toBe(false);
    expect(events.at(-1)!.data.winnerId).toMatch(/^bot-/);
  });

  it("si se acaba el tiempo empatados, no hay ganador", () => {
    const pacifists = BOTS.map((b) => ({ ...b, reactionMs: 1e9 })); // nunca llegan a disparar
    const { match, events } = play(1, "parked", pacifists);
    expect(match.nowMs).toBeGreaterThanOrEqual(CombatMatch.TIME_LIMIT_MS);
    expect(events).toEqual([{ type: "MATCH_FINISHED", data: { winnerId: undefined } }]);
  });

  it("durante la cuenta regresiva nadie se mueve ni dispara", () => {
    const events: string[] = [];
    const listener: CombatListener = { onShot: () => events.push("shot"), onDamage() {}, onElimination() {}, onFinished() {} };
    const match = new CombatMatch(laPlaza(), "andres", "#fff", BOTS, listener, new Random(1));
    const before = match.fighters.map((f) => [f.x, f.y]);
    for (let t = 0; t < CombatMatch.COUNTDOWN_MS - 100; t += FRAME_MS) {
      match.update(FRAME_MS, { ...NO_INPUT, right: true, shoot: true, aimAt: { x: 700, y: 400 } });
    }
    expect(match.phase).toBe("countdown");
    expect(match.fighters.map((f) => [f.x, f.y])).toEqual(before);
    expect(events).toEqual([]);
  });

  it("misma semilla, misma partida", () => {
    expect(play(9, "autopilot").events).toEqual(play(9, "autopilot").events);
  });
});
