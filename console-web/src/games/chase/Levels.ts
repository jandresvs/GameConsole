import { DIFFICULTIES, type Difficulty } from "./Pace.ts";

/** Los niveles contra la IA, de más fácil a más difícil: la IA mueve cada vez más rápido. */
export const LEVELS: readonly Difficulty[] = ["facil", "normal", "dificil", "experto"];

/** En qué nivel va el jugador contra la IA. Cada nivel es una partida nueva. */
export class LevelProgress {
  private index: number;

  constructor(start: Difficulty = "facil") {
    this.index = Math.max(0, LEVELS.indexOf(start));
  }

  /** Número de nivel, desde 1. */
  get number(): number {
    return this.index + 1;
  }

  get total(): number {
    return LEVELS.length;
  }

  get difficulty(): Difficulty {
    return LEVELS[this.index]!;
  }

  get label(): string {
    return DIFFICULTIES[this.difficulty].label;
  }

  get isLast(): boolean {
    return this.index === LEVELS.length - 1;
  }

  /** Sube un nivel; después del último vuelve al primero. */
  advance(): void {
    this.index = this.isLast ? 0 : this.index + 1;
  }
}
