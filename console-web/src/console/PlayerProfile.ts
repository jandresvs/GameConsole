const STORAGE_KEY = "gameconsole.playerId";
const DEFAULT_ID = "jugador";
const MAX_LENGTH = 20;

/**
 * El jugador humano de esta consola. Su id se usa como playerId en los eventos
 * y se recuerda en el navegador (todas las pestañas comparten el mismo nombre).
 */
export class PlayerProfile {
  private current: string;

  constructor() {
    this.current = PlayerProfile.clean(this.load() ?? DEFAULT_ID);
  }

  get id(): string {
    return this.current;
  }

  /** Cambia el nombre y devuelve el id que realmente quedó, ya normalizado. */
  rename(raw: string): string {
    this.current = PlayerProfile.clean(raw);
    try {
      localStorage.setItem(STORAGE_KEY, this.current);
    } catch {
      // Navegación privada o almacenamiento bloqueado: el nombre dura lo que dure la pestaña.
    }
    return this.current;
  }

  /** Deja un id corto, en minúsculas, sin tildes ni espacios: "José Luis" → "jose-luis". */
  static clean(raw: string): string {
    const id = raw
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9_-]/g, "")
      .slice(0, MAX_LENGTH);
    return id || DEFAULT_ID;
  }

  private load(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }
}
