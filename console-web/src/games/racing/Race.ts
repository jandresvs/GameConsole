import type { Random } from "../core/Random";
import { BotCar, type BotProfile } from "./BotCar";
import { type Car, type Controls, type GridSlot, NO_CONTROLS } from "./Car";
import { PlayerCar } from "./PlayerCar";
import type { Track } from "./Track";

/** Lo que la carrera avisa hacia afuera. RacingGame lo convierte en eventos de GameStats. */
export interface RaceListener {
  onCrash(playerId: string, lap: number, timeLostMs: number): void;
  onLapCompleted(playerId: string, lap: number, lapTimeMs: number): void;
  /** La carrera terminó. winnerId = quien completó primero todas las vueltas. */
  onFinished(winnerId: string | undefined): void;
}

export type RacePhase = "countdown" | "racing" | "finished";

/** Posiciones de largada, de adelante hacia atrás. */
const GRID: readonly GridSlot[] = [
  { behind: 26, lane: 11 },
  { behind: 56, lane: -11 },
  { behind: 86, lane: 11 },
  { behind: 116, lane: -11 },
];

/** Carriles de los bots durante la carrera (así no van uno encima del otro). */
const BOT_LANES = [-9, 9, 0];

/**
 * Las reglas de una carrera, sin nada de dibujo ni de navegador:
 *
 *  1. Cuenta regresiva de 3 segundos; nadie se mueve.
 *  2. Cada auto avanza; los choques y las vueltas se avisan al listener.
 *  3. Quien completa todas las vueltas termina y se estaciona.
 *  4. La carrera acaba cuando todos terminan, o 30 segundos después de que
 *     terminó el primero: los que no llegaron quedan sin terminar.
 *
 * El reloj de la carrera arranca en 0 al terminar la cuenta regresiva.
 */
export class Race {
  static readonly COUNTDOWN_MS = 3000;
  static readonly FINISH_GRACE_MS = 30_000;

  readonly cars: readonly Car[];
  readonly player: PlayerCar;

  private currentPhase: RacePhase = "countdown";
  private countdownLeftMs = Race.COUNTDOWN_MS;
  private clockMs = 0;
  private firstFinishMs: number | undefined;
  private readonly finishOrder: string[] = [];

  constructor(
    readonly track: Track,
    playerId: string,
    playerColor: string,
    bots: readonly BotProfile[],
    private readonly listener: RaceListener,
    random: Random,
    /** En qué puesto de la grilla larga el usuario (0 = adelante). */
    playerSlot = 2,
  ) {
    if (bots.length + 1 > GRID.length) throw new Error(`La grilla tiene ${GRID.length} lugares`);

    const slots = [...GRID.slice(0, bots.length + 1)];
    const [mine] = slots.splice(playerSlot, 1);
    this.player = new PlayerCar(playerId, playerColor, track, mine!);
    const others = bots.map((b, i) => new BotCar(b, track, BOT_LANES[i % BOT_LANES.length]!, slots[i]!, random));
    this.cars = [this.player, ...others];
  }

  get phase(): RacePhase {
    return this.currentPhase;
  }

  /** Milisegundos desde la largada. */
  get raceMs(): number {
    return this.clockMs;
  }

  /** Lo que falta de la cuenta regresiva, en milisegundos. */
  get countdownMs(): number {
    return this.countdownLeftMs;
  }

  /** Cuánto falta para que se cierre la carrera, si alguien ya terminó. */
  get graceLeftMs(): number | undefined {
    return this.firstFinishMs === undefined ? undefined : Math.max(0, Race.FINISH_GRACE_MS - (this.clockMs - this.firstFinishMs));
  }

  /** Avanza la carrera dtMs. `controls` son los del usuario; los bots manejan solos. */
  update(dtMs: number, controls: Controls): void {
    if (this.currentPhase === "finished") return;

    if (this.currentPhase === "countdown") {
      this.countdownLeftMs -= dtMs;
      if (this.countdownLeftMs <= 0) {
        this.countdownLeftMs = 0;
        this.currentPhase = "racing";
      }
      return;
    }

    this.clockMs += dtMs;
    for (const car of this.cars) this.updateCar(car, dtMs, car === this.player ? controls : NO_CONTROLS);

    const everyoneDone = this.cars.every((c) => c.finished);
    const graceOver = this.graceLeftMs === 0;
    if (everyoneDone || graceOver) {
      this.currentPhase = "finished";
      this.listener.onFinished(this.finishOrder[0]);
    }
  }

  /** Orden actual: primero quienes terminaron (en orden de llegada), luego por distancia recorrida. */
  standings(): Car[] {
    return [...this.cars].sort((a, b) => {
      const fa = this.finishOrder.indexOf(a.playerId);
      const fb = this.finishOrder.indexOf(b.playerId);
      if (fa >= 0 || fb >= 0) return (fa < 0 ? Infinity : fa) - (fb < 0 ? Infinity : fb);
      return b.laps.distance - a.laps.distance;
    });
  }

  private updateCar(car: Car, dtMs: number, controls: Controls): void {
    if (car.finished) {
      car.park(dtMs);
      return;
    }

    const lostMs = car.update(dtMs, controls);
    if (lostMs !== undefined) this.listener.onCrash(car.playerId, car.currentLap, lostMs);

    const lapTime = car.laps.advance(car.trackPosition, this.clockMs);
    if (lapTime === undefined) return;

    this.listener.onLapCompleted(car.playerId, car.laps.completed, Math.round(lapTime));
    car.onLapCompleted();

    if (car.laps.completed >= this.track.laps) {
      car.markFinished(this.clockMs);
      this.finishOrder.push(car.playerId);
      this.firstFinishMs ??= this.clockMs;
    }
  }
}
