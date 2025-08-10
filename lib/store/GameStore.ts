import type { GameState } from "@/types/game";

export interface SaveResult {
  ok: true;
  version: number;
}

export interface SaveConflict {
  ok: false;
  code: "VERSION_CONFLICT" | "DB_ERROR";
  message: string;
}

export type StoreSave = SaveResult | SaveConflict;

export interface GameStore {
  get(roomId: string): Promise<{ state: GameState | null; version: number | null }>;
  init(roomId: string, state: GameState, meta?: { setupId?: string }): Promise<StoreSave>;
  set(roomId: string, state: GameState, expectedVersion: number | null): Promise<StoreSave>;
  listRooms(): Promise<{ id: string; createdAt: number }[]>;
}
