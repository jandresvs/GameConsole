import { circleHitsRect, type Rect, segmentHitsRect, type Vec } from "./geometry";

/**
 * El campo de batalla: un rectángulo con obstáculos (coberturas) y puntos de
 * aparición. Sabe mover un círculo sin que atraviese paredes y si dos puntos
 * se ven entre sí.
 */
export class Arena {
  constructor(
    readonly name: string,
    readonly bounds: Rect,
    readonly obstacles: readonly Rect[],
    readonly spawns: readonly Vec[],
  ) {}

  /** ¿Un círculo de radio r cabe en p sin tocar paredes ni obstáculos? */
  isFree(p: Vec, r: number): boolean {
    const b = this.bounds;
    if (p.x - r < b.x || p.x + r > b.x + b.w || p.y - r < b.y || p.y + r > b.y + b.h) return false;
    return !this.obstacles.some((o) => circleHitsRect(p, r, o));
  }

  /**
   * Mueve un círculo de `from` en (dx, dy). Si choca, intenta cada eje por
   * separado: así el que camina contra una pared se desliza a lo largo de ella.
   */
  move(from: Vec, dx: number, dy: number, r: number): Vec {
    const full = { x: from.x + dx, y: from.y + dy };
    if (this.isFree(full, r)) return full;
    const onlyX = { x: from.x + dx, y: from.y };
    const afterX = this.isFree(onlyX, r) ? onlyX : from;
    const onlyY = { x: afterX.x, y: afterX.y + dy };
    return this.isFree(onlyY, r) ? onlyY : afterX;
  }

  /** ¿Se ve b desde a? (ningún obstáculo atraviesa la línea entre ellos) */
  hasLineOfSight(a: Vec, b: Vec): boolean {
    return !this.obstacles.some((o) => segmentHitsRect(a, b, o));
  }

  /** ¿Un proyectil en p chocó con una pared o un obstáculo? */
  blocks(p: Vec): boolean {
    const b = this.bounds;
    if (p.x < b.x || p.x > b.x + b.w || p.y < b.y || p.y > b.y + b.h) return true;
    return this.obstacles.some((o) => p.x >= o.x && p.x <= o.x + o.w && p.y >= o.y && p.y <= o.y + o.h);
  }
}
