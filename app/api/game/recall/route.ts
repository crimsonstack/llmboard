import { NextResponse } from "next/server";
import { recallWorkersAction } from "@/lib/gameService";

export async function POST(req: Request) {
  const { playerId } = await req.json();
  const result = await recallWorkersAction(playerId);
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json(result);
}
