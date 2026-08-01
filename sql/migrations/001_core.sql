PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_versions (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS matches (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  map_width_px INTEGER NOT NULL CHECK (map_width_px BETWEEN 320 AND 3840),
  map_height_px INTEGER NOT NULL CHECK (map_height_px BETWEEN 180 AND 2160),
  seed INTEGER NOT NULL,
  elapsed_seconds REAL NOT NULL DEFAULT 0,
  paused INTEGER NOT NULL DEFAULT 1 CHECK (paused IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY,
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  slot INTEGER NOT NULL CHECK (slot BETWEEN 1 AND 12),
  race TEXT NOT NULL,
  faction TEXT NOT NULL,
  team INTEGER NOT NULL CHECK (team BETWEEN 1 AND 12),
  color_hex TEXT NOT NULL CHECK (length(color_hex) = 7),
  doctrine TEXT NOT NULL,
  economic_personality TEXT NOT NULL CHECK (economic_personality IN ('Frugal', 'Aggressive', 'Balanced')),
  spawn_x_px REAL NOT NULL,
  spawn_y_px REAL NOT NULL,
  UNIQUE (match_id, slot)
);

CREATE TABLE IF NOT EXISTS territories (
  id INTEGER PRIMARY KEY,
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  owner_player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
  shape TEXT NOT NULL CHECK (shape IN ('circle', 'square', 'custom')),
  center_x_px REAL NOT NULL,
  center_y_px REAL NOT NULL,
  radius_px REAL,
  polygon_json TEXT,
  capture_progress REAL NOT NULL DEFAULT 0 CHECK (capture_progress BETWEEN 0 AND 1),
  capture_state TEXT NOT NULL DEFAULT 'neutral' CHECK (capture_state IN ('neutral', 'capturing', 'contested', 'owned'))
);

CREATE TABLE IF NOT EXISTS buildings (
  id INTEGER PRIMARY KEY,
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  owner_player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  territory_id INTEGER REFERENCES territories(id) ON DELETE SET NULL,
  building_type TEXT NOT NULL,
  x_px REAL NOT NULL,
  y_px REAL NOT NULL,
  hitbox_width_px REAL NOT NULL CHECK (hitbox_width_px > 0),
  hitbox_height_px REAL NOT NULL CHECK (hitbox_height_px > 0),
  hp REAL NOT NULL CHECK (hp >= 0),
  max_hp REAL NOT NULL CHECK (max_hp > 0),
  construction_progress REAL NOT NULL DEFAULT 0 CHECK (construction_progress BETWEEN 0 AND 1),
  alive INTEGER NOT NULL DEFAULT 1 CHECK (alive IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS units (
  id INTEGER PRIMARY KEY,
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  owner_player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  unit_type TEXT NOT NULL,
  role TEXT NOT NULL,
  x_px REAL NOT NULL,
  y_px REAL NOT NULL,
  hp REAL NOT NULL CHECK (hp >= 0),
  max_hp REAL NOT NULL CHECK (max_hp > 0),
  ammo REAL NOT NULL DEFAULT 0 CHECK (ammo >= 0),
  fuel REAL NOT NULL DEFAULT 0 CHECK (fuel >= 0),
  squad_id INTEGER,
  alive INTEGER NOT NULL DEFAULT 1 CHECK (alive IN (0, 1))
);

CREATE TABLE IF NOT EXISTS squads (
  id INTEGER PRIMARY KEY,
  owner_player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  combined_hp REAL NOT NULL CHECK (combined_hp >= 0),
  combined_max_hp REAL NOT NULL CHECK (combined_max_hp > 0)
);

CREATE TABLE IF NOT EXISTS squad_members (
  squad_id INTEGER NOT NULL REFERENCES squads(id) ON DELETE CASCADE,
  unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  PRIMARY KEY (squad_id, unit_id)
);

INSERT OR IGNORE INTO schema_versions(version) VALUES (1);

