import type { ChaseMatch } from "./ChaseMatch.ts";
import type { Position } from "./Position.ts";
<<<<<<< Updated upstream
import type { Racer } from "./Racer.ts";
import {
=======
import type { HumanRacer, Racer } from "./Racer.ts";
import {
  EXIT_GATE,
>>>>>>> Stashed changes
  GRASS,
  HEART_EMPTY,
  HEART_FULL,
  KNIGHT_CPU,
<<<<<<< Updated upstream
=======
  KNIGHT_PLAYER2,
>>>>>>> Stashed changes
  KNIGHT_USER,
  OBSTACLES,
  type PixelArt,
  pickFor,
  SPRITE_SIZE,
<<<<<<< Updated upstream
  VILLAIN,
=======
>>>>>>> Stashed changes
} from "./sprites.ts";

const COLORS = {
  band: "#14161d",
  bandLine: "#2a2e3a",
  text: "#e8eaf0",
  muted: "#9aa3b5",
  won: "#6fe0a0",
  lost: "#ff7b7b",
  notice: "#f2c75a",
  boxFill: "#0f1118",
  boxOuter: "#e9dcb0",
  boxInner: "#6b5f3c",
<<<<<<< Updated upstream
  route: "#f5c542",
  routeEdge: "#8a6a12",
=======
  gold: "#f5c542",
  ready: "#6fe0a0",
  charging: "#f2c75a",
  barBack: "#2a2e3a",
>>>>>>> Stashed changes
} as const;

const FONT = "'Courier New', ui-monospace, monospace";
const BOB_MS = 450; // cada cuánto suben y bajan los personajes
const HURT_MS = 600; // cuánto parpadea La Buena al chocar
const BLINK_MS = 90;

/** Lo que el renderer no puede sacar de la partida. Lo arma ChaseGame. */
export interface ChaseView {
<<<<<<< Updated upstream
  readonly player: string;
  readonly maxLives: number;
  readonly status: string;
  readonly tone: "normal" | "won" | "lost" | "notice";
}

=======
  readonly maxLives: number;
  readonly status: string;
  readonly tone: "normal" | "won" | "lost" | "notice";
  /** Texto del centro de la franja de arriba: el nivel, o "Humano vs humano". */
  readonly heading: string;
  /** Cómo se llama la IA en la franja de arriba (incluye su dificultad). */
  readonly cpuLabel: string;
}

/** Nombres largos se acortan para que quepan en la franja de arriba. */
function shorten(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

>>>>>>> Stashed changes
/**
 * Convierte cada PixelArt en una imagen la primera vez que se pide y la
 * guarda. Después dibujar un sprite es un drawImage escalado sin suavizado.
 */
class SpriteAtlas {
  private readonly cache = new Map<PixelArt, HTMLCanvasElement>();

  get(art: PixelArt): HTMLCanvasElement {
    let image = this.cache.get(art);
    if (!image) {
      image = rasterize(art);
      this.cache.set(art, image);
    }
    return image;
  }
}

function rasterize(art: PixelArt): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = art.rows[0]!.length;
  canvas.height = art.rows.length;
  const ctx = canvas.getContext("2d")!;
  art.rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const color = art.palette[ch];
      if (!color) return; // "." u otra letra sin color: transparente
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    });
  });
  return canvas;
}

/**
 * Dibuja una partida de chase en pixel art: arriba una franja con los datos de
 * cada jugador, el tablero de césped con árboles, rocas y arbustos, y abajo un
 * cuadro de diálogo con el estado. No cambia nada del juego.
 *
 * Guarda un poco de estado propio solo para animar: hacia dónde mira cada
 * caballero y desde cuándo parpadea La Buena tras un choque.
 */
export class ChaseRenderer {
  private readonly atlas = new SpriteAtlas();
  private readonly scale: number;
  private readonly facingLeft = new Map<string, boolean>();
  private readonly lastCol = new Map<string, number>();
<<<<<<< Updated upstream
  private lastLives: number | null = null;
  private hurtUntil = 0;
=======
  private readonly lastLives = new Map<string, number>();
  private readonly hurtUntil = new Map<string, number>();
>>>>>>> Stashed changes

  constructor(
    private readonly rows: number,
    private readonly cols: number,
    private readonly cell: number,
    private readonly bandHeight: number,
  ) {
    this.scale = cell / SPRITE_SIZE;
  }

