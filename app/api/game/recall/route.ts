import { NextResponse } from "next/server";
import { recallWorkersAction } from "@/lib/gameService";
import { withRoom } from "@/lib/gameState";

export async function POST(req: Request) {
  const { playerId, roomId = "default" } = await req.json();
  const result = await withRoom(roomId, () => recallWorkersAction(playerId));
  if (!result.ok) {
    return NextResponse.json({ ...result, roomId }, { status: 400 });
  }
  return NextResponse.json({ ...result, roomId });
}
