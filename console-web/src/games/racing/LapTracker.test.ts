import { describe, expect, it } from "vitest";
import { LapTracker } from "./LapTracker";

const L = 1000;

describe("LapTracker", () => {
  it("cuenta una vuelta al cruzar la meta hacia adelante y da su tiempo", () => {
    const laps = new LapTracker(L, 900, -100); // larga 100 detrás de la meta
    expect(laps.advance(990, 1000)).toBeUndefined();
    expect(laps.advance(10, 1500)).toBeUndefined(); // cruzó la meta, pero esa fue la largada
    for (let s = 100; s < 1000; s += 100) expect(laps.advance(s, 2000)).toBeUndefined();
    expect(laps.advance(5, 9000)).toBe(9000);
    expect(laps.completed).toBe(1);
    expect(laps.advance(500, 12000)).toBeUndefined();
    expect(laps.advance(999, 14000)).toBeUndefined();
    expect(laps.advance(3, 14500)).toBe(5500);
    expect(laps.lapTimes).toEqual([9000, 5500]);
  });

  it("cruzar la meta hacia atrás y otra vez hacia adelante no suma vuelta", () => {
    const laps = new LapTracker(L, 0, 0);
    for (let s = 100; s < 1000; s += 100) laps.advance(s, 1000);
    laps.advance(990, 1000);
    expect(laps.advance(10, 2000)).toBe(2000); // primera vuelta
    expect(laps.advance(990, 2100)).toBeUndefined(); // reversa por encima de la meta
    expect(laps.advance(10, 2200)).toBeUndefined(); // vuelve a cruzar: no cuenta
    expect(laps.completed).toBe(1);
  });

  it("un auto que no se mueve nunca completa vueltas", () => {
    const laps = new LapTracker(L, 950, -50);
    for (let t = 0; t < 100_000; t += 1000) expect(laps.advance(950, t)).toBeUndefined();
    expect(laps.completed).toBe(0);
  });
});
