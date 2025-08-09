import { NextResponse } from "next/server";
import { respondAction } from "@/lib/gameService";

export async function POST(req: Request) {
  const { playerId, actionId, choice } = await req.json();
  const result = await respondAction(playerId, actionId, choice);
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }
  // If the action type requires info for the client (e.g., the effectId), include it in the response
  return NextResponse.json(result);
}
