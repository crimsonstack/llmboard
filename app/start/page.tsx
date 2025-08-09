"use client";

import { useState } from "react";
import TurnInfo from "@/components/TurnInfo/TurnInfo";
import PlayerList from "@/components/PlayerList/PlayerList";
import ResourceList from "@/components/ResourceList/ResourceList";
import BoardList from "@/components/BoardList/BoardList";

export default function StartPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gameData, setGameData] = useState<any>(null);

  async function handleStart() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/llm/init");
      const payload = await res.json();
      if (!res.ok || !payload?.ok) {
        throw new Error(payload?.message || payload?.error || "Failed to initialize game");
      }
      setGameData(payload.state);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-3xl font-bold">LLM Worker Placement Game</h1>
      {!gameData && (
        <button
          onClick={handleStart}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Generating Game..." : "Start Game"}
        </button>
      )}
      {error && <p className="text-red-500">{error}</p>}
      {gameData && (
        <div className="space-y-6">
          <TurnInfo
            activePlayerId={gameData.activePlayerId}
            priorityPlayerId={gameData.priorityPlayerId}
            players={gameData.players}
          />
          <PlayerList players={gameData.players} resources={gameData.resources} />
          <ResourceList resources={gameData.resources} />
          <BoardList board={gameData.board} players={gameData.players} />
        </div>
      )}
    </div>
  );
}
