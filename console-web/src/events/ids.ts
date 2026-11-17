/**
 * Identificador único (UUID v4) para eventId y matchId.
 *
 * crypto.randomUUID() solo existe en "contextos seguros" (https o localhost).
 * Si la consola se despliega por http en una máquina con IP, no está disponible,
 * así que se arma el UUID a mano con getRandomValues, que sí funciona siempre.
 */
export function newId(): string {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6]! & 0x0f) | 0x40; // versión 4
  b[8] = (b[8]! & 0x3f) | 0x80; // variante RFC 4122
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
