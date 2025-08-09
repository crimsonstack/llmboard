import { NextResponse } from "next/server";
import { getGameState } from "@/lib/gameState";

export async function GET() {
  const state = getGameState();
  // Consider uninitialized if no players or no board
  if (!state || state.players.length === 0 || state.board.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        code: "GAME_NOT_INITIALIZED",
        message: "The game state is empty or not initialized. Please start a new game.",
      },
      { status: 400 }
    );
  }
  return NextResponse.json({ ok: true, state });
}
