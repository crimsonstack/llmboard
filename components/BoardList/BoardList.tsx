"use client";

import type { BoardSpace, Player } from "@/types/game";

interface BoardListProps {
  board: BoardSpace[];
  players?: Pick<Player, "id" | "name" | "placedWorkers">[];
}

export default function BoardList({ board, players = [] }: BoardListProps) {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-2">Board Spaces</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {board.map((b) => (
          <div
            key={b.id}
            className="border rounded p-4 shadow-sm bg-white"
          >
            <h3 className="font-bold">{b.name}</h3>
            <p className="text-sm text-gray-600 mb-2">{b.description}</p>
            <span className="inline-block px-2 py-1 text-xs bg-gray-200 rounded">
              Capacity: {b.capacity}
            </span>
            {players.length > 0 && (
              <div className="mt-2 text-xs text-gray-700">
                <div className="font-semibold">Placed:</div>
                <ul className="list-disc ml-4">
                  {players.map((p) => {
                    const count = p.placedWorkers?.[b.id] || 0;
                    return count > 0 ? (
                      <li key={p.id}>
                        {p.name}: {count}
                      </li>
                    ) : null;
                  })}
                  {players.every((p) => !p.placedWorkers || !(p.placedWorkers[b.id] > 0)) && (
                    <li className="italic text-gray-500">None</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
