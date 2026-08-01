PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS faction_archetypes (
  code TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  builder_name TEXT NOT NULL,
  deployment_identity TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS faction_building_roles (
  faction_code TEXT NOT NULL REFERENCES faction_archetypes(code) ON DELETE CASCADE,
  role_code TEXT NOT NULL,
  display_name TEXT NOT NULL,
  PRIMARY KEY (faction_code, role_code)
);

CREATE TABLE IF NOT EXISTS faction_unit_roster (
  faction_code TEXT NOT NULL REFERENCES faction_archetypes(code) ON DELETE CASCADE,
  unit_name TEXT NOT NULL,
  gameplay_role TEXT NOT NULL,
  PRIMARY KEY (faction_code, unit_name)
);

CREATE TABLE IF NOT EXISTS construction_jobs (
  id INTEGER PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  builder_unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  building_id INTEGER REFERENCES buildings(id) ON DELETE SET NULL,
  building_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('evaluating', 'funded', 'moving', 'building', 'blocked', 'complete', 'cancelled')),
  utility_score REAL NOT NULL DEFAULT 0,
  requisition_cost REAL NOT NULL DEFAULT 0 CHECK (requisition_cost >= 0),
  materials_cost REAL NOT NULL DEFAULT 0 CHECK (materials_cost >= 0),
  blocked_reason TEXT,
  started_at REAL,
  completed_at REAL
);

CREATE TABLE IF NOT EXISTS building_collision_shapes (
  building_id INTEGER PRIMARY KEY REFERENCES buildings(id) ON DELETE CASCADE,
  shape TEXT NOT NULL DEFAULT 'rectangle' CHECK (shape IN ('rectangle', 'circle', 'polygon')),
  width_px REAL NOT NULL CHECK (width_px > 0),
  height_px REAL NOT NULL CHECK (height_px > 0),
  polygon_json TEXT,
  blocks_movement INTEGER NOT NULL DEFAULT 1 CHECK (blocks_movement IN (0, 1)),
  blocks_projectiles INTEGER NOT NULL DEFAULT 1 CHECK (blocks_projectiles IN (0, 1)),
  collision_active_progress REAL NOT NULL DEFAULT 0.05 CHECK (collision_active_progress BETWEEN 0 AND 1)
);

CREATE TABLE IF NOT EXISTS research_projects (
  id INTEGER PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  research_building_id INTEGER REFERENCES buildings(id) ON DELETE SET NULL,
  code TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('requested', 'funded', 'researching', 'complete', 'cancelled')),
  progress REAL NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 1),
  cost_json TEXT NOT NULL,
  UNIQUE (player_id, code)
);

CREATE TABLE IF NOT EXISTS unit_wounds (
  unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  body_zone TEXT NOT NULL CHECK (body_zone IN ('head', 'chest', 'left-arm', 'right-arm', 'left-leg', 'right-leg')),
  condition REAL NOT NULL DEFAULT 1 CHECK (condition BETWEEN 0 AND 1),
  bleeding_per_second REAL NOT NULL DEFAULT 0 CHECK (bleeding_per_second >= 0),
  wound_state TEXT NOT NULL DEFAULT 'healthy' CHECK (wound_state IN ('healthy', 'light', 'wounded', 'critical', 'incapacitated', 'dead')),
  PRIMARY KEY (unit_id, body_zone)
);

CREATE TABLE IF NOT EXISTS vehicle_subsystems (
  unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  subsystem TEXT NOT NULL CHECK (subsystem IN ('tracks', 'engine', 'turret', 'main-gun', 'crew', 'ammo-storage', 'fuel')),
  condition REAL NOT NULL DEFAULT 1 CHECK (condition BETWEEN 0 AND 1),
  PRIMARY KEY (unit_id, subsystem)
);

CREATE TABLE IF NOT EXISTS projectile_events (
  id INTEGER PRIMARY KEY,
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  shooter_unit_id INTEGER REFERENCES units(id) ON DELETE SET NULL,
  intended_target_unit_id INTEGER REFERENCES units(id) ON DELETE SET NULL,
  impacted_building_id INTEGER REFERENCES buildings(id) ON DELETE SET NULL,
  fired_at REAL NOT NULL,
  impacted_at REAL,
  hit_probability REAL NOT NULL CHECK (hit_probability BETWEEN 0 AND 1),
  penetration REAL NOT NULL,
  damage REAL NOT NULL,
  impact_zone TEXT,
  result TEXT NOT NULL CHECK (result IN ('flying', 'miss', 'ricochet', 'penetrated', 'blocked', 'expired'))
);

CREATE TABLE IF NOT EXISTS reinforcement_waves (
  id INTEGER PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  source_kind TEXT NOT NULL CHECK (source_kind IN ('building', 'map-edge', 'transport', 'drop-pod', 'portal', 'tunnel', 'biological', 'reanimation', 'allied-handoff')),
  source_id INTEGER,
  wave_kind TEXT NOT NULL CHECK (wave_kind IN ('scout-builder', 'main-infantry', 'specialist-vehicle', 'emergency')),
  status TEXT NOT NULL CHECK (status IN ('requested', 'approved', 'in-transit', 'arrived', 'blocked', 'cancelled')),
  scheduled_at REAL,
  arrived_at REAL
);

CREATE INDEX IF NOT EXISTS idx_construction_jobs_builder_status ON construction_jobs(builder_unit_id, status);
CREATE INDEX IF NOT EXISTS idx_projectile_events_match_time ON projectile_events(match_id, fired_at);
CREATE INDEX IF NOT EXISTS idx_reinforcement_waves_player_status ON reinforcement_waves(player_id, status);

INSERT OR IGNORE INTO schema_versions(version) VALUES (4);

