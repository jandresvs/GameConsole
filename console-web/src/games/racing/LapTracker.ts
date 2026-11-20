/**
 * Cuenta las vueltas de un auto a partir de su posición en la pista.
 *
 * Lleva el avance total (cuánto ha recorrido hacia adelante desde la largada).
 * Una vuelta se completa cada vez que ese avance pasa un múltiplo del largo de
 * la pista. Ir en reversa resta avance, así que no se puede "ganar" una vuelta
 * cruzando la meta hacia atrás y otra vez hacia adelante.
 */
export class LapTracker {
  private progress: number;
  private lastS: number;
  private completedLaps = 0;
  private lapStartMs = 0;
  private readonly times: number[] = [];

  /**
   * @param trackLength largo de la pista.
   * @param startS posición inicial en la pista (ya en [0, largo)).
   * @param startProgress avance inicial: negativo si el auto larga detrás de la meta.
   */
  constructor(
    private readonly trackLength: number,
    startS: number,
    startProgress: number,
  ) {
    this.lastS = startS;
    this.progress = startProgress;
  }

  /** Vueltas completas. */
  get completed(): number {
    return this.completedLaps;
  }

  /** Avance total; sirve para ordenar a los autos durante la carrera. */
  get distance(): number {
    return this.progress;
  }

  /** Tiempos de cada vuelta completada, en milisegundos. */
  get lapTimes(): readonly number[] {
    return this.times;
  }

  /** Cuándo empezó la vuelta en curso, en el reloj de la carrera. */
  get currentLapStartMs(): number {
    return this.lapStartMs;
  }

  /**
   * Registra la nueva posición. Si con ella se completó una vuelta, devuelve
   * su tiempo en milisegundos.
   */
  advance(s: number, raceMs: number): number | undefined {
    let delta = s - this.lastS;
    if (delta > this.trackLength / 2) delta -= this.trackLength; // cruzó la meta hacia atrás
    if (delta < -this.trackLength / 2) delta += this.trackLength; // cruzó la meta hacia adelante
    this.lastS = s;
    this.progress += delta;

    if (this.progress < (this.completedLaps + 1) * this.trackLength) return undefined;

    this.completedLaps += 1;
    const lapTime = raceMs - this.lapStartMs;
    this.lapStartMs = raceMs;
    this.times.push(lapTime);
    return lapTime;
  }
}
