import { describe, expect, it } from "vitest";
import { Random } from "../core/Random";
import { BOTS } from "./bots";
import { NO_CONTROLS } from "./Car";
import { Race, type RaceListener } from "./Race";
import { Autopilot } from "./testing/Autopilot";
import { circuitoArenal } from "./tracks";

const FRAME_MS = 1000 / 60;

interface Recorded {
  type: "CRASH" | "LAP_COMPLETED" | "MATCH_FINISHED";
  playerId?: string;
  data: Record<string, number | string | undefined>;
  atMs: number;
}

/** Corre una carrera entera y guarda lo que avisa, como lo haría RacingGame con emit(). */
function runRace(seed: number, pilot: "fast" | "careful" | "reckless" | "parked") {
  const events: Recorded[] = [];
  let race!: Race;
  const listener: RaceListener = {
    onCrash: (playerId, lap, timeLostMs) => events.push({ type: "CRASH", playerId, data: { lap, timeLostMs }, atMs: race.raceMs }),
    onLapCompleted: (playerId, lap, lapTimeMs) =>
      events.push({ type: "LAP_COMPLETED", playerId, data: { lap, lapTimeMs }, atMs: race.raceMs }),
    onFinished: (winnerId) => events.push({ type: "MATCH_FINISHED", data: { winnerId }, atMs: race.raceMs }),
  };
  const track = circuitoArenal();
  race = new Race(track, "andres", "#f2b441", BOTS, listener, new Random(seed));
  const grip = { fast: 420, careful: 300, reckless: 1e9, parked: 0 }[pilot];
  const autopilot = new Autopilot(track, race.player, grip);

  let frames = 0;
  while (race.phase !== "finished" && frames < 60 * 300) {
    race.update(FRAME_MS, pilot === "parked" ? NO_CONTROLS : autopilot.controls());
    frames += 1;
  }
  // Pasos de más después de terminar: no debe salir nada nuevo.
  const before = events.length;
  for (let k = 0; k < 120; k++) race.update(FRAME_MS, autopilot.controls());
  expect(events.length).toBe(before);
  return { race, events, track };
}

/** El orden final como lo calcula RacingAnalyzer.scala: más vueltas primero; a igualdad, menor tiempo total. */
function scalaFinishOrder(events: Recorded[], players: string[]): string[] {
  const laps = (p: string) => events.filter((e) => e.type === "LAP_COMPLETED" && e.playerId === p);
  const total = (p: string) => laps(p).reduce((sum, e) => sum + Number(e.data.lapTimeMs), 0);
  return [...players].sort((a, b) => laps(b).length - laps(a).length || total(a) - total(b));
}

