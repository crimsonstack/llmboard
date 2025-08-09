"use client";

import { useEffect, useState } from "react";
import TurnInfo from "@/components/TurnInfo/TurnInfo";
import PlayerList from "@/components/PlayerList/PlayerList";
import ResourceList from "@/components/ResourceList/ResourceList";
import { GameState, BoardSpace } from "@/types/game";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export default function BoardPage() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(false);
  const [controlledPlayerId, setControlledPlayerId] = useState<string | null>(null);
  const [autoSwitch, setAutoSwitch] = useState(true);
  const [responding, setResponding] = useState(false);
  const [selectedResourceId, setSelectedResourceId] = useState<string | "">("");
  const [transferAmount, setTransferAmount] = useState<number>(1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
        const roomId = params.get('roomId') || 'default';
        const res = await fetch(`/api/game/state?roomId=${encodeURIComponent(roomId)}`);
        const payload = await res.json();
        if (res.ok && payload?.state) setGameState(payload.state);
      } catch {}
      try {
        const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
        const roomId = params.get('roomId') || 'default';
        const es = new EventSource(`/api/rooms/sse?roomId=${encodeURIComponent(roomId)}`);
        es.onmessage = (evt) => {
          try {
            const data = JSON.parse(evt.data);
            if (data?.type === 'state' && data?.state) setGameState(data.state);
          } catch {}
        };
        es.onerror = () => {
          es.close();
        };
        if (cancelled) es.close();
        return () => es.close();
      } catch (e) {
        console.warn('SSE not available', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const placeWorker = async (spaceId: string) => {
    if (!gameState) return;
    setLoading(true);
    try {
      const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
      const roomId = params.get('roomId') || 'default';
      const playerId = params.get('playerId') || gameState.activePlayerId;
      const res = await fetch("/api/game/placeWorker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId,
          playerId,
          spaceId,
        }),
      });
      const payload = await res.json();
      if (!res.ok) {
        console.error("Place worker error:", payload);
        if (payload?.state) setGameState(payload.state);
        return;
      }
      if (payload && payload.ok && payload.state) {
        setGameState(payload.state);
      }
    } catch (err) {
      console.error("Network error placing worker:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (autoSwitch) {
      if (gameState?.priorityPlayerId) {
        setControlledPlayerId(gameState.priorityPlayerId);
      } else if (gameState?.activePlayerId) {
        setControlledPlayerId(gameState.activePlayerId);
      }
    }
  }, [autoSwitch, gameState?.priorityPlayerId, gameState?.activePlayerId]);

  if (!gameState) return <div>Loading...</div>;


  const currentPlayerId = controlledPlayerId || gameState.activePlayerId;

  const pending = gameState.pendingAction;
  const isInteractive = !!pending;
  const responderId = pending?.toPlayerId || "";
  const initiatorId = pending?.fromPlayerId || "";
  // In online mode, actor identity comes from URL ?playerId=...
  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const myPlayerIdParam = urlParams?.get('playerId') || '';
  const actorPlayerId = myPlayerIdParam || currentPlayerId; // online => my id, hotseat => controlled/active
  const priorityId = gameState.priorityPlayerId || "";
  const isResponder = isInteractive && (actorPlayerId === responderId || actorPlayerId === priorityId);
  const responder = gameState.players.find((p) => p.id === responderId);
  const initiator = gameState.players.find((p) => p.id === initiatorId);

  if (!Array.isArray(gameState.board) || !Array.isArray(gameState.players)) {
    console.error("Invalid gameState detected:", {
      gameState,
      timestamp: new Date().toISOString(),
    });
    return (
      <div className="p-4 text-red-600">
        Error: Invalid game state. Check console for details.
      </div>
    );
  }


  const roomId = typeof window !== 'undefined' ? (new URLSearchParams(window.location.search).get('roomId') || 'default') : 'default';
  return (
    <div className="flex flex-col md:flex-row gap-4 p-4">
      <div className="flex-1">
        <h1 className="text-2xl font-bold mb-2">Room: {roomId}</h1>
        <div className="text-sm text-gray-600 mb-4">You are: {(() => { const p = gameState.players.find(p => p.id === (new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('playerId') || '')); return p?.name || 'Spectator'; })()}</div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* show per-player placements */}
          {gameState.board.map((space: BoardSpace) => {
            const workersPlaced = space.currentWorkers ?? 0;
            const isFull = workersPlaced >= space.capacity;
            const isNotTurn = actorPlayerId !== gameState.activePlayerId;
            const currentPlayer = gameState.players.find((p) => p.id === currentPlayerId);
            const hasNoWorkers = !currentPlayer || currentPlayer.workers <= 0;
            return (
              <div key={space.id} className="border p-4 rounded shadow">
                <h2 className="font-semibold">{space.name}</h2>
                <p className="text-sm text-gray-600 mb-1">{space.description}</p>
                <p>Capacity: {workersPlaced}/{space.capacity}</p>
                <div className="mt-1 text-xs text-gray-700">
                  <div className="font-semibold">Placed by:</div>
                  <ul className="list-disc ml-4">
                    {gameState.players.map(p => {
                      const c = (p.placedWorkers || {})[space.id] || 0;
                      return c > 0 ? <li key={p.id}>{p.name}: {c}</li> : null;
                    })}
                    {gameState.players.every(p => !p.placedWorkers || !(p.placedWorkers[space.id] > 0)) && (
                      <li className="italic text-gray-500">None</li>
                    )}
                  </ul>
                </div>
                <button
                  className="mt-2 px-3 py-1 bg-blue-500 text-white rounded disabled:opacity-50"
                  disabled={isFull || isNotTurn || hasNoWorkers || loading || isInteractive}
                  onClick={() => placeWorker(space.id)}
                >
                  Place Worker
                </button>
              </div>
            );
          })}
        </div>
      </div>
      <div className="w-full md:w-64 flex flex-col gap-4">
        <TurnInfo
          activePlayerId={gameState.activePlayerId}
          priorityPlayerId={gameState.priorityPlayerId}
          players={gameState.players}
        />
        <div className="flex gap-2">
          <button
            className="px-3 py-1 bg-gray-800 text-white rounded disabled:opacity-50"
            disabled={loading || isInteractive}
            onClick={async () => {
              setLoading(true);
              try {
                const res = await fetch("/api/game/nextTurn", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roomId: new URLSearchParams(window.location.search).get('roomId') || 'default' }) });
                const payload = await res.json();
                if (!res.ok || !payload?.ok) {
                  console.error("Next turn error:", payload);
                  if (payload?.state) setGameState(payload.state);
                  return;
                }
                setGameState(payload.state);
              } catch (e) {
                console.error("Network error advancing turn:", e);
              } finally {
                setLoading(false);
              }
            }}
          >
            Next Turn
          </button>
        </div>
        {(() => {
          console.log("NODE_ENV at runtime:", process.env.NODE_ENV, "gameState loaded:", !!gameState);
          return null;
        })()}
        {isInteractive && (
          <div className="p-3 border rounded bg-yellow-50">
            <div className="font-semibold mb-2">Interactive Action</div>
            <div className="text-sm mb-2">
              {(() => {
                const fromP = gameState.players.find(p => p.id === pending!.fromPlayerId)?.name || pending!.fromPlayerId;
                const toP = gameState.players.find(p => p.id === pending!.toPlayerId)?.name || pending!.toPlayerId;
                const t = pending!.data?.type || "interactive";
                const desc = pending!.data?.description ? ` - ${pending!.data.description}` : "";
                return `Action: ${t}. From ${fromP} -> ${toP}${desc}`;
              })()}
            </div>
            {pending!.data?.type === "chooseResourceFromPlayer" && (
              <div className="space-y-2">
                <div className="text-sm text-gray-700">
                  {isResponder ? (
                    <span>You are requested to give a resource to {initiator?.name || initiatorId}.</span>
                  ) : (
                    <span>Waiting for {responder?.name || responderId} to choose a resource.</span>
                  )}
                </div>
                {isResponder && (
                  <>
                    <label className="block text-sm">Choose resource</label>
                    <select
                      className="border p-1 rounded w-full"
                      value={selectedResourceId}
                      onChange={(e) => setSelectedResourceId(e.target.value)}
                    >
                      <option value="">-- Select --</option>
                      {gameState.resources
                        .filter(r => {
                          const amountRequired = pending!.data?.amount ?? transferAmount ?? 1;
                          const available = responder?.resources[r.id] || 0;
                          return available >= amountRequired;
                        })
                        .map(r => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      {(() => {
                        const hasAny = gameState.resources.some(r => (responder?.resources[r.id] || 0) >= (pending!.data?.amount ?? transferAmount ?? 1));
                        return !hasAny ? <option value="__skip__">No resources - Skip</option> : null;
                      })()}
                    </select>
                    <label className="block text-sm">Amount</label>
                    <input
                      type="number"
                      min={1}
                      className="border p-1 rounded w-full"
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(parseInt(e.target.value || "1", 10))}
                    />
                    <button
                      disabled={!selectedResourceId || responding}
                      onClick={async () => {
                        if (!selectedResourceId) return;
                        setResponding(true);
                        try {
                          const isSkip = selectedResourceId === "__skip__";
                          const res = await fetch("/api/game/respondAction", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              roomId: new URLSearchParams(window.location.search).get('roomId') || 'default',
                              playerId: currentPlayerId,
                              actionId: pending!.effectId,
                              choice: isSkip ? { skip: true } : { resourceId: selectedResourceId, amount: transferAmount }
                            })
                          });
                          const payload = await res.json();
                          if (!res.ok) {
                            console.error("Respond action error:", payload);
                            if (payload?.state) setGameState(payload.state);
                            return;
                          }
                          if (payload?.state) setGameState(payload.state);
                          setSelectedResourceId("");
                          setTransferAmount(1);
                        } catch (err) {
                          console.error("Network error responding to action:", err);
                        } finally {
                          setResponding(false);
                        }
                      }}
                      className="px-3 py-1 bg-blue-600 text-white rounded disabled:opacity-50"
                    >
                      Submit Choice
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
        {process.env.NODE_ENV === "development" && (
          <Sheet>
            <SheetTrigger asChild>
              <button className="fixed bottom-4 right-4 z-50 bg-blue-500 text-white px-3 py-1 rounded shadow-lg">
                Debug
              </button>
            </SheetTrigger>
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle>Debug Panel</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4 px-4">
                <div className="text-sm text-gray-600">
                  Viewing as:{" "}
                  {gameState.players.find((p) => p.id === currentPlayerId)?.name || "Unknown"}
                </div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={autoSwitch}
                    onChange={(e) => setAutoSwitch(e.target.checked)}
                  />
                  Auto-Switch to Priority
                </label>
                {!autoSwitch && (
                  <select
                    className="border p-1 rounded w-full"
                    value={controlledPlayerId || ""}
                    onChange={(e) => setControlledPlayerId(e.target.value)}
                  >
                    <option value="">-- Select Player --</option>
                    {gameState.players.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </SheetContent>
          </Sheet>
        )}
        <PlayerList players={gameState.players} resources={gameState.resources} />
        <ResourceList resources={gameState.resources} />
        {/* Summary of placed workers per player */}
        <div className="mt-2 text-sm text-gray-700">
          <div className="font-semibold">Placed Workers (by Player):</div>
          <ul className="list-disc ml-4">
            {gameState.players.map(p => (
              <li key={p.id}>
                {p.name}: {Object.values(p.placedWorkers || {}).reduce((a, b) => a + (b || 0), 0)}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex gap-2">
          <button
            className="px-3 py-1 bg-amber-600 text-white rounded disabled:opacity-50"
            disabled={loading || isInteractive || (() => {
              const p = gameState.players.find(p => p.id === currentPlayerId);
              const placed = Object.values(p?.placedWorkers || {}).reduce((a,b)=>a+(b||0),0);
              return placed === 0;
            })()}
            onClick={async () => {
              if (!confirm("Recall all your placed workers? This uses your turn.")) return;
              setLoading(true);
              try {
                const res = await fetch("/api/game/recall", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ playerId: currentPlayerId, roomId: new URLSearchParams(window.location.search).get('roomId') || 'default' }),
                });
                const payload = await res.json();
                if (!res.ok || !payload?.ok) {
                  console.error("Recall error:", payload);
                  if (payload?.state) setGameState(payload.state);
                  return;
                }
                setGameState(payload.state);
              } catch (e) {
                console.error("Network error recalling workers:", e);
              } finally {
                setLoading(false);
              }
            }}
          >
            Recall Workers
          </button>
        </div>
      </div>
    </div>
  );
}
