import { InMemoryStore } from "./inMemoryStore";
import { MySQLStore } from "./mysqlStore";
import type { GameStore } from "./GameStore";

export function getStore(): GameStore {
  const mode = process.env.PERSIST_STORE?.toLowerCase();
  if (mode === "mysql") return MySQLStore;
  return InMemoryStore;
}
