# MVP Implementation TODO List - LLM Worker Placement Game

## 1. Core Data & State
- [x] Define TypeScript interfaces for `Resource`, `BoardSpace`, `Effect`, `Player`, `PendingAction`, and `GameState` (`types/game.ts`).
- [x] Implement in-memory game state management (`lib/gameState.ts`):
  - `initGameState()`
  - `getGameState()`
  - `setGameState()`
  - `placeWorker()` with capacity check
  - Turn and priority management functions
- [x] Create mock data for local testing (`mock/init.json`).

---

## 2. LLM Integration
- [x] Create `lib/llm.ts` to load mock data and placeholder for LLM generation.
- [x] Implement `/api/llm/init` route to:
  - Load mock data
  - Create test players
  - Initialize game state
  - Return `resources`, `board`, `players`, `activePlayerId`, `priorityPlayerId`
- [ ] Replace mock data with LLM-generated resources, board spaces, effects, and capacities.
- [ ] Ensure LLM output matches `GameState` structure.
- [ ] Add prompt templates for LLM to generate balanced game setups.

---

## 3. UI Implementation
- [x] Home screen UI with mode selection (Hotseat/Online)
  - Hotseat: Start Game button
  - Online: Host Room, Join Room, List Rooms, join name prompt
- [x] Board header shows Room ID and current viewer's player name
- [x] Add **Turn Info** panel showing:
  - Current active player
  - Priority player if applicable
- [x] Add **Player List** and **Resource List**
- [x] Style UI with Tailwind/ShadCN for clean layout.

---

## 4. Game Interaction
- [x] Create `/board` page to handle actual gameplay:
  - Render board spaces with worker placement buttons
  - Disable placement if space is full, not player’s turn, player has no workers left, or an interactive action is pending
  - Trigger effects on placement (basic structure in place, effect logic pending)
- [x] Implement effect execution system:
  - Simple effects (`gain`, `lose`, `move`) — implemented in `lib/effects` and integrated into `/api/game/placeWorker`
  - Interactive effects (`chooseResourceFromPlayer`) — supported via `interactive` type in `lib/effects` and handled in `/api/game/respondAction`
  - Priority/Turn separation: effects can set `priorityPlayerId` for responses without switching `activePlayerId`; advance only after response
- [x] Add API routes for:
  - `/api/game/placeWorker` — implemented with validation, worker placement, effect trigger integration, and structured error handling; blocked while pending interactive action
  - `/api/game/respondAction` — implemented with pending action check, choice application for interactive effects (with skip and server-side validation), and state update; clears priority and advances turn
  - `/api/game/nextTurn` — implemented to advance active player and turn counter; blocked while pending interactive action
  - `/api/game/recall` — implemented to recall all placed workers for the current player; counts as a turn only if any workers were recalled

---

## 5. Persistence & Multiplayer
- [ ] Swap in-memory state for persistent store (Redis, Supabase, Postgres).
- [x] Add server-sent events (SSE) for real-time updates (single instance).
- [x] Implement player joining/leaving system (basic; join via API, host auto-join).
- [ ] Add multi-instance real-time via Redis pub/sub (or similar).
- [ ] Persist rooms/players and add auth.

---

## 6. Testing & QA
- [x] Add unit tests for `lib/gameService.ts` and `lib/gameState.ts`.
- [ ] Add integration tests for API routes.
- [ ] Add end-to-end tests for gameplay flow.

---

## 7. Polish & UX
- [ ] Improve error messages and user feedback in UI.
- [ ] Add animations for worker placement and resource changes.
- [ ] Make UI responsive for mobile devices.

---

## 8. Mechanics Registry & LLM Creation API Roadmap

### Phase 1: Registry foundation (no behavior changes)
- [ ] Define `MechanicSpec` interface and registry utilities:
  - [ ] `registerMechanic(spec)`
  - [ ] `getMechanic(id)`
  - [ ] `executeMechanic(id, config, ctx)` where `ctx = { playerId, spaceId, roomId? }`
- [ ] Seed registry with current mechanics:
  - [ ] `gain` — payload: `{ resourceId: string, amount: number }`
  - [ ] `lose` — payload: `{ resourceId: string, amount: number }`
  - [ ] `move` — payload: `{ fromSpaceId: string, toSpaceId: string }`
  - [ ] `council_request` (generalized interactive request)
- [ ] Refactor `lib/effects/index.ts` to delegate to registry (treat `effect.type` as `mechanicId`, `effect.payload` as `config`).
- [ ] Keep `PendingAction` and `respondAction` logic as-is for now; ensure identical gameplay behavior.
- [ ] Regression: all existing tests pass.

### Phase 2: LLM discovery and creation
- [ ] Add LLM-callable discovery function `list_mechanics()` returning:
  - [ ] `id`, `displayName`, `description`, `payloadSchema`, `requiresResponse`
- [ ] Add creation functions with validation:
  - [ ] `create_space({ roomId, name, description, capacity, mechanicId, config })`
    - [ ] mechanic exists, capacity >= 1, `config` matches `payloadSchema`
    - [ ] append to `state.board` with `currentWorkers = 0`
  - [ ] `create_resource({ roomId, name, description, id? })`
    - [ ] unique id (if provided) and unique name checks
    - [ ] initialize players' resource maps to 0 for the new resource
- [ ] Optional: validators and helpers
  - [ ] `validate_space({ roomId, mechanicId, config })` to preflight configs
  - [ ] `list_spaces({ roomId })`
  - [ ] `list_resources({ roomId })`
  - [ ] `update_space({ roomId, spaceId, patch })`
  - [ ] `remove_space({ roomId, spaceId })`
- [ ] Tests: list/creation happy path, validation errors (space + resource).

### Phase 3: Generalize interactive flow
- [ ] Extend `PendingAction` to include:
  - [ ] `mechanicId`, `spaceId`
  - [ ] `responseSchema`, `prompt`, `choices[]`
- [ ] Route `respondAction` to the mechanic’s `onRespond` instead of hard-coded logic.
- [ ] Add optional hooks per mechanic:
  - [ ] `validate(state, ctx)` for pre-place checks (e.g., costs)
  - [ ] `getChoices(state, ctx)` to supply UI/LLM options
- [ ] Tests: pending creation, choice validation, onRespond side effects.

### Phase 4: Board evolution (optional)
- [ ] Migrate `BoardSpace.effect` to `BoardSpace.mechanicId` + `config` (keep backward compatibility during migration).
- [ ] Prepare structure for future triggers (`onPlace` only for now; later `onRespond`, `onTurnStart`, `onRecall`).

### Initial Mechanic Templates (LLM-friendly)
- [ ] `gain` — `{ resourceId, amount }`
- [ ] `lose` — `{ resourceId, amount }`
- [ ] `move` — `{ fromSpaceId, toSpaceId }`
- [ ] `council_request` — `{ amount?, resourceId?, targetPlayerId? }` (uses pending/priority; onRespond later moved into the mechanic)

### LLM Function Surface (server-side)
- [ ] `list_mechanics()`
- [ ] `create_space({ roomId, name, description, capacity, mechanicId, config, id? })`
- [ ] `update_space({ roomId, spaceId, patch })`
- [ ] `remove_space({ roomId, spaceId })`
- [ ] `list_spaces({ roomId })`
- [ ] `validate_space({ roomId, mechanicId, config })`

Notes
- Validate inputs via JSON Schema (basic validator to start; AJV optional later).
- Always return updated state with structured error codes for grounding.
- Provide `validTargets`/`choices` in errors when a mechanic requires selection.
- Maintain stable IDs and include summaries for LLM reference.
