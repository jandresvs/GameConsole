/** Cuánto tiene que esperar una persona entre un movimiento y el siguiente (0,5 s). */
export const HUMAN_COOLDOWN_MS = 500;

export type Difficulty = "facil" | "normal" | "dificil" | "experto";

/**
 * La dificultad es la velocidad de la IA: cada cuántos milisegundos mueve.
 * "Difícil" iguala el ritmo máximo de una persona y "experto" lo supera.
 */
export const DIFFICULTIES: Readonly<Record<Difficulty, { label: string; cpuIntervalMs: number }>> = {
  facil: { label: "Fácil", cpuIntervalMs: 1000 },
  normal: { label: "Normal", cpuIntervalMs: 700 },
  dificil: { label: "Difícil", cpuIntervalMs: 500 },
  experto: { label: "Experto", cpuIntervalMs: 350 },
};

export function isDifficulty(value: unknown): value is Difficulty {
  return typeof value === "string" && value in DIFFICULTIES;
}