  draw(ctx: CanvasRenderingContext2D, match: ChaseMatch, view: ChaseView, now = performance.now()): void {
    ctx.imageSmoothingEnabled = false;
    this.track(match, now);

    const width = this.cols * this.cell;
    const boardHeight = this.rows * this.cell;
    ctx.fillStyle = COLORS.band;
    ctx.fillRect(0, 0, width, boardHeight + 2 * this.bandHeight);

    this.drawHud(ctx, match, view);

    ctx.save();
    ctx.translate(0, this.bandHeight);
    this.drawBoard(ctx, match, now);
    ctx.restore();

    this.drawDialog(ctx, match, view, this.bandHeight + boardHeight, now);
  }

  // -------------------------------------------------------------- animación

<<<<<<< Updated upstream
  /** Compara con el cuadro anterior: hacia dónde se movió cada uno y si La Buena perdió una vida. */
  private track(match: ChaseMatch, now: number): void {
    for (const racer of [match.user, match.cpu]) {
=======
  /** Compara con el cuadro anterior: hacia dónde se movió cada uno y quién perdió una vida. */
  private track(match: ChaseMatch, now: number): void {
    for (const racer of match.racers) {
>>>>>>> Stashed changes
      const previous = this.lastCol.get(racer.id);
      const col = racer.position.col;
      if (previous !== undefined && col !== previous) this.facingLeft.set(racer.id, col < previous);
      this.lastCol.set(racer.id, col);
<<<<<<< Updated upstream
    }
    if (this.lastLives !== null && match.user.lives < this.lastLives) this.hurtUntil = now + HURT_MS;
    this.lastLives = match.user.lives;
=======

      const lives = this.lastLives.get(racer.id);
      if (lives !== undefined && racer.lives < lives) this.hurtUntil.set(racer.id, now + HURT_MS);
      this.lastLives.set(racer.id, racer.lives);
    }
  }

  /** El sprite de cada participante: la primera persona dorada, la segunda morada y la IA azul. */
  private artOf(match: ChaseMatch, racer: Racer): PixelArt {
    if (racer.kind === "cpu") return KNIGHT_CPU;
    return match.humans[0] === racer ? KNIGHT_USER : KNIGHT_PLAYER2;
>>>>>>> Stashed changes
  }

  // -------------------------------------------------------------- franja de arriba

  private drawHud(ctx: CanvasRenderingContext2D, match: ChaseMatch, view: ChaseView): void {
<<<<<<< Updated upstream
    const mid = this.bandHeight / 2;
    const icon = 2; // los íconos van a 2× (32 px)
    const iconTop = Math.round(mid - (SPRITE_SIZE * icon) / 2);
    const width = this.cols * this.cell;

    ctx.textBaseline = "middle";
    ctx.font = `bold 14px ${FONT}`;

    // Izquierda: el usuario, sus vidas y sus pasos.
    let x = 6;
    this.sprite(ctx, KNIGHT_USER, x, iconTop, icon);
    x += SPRITE_SIZE * icon + 6;
    ctx.textAlign = "start";
    ctx.fillStyle = COLORS.text;
    ctx.fillText(view.player, x, mid);
    x += ctx.measureText(view.player).width + 10;
    for (let i = 0; i < view.maxLives; i++) {
      this.sprite(ctx, i < match.user.lives ? HEART_FULL : HEART_EMPTY, x, mid - 7, 2);
      x += 17;
    }
    ctx.fillStyle = COLORS.muted;
    ctx.fillText(`pasos ${match.user.steps}`, x + 6, mid);

    // Derecha: la CPU.
    const cpuText = `CPU · pasos ${match.cpu.steps}`;
    ctx.textAlign = "end";
    ctx.fillStyle = COLORS.muted;
    ctx.fillText(cpuText, width - 8, mid);
    const textWidth = ctx.measureText(cpuText).width;
    this.sprite(ctx, KNIGHT_CPU, width - 8 - textWidth - 6 - SPRITE_SIZE * icon, iconTop, icon);
=======
    const width = this.cols * this.cell;
    const [left, right] = match.racers;
    if (left) this.drawRacerInfo(ctx, match, view, left, "start", 6);
    if (right) this.drawRacerInfo(ctx, match, view, right, "end", width - 6);

    // Centro: el nivel o el modo.
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.font = `bold 13px ${FONT}`;
    ctx.fillStyle = COLORS.gold;
    ctx.fillText(view.heading, width / 2, this.bandHeight / 2 - 5);
    ctx.font = `12px ${FONT}`;
    ctx.fillStyle = COLORS.muted;
    ctx.fillText(formatTime(match.elapsedMs), width / 2, this.bandHeight / 2 + 9);
>>>>>>> Stashed changes

    ctx.fillStyle = COLORS.bandLine;
    ctx.fillRect(0, this.bandHeight - 2, width, 2);
  }

<<<<<<< Updated upstream
=======
  /**
   * Los datos de un participante en una esquina de la franja: sprite, nombre, vidas y pasos; si es una
   * persona, además la barra de recarga (se llena en 0,5 s y es verde cuando ya puede moverse). `edge` es
   * "start" para la esquina izquierda y "end" para la derecha, donde todo se dibuja de derecha a izquierda.
   */
  private drawRacerInfo(
    ctx: CanvasRenderingContext2D,
    match: ChaseMatch,
    view: ChaseView,
    racer: Racer,
    edge: "start" | "end",
    anchor: number,
  ): void {
    const mid = this.bandHeight / 2;
    const icon = 2; // los íconos van a 2× (32 px)
    const size = SPRITE_SIZE * icon;
    const iconTop = Math.round(mid - size / 2);
    const dir = edge === "start" ? 1 : -1;
    const name = shorten(racer.kind === "cpu" ? view.cpuLabel : racer.id, 11);

    ctx.textBaseline = "middle";
    ctx.font = `bold 13px ${FONT}`;
    ctx.textAlign = edge;

    const textY = racer.kind === "human" ? mid - 6 : mid;
    const iconX = edge === "start" ? anchor : anchor - size;
    this.sprite(ctx, this.artOf(match, racer), iconX, iconTop, icon);
    let x = anchor + dir * (size + 6);

    ctx.fillStyle = racer.isEliminated ? COLORS.muted : COLORS.text;
    ctx.fillText(racer.isEliminated ? `${name} ✗` : name, x, textY);
    const nameWidth = ctx.measureText(racer.isEliminated ? `${name} ✗` : name).width;
    x += dir * (nameWidth + 8);

    if (racer.kind === "human") {
      // Vidas.
      for (let i = 0; i < view.maxLives; i++) {
        const heartX = edge === "start" ? x + i * 17 : x - (i + 1) * 17;
        this.sprite(ctx, i < racer.lives ? HEART_FULL : HEART_EMPTY, heartX, textY - 7, 2);
      }
      // Barra de recarga debajo del nombre.
      const barWidth = 96;
      const barX = edge === "start" ? anchor + size + 6 : anchor - size - 6 - barWidth;
      const human = racer as HumanRacer;
      ctx.fillStyle = COLORS.barBack;
      ctx.fillRect(barX, mid + 9, barWidth, 5);
      ctx.fillStyle = human.isReady ? COLORS.ready : COLORS.charging;
      ctx.fillRect(barX, mid + 9, Math.round(barWidth * human.readiness), 5);
    } else {
      ctx.textAlign = edge;
      ctx.fillStyle = COLORS.muted;
      ctx.fillText(`pasos ${racer.steps}`, x, textY);
      return;
    }
    ctx.textAlign = edge;
    ctx.fillStyle = COLORS.muted;
    ctx.font = `12px ${FONT}`;
    ctx.fillText(`pasos ${racer.steps}`, edge === "start" ? anchor + size + 6 + 104 : anchor - size - 6 - 104, mid + 11);
  }

>>>>>>> Stashed changes
  // -------------------------------------------------------------- tablero

  private drawBoard(ctx: CanvasRenderingContext2D, match: ChaseMatch, now: number): void {
    const { board } = match;
    for (let r = 0; r < board.rows; r++) {
      for (let c = 0; c < board.cols; c++) {
        this.sprite(ctx, pickFor(GRASS, r, c), c * this.cell, r * this.cell, this.scale);
      }
    }

<<<<<<< Updated upstream
    this.drawRoute(ctx, match.cpu.route, board.target);

=======
    this.drawStart(ctx, board.start);
>>>>>>> Stashed changes
    for (const o of board.obstacleList()) {
      // Árbol, roca o arbusto: al azar, pero siempre el mismo para la misma celda.
      this.sprite(ctx, pickFor(OBSTACLES, o.row, o.col, 1), o.col * this.cell, o.row * this.cell, this.scale);
    }

    const bob = (offset: number) => (Math.floor(now / BOB_MS + offset) % 2) * this.scale;
<<<<<<< Updated upstream
    this.character(ctx, VILLAIN, board.target, bob(0), false);
    this.character(ctx, KNIGHT_CPU, match.cpu.position, bob(0.5), this.facingLeft.get(match.cpu.id) ?? false);

    const hurt = now < this.hurtUntil;
    const hidden = hurt && Math.floor(now / BLINK_MS) % 2 === 0;
    if (!hidden) this.character(ctx, KNIGHT_USER, match.user.position, bob(0.5), this.facingLeft.get(match.user.id) ?? false);
=======
    this.character(ctx, EXIT_GATE, board.exit, 0, false);

    // Si varios comparten celda (al inicio todos), se dibujan uno tras otro; el que está en la celda de la salida queda abajo.
    match.racers.forEach((racer, index) => {
      const hurt = now < (this.hurtUntil.get(racer.id) ?? 0);
      if (hurt && Math.floor(now / BLINK_MS) % 2 === 0) return; // parpadea al chocar
      const eliminated = racer.isEliminated;
      if (eliminated) ctx.globalAlpha = 0.35;
      this.character(ctx, this.artOf(match, racer), racer.position, eliminated ? 0 : bob(index * 0.5), this.facingLeft.get(racer.id) ?? false);
      ctx.globalAlpha = 1;
    });

    if (match.phase === "countdown") this.drawCountdown(ctx, match);
>>>>>>> Stashed changes

    if (match.phase === "finished") {
      ctx.fillStyle = "rgba(10, 12, 18, 0.35)";
      ctx.fillRect(0, 0, board.cols * this.cell, board.rows * this.cell);
      this.highlightWinner(ctx, match);
    }
  }

<<<<<<< Updated upstream
  /** La ruta que Prolog le calculó a la CPU, como migas doradas. La del usuario no se muestra: sería regalarle el juego. */
  private drawRoute(ctx: CanvasRenderingContext2D, route: readonly Position[], target: Position): void {
    const dot = this.scale * 2; // 2 píxeles de sprite
    route.forEach((p, i) => {
      if (p.equals(target)) return;
      const fade = Math.max(0.35, 1 - i * 0.06);
      const x = p.col * this.cell + (this.cell - dot) / 2;
      const y = p.row * this.cell + (this.cell - dot) / 2;
      ctx.globalAlpha = fade;
      ctx.fillStyle = COLORS.routeEdge;
      ctx.fillRect(x - this.scale, y - this.scale, dot + 2 * this.scale, dot + 2 * this.scale);
      ctx.fillStyle = COLORS.route;
      ctx.fillRect(x, y, dot, dot);
    });
    ctx.globalAlpha = 1;
  }

  /** Al terminar, el ganador (si hay) se vuelve a dibujar sin el oscurecido, con un marco dorado. */
  private highlightWinner(ctx: CanvasRenderingContext2D, match: ChaseMatch): void {
    const outcome = match.outcome;
    if (outcome?.kind !== "won") return;
    const winner: Racer = outcome.winnerId === match.user.id ? match.user : match.cpu;
    const art = winner === match.user ? KNIGHT_USER : KNIGHT_CPU;
    const x = winner.position.col * this.cell;
    const y = winner.position.row * this.cell;
    this.sprite(ctx, pickFor(GRASS, winner.position.row, winner.position.col), x, y, this.scale);
    this.character(ctx, art, winner.position, 0, this.facingLeft.get(winner.id) ?? false);
    ctx.strokeStyle = COLORS.route;
    ctx.lineWidth = this.scale;
    ctx.strokeRect(x + this.scale / 2, y + this.scale / 2, this.cell - this.scale, this.cell - this.scale);
  }

=======
  /** La celda de salida del juego (donde empiezan todos): un cuadro punteado. */
  private drawStart(ctx: CanvasRenderingContext2D, p: Position): void {
    ctx.strokeStyle = COLORS.muted;
    ctx.lineWidth = this.scale;
    ctx.setLineDash([this.scale * 2, this.scale * 2]);
    ctx.strokeRect(p.col * this.cell + this.scale * 2, p.row * this.cell + this.scale * 2, this.cell - this.scale * 4, this.cell - this.scale * 4);
    ctx.setLineDash([]);
  }

  /** Número grande de la cuenta regresiva sobre el tablero. */
  private drawCountdown(ctx: CanvasRenderingContext2D, match: ChaseMatch): void {
    const w = this.cols * this.cell;
    const h = this.rows * this.cell;
    ctx.fillStyle = "rgba(10, 12, 18, 0.55)";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = COLORS.text;
    ctx.font = `bold ${this.cell * 2}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(Math.max(1, Math.ceil(match.countdownLeftMs / 1000))), w / 2, h / 2);
  }

  /** Al terminar, el ganador (si hay) se vuelve a dibujar sin el oscurecido, con un marco dorado. */
  private highlightWinner(ctx: CanvasRenderingContext2D, match: ChaseMatch): void {
    const outcome = match.outcome;
    if (outcome?.kind !== "won") return;
    const winner = match.racers.find((r) => r.id === outcome.winnerId);
    if (!winner) return;
    const x = winner.position.col * this.cell;
    const y = winner.position.row * this.cell;
    this.sprite(ctx, pickFor(GRASS, winner.position.row, winner.position.col), x, y, this.scale);
    this.character(ctx, EXIT_GATE, match.board.exit, 0, false);
    this.character(ctx, this.artOf(match, winner), winner.position, 0, this.facingLeft.get(winner.id) ?? false);
    ctx.strokeStyle = COLORS.gold;
    ctx.lineWidth = this.scale;
    ctx.strokeRect(x + this.scale / 2, y + this.scale / 2, this.cell - this.scale, this.cell - this.scale);
  }

>>>>>>> Stashed changes
  private character(ctx: CanvasRenderingContext2D, art: PixelArt, p: Position, bob: number, flip: boolean): void {
    const x = p.col * this.cell;
    const y = p.row * this.cell - bob;
    if (!flip) {
      this.sprite(ctx, art, x, y, this.scale);
      return;
    }
    ctx.save();
    ctx.translate(x + this.cell, y);
    ctx.scale(-1, 1);
    this.sprite(ctx, art, 0, 0, this.scale);
    ctx.restore();
  }

  // -------------------------------------------------------------- cuadro de diálogo

  private drawDialog(ctx: CanvasRenderingContext2D, match: ChaseMatch, view: ChaseView, top: number, now: number): void {
    const width = this.cols * this.cell;
    const m = 4;
    const h = this.bandHeight - 2 * m;
    ctx.fillStyle = COLORS.boxOuter;
    ctx.fillRect(m, top + m, width - 2 * m, h);
    ctx.fillStyle = COLORS.boxInner;
    ctx.fillRect(m + 2, top + m + 2, width - 2 * m - 4, h - 4);
    ctx.fillStyle = COLORS.boxFill;
    ctx.fillRect(m + 3, top + m + 3, width - 2 * m - 6, h - 6);

    const mid = top + this.bandHeight / 2;
    ctx.font = `bold 14px ${FONT}`;
    ctx.textAlign = "start";
    ctx.textBaseline = "middle";
    ctx.fillStyle = view.tone === "normal" ? COLORS.text : COLORS[view.tone];
    ctx.fillText(view.status, m + 12, mid);

<<<<<<< Updated upstream
    // Flechita que parpadea cuando es tu turno, como en los RPG.
=======
    // Flechita que parpadea mientras se juega, como en los RPG.
>>>>>>> Stashed changes
    if (match.phase === "playing" && Math.floor(now / 400) % 2 === 0) {
      const ax = width - m - 18;
      ctx.fillStyle = COLORS.boxOuter;
      ctx.beginPath();
      ctx.moveTo(ax, mid - 3);
      ctx.lineTo(ax + 10, mid - 3);
      ctx.lineTo(ax + 5, mid + 3);
      ctx.closePath();
      ctx.fill();
    }
  }

  private sprite(ctx: CanvasRenderingContext2D, art: PixelArt, x: number, y: number, scale: number): void {
    const image = this.atlas.get(art);
    ctx.drawImage(image, Math.round(x), Math.round(y), image.width * scale, image.height * scale);
  }
<<<<<<< Updated upstream
=======
}

function formatTime(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`;
>>>>>>> Stashed changes
}
