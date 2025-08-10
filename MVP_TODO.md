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
- [x] MySQL JSON snapshot persistence in prod (Prisma); InMemory in dev; add Redis pub/sub for multi-instance SSE ⏳
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

### Phase 1: Registry foundation
- [x] Define `MechanicSpec` interface with apply() returning ApplyResult and optional resolve()
- [x] Registry utilities: `registerMechanic`, `getMechanic`, `executeMechanic`
- [x] Seed registry with mechanics:
  - [x] `gain` — `{ resourceId: string, amount: number }`
  - [x] `lose` — `{ resourceId: string, amount: number }`
  - [x] `move` — `{ fromSpaceId: string, toSpaceId: string }`
  - [x] `interactive` — generic pending creation with permissive resolve for backward-compat
  - [x] `chooseResourceFromPlayer` — split out into a dedicated mechanic with strict resolve
- [x] Refactor `lib/effects/index.ts` to delegate to registry and set pendingAction on pending ApplyResult
- [x] Route `respondAction` to `mechanic.resolve` generically
- [x] Regression: all existing behavior covered by tests

### Phase 2: LLM discovery and creation
- [ ] Add LLM-callable discovery function `list_mechanics()` returning:
  - [ ] `id`, `displayName`, `description`, optional schemas
- [ ] Add creation functions with validation:
  - [ ] `create_space({ roomId, name, description, capacity, mechanicId, config })`
  - [ ] `create_resource({ roomId, name, description, id? })`
- [ ] Optional validators and helpers (validate_space, list_spaces/resources, update/remove)
- [ ] Tests: list/creation happy path, validation errors (space + resource).

### Phase 3: Generalize interactive flow
- [x] Extend `PendingAction` to include `mechanicId`
- [x] Route `respondAction` to the mechanic’s `resolve`
- [ ] Add optional hooks per mechanic: `canApply`, `getChoices`
- [ ] Tests: pending creation, choice validation, resolve side effects.

### Phase 4: Board evolution (optional)
- [ ] Migrate `BoardSpace.effect` to `BoardSpace.mechanicId` + `config` (keep backward compatibility during migration).
- [ ] Prepare structure for future triggers (`onPlace` only for now; later `onRespond`, `onTurnStart`, `onRecall`).

### Initial Mechanic Templates (LLM-friendly)
- [ ] `gain` — `{ resourceId, amount }`
- [ ] `lose` — `{ resourceId, amount }`
- [ ] `move` — `{ fromSpaceId, toSpaceId }`
- [ ] `chooseResourceFromPlayer` — `{ amount, targetPlayerId? }`

### LLM Function Surface (server-side)
- [ ] `list_mechanics()`
- [ ] `create_space({ roomId, name, description, capacity, mechanicId, config, id? })`
- [ ] `update_space({ roomId, spaceId, patch })`
- [ ] `remove_space({ roomId, spaceId })`
- [ ] `list_spaces({ roomId })`
- [ ] `validate_space({ roomId, mechanicId, config })`

Notes
- Validate inputs via schema (zod or JSON Schema via ajv).
- Always return updated state with structured error codes for grounding.
- Provide `validTargets`/`choices` when a mechanic requires selection.
- Maintain stable IDs and include summaries for LLM reference.
