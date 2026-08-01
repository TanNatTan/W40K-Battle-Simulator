INSERT OR REPLACE INTO faction_archetypes(code, display_name, builder_name, deployment_identity) VALUES
  ('astartes', 'Space Marines', 'Servitor', 'Drop Pods, Thunderhawks, teleportation'),
  ('guard', 'Astra Militarum', 'Combat Engineer', 'Ground deployment, convoys, Valkyries'),
  ('chaos', 'Chaos Space Marines', 'Dark Servitor', 'Warp beacons, corrupted drop pods, summoning'),
  ('ork', 'Orks', 'Grot / Mekboy', 'Mobs, Trukks, scrap-built arrivals'),
  ('necron', 'Necrons', 'Canoptek Scarab', 'Reanimation, portals, teleportation'),
  ('tau', 'Tau Empire', 'Earth Caste Engineer', 'Ground cadre, Devilfish, Orca and drone delivery'),
  ('tyranid', 'Tyranids', 'Ripper Swarm / Norn Drone', 'Biological spawning, burrowing, Tyrannocytes');

INSERT OR REPLACE INTO faction_building_roles(faction_code, role_code, display_name) VALUES
  ('astartes', 'hq', 'Fortress Monastery'), ('astartes', 'research', 'Librarius / Armoury'), ('astartes', 'healing', 'Apothecarion'), ('astartes', 'vehicle', 'Vehicle Bay'), ('astartes', 'storage', 'Supply Depot'),
  ('guard', 'hq', 'Command Headquarters'), ('guard', 'infantry', 'Barracks'), ('guard', 'vehicle', 'Vehicle Depot'), ('guard', 'storage', 'Munitorum Depot'), ('guard', 'healing', 'Field Hospital'),
  ('chaos', 'hq', 'Dark Citadel'), ('chaos', 'research', 'Warp Nexus'), ('chaos', 'vehicle', 'Dark Forge'), ('chaos', 'storage', 'Ammunition Cache'), ('chaos', 'reinforcement', 'Warp Beacon'),
  ('ork', 'hq', 'Boss Camp'), ('ork', 'infantry', 'Boyz Hut'), ('ork', 'vehicle', 'Mek Workshop'), ('ork', 'materials', 'Scrap Yard'), ('ork', 'food', 'Squig Pen'),
  ('necron', 'hq', 'Tomb Core'), ('necron', 'infantry', 'Summoning Core'), ('necron', 'vehicle', 'Canoptek Forge'), ('necron', 'healing', 'Resurrection Node'), ('necron', 'reinforcement', 'Monolith Gate'),
  ('tau', 'hq', 'Command Dome'), ('tau', 'research', 'Earth Caste Workshop'), ('tau', 'infantry', 'Barracks'), ('tau', 'vehicle', 'Vehicle Assembly Plant'), ('tau', 'storage', 'Supply Hub'),
  ('tyranid', 'hq', 'Hive Node'), ('tyranid', 'infantry', 'Spawning Pool'), ('tyranid', 'storage', 'Biomass Pit'), ('tyranid', 'research', 'Evolution Chamber'), ('tyranid', 'power', 'Digestion Pool');

INSERT OR REPLACE INTO faction_unit_roster(faction_code, unit_name, gameplay_role) VALUES
  ('astartes', 'Servitor', 'builder'), ('astartes', 'Tactical Marine', 'trooper'), ('astartes', 'Scout Marine', 'scout'), ('astartes', 'Apothecary', 'medic'), ('astartes', 'Techmarine', 'engineer'), ('astartes', 'Captain', 'commander'), ('astartes', 'Rhino', 'vehicle'),
  ('guard', 'Combat Engineer', 'builder'), ('guard', 'Guardsman', 'trooper'), ('guard', 'Ratling', 'scout'), ('guard', 'Field Medic', 'medic'), ('guard', 'Commissar', 'commander'), ('guard', 'Leman Russ', 'vehicle'),
  ('chaos', 'Dark Servitor', 'builder'), ('chaos', 'Chaos Space Marine', 'trooper'), ('chaos', 'Raptor', 'scout'), ('chaos', 'Warpsmith', 'engineer'), ('chaos', 'Chaos Lord', 'commander'), ('chaos', 'Defiler', 'vehicle'),
  ('ork', 'Grot', 'builder'), ('ork', 'Shoota Boy', 'trooper'), ('ork', 'Kommando', 'scout'), ('ork', 'Painboy', 'medic'), ('ork', 'Warboss', 'commander'), ('ork', 'Battlewagon', 'vehicle'),
  ('necron', 'Canoptek Scarab', 'builder'), ('necron', 'Warrior', 'trooper'), ('necron', 'Deathmark', 'scout'), ('necron', 'Technomancer', 'medic'), ('necron', 'Overlord', 'commander'), ('necron', 'Doomsday Ark', 'vehicle'),
  ('tau', 'Earth Caste Engineer', 'builder'), ('tau', 'Fire Warrior', 'trooper'), ('tau', 'Pathfinder', 'scout'), ('tau', 'Repair Drone', 'engineer'), ('tau', 'Commander', 'commander'), ('tau', 'Hammerhead', 'vehicle'),
  ('tyranid', 'Norn Drone', 'builder'), ('tyranid', 'Termagant', 'trooper'), ('tyranid', 'Ravener', 'scout'), ('tyranid', 'Venomthrope', 'medic'), ('tyranid', 'Hive Tyrant', 'commander'), ('tyranid', 'Carnifex', 'vehicle');

