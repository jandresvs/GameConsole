import type { EventSink, GameEvent } from "./GameEvent";

/** Cómo va el envío, para mostrarlo en la consola. */
export interface DeliveryStats {
  /** Eventos en cola que GameStats todavía no ha confirmado. */
  readonly pending: number;
  /** Eventos que GameStats aceptó. */
  readonly accepted: number;
  /** Eventos que GameStats rechazó por formato. No se reintentan: saldrían rechazados otra vez. */
  readonly rejected: number;
  /** Envíos que fallaron y se volvieron a intentar. */
  readonly retries: number;
  /** Eventos perdidos: la cola se llenó o GameStats rechazó la petición entera. */
  readonly dropped: number;
  readonly state: "idle" | "sending" | "retrying";
  /** El último problema de comunicación, si lo hubo. */
  readonly lastError?: string;
}

export interface HttpEventSinkOptions {
  /** Dirección de POST /events, pasando por el proxy. */
  readonly url: string;
  /** Cuánto se acumula antes de enviar un lote. */
  readonly flushIntervalMs?: number;
  /** Máximo de eventos por petición. */
  readonly maxBatchSize?: number;
  /** Máximo de eventos en cola. Al llenarse, los eventos nuevos se pierden. */
  readonly maxQueueSize?: number;
  /** Espera antes del primer reintento; se duplica en cada fallo seguido. */
  readonly retryBaseMs?: number;
  /** Tope de la espera entre reintentos. */
  readonly retryMaxMs?: number;
  /** Tiempo máximo de una petición antes de darla por fallida. */
  readonly requestTimeoutMs?: number;
  /** Para las pruebas: reemplaza a fetch. */
  readonly fetchFn?: typeof fetch;
}

/** Lo que responde GameStats (ingest) a POST /events con 202. */
interface IngestResponse {
  accepted?: number;
  rejected?: number;
  errors?: Array<{ index: number; eventId?: string; problems: string[] }>;
}

type Outcome = "done" | "retry";

/** El navegador solo deja ~64 KB en peticiones que sobreviven al cierre de la página. */
const EXIT_CHUNK_BYTES = 60_000;

const JSON_HEADERS = { "Content-Type": "application/json" };

/**
 * EventSink que envía los eventos a GameStats sin frenar los juegos.
 *
 * Es el equivalente del `sender` del simulador de GameStats, con lo que le
 * hace falta a un juego real:
 *
 *  - send() solo agrega a una cola y vuelve: el juego nunca espera a la red.
 *  - Los eventos acumulados se envían juntos, en un arreglo, cada pocos
 *    milisegundos (POST /events acepta lotes).
 *  - Hay una sola petición en curso a la vez y la cola es FIFO, así que los
 *    eventos llegan a GameStats en el orden en que se emitieron.
 *  - Si la red falla o GameStats no responde, el mismo lote se reintenta con
 *    esperas crecientes. Los eventId no cambian, y GameStats descarta los
 *    repetidos, así que reintentar no duplica nada.
 *  - Al cerrar la pestaña, flushOnExit() manda lo pendiente con una petición
 *    que el navegador deja terminar aunque la página desaparezca.
 */
export class HttpEventSink implements EventSink {
  private readonly url: string;
  private readonly flushIntervalMs: number;
  private readonly maxBatchSize: number;
  private readonly maxQueueSize: number;
  private readonly retryBaseMs: number;
  private readonly retryMaxMs: number;
  private readonly requestTimeoutMs: number;
  private readonly fetchFn: typeof fetch;

  private readonly queue: GameEvent[] = [];
  private readonly listeners = new Set<(stats: DeliveryStats) => void>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private sending = false;
  private retryDelayMs: number;

  private accepted = 0;
  private rejected = 0;
  private retries = 0;
  private dropped = 0;
  private failing = false;
  private lastError: string | undefined;

  constructor(options: HttpEventSinkOptions) {
    this.url = options.url;
    this.flushIntervalMs = options.flushIntervalMs ?? 250;
    this.maxBatchSize = options.maxBatchSize ?? 200;
    this.maxQueueSize = options.maxQueueSize ?? 10_000;
    this.retryBaseMs = options.retryBaseMs ?? 500;
    this.retryMaxMs = options.retryMaxMs ?? 8_000;
    this.requestTimeoutMs = options.requestTimeoutMs ?? 8_000;
    // fetch no se puede guardar "suelto": fuera de window falla. Por eso va envuelto en una flecha.
    this.fetchFn = options.fetchFn ?? ((input, init) => fetch(input, init));
    this.retryDelayMs = this.retryBaseMs;
  }

