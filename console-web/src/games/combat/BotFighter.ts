import type { Random } from "../core/Random";
import { Fighter, type Intent, type WorldView } from "./Fighter";
import { angleTo, distance, type Vec } from "./geometry";

/** Cómo pelea un bot. */
export interface BotProfile {
  readonly playerId: string;
  readonly color: string;
  /** Arma que usa (0 rifle, 1 pistola, 2 escopeta). */
  readonly weapon: number;
  /** Error máximo de puntería, en radianes, a cada lado. */
  readonly aimError: number;
  /** Cuánto tarda en empezar a disparar a un objetivo nuevo, en ms. */
  readonly reactionMs: number;
  /** Velocidad de movimiento en px/s. */
  readonly speed: number;
}

/** Cada cuánto vuelve a elegir objetivo. */
const RETARGET_MS = 500;
/** Un objetivo que no se ve cuenta como si estuviera esta distancia más lejos. */
const HIDDEN_PENALTY = 220;

/**
 * Un bot. Decide con reglas simples, en este orden:
 *
 *  1. Objetivo: el enemigo más cercano, prefiriendo los que puede ver.
 *  2. Puntería: apunta al objetivo con un error que cambia cada 350 ms.
 *  3. Distancia: se acerca o se aleja hasta la distancia ideal de su arma,
 *     moviéndose de lado para no ser un blanco quieto.
 *  4. Disparo: solo si ve al objetivo, está a su alcance y ya pasó su
 *     tiempo de reacción.
 *  5. Si lleva un rato sin poder moverse (atascado contra una cobertura),
 *     camina un momento en una dirección al azar.
 */
export class BotFighter extends Fighter {
  private targetId: string | undefined;
  private targetSinceMs = 0;
  private retargetAtMs = 0;
  private aimNoise = 0;
  private noiseUntilMs = 0;
  private strafe = 1;
  private strafeUntilMs = 0;
  private wanderAngle = 0;
  private wanderUntilMs = 0;
  private lastCheckPos: Vec;
  private stuckCheckAtMs = 0;

  constructor(
    readonly profile: BotProfile,
    spawn: Vec,
    private readonly random: Random,
  ) {
    super(profile.playerId, profile.color, spawn, profile.weapon, profile.speed);
    this.lastCheckPos = spawn;
  }

  think(_dtMs: number, world: WorldView): Intent {
    const now = world.nowMs;
    const target = this.chooseTarget(world);
    if (!target) return { moveX: 0, moveY: 0, aim: this.aimAngle, shoot: false };

    const d = distance(this.pos, target.position);
    const sees = world.arena.hasLineOfSight(this.pos, target.position);
    const toTarget = angleTo(this.pos, target.position);

    if (now >= this.noiseUntilMs) {
      this.aimNoise = this.random.between(-this.profile.aimError, this.profile.aimError);
      this.noiseUntilMs = now + 350;
    }
    if (now >= this.strafeUntilMs) {
      this.strafe = this.random.chance(0.5) ? 1 : -1;
      this.strafeUntilMs = now + this.random.between(700, 1600);
    }

    let move: Vec;
    if (now < this.wanderUntilMs) {
      move = { x: Math.cos(this.wanderAngle), y: Math.sin(this.wanderAngle) };
    } else {
      const ideal = this.weapon.spec.preferredDistance;
      const radial = !sees || d > ideal + 40 ? 1 : d < ideal - 40 ? -1 : 0;
      const side = sees ? 0.8 : 0.6;
      move = {
        x: Math.cos(toTarget) * radial + Math.cos(toTarget + Math.PI / 2) * this.strafe * side,
        y: Math.sin(toTarget) * radial + Math.sin(toTarget + Math.PI / 2) * this.strafe * side,
      };
    }
    this.checkStuck(now, move);

    const reacted = now - this.targetSinceMs >= this.profile.reactionMs;
    return {
      moveX: move.x,
      moveY: move.y,
      aim: toTarget + this.aimNoise,
      shoot: sees && reacted && target.canBeHit(now) && d <= this.weapon.spec.range * 0.95,
    };
  }

  private chooseTarget(world: WorldView): Fighter | undefined {
    const now = world.nowMs;
    const current = world.fighters.find((f) => f.playerId === this.targetId && f.alive);
    if (current && now < this.retargetAtMs) return current;
    this.retargetAtMs = now + RETARGET_MS;

    let best: Fighter | undefined;
    let bestScore = Infinity;
    for (const f of world.fighters) {
      if (f === this || !f.alive) continue;
      const hidden = world.arena.hasLineOfSight(this.pos, f.position) ? 0 : HIDDEN_PENALTY;
      const score = distance(this.pos, f.position) + hidden;
      if (score < bestScore) {
        best = f;
        bestScore = score;
      }
    }
    if (best && best.playerId !== this.targetId) {
      this.targetId = best.playerId;
      this.targetSinceMs = now;
    }
    return best;
  }

  /** Si en 600 ms casi no se movió queriendo moverse, camina un rato hacia otro lado. */
  private checkStuck(now: number, move: Vec): void {
    if (now < this.stuckCheckAtMs) return;
    const wantsToMove = Math.hypot(move.x, move.y) > 0.1;
    if (wantsToMove && distance(this.lastCheckPos, this.pos) < 12) {
      this.wanderAngle = this.random.between(0, 2 * Math.PI);
      this.wanderUntilMs = now + 700;
    }
    this.lastCheckPos = this.pos;
    this.stuckCheckAtMs = now + 600;
  }
}
