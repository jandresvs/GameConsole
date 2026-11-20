import { Game, type GameContext } from "../core/Game";
import type { GameDefinition } from "../core/GameDefinition";

const TARGETS_TO_WIN = 3;
const SPEED_PX_PER_MS = 0.22;

/** Un cuadrado con posición, que sabe moverse sin salirse y detectar si toca a otro. */
class Box {
  constructor(
    public x: number,
    public y: number,
    readonly size: number,
    readonly color: string,
  ) {}

  moveBy(dx: number, dy: number, maxX: number, maxY: number): void {
    this.x = Math.min(Math.max(this.x + dx, 0), maxX - this.size);
    this.y = Math.min(Math.max(this.y + dy, 0), maxY - this.size);
  }

  touches(other: Box): boolean {
    return (
      this.x < other.x + other.size &&
      other.x < this.x + this.size &&
      this.y < other.y + other.size &&
      other.y < this.y + this.size
    );
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, this.size, this.size);
  }
}

/**
 * Juego de EJEMPLO, solo para desarrollo: no es uno de los tres de la entrega
 * y no aparece en la versión que se despliega. Muestra el contrato completo en
 * pocas líneas: mover un cuadrado con las flechas hasta tocar tres objetivos.
 */
export class ExampleGame extends Game {
  static readonly definition: GameDefinition = {
    id: "example",
    title: "Ejemplo",
    description: "Juego mínimo de referencia para escribir los demás. Solo aparece en desarrollo.",
    controls: "Flechas o WASD para moverse. Toca tres objetivos. Con T saltas a un lugar al azar.",
    localOnly: true, // "example" no es un juego de la entrega: no debe aparecer en las estadísticas
    create: (context) => new ExampleGame(context),
  };

  private readonly hero = new Box(20, 20, 26, "#f2b441");
  private target = new Box(0, 0, 18, "#4fc98a");
  private collected = 0;

  constructor(context: GameContext) {
    super("example", context, { width: 480, height: 300 });
  }

  protected players(): readonly string[] {
    return [this.playerId];
  }

  protected override matchStartData() {
    return { targets: TARGETS_TO_WIN };
  }

  protected onStart(): void {
    this.placeTarget();
  }

  protected update(dtMs: number): void {
    // Movimiento continuo: se consulta el teclado en cada cuadro.
    const k = this.keyboard;
    const dx = Number(k.isDown("ArrowRight") || k.isDown("KeyD")) - Number(k.isDown("ArrowLeft") || k.isDown("KeyA"));
    const dy = Number(k.isDown("ArrowDown") || k.isDown("KeyS")) - Number(k.isDown("ArrowUp") || k.isDown("KeyW"));
    const step = SPEED_PX_PER_MS * dtMs;
    this.hero.moveBy(dx * step, dy * step, this.width, this.height);

    if (this.hero.touches(this.target)) {
      this.collected += 1;
      this.emit("TARGET_COLLECTED", { index: this.collected, atMs: Math.round(this.elapsedMs) }, this.playerId);

      if (this.collected >= TARGETS_TO_WIN) {
        this.finish(this.playerId);
      } else {
        this.placeTarget();
      }
    }
  }

  // Acción puntual: llega una sola vez por pulsación.
  protected override onKeyDown(code: string): void {
    if (code !== "KeyT") return;
    this.hero.x = Math.random() * (this.width - this.hero.size);
    this.hero.y = Math.random() * (this.height - this.hero.size);
    this.emit("PLAYER_TELEPORTED", { x: Math.round(this.hero.x), y: Math.round(this.hero.y) }, this.playerId);
  }

  protected render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = "#0e1016";
    ctx.fillRect(0, 0, this.width, this.height);

    if (this.isRunning) this.target.draw(ctx);
    this.hero.draw(ctx);

    ctx.fillStyle = "#e8eaf0";
    ctx.font = "14px system-ui, sans-serif";
    ctx.textBaseline = "top";
    ctx.fillText(`Objetivos: ${this.collected} / ${TARGETS_TO_WIN}`, 10, 8);
    ctx.fillText(`Tiempo: ${(this.elapsedMs / 1000).toFixed(1)} s`, 10, 26);

    if (!this.isRunning) {
      ctx.font = "bold 22px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(this.collected >= TARGETS_TO_WIN ? "¡Completado!" : "Partida cerrada", this.width / 2, this.height / 2 - 12);
      ctx.textAlign = "start";
    }
  }

  private placeTarget(): void {
    const margin = 30;
    do {
      this.target = new Box(
        margin + Math.random() * (this.width - 2 * margin - 18),
        margin + Math.random() * (this.height - 2 * margin - 18),
        18,
        "#4fc98a",
      );
    } while (this.hero.touches(this.target));
  }
}
