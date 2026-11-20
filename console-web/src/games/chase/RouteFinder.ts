import type { Board } from "./Board.ts";
import type { Direction } from "./Direction.ts";
import type { Position } from "./Position.ts";

export interface RouteStep {
  readonly row: number;
  readonly col: number;
  readonly direction: Direction;
}

/** Ruta más corta (contextos/05-prolog.md). `path` no incluye la celda de origen. */
export interface Route {
  readonly found: boolean;
  readonly steps: number;
  readonly turns: number;
  readonly path: readonly RouteStep[];
}

/**
 * Quien sabe encontrar rutas. El juego depende de esta abstracción; la
 * implementación real le pregunta al servicio Prolog (PrologRouteFinder).
 */
export interface RouteFinder {
  findRoute(board: Board, from: Position, signal?: AbortSignal): Promise<Route>;
}
