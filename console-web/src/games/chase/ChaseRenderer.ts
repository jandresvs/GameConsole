import type { ChaseMatch } from "./ChaseMatch.ts";
import type { Position } from "./Position.ts";

const COLORS = {
  background: "#12141a",
  light: "#232836",
  dark: "#1e2230",
  obstacle: "#4a5163",
  obstacleMark: "#2c3240",
  target: "#ef6b6b",
  user: "#f2b441",
  cpu: "#5aa9f2",
  ink: "#12141a",
  text: "#e8eaf0",
  muted: "#9aa3b5",
  won: "#4fc98a",
  lost: "#ef6b6b",
  notice: "#f2b441",
} as const;

const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

/** Lo que se muestra arriba y abajo del tablero. Lo arma ChaseGame. */
export interface ChaseView {
  readonly hud: string;
  readonly status: string;
  readonly tone: "normal" | "won" | "lost" | "notice";
}

/**
 * Dibuja una partida de chase en el lienzo de la clase base Game: una franja
 * con los datos del jugador, el tablero y una línea de estado. No cambia nada
 * del juego.
 */
export class ChaseRenderer {
  constructor(
    private readonly rows: number,
    private readonly cols: number,
    private readonly cell: number,
    private readonly bandHeight: number,
  ) {}

  draw(ctx: CanvasRenderingContext2D, match: ChaseMatch, view: ChaseView): void {
    const width = this.cols * this.cell;
    const boardHeight = this.rows * this.cell;
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, width, boardHeight + 2 * this.bandHeight);

    ctx.textBaseline = "middle";
    ctx.textAlign = "start";
    ctx.font = `13px ${FONT}`;
    ctx.fillStyle = COLORS.muted;
    ctx.fillText(view.hud, 10, this.bandHeight / 2);

    ctx.save();
    ctx.translate(0, this.bandHeight);
    this.drawBoard(ctx, match);
    ctx.restore();

    ctx.font = `bold 13px ${FONT}`;
    ctx.fillStyle = view.tone === "normal" ? COLORS.text : COLORS[view.tone];
    ctx.fillText(view.status, 10, this.bandHeight + boardHeight + this.bandHeight / 2);
  }

  private drawBoard(ctx: CanvasRenderingContext2D, match: ChaseMatch): void {
    const { board } = match;
    for (let r = 0; r < board.rows; r++) {
      for (let c = 0; c < board.cols; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? COLORS.light : COLORS.dark;
        ctx.fillRect(c * this.cell, r * this.cell, this.cell, this.cell);
      }
    }
    for (const o of board.obstacleList()) this.obstacle(ctx, o);

    this.piece(ctx, board.target, COLORS.target, "M");
    this.piece(ctx, match.cpu.position, COLORS.cpu, "C");
    this.piece(ctx, match.user.position, COLORS.user, "B");
  }

  private obstacle(ctx: CanvasRenderingContext2D, p: Position): void {
    const cell = this.cell;
    const x = p.col * cell;
    const y = p.row * cell;
    ctx.fillStyle = COLORS.obstacle;
    ctx.fillRect(x + 3, y + 3, cell - 6, cell - 6);
    ctx.strokeStyle = COLORS.obstacleMark;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 10, y + 10);
    ctx.lineTo(x + cell - 10, y + cell - 10);
    ctx.moveTo(x + cell - 10, y + 10);
    ctx.lineTo(x + 10, y + cell - 10);
    ctx.stroke();
  }

  private piece(ctx: CanvasRenderingContext2D, p: Position, color: string, letter: string): void {
    const cell = this.cell;
    const cx = p.col * cell + cell / 2;
    const cy = p.row * cell + cell / 2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, cell * 0.36, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.ink;
    ctx.font = `bold ${cell * 0.4}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(letter, cx, cy + 1);
    ctx.textAlign = "start";
  }
}
