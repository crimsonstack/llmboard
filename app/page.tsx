"use client";

import { useState } from "react";
import BoardPage from "./board/page";

export default function Home() {
  const [started, setStarted] = useState(false);
  const [mode, setMode] = useState<"hotseat" | "online">("hotseat");
  const [roomId, setRoomId] = useState<string>("");
  const [myPlayerId, setMyPlayerId] = useState<string>("");
  const [rooms, setRooms] = useState<any[]>([]);
  const [showRooms, setShowRooms] = useState<boolean>(false);
  const [showNamePrompt, setShowNamePrompt] = useState<boolean>(false);
  const [pendingJoinRoomId, setPendingJoinRoomId] = useState<string | null>(null);
  const [tempName, setTempName] = useState<string>("");


  return (
    <div className="min-h-screen p-8 sm:p-20">
      {!started ? (
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <h1 className="text-3xl font-bold">LLM Worker Placement Game</h1>
          <div className="flex flex-col gap-3 items-center">
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="mode"
                  value="hotseat"
                  checked={mode === "hotseat"}
                  onChange={() => setMode("hotseat")}
                />
                Hotseat
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="mode"
                  value="online"
                  checked={mode === "online"}
                  onChange={() => setMode("online")}
                />
                Online
              </label>
            </div>
            {mode === "online" && (
              <div className="flex gap-2">
                <input
                  placeholder="Room ID (leave blank to auto-generate)"
                  className="border rounded p-2"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                />
                <input
                  placeholder="Your Player Name"
                  className="border rounded p-2"
                  value={myPlayerId}
                  onChange={(e) => setMyPlayerId(e.target.value)}
                />
              </div>
            )}
          </div>
          <div className="flex gap-2 items-center">
            {mode === "online" && (
              <button
                onClick={async () => {
                  try {
                    const res = await fetch('/api/setup/list');
                    const payload = await res.json();
                    if (!payload?.ok) {
                      alert('Failed to fetch setups');
                      return;
                    }
                    const options = (payload.setups || []).map((s: any) => `${s.id} :: ${s.name}`);
                    const chosen = prompt(`Enter setupId to use:\n${options.join('\n')}`);
                    if (!chosen) return;
                    const setupId = chosen.split('::')[0].trim();
                    const rid = roomId || `room-${Math.random().toString(36).slice(2, 8)}`;
                    const initRes = await fetch('/api/llm/init', {
                      method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ mode, roomId: rid, setupId })
                    });
                    const initPayload = await initRes.json();
                    if (!initRes.ok || !initPayload?.ok) {
                      alert('Failed to init from setup');
                      return;
                    }
                    setRoomId(rid);
                    if (typeof window !== 'undefined') {
                      const url = new URL(window.location.href);
                      url.searchParams.set('roomId', rid);
                      window.history.pushState({}, "", url.toString());
                    }
                    setStarted(true);
                  } catch (e) {
                    alert('Error initializing from setup');
                  }
                }}
                className="px-4 py-2 border rounded"
              >
                Host From Setup
              </button>
            )}
            {mode === "hotseat" ? (
              <button
                onClick={async () => {
                try {
                  const rid = roomId || `room-${Math.random().toString(36).slice(2, 8)}`;
                  const res = await fetch("/api/llm/init", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ mode, roomId: rid }),
                  });
                  const payload = await res.json();
                  if (!res.ok || !payload?.ok) {
                    console.error("Failed to initialize game:", payload || res.statusText);
                    return;
                  }
                  setRoomId(rid);
                  if (typeof window !== 'undefined') {
                    const url = new URL(window.location.href);
                    url.searchParams.set('roomId', rid);
                    window.history.pushState({}, "", url.toString());
                  }
                } catch (err) {
                  console.error("Error initializing game:", err);
                  return;
                }
                setStarted(true);
              }}
              className="px-6 py-3 bg-blue-500 text-white rounded shadow hover:bg-blue-600"
            >
              Start Game
            </button>
            ) : (
            <>
            <button
              onClick={async () => {
                try {
                  const rid = roomId || `room-${Math.random().toString(36).slice(2, 8)}`;
                  // Initialize the room
                  const res = await fetch("/api/llm/init", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ mode, roomId: rid }),
                  });
                  const payload = await res.json();
                  if (!res.ok || !payload?.ok) {
                    console.error("Failed to initialize room:", payload || res.statusText);
                    return;
                  }
                  // Auto-join the host as a player
                  const joinRes = await fetch(`/api/rooms/join`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ roomId: rid, name: myPlayerId || undefined })
                  });
                  const joinPayload = await joinRes.json();
                  if (!joinRes.ok || !joinPayload?.ok) {
                    console.error("Failed to join as host:", joinPayload || joinRes.statusText);
                    return;
                  }
                  setRoomId(rid);
                  if (typeof window !== 'undefined') {
                    const url = new URL(window.location.href);
                    url.searchParams.set('roomId', rid);
                    if (joinPayload.playerId) url.searchParams.set('playerId', joinPayload.playerId);
                    window.history.pushState({}, "", url.toString());
                  }
                } catch (err) {
                  console.error("Error hosting room:", err);
                  return;
                }
                setStarted(true);
              }}
              className="px-6 py-3 bg-blue-500 text-white rounded shadow hover:bg-blue-600"
            >
              Host Room
            </button>
            <button
              onClick={async () => {
                if (!roomId) {
                  alert("Enter the Room ID to join.");
                  return;
                }
                if (!myPlayerId.trim()) {
                  setPendingJoinRoomId(roomId);
                  setTempName("");
                  setShowNamePrompt(true);
                  return;
                }
                try {
                  const res = await fetch(`/api/rooms/join`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ roomId, name: myPlayerId || undefined })
                  });
                  const payload = await res.json();
                  if (!res.ok || !payload?.ok) {
                    console.error("Failed to join room:", payload || res.statusText);
                    return;
                  }
                  if (typeof window !== 'undefined') {
                    const url = new URL(window.location.href);
                    url.searchParams.set('roomId', roomId);
                    if (payload.playerId) url.searchParams.set('playerId', payload.playerId);
                    window.history.pushState({}, "", url.toString());
                  }
                } catch (err) {
                  console.error("Error joining room:", err);
                  return;
                }
                setStarted(true);
              }}
              className="px-6 py-3 bg-green-600 text-white rounded shadow hover:bg-green-700"
            >
              Join Room
            </button>
            <button
              onClick={async () => {
                try {
                  setShowRooms(true);
                  const res = await fetch('/api/rooms/list');
                  const payload = await res.json();
                  if (payload?.ok) setRooms(payload.rooms || []);
                } catch (e) {
                  console.error('Failed to fetch rooms', e);
                }
              }}
              className="px-4 py-2 border rounded"
            >
              List Rooms
            </button>
            </>
          )}
          </div>
        </div>
      ) : (
        <BoardPage />
      )}

      {showRooms && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow p-6 w-full max-w-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Active Rooms</h2>
              <button className="text-gray-600" onClick={() => setShowRooms(false)}>✕</button>
            </div>
            <div className="space-y-3 max-h-80 overflow-auto">
              {rooms.length === 0 && (
                <div className="text-sm text-gray-500">No rooms yet. Host one!</div>
              )}
              {rooms.map((r) => (
                <div key={r.id} className="border rounded p-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{r.id}</div>
                    <div className="text-xs text-gray-600">Mode: {r.mode || 'unknown'} · Players: {r.players?.length || 0} · Board: {r.boardSize}</div>
                  </div>
                  <button
                    className="px-3 py-1 bg-green-600 text-white rounded"
                    onClick={async () => {
                      if (!myPlayerId.trim()) {
                        setPendingJoinRoomId(r.id);
                        setTempName("");
                        setShowNamePrompt(true);
                        return;
                      }
                      try {
                        const res = await fetch(`/api/rooms/join`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ roomId: r.id, name: myPlayerId || undefined })
                        });
                        const payload = await res.json();
                        if (!res.ok || !payload?.ok) {
                          console.error("Failed to join room:", payload || res.statusText);
                          return;
                        }
                        setRoomId(r.id);
                        if (typeof window !== 'undefined') {
                          const url = new URL(window.location.href);
                          url.searchParams.set('roomId', r.id);
                          if (payload.playerId) url.searchParams.set('playerId', payload.playerId);
                          window.history.pushState({}, "", url.toString());
                        }
                        setStarted(true);
                        setShowRooms(false);
                      } catch (err) {
                        console.error('Join room failed', err);
                      }
                    }}
                  >
                    Join
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

     {showNamePrompt && (
       <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
         <div className="bg-white rounded shadow p-6 w-full max-w-sm">
           <h3 className="text-lg font-semibold mb-2">Enter your name</h3>
           <input
             className="border rounded p-2 w-full mb-3"
             placeholder="Your name"
             value={tempName}
             onChange={(e) => setTempName(e.target.value)}
           />
           <div className="flex justify-end gap-2">
             <button className="px-3 py-1 border rounded" onClick={() => { setShowNamePrompt(false); setPendingJoinRoomId(null); }}>Cancel</button>
             <button
               className="px-3 py-1 bg-green-600 text-white rounded"
               onClick={async () => {
                 const rid = pendingJoinRoomId || roomId;
                 const name = tempName.trim();
                 if (!rid || !name) return;
                 try {
                   const res = await fetch(`/api/rooms/join`, {
                     method: 'POST',
                     headers: { 'Content-Type': 'application/json' },
                     body: JSON.stringify({ roomId: rid, name })
                   });
                   const payload = await res.json();
                   if (!res.ok || !payload?.ok) {
                     console.error("Failed to join room:", payload || res.statusText);
                     return;
                   }
                   setRoomId(rid);
                   setMyPlayerId(name);
                   if (typeof window !== 'undefined') {
                     const url = new URL(window.location.href);
                     url.searchParams.set('roomId', rid);
                     if (payload.playerId) url.searchParams.set('playerId', payload.playerId);
                     window.history.pushState({}, "", url.toString());
                   }
                   setStarted(true);
                   setShowRooms(false);
                   setShowNamePrompt(false);
                   setPendingJoinRoomId(null);
                 } catch (err) {
                   console.error('Join room failed', err);
                 }
               }}
             >
               Join
             </button>
           </div>
         </div>
       </div>
     )}
    </div>
  );
}
