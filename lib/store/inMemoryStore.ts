import type { GameStore } from "./GameStore";

// Lightweight dev-only store: tracks versions only and never writes back into gameState
const versions = new Map<string, number>();

export const InMemoryStore: GameStore = {
  async get(roomId) {
    const version = versions.get(roomId) ?? 1;
    return { state: null, version };
  },
  async init(roomId) {
    versions.set(roomId, 1);
    return { ok: true, version: 1 };
  },
  async set(roomId, _state, _expectedVersion) {
    const current = versions.get(roomId) ?? 1;
    const next = current + 1;
    versions.set(roomId, next);
    return { ok: true, version: next };
  },
  async listRooms() {
    // Not used in dev; return empty list
    return [];
  },
};
