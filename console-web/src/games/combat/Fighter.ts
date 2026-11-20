import type { Random } from "../core/Random";
import type { Arena } from "./Arena";
import type { Vec } from "./geometry";
import { Projectile } from "./Projectile";
import { WEAPONS, Weapon } from "./Weapon";

/** Lo que un luchador quiere hacer en este paso. */
export interface Intent {
  /** Dirección de movimiento; se normaliza, así que (1, 1) no va más rápido. */
  readonly moveX: number;
  readonly moveY: number;
  /** Hacia dónde apunta, en radianes. */
  readonly aim: number;
  readonly shoot: boolean;
  /** Índice del arma a empuñar (0 rifle, 1 pistola, 2 escopeta), si cambia. */
  readonly weapon?: number;
}

/** Lo que un luchador puede ver del mundo para decidir. */
export interface WorldView {
  readonly arena: Arena;
  readonly nowMs: number;
  readonly fighters: readonly Fighter[];
  readonly random: Random;
}

/**
 * Un luchador de la arena. La clase base guarda lo común: posición, vida,
 * armas, muerte y reaparición. Qué hacer en cada paso lo decide cada
 * subclase en think(): PlayerFighter con teclado y ratón, BotFighter con reglas.
 */
export abstract class Fighter {
  static readonly RADIUS = 12;
  static readonly MAX_HP = 100;

  protected pos: Vec;
  protected aimAngle = 0;

  private hpLeft = Fighter.MAX_HP;
  private respawnAtMs: number | undefined;
  private shieldUntilMs = 0;
  private weaponIndex: number;
  private readonly arsenal = WEAPONS.map((spec) => new Weapon(spec));

  protected constructor(
    readonly playerId: string,
    readonly color: string,
    spawn: Vec,
    startWeapon: number,
    /** Velocidad de movimiento en px/s. */
    protected readonly speed: number,
  ) {
    this.pos = spawn;
    this.weaponIndex = startWeapon;
  }

  get x(): number {
    return this.pos.x;
  }

  get y(): number {
    return this.pos.y;
  }

  get position(): Vec {
    return this.pos;
  }

  get aim(): number {
    return this.aimAngle;
  }

  get hp(): number {
    return this.hpLeft;
  }

  get alive(): boolean {
    return this.respawnAtMs === undefined;
  }

  get weapon(): Weapon {
    return this.arsenal[this.weaponIndex]!;
  }

  get weaponSlot(): number {
    return this.weaponIndex;
  }

  /** Se puede herir: está vivo y no tiene la protección de recién aparecido. */
  canBeHit(nowMs: number): boolean {
    return this.alive && nowMs >= this.shieldUntilMs;
  }

  shielded(nowMs: number): boolean {
    return this.alive && nowMs < this.shieldUntilMs;
  }

  /** Milisegundos para reaparecer, o 0 si está vivo. */
  respawnInMs(nowMs: number): number {
    return this.respawnAtMs === undefined ? 0 : Math.max(0, this.respawnAtMs - nowMs);
  }

  /** Decide qué hacer en este paso. */
  abstract think(dtMs: number, world: WorldView): Intent;

  /** Ejecuta la intención: cambia de arma, se mueve, apunta y, si puede, dispara. */
  act(intent: Intent, dtMs: number, world: WorldView): Projectile | undefined {
    if (intent.weapon !== undefined && intent.weapon >= 0 && intent.weapon < this.arsenal.length) {
      this.weaponIndex = intent.weapon;
    }

    const len = Math.hypot(intent.moveX, intent.moveY);
    if (len > 0) {
      const step = (this.speed * dtMs) / 1000 / len;
      this.pos = world.arena.move(this.pos, intent.moveX * step, intent.moveY * step, Fighter.RADIUS);
    }
    this.aimAngle = intent.aim;

    if (!intent.shoot || !this.weapon.canFire(world.nowMs)) return undefined;
    this.weapon.fire(world.nowMs);
    const spec = this.weapon.spec;
    const angle = this.aimAngle + (world.random.next() - 0.5) * spec.spread;
    const muzzle = Fighter.RADIUS + 4;
    return new Projectile(this.playerId, spec, this.pos.x + Math.cos(angle) * muzzle, this.pos.y + Math.sin(angle) * muzzle, angle);
  }

  /** Recibe un impacto. Devuelve el daño que realmente le quitó (no más que la vida que tenía). */
  takeHit(damage: number): number {
    const applied = Math.min(damage, this.hpLeft);
    this.hpLeft -= applied;
    return applied;
  }

  eliminate(respawnAtMs: number): void {
    this.respawnAtMs = respawnAtMs;
  }

  respawn(at: Vec, shieldUntilMs: number): void {
    this.pos = at;
    this.hpLeft = Fighter.MAX_HP;
    this.respawnAtMs = undefined;
    this.shieldUntilMs = shieldUntilMs;
  }
}
