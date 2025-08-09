import { NextResponse } from "next/server";
import { withRoom, getGameState, addPlayerToRoom } from "@/lib/gameState";
import type { Player } from "@/types/game";

function genId(prefix: string) {
  try {
    // @ts-ignore
    if (typeof crypto !== "undefined" && crypto.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
  } catch {}
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const roomId: string = body?.roomId || "default";
    const name: string = (body?.name || body?.playerName || "").toString().trim();
    const workers: number = typeof body?.workers === "number" ? body.workers : 3;

    const state = await withRoom(roomId, () => getGameState());
    if (!state || state.board.length === 0) {
      return NextResponse.json({ ok: false, code: "ROOM_NOT_READY", message: "Room is not initialized yet.", roomId }, { status: 400 });
    }

    // If player with same name exists, return that id
    const existing = name ? state.players.find(p => p.name.toLowerCase() === name.toLowerCase()) : undefined;
    let playerId: string;
    if (existing) {
      playerId = existing.id;
    } else {
      const newPlayer: Player = { id: genId("p"), name: name || `Player ${state.players.length + 1}` , resources: {}, workers, placedWorkers: {} };
      await withRoom(roomId, () => addPlayerToRoom(roomId, newPlayer));
      playerId = newPlayer.id;
    }

    const newState = await withRoom(roomId, () => getGameState());
    return NextResponse.json({ ok: true, roomId, playerId, state: newState });
  } catch (error: any) {
    return NextResponse.json({ ok: false, code: "JOIN_FAILED", message: error.message }, { status: 500 });
  }
}
