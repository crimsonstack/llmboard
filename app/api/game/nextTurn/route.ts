import { NextResponse } from "next/server";
import { nextTurnAction } from "@/lib/gameService";
import { withRoom } from "@/lib/gameState";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const roomId: string = body?.roomId || "default";
  const result = await withRoom(roomId, () => nextTurnAction());
  if (!result.ok) {
    return NextResponse.json({ ...result, roomId }, { status: 400 });
  }
  return NextResponse.json({ ...result, roomId });
}
