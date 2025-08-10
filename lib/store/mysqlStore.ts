import { PrismaClient } from "@prisma/client";
import type { GameStore, StoreSave } from "./GameStore";
import type { GameState } from "@/types/game";

// Reuse Prisma client across hot reloads
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (!globalForPrisma.prisma) globalForPrisma.prisma = prisma;

export const MySQLStore: GameStore = {
  async get(roomId) {
    const row = await prisma.gameState.findUnique({ where: { roomId } });
    if (!row) return { state: null, version: null };
    return { state: row.state as unknown as GameState, version: row.version };
  },
  async init(roomId, state) {
    try {
      // Create room record if not exists
      await prisma.room.upsert({
        where: { id: roomId },
        create: { id: roomId },
        update: {},
      });
      const created = await prisma.gameState.create({
        data: { roomId, state: state as unknown as any, version: 1 },
      });
      return { ok: true, version: created.version };
    } catch (e: any) {
      // If already exists, treat as conflict
      return { ok: false, code: "DB_ERROR", message: e?.message || "DB error" };
    }
  },
  async set(roomId, state, expectedVersion) {
    try {
      // If expectedVersion is provided, enforce optimistic concurrency via a transaction
      if (expectedVersion != null) {
        const updated = await prisma.$transaction(async (tx) => {
          const row = await tx.gameState.findUnique({ where: { roomId }, select: { version: true } });
          const current = row?.version ?? null;
          if (current == null || current !== expectedVersion) {
            return null as any;
          }
          return await tx.gameState.update({
            where: { roomId },
            data: { state: state as unknown as any, version: { increment: 1 } },
          });
        });
        if (!updated) {
          return { ok: false, code: "VERSION_CONFLICT", message: `expected ${expectedVersion}` } as StoreSave;
        }
        return { ok: true, version: updated.version } as StoreSave;
      }

      // No expected version: upsert
      const row = await prisma.gameState.upsert({
        where: { roomId },
        update: { state: state as unknown as any, version: { increment: 1 } },
        create: { roomId, state: state as unknown as any, version: 1 },
      });
      return { ok: true, version: row.version };
    } catch (e: any) {
      return { ok: false, code: "DB_ERROR", message: e?.message || "DB error" };
    }
  },
  async listRooms() {
    const rows = await prisma.room.findMany({ orderBy: { createdAt: "desc" } });
    return rows.map((r) => ({ id: r.id, createdAt: new Date(r.createdAt).getTime() }));
  },
};
