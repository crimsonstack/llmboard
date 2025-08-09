import { getGameState, setGameState } from "@/lib/gameState";
import { Effect, GameState } from "@/types/game";

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

  switch (effect.type) {
    case "gain":
      handleGain(state, playerId, effect.payload);
      break;
    case "lose":
      handleLose(state, playerId, effect.payload);
      break;
    case "move":
      handleMove(state, playerId, effect.payload);
      break;
    case "interactive":
      handleInteractive(state, playerId, effect.payload);
      break;
    default:
      console.warn("Unknown effect type:", effect.type);
  }

  setGameState(state as GameState);
}

function handleGain(state: GameState, playerId: string, payload: any) {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return;
  const resource = state.resources.find((r) => r.id === payload.resourceId);
  if (!resource) return;
  player.resources[payload.resourceId] =
    (player.resources[payload.resourceId] || 0) + (payload.amount || 1);
}

function handleLose(state: GameState, playerId: string, payload: any) {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return;
  const resource = state.resources.find((r) => r.id === payload.resourceId);
  if (!resource) return;
  const current = player.resources[payload.resourceId] || 0;
  player.resources[payload.resourceId] = Math.max(0, current - (payload.amount || 1));
}

function handleMove(state: GameState, playerId: string, payload: any) {
  const fromSpace = state.board.find((s) => s.id === payload.fromSpaceId);
  const toSpace = state.board.find((s) => s.id === payload.toSpaceId);
  if (!fromSpace || !toSpace) return;
  if ((toSpace.currentWorkers || 0) >= toSpace.capacity) return; // can't move if full
  if ((fromSpace.currentWorkers || 0) <= 0) return; // no workers to move
  fromSpace.currentWorkers = (fromSpace.currentWorkers || 0) - 1;
  toSpace.currentWorkers = (toSpace.currentWorkers || 0) + 1;
}

// Modified to auto-target the other player in hotseat mode if no targetPlayerId is provided
function handleInteractive(state: GameState, playerId: string, payload: any) {
  const genId = () => {
    try {
      // Prefer secure uuid if available
      // @ts-ignore
      if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    } catch {}
    return `eff-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  };
  const effectId = payload?.effectId || genId();
  const type = payload?.type || payload?.action || "interactive";
  const data = {
    type,
    ...(payload?.data || {}),
    ...(payload?.amount != null ? { amount: payload.amount } : {}),
    ...(payload?.resourceId ? { resourceId: payload.resourceId } : {}),
    ...(payload?.description ? { description: payload.description } : {}),
  };
// Determine target player: if hotseat mode and no targetPlayerId, pick the other player
  let targetPlayerId = payload?.targetPlayerId || "";
  if (!targetPlayerId && state.mode === "hotseat" && state.players.length > 1) {
    const otherPlayer = state.players.find((p) => p.id !== playerId);
    if (otherPlayer) {
      targetPlayerId = otherPlayer.id;
    }
  }

  state.pendingAction = {
    effectId,
    fromPlayerId: playerId,
    toPlayerId: targetPlayerId,
    data,
  };
  // Assign priority to the responder (who must act next)
  state.priorityPlayerId = targetPlayerId;
}
