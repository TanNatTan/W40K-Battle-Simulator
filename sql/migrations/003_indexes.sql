CREATE INDEX IF NOT EXISTS idx_buildings_owner_alive ON buildings(owner_player_id, alive);
CREATE INDEX IF NOT EXISTS idx_buildings_territory ON buildings(territory_id, alive);
CREATE INDEX IF NOT EXISTS idx_units_owner_alive ON units(owner_player_id, alive);
CREATE INDEX IF NOT EXISTS idx_territories_match_state ON territories(match_id, capture_state);
CREATE INDEX IF NOT EXISTS idx_supply_routes_owner_status ON supply_routes(owner_player_id, status);
CREATE INDEX IF NOT EXISTS idx_convoys_owner_status ON convoys(owner_player_id, status);
CREATE INDEX IF NOT EXISTS idx_requests_player_priority ON ai_requests(player_id, status, priority DESC);
CREATE INDEX IF NOT EXISTS idx_trade_routes_player_status ON trade_routes(player_id, status);

INSERT OR IGNORE INTO schema_versions(version) VALUES (3);

