import { NextResponse } from "next/server";
import { loadInitialGameData } from "@/lib/llm";
import { initGameState, getGameState } from "@/lib/gameState";

/**
 * Initializes the game state.
 * For local testing, loads from mock/init.json.
 * In production, can call the LLM to generate data.
 */
export async function POST(req: Request) {
  try {
    const { mode } = await req.json();

    // For now, always load mock data
    const { resources, board } = await loadInitialGameData();

    // Example: create two test players
    const players = [
      { id: "p1", name: "Alice", resources: {}, workers: 3, placedWorkers: {} },
      { id: "p2", name: "Bob", resources: {}, workers: 3, placedWorkers: {} }
    ];

    initGameState(resources, board, players);
    const state = getGameState();
    state.mode = mode;

    return NextResponse.json({ ok: true, state });
  } catch (error: any) {
    return NextResponse.json({ ok: false, code: "INIT_FAILED", message: error.message }, { status: 500 });
  }
}
