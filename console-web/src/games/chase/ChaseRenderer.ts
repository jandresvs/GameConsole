import type { ChaseMatch } from "./ChaseMatch.ts";
import type { Position } from "./Position.ts";
import type { Racer } from "./Racer.ts";

const CELL = 40; // píxeles CSS por celda

const COLORS = {
  light: "#232836",
  dark: "#1e2230",
  obstacle: "#4a5163",
  obstacleMark: "#2c3240",
  exit: "#4fc98a",
  start: "#9aa3b5",
  human1: "#f2b441",
  human2: "#b48cf2",
  cpu: "#5aa9f2",
  ink: "#12141a",
} as const;

/** Color y letra con que se dibuja cada participante. */
export function racerStyle(match: ChaseMatch, racer: Racer): { color: string; label: string } {
  if (racer.kind === "cpu") return { color: COLORS.cpu, label: "IA" };
  const index = match.humans.indexOf(racer as (typeof match.humans)[number]);
  return index === 0 ? { color: COLORS.human1, label: "1" } : { color: COLORS.human2, label: "2" };
}

/** Dibuja el mapa de una partida en un canvas. No cambia nada del juego. */
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
    this.startMark(board.start);
    this.exitMark(board.exit);

    // Si varios comparten celda (al inicio todos), se dibujan lado a lado.
    const byCell = new Map<string, Racer[]>();
    for (const racer of match.racers) {
      const key = racer.position.key();
      byCell.set(key, [...(byCell.get(key) ?? []), racer]);
    }
    for (const group of byCell.values()) {
      group.forEach((racer, i) => {
        const { color, label } = racerStyle(match, racer);
        const spread = group.length > 1 ? (i - (group.length - 1) / 2) * CELL * 0.3 : 0;
        this.piece(racer.position, color, label, spread, group.length > 1 ? 0.24 : 0.36, racer.isEliminated);
      });
    }

    if (match.phase === "countdown") this.overlay(String(Math.max(1, Math.ceil(match.countdownLeftMs() / 1000))));
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

  private startMark(p: Position): void {
    const ctx = this.ctx;
    ctx.strokeStyle = COLORS.start;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(p.col * CELL + 4, p.row * CELL + 4, CELL - 8, CELL - 8);
    ctx.setLineDash([]);
  }

  private exitMark(p: Position): void {
    const ctx = this.ctx;
    const x = p.col * CELL;
    const y = p.row * CELL;
    ctx.fillStyle = "rgba(79, 201, 138, 0.28)";
    ctx.fillRect(x, y, CELL, CELL);
    ctx.strokeStyle = COLORS.exit;
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 2, y + 2, CELL - 4, CELL - 4);
    ctx.fillStyle = COLORS.exit;
    ctx.font = `bold ${CELL * 0.45}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("S", x + CELL / 2, y + CELL / 2 + 1);
  }

  private piece(p: Position, color: string, label: string, dx: number, radius: number, faded: boolean): void {
    const ctx = this.ctx;
    const cx = p.col * CELL + CELL / 2 + dx;
    const cy = p.row * CELL + CELL / 2;
    ctx.globalAlpha = faded ? 0.35 : 1;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, CELL * radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.ink;
    ctx.font = `bold ${CELL * (label.length > 1 ? 0.26 : 0.34)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, cx, cy + 1);
    ctx.globalAlpha = 1;
  }

  private overlay(text: string): void {
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(18, 20, 26, 0.55)";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = "#e8eaf0";
    ctx.font = "bold 96px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillText(text, this.canvas.width / 2, this.canvas.height / 2);
    ctx.restore();
  }
}
