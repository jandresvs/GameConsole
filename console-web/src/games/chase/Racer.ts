import type { Board } from "./Board.ts";
import type { Direction } from "./Direction.ts";
import { Position } from "./Position.ts";
import type { RouteFinder } from "./RouteFinder.ts";

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

/** El usuario: se mueve con lo que pulsa en el teclado o en los botones. */
export class HumanRacer extends Racer {
  get kind(): RacerKind {
    return "human";
  }
}

/** La CPU: su siguiente paso lo decide Prolog, siempre. */
export class CpuRacer extends Racer {
  get kind(): RacerKind {
    return "cpu";
  }

  /** Pregunta la ruta desde su celda actual y devuelve el primer paso; null si no hay ruta. */
  async chooseMove(board: Board, finder: RouteFinder, signal?: AbortSignal): Promise<Direction | null> {
    const route = await finder.findRoute(board, this.position, signal);
    return route.found && route.path.length > 0 ? route.path[0]!.direction : null;
  }
}
