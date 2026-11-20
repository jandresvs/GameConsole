import { describe, expect, it } from "vitest";
import { PlayerProfile } from "./PlayerProfile";

describe("PlayerProfile.clean", () => {
  it("deja el nombre en minúsculas, sin tildes ni espacios", () => {
    expect(PlayerProfile.clean("  José Luis ")).toBe("jose-luis");
    expect(PlayerProfile.clean("Andrés_15")).toBe("andres_15");
  });

  it("quita símbolos y limita el largo a 20", () => {
    expect(PlayerProfile.clean("a!b@c#")).toBe("abc");
    expect(PlayerProfile.clean("x".repeat(40))).toHaveLength(20);
  });

  it("nunca devuelve un id vacío", () => {
    expect(PlayerProfile.clean("")).toBe("jugador");
    expect(PlayerProfile.clean("¡¿?!")).toBe("jugador");
  });

  it("no deja usar el playerId de la CPU ni de los bots", () => {
    expect(PlayerProfile.clean("CPU")).toBe("cpu_1");
    expect(PlayerProfile.clean("bot-2")).toBe("bot-2_1");
    expect(PlayerProfile.clean("cpus")).toBe("cpus");
  });
});
