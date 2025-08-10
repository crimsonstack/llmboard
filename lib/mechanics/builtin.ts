import type { GameState } from "@/types/game";
import type { MechanicSpec, MechanicContext, ApplyResult, Pending } from "./registry";
import { getPlayerById, getSpaceById, listOtherPlayers } from "@/lib/domain/selectors";
import { grantResource, loseResource, transferResource } from "@/lib/domain/mutators";

function gainApply(state: GameState, ctx: MechanicContext): ApplyResult {
  const { playerId, payload } = ctx;
  const player = getPlayerById(state, playerId);
  if (!player) return { kind: "error", code: "PLAYER_NOT_FOUND", message: `Player ${playerId} not found` };
  const { resourceId, amount = 1 } = payload || {};
  if (!resourceId) return { kind: "error", code: "INVALID_PAYLOAD", message: "resourceId required" };
  grantResource(player, resourceId, amount);
  return { kind: "ok" };
}

function loseApply(state: GameState, ctx: MechanicContext): ApplyResult {
  const { playerId, payload } = ctx;
  const player = getPlayerById(state, playerId);
  if (!player) return { kind: "error", code: "PLAYER_NOT_FOUND", message: `Player ${playerId} not found` };
  const { resourceId, amount = 1 } = payload || {};
  if (!resourceId) return { kind: "error", code: "INVALID_PAYLOAD", message: "resourceId required" };
  loseResource(player, resourceId, amount);
  return { kind: "ok" };
}

function moveApply(state: GameState, ctx: MechanicContext): ApplyResult {
  const { payload } = ctx;
  const { fromSpaceId, toSpaceId } = payload || {};
  if (!fromSpaceId || !toSpaceId) return { kind: "error", code: "INVALID_PAYLOAD", message: "fromSpaceId/toSpaceId required" };
  const fromSpace = getSpaceById(state, fromSpaceId);
  const toSpace = getSpaceById(state, toSpaceId);
  if (!fromSpace || !toSpace) return { kind: "error", code: "SPACE_NOT_FOUND", message: "from/to space not found" };
  if ((toSpace.currentWorkers || 0) >= toSpace.capacity) return { kind: "error", code: "SPACE_FULL", message: "Destination full" }; // can't move if full
  if ((fromSpace.currentWorkers || 0) <= 0) return { kind: "error", code: "NO_WORKERS", message: "No workers to move" }; // no workers to move
  fromSpace.currentWorkers = (fromSpace.currentWorkers || 0) - 1;
  toSpace.currentWorkers = (toSpace.currentWorkers || 0) + 1;
  return { kind: "ok" };
}

// For now, "interactive" just creates a pending action as existing logic does.
function interactiveApply(state: GameState, ctx: MechanicContext): ApplyResult {
  const { playerId, payload } = ctx;
  const genId = () => {
    try {
      // @ts-ignore
      if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    } catch {}
    return `eff-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  };
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

  return {
    kind: "pending",
    pending: {
      id: "",
      mechanicId: "interactive",
      fromPlayerId: playerId,
      toPlayerId: targetPlayerId || undefined,
      data: { ...data, mechanicId: "interactive" },
    },
  };
}

function interactiveResolve(state: GameState, pending: Pending, choice: any): ApplyResult {
  // We currently support chooseResourceFromPlayer via interactive mechanic
  const type = (pending.mechanicId || pending.data?.type);
  if (type !== "chooseResourceFromPlayer" && type !== "interactive") {
    // default: nothing to resolve, treat as ok
    return { kind: "ok" };
  }
  if (choice?.skip) return { kind: "ok" };

  const giver = getPlayerById(state, (pending.toPlayerId || ""));
  const taker = getPlayerById(state, pending.fromPlayerId);
  if (!giver || !taker) return { kind: "error", code: "PLAYER_NOT_FOUND", message: "Players not found for resolve" };

  const amount = (pending.data?.amount != null ? Number(pending.data.amount) : (choice?.amount != null ? Number(choice.amount) : 1));
  const resourceId = choice?.resourceId;
  if (!resourceId) return { kind: "ok" }; // be permissive for generic interactive

  if (type === "interactive") {
    // Be permissive for backward-compat: if insufficient or invalid, just no-op success
    const tr = transferResource(giver, taker, resourceId, amount);
    return { kind: "ok" };
  }

  // Strict path for explicit chooseResourceFromPlayer handled by this resolver
  const tr = transferResource(giver, taker, resourceId, amount);
  if (!tr.ok) {
    return { kind: "error", code: tr.code, message: tr.message };
  }
  return { kind: "ok" };
}

function chooseFromApply(state: GameState, ctx: MechanicContext): ApplyResult {
  const { playerId, payload } = ctx;
  const type = "chooseResourceFromPlayer";
  const amount = payload?.amount != null ? Number(payload.amount) : 1;
  let targetPlayerId = payload?.targetPlayerId || "";
  if (!targetPlayerId) {
    if (state.mode === "hotseat" && state.players.length > 1) {
      const other = state.players.find(p => p.id !== playerId);
      if (other) targetPlayerId = other.id;
    }
  }
  return {
    kind: "pending",
    pending: {
      id: "",
      mechanicId: type,
      fromPlayerId: playerId,
      toPlayerId: targetPlayerId || undefined,
      data: { type, amount },
    },
  };
}

function chooseFromResolve(state: GameState, pending: Pending, choice: any): ApplyResult {
  if (choice?.skip) return { kind: "ok" };
  const giver = getPlayerById(state, (pending.toPlayerId || ""));
  const taker = getPlayerById(state, pending.fromPlayerId);
  if (!giver || !taker) return { kind: "error", code: "PLAYER_NOT_FOUND", message: "Players not found for resolve" };
  const amount = (pending.data?.amount != null ? Number(pending.data.amount) : (choice?.amount != null ? Number(choice.amount) : 1));
  const resourceId = choice?.resourceId;
  if (!resourceId) return { kind: "error", code: "INVALID_CHOICE", message: "resourceId required" };
  const tr = transferResource(giver, taker, resourceId, amount);
  if (!tr.ok) return { kind: "error", code: tr.code, message: tr.message };
  return { kind: "ok" };
}

export const builtinMechanics: MechanicSpec[] = [
  { id: "gain", displayName: "Gain Resource", description: "Gain N of a resource.", apply: gainApply },
  { id: "lose", displayName: "Lose Resource", description: "Lose N of a resource.", apply: loseApply },
  { id: "move", displayName: "Move Worker", description: "Move a worker between spaces.", apply: moveApply },
  { id: "interactive", displayName: "Interactive", description: "Create a pending action requiring a response.", apply: interactiveApply, resolve: interactiveResolve },
  { id: "chooseResourceFromPlayer", displayName: "Choose Resource From Player", description: "Target player gives you N of a chosen resource.", apply: chooseFromApply, resolve: chooseFromResolve },
];
