import { NextResponse } from "next/server";
import { placeWorkerAction } from "@/lib/gameService";
import { withRoom } from "@/lib/gameState";

export async function POST(req: Request) {
  const { playerId, spaceId, roomId = "default" } = await req.json();
  const result = await withRoom(roomId, () => placeWorkerAction(playerId, spaceId));
  if (!result.ok) {
    return NextResponse.json({ ...result, roomId }, { status: 400 });
  }
  return NextResponse.json({ ...result, roomId });
}
