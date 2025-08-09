import { NextResponse } from "next/server";
import { nextTurnAction } from "@/lib/gameService";

export async function POST() {
  const result = await nextTurnAction();
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json(result);
}
