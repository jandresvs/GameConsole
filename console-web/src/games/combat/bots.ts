import type { BotProfile } from "./BotFighter";

/** Los tres bots de combat: cada uno con su arma y su nivel de puntería. */
export const BOTS: readonly BotProfile[] = [
  { playerId: "bot-1", color: "#5aa9ff", weapon: 0, aimError: 0.1, reactionMs: 450, speed: 150 },
  { playerId: "bot-2", color: "#ff6fae", weapon: 2, aimError: 0.08, reactionMs: 400, speed: 160 },
  { playerId: "bot-3", color: "#7ddc6f", weapon: 1, aimError: 0.16, reactionMs: 550, speed: 145 },
];
