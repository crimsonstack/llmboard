import { getGameState, setGameState } from "@/lib/gameState";
import type { GameState } from "@/types/game";
import type { MechanicSpec, MechanicContext } from "./registry";

function gainApply(state: GameState, ctx: MechanicContext) {
  const { playerId, payload } = ctx;
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return;
  const { resourceId, amount = 1 } = payload || {};
  if (!resourceId) return;
  player.resources[resourceId] = (player.resources[resourceId] || 0) + amount;
}

function loseApply(state: GameState, ctx: MechanicContext) {
  const { playerId, payload } = ctx;
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return;
  const { resourceId, amount = 1 } = payload || {};
  if (!resourceId) return;
  const current = player.resources[resourceId] || 0;
  player.resources[resourceId] = Math.max(0, current - amount);
}

function moveApply(state: GameState, ctx: MechanicContext) {
  const { payload } = ctx;
  const { fromSpaceId, toSpaceId } = payload || {};
  if (!fromSpaceId || !toSpaceId) return;
  const fromSpace = state.board.find((s) => s.id === fromSpaceId);
  const toSpace = state.board.find((s) => s.id === toSpaceId);
  if (!fromSpace || !toSpace) return;
  if ((toSpace.currentWorkers || 0) >= toSpace.capacity) return; // can't move if full
  if ((fromSpace.currentWorkers || 0) <= 0) return; // no workers to move
  fromSpace.currentWorkers = (fromSpace.currentWorkers || 0) - 1;
  toSpace.currentWorkers = (toSpace.currentWorkers || 0) + 1;
}

// For now, "interactive" just creates a pending action as existing logic does.
function interactiveApply(state: GameState, ctx: MechanicContext) {
  const { playerId, payload } = ctx;
  const genId = () => {
    try {
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

  let targetPlayerId = payload?.targetPlayerId || "";
  if (!targetPlayerId) {
    if (state.mode === "hotseat" && state.players.length > 1) {
      const otherPlayer = state.players.find((p) => p.id !== playerId);
      if (otherPlayer) targetPlayerId = otherPlayer.id;
    } else if (state.mode === "online") {
      // require explicit target in online mode; leave empty so client/LLM must prompt
    }
  }

  state.pendingAction = {
    effectId,
    fromPlayerId: playerId,
    toPlayerId: targetPlayerId,
    data,
  };
  state.priorityPlayerId = targetPlayerId;
}

export const builtinMechanics: MechanicSpec[] = [
  { id: "gain", displayName: "Gain Resource", description: "Gain N of a resource.", apply: gainApply },
  { id: "lose", displayName: "Lose Resource", description: "Lose N of a resource.", apply: loseApply },
  { id: "move", displayName: "Move Worker", description: "Move a worker between spaces.", apply: moveApply },
  { id: "interactive", displayName: "Interactive", description: "Create a pending action requiring a response.", apply: interactiveApply },
];
