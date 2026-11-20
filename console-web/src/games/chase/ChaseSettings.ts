import type { FollowUp, GameOption, GameSettings } from "../core/GameDefinition.ts";
import type { MatchResult } from "../core/Game.ts";
import { levelInfo, LEVELS, nextLevel } from "./Levels.ts";
import { DIFFICULTIES, type Difficulty, isDifficulty } from "./Pace.ts";

export type Mode = "vs-cpu" | "vs-human";

/** Lo que se puede elegir antes de empezar. La consola lo dibuja sin saber nada de chase. */
export const CHASE_OPTIONS: readonly GameOption[] = [
  {
    id: "mode",
    label: "Modo",
    default: "vs-cpu",
    choices: [
      { value: "vs-cpu", label: "Contra la IA (Prolog)" },
      { value: "vs-human", label: "Humano contra humano" },
    ],
  },
  {
    id: "difficulty",
    label: "Nivel inicial (dificultad)",
    default: "facil",
    onlyWhen: { option: "mode", equals: "vs-cpu" },
    choices: LEVELS.map((level) => ({
      value: level,
      label: `${levelInfo(level).number}. ${DIFFICULTIES[level].label} · la IA mueve cada ${DIFFICULTIES[level].cpuIntervalMs / 1000} s`,
    })),
  },
];

export interface ChaseConfig {
  readonly mode: Mode;
  /** Solo cuenta contra la IA: es la velocidad de la IA y, a la vez, el nivel. */
  readonly difficulty: Difficulty;
}

/** Ajustes ya validados; lo que falte o no sea válido toma el valor inicial. */
export function parseChaseSettings(settings: GameSettings): ChaseConfig {
  return {
    mode: settings.mode === "vs-human" ? "vs-human" : "vs-cpu",
    difficulty: isDifficulty(settings.difficulty) ? settings.difficulty : "facil",
  };
}

/**
 * Qué se ofrece al terminar una partida. Contra la IA cada nivel es una partida nueva:
 * si ganas, lo recomendado es el siguiente nivel; si pierdes, reintentar (y el siguiente
 * también está disponible). Humano contra humano ofrece una revancha con otro mapa.
 */
export function chaseFollowUps(result: MatchResult, settings: GameSettings, playerId: string): readonly FollowUp[] {
  if (result.abandoned) return [];
  const config = parseChaseSettings(settings);

  if (config.mode === "vs-human") {
    return [{ label: "Revancha (mapa nuevo)", primary: true, settings }];
  }

  const won = result.winnerId === playerId;
  const next = nextLevel(config.difficulty);
  const nextLabel = levelInfo(config.difficulty).isLast ? "Volver al nivel 1" : `Siguiente nivel (${levelInfo(next).label})`;
  const goNext: FollowUp = { label: nextLabel, primary: won, settings: { ...settings, difficulty: next } };
  const retry: FollowUp = { label: "Reintentar este nivel", primary: !won, settings };
  return won ? [goNext, retry] : [retry, goNext];
}

/** El playerId de la segunda persona: nunca el mismo del primero ni el de la IA. */
export function secondPlayerId(first: string): string {
  const base: string = "jugador-2";
  return base === first ? `${base}_2` : base;
}
