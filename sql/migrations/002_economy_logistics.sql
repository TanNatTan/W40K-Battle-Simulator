PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS resource_types (
  code TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  layer TEXT NOT NULL CHECK (layer IN ('production', 'storage', 'transportation', 'consumption')),
  faction_specific INTEGER NOT NULL DEFAULT 0 CHECK (faction_specific IN (0, 1))
);

CREATE TABLE IF NOT EXISTS player_stockpiles (
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  resource_code TEXT NOT NULL REFERENCES resource_types(code),
  amount REAL NOT NULL DEFAULT 0 CHECK (amount >= 0),
  capacity REAL NOT NULL CHECK (capacity >= 0),
  PRIMARY KEY (player_id, resource_code)
);

CREATE TABLE IF NOT EXISTS building_resource_flows (
  building_type TEXT NOT NULL,
  resource_code TEXT NOT NULL REFERENCES resource_types(code),
  direction TEXT NOT NULL CHECK (direction IN ('produce', 'consume', 'store')),
  amount_per_tick REAL NOT NULL CHECK (amount_per_tick >= 0),
  PRIMARY KEY (building_type, resource_code, direction)
);

CREATE TABLE IF NOT EXISTS building_storage (
  building_id INTEGER NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  resource_code TEXT NOT NULL REFERENCES resource_types(code),
  amount REAL NOT NULL DEFAULT 0 CHECK (amount >= 0),
  capacity REAL NOT NULL CHECK (capacity >= 0),
  salvage_rate REAL NOT NULL DEFAULT 0.25 CHECK (salvage_rate BETWEEN 0 AND 1),
  PRIMARY KEY (building_id, resource_code)
);

CREATE TABLE IF NOT EXISTS supply_routes (
  id INTEGER PRIMARY KEY,
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  owner_player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  route_kind TEXT NOT NULL CHECK (route_kind IN ('road', 'rail', 'air', 'sea', 'drop-pod')),
  origin_building_id INTEGER REFERENCES buildings(id) ON DELETE SET NULL,
  destination_building_id INTEGER REFERENCES buildings(id) ON DELETE SET NULL,
  path_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked', 'destroyed', 'rerouting')),
  supply_radius_px REAL NOT NULL DEFAULT 400 CHECK (supply_radius_px >= 0)
);

CREATE TABLE IF NOT EXISTS convoys (
  id INTEGER PRIMARY KEY,
  route_id INTEGER REFERENCES supply_routes(id) ON DELETE SET NULL,
  owner_player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  transport_type TEXT NOT NULL,
  current_job TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'loading', 'moving', 'blocked', 'awaiting-escort', 'retreating', 'delivered', 'destroyed')),
  escort_count INTEGER NOT NULL DEFAULT 0 CHECK (escort_count >= 0),
  x_px REAL NOT NULL,
  y_px REAL NOT NULL,
  dispatched_at REAL,
  completed_at REAL
);

CREATE TABLE IF NOT EXISTS convoy_cargo (
  convoy_id INTEGER NOT NULL REFERENCES convoys(id) ON DELETE CASCADE,
  resource_code TEXT NOT NULL REFERENCES resource_types(code),
  amount REAL NOT NULL CHECK (amount > 0),
  PRIMARY KEY (convoy_id, resource_code)
);

CREATE TABLE IF NOT EXISTS ai_requests (
  id INTEGER PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL,
  label TEXT NOT NULL,
  priority INTEGER NOT NULL CHECK (priority BETWEEN 0 AND 100),
  status TEXT NOT NULL CHECK (status IN ('requested', 'approved', 'delayed', 'denied', 'partial', 'complete')),
  payload_json TEXT,
  created_at REAL NOT NULL,
  resolved_at REAL
);

CREATE TABLE IF NOT EXISTS logistics_officers (
  id INTEGER PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  officer_type TEXT NOT NULL CHECK (officer_type IN ('quartermaster', 'supply-officer', 'factory-overseer')),
  current_job TEXT NOT NULL,
  UNIQUE (player_id, officer_type)
);

CREATE TABLE IF NOT EXISTS trade_partners (
  id INTEGER PRIMARY KEY,
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  partner_type TEXT NOT NULL,
  name TEXT NOT NULL,
  x_px REAL NOT NULL,
  y_px REAL NOT NULL,
  offer_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS trade_routes (
  id INTEGER PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  partner_id INTEGER NOT NULL REFERENCES trade_partners(id) ON DELETE CASCADE,
  origin_building_id INTEGER REFERENCES buildings(id) ON DELETE SET NULL,
  warehouse_building_id INTEGER REFERENCES buildings(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'establishing', 'active', 'suspended', 'destroyed')),
  influence_cost REAL NOT NULL DEFAULT 40 CHECK (influence_cost >= 0),
  materials_cost REAL NOT NULL DEFAULT 25 CHECK (materials_cost >= 0),
  established_at REAL,
  next_dispatch_at REAL,
  UNIQUE (player_id, partner_id),
  CHECK ((status = 'active' AND established_at IS NOT NULL) OR status <> 'active')
);

CREATE TABLE IF NOT EXISTS drop_pod_launches (
  id INTEGER PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  launch_bay_id INTEGER REFERENCES buildings(id) ON DELETE SET NULL,
  request_id INTEGER REFERENCES ai_requests(id) ON DELETE SET NULL,
  destination_x_px REAL NOT NULL,
  destination_y_px REAL NOT NULL,
  stage TEXT NOT NULL CHECK (stage IN ('requested', 'approved', 'preparing', 'scheduled', 'launched', 'impact', 'deployed', 'cancelled')),
  scheduled_at REAL,
  deployed_at REAL
);

INSERT OR IGNORE INTO schema_versions(version) VALUES (2);

