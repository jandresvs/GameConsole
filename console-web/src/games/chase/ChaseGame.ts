import { API } from "../../config.ts";
import { el } from "../../console/dom.ts";
import type { EventSender } from "../../events/types.ts";
import { newId } from "../../events/ids.ts";
import { Game } from "../Game.ts";
import type { BuiltMap } from "./MapBuilder.ts";
import { MapBuilder } from "./MapBuilder.ts";
import { ChaseMatch, type Outcome } from "./ChaseMatch.ts";
import { ChaseRenderer, racerStyle } from "./ChaseRenderer.ts";
import { type ChaseSettings, DEFAULT_SETTINGS } from "./ChaseSettingsForm.ts";
import type { Clock } from "./Clock.ts";
import type { Direction } from "./Direction.ts";
import { DIFFICULTIES, HUMAN_COOLDOWN_MS } from "./Pace.ts";
import { PrologRouteFinder } from "./PrologRouteFinder.ts";
import { CpuRacer, HumanRacer, type Racer } from "./Racer.ts";

export interface ChaseGameOptions {
  /** playerId de la primera persona. La IA siempre es "cpu". */
  playerId: string;
  sender: EventSender;
  settings?: ChaseSettings;
  clock?: Clock;
}

/** Tamaño y exigencia del mapa. */
const MAP = { rows: 10, cols: 14, obstaclePct: 22, minSteps: 12 } as const;
const LIVES = 3;

type Binding = { player: number; direction: Direction };

const ARROWS: Readonly<Record<string, Direction>> = {
  ArrowUp: "arriba",
  ArrowDown: "abajo",
  ArrowLeft: "izquierda",
  ArrowRight: "derecha",
};
const WASD: Readonly<Record<string, Direction>> = { w: "arriba", s: "abajo", a: "izquierda", d: "derecha" };

/**
 * Chase en pantalla. Es una carrera en tiempo real hacia la salida (S, en un borde),
 * contra la IA (Prolog) o contra otra persona en el mismo teclado. Esta clase solo
 * conecta la partida (ChaseMatch) con el DOM: dibuja, lee el teclado y muestra mensajes.
 */
export class ChaseGame extends Game {
  private readonly id: string;
  private readonly settings: ChaseSettings;
  private readonly playerId: string;
  private readonly sender: EventSender;
  private readonly clock: Clock | undefined;
  private readonly finder: PrologRouteFinder;
  private readonly setupAbort = new AbortController();

  private match: ChaseMatch | null = null;
  private renderer: ChaseRenderer | null = null;
  private bindings = new Map<string, Binding>();
  private notice: string | null = null;
  private disposed = false;
  private frame = 0;
  private unsubscribe: (() => void) | null = null;

  private readonly root = el("section", "chase");
  private readonly hud = el("div", "chase-hud");
  private readonly stage = el("div", "chase-stage");
  private readonly status = el("p", "chase-status", "Preparando el mapa con Prolog…");
  private readonly pads = el("div", "chase-pads");
  private readonly rows = new Map<string, { text: HTMLElement; bar: HTMLProgressElement | null }>();

  constructor(opts: ChaseGameOptions) {
    super("chase");
    this.id = `chase-${newId()}`;
    this.settings = opts.settings ?? DEFAULT_SETTINGS;
    this.playerId = opts.playerId;
    this.sender = opts.sender;
    this.clock = opts.clock;
    this.finder = new PrologRouteFinder({
      baseUrl: API.prolog,
      onUnavailable: (attempt) => this.setNotice(`Prolog no responde (intento ${attempt}). Reintentando…`),
      onRecovered: () => this.setNotice(null),
    });
  }

  get matchId(): string {
    return this.id;
  }

  mount(container: HTMLElement): void {
    this.root.tabIndex = 0;
    this.root.addEventListener("keydown", (event) => this.onKey(event));
    this.root.append(this.hud, this.stage, this.status, this.pads);
    container.append(this.root);
    void this.prepare();
  }

