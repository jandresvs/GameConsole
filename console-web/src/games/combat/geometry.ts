export interface Vec {
  readonly x: number;
  readonly y: number;
}

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export function distance(a: Vec, b: Vec): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function angleTo(from: Vec, to: Vec): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

/** ¿El círculo (c, r) toca el rectángulo? */
export function circleHitsRect(c: Vec, r: number, rect: Rect): boolean {
  const nx = Math.max(rect.x, Math.min(c.x, rect.x + rect.w));
  const ny = Math.max(rect.y, Math.min(c.y, rect.y + rect.h));
  return (c.x - nx) ** 2 + (c.y - ny) ** 2 < r * r;
}

/** ¿El segmento a → b atraviesa el rectángulo? (método de las franjas) */
export function segmentHitsRect(a: Vec, b: Vec, rect: Rect): boolean {
  let t0 = 0;
  let t1 = 1;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const clip = (p: number, q: number): boolean => {
    if (p === 0) return q >= 0;
    const t = q / p;
    if (p < 0) {
      if (t > t1) return false;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return false;
      if (t < t1) t1 = t;
    }
    return true;
  };
  return (
    clip(-dx, a.x - rect.x) &&
    clip(dx, rect.x + rect.w - a.x) &&
    clip(-dy, a.y - rect.y) &&
    clip(dy, rect.y + rect.h - a.y)
  );
}

/**
 * Primer punto (como fracción 0..1 del recorrido) donde el segmento a → b
 * entra en el círculo (c, r), o undefined si no lo toca.
 */
export function segmentHitsCircle(a: Vec, b: Vec, c: Vec, r: number): number | undefined {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const fx = a.x - c.x;
  const fy = a.y - c.y;
  const A = dx * dx + dy * dy;
  const B = 2 * (fx * dx + fy * dy);
  const C = fx * fx + fy * fy - r * r;
  if (C <= 0) return 0; // ya empezó adentro
  if (A === 0) return undefined;
  const disc = B * B - 4 * A * C;
  if (disc < 0) return undefined;
  const t = (-B - Math.sqrt(disc)) / (2 * A);
  return t >= 0 && t <= 1 ? t : undefined;
}
