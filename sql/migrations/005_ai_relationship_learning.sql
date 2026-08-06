PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS unit_relationships (
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  other_unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  score REAL NOT NULL DEFAULT 0 CHECK (score BETWEEN -100 AND 100),
  relationship_band TEXT NOT NULL,
  last_reason TEXT,
  last_event_at REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (match_id, unit_id, other_unit_id)
);

CREATE TABLE IF NOT EXISTS unit_history (
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  battle_count INTEGER NOT NULL DEFAULT 0,
  kills INTEGER NOT NULL DEFAULT 0,
  injuries INTEGER NOT NULL DEFAULT 0,
  memories_json TEXT NOT NULL DEFAULT '[]',
  PRIMARY KEY (match_id, unit_id)
);

CREATE TABLE IF NOT EXISTS battle_history (
  id INTEGER PRIMARY KEY,
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  faction_code TEXT NOT NULL,
  subfaction_code TEXT NOT NULL,
  result TEXT NOT NULL,
  strategic_summary_json TEXT NOT NULL DEFAULT '{}',
  completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS faction_ai_memory (
  faction_code TEXT NOT NULL,
  subfaction_code TEXT NOT NULL,
  memory_type TEXT NOT NULL CHECK (memory_type IN ('enemy-pattern', 'failed-assault', 'successful-formation', 'route-safety', 'resource-shortage', 'unit-effectiveness', 'map-danger', 'preferred-target')),
  memory_key TEXT NOT NULL,
  observation_json TEXT NOT NULL,
  learned_weight REAL,
  observed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (faction_code, subfaction_code, memory_type, memory_key)
);

CREATE INDEX IF NOT EXISTS idx_unit_relationships_unit ON unit_relationships(unit_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_battle_history_faction ON battle_history(faction_code, subfaction_code, completed_at);
CREATE INDEX IF NOT EXISTS idx_faction_ai_memory_type ON faction_ai_memory(faction_code, subfaction_code, memory_type);

INSERT OR IGNORE INTO schema_versions(version) VALUES (5);
