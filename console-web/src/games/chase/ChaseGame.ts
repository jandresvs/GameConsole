import { API } from "../../config.ts";
import { el } from "../../console/dom.ts";
import type { EventSender } from "../../events/types.ts";
import { Game } from "../Game.ts";
import { Board } from "./Board.ts";
import { ChaseMatch, type Outcome } from "./ChaseMatch.ts";
import { ChaseRenderer } from "./ChaseRenderer.ts";
import type { Direction } from "./Direction.ts";
import { PrologRouteFinder } from "./PrologRouteFinder.ts";
import { CpuRacer, HumanRacer } from "./Racer.ts";

export interface ChaseGameOptions {
  /** playerId del usuario en los eventos. La CPU siempre es "cpu". */
  playerId: string;
  sender: EventSender;
  rows?: number;
  cols?: number;
  obstaclePct?: number;
  lives?: number;
}

const KEYS: Readonly<Record<string, Direction>> = {
  ArrowUp: "arriba",
  ArrowDown: "abajo",
  ArrowLeft: "izquierda",
  ArrowRight: "derecha",
  w: "arriba",
  s: "abajo",
  a: "izquierda",
  d: "derecha",
};

/**
 * Chase en pantalla: La Buena (tú, "B") y una segunda Buena controlada por Prolog
 * ("C") corren hacia La Mala ("M"). Esta clase solo conecta la partida
 * (ChaseMatch) con el DOM: dibuja, lee el teclado y muestra mensajes.
 */
export class ChaseGame extends Game {
  private readonly match: ChaseMatch;
  private readonly playerId: string;
  private readonly startLives: number;
  private notice: string | null = null;
  private renderer: ChaseRenderer | null = null;
  private unsubscribe: (() => void) | null = null;

  private readonly root = el("section", "chase");
  private readonly canvas = el("canvas", "chase-board");
  private readonly hud = el("p", "chase-hud");
  private readonly status = el("p", "chase-status");
  private readonly pad = el("div", "chase-pad");

  constructor(opts: ChaseGameOptions) {
    super("chase");
    this.playerId = opts.playerId;
    const { board, userStart, cpuStart } = Board.generate(opts.rows ?? 8, opts.cols ?? 12, opts.obstaclePct ?? 20);
    const lives = opts.lives ?? 3;
    this.startLives = lives;

    const finder = new PrologRouteFinder({
      baseUrl: API.prolog,
      onUnavailable: (attempt) => this.setNotice(`Prolog no responde (intento ${attempt}). Reintentando…`),
      onRecovered: () => this.setNotice(null),
    });
    this.match = new ChaseMatch({
      board,
      user: new HumanRacer(opts.playerId, userStart, lives),
      cpu: new CpuRacer("cpu", cpuStart, lives),
      finder,
      sender: opts.sender,
    });
  }

  get matchId(): string {
    return this.match.matchId;
  }

  mount(container: HTMLElement): void {
    this.canvas.tabIndex = 0;
    this.canvas.setAttribute("aria-label", "Tablero de Chase");
    this.renderer = new ChaseRenderer(this.canvas, this.match.board.rows, this.match.board.cols);

    for (const [label, direction] of [
      ["↑", "arriba"],
      ["←", "izquierda"],
      ["↓", "abajo"],
      ["→", "derecha"],
    ] as const) {
      const button = el("button", "secondary", label);
      button.setAttribute("aria-label", direction);
      button.addEventListener("click", () => this.move(direction));
      this.pad.append(button);
    }

    this.root.addEventListener("keydown", (event) => {
      const direction = KEYS[event.key] ?? KEYS[event.key.toLowerCase()];
      if (!direction) return;
      event.preventDefault();
      this.move(direction);
    });

    this.root.append(this.hud, this.canvas, this.status, this.pad);
    container.append(this.root);

    this.unsubscribe = this.match.subscribe(() => this.refresh());
    this.refresh();
    this.canvas.focus({ preventScroll: true });
    void this.match.begin().catch((error: unknown) => this.setNotice(`Error: ${String(error)}`));
  }

  dispose(): void {
    this.match.abandon(); // si ya había terminado, no hace nada
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.root.remove();
  }

  private move(direction: Direction): void {
    void this.match.userMove(direction).catch((error: unknown) => this.setNotice(`Error: ${String(error)}`));
  }

  private setNotice(text: string | null): void {
    this.notice = text;
    this.refresh();
  }

  private refresh(): void {
    const { match } = this;
    this.renderer?.draw(match);

    const hearts = "♥".repeat(match.user.lives) + "♡".repeat(Math.max(0, this.startLives - match.user.lives));
    this.hud.textContent = `${this.playerId} · vidas ${hearts} · pasos ${match.user.steps} · CPU pasos ${match.cpu.steps}`;

    const canMove = match.phase === "playing";
    for (const button of this.pad.querySelectorAll("button")) button.disabled = !canMove;

    const text = this.statusText();
    this.status.textContent = this.notice ? `${text} — ${this.notice}` : text;
    this.status.className = `chase-status ${match.outcome ? outcomeClass(match.outcome, this.playerId) : ""}`;
  }

  private statusText(): string {
    const { match } = this;
    switch (match.phase) {
      case "preparing":
        return "Calculando rutas con Prolog…";
      case "playing":
        return "Tu turno: flechas o WASD";
      case "cpu-turn":
        return "Turno de la CPU…";
      case "finished":
        return outcomeText(match.outcome, this.playerId);
    }
  }
}

function outcomeClass(outcome: Outcome, playerId: string): string {
  return outcome.kind === "won" && outcome.winnerId === playerId ? "won" : "lost";
}

function outcomeText(outcome: Outcome | null, playerId: string): string {
  switch (outcome?.kind) {
    case "won":
      return outcome.winnerId === playerId ? "¡Alcanzaste a La Mala! Ganaste." : "La CPU alcanzó primero a La Mala. Perdiste.";
    case "out-of-lives":
      return "Sin vidas. Nadie alcanzó a La Mala.";
    case "no-route":
      return "Este tablero no tiene ruta hasta La Mala. Empieza otra partida.";
    case "abandoned":
    default:
      return "Partida cerrada.";
  }
}
