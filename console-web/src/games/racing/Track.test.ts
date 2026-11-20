import { describe, expect, it } from "vitest";
import { circuitoArenal } from "./tracks";

const track = circuitoArenal();

describe("Track (Circuito Arenal)", () => {
  it("es cerrada: s = 0 y s = largo son el mismo punto", () => {
    const a = track.pose(0);
    const b = track.pose(track.length);
    expect(b.x).toBeCloseTo(a.x, 6);
    expect(b.y).toBeCloseTo(a.y, 6);
  });

  it("proyectar un punto de la línea central devuelve su misma s", () => {
    for (let s = 0; s < track.length; s += 97) {
      const where = track.project(track.pose(s));
      expect(where.distance).toBeLessThan(0.5);
      expect(Math.abs(where.s - s)).toBeLessThan(1);
    }
  });

  it("offsetPoint pone el punto a esa distancia, del lado pedido", () => {
    for (const s of [0, 400, 900, 1400]) {
      const left = track.project(track.offsetPoint(s, 15));
      const right = track.project(track.offsetPoint(s, -15));
      expect(left.distance).toBeCloseTo(15, 0);
      expect(left.side).toBe(1);
      expect(right.side).toBe(-1);
    }
  });

  it("la recta de meta es recta y la horquilla es la curva más cerrada", () => {
    expect(track.curvature(0)).toBeLessThan(0.002);
    let tightest = 0;
    for (let s = 0; s < track.length; s += 5) tightest = Math.max(tightest, track.curvature(s));
    expect(tightest).toBeGreaterThan(0.01);
    expect(1 / tightest).toBeGreaterThan(track.halfWidth); // radio mayor que medio ancho: la curva se puede tomar
  });

  it("entra completa en el lienzo de 760 × 460, con pianos incluidos", () => {
    const margin = track.halfWidth + 5;
    for (const p of track.centerline) {
      expect(p.x).toBeGreaterThan(margin);
      expect(p.x).toBeLessThan(760 - margin);
      expect(p.y).toBeGreaterThan(margin);
      expect(p.y).toBeLessThan(460 - margin);
    }
  });

  it("no se toca consigo misma: dos tramos lejanos nunca quedan a menos de un ancho de pista", () => {
    const pts = track.centerline;
    const step = track.length / pts.length;
    for (let i = 0; i < pts.length; i += 3) {
      for (let j = i + 3; j < pts.length; j += 3) {
        const along = Math.min(j - i, pts.length - (j - i)) * step;
        if (along < 3 * track.width) continue; // vecinos sobre la misma pista
        const d = Math.hypot(pts[i]!.x - pts[j]!.x, pts[i]!.y - pts[j]!.y);
        expect(d, `tramos en s≈${(i * step).toFixed(0)} y s≈${(j * step).toFixed(0)}`).toBeGreaterThan(track.width + 10);
      }
    }
  });
});
