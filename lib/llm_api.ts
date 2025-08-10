import { getGameState, setGameState } from "@/lib/gameState";
import type { Resource } from "@/types/game";
import { listMechanics as listRegisteredMechanics } from "@/lib/mechanics";

export type ApiResult<T> = { ok: true; data: T } | { ok: false; code: string; message: string };

function genId(prefix: string) {
  try {
    // @ts-ignore
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {}
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function listMechanics() {
  const mechs = listRegisteredMechanics().map((m) => ({
    id: m.id,
    displayName: m.displayName || m.id,
    description: m.description || "",
    // payloadSchema can be added later in Phase 2
  }));
  return { ok: true as const, data: mechs };
}

export function createResource(params: { id?: string; name: string; description: string }): ApiResult<Resource> {
  const { id, name, description } = params || ({} as any);
  if (!name || typeof name !== "string") return { ok: false, code: "INVALID_NAME", message: "name is required" };
  if (!description || typeof description !== "string") return { ok: false, code: "INVALID_DESCRIPTION", message: "description is required" };

  const state = getGameState();
  if (!state) return { ok: false, code: "GAME_NOT_INITIALIZED", message: "Initialize a game before creating resources." };

  const newId = id && id.trim().length > 0 ? id : genId("r");
  if (state.resources.some((r) => r.id === newId)) {
    return { ok: false, code: "DUPLICATE_RESOURCE_ID", message: `Resource id '${newId}' already exists.` };
  }
  if (state.resources.some((r) => r.name.toLowerCase() === name.toLowerCase())) {
    return { ok: false, code: "DUPLICATE_RESOURCE_NAME", message: `Resource name '${name}' already exists.` };
  }

  const resource: Resource = { id: newId, name, description };
  state.resources.push(resource);
  // Ensure players' resource maps have a default 0 for visibility; not strictly required
  for (const p of state.players) {
    if (p.resources[resource.id] == null) p.resources[resource.id] = 0;
  }
  setGameState(state);
  return { ok: true, data: resource };
}
