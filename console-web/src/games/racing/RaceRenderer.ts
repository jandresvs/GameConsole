import type { Car } from "./Car";
import { Race } from "./Race";
import type { Track } from "./Track";

const COLORS = {
  grass: "#12241a",
  grassStripe: "#152a1e",
  kerbWhite: "#e8eaf0",
  kerbRed: "#d64545",
  asphalt: "#2c303a",
  centerLine: "rgba(255, 255, 255, 0.14)",
  panel: "rgba(14, 16, 22, 0.78)",
  text: "#e8eaf0",
  muted: "#9aa3b5",
  accent: "#f2b441",
  danger: "#ef6b6b",
} as const;

const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

/** El recuadro dentro de la pista donde va el marcador (el "infield"). */
const PANEL = { x: 214, y: 250, w: 404, h: 104 } as const;

/**
 * Dibuja una carrera en un canvas. Solo lee el estado de Race: no lo cambia
 * ni emite eventos. La forma de la pista se arma una vez y se reutiliza.
 */
export class RaceRenderer {
  private readonly trackPath: Path2D;

  constructor(
    private readonly track: Track,
    private readonly width: number,
    private readonly height: number,
  ) {
    this.trackPath = new Path2D();
    track.centerline.forEach((p, i) => (i === 0 ? this.trackPath.moveTo(p.x, p.y) : this.trackPath.lineTo(p.x, p.y)));
    this.trackPath.closePath();
  }

  draw(ctx: CanvasRenderingContext2D, race: Race): void {
    this.drawGround(ctx);
    this.drawTrack(ctx);
    this.drawStartLine(ctx);

    const others = race.cars.filter((c) => c !== race.player);
    for (const car of others) this.drawCar(ctx, car, race, false);
    this.drawCar(ctx, race.player, race, true);

    this.drawHud(ctx, race);
    if (race.phase === "countdown" || (race.phase === "racing" && race.raceMs < 700)) this.drawCountdown(ctx, race);
    if (race.phase === "finished") this.drawResults(ctx, race);
  }

  private drawGround(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = COLORS.grass;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.fillStyle = COLORS.grassStripe;
    for (let x = 0; x < this.width; x += 80) ctx.fillRect(x, 0, 40, this.height);
  }

  private drawTrack(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    // Pianos: una franja blanca con trazos rojos, un poco más ancha que el asfalto.
    ctx.lineWidth = this.track.width + 10;
    ctx.strokeStyle = COLORS.kerbWhite;
    ctx.stroke(this.trackPath);
    ctx.setLineDash([12, 12]);
    ctx.strokeStyle = COLORS.kerbRed;
    ctx.stroke(this.trackPath);
    ctx.setLineDash([]);

    ctx.lineWidth = this.track.width;
    ctx.strokeStyle = COLORS.asphalt;
    ctx.stroke(this.trackPath);

    ctx.lineWidth = 2;
    ctx.setLineDash([10, 14]);
    ctx.strokeStyle = COLORS.centerLine;
    ctx.stroke(this.trackPath);
    ctx.restore();
  }

