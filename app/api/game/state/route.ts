import { NextResponse } from "next/server";
import { getGameState, withRoom } from "@/lib/gameState";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const roomId = searchParams.get("roomId") || "default";
  const state = await withRoom(roomId, () => getGameState());
  // Consider uninitialized if no players or no board
  if (!state || state.players.length === 0 || state.board.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        code: "GAME_NOT_INITIALIZED",
        message: "The game state is empty or not initialized. Please start a new game.",
        roomId,
      },
      { status: 400 }
    );
  }
  return NextResponse.json({ ok: true, roomId, state });
}
