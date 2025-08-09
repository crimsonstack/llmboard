export interface Resource {
  id: string;
  name: string;
  description: string;
}

export type EffectType = 'gain' | 'lose' | 'move' | 'interactive' | 'custom';

export interface Effect {
  type: EffectType;
  payload: any; // Flexible for LLM creativity
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
