import type { Board } from "./Board.ts";
import { isDirection } from "./Direction.ts";
import type { Position } from "./Position.ts";
import type { Route, RouteFinder, RouteStep } from "./RouteFinder.ts";

/** El servicio respondió, pero con algo que no se puede usar. Reintentar no lo arregla. */
export class RouteServiceError extends Error {}

export interface PrologRouteFinderOptions {
  /** Prefijo del proxy, normalmente API.prolog ("/api/prolog"). */
  baseUrl: string;
  fetchFn?: typeof fetch;
  retryDelayMs?: number;
  requestTimeoutMs?: number;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  /** Se llama en cada intento fallido, para avisar en pantalla. */
  onUnavailable?: (attempt: number) => void;
  /** Se llama cuando vuelve a responder después de haber fallado. */
  onRecovered?: () => void;
}

function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

/**
 * Pide las rutas al servicio Prolog (POST /route).
 *
 * Si el servicio no responde, REINTENTA (avisando con onUnavailable) hasta que
 * conteste o se cancele con la señal. Nunca devuelve una ruta inventada ni un
 * movimiento al azar: la CPU decide con Prolog o espera.
 */
export class PrologRouteFinder implements RouteFinder {
  private readonly opts: PrologRouteFinderOptions;

  constructor(opts: PrologRouteFinderOptions) {
    this.opts = opts;
  }

  async findRoute(board: Board, from: Position, signal?: AbortSignal): Promise<Route> {
    const { baseUrl, fetchFn = fetch, retryDelayMs = 1500, requestTimeoutMs = 5000, sleep = defaultSleep } = this.opts;
    const body = JSON.stringify({
      rows: board.rows,
      cols: board.cols,
      obstacles: board.obstacleList(),
      from,
      goal: board.exit,
    });

    for (let attempt = 1; ; attempt++) {
      signal?.throwIfAborted();
      const timeout = AbortSignal.timeout(requestTimeoutMs);
      try {
        const res = await fetchFn(`${baseUrl}/route`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        });
        if (res.status === 400) {
          throw new RouteServiceError(`Prolog rechazó la petición: ${await res.text()}`);
        }
        if (!res.ok) throw new Error(`Prolog respondió ${res.status}`); // 502 del proxy, 500...
        const route = parseRoute(await res.json());
        if (attempt > 1) this.opts.onRecovered?.();
        return route;
      } catch (error) {
        if (signal?.aborted || error instanceof RouteServiceError) throw error;
        this.opts.onUnavailable?.(attempt); // sin red, timeout, 5xx
        await sleep(retryDelayMs, signal);
      }
    }
  }
}

function parseRoute(data: unknown): Route {
  if (typeof data !== "object" || data === null) throw new RouteServiceError("respuesta de Prolog vacía");
  const d = data as Record<string, unknown>;
  if (typeof d.found !== "boolean") throw new RouteServiceError("la respuesta de Prolog no trae 'found'");
  if (!d.found) return { found: false, steps: 0, turns: 0, path: [] };
  if (typeof d.steps !== "number" || typeof d.turns !== "number" || !Array.isArray(d.path)) {
    throw new RouteServiceError("la respuesta de Prolog no trae steps, turns y path");
  }
  const path: RouteStep[] = d.path.map((s: unknown) => {
    const step = s as Record<string, unknown>;
    if (typeof step?.row !== "number" || typeof step.col !== "number" || !isDirection(step.direction)) {
      throw new RouteServiceError("un paso de la ruta de Prolog es inválido");
    }
    return { row: step.row, col: step.col, direction: step.direction };
  });
  return { found: true, steps: d.steps, turns: d.turns, path };
}
