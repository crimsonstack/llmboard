import { NextResponse } from "next/server";
import { withRoom, getGameState } from "@/lib/gameState";
import { toSetup } from "@/lib/setup";
import { saveSetup } from "@/lib/store/setupStore";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const roomId: string = body?.roomId || "default";
    const name: string = (body?.name || "").toString().trim();
    const description: string = (body?.description || "").toString();

    if (!name) {
      return NextResponse.json({ ok: false, code: "INVALID_NAME", message: "name is required" }, { status: 400 });
    }

    const state = await withRoom(roomId, () => getGameState());
    if (!state || !Array.isArray(state.board) || state.board.length === 0) {
      return NextResponse.json({ ok: false, code: "ROOM_NOT_READY", message: "Room not initialized." }, { status: 400 });
    }

    const setup = toSetup(state);
    const created = await saveSetup(setup, { name, description });
    return NextResponse.json({ ok: true, setup: { id: created.id, name: created.name, createdAt: created.createdAt }, data: created.data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, code: "SAVE_SETUP_FAILED", message: e?.message || "Failed to save setup" }, { status: 500 });
  }
}
