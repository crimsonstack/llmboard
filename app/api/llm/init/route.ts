import { NextResponse } from "next/server";
import { loadInitialGameData } from "@/lib/llm";
import { initGameState, withRoom, setRoomMode, getGameState } from "@/lib/gameState";
import { getSetup } from "@/lib/store/setupStore";
import type { GameMode, Player } from "@/types/game";

function genId(prefix: string) {
  try {
    // @ts-ignore
    if (typeof crypto !== "undefined" && crypto.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
  } catch {}
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Initializes the game state for a given room.
 * Body: { roomId?: string, mode?: GameMode, players?: Partial<Player>[], setupId?: string }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const mode: GameMode | undefined = body?.mode;
    const roomId: string = body?.roomId || "default";
    const playersInput: Partial<Player>[] | undefined = body?.players;

    const setupId: string | undefined = body?.setupId;

    let resources: any[] = [];
    let board: any[] = [];
    if (setupId) {
      const setup = await getSetup(setupId);
      if (!setup) {
        return NextResponse.json({ ok: false, code: "SETUP_NOT_FOUND", message: `No setup '${setupId}'` }, { status: 400 });
      }
      resources = (setup.data as any)?.resources || [];
      board = (setup.data as any)?.board || [];
    } else {
      const data = await loadInitialGameData();
      resources = data.resources;
      board = data.board;
    }

    const players: Player[] = (playersInput && playersInput.length > 0)
      ? playersInput.map((p, idx) => ({
          id: p.id || genId(`p${idx+1}`),
          name: p.name || `Player ${idx+1}`,
          resources: p.resources || {},
          workers: typeof (p as any).workers === "number" ? (p as any).workers : 3,
          placedWorkers: {},
        }))
      : (mode === "hotseat"
        ? [
            { id: genId("p1"), name: "Alice", resources: {}, workers: 3, placedWorkers: {} },
            { id: genId("p2"), name: "Bob", resources: {}, workers: 3, placedWorkers: {} },
          ]
        : []);

    await withRoom(roomId, () => {
      initGameState(resources, board, players, { mode: mode || "hotseat", setupId });
      if (mode) setRoomMode(roomId, mode);
    });

    const state = await withRoom(roomId, () => getGameState());
    return NextResponse.json({ ok: true, roomId, state });
  } catch (error: any) {
    return NextResponse.json({ ok: false, code: "INIT_FAILED", message: error.message }, { status: 500 });
  }
}
