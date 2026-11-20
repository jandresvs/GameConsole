import type { Random } from "../../core/Random";
import type { CombatMatch } from "../CombatMatch";
import { angleTo, distance } from "../geometry";
import type { PlayerInput } from "../PlayerFighter";

/**
 * Solo para pruebas: juega por el usuario con el mismo PlayerInput que
 * darían el teclado y el ratón. Busca al enemigo visible más cercano, le
 * apunta con un error que depende de `skill` y se mueve de lado.
 */
export class CombatAutopilot {
  private strafe = 1;
  private strafeUntil = 0;

  constructor(
    private readonly match: CombatMatch,
    private readonly random: Random,
    /** 0 = apunta muy mal, 1 = apunta perfecto. */
    private readonly skill = 0.7,
  ) {}

  input(): PlayerInput {
    const me = this.match.player;
    const now = this.match.nowMs;
    const enemies = this.match.fighters.filter((f) => f !== me && f.alive);
    const visible = enemies.filter((f) => this.match.arena.hasLineOfSight(me.position, f.position));
    const pool = visible.length > 0 ? visible : enemies;
    const target = pool.sort((a, b) => distance(me.position, a.position) - distance(me.position, b.position))[0];
    if (!target) return { up: false, down: false, left: false, right: false, shoot: false };

    if (now >= this.strafeUntil) {
      this.strafe = this.random.chance(0.5) ? 1 : -1;
      this.strafeUntil = now + this.random.between(600, 1400);
    }
    const toT = angleTo(me.position, target.position);
    const d = distance(me.position, target.position);
    const radial = visible.length === 0 || d > 260 ? 1 : d < 170 ? -1 : 0;
    const mx = Math.cos(toT) * radial + Math.cos(toT + Math.PI / 2) * this.strafe * 0.8;
    const my = Math.sin(toT) * radial + Math.sin(toT + Math.PI / 2) * this.strafe * 0.8;
    const error = (1 - this.skill) * 0.4 * (this.random.next() - 0.5) * 2;
    const aim = toT + error;

    return {
      right: mx > 0.3,
      left: mx < -0.3,
      down: my > 0.3,
      up: my < -0.3,
      aimAt: { x: me.x + Math.cos(aim) * 100, y: me.y + Math.sin(aim) * 100 },
      shoot: visible.includes(target),
      weapon: d < 140 ? 2 : 0,
    };
  }
}
