import { Board } from "./Board.ts";
import type { Route, RouteFinder } from "./RouteFinder.ts";

export interface MapSpec {
  rows: number;
  cols: number;
  obstaclePct: number;
  /** El mapa debe exigir al menos estos pasos hasta la salida (evita mapas triviales). */
  minSteps: number;
}

export interface BuiltMap {
  board: Board;
  /** Ruta óptima desde el inicio, calculada por Prolog. */
  route: Route;
}

/**
 * Genera mapas hasta conseguir uno jugable. Quien decide si hay camino hasta la
 * salida es Prolog (la misma búsqueda que usa la IA), no una copia del algoritmo aquí.
 */
export class MapBuilder {
  private readonly finder: RouteFinder;
  private readonly random: () => number;
  private readonly maxAttempts: number;

  constructor(finder: RouteFinder, random: () => number = Math.random, maxAttempts = 30) {
    this.finder = finder;
    this.random = random;
    this.maxAttempts = maxAttempts;
  }

  async build(spec: MapSpec, signal?: AbortSignal): Promise<BuiltMap> {
    let best: BuiltMap | null = null;
    for (let attempt = 0; attempt < this.maxAttempts; attempt++) {
      signal?.throwIfAborted();
      const board = Board.generate(spec.rows, spec.cols, spec.obstaclePct, this.random, spec.minSteps);
      const route = await this.finder.findRoute(board, board.start, signal);
      if (!route.found) continue;
      if (route.steps >= spec.minSteps) return { board, route };
      if (best === null || route.steps > best.route.steps) best = { board, route };
    }
    if (best) return best; // ninguno llegó al mínimo: el más largo que sí tenía ruta
    throw new Error("No se pudo generar un mapa con ruta hasta la salida");
  }
}
