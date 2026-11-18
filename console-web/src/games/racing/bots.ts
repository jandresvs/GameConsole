import type { BotProfile } from "./BotCar";

/** Los tres pilotos automáticos de racing, del más rápido al más lento. */
export const BOTS: readonly BotProfile[] = [
  { playerId: "bot-1", color: "#5aa9ff", topSpeed: 262, grip: 270, mistakeChance: 0.25 },
  { playerId: "bot-2", color: "#ff6fae", topSpeed: 252, grip: 245, mistakeChance: 0.3 },
  { playerId: "bot-3", color: "#7ddc6f", topSpeed: 240, grip: 220, mistakeChance: 0.35 },
];
