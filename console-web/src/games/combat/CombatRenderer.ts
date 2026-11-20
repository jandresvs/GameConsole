import type { Arena } from "./Arena";
import { CombatMatch } from "./CombatMatch";
import { Fighter } from "./Fighter";
import type { Vec } from "./geometry";
import { WEAPONS } from "./Weapon";

const COLORS = {
  floor: "#181b22",
  grid: "#1e222b",
  wall: "#394050",
  wallTop: "#4d576b",
  hud: "rgba(14, 16, 22, 0.92)",
  text: "#e8eaf0",
  muted: "#9aa3b5",
  accent: "#f2b441",
  danger: "#ef6b6b",
  ok: "#4fc98a",
  bullet: "#ffe08a",
} as const;

const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const HUD_HEIGHT = 40;
/** Cuánto se ve una eliminación en la lista de la esquina. */
const FEED_MS = 5000;

/**
 * Dibuja una partida de combat en un canvas. Solo lee el estado de
 * CombatMatch: no lo cambia ni emite eventos.
 */
export class CombatRenderer {
  constructor(
    private readonly arena: Arena,
    private readonly width: number,
    private readonly height: number,
  ) {}

  draw(ctx: CanvasRenderingContext2D, match: CombatMatch, pointer: Vec | undefined): void {
    this.drawFloor(ctx);
    this.drawObstacles(ctx);
    this.drawProjectiles(ctx, match);
    for (const f of match.fighters) if (f !== match.player) this.drawFighter(ctx, f, match, false);
    this.drawFighter(ctx, match.player, match, true);
    if (pointer && match.player.alive && match.phase === "fighting") this.drawCrosshair(ctx, pointer);

    this.drawHud(ctx, match);
    this.drawFeed(ctx, match);
    if (!match.player.alive && match.phase === "fighting") this.drawRespawn(ctx, match);
    if (match.phase === "countdown" || (match.phase === "fighting" && match.nowMs < 700)) this.drawCountdown(ctx, match);
    if (match.phase === "finished") this.drawResults(ctx, match);
  }

