/** Teclas que el navegador usaría para desplazar la página: se le quitan mientras se juega. */
const SCROLL_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"]);

/**
 * El teclado de UNA partida. Escucha solo en el elemento de esa partida, así
 * que las teclas llegan únicamente a la que tiene el foco: dos partidas
 * abiertas en la misma página no se roban las teclas entre sí.
 *
 * Las teclas se identifican con KeyboardEvent.code ("ArrowUp", "KeyW", "Space"),
 * que no depende de la distribución del teclado.
 */
export class Keyboard {
  private readonly down = new Set<string>();
  private readonly abort = new AbortController();

  constructor(target: HTMLElement, onPress: (code: string) => void) {
    const options = { signal: this.abort.signal };

    target.addEventListener(
      "keydown",
      (e) => {
        if (SCROLL_KEYS.has(e.code)) e.preventDefault();
        if (e.repeat) return; // mantener presionada no cuenta como pulsar otra vez
        this.down.add(e.code);
        onPress(e.code);
      },
      options,
    );
    target.addEventListener("keyup", (e) => this.down.delete(e.code), options);
    // Al perder el foco no llega el keyup: sin esto una tecla quedaría "pegada".
    target.addEventListener("blur", () => this.down.clear(), options);
  }

  /** ¿Está presionada ahora? Para movimiento continuo, consultado en update(). */
  isDown(code: string): boolean {
    return this.down.has(code);
  }

  dispose(): void {
    this.abort.abort();
    this.down.clear();
  }
}
