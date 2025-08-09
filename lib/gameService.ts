import { getGameState, setGameState } from "@/lib/gameState";
import { executeEffect } from "@/lib/effects";
import { recallAllWorkers, hasAnyPlacedWorkers } from "@/lib/recall";
import { GameState } from "@/types/game";

export type ServiceResult =
  | { ok: true; state: GameState }
  | { ok: false; code: string; message: string; state?: GameState; [key: string]: any };

function advanceToNextPlayer(state: GameState, afterPlayerId?: string) {
  const players = state.players;
  if (!players || players.length === 0) return;
  const baseId = afterPlayerId || state.activePlayerId;
  const currentIndex = players.findIndex((p) => p.id === baseId);
  const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % players.length : 0;
  state.activePlayerId = players[nextIndex].id;
  // Increment turn counter when we wrap back to the first player
  if (nextIndex === 0) state.currentTurn += 1;
}

export async function placeWorkerAction(playerId: string, spaceId: string): Promise<ServiceResult> {

  const state = getGameState();

  if (!state || state.players.length === 0 || state.board.length === 0) {
    return {
      ok: false,
      code: "GAME_NOT_INITIALIZED",
      message: "The game state is empty or not initialized. Please start a new game.",
      state,
    };
  }
  if (state.pendingAction) {
    return {
      ok: false,
      code: "PENDING_ACTION",
      message: "Resolve the pending action before placing a worker.",
      state,
    };
  }

  const player = state.players.find((p) => p.id === playerId);
  if (!player) {
    return {
      ok: false,
      code: "PLAYER_NOT_FOUND",
      message: `No player found with id '${playerId}'.`,
      receivedPlayerId: playerId,
      validPlayerIds: state.players.map((p) => p.id),
      state,
    };
  }

  const space = state.board.find((s) => s.id === spaceId);
  if (!space) {
    return {
      ok: false,
      code: "SPACE_NOT_FOUND",
      message: `No board space found with id '${spaceId}'.`,
      receivedSpaceId: spaceId,
      validSpaceIds: state.board.map((s) => s.id),
      state,
    };
  }

  if (state.activePlayerId !== playerId) {
    return {
      ok: false,
      code: "NOT_YOUR_TURN",
      message: `It is not player '${playerId}' turn. Active player is '${state.activePlayerId}'.`,
      state,
    };
  }

  const workersPlaced = space.currentWorkers ?? 0;
  if (workersPlaced >= space.capacity) {
    return {
      ok: false,
      code: "SPACE_FULL",
      message: `The space '${space.name}' is full (${workersPlaced}/${space.capacity}).`,
      state,
    };
  }

  if (player.workers <= 0) {
    return {
      ok: false,
      code: "NO_WORKERS_LEFT",
      message: `Player '${player.name}' has no workers left to place.`,
      state,
    };
  }

  // Place worker
  space.currentWorkers = workersPlaced + 1;
  player.workers -= 1;
  player.placedWorkers = player.placedWorkers || {};
  player.placedWorkers[spaceId] = (player.placedWorkers[spaceId] || 0) + 1;

  // Trigger effect
  try {
    executeEffect(space.effect as any, playerId);
  } catch (err) {
    console.error("Error executing effect:", err);
    // Continue even if effect fails to avoid losing placement
  }

  // If the effect created any pendingAction, do NOT advance or switch active player.
  // Turn advances only after response in respondAction.
  if (state.pendingAction) {
    // Keep activePlayerId as-is; responder sees UI due to priority (if set)
  } else {
    // No pending action was created, the effect resolved immediately -> advance to next player
    advanceToNextPlayer(state, playerId);
  }

  setGameState(state as GameState);

  return { ok: true, state };
}