describe("Race", () => {
  it("una carrera completa produce lo que espera el analizador de racing de GameStats", () => {
    const { race, events, track } = runRace(1, "fast");
    const players = race.cars.map((c) => c.playerId);

    expect(race.phase).toBe("finished");
    expect(events.filter((e) => e.type === "MATCH_FINISHED")).toHaveLength(1);
    expect(events.at(-1)!.type).toBe("MATCH_FINISHED");

    for (const p of players) {
      const laps = events.filter((e) => e.type === "LAP_COMPLETED" && e.playerId === p);
      // Las vueltas van numeradas 1, 2, 3 y en orden.
      expect(laps.map((e) => e.data.lap)).toEqual([1, 2, 3]);
      for (const e of laps) {
        expect(Number.isInteger(e.data.lapTimeMs)).toBe(true);
        expect(Number(e.data.lapTimeMs)).toBeGreaterThan(5000);
      }
      // La suma de las vueltas es el tiempo total de la carrera de ese piloto.
      const total = laps.reduce((s, e) => s + Number(e.data.lapTimeMs), 0);
      const car = race.cars.find((c) => c.playerId === p)!;
      expect(Math.abs(total - car.finishedAtMs!)).toBeLessThanOrEqual(2);
    }

    // El ganador que manda el juego coincide con el primero del orden que calcula Scala.
    const winner = events.at(-1)!.data.winnerId;
    expect(winner).toBe(scalaFinishOrder(events, players)[0]);
    expect(track.laps).toBe(3);
  });

  it("cada choque indica la vuelta en curso y un tiempo perdido entero entre 0,9 y 2,4 s", () => {
    for (const seed of [1, 2, 3, 4]) {
      const { events } = runRace(seed, "reckless");
      const crashes = events.filter((e) => e.type === "CRASH");
      expect(crashes.length).toBeGreaterThan(0);
      for (const c of crashes) {
        const lost = Number(c.data.timeLostMs);
        expect(Number.isInteger(lost)).toBe(true);
        expect(lost).toBeGreaterThanOrEqual(900);
        expect(lost).toBeLessThanOrEqual(2400);
        // La vuelta del choque es la que estaba corriendo: aún no había completado esa vuelta.
        const lapsBefore = events.filter(
          (e) => e.type === "LAP_COMPLETED" && e.playerId === c.playerId && e.atMs <= c.atMs,
        ).length;
        expect(c.data.lap).toBe(Math.min(lapsBefore + 1, 3));
      }
    }
  });

  it("chocar cuesta tiempo: sin frenar, las vueltas del jugador son mucho más lentas", () => {
    const fast = runRace(1, "fast").events.filter((e) => e.playerId === "andres" && e.type === "LAP_COMPLETED");
    const reckless = runRace(1, "reckless").events.filter((e) => e.playerId === "andres" && e.type === "LAP_COMPLETED");
    const avg = (xs: Recorded[]) => xs.reduce((s, e) => s + Number(e.data.lapTimeMs), 0) / xs.length;
    expect(reckless.length).toBeGreaterThan(0);
    expect(avg(reckless)).toBeGreaterThan(avg(fast) * 1.5);
  });

  it("un buen piloto le gana a los bots y uno prudente pierde", () => {
    const fastWins = [1, 2, 3].filter((seed) => runRace(seed, "fast").events.at(-1)!.data.winnerId === "andres");
    const carefulWins = [1, 2, 3].filter((seed) => runRace(seed, "careful").events.at(-1)!.data.winnerId === "andres");
    expect(fastWins.length).toBeGreaterThanOrEqual(2);
    expect(carefulWins.length).toBeLessThanOrEqual(1);
  });

  it("si el jugador no se mueve, la carrera cierra 30 s después del primero y él queda sin vueltas", () => {
    const { race, events } = runRace(1, "parked");
    const firstFinish = Math.min(...race.cars.filter((c) => c.finished).map((c) => c.finishedAtMs!));
    expect(race.player.finished).toBe(false);
    expect(events.some((e) => e.playerId === "andres")).toBe(false);
    expect(race.raceMs - firstFinish).toBeGreaterThanOrEqual(Race.FINISH_GRACE_MS);
    expect(race.raceMs - firstFinish).toBeLessThan(Race.FINISH_GRACE_MS + 20);
    expect(events.at(-1)!.data.winnerId).toMatch(/^bot-/);
  });

  it("durante la cuenta regresiva nadie se mueve ni corre el reloj", () => {
    const race = new Race(circuitoArenal(), "andres", "#fff", BOTS, { onCrash() {}, onLapCompleted() {}, onFinished() {} }, new Random(1));
    const before = race.cars.map((c) => [c.x, c.y]);
    for (let t = 0; t < Race.COUNTDOWN_MS - 100; t += FRAME_MS) {
      race.update(FRAME_MS, { throttle: true, brake: false, left: false, right: false });
    }
    expect(race.phase).toBe("countdown");
    expect(race.raceMs).toBe(0);
    expect(race.cars.map((c) => [c.x, c.y])).toEqual(before);
  });

  it("misma semilla, misma carrera", () => {
    const a = runRace(7, "fast").events;
    const b = runRace(7, "fast").events;
    expect(b).toEqual(a);
  });
});
