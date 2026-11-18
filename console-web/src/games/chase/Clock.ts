/**
 * El reloj del juego. Se inyecta para que las reglas dependan del tiempo sin
 * esperar de verdad en las pruebas (allí se usa un reloj manual).
 */
export interface Clock {
  /** Milisegundos desde un origen cualquiera; solo importan las diferencias. */
  now(): number;
  /** Espera `ms`. Se rechaza si la señal se cancela. */
  sleep(ms: number, signal?: AbortSignal): Promise<void>;
}

export class SystemClock implements Clock {
  now(): number {
    return performance.now();
  }

  sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) return reject(signal.reason);
      const timer = setTimeout(resolve, ms);
      signal?.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          reject(signal.reason);
        },
        { once: true },
      );
    });
  }
}
