/**
 * Generador de números pseudoaleatorios con semilla (algoritmo mulberry32).
 *
 * Los juegos lo usan en vez de Math.random() para que una partida se pueda
 * repetir igual en las pruebas: misma semilla, mismos números.
 */
export class Random {
  private state: number;

  constructor(seed: number = Math.floor(Math.random() * 2 ** 32)) {
    this.state = seed >>> 0;
  }

  /** Un número en [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Un número en [min, max). */
  between(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** true con probabilidad p. */
  chance(p: number): boolean {
    return this.next() < p;
  }
}
