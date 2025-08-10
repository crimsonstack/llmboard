import { PrismaClient } from "@prisma/client";

// Lazy prisma reuse
const shouldInit = (process.env.PERSIST_STORE?.toLowerCase() === "mysql") && !!process.env.DATABASE_URL;
let prisma: PrismaClient | null = null;
if (shouldInit) {
  const g = globalThis as any;
  prisma = g.__PRISMA__ || new PrismaClient();
  if (!g.__PRISMA__) g.__PRISMA__ = prisma;
}

export async function saveSetup(data: any, opts: { id?: string; name: string; description?: string }) {
  if (!prisma) throw new Error("Prisma not initialized (set PERSIST_STORE=mysql)");
  const id = opts.id || `setup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const created = await prisma.gameSetup.create({ data: { id, name: opts.name, description: opts.description || null, data } });
  return created;
}

export async function getSetup(id: string) {
  if (!prisma) throw new Error("Prisma not initialized (set PERSIST_STORE=mysql)");
  return prisma.gameSetup.findUnique({ where: { id } });
}

export async function listSetups() {
  if (!prisma) throw new Error("Prisma not initialized (set PERSIST_STORE=mysql)");
  return prisma.gameSetup.findMany({ orderBy: { createdAt: "desc" } });
}
