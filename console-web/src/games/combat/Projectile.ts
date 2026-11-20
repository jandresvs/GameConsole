import type { WeaponSpec } from "./Weapon";

/** Un disparo en vuelo. Sabe de quién es y con qué arma salió, para armar los eventos al impactar. */
export class Projectile {
  private travelled = 0;
  private active = true;
  readonly vx: number;
  readonly vy: number;

  constructor(
    readonly ownerId: string,
    readonly weapon: WeaponSpec,
    public x: number,
    public y: number,
    angle: number,
  ) {
    this.vx = Math.cos(angle) * weapon.projectileSpeed;
    this.vy = Math.sin(angle) * weapon.projectileSpeed;
  }

  get alive(): boolean {
    return this.active;
  }

  /** Avanza dt segundos. Si se pasa de su alcance, se pierde. */
  step(dt: number): void {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.travelled += this.weapon.projectileSpeed * dt;
    if (this.travelled >= this.weapon.range) this.active = false;
  }

  stop(): void {
    this.active = false;
  }
}