  private drawFloor(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = COLORS.floor;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= this.width; x += 40) {
      ctx.moveTo(x + 0.5, HUD_HEIGHT);
      ctx.lineTo(x + 0.5, this.height);
    }
    for (let y = HUD_HEIGHT; y <= this.height; y += 40) {
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(this.width, y + 0.5);
    }
    ctx.stroke();
  }

  private drawObstacles(ctx: CanvasRenderingContext2D): void {
    for (const o of this.arena.obstacles) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
      ctx.fillRect(o.x + 4, o.y + 5, o.w, o.h); // sombra
      ctx.fillStyle = COLORS.wall;
      ctx.beginPath();
      ctx.roundRect(o.x, o.y, o.w, o.h, 4);
      ctx.fill();
      ctx.strokeStyle = COLORS.wallTop;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  private drawProjectiles(ctx: CanvasRenderingContext2D, match: CombatMatch): void {
    ctx.save();
    ctx.strokeStyle = COLORS.bullet;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    for (const b of match.projectiles) {
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.018, b.y - b.vy * 0.018);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawFighter(ctx: CanvasRenderingContext2D, f: Fighter, match: CombatMatch, isPlayer: boolean): void {
    if (!f.alive) return;
    const r = Fighter.RADIUS;
    ctx.save();
    ctx.translate(f.x, f.y);

    // Cañón del arma, en la dirección en que apunta.
    ctx.save();
    ctx.rotate(f.aim);
    ctx.fillStyle = "#0e1016";
    ctx.fillRect(r - 4, -3, 14, 6);
    ctx.restore();

    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = f.color;
    ctx.fill();
    ctx.lineWidth = isPlayer ? 2.5 : 1.5;
    ctx.strokeStyle = isPlayer ? "#ffffff" : "rgba(0, 0, 0, 0.5)";
    ctx.stroke();

    // Recién aparecido: un anillo mientras no se le puede herir.
    if (f.shielded(match.nowMs)) {
      ctx.beginPath();
      ctx.arc(0, 0, r + 5, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Barra de vida.
    const w = 28;
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(-w / 2, -r - 10, w, 4);
    const ratio = f.hp / Fighter.MAX_HP;
    ctx.fillStyle = ratio > 0.5 ? COLORS.ok : ratio > 0.25 ? COLORS.accent : COLORS.danger;
    ctx.fillRect(-w / 2, -r - 10, w * ratio, 4);

    ctx.font = `${isPlayer ? "bold " : ""}10px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillStyle = isPlayer ? COLORS.text : COLORS.muted;
    ctx.fillText(isPlayer ? "TÚ" : f.playerId, 0, r + 14);
    ctx.restore();
  }

  private drawCrosshair(ctx: CanvasRenderingContext2D, p: Vec): void {
    ctx.save();
    ctx.strokeStyle = COLORS.accent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
    ctx.moveTo(p.x - 11, p.y);
    ctx.lineTo(p.x - 4, p.y);
    ctx.moveTo(p.x + 4, p.y);
    ctx.lineTo(p.x + 11, p.y);
    ctx.moveTo(p.x, p.y - 11);
    ctx.lineTo(p.x, p.y - 4);
    ctx.moveTo(p.x, p.y + 4);
    ctx.lineTo(p.x, p.y + 11);
    ctx.stroke();
    ctx.restore();
  }

  private drawHud(ctx: CanvasRenderingContext2D, match: CombatMatch): void {
    ctx.save();
    ctx.fillStyle = COLORS.hud;
    ctx.fillRect(0, 0, this.width, HUD_HEIGHT);
    ctx.textBaseline = "middle";
    const mid = HUD_HEIGHT / 2;

    // Tiempo que queda.
    ctx.font = `bold 16px ${FONT}`;
    ctx.fillStyle = match.timeLeftMs < 20_000 ? COLORS.danger : COLORS.text;
    ctx.fillText(formatClock(match.timeLeftMs), 14, mid);

    // Marcador: eliminaciones de cada uno.
    let x = 82;
    ctx.font = `12px ${FONT}`;
    for (const s of match.standings()) {
      const me = s.fighter === match.player;
      ctx.fillStyle = s.fighter.color;
      ctx.beginPath();
      ctx.arc(x + 5, mid, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = me ? COLORS.text : COLORS.muted;
      ctx.font = `${me ? "bold " : ""}12px ${FONT}`;
      const label = `${me ? "Tú" : s.fighter.playerId} ${s.kills}`;
      ctx.fillText(label, x + 14, mid);
      x += 14 + ctx.measureText(label).width + 16;
    }
    ctx.fillStyle = COLORS.muted;
    ctx.font = `11px ${FONT}`;
    ctx.fillText(`meta: ${CombatMatch.KILLS_TO_WIN}`, x, mid);

    // Armas del usuario: la que empuña, resaltada.
    ctx.textAlign = "right";
    let right = this.width - 14;
    for (let i = WEAPONS.length - 1; i >= 0; i--) {
      const active = match.player.weaponSlot === i;
      ctx.font = `${active ? "bold " : ""}12px ${FONT}`;
      ctx.fillStyle = active ? COLORS.accent : COLORS.muted;
      const label = `${i + 1} ${WEAPONS[i]!.label}`;
      ctx.fillText(label, right, mid);
      right -= ctx.measureText(label).width + 14;
    }
    ctx.restore();
  }

  private drawFeed(ctx: CanvasRenderingContext2D, match: CombatMatch): void {
    const recent = match.recentKills(4).filter((k) => match.nowMs - k.atMs < FEED_MS);
    ctx.save();
    ctx.font = `12px ${FONT}`;
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    recent.forEach((k, i) => {
      const y = HUD_HEIGHT + 8 + i * 18;
      const name = (id: string) => (id === match.player.playerId ? "Tú" : id);
      const text = `${name(k.killerId)} eliminó a ${name(k.victimId)} · ${k.weapon}`;
      const w = ctx.measureText(text).width;
      ctx.fillStyle = "rgba(14, 16, 22, 0.7)";
      ctx.fillRect(this.width - 14 - w - 8, y - 2, w + 16, 17);
      const involvesMe = k.killerId === match.player.playerId || k.victimId === match.player.playerId;
      ctx.fillStyle = involvesMe ? COLORS.accent : COLORS.text;
      ctx.fillText(text, this.width - 14, y);
    });
    ctx.restore();
  }

  private drawRespawn(ctx: CanvasRenderingContext2D, match: CombatMatch): void {
    const seconds = (match.player.respawnInMs(match.nowMs) / 1000).toFixed(1);
    this.banner(ctx, `Te eliminaron · reapareces en ${seconds} s`, COLORS.danger, 28);
  }

  private drawCountdown(ctx: CanvasRenderingContext2D, match: CombatMatch): void {
    const text = match.phase === "countdown" ? String(Math.ceil(match.countdownMs / 1000)) : "¡A PELEAR!";
    this.banner(ctx, text, match.phase === "countdown" ? COLORS.text : COLORS.accent, 52);
  }

  private banner(ctx: CanvasRenderingContext2D, text: string, color: string, size: number): void {
    ctx.save();
    ctx.font = `bold ${size}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 6;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.7)";
    const y = HUD_HEIGHT + (this.height - HUD_HEIGHT) / 2 - 80;
    ctx.strokeText(text, this.width / 2, y);
    ctx.fillStyle = color;
    ctx.fillText(text, this.width / 2, y);
    ctx.restore();
  }

  private drawResults(ctx: CanvasRenderingContext2D, match: CombatMatch): void {
    const standings = match.standings();
    const [first, second] = standings;
    const tie = first !== undefined && second !== undefined && first.kills === second.kills;
    const title = tie ? "Empate" : first?.fighter === match.player ? "¡Ganaste!" : `Ganó ${first?.fighter.playerId}`;

    const w = 340;
    const h = 92 + standings.length * 26;
    const x = (this.width - w) / 2;
    const y = (this.height - h) / 2;
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.fillStyle = "#1b1f28";
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 12);
    ctx.fill();

    ctx.textBaseline = "top";
    ctx.textAlign = "center";
    ctx.font = `bold 22px ${FONT}`;
    ctx.fillStyle = first?.fighter === match.player && !tie ? COLORS.accent : COLORS.text;
    ctx.fillText(title, this.width / 2, y + 18);

    ctx.font = `11px ${FONT}`;
    ctx.fillStyle = COLORS.muted;
    ctx.textAlign = "right";
    ctx.fillText("Elim.", x + w - 80, y + 56);
    ctx.fillText("Muertes", x + w - 22, y + 56);

    ctx.font = `13px ${FONT}`;
    standings.forEach((s, i) => {
      const rowY = y + 76 + i * 26;
      const me = s.fighter === match.player;
      ctx.textAlign = "left";
      ctx.fillStyle = COLORS.muted;
      ctx.fillText(`${i + 1}.º`, x + 22, rowY);
      ctx.fillStyle = s.fighter.color;
      ctx.fillRect(x + 56, rowY + 2, 11, 11);
      ctx.fillStyle = me ? COLORS.text : COLORS.muted;
      ctx.fillText(me ? "Tú" : s.fighter.playerId, x + 76, rowY);
      ctx.textAlign = "right";
      ctx.fillText(String(s.kills), x + w - 80, rowY);
      ctx.fillText(String(s.deaths), x + w - 22, rowY);
    });
    ctx.restore();
  }
}

/** 161000 → "2:41" */
function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
