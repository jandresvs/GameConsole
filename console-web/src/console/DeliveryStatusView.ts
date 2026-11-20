import type { DeliveryStats, HttpEventSink } from "../events/HttpEventSink";
import { el } from "./dom";

const STATE_LABEL: Record<DeliveryStats["state"], string> = {
  idle: "al día",
  sending: "enviando…",
  retrying: "reintentando",
};

/** Muestra cómo va el envío de eventos a GameStats: cola, aceptados, rechazados y reintentos. */
export class DeliveryStatusView {
  readonly element: HTMLElement;
  private readonly badge = el("span", "badge checking", STATE_LABEL.idle);
  private readonly numbers = el("span", "", "");
  private readonly problem = el("p", "muted small", "");

  constructor(sink: HttpEventSink) {
    this.element = el("div", "delivery", el("div", "delivery-line", this.numbers, this.badge), this.problem);
    this.show(sink.stats());
    sink.subscribe((stats) => this.show(stats));
  }

  private show(stats: DeliveryStats): void {
    this.numbers.textContent =
      `En cola: ${stats.pending} · Aceptados por GameStats: ${stats.accepted} · ` +
      `Rechazados: ${stats.rejected} · Reintentos: ${stats.retries} · Perdidos: ${stats.dropped}`;

    this.badge.textContent = STATE_LABEL[stats.state];
    this.badge.className = `badge ${stats.state === "retrying" ? "down" : stats.pending === 0 ? "up" : "checking"}`;
    this.problem.textContent = stats.lastError ?? "";
  }
}
