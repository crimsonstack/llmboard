"use client";

import { useState } from "react";
import BoardPage from "./board/page";

export default function Home() {
  const [started, setStarted] = useState(false);
  const [mode, setMode] = useState<"hotseat" | "online">("hotseat");

  return (
    <div className="min-h-screen p-8 sm:p-20">
      {!started ? (
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <h1 className="text-3xl font-bold">LLM Worker Placement Game</h1>
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
          <button
            onClick={async () => {
              try {
                const res = await fetch("/api/llm/init", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ mode }),
                });
                const payload = await res.json();
                if (!res.ok || !payload?.ok) {
                  console.error("Failed to initialize game:", payload || res.statusText);
                  return;
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
        </div>
      ) : (
        <BoardPage />
      )}
    </div>
  );
}
