import { NextResponse } from "next/server";
import { placeWorkerAction } from "@/lib/gameService";

export async function POST(req: Request) {
  const { playerId, spaceId } = await req.json();
  const result = await placeWorkerAction(playerId, spaceId);
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json(result);
}