  dispose(): void {
    this.disposed = true;
    this.setupAbort.abort();
    this.match?.abandon(); // si ya había terminado, no hace nada
    cancelAnimationFrame(this.frame);
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.root.remove();
  }

  /** Genera el mapa (Prolog confirma que hay ruta) y, cuando está listo, arranca la partida. */
  private async prepare(): Promise<void> {
    try {
      const built = await new MapBuilder(this.finder).build(MAP, this.setupAbort.signal);
      if (!this.disposed) this.start(built);
    } catch (error) {
      if (!this.disposed) this.setNotice(`No se pudo preparar la partida: ${String(error)}`);
    }
  }

  private start({ board, route }: BuiltMap): void {
    const { mode, difficulty } = this.settings;
    const humans = [new HumanRacer(this.playerId, board.start, LIVES)];
    if (mode === "vs-human") humans.push(new HumanRacer(secondName(this.settings.player2, this.playerId), board.start, LIVES));
    const cpu =
      mode === "vs-cpu" ? new CpuRacer("cpu", board.start, LIVES, DIFFICULTIES[difficulty].cpuIntervalMs) : undefined;

    this.match = new ChaseMatch({
      board,
      route,
      humans,
      cpu,
      difficulty: cpu ? difficulty : undefined,
      finder: this.finder,
      sender: this.sender,
      clock: this.clock,
      matchId: this.id,
    });
    const match = this.match;

    const canvas = el("canvas", "chase-board");
    canvas.setAttribute("aria-label", "Mapa de Chase");
    this.stage.replaceChildren(canvas);
    this.renderer = new ChaseRenderer(canvas, board.rows, board.cols);

    this.buildHud(match);
    this.buildControls(match);
    this.unsubscribe = match.subscribe(() => this.refresh());
    this.root.focus({ preventScroll: true });
    this.frame = requestAnimationFrame(this.tick);
    void match.begin().catch((error: unknown) => this.setNotice(`Error: ${String(error)}`));
  }

  private buildHud(match: ChaseMatch): void {
    const rows: HTMLElement[] = [];
    for (const racer of match.racers) {
      const { color, label } = racerStyle(match, racer);
      const dot = el("span", "dot", label);
      dot.style.background = color;
      const text = el("span", "hud-text");
      const bar = racer.kind === "human" ? el("progress") : null;
      if (bar) {
        bar.max = 1;
        bar.value = 1;
        bar.title = "Recarga entre movimientos";
      }
      this.rows.set(racer.id, { text, bar });
      rows.push(el("div", "hud-row", dot, text, ...(bar ? [bar] : [])));
    }
    this.hud.replaceChildren(...rows);
  }

  private buildControls(match: ChaseMatch): void {
    const versus = match.mode === "vs-human";
    this.bindings = new Map();
    for (const [key, direction] of Object.entries(WASD)) this.bindings.set(key, { player: 0, direction });
    for (const [key, direction] of Object.entries(ARROWS)) this.bindings.set(key, { player: versus ? 1 : 0, direction });

    const hint = versus
      ? `${match.humans[0]!.id}: WASD · ${match.humans[1]!.id}: flechas`
      : "Flechas o WASD";
    const pads = match.humans.map((human) => this.pad(match, human.id));
    this.pads.replaceChildren(
      el("p", "muted small", `${hint} · un movimiento cada ${HUMAN_COOLDOWN_MS / 1000} s (las teclas antes de tiempo se ignoran)`),
      el("div", "pad-row", ...pads),
    );
  }

  private pad(match: ChaseMatch, playerId: string): HTMLElement {
    const pad = el("div", "chase-pad");
    for (const [label, direction] of [
      ["↑", "arriba"],
      ["←", "izquierda"],
      ["↓", "abajo"],
      ["→", "derecha"],
    ] as const) {
      const button = el("button", "secondary", label);
      button.setAttribute("aria-label", `${playerId}: ${direction}`);
      button.addEventListener("click", () => match.moveHuman(playerId, direction));
      pad.append(button);
    }
    return pad;
  }

