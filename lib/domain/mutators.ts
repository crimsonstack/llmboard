import type { Player } from "@/types/game";

export function grantResource(player: Player, resourceId: string, amount: number) {
  player.resources[resourceId] = (player.resources[resourceId] || 0) + amount;
}

export function loseResource(player: Player, resourceId: string, amount: number) {
  const current = player.resources[resourceId] || 0;
  player.resources[resourceId] = Math.max(0, current - amount);
}

export function transferResource(from: Player, to: Player, resourceId: string, amount: number): { ok: true } | { ok: false; code: string; message: string; available: number } {
  const available = from.resources[resourceId] || 0;
  if (amount <= 0) return { ok: false, code: "INVALID_AMOUNT", message: "Amount must be positive", available } as const;
  if (available < amount) return { ok: false, code: "INSUFFICIENT_RESOURCES", message: `Insufficient ${resourceId}`, available } as const;
  from.resources[resourceId] = available - amount;
  to.resources[resourceId] = (to.resources[resourceId] || 0) + amount;
  return { ok: true } as const;
}
