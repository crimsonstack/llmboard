import { describe, it, expect, beforeEach } from "vitest";
import { initGameState, getGameState } from "@/lib/gameState";
import { executeEffect } from "@/lib/effects";
import { respondAction } from "@/lib/gameService";
import type { BoardSpace, Resource } from "@/types/game";

function setup() {
  const resources: Resource[] = [
    { id: "r1", name: "R1", description: "" },
    { id: "r2", name: "R2", description: "" },
  ];
  const board: BoardSpace[] = [
    { id: "b1", name: "Council 2", description: "", capacity: 2, effect: { type: "chooseResourceFromPlayer", payload: { amount: 2 } } },
  ];
  const players = [
    { id: "p1", name: "A", resources: {}, workers: 2 },
    { id: "p2", name: "B", resources: { r1: 3 }, workers: 2 },
  ];
  initGameState(resources, board, players);
}

describe("chooseResourceFromPlayer mechanic", () => {
  beforeEach(() => setup());

  it("creates pending action and resolves transfer", async () => {
    // P1 triggers chooseResourceFromPlayer, target defaults to p2 in hotseat
    const res = executeEffect({ type: "chooseResourceFromPlayer", payload: { amount: 2 } }, "p1");
    const state = getGameState();
    expect(state.pendingAction).toBeTruthy();
    const actionId = state.pendingAction!.effectId;

    const r2 = await respondAction("p2", actionId, { resourceId: "r1" });
    expect(r2.ok).toBe(true);
    const s2 = (r2 as any).state;
    const p1 = s2.players.find((p:any)=>p.id==="p1");
    const p2 = s2.players.find((p:any)=>p.id==="p2");
    expect(p1.resources.r1).toBe(2);
    expect(p2.resources.r1).toBe(1);
  });

  it("errors on insufficient resources", async () => {
    executeEffect({ type: "chooseResourceFromPlayer", payload: { amount: 5 } }, "p1");
    const state = getGameState();
    const actionId = state.pendingAction!.effectId;
    const r = await respondAction("p2", actionId, { resourceId: "r1" });
    expect(r.ok).toBe(false);
  });
});
