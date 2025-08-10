LLM Worker Placement Game (Next.js)

An LLM-driven worker placement board game built with Next.js App Router, TypeScript, Tailwind/ShadCN. Supports Hotseat and Online modes with per-room game state and server-sent events (SSE) for live updates.

Features
- Hotseat and Online game modes
- Room-based multiplayer with per-room game state
- Host auto-joins as a player in Online mode
- Join by room ID or via a list of active rooms
- Name prompt when joining without a name
- Live updates via SSE (turn changes, placements, etc.)
- Mechanics registry with clear ApplyResult contract (ok | noop | pending | error)
- Generic interactive flow: mechanics can return pending and provide a resolve() to finish
- Domain helpers for concise mechanics (selectors and mutators)
- Built-in mechanics: gain, lose, move, interactive, chooseResourceFromPlayer
- Save reusable setup templates (resources + board) and host from a saved setup
- MySQL persistence (JSON snapshot) with Prisma, enabled in prod via env

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
- POST /api/llm/init — Initialize a room. Body: { roomId?: string, mode?: "hotseat" | "online", players?: Partial<Player>[], setupId?: string }
- GET /api/game/state?roomId=ROOM — Get room state
- POST /api/rooms/join — Join a room. Body: { roomId: string, name?: string }
- GET /api/rooms/list — List active rooms
- GET /api/rooms/sse?roomId=ROOM — SSE stream for live state updates
- POST /api/game/placeWorker — Place worker. Body: { roomId, playerId, spaceId }
- POST /api/game/respondAction — Respond to interactive effect. Body: { roomId, playerId, actionId, choice }
- POST /api/game/nextTurn — Advance turn. Body: { roomId }
- POST /api/game/recall — Recall workers. Body: { roomId, playerId }

Notes & Limitations
- Dev uses in-memory state; production enables MySQL persistence via env. For multi-instance SSE, add Redis pub/sub.
- Dev HMR: If you see odd behavior after code changes, stop/restart the dev server to reset the in-memory store.
- SSE assumes a single server instance. For multi-instance hosting, use Redis pub/sub (or similar) to broadcast updates.

Project Structure
- app/ — Next.js routes and UI
- app/api — API routes for game/rooms and setups
- lib/ — Game state, mechanics registry, effects, domain helpers, utilities, setup helpers, and stores
  - lib/mechanics — registry, built-ins with apply/resolve
  - lib/domain — selectors and mutators used by mechanics
- prisma/ — Prisma schema for MySQL persistence
- types/ — Shared TypeScript types
- mock/ — Local mock data for initial board/resources
- tests/ — Unit tests for core services and mechanics

Mechanics Authoring Guide
- Mechanics live under `lib/mechanics` and are registered on import.
- Each mechanic implements `apply(state, ctx)` and may optionally implement `resolve(state, pending, choice)` for interactive flows.
- `apply` returns an ApplyResult:
  - `{ kind: "ok" }` — state updated, no pending action
  - `{ kind: "noop" }` — no changes
  - `{ kind: "pending", pending }` — create a pending action; engine saves it and defers turn advance
  - `{ kind: "error", code, message }` — validation or runtime failure
- For interactive mechanics, return `pending` with `mechanicId` and any data the UI needs (e.g., amount, prompt, allowed resourceIds). The game service will call your `resolve` when the responder submits a choice.

Minimal example
```ts
// lib/mechanics/myGain.ts (or add to builtin list)
import type { MechanicSpec } from "./registry";
import { getPlayerById } from "@/lib/domain/selectors";
import { grantResource } from "@/lib/domain/mutators";

export const myGain: MechanicSpec = {
  id: "myGain",
  displayName: "Gain Resource",
  description: "Gain N of a resource",
  apply(state, { playerId, payload }) {
    const player = getPlayerById(state, playerId);
    const { resourceId, amount = 1 } = payload || {};
    if (!player) return { kind: "error", code: "PLAYER_NOT_FOUND", message: "Player not found" };
    if (!resourceId) return { kind: "error", code: "INVALID_PAYLOAD", message: "resourceId required" };
    grantResource(player, resourceId, amount);
    return { kind: "ok" };
  },
};
```

Interactive example (apply + resolve)
```ts
import type { MechanicSpec, Pending } from "./registry";
import { getPlayerById } from "@/lib/domain/selectors";
import { transferResource } from "@/lib/domain/mutators";

export const takeFromOpponent: MechanicSpec = {
  id: "takeFromOpponent",
  displayName: "Take Resource",
  description: "Target player gives you N of a chosen resource",
  apply(state, { playerId, payload }) {
    const amount = payload?.amount ?? 1;
    const targetPlayerId = payload?.targetPlayerId; // optional: UI can ask later
    return {
      kind: "pending",
      pending: {
        id: "",
        mechanicId: "takeFromOpponent",
        fromPlayerId: playerId,
        toPlayerId: targetPlayerId,
        data: { amount },
      },
    };
  },
  resolve(state, pending, choice) {
    if (choice?.skip) return { kind: "ok" };
    const giver = getPlayerById(state, pending.toPlayerId || "");
    const taker = getPlayerById(state, pending.fromPlayerId);
    if (!giver || !taker) return { kind: "error", code: "PLAYER_NOT_FOUND", message: "Players not found" };
    const amount = pending.data?.amount ?? choice?.amount ?? 1;
    const resourceId = choice?.resourceId;
    if (!resourceId) return { kind: "error", code: "INVALID_CHOICE", message: "resourceId required" };
    const tr = transferResource(giver, taker, resourceId, amount);
    if (!tr.ok) return { kind: "error", code: tr.code, message: tr.message };
    return { kind: "ok" };
  },
};
```

Registering
- Add your mechanic to the list in `lib/mechanics/builtin.ts` or import/register it in `lib/mechanics/index.ts`.
- Effects reference mechanics by `effect.type` and pass `effect.payload` to `apply`.

