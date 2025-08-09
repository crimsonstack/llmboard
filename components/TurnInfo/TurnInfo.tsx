"use client";

import type { Player } from "@/types/game";

interface TurnInfoProps {
  activePlayerId: string;
  priorityPlayerId?: string;
  players: Pick<Player, "id" | "name">[];
}

export default function TurnInfo({ activePlayerId, priorityPlayerId, players }: TurnInfoProps) {
  const activePlayer = players.find((p) => p.id === activePlayerId)?.name || "Unknown";
  const priorityPlayer = priorityPlayerId
    ? players.find((p) => p.id === priorityPlayerId)?.name
    : null;

  return (
    <div className="p-4 bg-gray-100 rounded">
      <h2 className="text-lg font-semibold">Turn Info</h2>
      <p>
        Current Turn: <span className="font-bold">{activePlayer}</span>
      </p>
      {priorityPlayer && (
        <p className="text-yellow-600">Waiting for {priorityPlayer} to respond</p>
      )}
    </div>
  );
}
