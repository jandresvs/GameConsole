import type { Board } from "./Board.ts";
import type { Direction } from "./Direction.ts";
import { Position } from "./Position.ts";
import type { Route, RouteFinder } from "./RouteFinder.ts";

export type RacerKind = "human" | "cpu";

/**
 * Quien corre hacia La Mala. Guarda su propia posición, vidas y recorrido; el
 * resto del juego lo consulta y le pide moverse, no toca sus campos.
 */
export abstract class Racer {
  readonly id: string;
  private current: Position;
  private livesLeft: number;
  private stepCount = 0;
  private turnCount = 0;
  private lastDirection: Direction | null = null;

  constructor(id: string, start: Position, lives: number) {
    this.id = id;
    this.current = start;
    this.livesLeft = lives;
  }

  abstract get kind(): RacerKind;

  get position(): Position {
    return this.current;
  }
  get lives(): number {
    return this.livesLeft;
  }
  /** Celdas recorridas con éxito (los choques no cuentan). */
  get steps(): number {
    return this.stepCount;
  }
  /** Veces que cambió de dirección entre un paso y el siguiente. */
  get turns(): number {
    return this.turnCount;
  }

  /** Avanza una celda. El primer paso nunca es un giro. */
  advance(direction: Direction): { position: Position; turn: boolean } {
    const turn = this.lastDirection !== null && this.lastDirection !== direction;
    this.current = this.current.step(direction);
    this.lastDirection = direction;
    this.stepCount += 1;
    if (turn) this.turnCount += 1;
    return { position: this.current, turn };
  }

  /** Pierde una vida (nunca baja de 0) y devuelve las que le quedan. */
  loseLife(): number {
    if (this.livesLeft > 0) this.livesLeft -= 1;
    return this.livesLeft;
  }
}

<<<<<<< Updated upstream
/** El usuario: se mueve con lo que pulsa en el teclado o en los botones. */
export class HumanRacer extends Racer {
  get kind(): RacerKind {
    return "human";
  }
}

/** La CPU: su siguiente paso lo decide Prolog, siempre. */
export class CpuRacer extends Racer {
=======
/**
 * Una persona. No puede moverse más de una vez cada `cooldownMs`: lo que pulse
 * antes se ignora (no se acumula). El tiempo es el de la partida (suma de dtMs).
 */
export class HumanRacer extends Racer {
  readonly cooldownMs: number;
  private cooldownLeftMs = 0;

  constructor(id: string, start: Position, lives: number, cooldownMs = HUMAN_COOLDOWN_MS) {
    super(id, start, lives);
    this.cooldownMs = cooldownMs;
  }

  get kind(): RacerKind {
    return "human";
  }

  get isReady(): boolean {
    return this.cooldownLeftMs <= 0;
  }

  /** 0 = acaba de moverse, 1 = lista para moverse. */
  get readiness(): number {
    return 1 - Math.min(1, Math.max(0, this.cooldownLeftMs / this.cooldownMs));
  }

  /** Empieza la espera: se llama cada vez que gasta su movimiento. */
  startCooldown(): void {
    this.cooldownLeftMs = this.cooldownMs;
  }

  tick(dtMs: number): void {
    this.cooldownLeftMs = Math.max(0, this.cooldownLeftMs - dtMs);
  }
}

/**
 * La IA: mueve sola cada `intervalMs` y su siguiente paso lo decide Prolog, siempre.
 * Mientras espera su turno ya le va preguntando a Prolog (en segundo plano), así
 * que al cumplirse el intervalo la decisión está lista y el ritmo no depende de la red.
 */
export class CpuRacer extends Racer {
  readonly intervalMs: number;
  private waitedMs = 0;
  private planned: Direction | null = null;
  private asking = false;
  private holdoffMs = 0;
  private failure: Error | null = null;

  constructor(id: string, start: Position, lives: number, intervalMs: number) {
    super(id, start, lives);
    this.intervalMs = intervalMs;
  }

>>>>>>> Stashed changes
  get kind(): RacerKind {
    return "cpu";
  }

  private planned: readonly Position[] = [];

  /** Lo que falta de la última ruta que dio Prolog (sin la celda actual). Solo para dibujarla. */
  get route(): readonly Position[] {
    return this.planned;
  }

  /** Guarda la ruta que devolvió Prolog desde la celda actual. */
  plan(route: Route): void {
    this.planned = route.found ? route.path.map((s) => new Position(s.row, s.col)) : [];
  }

  /** Pregunta la ruta desde su celda actual y devuelve el primer paso; null si no hay ruta. */
  async chooseMove(board: Board, finder: RouteFinder, signal?: AbortSignal): Promise<Direction | null> {
    const route = await finder.findRoute(board, this.position, signal);
    this.plan(route);
    return route.found && route.path.length > 0 ? route.path[0]!.direction : null;
  }

<<<<<<< Updated upstream
  /** Al avanzar, la celda a la que llegó deja de ser parte de lo que falta. */
  override advance(direction: Direction): { position: Position; turn: boolean } {
    const result = super.advance(direction);
    const [next, ...rest] = this.planned;
    this.planned = next?.equals(result.position) ? rest : [];
    return result;
=======
  /**
   * Avanza el reloj de la IA `dtMs`. Devuelve la dirección en la que debe moverse ahora,
   * o null si todavía no le toca. Si Prolog falló de forma irrecuperable, lanza ese error.
   */
  think(dtMs: number, decide: () => Promise<Direction | null>): Direction | null {
    if (this.failure) {
      const failure = this.failure;
      this.failure = null;
      throw failure;
    }
    this.waitedMs = Math.min(this.waitedMs + dtMs, this.intervalMs); // no acumula atraso: nunca se mueve "a ráfagas"
    this.holdoffMs = Math.max(0, this.holdoffMs - dtMs);

    if (this.planned === null && !this.asking && this.holdoffMs === 0) {
      this.asking = true;
      void decide()
        .then(
          (direction) => {
            this.planned = direction;
            if (direction === null) this.holdoffMs = this.intervalMs; // sin ruta: no insistir en cada cuadro
          },
          (error: unknown) => {
            this.failure = error instanceof Error ? error : new Error(String(error));
          },
        )
        .finally(() => {
          this.asking = false;
        });
    }

    if (this.planned !== null && this.waitedMs >= this.intervalMs) {
      const direction = this.planned;
      this.planned = null;
      this.waitedMs = 0;
      return direction;
    }
    return null;
>>>>>>> Stashed changes
  }
}
