CREATE VIEW IF NOT EXISTS active_construction_queue AS
SELECT
  cj.player_id,
  cj.builder_unit_id,
  cj.building_type,
  cj.status,
  cj.utility_score,
  cj.blocked_reason,
  b.hp,
  b.max_hp,
  b.construction_progress,
  cs.width_px AS collision_width_px,
  cs.height_px AS collision_height_px
FROM construction_jobs AS cj
LEFT JOIN buildings AS b ON b.id = cj.building_id
LEFT JOIN building_collision_shapes AS cs ON cs.building_id = b.id
WHERE cj.status NOT IN ('complete', 'cancelled');

CREATE VIEW IF NOT EXISTS wounded_unit_status AS
SELECT
  u.id AS unit_id,
  u.owner_player_id,
  u.unit_type,
  u.hp,
  u.max_hp,
  MAX(w.bleeding_per_second) AS bleeding_per_second,
  GROUP_CONCAT(CASE WHEN w.condition < 0.75 THEN w.body_zone END) AS damaged_zones
FROM units AS u
JOIN unit_wounds AS w ON w.unit_id = u.id
WHERE u.alive = 1
GROUP BY u.id;

