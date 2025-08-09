import { NextResponse } from "next/server";
import { respondAction } from "@/lib/gameService";
import { withRoom } from "@/lib/gameState";

export async function POST(req: Request) {
  const { playerId, actionId, choice, roomId = "default" } = await req.json();
  const result = await withRoom(roomId, () => respondAction(playerId, actionId, choice));
  if (!result.ok) {
    return NextResponse.json({ ...result, roomId }, { status: 400 });
  }
  return NextResponse.json({ ...result, roomId });
}
