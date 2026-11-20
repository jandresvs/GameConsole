import { describe, expect, it } from "vitest";
import { laPlaza } from "./arenas";
import { Fighter } from "./Fighter";

const arena = laPlaza();

describe("Arena (La Plaza)", () => {
  it("todos los puntos de aparición están libres", () => {
    for (const s of arena.spawns) expect(arena.isFree(s, Fighter.RADIUS)).toBe(true);
  });

  it("caminar contra una pared desliza a lo largo de ella en vez de atravesarla", () => {
    // Justo a la izquierda del bloque central, empujando en diagonal hacia él.
    const start = { x: 345 - Fighter.RADIUS - 1, y: 250 };
    const after = arena.move(start, 10, 10, Fighter.RADIUS);
    expect(after.x).toBeCloseTo(start.x); // no entró al bloque
    expect(after.y).toBeCloseTo(260); // pero sí avanzó hacia abajo
  });

  it("no deja salir de la arena", () => {
    const corner = { x: 13, y: 53 };
    const after = arena.move(corner, -50, -50, Fighter.RADIUS);
    expect(after).toEqual(corner);
  });

  it("el bloque central corta la línea de visión de lado a lado", () => {
    expect(arena.hasLineOfSight({ x: 250, y: 250 }, { x: 510, y: 250 })).toBe(false);
    expect(arena.hasLineOfSight({ x: 250, y: 160 }, { x: 510, y: 160 })).toBe(true);
  });

  it("un proyectil dentro de un obstáculo o fuera de la arena queda bloqueado", () => {
    expect(arena.blocks({ x: 380, y: 250 })).toBe(true);
    expect(arena.blocks({ x: 380, y: 20 })).toBe(true);
    expect(arena.blocks({ x: 100, y: 250 })).toBe(false);
  });
});
