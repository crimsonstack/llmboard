"use client";

import type { Player, Resource } from "@/types/game";

interface PlayerListProps {
  players: Player[];
  resources: Resource[];
}

export default function PlayerList({ players, resources }: PlayerListProps) {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-2">Players</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {players.map((player) => (
          <div key={player.id} className="border rounded p-4 shadow-sm bg-white">
            <h3 className="font-bold">{player.name}</h3>
            <p className="text-sm text-gray-600">Workers: {player.workers}</p>
            <div className="mt-2">
              <h4 className="text-sm font-semibold">Resources</h4>
              <ul className="text-sm">
                {resources.map((res) => (
                  <li key={res.id}>
                    {res.name}: {player.resources[res.id] || 0}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
