import type { Random } from "../core/Random";
import { Car, type GridSlot } from "./Car";
import type { Track } from "./Track";

/** Cómo maneja un bot. Velocidades en px/s y aceleraciones en px/s². */
export interface BotProfile {
  readonly playerId: string;
  readonly color: string;
  /** Velocidad máxima en recta. */
  readonly topSpeed: number;
  /** Aceleración lateral que aguanta en curva: más agarre, más rápido en las curvas. */
  readonly grip: number;
  /** Probabilidad de cometer un error (y chocar) en cada vuelta. */
  readonly mistakeChance: number;
}

const ACCELERATION = 240;
const DECELERATION = 480;
/** Cuánto mira hacia adelante para frenar antes de una curva. */
const LOOKAHEAD = 30;

/**
 * Un piloto automático. No usa física: avanza sobre la línea central de la
 * pista, en su carril, a la velocidad que la curva permite. Las reglas son
 * simples y deterministas para una misma semilla:
 *
 *  - En cada punto de la pista su velocidad límite es la menor entre su
 *    máxima y la que aguanta la curva (√(agarre × radio)).
 *  - Frena con anticipación: el límite se propaga hacia atrás según cuánto
 *    puede frenar.
 *  - En cada vuelta varía un poco el ritmo y, a veces, comete un error en un
 *    punto al azar: choca y pierde entre 0,9 y 2 segundos.
 */
export class BotCar extends Car {
  private readonly speedLimits: number[];
  private readonly step: number;
  private pace = 1;
  /** Distancia total en la que va a cometer el error de esta vuelta, si hay. */
  private mistakeAt: number | undefined;

  constructor(
    readonly profile: BotProfile,
    track: Track,
    private readonly lane: number,
    slot: GridSlot,
    private readonly random: Random,
  ) {
    super(profile.playerId, profile.color, track, slot);
    this.step = track.length / 400;
    this.speedLimits = this.computeSpeedLimits();
    this.placeOnTrack();
    this.planLap();
  }

  override onLapCompleted(): void {
    this.planLap();
  }

  protected drive(dtMs: number): number | undefined {
    const dt = dtMs / 1000;

    const target = this.limitAt(this.s + LOOKAHEAD) * this.pace;
    if (this.velocity < target) this.velocity = Math.min(target, this.velocity + ACCELERATION * dt);
    else this.velocity = Math.max(target, this.velocity - DECELERATION * dt);

    this.s = this.track.wrap(this.s + this.velocity * dt);
    this.placeOnTrack();

    if (this.mistakeAt !== undefined && this.laps.distance >= this.mistakeAt) {
      this.mistakeAt = undefined;
      return this.crash(Math.round(this.random.between(900, 2000)));
    }
    return undefined;
  }

  protected coast(distance: number): void {
    this.s = this.track.wrap(this.s + distance);
    this.placeOnTrack();
  }

  protected override recover(): void {
    this.placeOnTrack();
    this.velocity = 0;
  }

  /** Decide el ritmo de la próxima vuelta y si en ella habrá un error. */
  private planLap(): void {
    this.pace = this.random.between(0.95, 1);
    const lapStart = (this.laps.completed) * this.track.length;
    this.mistakeAt = this.random.chance(this.profile.mistakeChance)
      ? lapStart + this.random.between(0.15, 0.85) * this.track.length
      : undefined;
  }

  private placeOnTrack(): void {
    const p = this.track.offsetPoint(this.s, this.lane);
    this.posX = p.x;
    this.posY = p.y;
    this.angle = p.heading;
  }

  private limitAt(s: number): number {
    const i = Math.floor(this.track.wrap(s) / this.step) % this.speedLimits.length;
    return this.speedLimits[i]!;
  }

  /** Velocidad máxima en cada punto: la de la curva, propagada hacia atrás para frenar a tiempo. */
  private computeSpeedLimits(): number[] {
    const n = Math.ceil(this.track.length / this.step);
    const limits = Array.from({ length: n }, (_, i) => {
      const k = this.track.curvature(i * this.step);
      return Math.min(this.profile.topSpeed, k > 1e-6 ? Math.sqrt(this.profile.grip / k) : Infinity);
    });
    // Dos pasadas hacia atrás: la pista es cerrada, la curva de la vuelta siguiente también cuenta.
    for (let pass = 0; pass < 2; pass++) {
      for (let i = n - 1; i >= 0; i--) {
        const next = limits[(i + 1) % n]!;
        limits[i] = Math.min(limits[i]!, Math.sqrt(next * next + 2 * DECELERATION * this.step));
      }
    }
    return limits;
  }
}
