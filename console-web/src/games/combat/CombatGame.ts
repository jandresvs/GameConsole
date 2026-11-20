import { Game, type GameContext } from "../core/Game";
import type { GameDefinition } from "../core/GameDefinition";
import { Random } from "../core/Random";
import { laPlaza } from "./arenas";
import { BOTS } from "./bots";
import { CombatMatch, type CombatListener } from "./CombatMatch";
import { CombatRenderer } from "./CombatRenderer";
import type { Vec } from "./geometry";
import type { PlayerInput } from "./PlayerFighter";
import { WEAPONS } from "./Weapon";

const WIDTH = 760;
const HEIGHT = 460;
const PLAYER_COLOR = "#f2b441";
const WEAPON_KEYS: Record<string, number> = { Digit1: 0, Digit2: 1, Digit3: 2, Numpad1: 0, Numpad2: 1, Numpad3: 2 };

/**
 * Combat: todos contra todos en una arena, el usuario contra tres bots.
 *
 * Esta clase solo conecta piezas: lee teclado y ratón, se los pasa a
 * CombatMatch (las reglas), le pide a CombatRenderer que dibuje y convierte
 * lo que avisa la partida en los eventos del contrato de GameStats:
 *
 *   SHOT_FIRED        {weapon}                  quien dispara
 *   DAMAGE_DEALT      {target, amount, weapon}  quien acierta
 *   PLAYER_ELIMINATED {victimId, weapon}        quien elimina (no la víctima)
 *   MATCH_FINISHED    {winnerId}                el primero en llegar a 8
 */
export class CombatGame extends Game {
  static readonly definition: GameDefinition = {
    id: "combat",
    title: "Combat",
    description: "Todos contra todos en una arena con coberturas: tú contra tres bots. Gana el primero en llegar a 8 eliminaciones.",
    controls: "WASD o flechas para moverte · el ratón apunta y el clic dispara (o Espacio) · 1, 2, 3 o Q cambian de arma.",
    create: (context) => new CombatGame(context),
  };

  private readonly match: CombatMatch;
  private readonly renderer: CombatRenderer;
  private pointer: Vec | undefined;
  private pointerDown = false;
  private pendingWeapon: number | undefined;

  constructor(context: GameContext, random: Random = new Random()) {
    super("combat", context, { width: WIDTH, height: HEIGHT });
    this.match = new CombatMatch(laPlaza(), this.playerId, PLAYER_COLOR, BOTS, this.matchListener(), random);
    this.renderer = new CombatRenderer(this.match.arena, WIDTH, HEIGHT);
    this.listenToPointer();
  }

  protected players(): readonly string[] {
    return this.match.fighters.map((f) => f.playerId);
  }

  protected override matchStartData() {
    return { arena: this.match.arena.name, killsToWin: CombatMatch.KILLS_TO_WIN };
  }

  protected onStart(): void {
    // La partida ya quedó armada en el constructor; empieza con la cuenta regresiva.
  }

  protected update(dtMs: number): void {
    this.match.update(dtMs, this.readInput());
    this.pendingWeapon = undefined;
  }

  protected render(ctx: CanvasRenderingContext2D): void {
    this.renderer.draw(ctx, this.match, this.pointer);
  }

  protected override onKeyDown(code: string): void {
    if (code in WEAPON_KEYS) this.pendingWeapon = WEAPON_KEYS[code];
    if (code === "KeyQ") this.pendingWeapon = (this.match.player.weaponSlot + 1) % WEAPONS.length;
  }

  private readInput(): PlayerInput {
    const k = this.keyboard;
    return {
      up: k.isDown("ArrowUp") || k.isDown("KeyW"),
      down: k.isDown("ArrowDown") || k.isDown("KeyS"),
      left: k.isDown("ArrowLeft") || k.isDown("KeyA"),
      right: k.isDown("ArrowRight") || k.isDown("KeyD"),
      shoot: this.pointerDown || k.isDown("Space"),
      ...(this.pointer !== undefined && { aimAt: this.pointer }),
      ...(this.pendingWeapon !== undefined && { weapon: this.pendingWeapon }),
    };
  }

  /**
   * El ratón sobre el lienzo. Las coordenadas se pasan a las del canvas,
   * porque en pantalla puede verse más chico (max-width: 100%).
   * Con setPointerCapture, soltar el botón fuera del lienzo también se detecta.
   */
  private listenToPointer(): void {
    const canvas = this.canvas;
    canvas.style.cursor = "crosshair";
    const toArena = (e: PointerEvent): Vec => {
      const r = canvas.getBoundingClientRect();
      return { x: ((e.clientX - r.left) * canvas.width) / r.width, y: ((e.clientY - r.top) * canvas.height) / r.height };
    };
    canvas.addEventListener("pointermove", (e) => {
      this.pointer = toArena(e);
    });
    canvas.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      canvas.focus();
      canvas.setPointerCapture(e.pointerId);
      this.pointer = toArena(e);
      this.pointerDown = true;
    });
    canvas.addEventListener("pointerup", () => {
      this.pointerDown = false;
    });
    canvas.addEventListener("lostpointercapture", () => {
      this.pointerDown = false;
    });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  private matchListener(): CombatListener {
    return {
      onShot: (shooterId, weapon) => this.emit("SHOT_FIRED", { weapon }, shooterId),
      onDamage: (attackerId, target, amount, weapon) => this.emit("DAMAGE_DEALT", { target, amount, weapon }, attackerId),
      onElimination: (killerId, victimId, weapon) => this.emit("PLAYER_ELIMINATED", { victimId, weapon }, killerId),
      onFinished: (winnerId) => this.finish(winnerId),
    };
  }
}
