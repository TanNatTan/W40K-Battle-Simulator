PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS map_resource_zones (
  id INTEGER PRIMARY KEY,
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  polygon_json TEXT NOT NULL,
  capacity REAL NOT NULL CHECK (capacity >= 0),
  infinite_capacity INTEGER NOT NULL DEFAULT 0 CHECK (infinite_capacity IN (0, 1)),
  gather_rate REAL NOT NULL CHECK (gather_rate >= 0),
  regeneration_rate REAL NOT NULL DEFAULT 0 CHECK (regeneration_rate >= 0),
  starting_owner_player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
  requires_building INTEGER NOT NULL DEFAULT 1 CHECK (requires_building IN (0, 1)),
  allowed_collectors_json TEXT NOT NULL DEFAULT '["builder","vehicle"]',
  strategic_objective INTEGER NOT NULL DEFAULT 0 CHECK (strategic_objective IN (0, 1))
);

CREATE TABLE IF NOT EXISTS economic_nodes (
  id INTEGER PRIMARY KEY,
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  node_type TEXT NOT NULL,
  x_px REAL NOT NULL,
  y_px REAL NOT NULL,
  starting_owner_player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
  imports_json TEXT NOT NULL DEFAULT '{}',
  exports_json TEXT NOT NULL DEFAULT '{}',
  storage_capacity REAL NOT NULL DEFAULT 1000 CHECK (storage_capacity > 0),
  strategic_value REAL NOT NULL DEFAULT 70 CHECK (strategic_value BETWEEN 0 AND 100),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
);

CREATE TABLE IF NOT EXISTS authored_trade_routes (
  id INTEGER PRIMARY KEY,
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  route_type TEXT NOT NULL CHECK (route_type IN ('road', 'rail', 'sea', 'river', 'air', 'orbital', 'underground', 'warp')),
  from_node_id INTEGER NOT NULL REFERENCES economic_nodes(id) ON DELETE CASCADE,
  to_node_id INTEGER NOT NULL REFERENCES economic_nodes(id) ON DELETE CASCADE,
  waypoints_json TEXT NOT NULL,
  capacity REAL NOT NULL CHECK (capacity > 0),
  resources_json TEXT NOT NULL DEFAULT '[]',
  allowed_factions_json TEXT NOT NULL DEFAULT '["*"]',
  road_required INTEGER NOT NULL DEFAULT 0 CHECK (road_required IN (0, 1)),
  bidirectional INTEGER NOT NULL DEFAULT 1 CHECK (bidirectional IN (0, 1)),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  authored INTEGER NOT NULL DEFAULT 1 CHECK (authored = 1),
  CHECK (from_node_id <> to_node_id)
);

CREATE INDEX IF NOT EXISTS idx_resource_zones_match_type ON map_resource_zones(match_id, resource_type);
CREATE INDEX IF NOT EXISTS idx_economic_nodes_match_type ON economic_nodes(match_id, node_type);
CREATE INDEX IF NOT EXISTS idx_authored_trade_routes_match_type ON authored_trade_routes(match_id, route_type);

INSERT OR IGNORE INTO schema_versions(version) VALUES (6);
