import type { Random } from "../core/Random";
import type { Arena } from "./Arena";
import { BotFighter, type BotProfile } from "./BotFighter";
import { Fighter, type WorldView } from "./Fighter";
import { distance, segmentHitsCircle, segmentHitsRect, type Vec } from "./geometry";
import { PlayerFighter, type PlayerInput } from "./PlayerFighter";
import type { Projectile } from "./Projectile";

/** Lo que la partida avisa hacia afuera. CombatGame lo convierte en eventos de GameStats. */
export interface CombatListener {
  onShot(shooterId: string, weapon: string): void;
  onDamage(attackerId: string, targetId: string, amount: number, weapon: string): void;
  onElimination(killerId: string, victimId: string, weapon: string): void;
  /** La partida terminó. Sin winnerId = empate al acabarse el tiempo. */
  onFinished(winnerId: string | undefined): void;
}

export type CombatPhase = "countdown" | "fighting" | "finished";

export interface KillFeedEntry {
  readonly killerId: string;
  readonly victimId: string;
  readonly weapon: string;
  readonly atMs: number;
}

export interface Score {
  readonly fighter: Fighter;
  readonly kills: number;
  readonly deaths: number;
}

/**
 * Las reglas de una partida de combate, sin dibujo ni navegador:
 *
 *  1. Cuenta regresiva de 3 segundos.
 *  2. Todos contra todos. Cada disparo es un proyectil que viaja; si toca a
 *     alguien le quita vida, y si lo deja en 0 lo elimina.
 *  3. El eliminado reaparece a los 2 s, lejos de los demás, con 1 s de
 *     protección.
 *  4. Gana el primero en llegar a 8 eliminaciones. Si se acaban los 3:00,
 *     gana quien lleve más; si hay empate, nadie.
 */
export class CombatMatch {
  static readonly COUNTDOWN_MS = 3000;
  static readonly KILLS_TO_WIN = 8;
  static readonly TIME_LIMIT_MS = 180_000;
  static readonly RESPAWN_MS = 2000;
  static readonly SHIELD_MS = 1000;

  readonly fighters: readonly Fighter[];
  readonly player: PlayerFighter;

  private currentPhase: CombatPhase = "countdown";
  private countdownLeftMs = CombatMatch.COUNTDOWN_MS;
  private clockMs = 0;
  private bullets: Projectile[] = [];
  private readonly kills = new Map<string, number>();
  private readonly deaths = new Map<string, number>();
  private readonly feed: KillFeedEntry[] = [];

  constructor(
    readonly arena: Arena,
    playerId: string,
    playerColor: string,
    bots: readonly BotProfile[],
    private readonly listener: CombatListener,
    private readonly random: Random,
  ) {
    if (bots.length + 1 > arena.spawns.length) throw new Error(`La arena tiene ${arena.spawns.length} puntos de aparición`);
    this.player = new PlayerFighter(playerId, playerColor, arena.spawns[0]!);
    const others = bots.map((b, i) => new BotFighter(b, arena.spawns[i + 1]!, random));
    this.fighters = [this.player, ...others];
    for (const f of this.fighters) {
      this.kills.set(f.playerId, 0);
      this.deaths.set(f.playerId, 0);
    }
  }

  get phase(): CombatPhase {
    return this.currentPhase;
  }

  /** Milisegundos desde que empezó la pelea. */
  get nowMs(): number {
    return this.clockMs;
  }

  get countdownMs(): number {
    return this.countdownLeftMs;
  }

  get timeLeftMs(): number {
    return Math.max(0, CombatMatch.TIME_LIMIT_MS - this.clockMs);
  }

  get projectiles(): readonly Projectile[] {
    return this.bullets;
  }

  /** Las últimas eliminaciones, la más reciente al final. */
  recentKills(count = 4): readonly KillFeedEntry[] {
    return this.feed.slice(-count);
  }

  /** Marcador: más eliminaciones primero; a igualdad, menos muertes. */
  standings(): Score[] {
    return this.fighters
      .map((fighter) => ({ fighter, kills: this.kills.get(fighter.playerId)!, deaths: this.deaths.get(fighter.playerId)! }))
      .sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
  }