  /** Línea de meta a cuadros, atravesada en s = 0. */
  private drawStartLine(ctx: CanvasRenderingContext2D): void {
    const p = this.track.pose(0);
    const half = this.track.halfWidth;
    const cell = 6;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.heading);
    for (let row = 0; row < 2; row++) {
      for (let k = 0; k * cell < 2 * half; k++) {
        ctx.fillStyle = (row + k) % 2 === 0 ? "#f4f4f4" : "#111";
        ctx.fillRect(-cell + row * cell, -half + k * cell, cell, Math.min(cell, 2 * half - k * cell));
      }
    }
    ctx.restore();
  }

  private drawCar(ctx: CanvasRenderingContext2D, car: Car, race: Race, isPlayer: boolean): void {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.heading);
    // Parpadea mientras se recupera de un choque.
    if (car.stunned && Math.floor(race.raceMs / 120) % 2 === 0) ctx.globalAlpha = 0.35;

    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.fillRect(-11, -5, 24, 13); // sombra
    ctx.fillStyle = car.color;
    roundRect(ctx, -12, -6.5, 24, 13, 3);
    ctx.fill();
    if (isPlayer) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(10, 14, 22, 0.75)";
    ctx.fillRect(1, -5, 6, 10); // parabrisas
    ctx.restore();

    if (isPlayer && race.phase !== "finished") {
      ctx.fillStyle = COLORS.text;
      ctx.font = `bold 11px ${FONT}`;
      ctx.textAlign = "center";
      ctx.fillText("TÚ", car.x, car.y - 13);
      ctx.textAlign = "start";
    }
  }

  private drawHud(ctx: CanvasRenderingContext2D, race: Race): void {
    const me = race.player;
    const standings = race.standings();
    const position = standings.indexOf(me) + 1;
    const laps = this.track.laps;

    ctx.save();
    ctx.fillStyle = COLORS.panel;
    roundRect(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, 10);
    ctx.fill();

    const left = PANEL.x + 14;
    ctx.textBaseline = "top";
    ctx.fillStyle = COLORS.muted;
    ctx.font = `11px ${FONT}`;
    ctx.fillText(this.track.name.toUpperCase(), left, PANEL.y + 10);

    ctx.fillStyle = COLORS.text;
    ctx.font = `bold 20px ${FONT}`;
    const lapText = me.finished ? "Terminaste" : `Vuelta ${me.currentLap}/${laps}`;
    ctx.fillText(lapText, left, PANEL.y + 26);
    ctx.fillStyle = COLORS.accent;
    ctx.fillText(`${position}.º`, left + 150, PANEL.y + 26);

    ctx.font = `13px ${FONT}`;
    ctx.fillStyle = COLORS.text;
    const current = me.finished ? (me.finishedAtMs ?? 0) : race.raceMs - me.laps.currentLapStartMs;
    const times = me.laps.lapTimes;
    const best = times.length > 0 ? Math.min(...times) : undefined;
    ctx.fillText(`${me.finished ? "Total" : "Vuelta"} ${formatTime(current)}`, left, PANEL.y + 54);
    ctx.fillStyle = COLORS.muted;
    ctx.fillText(`Mejor ${best === undefined ? "—" : formatTime(best)}`, left + 120, PANEL.y + 54);

    // Avisos: choque reciente o cierre de la carrera.
    ctx.font = `bold 13px ${FONT}`;
    if (me.stunned) {
      ctx.fillStyle = COLORS.danger;
      ctx.fillText(`¡Choque! −${(me.lastCrashLostMs / 1000).toFixed(1)} s`, left, PANEL.y + 78);
    } else if (race.phase === "racing" && race.graceLeftMs !== undefined && !me.finished) {
      ctx.fillStyle = COLORS.accent;
      ctx.fillText(`La carrera cierra en ${Math.ceil(race.graceLeftMs / 1000)} s`, left, PANEL.y + 78);
    }

    // Tabla de posiciones a la derecha del panel.
    const colX = PANEL.x + 262;
    ctx.font = `12px ${FONT}`;
    standings.forEach((car, i) => {
      const y = PANEL.y + 12 + i * 21;
      ctx.fillStyle = COLORS.muted;
      ctx.fillText(`${i + 1}`, colX, y);
      ctx.fillStyle = car.color;
      ctx.fillRect(colX + 14, y + 2, 10, 10);
      ctx.fillStyle = car === me ? COLORS.text : COLORS.muted;
      ctx.font = car === me ? `bold 12px ${FONT}` : `12px ${FONT}`;
      ctx.fillText(car === me ? "Tú" : car.playerId, colX + 30, y);
      ctx.font = `12px ${FONT}`;
      const lapsDone = car.finished ? "✓" : `${car.laps.completed}/${laps}`;
      ctx.fillStyle = COLORS.muted;
      ctx.textAlign = "right";
      ctx.fillText(lapsDone, PANEL.x + PANEL.w - 14, y);
      ctx.textAlign = "start";
    });
    ctx.restore();
  }

  private drawCountdown(ctx: CanvasRenderingContext2D, race: Race): void {
    const text = race.phase === "countdown" ? String(Math.ceil(race.countdownMs / 1000)) : "¡YA!";
    ctx.save();
    ctx.font = `bold 64px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 6;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
    ctx.strokeText(text, this.width / 2, 180);
    ctx.fillStyle = race.phase === "countdown" ? COLORS.text : COLORS.accent;
    ctx.fillText(text, this.width / 2, 180);
    ctx.restore();
  }

  private drawResults(ctx: CanvasRenderingContext2D, race: Race): void {
    const standings = race.standings();
    const winner = standings[0];
    const w = 340;
    const h = 64 + standings.length * 26 + 16;
    const x = (this.width - w) / 2;
    const y = (this.height - h) / 2;

    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.fillStyle = "#1b1f28";
    roundRect(ctx, x, y, w, h, 12);
    ctx.fill();

    ctx.textBaseline = "top";
    ctx.textAlign = "center";
    ctx.font = `bold 22px ${FONT}`;
    ctx.fillStyle = winner === race.player ? COLORS.accent : COLORS.text;
    ctx.fillText(winner === race.player ? "¡Ganaste!" : `Ganó ${winner?.playerId ?? "nadie"}`, this.width / 2, y + 18);
    ctx.textAlign = "start";

    ctx.font = `13px ${FONT}`;
    standings.forEach((car, i) => {
      const rowY = y + 60 + i * 26;
      ctx.fillStyle = COLORS.muted;
      ctx.fillText(`${i + 1}.º`, x + 22, rowY);
      ctx.fillStyle = car.color;
      ctx.fillRect(x + 56, rowY + 2, 11, 11);
      ctx.fillStyle = car === race.player ? COLORS.text : COLORS.muted;
      ctx.fillText(car === race.player ? "Tú" : car.playerId, x + 76, rowY);
      ctx.textAlign = "right";
      ctx.fillText(car.finishedAtMs === undefined ? "No terminó" : formatTime(car.finishedAtMs), x + w - 22, rowY);
      ctx.textAlign = "start";
    });
    ctx.restore();
  }
}

/** 61234 → "1:01.2" */
function formatTime(ms: number): string {
  const totalTenths = Math.floor(ms / 100);
  const minutes = Math.floor(totalTenths / 600);
  const seconds = Math.floor((totalTenths % 600) / 10);
  const tenths = totalTenths % 10;
  return `${minutes}:${String(seconds).padStart(2, "0")}.${tenths}`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}
