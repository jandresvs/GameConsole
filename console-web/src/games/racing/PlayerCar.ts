import { Car, type Controls, type GridSlot } from "./Car";
import type { Track } from "./Track";

/** Velocidades en px/s y aceleraciones en px/s². */
export const PLAYER_PHYSICS = {
  maxSpeed: 300,
  maxReverse: 80,
  acceleration: 250,
  braking: 560,
  drag: 130,
  /** Giro máximo en rad/s, a velocidad media. */
  turnRate: 3.1,
  /** Bajo esta velocidad, tocar el muro solo raspa: no cuenta como choque. */
  crashSpeed: 70,
  /** Medio ancho del auto, para saber cuándo toca el muro. */
  halfWidth: 7,
} as const;

/**
 * El auto del usuario. Tiene una física simple: acelera, frena, gira menos a
 * alta velocidad y, si toca el muro rápido, choca. Las teclas llegan como
 * Controls, así esta clase no sabe nada del teclado.
 */
export class PlayerCar extends Car {
  private hint: number | undefined;

  constructor(playerId: string, color: string, track: Track, slot: GridSlot) {
    super(playerId, color, track, slot);
    const start = track.offsetPoint(this.s, slot.lane);
    this.posX = start.x;
    this.posY = start.y;
    this.angle = start.heading;
  }

  protected drive(dtMs: number, c: Controls): number | undefined {
    const dt = dtMs / 1000;
    const P = PLAYER_PHYSICS;

    // 1. Acelerar, frenar o dejar que el roce lo frene.
    if (c.throttle) {
      this.velocity += (this.velocity < 0 ? P.braking : P.acceleration) * dt;
    } else if (c.brake) {
      this.velocity -= (this.velocity > 0 ? P.braking : P.acceleration * 0.5) * dt;
    } else {
      const drop = P.drag * dt;
      this.velocity = Math.abs(this.velocity) <= drop ? 0 : this.velocity - Math.sign(this.velocity) * drop;
    }
    this.velocity = Math.min(P.maxSpeed, Math.max(-P.maxReverse, this.velocity));

    // 2. Girar: casi nada detenido, mucho a velocidad media, menos al máximo.
    const v = Math.abs(this.velocity);
    const grip = Math.min(1, v / 70) * (1 - 0.5 * Math.min(1, v / P.maxSpeed));
    const steer = Number(c.right) - Number(c.left);
    this.angle += steer * P.turnRate * grip * dt * (this.velocity < 0 ? -1 : 1);

    // 3. Moverse.
    this.posX += Math.cos(this.angle) * this.velocity * dt;
    this.posY += Math.sin(this.angle) * this.velocity * dt;

    // 4. ¿Sigue dentro de la pista?
    const where = this.track.project({ x: this.posX, y: this.posY }, this.hint);
    this.hint = where.index;
    this.s = where.s;

    const limit = this.track.halfWidth - P.halfWidth;
    if (where.distance <= limit) return undefined;

    if (v >= P.crashSpeed) {
      // Choque: el tiempo perdido crece con la velocidad.
      return this.crash(Math.round(Math.min(2400, Math.max(900, 500 + v * 5))));
    }

    // Raspón lento: se queda pegado al borde y pierde velocidad, sin choque.
    const edge = this.track.offsetPoint(where.s, where.side * limit);
    this.posX = edge.x;
    this.posY = edge.y;
    this.velocity *= 0.6;
    return undefined;
  }

  protected coast(distance: number): void {
    this.posX += Math.cos(this.angle) * distance;
    this.posY += Math.sin(this.angle) * distance;
  }
}