  /** Avanza la partida dtMs. `input` es lo que hace el usuario; los bots deciden solos. */
  update(dtMs: number, input: PlayerInput): void {
    if (this.currentPhase === "finished") return;

    if (this.currentPhase === "countdown") {
      this.countdownLeftMs -= dtMs;
      if (this.countdownLeftMs <= 0) {
        this.countdownLeftMs = 0;
        this.currentPhase = "fighting";
      }
      return;
    }

    this.clockMs += dtMs;
    this.respawnReady();

    this.player.setInput(input);
    const world: WorldView = { arena: this.arena, nowMs: this.clockMs, fighters: this.fighters, random: this.random };
    for (const f of this.fighters) {
      if (!f.alive) continue;
      const shot = f.act(f.think(dtMs, world), dtMs, world);
      if (shot) {
        this.bullets.push(shot);
        this.listener.onShot(f.playerId, shot.weapon.id);
      }
    }

    this.moveProjectiles(dtMs / 1000);
    if (this.currentPhase !== "fighting") return;

    if (this.clockMs >= CombatMatch.TIME_LIMIT_MS) {
      const [first, second] = this.standings();
      const tie = first !== undefined && second !== undefined && first.kills === second.kills;
      this.end(tie ? undefined : first?.fighter.playerId);
    }
  }

  private moveProjectiles(dt: number): void {
    for (const b of this.bullets) {
      const from: Vec = { x: b.x, y: b.y };
      b.step(dt);
      const to: Vec = { x: b.x, y: b.y };

      // ¿A quién toca primero en este tramo?
      let victim: Fighter | undefined;
      let firstT = Infinity;
      for (const f of this.fighters) {
        if (f.playerId === b.ownerId || !f.canBeHit(this.clockMs)) continue;
        const t = segmentHitsCircle(from, to, f.position, Fighter.RADIUS + 2);
        if (t !== undefined && t < firstT) {
          firstT = t;
          victim = f;
        }
      }

      const end = victim ? { x: from.x + (to.x - from.x) * firstT, y: from.y + (to.y - from.y) * firstT } : to;
      if (this.arena.blocks(end) || this.arena.obstacles.some((o) => segmentHitsRect(from, end, o))) {
        b.stop(); // la pared lo detiene antes de llegar a nadie
        continue;
      }
      if (victim) {
        b.stop();
        this.hit(b, victim);
        if (this.currentPhase !== "fighting") return;
      }
    }
    this.bullets = this.bullets.filter((b) => b.alive);
  }

  private hit(b: Projectile, victim: Fighter): void {
    const amount = victim.takeHit(b.weapon.damage);
    this.listener.onDamage(b.ownerId, victim.playerId, amount, b.weapon.id);
    if (victim.hp > 0) return;

    victim.eliminate(this.clockMs + CombatMatch.RESPAWN_MS);
    const kills = this.kills.get(b.ownerId)! + 1;
    this.kills.set(b.ownerId, kills);
    this.deaths.set(victim.playerId, this.deaths.get(victim.playerId)! + 1);
    this.feed.push({ killerId: b.ownerId, victimId: victim.playerId, weapon: b.weapon.id, atMs: this.clockMs });
    this.listener.onElimination(b.ownerId, victim.playerId, b.weapon.id);

    if (kills >= CombatMatch.KILLS_TO_WIN) this.end(b.ownerId);
  }

  /** Reaparece a quien ya cumplió su espera, en el punto más alejado de los vivos. */
  private respawnReady(): void {
    for (const f of this.fighters) {
      if (f.alive || f.respawnInMs(this.clockMs) > 0) continue;
      const others = this.fighters.filter((o) => o !== f && o.alive);
      const spot = [...this.arena.spawns].sort(
        (a, b) => nearest(b, others) - nearest(a, others) || this.random.next() - 0.5,
      )[0]!;
      f.respawn(spot, this.clockMs + CombatMatch.SHIELD_MS);
    }
  }

  private end(winnerId: string | undefined): void {
    if (this.currentPhase === "finished") return;
    this.currentPhase = "finished";
    this.bullets = [];
    this.listener.onFinished(winnerId);
  }
}

function nearest(p: Vec, fighters: readonly Fighter[]): number {
  return fighters.reduce((min, f) => Math.min(min, distance(p, f.position)), Infinity);
}
