import { API } from "../config";
import type { EventSender, GameEvent } from "./types";

/**
 * PROVISIONAL: emisor mínimo para poder probar los juegos de punta a punta.
 * La capa de eventos definitiva es la tarea A3 (contextos/06-reparto.md) y lo
 * reemplaza sin tocar los juegos, que solo dependen de EventSender.
 *
 * Qué hace: encola, envía por lotes en segundo plano (un POST a la vez, así no
 * se amontonan) y, si falla la red o el ingest responde 5xx, vuelve a encolar el
 * mismo lote CON LOS MISMOS eventId (Go descarta los repetidos, reintentar es seguro).
 */
export class BasicEventSender implements EventSender {
  private queue: GameEvent[] = [];
  private inFlight = false;
  private failures = 0;
  private timer: number | undefined;

  constructor(
    private readonly url = `${API.ingest}/events`,
    private readonly intervalMs = 400,
    private readonly maxBatch = 100,
  ) {}

  send(event: GameEvent): void {
    this.queue.push(event);
    this.schedule(this.intervalMs);
  }

  /** Cuántos eventos esperan salir (útil para pruebas y diagnóstico). */
  get pending(): number {
    return this.queue.length;
  }

  /** Al cerrar la pestaña: lo que quede se manda con sendBeacon, que sobrevive al cierre. */
  flushOnExit(): void {
    if (this.queue.length === 0) return;
    const blob = new Blob([JSON.stringify(this.queue)], { type: "application/json" });
    if (navigator.sendBeacon(this.url, blob)) this.queue = [];
  }

  private schedule(delayMs: number): void {
    if (this.timer !== undefined || this.inFlight) return;
    this.timer = window.setTimeout(() => {
      this.timer = undefined;
      void this.flush();
    }, delayMs);
  }

  private async flush(): Promise<void> {
    if (this.inFlight || this.queue.length === 0) return;
    this.inFlight = true;
    const batch = this.queue.splice(0, this.maxBatch);
    try {
      const res = await fetch(this.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(batch),
      });
      if (res.status >= 500) throw new Error(`ingest respondió ${res.status}`);
      if (!res.ok) {
        // 4xx: el cuerpo en sí es inválido; reenviarlo igual no ayuda.
        console.error(`GameStats rechazó el lote completo (${res.status})`, batch);
      } else {
        const body = (await res.json()) as { rejected?: unknown };
        if (body.rejected) console.warn("GameStats rechazó algunos eventos", body.rejected);
      }
      this.failures = 0;
    } catch (error) {
      this.queue.unshift(...batch); // al frente: MATCH_FINISHED tiene que seguir siendo el último
      this.failures += 1;
      console.warn("No se pudo enviar a GameStats; se reintenta", error);
    } finally {
      this.inFlight = false;
    }
    if (this.queue.length > 0) this.schedule(Math.min(this.intervalMs * 2 ** this.failures, 10_000));
  }
}