  /** Encola el evento y vuelve de inmediato. Nunca lanza errores. */
  send(event: GameEvent): void {
    if (this.queue.length >= this.maxQueueSize) {
      this.dropped += 1;
      this.lastError = "cola llena: se están perdiendo eventos";
    } else {
      this.queue.push(event);
      this.schedule(this.flushIntervalMs);
    }
    this.notify();
  }

  /**
   * Envía todo lo pendiente con peticiones `keepalive`, que el navegador
   * termina aunque la página se cierre. Se llama al salir de la pestaña.
   *
   * No vacía la cola: si la página en realidad sigue viva, el envío normal
   * continúa y GameStats descarta lo que ya había recibido.
   */
  flushOnExit(): void {
    for (const chunk of this.exitChunks()) {
      try {
        const request = this.fetchFn(this.url, {
          method: "POST",
          headers: JSON_HEADERS,
          body: JSON.stringify(chunk),
          keepalive: true,
        });
        request.catch(() => undefined); // la página se está cerrando: no hay nada más que hacer
      } catch {
        // idem
      }
    }
  }

  stats(): DeliveryStats {
    return {
      pending: this.queue.length,
      accepted: this.accepted,
      rejected: this.rejected,
      retries: this.retries,
      dropped: this.dropped,
      state: this.failing ? "retrying" : this.sending ? "sending" : "idle",
      ...(this.lastError !== undefined && { lastError: this.lastError }),
    };
  }

  /** Avisa cada vez que cambian los números del envío. */
  subscribe(listener: (stats: DeliveryStats) => void): void {
    this.listeners.add(listener);
  }

  private schedule(delayMs: number): void {
    if (this.timer !== undefined || this.sending) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.flush();
    }, delayMs);
  }

  private async flush(): Promise<void> {
    if (this.sending || this.queue.length === 0) return;

    this.sending = true;
    this.notify();
    const batch = this.queue.slice(0, this.maxBatchSize);
    const outcome = await this.post(batch);
    this.sending = false;

    if (outcome === "retry") {
      // El lote se queda al frente de la cola y se vuelve a enviar igual.
      this.retries += 1;
      this.failing = true;
      this.schedule(this.retryDelayMs);
      this.retryDelayMs = Math.min(this.retryDelayMs * 2, this.retryMaxMs);
    } else {
      this.queue.splice(0, batch.length);
      this.failing = false;
      this.retryDelayMs = this.retryBaseMs;
      if (this.queue.length > 0) this.schedule(0);
    }
    this.notify();
  }

  private async post(batch: readonly GameEvent[]): Promise<Outcome> {
    let res: Response;
    try {
      res = await this.fetchFn(this.url, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify(batch),
        signal: AbortSignal.timeout(this.requestTimeoutMs),
      });
    } catch (err) {
      this.lastError = `sin conexión con GameStats (${describe(err)})`;
      return "retry";
    }

    if (res.ok) {
      const body = (await res.json().catch(() => null)) as IngestResponse | null;
      this.accepted += body?.accepted ?? batch.length;
      this.rejected += body?.rejected ?? 0;
      for (const error of body?.errors ?? []) {
        console.warn(`GameStats rechazó el evento ${error.eventId ?? `#${error.index}`}: ${error.problems.join("; ")}`);
      }
      this.lastError = undefined;
      return "done";
    }

    // Fallos pasajeros: el servicio está caído, saturado o tardó demasiado.
    if (res.status === 408 || res.status === 429 || res.status >= 500) {
      this.lastError = `GameStats respondió ${res.status}`;
      return "retry";
    }

    // Cualquier otro 4xx dice que la petición entera es inválida: repetirla daría lo mismo.
    this.dropped += batch.length;
    this.lastError = `GameStats rechazó la petición (${res.status}); se descartaron ${batch.length} eventos`;
    console.error(this.lastError);
    return "done";
  }

  /** Parte lo pendiente en trozos que quepan en una petición keepalive. */
  private exitChunks(): GameEvent[][] {
    const encoder = new TextEncoder();
    const chunks: GameEvent[][] = [];
    let current: GameEvent[] = [];
    let bytes = 2; // los corchetes del arreglo

    for (const event of this.queue) {
      const size = encoder.encode(JSON.stringify(event)).length + 1; // + la coma
      if (current.length > 0 && bytes + size > EXIT_CHUNK_BYTES) {
        chunks.push(current);
        current = [];
        bytes = 2;
      }
      current.push(event);
      bytes += size;
    }
    if (current.length > 0) chunks.push(current);
    return chunks;
  }

  private notify(): void {
    const stats = this.stats();
    for (const listener of this.listeners) listener(stats);
  }
}

function describe(err: unknown): string {
  return err instanceof Error ? err.name : String(err);
}
