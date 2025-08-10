import type { GameState } from "@/types/game";

export interface MechanicContext {
  playerId: string;
  // Optional space context if available in the caller in future phases
  spaceId?: string;
  payload: any;
}

export type ApplyResult =
  | { kind: "ok" }
  | { kind: "noop" }
  | { kind: "pending"; pending: Pending }
  | { kind: "error"; code: string; message: string };

export interface Pending {
  id: string; // engine may fill if blank
  mechanicId: string;
  fromPlayerId: string;
  toPlayerId?: string;
  data: any;
}

export interface MechanicSpec<P = any, R = any> {
  id: string;
  displayName?: string;
  description?: string;
  // Mutates the provided state in-place and returns an ApplyResult.
  apply: (state: GameState, ctx: MechanicContext) => ApplyResult;
  // Optional: Resolve an interactive step.
  resolve?: (state: GameState, pending: Pending, choice: any) => ApplyResult;
}

const registry = new Map<string, MechanicSpec>();

export function registerMechanic(spec: MechanicSpec) {
  registry.set(spec.id, spec);
}

export function getMechanic(id: string): MechanicSpec | undefined {
  return registry.get(id);
}

export function listMechanics(): MechanicSpec[] {
  return Array.from(registry.values());
}

export function executeMechanic(state: GameState, id: string, ctx: MechanicContext): ApplyResult {
  const mech = registry.get(id);
  if (!mech) {
    throw new Error(`Mechanic not registered: ${id}`);
  }
  return mech.apply(state, ctx);
}
