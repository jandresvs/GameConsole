import type { Game, GameContext } from "./Game";

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
  /** Crea una partida nueva. Si falta, el juego aparece como "en desarrollo". */
  readonly create?: (context: GameContext) => Game;
}
