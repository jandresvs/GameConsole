import type { GameEvent } from "../events/GameEvent";
import type { LocalEventSink } from "../events/LocalEventSink";
import { el } from "./dom";

const MAX_LINES = 40;

/** Muestra los últimos eventos que emiten las partidas de esta pestaña, para revisarlos mientras se juega. */
export class EventLogView {
  readonly element = el("pre", "output log", "Todavía no se ha emitido ningún evento.");
  private readonly lines: string[] = [];

  constructor(sink: LocalEventSink) {
    sink.subscribe((event) => this.add(event));
  }

  private add(event: GameEvent): void {
    this.lines.push(EventLogView.format(event));
    if (this.lines.length > MAX_LINES) this.lines.shift();
    this.element.textContent = this.lines.join("\n");
    this.element.scrollTop = this.element.scrollHeight;
  }

  private static format(e: GameEvent): string {
    const time = e.timestamp.slice(11, 23);
    const match = `…${e.matchId.slice(-8)}`;
    const player = e.playerId ?? "–";
    const data = e.data ? ` ${JSON.stringify(e.data)}` : "";
    return `${time}  ${e.gameId} ${match}  ${e.type}  ${player}${data}`;
  }
}
