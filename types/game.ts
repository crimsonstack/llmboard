export interface Resource {
  id: string;
  name: string;
  description: string;
}

// Effect types are open-ended strings, validated by mechanics registry
// e.g., 'gain', 'lose', 'move', 'interactive', or any custom registered id

export interface Effect {
  type: string; // any registered mechanic id
  payload: any; // Flexible for LLM creativity; validated by mechanic if provided
}

export interface BoardSpace {
  id: string;
  name: string;
  description: string;
  capacity: number;
  effect: Effect;
  currentWorkers?: number; // Tracks how many workers are placed
}

export interface Player {
  id: string;
  name: string;
  resources: Record<string, number>; // key: resourceId
  workers: number; // available workers in hand
  placedWorkers?: Record<string, number>; // key: spaceId -> number of workers placed by this player on that space
}

export interface PendingAction {
  effectId: string;
  fromPlayerId: string;
  toPlayerId: string;
  data?: any;
  mechanicId?: string; // for routing generic resolve
}

export type GameMode = "hotseat" | "online";

export interface GameState {
  resources: Resource[];
  board: BoardSpace[];
  players: Player[];
  activePlayerId: string;
  priorityPlayerId?: string;
  pendingAction?: PendingAction;
  currentTurn: number;
  mode?: GameMode;
}
