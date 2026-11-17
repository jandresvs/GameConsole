import { GAME_VERSION } from "../../config";
import type { EventData, EventSink } from "../../events/GameEvent";
import { newId } from "../../events/ids";
import { MatchEvents } from "../../events/MatchEvents";
import { Keyboard } from "./Keyboard";

/** Lo que la consola le entrega a cada partida al crearla. */
export interface GameContext {
  /** El jugador humano de esta consola. */
  readonly playerId: string;
  /** A dónde van los eventos. El juego no sabe cómo se envían. */
  readonly events: EventSink;
}

export interface GameSize {
  readonly width: number;
  readonly height: number;
}

export type GameState = "ready" | "running" | "finished";

export interface MatchResult {
  readonly matchId: string;
  readonly winnerId?: string;
  /** true si la partida se cerró antes de terminar. */
  readonly abandoned: boolean;
}

/** Los eventos de ciclo de vida los emite la clase base; un juego no puede emitirlos a mano. */
const RESERVED_TYPES = new Set(["MATCH_STARTED", "PLAYER_JOINED", "MATCH_FINISHED"]);

/** Tope de tiempo por cuadro. Si la pestaña estuvo oculta, el juego no "salta" hacia adelante. */
const MAX_STEP_MS = 100;

/**
 * Una partida de un juego. Cada objeto Game es UNA instancia: tiene su propio
 * estado, su propio matchId, su propio lienzo y su propio teclado, así que
 * varias partidas pueden correr a la vez sin mezclarse.
 *
 * La clase base se encarga de lo que es igual en todos los juegos:
 *  - el ciclo de vida (ready → running → finished) y el bucle de juego;
 *  - los eventos MATCH_STARTED, PLAYER_JOINED y MATCH_FINISHED, en el orden
 *    que exige GameStats y una sola vez;
 *  - que no salga ningún evento después de terminar.
 *
 * Cada juego implementa solo sus reglas: players(), onStart(), update() y render().
 * Guía completa: contextos/07-contrato-juegos.md.
 */
export abstract class Game {
  readonly matchId: string;

  protected readonly playerId: string;
  protected readonly canvas: HTMLCanvasElement;
  protected readonly keyboard: Keyboard;

  private readonly events: MatchEvents;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly finishListeners: Array<(result: MatchResult) => void> = [];
  private currentState: GameState = "ready";
  private frameId = 0;
  private lastFrameMs = 0;
  private clockMs = 0;

  protected constructor(
    readonly gameId: string,
    context: GameContext,
    size: GameSize,
  ) {
    this.matchId = `${gameId}-${newId()}`;
    this.playerId = context.playerId;
    this.events = new MatchEvents(gameId, this.matchId, GAME_VERSION, context.events);

    this.canvas = document.createElement("canvas");
    this.canvas.width = size.width;
    this.canvas.height = size.height;
    this.canvas.tabIndex = 0; // para que pueda recibir el foco y, con él, el teclado
    this.canvas.className = "game-canvas";

    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("El navegador no permite dibujar en un canvas 2D");
    this.ctx = ctx;

    this.keyboard = new Keyboard(this.canvas, (code) => {
      if (this.currentState === "running") this.onKeyDown(code);
    });
  }

  // ───────────── Lo que usa la consola ─────────────

  /** El elemento que la consola coloca en la página. */
  get element(): HTMLCanvasElement {
    return this.canvas;
  }

  get state(): GameState {
    return this.currentState;
  }

  /** Empieza la partida. Solo tiene efecto la primera vez. */
  start(): void {
    if (this.currentState !== "ready") return;
    this.currentState = "running";

    this.events.add("MATCH_STARTED", this.matchStartData());
    for (const player of this.players()) this.events.add("PLAYER_JOINED", undefined, player);

    this.onStart();
    this.render(this.ctx);
    this.lastFrameMs = performance.now();
    this.frameId = requestAnimationFrame(this.frame);
  }

  /** Cierra una partida en curso sin ganador (el usuario la cerró o cerró la pestaña). */
  abandon(): void {
    this.end(undefined, true);
  }

  /** Libera la partida. Si seguía en curso, la abandona primero. */
  dispose(): void {
    this.abandon();
    this.keyboard.dispose();
  }

  /** La consola se entera aquí de que la partida terminó. */
  onFinish(listener: (result: MatchResult) => void): void {
    this.finishListeners.push(listener);
  }

  // ───────────── Lo que implementa cada juego ─────────────

  /** Los playerId que participan (el humano, los bots, la CPU). Se emite un PLAYER_JOINED por cada uno. */
  protected abstract players(): readonly string[];

  /** Prepara el estado inicial. MATCH_STARTED y PLAYER_JOINED ya se emitieron. */
  protected abstract onStart(): void;

  /** Avanza la partida. dtMs es el tiempo de juego desde el cuadro anterior. */
  protected abstract update(dtMs: number): void;

  /** Dibuja el estado actual. No debe cambiar el estado ni emitir eventos. */
  protected abstract render(ctx: CanvasRenderingContext2D): void;

  /** Datos de MATCH_STARTED propios del juego (por ejemplo track y laps). */
  protected matchStartData(): EventData | undefined {
    return undefined;
  }

  /** Una tecla se acaba de pulsar. Para acciones puntuales; para movimiento continuo, keyboard.isDown(). */
  protected onKeyDown(_code: string): void {}

  // ───────────── Herramientas para cada juego ─────────────

  /** Emite un evento del juego. Sin playerId = evento de la partida. Se ignora si la partida no está en curso. */
  protected emit(type: string, data?: EventData, playerId?: string): void {
    if (RESERVED_TYPES.has(type)) {
      throw new Error(`${type} lo emite la clase base Game; el juego no debe emitirlo`);
    }
    if (this.currentState !== "running") return;
    this.events.add(type, data, playerId);
  }

  /** Termina la partida y emite MATCH_FINISHED. Sin winnerId = nadie ganó. */
  protected finish(winnerId?: string): void {
    this.end(winnerId, false);
  }

  /** ¿Sigue en curso? Revisarlo después de cada await antes de tocar el estado. */
  protected get isRunning(): boolean {
    return this.currentState === "running";
  }

  /** Reloj de la partida en milisegundos. Se detiene si la pestaña está oculta; usarlo en vez de Date.now(). */
  protected get elapsedMs(): number {
    return this.clockMs;
  }

  protected get width(): number {
    return this.canvas.width;
  }

  protected get height(): number {
    return this.canvas.height;
  }

  // ───────────── Interno ─────────────

  private readonly frame = (nowMs: number): void => {
    if (this.currentState !== "running") return;

    const dtMs = Math.min(Math.max(nowMs - this.lastFrameMs, 0), MAX_STEP_MS);
    this.lastFrameMs = nowMs;
    this.clockMs += dtMs;

    this.update(dtMs);
    this.render(this.ctx);

    if (this.state === "running") this.frameId = requestAnimationFrame(this.frame);
  };

  private end(winnerId: string | undefined, abandoned: boolean): void {
    if (this.currentState !== "running") return;

    if (abandoned) this.events.add("PLAYER_LEFT", undefined, this.playerId);
    this.currentState = "finished";
    cancelAnimationFrame(this.frameId);
    this.events.finish(winnerId);
    this.render(this.ctx); // deja dibujado el estado final

    const result: MatchResult = { matchId: this.matchId, abandoned, ...(winnerId !== undefined && { winnerId }) };
    for (const listener of this.finishListeners) listener(result);
  }
}
