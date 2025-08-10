import { PrismaClient } from "@prisma/client";
import type { GameStore, StoreSave } from "./GameStore";
import type { GameState } from "@/types/game";

// Initialize Prisma client lazily based on env to avoid connection attempts in dev/tests
const shouldInit = (process.env.PERSIST_STORE?.toLowerCase() === "mysql") && !!process.env.DATABASE_URL;
let prisma: PrismaClient | null = null;
if (shouldInit) {
  const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
  prisma = globalForPrisma.prisma ?? new PrismaClient();
  if (!globalForPrisma.prisma) globalForPrisma.prisma = prisma;
}

export const MySQLStore: GameStore = {
  async get(roomId) {
    if (!prisma) return { state: null, version: null };
    const row = await prisma.gameState.findUnique({ where: { roomId } });
    if (!row) return { state: null, version: null };
    return { state: row.state as unknown as GameState, version: row.version };
  },
  async init(roomId, state, meta) {
    if (!prisma) return { ok: true, version: 1 };
    try {
      await prisma.room.upsert({ where: { id: roomId }, create: { id: roomId }, update: {} });
      const created = await prisma.gameState.create({ data: { roomId, state: state as unknown as any, version: 1, setupId: meta?.setupId || null } });
      return { ok: true, version: created.version };
    } catch (e: any) {
      return { ok: false, code: "DB_ERROR", message: e?.message || "DB error" };
    }
  },
  async set(roomId, state, expectedVersion) {
    if (!prisma) return { ok: true, version: (expectedVersion ?? 1) + 1 };
    try {
      const maxRetries = 2;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        // Enforce optimistic concurrency via a transaction
        const updated = await prisma.$transaction(async (tx) => {
          const row = await tx.gameState.findUnique({ where: { roomId }, select: { version: true } });
          const current = row?.version ?? null;
          if (current == null) {
            // Create initial row if missing
            const created = await tx.gameState.create({ data: { roomId, state: state as unknown as any, version: 1 } });
            return created;
          }
          if (expectedVersion != null && current !== expectedVersion) {
            return null as any; // signal conflict
          }
          return await tx.gameState.update({ where: { roomId }, data: { state: state as unknown as any, version: { increment: 1 } } });
        });
        if (updated) {
          return { ok: true, version: updated.version } as StoreSave;
        }
        // Conflict: re-read and retry with latest
        const latest = await prisma.gameState.findUnique({ where: { roomId }, select: { version: true } });
        if (!latest) {
          // Row vanished; retry will create it
          continue;
        }
        // Update expectedVersion and try again
        expectedVersion = latest.version;
      }
      return { ok: false, code: "VERSION_CONFLICT", message: "Max retries exceeded" } as StoreSave;
    } catch (e: any) {
      return { ok: false, code: "DB_ERROR", message: e?.message || "DB error" };
    }
  },
  async listRooms() {
    if (!prisma) return [];
    const rows = await prisma.room.findMany({ orderBy: { createdAt: "desc" } });
    return rows.map((r) => ({ id: r.id, createdAt: new Date(r.createdAt).getTime() }));
  },
};
