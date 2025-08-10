MySQL Setup Guide for LLM Worker Placement Game

This guide describes how to set up a minimal MySQL schema so game rooms and their GameState snapshots can be persisted in production. It uses a simple, safe JSON-snapshot model (fast to implement; great for LLM-generated content that changes shape). You can later migrate to a normalized schema if you need heavier querying.

Recommended MySQL version
- MySQL 8.0+ (recommended) or 5.7.8+ (JSON supported).
- If using PlanetScale: foreign keys are typically not supported/enforced; handle cascading in application code.

1) Create database and user
- Adjust database, user, host, and password values as needed.

```sql
-- As an admin user:
CREATE DATABASE llmboard CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'llmboard_user'@'%' IDENTIFIED BY 'REPLACE_WITH_STRONG_PASSWORD';
GRANT ALL PRIVILEGES ON llmboard.* TO 'llmboard_user'@'%';
FLUSH PRIVILEGES;
```

2) Create tables (JSON snapshot model)
- This model stores one row per room in `rooms`, and a single JSON `state` snapshot per room in `game_states`.
- We use optimistic concurrency with a `version` column to avoid clobbering concurrent updates.

```sql
USE llmboard;

-- Rooms table (minimal; add columns as you need)
CREATE TABLE IF NOT EXISTS rooms (
  id          VARCHAR(191) NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Game state snapshots (one per room)
CREATE TABLE IF NOT EXISTS game_states (
  room_id     VARCHAR(191) NOT NULL,
  state       JSON NOT NULL,
  version     INT NOT NULL DEFAULT 1,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (room_id)
  -- If not on PlanetScale, you can add a foreign key for data integrity:
  -- , CONSTRAINT fk_game_states_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Optional: index by update time for sorting latest rooms
CREATE INDEX IF NOT EXISTS idx_game_states_updated_at ON game_states (updated_at);
```

3) Basic usage patterns
- Insert/create a room and its initial state:

```sql
INSERT INTO rooms (id) VALUES ("ROOM123");
INSERT INTO game_states (room_id, state, version) VALUES (
  "ROOM123",
  JSON_OBJECT(
    "resources", JSON_ARRAY(),
    "board", JSON_ARRAY(),
    "players", JSON_ARRAY(),
    "activePlayerId", "",
    "currentTurn", 1
  ),
  1
);
```

- Read current state:

```sql
SELECT room_id, state, version FROM game_states WHERE room_id = "ROOM123";
```

- Update with optimistic concurrency (only succeeds if the version matches):

```sql
-- Example: increment version and replace state atomically
UPDATE game_states
SET state = JSON_SET(state, '$.currentTurn', JSON_EXTRACT(state, '$.currentTurn') + 1),
    version = version + 1
WHERE room_id = "ROOM123" AND version = 1;  -- expected prior version
```

- Replace whole JSON (server will produce the entire new snapshot):

```sql
UPDATE game_states
SET state = CAST(? AS JSON),  -- supply full JSON text via parameter
    version = version + 1
WHERE room_id = ? AND version = ?;
```

4) Application environment configuration
- Add an environment variable that your app can use to choose persistence mode and connect to MySQL in production.

```
# .env.production (example)
PERSIST_STORE=mysql
DATABASE_URL="mysql://llmboard_user:REPLACE_WITH_STRONG_PASSWORD@your-host:3306/llmboard"
```

5) Operational notes
- Concurrency: always use the version column when saving. If the update returns 0 rows, re-read, re-apply mutation, and retry.
- Backup: dump JSON snapshots with mysqldump. Restores are easy because each row is the full state.
- PlanetScale: avoid foreign keys; do application-level cascade (delete game_states row when deleting room).
- Indexes: the JSON model doesn’t require many. If you need to query by fields inside JSON, consider generated columns and secondary indexes.

6) Optional: normalized schema (advanced)
If you need stronger integrity and queryability, you can move to a normalized schema. This is more involved and will require transactional updates per operation. A sketch:

```sql
-- Sketch only: adjust types/sizes/constraints as needed
CREATE TABLE rooms (
  id          VARCHAR(191) PRIMARY KEY,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE players (
  id          VARCHAR(191) PRIMARY KEY,
  room_id     VARCHAR(191) NOT NULL,
  name        VARCHAR(191) NOT NULL,
  workers     INT NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_players_room (room_id)
);

CREATE TABLE resources (
  id          VARCHAR(191) PRIMARY KEY,
  room_id     VARCHAR(191) NOT NULL,
  name        VARCHAR(191) NOT NULL,
  description TEXT,
  UNIQUE KEY uniq_resources_room_name (room_id, name),
  KEY idx_resources_room (room_id)
);

CREATE TABLE player_resources (
  player_id   VARCHAR(191) NOT NULL,
  resource_id VARCHAR(191) NOT NULL,
  amount      INT NOT NULL DEFAULT 0,
  PRIMARY KEY (player_id, resource_id)
);

CREATE TABLE board_spaces (
  id           VARCHAR(191) PRIMARY KEY,
  room_id      VARCHAR(191) NOT NULL,
  name         VARCHAR(191) NOT NULL,
  description  TEXT,
  capacity     INT NOT NULL,
  mechanic_id  VARCHAR(191) NOT NULL,
  config       JSON NOT NULL
);

CREATE TABLE placed_workers (
  player_id VARCHAR(191) NOT NULL,
  space_id  VARCHAR(191) NOT NULL,
  count     INT NOT NULL DEFAULT 0,
  PRIMARY KEY (player_id, space_id)
);

CREATE TABLE pending_actions (
  id            VARCHAR(191) PRIMARY KEY,
  room_id       VARCHAR(191) NOT NULL,
  from_player   VARCHAR(191) NOT NULL,
  to_player     VARCHAR(191),
  mechanic_id   VARCHAR(191) NOT NULL,
  space_id      VARCHAR(191),
  data          JSON
);
```

7) Verification checklist
- [ ] MySQL 8.0+ installed (or PlanetScale/managed MySQL available)
- [ ] Database, user, and privileges created
- [ ] Tables created (JSON snapshot model)
- [ ] App configured with DATABASE_URL and PERSIST_STORE=mysql in production
- [ ] Manual insert/update tested using the example queries above

If you’d like, I can also provide a schema.sql file you can run directly, or Prisma/Drizzle migration files to manage this with version control. Let me know your target deployment (PlanetScale, RDS, etc.) and I’ll tailor the setup. 