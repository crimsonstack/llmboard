import { NextResponse } from "next/server";
import { listRooms, getRoomState } from "@/lib/gameState";

export async function GET() {
  const rooms = listRooms().map(r => {
    const state = getRoomState(r.id);
    return {
      id: r.id,
      mode: r.mode || state.mode,
      createdAt: r.createdAt,
      players: state.players?.map(p => ({ id: p.id, name: p.name })) || [],
      boardSize: state.board?.length || 0,
    };
  });
  return NextResponse.json({ ok: true, rooms });
}
