import { DIFFICULTIES, type Difficulty } from "./Pace.ts";

/** Los niveles contra la IA, de más fácil a más difícil: en cada uno la IA mueve más rápido. */
export const LEVELS: readonly Difficulty[] = ["facil", "normal", "dificil", "experto"];

export interface LevelInfo {
  /** Número de nivel, desde 1. */
  readonly number: number;
  readonly total: number;
  readonly difficulty: Difficulty;
  readonly label: string;
  readonly isLast: boolean;
}

export function levelInfo(difficulty: Difficulty): LevelInfo {
  const index = Math.max(0, LEVELS.indexOf(difficulty));
  return {
    number: index + 1,
    total: LEVELS.length,
    difficulty: LEVELS[index]!,
    label: DIFFICULTIES[LEVELS[index]!].label,
    isLast: index === LEVELS.length - 1,
  };
}

/** El nivel que sigue; después del último vuelve al primero. */
export function nextLevel(difficulty: Difficulty): Difficulty {
  const index = LEVELS.indexOf(difficulty);
  return LEVELS[index + 1] ?? LEVELS[0]!;
}
