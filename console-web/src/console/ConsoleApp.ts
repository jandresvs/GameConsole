import { API } from "../config";
import { BasicEventSender } from "../events/BasicEventSender";
import type { Game, GameSettingsForm } from "../games/Game";
import { ConnectionTest } from "../services/ConnectionTest";
import { ServiceMonitor, type ServiceInfo, type ServiceState } from "../services/ServiceMonitor";
import { el } from "./dom";
import { Dashboard } from "../dashboard/Dashboard";
import { GameCatalog, type GameEntry } from "./GameCatalog";
import { PlayerProfile } from "./PlayerProfile";

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
 * La consola: la pantalla principal desde la que se eligen los juegos.
 * Por ahora es el esqueleto: muestra el estado de los servicios, el catálogo
 * (sin juegos jugables todavía) y una prueba de conexión temporal.
 */
export class ConsoleApp {
  private readonly catalog = new GameCatalog();
  private readonly connectionTest = new ConnectionTest();
  private readonly badges = new Map<string, HTMLElement>();
  private readonly monitor = new ServiceMonitor(SERVICES, (service, state) => this.showState(service, state));
  private readonly profile = new PlayerProfile();
  private readonly sender = new BasicEventSender();
  private readonly running = new Set<Game>();
  private readonly matchesEl = el("div", "matches");
  private readonly dashboard = new Dashboard(this.catalog.all().map((game) => game.id));

  constructor(private readonly root: HTMLElement) {}

  mount(): void {
    this.root.replaceChildren(
      this.header(),
      this.servicesSection(),
      this.gamesSection(),
      this.matchesSection(),
      this.dashboardSection(),
      this.connectionSection(),
    );
    this.monitor.start();
    this.dashboard.start();
    // Al cerrar la pestaña, las partidas abiertas se cierran con MATCH_FINISHED y se vacía la cola de eventos.
    window.addEventListener("pagehide", () => {
      for (const game of this.running) game.dispose();
      this.sender.flushOnExit();
    });
  }

  private header(): HTMLElement {
    const name = el("input", "player-name");
    name.value = this.profile.name;
    name.maxLength = 24;
    name.setAttribute("aria-label", "Nombre del jugador");
    name.addEventListener("change", () => {
      this.profile.set(name.value);
      name.value = this.profile.name;
    });
    return el(
      "header",
      "top",
      el("h1", "", "GameConsole"),
      el("p", "muted", "Tres juegos, partidas en paralelo y estadísticas en vivo desde GameStats."),
      el("label", "muted", "Jugador: ", name),
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

  private gameCard(game: GameEntry): HTMLElement {
    const play = el("button", "", "Nueva partida");
    const tab = el("button", "secondary", "Abrir en otra pestaña");
    // Se habilitan cuando el juego esté implementado (game.status === "listo").
    play.disabled = tab.disabled = game.status !== "listo";
    const form = game.settingsForm?.();
    play.addEventListener("click", () => this.startMatch(game, form));
    tab.addEventListener("click", () => window.open(`${location.pathname}?game=${game.id}`, "_blank"));

    return el(
      "article",
      "card",
      el("div", "card-head", el("h3", "", game.title), el("code", "", game.id)),
      el("p", "muted", game.description),
      el("p", "status", game.status === "listo" ? "Listo" : "En desarrollo"),
      ...(form ? [form.element] : []),
      el("div", "actions", play, tab),
    );
  }

  private matchesSection(): HTMLElement {
    return this.section("Partidas en curso", this.matchesEl);
  }

  /** Abre una partida nueva debajo de las demás; cada una tiene su propio matchId. */
  private startMatch(entry: GameEntry, form?: GameSettingsForm): void {
    const game = entry.create?.({ playerId: this.profile.name, sender: this.sender }, form);
    if (!game) return;
    this.running.add(game);

    const body = el("div", "match-body");
    const code = el("code", "", game.matchId);
    game.onMatchIdChange = (id) => {
      code.textContent = id; // un juego con niveles abre partidas nuevas en la misma tarjeta
    };
    const close = el("button", "secondary", "Cerrar");
    const card = el(
      "article",
      "card match",
      el("div", "card-head", el("h3", "", entry.title), code),
      body,
      el("div", "actions", close),
    );
    close.addEventListener("click", () => {
      game.dispose();
      this.running.delete(game);
      card.remove();
    });
    this.matchesEl.prepend(card);
    game.mount(body);
  }

  private dashboardSection(): HTMLElement {
    // Los números vienen de GameStats (se consultan cada 2 s); la consola no calcula nada.
    return this.section("Panel de estadísticas", this.dashboard.element());
  }

  private connectionSection(): HTMLElement {
    const output = el("pre", "output", "Aún no se ha ejecutado.");
    const button = el("button", "secondary", "Enviar evento de prueba");

    button.addEventListener("click", () => {
      button.disabled = true;
      output.textContent = "Enviando…";
      void this.connectionTest.run().then((result) => {
        output.textContent = result.lines.join("\n");
        output.className = `output ${result.ok ? "ok" : "fail"}`;
        button.disabled = false;
      });
    });

    return this.section(
      "Prueba de conexión (temporal)",
      el(
        "p",
        "muted",
        "Envía una partida mínima del juego ficticio «prueba» a GameStats, pasando por el proxy. " +
          "Sirve para comprobar el esqueleto y se quitará cuando exista la capa de eventos.",
      ),
      button,
      output,
    );
  }

  private section(title: string, ...content: Node[]): HTMLElement {
    return el("section", "block", el("h2", "", title), ...content);
  }
}
