import { describe, it, expect, beforeEach } from "vitest";
import { initGameState, getGameState, setGameState } from "@/lib/gameState";
import { placeWorkerAction, nextTurnAction, respondAction, recallWorkersAction } from "@/lib/gameService";
import type { BoardSpace, Resource } from "@/types/game";

function setupBasicState() {
  const resources: Resource[] = [
    { id: "r1", name: "Moonstone", description: "" },
    { id: "r2", name: "Ironwood", description: "" },
  ];
  const board: BoardSpace[] = [
    { id: "b1", name: "Mine", description: "", capacity: 1, effect: { type: "gain", payload: { resourceId: "r1", amount: 2 } } },
    { id: "b2", name: "Grove", description: "", capacity: 1, effect: { type: "gain", payload: { resourceId: "r2", amount: 1 } } },
    { id: "b3", name: "Council", description: "", capacity: 1, effect: { type: "interactive", payload: { action: "chooseResourceFromPlayer" } } },
  ];
  const players = [
    { id: "p1", name: "Alice", resources: {}, workers: 2 },
    { id: "p2", name: "Bob", resources: {}, workers: 2 },
  ];
  initGameState(resources, board, players);
}

describe("gameService actions", () => {
  beforeEach(() => {
    setupBasicState();
  });

  it("places a worker and applies gain effect", async () => {
    const res = await placeWorkerAction("p1", "b1");
    expect(res.ok).toBe(true);
    if (res.ok) {
      const state = res.state;
      expect(state.board.find(b => b.id === "b1")?.currentWorkers).toBe(1);
      expect(state.players.find(p => p.id === "p1")?.workers).toBe(1);
      expect(state.players.find(p => p.id === "p1")?.resources["r1"]).toBe(2);
    }
  });

  it("prevents placing on full space", async () => {
    const r1 = await placeWorkerAction("p1", "b1");
    expect(r1.ok).toBe(true);
    // After first placement with a non-interactive effect, turn should advance to p2
    const r2 = await placeWorkerAction("p2", "b1");
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.code).toBe("SPACE_FULL");
  });

  it("enforces turn order", async () => {
    const r = await placeWorkerAction("p2", "b1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("NOT_YOUR_TURN");
  });

  it("recall workers counts as a turn and returns placed workers", async () => {
    // p1 places a worker on b1
    let res = await placeWorkerAction("p1", "b1");
    expect(res.ok).toBe(true);
    // p2 turn now (non-interactive), place one too
    res = await placeWorkerAction("p2", "b2");
    expect(res.ok).toBe(true);
    // p1 recalls workers on their turn
    const recall = await recallWorkersAction("p1");
    expect(recall.ok).toBe(true);
    if (recall.ok) {
      const s = recall.state;
      const p1 = s.players.find(p => p.id === "p1")!;
      // p1 should have their worker back in hand and zero placed
      const placedCount = Object.values(p1.placedWorkers || {}).reduce((a,b)=>a+(b||0),0);
      expect(placedCount).toBe(0);
    }
  });

  it("advances next turn and wraps to next player", async () => {
    const r1 = await nextTurnAction();
    expect(r1.ok).toBe(true);
    if (r1.ok) {
      expect(r1.state.activePlayerId).toBe("p2");
    }
    const r2 = await nextTurnAction();
    expect(r2.ok).toBe(true);
    if (r2.ok) {
      expect(r2.state.activePlayerId).toBe("p1");
    }
  });

  it("handles interactive pending action and response without switching turn until resolve", async () => {
    const r1 = await placeWorkerAction("p1", "b3"); // triggers pendingAction
    expect(r1.ok).toBe(true);
    const state1 = (r1 as any).state;
    expect(state1.pendingAction).toBeTruthy();
    // It should still be p1's turn while waiting for response
    expect(state1.activePlayerId).toBe("p1");
    const actionId = state1.pendingAction.effectId;
    // Attempt to place a worker during pending action should fail
    const blocked = await placeWorkerAction("p2", "b1");
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.code).toBe("PENDING_ACTION");
    // Respond
    const r2 = await respondAction("p2", actionId, { resourceId: "r1", amount: 1 });
    expect(r2.ok).toBe(true);
    const state2 = (r2 as any).state;
    expect(state2.pendingAction).toBeUndefined();
    // After resolve, it should advance from initiator p1 to p2
    expect(state2.activePlayerId).toBe("p2");
  });
});
