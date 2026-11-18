import type { EventData } from "../../events/GameEvent.ts";
import type { Direction } from "./Direction.ts";
import type { Position } from "./Position.ts";
import type { Route } from "./RouteFinder.ts";

/** Emite un evento del juego; ChaseGame le pasa su this.emit (clase base Game). */
export type EmitFn = (type: string, data?: EventData, playerId?: string) => void;

/**
 * Traduce lo que pasa en una partida de chase a eventos de GameStats
 * (contextos/04-eventos.md).
 *
 * MATCH_STARTED, PLAYER_JOINED y MATCH_FINISHED los emite la clase base Game
 * (games/core/Game.ts), igual que en racing y combat. Aquí solo van los propios
 * de chase, y el aviso de que la partida terminó, que ChaseGame convierte en finish().
 */
export class ChaseEvents {
  constructor(
    private readonly emit: EmitFn,
    private readonly onFinished: (winnerId: string | undefined) => void,
  ) {}

  routeComputed(playerId: string, start: Position, goal: Position, route: Route): void {
    this.emit(
      "ROUTE_COMPUTED",
      {
        found: route.found,
        start: start.toJSON(),
        goal: goal.toJSON(),
        ...(route.found ? { optimalSteps: route.steps, routeTurns: route.turns } : {}),
      },
      playerId,
    );
  }

  moved(playerId: string, arrivedAt: Position, direction: Direction, turn: boolean): void {
    this.emit("PLAYER_MOVED", { row: arrivedAt.row, col: arrivedAt.col, direction, turn }, playerId);
  }

  obstacleHit(playerId: string, obstacle: Position, livesLeft: number): void {
    this.emit("OBSTACLE_HIT", { row: obstacle.row, col: obstacle.col, livesLeft }, playerId);
  }

  targetReached(playerId: string, steps: number, turns: number): void {
    this.emit("TARGET_REACHED", { steps, turns }, playerId);
  }

  /** La partida terminó. Sin winnerId = nadie alcanzó a La Mala. */
  matchFinished(winnerId?: string): void {
    this.onFinished(winnerId);
  }
}
