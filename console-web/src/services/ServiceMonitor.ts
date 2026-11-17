export type ServiceState = "checking" | "up" | "down";

export interface ServiceInfo {
  readonly id: string;
  readonly name: string;
  readonly healthUrl: string;
}

type Listener = (service: ServiceInfo, state: ServiceState) => void;

/**
 * Revisa cada cierto tiempo si los servicios responden (GET /health) y avisa
 * solo cuando el estado de alguno cambia.
 */
export class ServiceMonitor {
  private readonly states = new Map<string, ServiceState>();
  private timer: number | undefined;

  constructor(
    private readonly services: readonly ServiceInfo[],
    private readonly onChange: Listener,
    private readonly intervalMs = 5000,
  ) {}

  start(): void {
    if (this.timer !== undefined) return;
    void this.checkAll();
    this.timer = window.setInterval(() => void this.checkAll(), this.intervalMs);
  }

  stop(): void {
    window.clearInterval(this.timer);
    this.timer = undefined;
  }

  private async checkAll(): Promise<void> {
    await Promise.all(this.services.map((s) => this.check(s)));
  }

  private async check(service: ServiceInfo): Promise<void> {
    const state = (await this.isHealthy(service.healthUrl)) ? "up" : "down";
    if (this.states.get(service.id) !== state) {
      this.states.set(service.id, state);
      this.onChange(service, state);
    }
  }

  private async isHealthy(url: string): Promise<boolean> {
    try {
      const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(3000) });
      if (!res.ok) return false;
      const body: unknown = await res.json();
      return typeof body === "object" && body !== null && (body as { status?: unknown }).status === "ok";
    } catch {
      return false; // sin red, timeout o respuesta que no es JSON
    }
  }
}
