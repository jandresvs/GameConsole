import type { EventSink, GameEvent } from "./GameEvent";

type Listener = (event: GameEvent) => void;

/**
 * TEMPORAL: EventSink que no envía nada a GameStats. Guarda los últimos eventos
 * y avisa a quien esté escuchando, para ver en la consola lo que emite un juego
 * mientras se desarrolla. Lo reemplaza la capa de eventos real (tarea A3).
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
