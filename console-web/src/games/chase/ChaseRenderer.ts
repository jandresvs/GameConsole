import type { ChaseMatch } from "./ChaseMatch.ts";
import type { Position } from "./Position.ts";
import type { Racer } from "./Racer.ts";
import {
  GRASS,
  HEART_EMPTY,
  HEART_FULL,
  KNIGHT_CPU,
  KNIGHT_USER,
  OBSTACLES,
  type PixelArt,
  pickFor,
  SPRITE_SIZE,
  VILLAIN,
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
  route: "#f5c542",
  routeEdge: "#8a6a12",
} as const;

const FONT = "'Courier New', ui-monospace, monospace";
const BOB_MS = 450; // cada cuánto suben y bajan los personajes
const HURT_MS = 600; // cuánto parpadea La Buena al chocar
const BLINK_MS = 90;

/** Lo que el renderer no puede sacar de la partida. Lo arma ChaseGame. */
export interface ChaseView {
  readonly player: string;
  readonly maxLives: number;
  readonly status: string;
  readonly tone: "normal" | "won" | "lost" | "notice";
}

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
  private lastLives: number | null = null;
  private hurtUntil = 0;

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

  /** Compara con el cuadro anterior: hacia dónde se movió cada uno y si La Buena perdió una vida. */
  private track(match: ChaseMatch, now: number): void {
    for (const racer of [match.user, match.cpu]) {
      const previous = this.lastCol.get(racer.id);
      const col = racer.position.col;
      if (previous !== undefined && col !== previous) this.facingLeft.set(racer.id, col < previous);
      this.lastCol.set(racer.id, col);
    }
    if (this.lastLives !== null && match.user.lives < this.lastLives) this.hurtUntil = now + HURT_MS;
    this.lastLives = match.user.lives;
  }

  // -------------------------------------------------------------- franja de arriba

  private drawHud(ctx: CanvasRenderingContext2D, match: ChaseMatch, view: ChaseView): void {
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

    ctx.fillStyle = COLORS.bandLine;
    ctx.fillRect(0, this.bandHeight - 2, width, 2);
  }

  // -------------------------------------------------------------- tablero

  private drawBoard(ctx: CanvasRenderingContext2D, match: ChaseMatch, now: number): void {
    const { board } = match;
    for (let r = 0; r < board.rows; r++) {
      for (let c = 0; c < board.cols; c++) {
        this.sprite(ctx, pickFor(GRASS, r, c), c * this.cell, r * this.cell, this.scale);
      }
    }

    this.drawRoute(ctx, match.cpu.route, board.target);

    for (const o of board.obstacleList()) {
      // Árbol, roca o arbusto: al azar, pero siempre el mismo para la misma celda.
      this.sprite(ctx, pickFor(OBSTACLES, o.row, o.col, 1), o.col * this.cell, o.row * this.cell, this.scale);
    }

    const bob = (offset: number) => (Math.floor(now / BOB_MS + offset) % 2) * this.scale;
    this.character(ctx, VILLAIN, board.target, bob(0), false);
    this.character(ctx, KNIGHT_CPU, match.cpu.position, bob(0.5), this.facingLeft.get(match.cpu.id) ?? false);

    const hurt = now < this.hurtUntil;
    const hidden = hurt && Math.floor(now / BLINK_MS) % 2 === 0;
    if (!hidden) this.character(ctx, KNIGHT_USER, match.user.position, bob(0.5), this.facingLeft.get(match.user.id) ?? false);

    if (match.phase === "finished") {
      ctx.fillStyle = "rgba(10, 12, 18, 0.35)";
      ctx.fillRect(0, 0, board.cols * this.cell, board.rows * this.cell);
      this.highlightWinner(ctx, match);
    }
  }

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

    // Flechita que parpadea cuando es tu turno, como en los RPG.
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
}
