import type { ChaseMatch } from "./ChaseMatch.ts";
import type { Position } from "./Position.ts";

const CELL = 44; // píxeles CSS por celda

const COLORS = {
  light: "#232836",
  dark: "#1e2230",
  grid: "#2c3240",
  obstacle: "#4a5163",
  obstacleMark: "#2c3240",
  target: "#ef6b6b",
  user: "#f2b441",
  cpu: "#5aa9f2",
  ink: "#12141a",
} as const;

/** Dibuja el tablero de una partida en un canvas. No cambia nada del juego. */
export class ChaseRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement, rows: number, cols: number) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Este navegador no ofrece canvas 2D");
    this.canvas = canvas;
    this.ctx = ctx;

    const scale = window.devicePixelRatio || 1;
    canvas.width = cols * CELL * scale;
    canvas.height = rows * CELL * scale;
    canvas.style.aspectRatio = `${cols} / ${rows}`;
    ctx.scale(scale, scale);
  }

  draw(match: ChaseMatch): void {
    const { board } = match;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let r = 0; r < board.rows; r++) {
      for (let c = 0; c < board.cols; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? COLORS.light : COLORS.dark;
        ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
      }
    }
    for (const o of board.obstacleList()) this.obstacle(o);

    this.piece(board.target, COLORS.target, "M");
    this.piece(match.cpu.position, COLORS.cpu, "C");
    this.piece(match.user.position, COLORS.user, "B");
  }

  private obstacle(p: Position): void {
    const ctx = this.ctx;
    const x = p.col * CELL;
    const y = p.row * CELL;
    ctx.fillStyle = COLORS.obstacle;
    ctx.fillRect(x + 3, y + 3, CELL - 6, CELL - 6);
    ctx.strokeStyle = COLORS.obstacleMark;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 10, y + 10);
    ctx.lineTo(x + CELL - 10, y + CELL - 10);
    ctx.moveTo(x + CELL - 10, y + 10);
    ctx.lineTo(x + 10, y + CELL - 10);
    ctx.stroke();
  }

  private piece(p: Position, color: string, letter: string): void {
    const ctx = this.ctx;
    const cx = p.col * CELL + CELL / 2;
    const cy = p.row * CELL + CELL / 2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, CELL * 0.36, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.ink;
    ctx.font = `bold ${CELL * 0.4}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(letter, cx, cy + 1);
  }
}
