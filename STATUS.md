Project Status & Structure

## Overview
This project is an **LLM-driven worker placement board game** built with **Next.js App Router**, **TypeScript**, and **TailwindCSS/ShadCN**.
The game world (resources, board spaces, effects, capacities) is generated at the start, currently using mock data but designed for future LLM integration.

---

## Current Layout

```
/app
  /api
    /llm/init/route.ts     # Initializes game state from mock or LLM
  /start/page.tsx          # Start screen UI, imports modular components
/components
  /TurnInfo/TurnInfo.tsx   # Displays current turn and priority player
  /PlayerList/PlayerList.tsx # Shows players, workers, and resources
  /ResourceList/ResourceList.tsx # Lists resources with descriptions
  /BoardList/BoardList.tsx # Displays board spaces with capacity
/lib
gameState.ts             # In-memory + pluggable store (MySQL in prod)
llm.ts                   # Loads mock data or calls LLM
setup.ts                 # Helpers to save and hydrate setup templates
/mechanics               # Registry and built-in mechanics
/store                   # In-memory/MySQL stores + setup store
/mock
  init.json                # Example game data for local testing
/types
  game.ts                  # TypeScript interfaces for game entities
MVP_TODO.md                # Detailed MVP implementation checklist
STATUS.md                  # This file
```

---

## Best Practices for Adding Content

### 1. **Components**
- Place UI components in `/components` with **one folder per component**.
- Each folder should contain:
  - `ComponentName.tsx` – The main component file.
  - Optional: `ComponentName.test.tsx` for unit tests.
- Keep components **presentational**; avoid direct state mutations inside them.

### 2. **State Management**
- All game state changes should go through functions in `lib/gameState.ts`.
- Avoid mutating state directly in components or API routes.

### 3. **API Routes**
- Place under `/app/api/` with one folder per route.
- Keep routes **thin**: validate input, call state functions, return JSON.

### 4. **Types**
- Define all shared types in `/types/game.ts`.
- Use these types in both frontend and backend code to ensure consistency.

### 5. **Mock & LLM Data**
- Store local test data in `/mock`.
- When integrating LLM, ensure output matches the `GameState` structure.

### 6. **Styling**
- Use TailwindCSS utility classes for layout and styling.
- For reusable UI patterns, create ShadCN components.

### 7. **Extending the Game**
- Add new effect types in `/lib/effects/`.
- Keep effect logic modular so LLM can generate new ones without breaking existing code.

---

## Next Steps / Current Status
- `/board` page for gameplay — done ✅
- Effect execution system — done ✅
- API error handling — improved ✅
- Replace mock data with LLM-generated content — in progress ⏳
- Multiplayer/rooms — basic done ✅ (per-room state, join/host/list, name prompt, SSE live updates)
- Persistence — MySQL JSON snapshot in prod ✅ (Prisma). For multi-instance SSE, add Redis pub/sub ⏳

---

## 2025-08-09 Updates
- Updated `/board/page.tsx` to disable "Place Worker" buttons when the controlled player has no workers left.
- Improved `/api/game/placeWorker` to always return the full game state alongside any error, and to include detailed mismatch info for `playerId` and `spaceId`.
- Modified `/` route (`app/page.tsx`) so the Start Game button calls `/api/llm/init` before rendering the board, ensuring the server game state is initialized.
- Added client-side error handling in `/board/page.tsx` to avoid overwriting game state with error objects and to log server-returned state for debugging.

## 2025-08-09 Additional Updates
- Verified all MVP core features are implemented and functional.
- Reviewed `lib/effects` to confirm support for both simple and interactive effects.
- Confirmed API routes return structured errors and updated state consistently.
- Prepared for LLM integration by ensuring `lib/llm.ts` and `/api/llm/init` can swap mock data for generated content without breaking type safety.

## 2025-08-10 Updates
- Mechanics registry introduced and effect execution refactored to registry ✅
- Added LLM helper functions (list mechanics, create resource) ✅
- MySQL store (Prisma) added with optimistic concurrency and retries ✅
- InMemoryStore silenced for dev/tests (no recursive persistence) ✅
- DB.md added with MySQL setup guide ✅
- Setup templates: save/list APIs, UI button to save current setup in Debug panel ✅
- Host From Setup option added (online): initialize room from saved setup ✅

- Introduced a global game state store on `globalThis` to ensure consistent state across API routes during dev/HMR.
- Implemented per-player worker placement tracking (`placedWorkers`), surfaced in UI (per-space and per-player summary).
- Added Recall Workers action and API, with confirmation dialog, that returns workers and counts as a turn (unless none to recall).
- Council Hall interactive flow now passes priority to responder without switching turn; turn advances only after response.
- Server guardrails: block place/next/recall while a pending interactive action exists (`PENDING_ACTION`).
- Client UI disables Place/Next/Recall during pending and auto-switches view to priority (hotseat) while Turn Info shows the true turn owner.
- Council Hall resource selection: filter to only affordable resources, add "No resources - Skip" option; server validates and supports skip.
- New tests covering interactive flow, pending-action blocking, recall behavior, and turn/priority correctness. All tests green (6/6).
