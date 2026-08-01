CREATE VIEW IF NOT EXISTS player_economy_status AS
SELECT
  p.id AS player_id,
  p.faction,
  s.resource_code,
  s.amount,
  s.capacity,
  ROUND(CASE WHEN s.capacity = 0 THEN 0 ELSE s.amount / s.capacity * 100 END, 1) AS percent_full,
  CASE
    WHEN s.capacity > 0 AND s.amount / s.capacity < 0.16 THEN 'emergency'
    WHEN s.capacity > 0 AND s.amount / s.capacity < 0.35 THEN 'low'
    ELSE 'stable'
  END AS supply_state
FROM players AS p
JOIN player_stockpiles AS s ON s.player_id = p.id;

CREATE VIEW IF NOT EXISTS active_trade_network AS
SELECT
  tr.id AS trade_route_id,
  tr.player_id,
  tp.name AS partner_name,
  tr.origin_building_id,
  tr.warehouse_building_id,
  tr.established_at,
  tr.next_dispatch_at
FROM trade_routes AS tr
JOIN trade_partners AS tp ON tp.id = tr.partner_id
WHERE tr.status = 'active' AND tr.established_at IS NOT NULL;

CREATE VIEW IF NOT EXISTS logistics_queue AS
SELECT
  player_id,
  id AS request_id,
  request_type,
  label,
  priority,
  status,
  created_at
FROM ai_requests
WHERE status NOT IN ('denied', 'complete')
ORDER BY player_id, priority DESC, created_at ASC;

