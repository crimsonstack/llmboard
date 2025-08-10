import type { GameState, Player, BoardSpace } from "@/types/game";

export function getPlayerById(state: GameState, playerId: string): Player | undefined {
  return state.players.find(p => p.id === playerId);
}

export function getSpaceById(state: GameState, spaceId: string): BoardSpace | undefined {
  return state.board.find(s => s.id === spaceId);
}

export function listOtherPlayers(state: GameState, playerId: string): Player[] {
  return state.players.filter(p => p.id !== playerId);
}
