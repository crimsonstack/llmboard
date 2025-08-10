import { getGameState, setGameState } from "@/lib/gameState";
import { Effect, GameState } from "@/types/game";
import "@/lib/mechanics"; // registers built-in mechanics on import
import { executeMechanic, getMechanic, ApplyResult } from "@/lib/mechanics";

/**
 * Execute a game effect for a given player.
 * Handles both simple and interactive effects.
 */
export function executeEffect(effect: Effect, playerId: string): ApplyResult | undefined {
  const state = getGameState();
  if (!state) {
    console.error("No game state found when executing effect");
    return;
  }

  try {
    const res = executeMechanic(state as GameState, effect.type, { playerId, payload: effect.payload });
    if (res?.kind === "pending") {
      const pending = res.pending;
      const effectId = pending.id && pending.id.length > 0 ? pending.id : `eff-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      state.pendingAction = {
        effectId,
        fromPlayerId: pending.fromPlayerId,
        toPlayerId: pending.toPlayerId || "",
        data: pending.data,
        mechanicId: pending.mechanicId,
      } as any;
      if (pending.toPlayerId) {
        state.priorityPlayerId = pending.toPlayerId;
      }
    }
    setGameState(state as GameState);
    return res;
  } catch (err) {
    console.warn("Unknown or failed mechanic execution:", effect.type, err);
    setGameState(state as GameState);
    return { kind: "error", code: "UNKNOWN_MECHANIC", message: String(err) } as ApplyResult;
  }
}
