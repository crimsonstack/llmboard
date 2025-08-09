import { GameState, BoardSpace, Player, Resource, PendingAction } from "../types/game";

// Global store to ensure a single shared state across Next.js route bundles and during HMR in dev
const GLOBAL_KEY = "__LLM_BOARD_GAME_STATE__";

type GlobalStore = { state: GameState };

function getStore(): GlobalStore {
  const g = globalThis as any;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = {
      state: {
        resources: [],
        board: [],
        players: [],
        activePlayerId: "",
        currentTurn: 0,
      } as GameState,
    } as GlobalStore;
  }
  return g[GLOBAL_KEY] as GlobalStore;
}

export function getGameState(): GameState {
  return getStore().state;
}

export function setGameState(newState: GameState) {
  getStore().state = newState;
}

export function initGameState(resources: Resource[], board: BoardSpace[], players: Player[]) {
  const normalizedPlayers = players.map((p) => ({ ...p, placedWorkers: p.placedWorkers ?? {} }));
  const next: GameState = {
    resources,
    board: board.map((space) => ({ ...space, currentWorkers: 0 })),
    players: normalizedPlayers,
    activePlayerId: normalizedPlayers[0]?.id || "",
    currentTurn: 0,
  };
  setGameState(next);
}

export function placeWorker(playerId: string, spaceId: string): boolean {
  const state = getGameState();
  const space = state.board.find((s) => s.id === spaceId);
  if (!space) return false;
  if ((space.currentWorkers || 0) >= space.capacity) return false;

  const player = state.players.find((p) => p.id === playerId);
  if (!player || player.workers <= 0) return false;

  space.currentWorkers = (space.currentWorkers || 0) + 1;
  player.workers -= 1;
  setGameState(state);
  return true;
}

export function setActivePlayer(playerId: string) {
  const state = getGameState();
  state.activePlayerId = playerId;
  setGameState(state);
}

export function nextTurn() {
  const state = getGameState();
  const currentIndex = state.players.findIndex((p) => p.id === state.activePlayerId);
  const nextIndex = (currentIndex + 1) % state.players.length;
  state.activePlayerId = state.players[nextIndex].id;
  state.currentTurn += 1;
  setGameState(state);
}

export function setPriorityPlayer(playerId: string) {
  const state = getGameState();
  state.priorityPlayerId = playerId;
  setGameState(state);
}

export function clearPriorityPlayer() {
  const state = getGameState();
  delete state.priorityPlayerId;
  setGameState(state);
}

export function setPendingAction(action: PendingAction) {
  const state = getGameState();
  state.pendingAction = action;
  setGameState(state);
}

export function clearPendingAction() {
  const state = getGameState();
  delete state.pendingAction;
  setGameState(state);
}

// Effect execution is centralized in lib/effects. This legacy copy was removed to prevent divergence.
