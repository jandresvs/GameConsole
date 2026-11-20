import { LapTracker } from "./LapTracker";
import type { Track } from "./Track";

/** Lo que el piloto está pidiendo en este momento. */
export interface Controls {
  readonly throttle: boolean;
  readonly brake: boolean;
  readonly left: boolean;
  readonly right: boolean;
}

export const NO_CONTROLS: Controls = { throttle: false, brake: false, left: false, right: false };

/** Dónde larga un auto: distancia antes de la meta y carril. */
export interface GridSlot {
  /** Cuánto detrás de la meta larga, en píxeles. */
  readonly behind: number;
  /** Desplazamiento lateral desde la línea central (+ izquierda, - derecha). */
  readonly lane: number;
}

/** Desaceleración de un auto que ya terminó y se detiene, en px/s². */
const PARK_DECEL = 420;

/**
 * Un auto de la carrera. La clase base guarda lo común: posición, dirección,
 * velocidad, el contador de vueltas y el estado de "aturdido" tras un choque.
 * Cómo se maneja lo decide cada subclase: PlayerCar con física y teclado,
 * BotCar siguiendo la pista por su cuenta.
 */
export abstract class Car {
  readonly laps: LapTracker;

  protected posX = 0;
  protected posY = 0;
  protected angle = 0;
  protected velocity = 0;
  /** Posición sobre la línea central (ver Track). */
  protected s: number;

  private stunLeftMs = 0;
  private lastLostMs = 0;
  private finishTimeMs: number | undefined;

  protected constructor(
    readonly playerId: string,
    readonly color: string,
    protected readonly track: Track,
    slot: GridSlot,
  ) {
    this.s = track.wrap(-slot.behind);
    this.laps = new LapTracker(track.length, this.s, -slot.behind);
  }

  get x(): number {
    return this.posX;
  }

  get y(): number {
    return this.posY;
  }

  get heading(): number {
    return this.angle;
  }

  get speed(): number {
    return this.velocity;
  }

  get trackPosition(): number {
    return this.s;
  }

  /** true mientras se recupera de un choque. */
  get stunned(): boolean {
    return this.stunLeftMs > 0;
  }

  /** Tiempo perdido en el último choque, para mostrarlo en pantalla. */
  get lastCrashLostMs(): number {
    return this.lastLostMs;
  }

  get finished(): boolean {
    return this.finishTimeMs !== undefined;
  }

  /** Cuándo terminó la carrera, en el reloj de la carrera. */
  get finishedAtMs(): number | undefined {
    return this.finishTimeMs;
  }

  /** La vuelta que está corriendo ahora (1, 2, …), sin pasarse de la última. */
  get currentLap(): number {
    return Math.min(this.laps.completed + 1, this.track.laps);
  }

  /**
   * Avanza el auto dtMs milisegundos. Si chocó en este paso, devuelve el
   * tiempo que va a perder por el choque.
   */
  update(dtMs: number, controls: Controls): number | undefined {
    if (this.stunLeftMs > 0) {
      this.stunLeftMs = Math.max(0, this.stunLeftMs - dtMs);
      if (this.stunLeftMs === 0) this.recover();
      return undefined;
    }
    return this.drive(dtMs, controls);
  }

  /** Marca que el auto cruzó la meta por última vez. */
  markFinished(raceMs: number): void {
    this.finishTimeMs ??= raceMs;
  }

  /** Después de terminar: frena hasta detenerse, sin volver a chocar. */
  park(dtMs: number): void {
    this.velocity = Math.max(0, this.velocity - (PARK_DECEL * dtMs) / 1000);
    this.coast((this.velocity * dtMs) / 1000);
  }

  /** Se llama cada vez que el auto completa una vuelta. */
  onLapCompleted(): void {}

  /** Maneja durante un paso. Devuelve el tiempo perdido si chocó. */
  protected abstract drive(dtMs: number, controls: Controls): number | undefined;

  /** Avanza `distance` píxeles sin manejar (para estacionarse al terminar). */
  protected abstract coast(distance: number): void;

  /** Vuelve a la pista cuando termina el tiempo perdido por un choque. */
  protected recover(): void {
    const p = this.track.pose(this.s);
    this.posX = p.x;
    this.posY = p.y;
    this.angle = p.heading;
    this.velocity = 0;
  }

  /** Detiene el auto y lo deja quieto `timeLostMs`. Devuelve ese tiempo. */
  protected crash(timeLostMs: number): number {
    this.velocity = 0;
    this.stunLeftMs = timeLostMs;
    this.lastLostMs = timeLostMs;
    return timeLostMs;
  }
}
