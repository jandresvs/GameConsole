import type { EventSink, GameEvent } from "./GameEvent";

type Listener = (event: GameEvent) => void;

/**
 * EventSink que no envía nada: guarda los últimos eventos y avisa a quien esté
 * escuchando. La consola lo usa para mostrar en pantalla lo que emiten las
 * partidas, junto al envío real (HttpEventSink). Para el juego de ejemplo es
 * el único destino.
 */
export class LocalEventSink implements EventSink {
  private readonly recent: GameEvent[] = [];
  private readonly listeners = new Set<Listener>();

  constructor(private readonly capacity = 200) {}

  send(event: GameEvent): void {
    this.recent.push(event);
    if (this.recent.length > this.capacity) this.recent.shift();
    for (const listener of this.listeners) listener(event);
  }

  subscribe(listener: Listener): void {
    this.listeners.add(listener);
  }

  snapshot(): readonly GameEvent[] {
    return this.recent;
  }
}