export async function nextTurnAction(): Promise<ServiceResult> {

  const state = getGameState();
  if (!state || state.players.length === 0 || state.board.length === 0) {
    return {
      ok: false,
      code: "GAME_NOT_INITIALIZED",
      message: "The game state is empty or not initialized. Please start a new game.",
      state,
    };
  }
  if (state.pendingAction) {
    return {
      ok: false,
      code: "PENDING_ACTION",
      message: "Resolve the pending action before advancing the turn.",
      state,
    };
  }
  const currentIndex = state.players.findIndex((p) => p.id === state.activePlayerId);
  const nextIndex = (currentIndex + 1) % state.players.length;
  state.activePlayerId = state.players[nextIndex].id;
  state.currentTurn += nextIndex === 0 ? 1 : 0;
  setGameState(state as GameState);
  return { ok: true, state };
}

export async function recallWorkersAction(playerId: string): Promise<ServiceResult> {
  const state = getGameState();
  if (!state || state.players.length === 0 || state.board.length === 0) {
    return {
      ok: false,
      code: "GAME_NOT_INITIALIZED",
      message: "The game state is empty or not initialized. Please start a new game.",
      state,
    };
  }
  if (state.pendingAction) {
    return { ok: false, code: "PENDING_ACTION", message: "Resolve the pending action before recalling workers.", state };
  }
  if (state.activePlayerId !== playerId) {
    return { ok: false, code: "NOT_YOUR_TURN", message: `It is not player '${playerId}' turn.`, state };
  }
  // If nothing to recall, do not consume the turn
  if (!hasAnyPlacedWorkers(state, playerId)) {
    return { ok: false, code: "NOTHING_TO_RECALL", message: "No workers to recall.", state };
  }
  // Recall placed workers for this player from the board
  recallAllWorkers(state, playerId);
  // Advancing to the next player after recall (counts as a turn)
  advanceToNextPlayer(state, playerId);
  setGameState(state as GameState);
  return { ok: true, state };
}

export async function respondAction(playerId: string, actionId: string, choice: any): Promise<ServiceResult> {


  const state = getGameState();
  if (!state || state.players.length === 0 || state.board.length === 0) {
    return { ok: false, code: "GAME_NOT_INITIALIZED", message: "The game state is empty or not initialized. Please start a new game.", state };
  }
  if (!state.pendingAction || state.pendingAction.effectId !== actionId) {
    return { ok: false, code: "NO_MATCHING_PENDING_ACTION", message: "No matching pending action", state };
  }

  console.log(`Player ${playerId} responded to action ${actionId} with choice:`, choice);
  const { fromPlayerId, toPlayerId, data } = state.pendingAction;
  if (choice?.skip) {
    // Responder cannot or chooses not to provide resources
    state.pendingAction = undefined;
    delete state.priorityPlayerId;
    advanceToNextPlayer(state, fromPlayerId);
    setGameState(state as GameState);
    return { ok: true, state };
  }

  if (data?.type === "chooseResourceFromPlayer" || data?.type === "interactive") {
    const responder = state.players.find((p) => p.id === toPlayerId); // giver
    const initiator = state.players.find((p) => p.id === fromPlayerId); // receiver
    if (responder && initiator && choice?.resourceId) {
      const requiredAmount = (data?.amount != null ? data.amount : (choice.amount || 1));
      const available = responder.resources[choice.resourceId] || 0;
      if (available < requiredAmount) {
        return {
          ok: false,
          code: "INSUFFICIENT_RESOURCES",
          message: `Player '${responder.name}' has only ${available} of '${choice.resourceId}', but ${requiredAmount} is required.`,
          state,
          details: { requiredAmount, available, resourceId: choice.resourceId, responderId: responder.id },
        };
      }
      responder.resources[choice.resourceId] = available - requiredAmount;
      initiator.resources[choice.resourceId] = (initiator.resources[choice.resourceId] || 0) + requiredAmount;
    }
  }

  state.pendingAction = undefined;
  // Clear priority on resolve and advance to next player from the initiator
  delete state.priorityPlayerId;
  advanceToNextPlayer(state, fromPlayerId);
  setGameState(state as GameState);
  return { ok: true, state };
}
