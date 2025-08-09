LLM Worker Placement Game (Next.js)

An LLM-driven worker placement board game built with Next.js App Router, TypeScript, Tailwind/ShadCN. Supports Hotseat and Online modes with per-room game state and server-sent events (SSE) for live updates.

Features
- Hotseat and Online game modes
- Room-based multiplayer with per-room game state
- Host auto-joins as a player in Online mode
- Join by room ID or via a list of active rooms
- Name prompt when joining without a name
- Live updates via SSE (turn changes, placements, etc.)
- Interactive effects supported in-game (priority/turn separation)

Getting Started
1) Install and run dev server

```bash
npm install
npm run dev
```

2) Open http://localhost:3000

How to Play
- Hotseat
  - Select Hotseat and click Start Game. Two local players are initialized and you can play on one device.
- Online
  - Select Online.
  - Enter a name (or you’ll be prompted later).
  - Click Host Room (creates the room, auto-joins you as a player, and updates the URL with ?roomId and ?playerId).
  - Share the URL with others. They can click Join Room (or List Rooms -> Join). If they didn’t type a name, a prompt will appear.
  - The board header shows Room: <roomId> and You are: <name>.
  - All clients receive updates live via SSE when someone makes a move or the turn advances.

API Overview
- POST /api/llm/init — Initialize a room. Body: { roomId?: string, mode?: "hotseat" | "online", players?: Partial<Player>[] }
- GET /api/game/state?roomId=ROOM — Get room state
- POST /api/rooms/join — Join a room. Body: { roomId: string, name?: string }
- GET /api/rooms/list — List active rooms
- GET /api/rooms/sse?roomId=ROOM — SSE stream for live state updates
- POST /api/game/placeWorker — Place worker. Body: { roomId, playerId, spaceId }
- POST /api/game/respondAction — Respond to interactive effect. Body: { roomId, playerId, actionId, choice }
- POST /api/game/nextTurn — Advance turn. Body: { roomId }
- POST /api/game/recall — Recall workers. Body: { roomId, playerId }

Notes & Limitations
- In-memory store only: game state is kept in-process. For production, swap to a shared store (Redis/Postgres) and add pub/sub for SSE across instances.
- Dev HMR: If you see odd behavior after code changes, stop/restart the dev server to reset the in-memory store.
- SSE assumes a single server instance. For multi-instance hosting, use Redis pub/sub (or similar) to broadcast updates.

Project Structure
- app/ — Next.js routes and UI
- app/api — API routes for game/rooms
- lib/ — Game state, effects, utilities
- types/ — Shared TypeScript types
- mock/ — Local mock data for initial board/resources
- tests/ — Unit tests for core services
