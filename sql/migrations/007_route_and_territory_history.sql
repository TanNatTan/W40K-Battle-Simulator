PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS territory_state (
  map_id TEXT NOT NULL,
  cell_id INTEGER NOT NULL,
  owner_id TEXT,
  state TEXT NOT NULL,
  objective_type TEXT,
  garrison REAL NOT NULL DEFAULT 0,
  payload_json TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY (map_id, cell_id)
);

CREATE TABLE IF NOT EXISTS supply_routes (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  faction_id TEXT,
  origin_id TEXT NOT NULL,
  destination_id TEXT NOT NULL,
  resource_type TEXT,
  path_json TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_tick INTEGER NOT NULL,
  expires_tick INTEGER
);

CREATE TABLE IF NOT EXISTS road_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  road_id TEXT NOT NULL,
  tick INTEGER NOT NULL,
  action TEXT NOT NULL,
  details_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS convoy_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  convoy_id TEXT NOT NULL,
  tick INTEGER NOT NULL,
  action TEXT NOT NULL,
  details_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS trade_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  route_id TEXT NOT NULL,
  convoy_id TEXT,
  tick INTEGER NOT NULL,
  action TEXT NOT NULL,
  details_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS ai_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  faction_id TEXT NOT NULL,
  tick INTEGER NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  details_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_supply_routes_active ON supply_routes(active, expires_tick);
CREATE INDEX IF NOT EXISTS idx_convoy_history_convoy_tick ON convoy_history(convoy_id, tick);
CREATE INDEX IF NOT EXISTS idx_ai_actions_faction_tick ON ai_actions(faction_id, tick);