  private onKey(event: KeyboardEvent): void {
    const match = this.match;
    if (!match) return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    const binding = this.bindings.get(key);
    if (!binding) return;
    event.preventDefault(); // que las flechas no muevan la página
    const human = match.humans[binding.player];
    if (human) match.moveHuman(human.id, binding.direction);
  }

  /** Redibuja cada cuadro mientras la partida sigue: las barras de recarga y el reloj cambian solos. */
  private readonly tick = (): void => {
    this.refresh();
    if (this.match && this.match.phase !== "finished") this.frame = requestAnimationFrame(this.tick);
  };

  private setNotice(text: string | null): void {
    this.notice = text;
    this.refresh();
  }

  private refresh(): void {
    const match = this.match;
    if (!match) {
      this.status.textContent = this.notice ?? "Preparando el mapa con Prolog…";
      return;
    }
    this.renderer?.draw(match);
    for (const racer of match.racers) this.updateRow(match, racer);
    const text = this.statusText(match);
    this.status.textContent = this.notice ? `${text} — ${this.notice}` : text;
    const lost = match.outcome !== null && !(match.outcome.kind === "won" && this.isHuman(match, match.outcome.winnerId));
    this.status.className = `chase-status ${match.outcome ? (lost ? "lost" : "won") : ""}`;
  }

  private updateRow(match: ChaseMatch, racer: Racer): void {
    const row = this.rows.get(racer.id);
    if (!row) return;
    const name = racer.kind === "cpu" ? `IA (${DIFFICULTIES[match.difficulty ?? "normal"].label})` : racer.id;
    const hearts = "♥".repeat(racer.lives) + "♡".repeat(Math.max(0, LIVES - racer.lives));
    const seconds = (match.elapsedMs() / 1000).toFixed(1);
    row.text.textContent = `${name} · ${hearts} · pasos ${racer.steps}${racer.isEliminated ? " · eliminado" : ""}${
      racer === match.racers[0] ? ` · ${seconds} s` : ""
    }`;
    if (row.bar) row.bar.value = match.readiness(racer.id);
  }

  private statusText(match: ChaseMatch): string {
    switch (match.phase) {
      case "preparing":
        return "Preparando la partida…";
      case "countdown":
        return `Prepárense… ${Math.max(1, Math.ceil(match.countdownLeftMs() / 1000))}`;
      case "playing":
        return match.mode === "vs-cpu"
          ? "¡Ya! Llega a la salida (S) antes que la IA."
          : "¡Ya! Gana quien llegue primero a la salida (S).";
      case "finished":
        return outcomeText(match, match.outcome);
    }
  }

  private isHuman(match: ChaseMatch, id: string): boolean {
    return match.humans.some((h) => h.id === id);
  }
}

/** Nombre de la segunda persona: distinto del primero y de "cpu". */
function secondName(raw: string, first: string): string {
  const name = raw.trim().slice(0, 24) || "jugador2";
  const taken = name.toLowerCase() === first.toLowerCase() || name.toLowerCase() === "cpu";
  return taken ? `${name}_2` : name;
}

function outcomeText(match: ChaseMatch, outcome: Outcome | null): string {
  switch (outcome?.kind) {
    case "won": {
      if (outcome.winnerId === "cpu") return "La IA llegó primero a la salida. Perdiste.";
      return match.mode === "vs-cpu"
        ? "¡Llegaste primero a la salida! Ganaste."
        : `¡${outcome.winnerId} llegó primero a la salida! Gana.`;
    }
    case "all-eliminated":
      return "Todos se quedaron sin vidas. Nadie llegó a la salida.";
    case "abandoned":
    default:
      return match.error ? `Partida cerrada por un error: ${match.error.message}` : "Partida cerrada.";
  }
}
