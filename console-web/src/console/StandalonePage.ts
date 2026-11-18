import { BasicEventSender } from "../events/BasicEventSender";
import type { Game } from "../games/Game";
import { el } from "./dom";
import type { GameEntry } from "./GameCatalog";
import { PlayerProfile } from "./PlayerProfile";

/**
 * Un solo juego a pantalla completa, para "Abrir en otra pestaña" (?game=chase).
 * Cada pestaña es un programa aparte: tiene su propio emisor y sus propias
 * partidas, así que sus eventos no se mezclan con los de otras pestañas.
 */
export class StandalonePage {
  private readonly sender = new BasicEventSender();
  private readonly profile = new PlayerProfile();
  private readonly body = el("div", "match-body");
  private current: Game | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly entry: GameEntry,
  ) {}

  mount(): void {
    const again = el("button", "", "Nueva partida");
    again.addEventListener("click", () => this.newMatch());
    this.root.replaceChildren(
      el("header", "top", el("h1", "", this.entry.title), el("p", "muted", `Jugador: ${this.profile.name}`)),
      this.body,
      el("div", "actions", again),
    );
    window.addEventListener("pagehide", () => {
      this.current?.dispose();
      this.sender.flushOnExit();
    });
    this.newMatch();
  }

  private newMatch(): void {
    this.current?.dispose();
    const game = this.entry.create?.({ playerId: this.profile.name, sender: this.sender });
    if (!game) return;
    this.current = game;
    game.mount(this.body);
  }
}
