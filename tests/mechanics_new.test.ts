import { describe, it, expect, beforeEach } from "vitest";
import { initGameState, getGameState } from "@/lib/gameState";
import { executeEffect } from "@/lib/effects";
import { respondAction } from "@/lib/gameService";
import type { BoardSpace, Resource, Player } from "@/types/game";

function baseSetup(players?: Player[]) {
  const resources: Resource[] = [
    { id: "r1", name: "R1", description: "" },
    { id: "r2", name: "R2", description: "" },
  ];
  const board: BoardSpace[] = [
    { id: "b0", name: "Stub", description: "", capacity: 1, effect: { type: "gain", payload: { resourceId: "r1", amount: 0 } } },
  ];
  const ps: Player[] = players || [
    { id: "p1", name: "A", resources: {}, workers: 2, placedWorkers: {} },
    { id: "p2", name: "B", resources: {}, workers: 2, placedWorkers: {} },
  ];
  initGameState(resources, board, ps);
}

describe("convert mechanic", () => {
  beforeEach(() => baseSetup([
    { id: "p1", name: "A", resources: { r2: 5 }, workers: 2, placedWorkers: {} },
    { id: "p2", name: "B", resources: {}, workers: 2, placedWorkers: {} },
  ]));

  it("converts resources at fixed rate", () => {
    const res = executeEffect({ type: "convert", payload: { fromResourceId: "r2", toResourceId: "r1", rate: 2, times: 2 } }, "p1");
    expect(res?.kind).toBe("ok");
    const state = getGameState();
    const p1 = state.players.find(p => p.id === "p1")!;
    expect(p1.resources.r2).toBe(1); // 5 - (2*2) = 1
    expect(p1.resources.r1).toBe(2);
  });

  it("errors when insufficient resources", () => {
    const res = executeEffect({ type: "convert", payload: { fromResourceId: "r2", toResourceId: "r1", rate: 3, times: 2 } }, "p1");
    expect(res?.kind).toBe("error");
  });
});

describe("chooseGainResource mechanic", () => {
  beforeEach(() => baseSetup());

  it("applies immediately when a single allowed resource", () => {
    const res = executeEffect({ type: "chooseGainResource", payload: { amount: 2, allowedResourceIds: ["r1"] } }, "p1");
    expect(res?.kind).toBe("ok");
    const p1 = getGameState().players.find(p => p.id === "p1")!;
    expect(p1.resources.r1).toBe(2);
  });

  it("creates pending and grants on resolve", async () => {
    const res = executeEffect({ type: "chooseGainResource", payload: { amount: 3, allowedResourceIds: ["r1","r2"] } }, "p1");
    expect(res?.kind).toBe("pending");
    const state = getGameState();
    const actionId = state.pendingAction!.effectId;
    const r = await respondAction("p1", actionId, { resourceId: "r2" });
    // Debug log
    // @ts-ignore
    console.log("respondAction result:", r);
    expect(r.ok).toBe(true);
    const p1 = (r as any).state.players.find((p:any)=>p.id==="p1");
    expect(p1.resources.r2).toBe(3);
  });

  it("errors if choice not allowed", async () => {
    // Re-init with an extra resource r3 to test not-allowed choice while still valid catalog id
    const resources: Resource[] = [
      { id: "r1", name: "R1", description: "" },
      { id: "r2", name: "R2", description: "" },
      { id: "r3", name: "R3", description: "" },
    ];
    const board: BoardSpace[] = [
      { id: "b0", name: "Stub", description: "", capacity: 1, effect: { type: "gain", payload: { resourceId: "r1", amount: 0 } } },
    ];
    const ps: Player[] = [
      { id: "p1", name: "A", resources: {}, workers: 2, placedWorkers: {} },
      { id: "p2", name: "B", resources: {}, workers: 2, placedWorkers: {} },
    ];
    await initGameState(resources, board, ps);

    const res = executeEffect({ type: "chooseGainResource", payload: { amount: 1, allowedResourceIds: ["r1","r2"] } }, "p1");
    expect(res?.kind).toBe("pending");
    const actionId = getGameState().pendingAction!.effectId;
    const r = await respondAction("p1", actionId, { resourceId: "r3" });
    expect(r.ok).toBe(false);
  });
});

describe("harvestByPresence mechanic", () => {
  beforeEach(() => baseSetup([
    { id: "p1", name: "A", resources: {}, workers: 2, placedWorkers: { a: 2, b: 1 } },
    { id: "p2", name: "B", resources: {}, workers: 2, placedWorkers: {} },
  ]));

  it("grants per worker across all spaces when no filter", () => {
    const res = executeEffect({ type: "harvestByPresence", payload: { resourceId: "r1", perWorker: 1 } }, "p1");
    expect(res?.kind).toBe("ok");
    const p1 = getGameState().players.find(p => p.id === "p1")!;
    expect(p1.resources.r1).toBe(3);
  });

  it("grants only across filtered spaces", () => {
    const res = executeEffect({ type: "harvestByPresence", payload: { resourceId: "r2", perWorker: 2, spaceIds: ["a"] } }, "p1");
    expect(res?.kind).toBe("ok");
    const p1 = getGameState().players.find(p => p.id === "p1")!;
    expect(p1.resources.r2).toBe(4);
  });

  it("noops if no workers present", () => {
    const res = executeEffect({ type: "harvestByPresence", payload: { resourceId: "r1", perWorker: 1 } }, "p2");
    expect(res?.kind).toBe("noop");
  });
});
