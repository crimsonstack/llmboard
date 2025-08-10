import type { GameState } from "@/types/game";
import type { GameStore, StoreSave } from "./GameStore";
import { getRoomState, setRoomState, listRooms as listLocalRooms } from "@/lib/gameState";

const versions = new Map<string, number>();

export const InMemoryStore: GameStore = {
  async get(roomId) {
    const state = getRoomState(roomId) as GameState | null;
    const version = versions.get(roomId) ?? 1;
    return { state, version };
  },
  async init(roomId, state) {
    setRoomState(roomId, state);
    versions.set(roomId, 1);
    return { ok: true, version: 1 };
  },
  async set(roomId, state, expectedVersion) {
    const current = versions.get(roomId) ?? 1;
    if (expectedVersion != null && expectedVersion !== current) {
      return { ok: false, code: "VERSION_CONFLICT", message: `expected ${expectedVersion}, current ${current}` };
    }
    const next = current + 1;
    setRoomState(roomId, state);
    versions.set(roomId, next);
    return { ok: true, version: next };
  },
  async listRooms() {
    return listLocalRooms().map(r => ({ id: r.id, createdAt: r.createdAt }));
  }
};
