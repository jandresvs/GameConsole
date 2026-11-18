const KEY = "gameconsole.player";
const RESERVED = "cpu"; // la CPU usa este playerId; el usuario no puede llamarse igual

/**
 * El nombre del usuario, que viaja como playerId en los eventos. Se guarda en el
 * navegador (localStorage) para no pedirlo cada vez; si no hay almacenamiento, vive en memoria.
 */
export class PlayerProfile {
  private current: string;

  constructor() {
    this.current = PlayerProfile.clean(PlayerProfile.read() ?? "");
  }

  get name(): string {
    return this.current;
  }

  set(raw: string): void {
    this.current = PlayerProfile.clean(raw);
    try {
      localStorage.setItem(KEY, this.current);
    } catch {
      /* sin almacenamiento: queda solo en memoria */
    }
  }

  /** Sin espacios sobrantes, no vacío y distinto del playerId de la CPU. */
  private static clean(raw: string): string {
    const name = raw.trim().slice(0, 24) || "jugador";
    return name.toLowerCase() === RESERVED ? `${name}_1` : name;
  }

  private static read(): string | null {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  }
}
