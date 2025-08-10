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

function convertApply(state: GameState, ctx: MechanicContext): ApplyResult {
  const { playerId, payload } = ctx;
  const player = getPlayerById(state, playerId);
  if (!player) return { kind: "error", code: "PLAYER_NOT_FOUND", message: `Player ${playerId} not found` };
  const fromResourceId = payload?.fromResourceId;
  const toResourceId = payload?.toResourceId;
  const rate = Number(payload?.rate ?? 0);
  const times = Number(payload?.times ?? 1);
  if (!fromResourceId || !toResourceId) return { kind: "error", code: "INVALID_PAYLOAD", message: "fromResourceId/toResourceId required" };
  if (!(rate > 0) || !(Number.isFinite(rate))) return { kind: "error", code: "INVALID_RATE", message: "rate must be > 0" };
  if (!(times >= 1) || !Number.isFinite(times)) return { kind: "error", code: "INVALID_TIMES", message: "times must be >= 1" };
  // Optional: validate resources exist in catalog
  const hasFrom = state.resources.some(r => r.id === fromResourceId);
  const hasTo = state.resources.some(r => r.id === toResourceId);
  if (!hasFrom || !hasTo) return { kind: "error", code: "RESOURCE_NOT_FOUND", message: "Unknown resource id" };
  const cost = rate * times;
  const available = player.resources[fromResourceId] || 0;
  if (available < cost) return { kind: "error", code: "INSUFFICIENT_RESOURCES", message: `Need ${cost} ${fromResourceId}`, } as any;
  // Deduct and grant
  player.resources[fromResourceId] = available - cost;
  grantResource(player, toResourceId, times);
  return { kind: "ok" };
}

function chooseGainApply(state: GameState, ctx: MechanicContext): ApplyResult {
  const { playerId, payload } = ctx;
  const player = getPlayerById(state, playerId);
  if (!player) return { kind: "error", code: "PLAYER_NOT_FOUND", message: `Player ${playerId} not found` };
  const amount = Number(payload?.amount ?? 1);
  const allowed: string[] | undefined = Array.isArray(payload?.allowedResourceIds) ? payload.allowedResourceIds : undefined;
  if (!(amount > 0)) return { kind: "error", code: "INVALID_AMOUNT", message: "amount must be > 0" };
  const catalogIds = state.resources.map(r => r.id);
  const whitelist = allowed && allowed.length ? allowed.filter(id => catalogIds.includes(id)) : undefined;
  // If a single deterministic choice, apply directly
  if (whitelist && whitelist.length === 1) {
    grantResource(player, whitelist[0], amount);
    return { kind: "ok" };
  }
  // Otherwise, prompt the actor to choose
  return {
    kind: "pending",
    pending: {
      id: "",
      mechanicId: "chooseGainResource",
      fromPlayerId: playerId,
      toPlayerId: playerId,
      data: { amount, allowedResourceIds: whitelist ?? undefined },
    },
  };
}

function chooseGainResolve(state: GameState, pending: Pending, choice: any): ApplyResult {
  if (choice?.skip) return { kind: "ok" };
  const player = getPlayerById(state, pending.fromPlayerId);
  if (!player) return { kind: "error", code: "PLAYER_NOT_FOUND", message: "Player not found for resolve" };
  const amount = Number(pending.data?.amount ?? choice?.amount ?? 1);
  const resourceId = choice?.resourceId;
  if (!resourceId) return { kind: "error", code: "INVALID_CHOICE", message: "resourceId required" };
  const allowed: string[] | undefined = pending.data?.allowedResourceIds;
  if (allowed && allowed.length && !allowed.includes(resourceId)) {
    return { kind: "error", code: "RESOURCE_NOT_ALLOWED", message: "resourceId not in allowedResourceIds" };
  }
  const exists = state.resources.some(r => r.id === resourceId);
  if (!exists) return { kind: "error", code: "RESOURCE_NOT_FOUND", message: "Unknown resource id" };
  if (!(amount > 0)) return { kind: "error", code: "INVALID_AMOUNT", message: "amount must be > 0" };
  grantResource(player, resourceId, amount);
  return { kind: "ok" };
}

function harvestByPresenceApply(state: GameState, ctx: MechanicContext): ApplyResult {
  const { playerId, payload } = ctx;
  const player = getPlayerById(state, playerId);
  if (!player) return { kind: "error", code: "PLAYER_NOT_FOUND", message: `Player ${playerId} not found` };
  const resourceId = payload?.resourceId;
  const perWorker = Number(payload?.perWorker ?? 1);
  const spaceIds: string[] | undefined = Array.isArray(payload?.spaceIds) ? payload.spaceIds : undefined;
  if (!resourceId) return { kind: "error", code: "INVALID_PAYLOAD", message: "resourceId required" };
  if (!(perWorker > 0)) return { kind: "error", code: "INVALID_RATE", message: "perWorker must be > 0" };
  const exists = state.resources.some(r => r.id === resourceId);
  if (!exists) return { kind: "error", code: "RESOURCE_NOT_FOUND", message: "Unknown resource id" };
  const placed = player.placedWorkers || {};
  let workerCount = 0;
  if (spaceIds && spaceIds.length) {
    for (const id of spaceIds) {
      workerCount += Number(placed[id] || 0);
    }
  } else {
    for (const k of Object.keys(placed)) {
      workerCount += Number(placed[k] || 0);
    }
  }
  if (workerCount <= 0) return { kind: "noop" };
  const gain = perWorker * workerCount;
  grantResource(player, resourceId, gain);
  return { kind: "ok" };
}

export const builtinMechanics: MechanicSpec[] = [
  { id: "gain", displayName: "Gain Resource", description: "Gain N of a resource.", apply: gainApply },
  { id: "lose", displayName: "Lose Resource", description: "Lose N of a resource.", apply: loseApply },
  { id: "move", displayName: "Move Worker", description: "Move a worker between spaces.", apply: moveApply },
  { id: "interactive", displayName: "Interactive", description: "Create a pending action requiring a response.", apply: interactiveApply, resolve: interactiveResolve },
  { id: "chooseResourceFromPlayer", displayName: "Choose Resource From Player", description: "Target player gives you N of a chosen resource.", apply: chooseFromApply, resolve: chooseFromResolve },
  { id: "convert", displayName: "Convert Resource", description: "Exchange one resource for another at a fixed rate.", apply: convertApply },
  { id: "chooseGainResource", displayName: "Choose Gain Resource", description: "Gain N of a selected resource.", apply: chooseGainApply, resolve: chooseGainResolve },
  { id: "harvestByPresence", displayName: "Harvest By Presence", description: "Gain based on your placed workers across spaces.", apply: harvestByPresenceApply },
];
