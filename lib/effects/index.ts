import { getGameState, setGameState } from "@/lib/gameState";
import { Effect, GameState } from "@/types/game";
import "@/lib/mechanics"; // registers built-in mechanics on import
import { executeMechanic } from "@/lib/mechanics";

/**
 * Execute a game effect for a given player.
 * Handles both simple and interactive effects.
 */
export function executeEffect(effect: Effect, playerId: string) {
  const state = getGameState();
  if (!state) {
    console.error("No game state found when executing effect");
    return;
  }

  try {
    executeMechanic(state as GameState, effect.type, { playerId, payload: effect.payload });
  } catch (err) {
    console.warn("Unknown or failed mechanic execution:", effect.type, err);
  }

  setGameState(state as GameState);
}
