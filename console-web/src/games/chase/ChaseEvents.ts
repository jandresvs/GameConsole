import { GAME_VERSION } from "../../config.ts";
import type { EventSender } from "../../events/types.ts";
import { newId } from "../../events/ids.ts";
import type { Board } from "./Board.ts";
import type { Direction } from "./Direction.ts";
import type { Difficulty } from "./Pace.ts";
import type { Position } from "./Position.ts";
import type { Route } from "./RouteFinder.ts";

export interface MatchInfo {
  board: Board;
  lives: number;
  mode: "vs-cpu" | "vs-human";
  humanCooldownMs: number;
  /** Solo en partidas contra la IA. */
  difficulty?: Difficulty;
  cpuIntervalMs?: number;
}

/**
 * Traduce lo que pasa en una partida de chase a eventos de GameStats
 * (contextos/04-eventos.md). Cada instancia lleva su matchId, así los eventos
 * de partidas simultáneas nunca se mezclan.
 */
export class ChaseEvents {
  private readonly sender: EventSender;
  private readonly matchId: string;

  constructor(sender: EventSender, matchId: string) {
    this.sender = sender;
    this.matchId = matchId;
  }

  matchStarted(info: MatchInfo): void {
    const { board } = info;
    this.emit("MATCH_STARTED", undefined, {
      rows: board.rows,
      cols: board.cols,
      obstaclePct: board.obstaclePct,
      lives: info.lives,
      mode: info.mode,
      exit: board.exit.toJSON(),
      humanCooldownMs: info.humanCooldownMs,
      ...(info.difficulty === undefined ? {} : { difficulty: info.difficulty, cpuIntervalMs: info.cpuIntervalMs }),
    });
  }

  playerJoined(playerId: string): void {
    this.emit("PLAYER_JOINED", playerId);
  }

  routeComputed(playerId: string, start: Position, goal: Position, route: Route): void {
    this.emit("ROUTE_COMPUTED", playerId, {
      found: route.found,
      start: start.toJSON(),
      goal: goal.toJSON(),
      ...(route.found ? { optimalSteps: route.steps, routeTurns: route.turns } : {}),
    });
  }

  moved(playerId: string, arrivedAt: Position, direction: Direction, turn: boolean): void {
    this.emit("PLAYER_MOVED", playerId, { row: arrivedAt.row, col: arrivedAt.col, direction, turn });
  }

  obstacleHit(playerId: string, obstacle: Position, livesLeft: number): void {
    this.emit("OBSTACLE_HIT", playerId, { row: obstacle.row, col: obstacle.col, livesLeft });
  }

  targetReached(playerId: string, steps: number, turns: number): void {
    this.emit("TARGET_REACHED", playerId, { steps, turns });
  }

  /** Siempre el último evento de la partida: GameStats descarta lo que llegue después. */
  matchFinished(winnerId?: string): void {
    this.emit("MATCH_FINISHED", undefined, winnerId === undefined ? undefined : { winnerId });
  }

  private emit(type: string, playerId?: string, data?: Record<string, unknown>): void {
    this.sender.send({
      eventId: newId(),
      timestamp: new Date().toISOString(),
      gameId: "chase",
      gameVersion: GAME_VERSION,
      matchId: this.matchId,
      type,
      ...(playerId === undefined ? {} : { playerId }),
      ...(data === undefined ? {} : { data }),
    });
  }
}
