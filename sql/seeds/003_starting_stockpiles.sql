CREATE TABLE IF NOT EXISTS starting_stockpile_templates (
  resource_code TEXT PRIMARY KEY REFERENCES resource_types(code),
  starting_amount REAL NOT NULL CHECK (starting_amount >= 0),
  base_capacity REAL NOT NULL CHECK (base_capacity >= starting_amount)
);

INSERT OR REPLACE INTO starting_stockpile_templates(resource_code, starting_amount, base_capacity) VALUES
  ('requisition', 600, 800),
  ('materials', 450, 620),
  ('fuel', 300, 460),
  ('energy', 320, 480),
  ('ammunition', 420, 650),
  ('medical', 220, 360),
  ('food', 360, 520),
  ('influence', 180, 320),
  ('parts', 240, 420);

INSERT OR IGNORE INTO player_stockpiles(player_id, resource_code, amount, capacity)
SELECT players.id, templates.resource_code, templates.starting_amount, templates.base_capacity
FROM players
CROSS JOIN starting_stockpile_templates AS templates;

-- Trade partners may be seeded, but trade_routes intentionally are not.
-- A commander must fund and establish each route during the simulation.

