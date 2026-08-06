INSERT OR IGNORE INTO resource_types(code, display_name, layer, faction_specific) VALUES
  ('requisition', 'Requisition', 'production', 0),
  ('materials', 'Building Materials', 'production', 0),
  ('fuel', 'Fuel', 'production', 0),
  ('energy', 'Energy', 'production', 0),
  ('ammunition', 'Ammunition', 'production', 0),
  ('medical', 'Medical Supplies', 'production', 0),
  ('food', 'Food', 'production', 0),
  ('faith', 'Faith', 'production', 1),
  ('influence', 'Influence', 'production', 0),
  ('scrap', 'Scrap', 'production', 1),
  ('biomass', 'Biomass', 'production', 1),
  ('parts', 'Spare Parts', 'production', 0);
