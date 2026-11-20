import type { EventSink, GameEvent } from "./GameEvent";

/** Entrega cada evento a varios destinos: por ejemplo, a GameStats y al registro en pantalla. */
export class FanOutEventSink implements EventSink {
  private readonly sinks: readonly EventSink[];

  constructor(...sinks: EventSink[]) {
    this.sinks = sinks;
  }

  send(event: GameEvent): void {
    for (const sink of this.sinks) sink.send(event);
  }
}
