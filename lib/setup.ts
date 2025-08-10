import type { GameState, BoardSpace, Resource, Player } from "@/types/game";

// Convert a full GameState into a reusable setup template, stripping runtime fields
export function toSetup(state: GameState) {
  const resources: Resource[] = state.resources.map(r => ({ id: r.id, name: r.name, description: r.description }));
  const board: BoardSpace[] = state.board.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    capacity: s.capacity,
    effect: s.effect,
  }));
  // Players are not part of the reusable setup by default
  return { resources, board } as { resources: Resource[]; board: BoardSpace[] };
}

// Build a fresh GameState from a setup template
export function initGameStateFromSetup(setup: { resources: Resource[]; board: BoardSpace[] }, players: Player[], opts?: { mode?: string }) {
  const normalizedPlayers = players.map((p) => ({ ...p, placedWorkers: p.placedWorkers ?? {} }));
  const next: GameState = {
    resources: setup.resources,
    board: setup.board.map((space) => ({ ...space, currentWorkers: 0 })),
    players: normalizedPlayers,
    activePlayerId: normalizedPlayers[0]?.id || "",
    currentTurn: 0,
    ...(opts?.mode ? { mode: opts.mode as any } : {}),
  };
  return next;
}
