import { GameState, BoardSpace, Player, Resource, PendingAction, GameMode } from "../types/game";

// Global store with per-room state to support hosting/joining multiple rooms and HMR in dev
const GLOBAL_KEY = "__LLM_BOARD_ROOM_STORE__";

type RoomStore = {
  rooms: Record<string, GameState>;
  versions: Record<string, number | undefined>;
  currentRoomId: string;
  defaultRoomId: string;
  roomList: { id: string; mode?: GameMode; createdAt: number }[];
  subscribers: Record<string, Set<(payload: any) => void>>;
};

function emptyState(): GameState {
  return {
    resources: [],
    board: [],
    players: [],
    activePlayerId: "",
    currentTurn: 0,
  } as GameState;
}

function getStore(): RoomStore {
  const g = globalThis as any;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = {
      rooms: { default: emptyState() },
      versions: { default: 1 },
      currentRoomId: "default",
      defaultRoomId: "default",
      roomList: [{ id: "default", createdAt: Date.now() }],
      subscribers: {},
    } as RoomStore;
  } else {
    // Backwards-compatible upgrade: ensure new fields exist after HMR
    const s = g[GLOBAL_KEY];
    if (!s.rooms) s.rooms = { default: emptyState() };
    if (!s.versions) s.versions = { default: 1 };
    if (!s.currentRoomId) s.currentRoomId = "default";
    if (!s.defaultRoomId) s.defaultRoomId = "default";
    if (!s.roomList) {
      const existingRooms = Object.keys(s.rooms || {});
      s.roomList = existingRooms.length
        ? existingRooms.map((id: string) => ({ id, createdAt: Date.now() }))
        : [{ id: "default", createdAt: Date.now() }];
    }
    if (!s.subscribers) s.subscribers = {};
  }
  return g[GLOBAL_KEY] as RoomStore;
}

// Selected persistence store (in-memory by default, MySQL in prod)
import { getStore as getSelectedStore } from "@/lib/store";

function ensureRoom(roomId: string) {
  const store = getStore();
  if (!store.rooms[roomId]) {
    store.rooms[roomId] = emptyState();
    store.versions[roomId] = 1;
    if (!Array.isArray(store.roomList)) store.roomList = [];
    if (!store.roomList.find((r: any) => r.id === roomId)) {
      store.roomList.push({ id: roomId, createdAt: Date.now() });
    }
  }
}

export function setCurrentRoom(roomId: string) {
  ensureRoom(roomId);
  getStore().currentRoomId = roomId;
}

export async function withRoom<T>(roomId: string, fn: () => Promise<T> | T): Promise<T> {
  const store = getStore();
  const prev = store.currentRoomId;
  try {
    setCurrentRoom(roomId);
    const result = fn();
    return await Promise.resolve(result);
  } finally {
    store.currentRoomId = prev;
  }
}

export function getGameState(): GameState {
  const store = getStore();
  ensureRoom(store.currentRoomId);
  return store.rooms[store.currentRoomId];
}

// Helper to get local version for optimistic save
function getCurrentVersion(roomId: string) {
  const store = getStore();
  return store.versions[roomId] ?? 1;
}

export function getRoomState(roomId: string): GameState {
  ensureRoom(roomId);
  return getStore().rooms[roomId];
}

export function setGameState(newState: GameState) {
  const store = getStore();
  ensureRoom(store.currentRoomId);
  const roomId = store.currentRoomId;
  store.rooms[roomId] = newState;
  // Persist via selected store (optimistic with local version)
  const selected = getSelectedStore();
  const expected = store.versions[roomId] ?? 1;
  selected.set(roomId, newState, expected).then((res) => {
    if (res.ok) {
      store.versions[roomId] = res.version;
    } else {
      console.warn("Persistence save failed:", res.code, res.message);
    }
  }).catch((e) => console.error("Persistence error:", e));
  notifyRoom(roomId, { type: 'state', state: newState });
}

export function setRoomState(roomId: string, newState: GameState) {
  ensureRoom(roomId);
  const store = getStore();
  store.rooms[roomId] = newState;
  const selected = getSelectedStore();
  const expected = store.versions[roomId] ?? 1;
  selected.set(roomId, newState, expected).then((res) => {
    if (res.ok) {
      store.versions[roomId] = res.version;
    } else {
      console.warn("Persistence save failed:", res.code, res.message);
    }
  }).catch((e) => console.error("Persistence error:", e));
  notifyRoom(roomId, { type: 'state', state: newState });
}

export function subscribeRoom(roomId: string, cb: (payload: any) => void) {
  const store = getStore();
  if (!store.subscribers[roomId]) store.subscribers[roomId] = new Set();
  store.subscribers[roomId].add(cb);
  return () => {
    store.subscribers[roomId].delete(cb);
  };
}

export function notifyRoom(roomId: string, payload: any) {
  const store = getStore();
  const subs = store.subscribers[roomId];
  if (!subs) return;
  for (const cb of subs) {
    try { cb(payload); } catch {}
  }
}

export async function initGameState(resources: Resource[], board: BoardSpace[], players: Player[], opts?: { mode?: GameMode; roomId?: string }) {
  const normalizedPlayers = players.map((p) => ({ ...p, placedWorkers: p.placedWorkers ?? {} }));
  const next: GameState = {
    resources,
    board: board.map((space) => ({ ...space, currentWorkers: 0 })),
    players: normalizedPlayers,
    activePlayerId: normalizedPlayers[0]?.id || "",
    currentTurn: 0,
    ...(opts?.mode ? { mode: opts.mode } : {}),
  };
  const roomId = opts?.roomId || getStore().currentRoomId;
  const selected = getSelectedStore();
  // Initialize in store first (sets version=1 in persistent stores)
  await selected.init(roomId, next);
  setRoomState(roomId, next);
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

export function setRoomMode(roomId: string, mode: GameMode) {
  const state = getRoomState(roomId);
  state.mode = mode;
  setRoomState(roomId, state);
  const store = getStore();
  const entry = store.roomList.find(r => r.id === roomId);
  if (entry) entry.mode = mode;
}

export function addPlayerToRoom(roomId: string, player: Player) {
  const state = getRoomState(roomId);
  const p: Player = { ...player, placedWorkers: player.placedWorkers ?? {} };
  state.players.push(p);
  if (!state.activePlayerId) state.activePlayerId = p.id;
  setRoomState(roomId, state);
}

export function listRooms() {
  const store = getStore();
  return [...store.roomList].sort((a, b) => b.createdAt - a.createdAt);
}

// Effect execution is centralized in lib/effects. This legacy copy was removed to prevent divergence.
