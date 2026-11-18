export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Un punto de la línea central con la dirección de la pista ahí (en radianes). */
export interface TrackPose extends Point {
  readonly heading: number;
}

/** Dónde queda un punto respecto a la pista. */
export interface Projection {
  /** Distancia recorrida sobre la línea central, desde la línea de meta. */
  readonly s: number;
  /** Distancia del punto a la línea central. */
  readonly distance: number;
  /** De qué lado está: +1 a la izquierda de la dirección de carrera, -1 a la derecha. */
  readonly side: number;
  /** Tramo más cercano; sirve de pista para la siguiente búsqueda. */
  readonly index: number;
}

/** Cuántos tramos a cada lado se revisan cuando hay una pista de dónde estaba el auto. */
const SEARCH_WINDOW = 24;

/**
 * Un circuito cerrado. Se define con unos pocos puntos de control; la línea
 * central sale de una curva suave (Catmull-Rom) que pasa por todos ellos.
 *
 * Todas las posiciones a lo largo de la pista se expresan con `s`: la
 * distancia recorrida sobre la línea central desde la línea de meta. s = 0
 * es la meta y s = length es la meta otra vez.
 */
export class Track {
  readonly length: number;
  /** Los puntos de la línea central, ya muestreados. Para dibujar. */
  readonly centerline: readonly Point[];

  private readonly cumulative: number[]; // cumulative[i] = s del punto i; cumulative[n] = length
  private readonly headings: number[]; // dirección del tramo i → i+1
  private readonly curvatures: number[]; // curvatura suavizada en el punto i (1 / radio)

  constructor(
    readonly name: string,
    readonly laps: number,
    readonly width: number,
    controlPoints: readonly Point[],
    samplesPerSegment = 40,
  ) {
    if (controlPoints.length < 4) throw new Error("Una pista necesita al menos 4 puntos de control");

    this.centerline = Track.spline(controlPoints, samplesPerSegment);
    const n = this.centerline.length;

    this.cumulative = [0];
    this.headings = [];
    for (let i = 0; i < n; i++) {
      const a = this.centerline[i]!;
      const b = this.centerline[(i + 1) % n]!;
      this.cumulative.push(this.cumulative[i]! + Math.hypot(b.x - a.x, b.y - a.y));
      this.headings.push(Math.atan2(b.y - a.y, b.x - a.x));
    }
    this.length = this.cumulative[n]!;
    this.curvatures = this.computeCurvatures();
  }

  get halfWidth(): number {
    return this.width / 2;
  }

  /** Lleva cualquier s al rango [0, length). */
  wrap(s: number): number {
    return ((s % this.length) + this.length) % this.length;
  }

  /** El punto de la línea central en s y la dirección de la pista ahí. */
  pose(s: number): TrackPose {
    const t = this.wrap(s);
    const i = this.segmentAt(t);
    const a = this.centerline[i]!;
    const b = this.centerline[(i + 1) % this.centerline.length]!;
    const segLength = this.cumulative[i + 1]! - this.cumulative[i]!;
    const f = segLength === 0 ? 0 : (t - this.cumulative[i]!) / segLength;
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, heading: this.headings[i]! };
  }

  /** El punto a una distancia `offset` de la línea central, hacia la izquierda (+) o la derecha (-). */
  offsetPoint(s: number, offset: number): TrackPose {
    const p = this.pose(s);
    // La normal izquierda de la dirección (cos, sin) es (sin, -cos) en pantalla, donde y crece hacia abajo.
    return { x: p.x + Math.sin(p.heading) * offset, y: p.y - Math.cos(p.heading) * offset, heading: p.heading };
  }

  /** Curvatura (1 / radio) de la pista en s. Recta = 0. */
  curvature(s: number): number {
    return this.curvatures[this.segmentAt(this.wrap(s))]!;
  }

  /**
   * El punto de la línea central más cercano a p. Con `hint` (el tramo donde
   * estaba el auto en el cuadro anterior) solo se busca alrededor: es más
   * rápido y evita saltar a otra parte del circuito que pase cerca.
   */
  project(p: Point, hint?: number): Projection {
    const n = this.centerline.length;
    const from = hint === undefined ? 0 : hint - SEARCH_WINDOW;
    const count = hint === undefined ? n : 2 * SEARCH_WINDOW + 1;

    let best: Projection = { s: 0, distance: Infinity, side: 1, index: 0 };
    for (let k = 0; k < count; k++) {
      const i = (((from + k) % n) + n) % n;
      const a = this.centerline[i]!;
      const b = this.centerline[(i + 1) % n]!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len2 = dx * dx + dy * dy;
      const f = len2 === 0 ? 0 : Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
      const qx = a.x + dx * f;
      const qy = a.y + dy * f;
      const distance = Math.hypot(p.x - qx, p.y - qy);
      if (distance < best.distance) {
        const cross = dx * (p.y - a.y) - dy * (p.x - a.x); // < 0: a la izquierda en pantalla
        best = { s: this.cumulative[i]! + f * Math.sqrt(len2), distance, side: cross < 0 ? 1 : -1, index: i };
      }
    }
    return best;
  }

  /** Índice del tramo que contiene t (t ya en [0, length)). Búsqueda binaria. */
  private segmentAt(t: number): number {
    let lo = 0;
    let hi = this.centerline.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.cumulative[mid]! <= t) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  private segmentLength(i: number): number {
    return this.cumulative[i + 1]! - this.cumulative[i]!;
  }

  /** Cambio de dirección por unidad de distancia, promediado con los vecinos para que sea estable. */
  private computeCurvatures(): number[] {
    const n = this.centerline.length;
    const raw = this.headings.map((h, i) => {
      const prev = this.headings[(i - 1 + n) % n]!;
      let d = h - prev;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      const ds = (this.segmentLength(i) + this.segmentLength((i - 1 + n) % n)) / 2;
      return Math.abs(d) / Math.max(ds, 1e-6);
    });
    const radius = 4;
    return raw.map((_, i) => {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) sum += raw[(i + k + n) % n]!;
      return sum / (2 * radius + 1);
    });
  }

  /** Curva cerrada de Catmull-Rom que pasa por los puntos de control. */
  private static spline(points: readonly Point[], perSegment: number): Point[] {
    const m = points.length;
    const at = (i: number) => points[((i % m) + m) % m]!;
    const result: Point[] = [];
    for (let i = 0; i < m; i++) {
      const p0 = at(i - 1);
      const p1 = at(i);
      const p2 = at(i + 1);
      const p3 = at(i + 2);
      for (let k = 0; k < perSegment; k++) {
        const t = k / perSegment;
        const t2 = t * t;
        const t3 = t2 * t;
        result.push({
          x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
          y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
        });
      }
    }
    return result;
  }
}
