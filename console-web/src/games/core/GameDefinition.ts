import type { Game, GameContext, MatchResult } from "./Game";

/** Los ajustes elegidos para una partida: id de opción → valor elegido. */
export type GameSettings = Readonly<Record<string, string>>;

/**
 * Una opción que el juego deja elegir antes de empezar (modo, dificultad...).
 * La consola las dibuja como listas desplegables en la tarjeta del juego, sin
 * conocer ningún juego en particular.
 */
export interface GameOption {
  readonly id: string;
  readonly label: string;
  readonly choices: readonly { readonly value: string; readonly label: string }[];
  /** Valor inicial: debe ser uno de `choices`. */
  readonly default: string;
  /** Si está, la opción solo se muestra (y solo cuenta) cuando otra tiene ese valor. */
  readonly onlyWhen?: { readonly option: string; readonly equals: string };
}

/** Qué puede hacer el usuario al terminar una partida: abrir otra con estos ajustes (siguiente nivel, revancha...). */
export interface FollowUp {
  readonly label: string;
  /** El botón principal (el que se recomienda) se dibuja resaltado. */
  readonly primary: boolean;
  readonly settings: GameSettings;
}

/**
 * Lo que la consola necesita saber de un juego para ofrecerlo en el menú y
 * crear partidas. Cada juego exporta la suya y se registra en GameCatalog.
 */
export interface GameDefinition {
  /** gameId del contrato de GameStats: en minúsculas; Scala elige el analizador con él. */
  readonly id: string;
  readonly title: string;
  readonly description: string;
  /** Cómo se juega, en una línea. Se muestra debajo de cada partida. */
  readonly controls?: string;
  /** true = sus eventos solo se muestran en pantalla, no se envían a GameStats (para el juego de ejemplo). */
  readonly localOnly?: boolean;
  /** Lo que se puede elegir antes de empezar. Si falta, el juego no tiene ajustes. */
  readonly options?: readonly GameOption[];
  /** Crea una partida nueva. Si falta, el juego aparece como "en desarrollo". `settings` ya viene completo y validado. */
  readonly create?: (context: GameContext, settings: GameSettings) => Game;
  /**
   * Qué ofrecer cuando una partida termina sin haberse abandonado. Cada acción abre
   * una partida NUEVA (otro matchId) en el mismo recuadro. Si falta, solo se puede cerrar.
   */
  readonly afterMatch?: (end: {
    readonly result: MatchResult;
    readonly settings: GameSettings;
    readonly playerId: string;
  }) => readonly FollowUp[];
}
