import { NextRequest } from "next/server";
import { subscribeRoom, getRoomState } from "@/lib/gameState";

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const roomId = searchParams.get('roomId') || 'default';

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();
      function send(data: any) {
        controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`));
      }
      // Initial snapshot
      try {
        const state = getRoomState(roomId);
        send({ type: 'state', state });
      } catch {}
      const unsubscribe = subscribeRoom(roomId, (payload) => send(payload));
      const keepAlive = setInterval(() => controller.enqueue(enc.encode(`:\n\n`)), 20000);
      // Close handling
      // @ts-ignore
      controller.signal?.addEventListener?.('abort', () => {
        clearInterval(keepAlive);
        unsubscribe();
      });
    },
    cancel() {},
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
