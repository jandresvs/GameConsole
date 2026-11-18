import { API } from "../config";
import { FanOutEventSink } from "../events/FanOutEventSink";
import { HttpEventSink } from "../events/HttpEventSink";
import { LocalEventSink } from "../events/LocalEventSink";
import type { GameDefinition } from "../games/core/GameDefinition";
import { ServiceMonitor, type ServiceInfo, type ServiceState } from "../services/ServiceMonitor";
import { DeliveryStatusView } from "./DeliveryStatusView";
import { el } from "./dom";
import { EventLogView } from "./EventLogView";
import { GameCatalog } from "./GameCatalog";
import { PlayerProfile } from "./PlayerProfile";
import { SessionManager } from "./SessionManager";

const SERVICES: readonly ServiceInfo[] = [
  { id: "ingest", name: "GameStats · ingest (Go)", healthUrl: `${API.ingest}/health` },
  { id: "analyzer", name: "GameStats · análisis (Scala)", healthUrl: `${API.analyzer}/health` },
  { id: "prolog", name: "Inteligencia (Prolog)", healthUrl: `${API.prolog}/health` },
];

const STATE_LABEL: Record<ServiceState, string> = {
  checking: "comprobando…",
  up: "en línea",
  down: "sin respuesta",
};

/**
 * La consola: la pantalla principal. Ofrece los juegos del catálogo, abre
 * partidas (varias a la vez, o en otra pestaña) y muestra el estado de los
 * servicios. No conoce ningún juego en particular: trabaja con GameDefinition
 * y con la clase base Game.
 *
 * Parámetros de la dirección:
 *   ?game=<id>  abre una partida de ese juego al cargar (así funciona "otra pestaña")
 *   ?demo       incluye el juego de ejemplo fuera del modo desarrollo
 */
export class ConsoleApp {
  private readonly params = new URLSearchParams(window.location.search);
  private readonly catalog = new GameCatalog(import.meta.env.DEV || this.params.has("demo"));
  private readonly player = new PlayerProfile();

  // Los eventos van a dos destinos: a GameStats (por el proxy) y al registro en pantalla.
  private readonly eventLog = new LocalEventSink();
  private readonly delivery = new HttpEventSink({ url: `${API.ingest}/events` });
  private readonly eventSink = new FanOutEventSink(this.delivery, this.eventLog);

  private readonly sessions = new SessionManager((game) => ({
    playerId: this.player.id,
    events: game.localOnly ? this.eventLog : this.eventSink,
  }));
  private readonly badges = new Map<string, HTMLElement>();
  private readonly monitor = new ServiceMonitor(SERVICES, (service, state) => this.showState(service, state));

  constructor(private readonly root: HTMLElement) {}

  mount(): void {
    this.root.replaceChildren(
      this.header(),
      this.servicesSection(),
      this.gamesSection(),
      this.section("Partidas abiertas", this.sessions.element),
      this.dashboardSection(),
      this.eventsSection(),
    );
    this.monitor.start();

    // Al cerrar o salir de la pestaña, las partidas en curso se dan por abandonadas
    // y lo que quede en cola se envía con una petición que sobrevive al cierre.
    window.addEventListener("pagehide", () => {
      this.sessions.abandonAll();
      this.delivery.flushOnExit();
    });

    const requested = this.catalog.find(this.params.get("game") ?? "");
    if (requested) this.sessions.open(requested);
  }

  private header(): HTMLElement {
    const input = el("input");
    input.type = "text";
    input.value = this.player.id;
    input.maxLength = 20;
    input.spellcheck = false;
    input.autocomplete = "off";
    input.id = "player-name";
    input.addEventListener("change", () => {
      input.value = this.player.rename(input.value);
    });

    const label = el("label", "", "Jugador");
    label.htmlFor = input.id;

    return el(
      "header",
      "top",
      el(
        "div",
        "",
        el("h1", "", "GameConsole"),
        el("p", "muted", "Tres juegos, partidas en paralelo y estadísticas en vivo desde GameStats."),
      ),
      el("div", "player", label, input),
    );
  }

  private servicesSection(): HTMLElement {
    const list = el("ul", "services");
    for (const service of SERVICES) {
      const badge = el("span", "badge checking", STATE_LABEL.checking);
      this.badges.set(service.id, badge);
      list.append(el("li", "", el("span", "", service.name), badge));
    }
    return this.section("Servicios", list);
  }

  private showState(service: ServiceInfo, state: ServiceState): void {
    const badge = this.badges.get(service.id);
    if (!badge) return;
    badge.className = `badge ${state}`;
    badge.textContent = STATE_LABEL[state];
  }

  private gamesSection(): HTMLElement {
    const grid = el("div", "games");
    for (const game of this.catalog.all()) grid.append(this.gameCard(game));
    return this.section("Juegos", grid);
  }

  private gameCard(game: GameDefinition): HTMLElement {
    const ready = game.create !== undefined;

    const play = el("button", "", "Nueva partida");
    play.disabled = !ready;
    play.addEventListener("click", () => this.sessions.open(game));

    const tab = el("button", "secondary", "Abrir en otra pestaña");
    tab.disabled = !ready;
    tab.addEventListener("click", () => window.open(this.urlFor(game), "_blank", "noopener"));

    return el(
      "article",
      "card",
      el("div", "card-head", el("h3", "", game.title), el("code", "", game.id)),
      el("p", "muted", game.description),
      el("p", "status", ready ? "Listo" : "En desarrollo"),
      el("div", "actions", play, tab),
    );
  }

  /** La dirección de esta misma consola que abre directamente una partida del juego. */
  private urlFor(game: GameDefinition): string {
    const url = new URL(window.location.href);
    url.searchParams.set("game", game.id);
    return url.toString();
  }

  private dashboardSection(): HTMLElement {
    return this.section(
      "Panel de estadísticas",
      el("p", "muted", "Pendiente. Mostrará las estadísticas por juego y generales que devuelva GameStats."),
    );
  }

  private eventsSection(): HTMLElement {
    return this.section(
      "Envío de eventos",
      new DeliveryStatusView(this.delivery).element,
      el("p", "muted small", "Últimos eventos emitidos por las partidas de esta pestaña (hora en UTC):"),
      new EventLogView(this.eventLog).element,
    );
  }

  private section(title: string, ...content: Node[]): HTMLElement {
    return el("section", "block", el("h2", "", title), ...content);
  }
}
