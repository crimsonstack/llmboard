import { getGameState, setGameState } from "@/lib/gameState";
import type { GameState } from "@/types/game";

export function hasAnyPlacedWorkers(state: GameState, playerId: string) {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return false;
  const total = Object.values(player.placedWorkers || {}).reduce((a, b) => a + (b || 0), 0);
  return total > 0;
}

export function recallAllWorkers(state: GameState, playerId: string) {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return;
  player.placedWorkers = player.placedWorkers || {};
  for (const [spaceId, count] of Object.entries(player.placedWorkers)) {
    if (!count) continue;
    const space = state.board.find(s => s.id === spaceId);
    if (!space) continue;
    space.currentWorkers = Math.max(0, (space.currentWorkers || 0) - count);
    player.workers += count;
  }
  player.placedWorkers = {};
}

export function recallWorkersActionInternal(playerId: string) {
  const state = getGameState();
  recallAllWorkers(state, playerId);
  setGameState(state as GameState);
}
