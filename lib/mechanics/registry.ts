import type { GameState } from "@/types/game";

export interface MechanicContext {
  playerId: string;
  // Optional space context if available in the caller in future phases
  spaceId?: string;
  payload: any;
}

export interface MechanicSpec {
  id: string;
  displayName?: string;
  description?: string;
  // Mutates the provided state in-place.
  apply: (state: GameState, ctx: MechanicContext) => void;
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

export function executeMechanic(state: GameState, id: string, ctx: MechanicContext) {
  const mech = registry.get(id);
  if (!mech) {
    throw new Error(`Mechanic not registered: ${id}`);
  }
  mech.apply(state, ctx);
}
