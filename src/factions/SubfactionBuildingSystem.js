const RAW_SUBFACTION_BUILDINGS = {};

Object.assign(RAW_SUBFACTION_BUILDINGS, {
  "Ultramarines": {
    "HQ": "Macragge Command Bastion",
    "Muster": "Codex Muster Hall",
    "War Forge": "Armourium of Ultramar",
    "Doctrine": "Librarius Strategium",
    "Sustainment": "Apothecarion",
    "Power": "Plasma Reactor",
    "Logistics": "Munitorum Vault",
    "Industry": "Ultramar Manufactorum",
    "Deployment": "Thunderhawk Landing Platform",
    "Intel": "Auspex Command Relay",
    "Fortification": "Aegis Bastion",
    "Emplacement": "Macragge Heavy Bolter Battery",
    "Signature": "Victrix War Council"
  },
  "Blood Angels": {
    "HQ": "Baal Angelic Bastion",
    "Muster": "Hall of the Blooded Host",
    "War Forge": "Baalite Armourium",
    "Doctrine": "Sanguinary Strategium",
    "Sustainment": "Sanguinary Apothecarion",
    "Power": "Baal Plasma Shrine",
    "Logistics": "Angelic Reliquary Depot",
    "Industry": "Artisan Forge of Baal",
    "Deployment": "Stormraven Launch Chapel",
    "Intel": "Angel's Eye Auspex Tower",
    "Fortification": "Bastion of the IX",
    "Emplacement": "Inferno Cannon Battery",
    "Signature": "Sanguinary Reliquary"
  },
  "Imperial Fists": {
    "HQ": "Bastion of Dorn",
    "Muster": "Praetorian Muster Hall",
    "War Forge": "Siege Armourium",
    "Doctrine": "Siege Master's Strategium",
    "Sustainment": "Apothecarion of Terra",
    "Power": "Fortress Plasma Core",
    "Logistics": "Praetorian Supply Vault",
    "Industry": "Siege Manufactorum",
    "Deployment": "Gunship Embarkation Pad",
    "Intel": "Sentinel Auspex Tower",
    "Fortification": "Dorn-pattern Fortress Wall",
    "Emplacement": "Lascannon Siege Battery",
    "Signature": "Siege Master's Redoubt"
  },
  "Salamanders": {
    "HQ": "Nocturne Forge-Monastery",
    "Muster": "Fireborn Muster Hall",
    "War Forge": "Artificer Armoury",
    "Doctrine": "Promethean Cult Sanctum",
    "Sustainment": "Apothecarion of Nocturne",
    "Power": "Geothermal Plasma Forge",
    "Logistics": "Firedrake Supply Vault",
    "Industry": "Master Artificer Forge",
    "Deployment": "Fire Drake Landing Pad",
    "Intel": "Nocturnean Auspex Beacon",
    "Fortification": "Obsidian Bastion",
    "Emplacement": "Flame Cannon Turret",
    "Signature": "Anvil of Vulkan"
  },
  "Emerald Suns": {
    "HQ": "Sanctum Delsur Forward Fortress",
    "Muster": "Viridian Sun Muster Hall",
    "War Forge": "Auric Reclaimer Forge",
    "Doctrine": "Council of Flames Strategium",
    "Sustainment": "Expanded Apothecarion",
    "Power": "Viridian Plasma Core",
    "Logistics": "Trand'or Sustainment Vault",
    "Industry": "Solar Manufactorum",
    "Deployment": "Twin Suns Redeployment Platform",
    "Intel": "Sun Watcher Observatory",
    "Fortification": "Auric Gate Bastion",
    "Emplacement": "Emerald Suppression Battery",
    "Signature": "Citadel of Loyola"
  },
  "White Scars": {
    "HQ": "Khan's Command Encampment",
    "Muster": "Brotherhood Muster Lodge",
    "War Forge": "Stormlance Motor Pool",
    "Doctrine": "Stormseer Lodge",
    "Sustainment": "Brotherhood Apothecarion",
    "Power": "Mobile Plasma Generator",
    "Logistics": "Rapid Supply Depot",
    "Industry": "Chogorian Field Forge",
    "Deployment": "Stormlance Launch Ground",
    "Intel": "Eagle-Eye Recon Relay",
    "Fortification": "Mobile Redoubt",
    "Emplacement": "Hunter Missile Platform",
    "Signature": "Khan's Ride Muster Ground"
  },
  "Raven Guard": {
    "HQ": "Shadow Command Bunker",
    "Muster": "Talon Muster Cell",
    "War Forge": "Concealed Armourium",
    "Doctrine": "Corax Shadow Strategium",
    "Sustainment": "Silent Apothecarion",
    "Power": "Masked Plasma Generator",
    "Logistics": "Hidden Supply Cache",
    "Industry": "Concealed Fabrication Cell",
    "Deployment": "Shadowhawk Landing Zone",
    "Intel": "Raven Surveillance Array",
    "Fortification": "Camouflaged Redoubt",
    "Emplacement": "Suppressed Missile Turret",
    "Signature": "Shadow Operations Cell"
  },
  "Iron Hands": {
    "HQ": "Iron Council Command Forge",
    "Muster": "Clan Muster Forge",
    "War Forge": "Machine Armourium",
    "Doctrine": "Logis-Strategium",
    "Sustainment": "Augmetic Reclamation Vault",
    "Power": "Ferrum Plasma Dynamo",
    "Logistics": "Automated Supply Vault",
    "Industry": "Ferrum Manufactorum",
    "Deployment": "Mechanised Deployment Pad",
    "Intel": "Noospheric Auspex Node",
    "Fortification": "Adamantine Bastion",
    "Emplacement": "Automated Lascannon Battery",
    "Signature": "Dreadnought Machine Vault"
  },
  "Space Wolves": {
    "HQ": "Fang War Keep",
    "Muster": "Great Company Hall",
    "War Forge": "Iron Priest Forge",
    "Doctrine": "Rune Priest Lodge",
    "Sustainment": "Wolf Priest Hall",
    "Power": "Fenrisian Plasma Hearth",
    "Logistics": "Great Company Stores",
    "Industry": "Fang Armoury Forge",
    "Deployment": "Stormwolf Landing Ground",
    "Intel": "Ravenwatch Beacon",
    "Fortification": "Fenrisian Stone Keep",
    "Emplacement": "Fang Defence Battery",
    "Signature": "Hall of the Great Wolf"
  },
  "Black Templars": {
    "HQ": "Crusade Keep",
    "Muster": "Crusader Hall",
    "War Forge": "Oathbound Armoury",
    "Doctrine": "Reclusiam of Vows",
    "Sustainment": "Crusade Apothecarion",
    "Power": "Sanctified Plasma Reactor",
    "Logistics": "Crusade Reliquary Depot",
    "Industry": "Forge-Chapel",
    "Deployment": "Eternal Crusade Landing Deck",
    "Intel": "Crusade Vox Chapel",
    "Fortification": "Pilgrim Bastion",
    "Emplacement": "Multi-Melta Purgation Battery",
    "Signature": "Oath Shrine of the Eternal Crusade"
  },
  "Cadian 8th": {
    "HQ": "Kasr Command Headquarters",
    "Muster": "Shock Trooper Barracks",
    "War Forge": "Cadian Motor Pool",
    "Doctrine": "Regimental Tactica",
    "Sustainment": "Field Medicae Station",
    "Power": "Generatorium",
    "Logistics": "Munitorum Warehouse",
    "Industry": "Cadian Manufactorum",
    "Deployment": "Valkyrie Pad",
    "Intel": "Vox Command Relay",
    "Fortification": "Kasr Bunker",
    "Emplacement": "Heavy Weapons Nest",
    "Signature": "Cadia Stands Command Post"
  },
  "Steel Legion": {
    "HQ": "Armageddon Hive Command",
    "Muster": "Mechanised Infantry Barracks",
    "War Forge": "Armageddon Tank Depot",
    "Doctrine": "Mechanised Tactica",
    "Sustainment": "Armoured Medicae Shelter",
    "Power": "Promethium Generatorium",
    "Logistics": "Convoy Supply Yard",
    "Industry": "Armageddon War Factory",
    "Deployment": "Mechanised Staging Yard",
    "Intel": "Long-range Vox Tower",
    "Fortification": "Hive-War Bunker",
    "Emplacement": "Autocannon Nest",
    "Signature": "Steel Legion Armoured Depot"
  },
  "Tempestus Scions": {
    "HQ": "Tempestus Command Precinct",
    "Muster": "Scion Training Barracks",
    "War Forge": "Taurox Prime Armoury",
    "Doctrine": "Mission Intelligence Cell",
    "Sustainment": "Tempestus Medicae",
    "Power": "Compact Generatorium",
    "Logistics": "Classified Requisition Vault",
    "Industry": "Militarum Tempestus Armoury",
    "Deployment": "Valkyrie Drop Pad",
    "Intel": "Encryption/Vox Array",
    "Fortification": "Hardened Drop Bastion",
    "Emplacement": "Automated Sentry Battery",
    "Signature": "Special Operations Command Nexus"
  },
  "Death Korps of Krieg": {
    "HQ": "Siege Command Dugout",
    "Muster": "Krieg Trench Barracks",
    "War Forge": "Siege Motor Pool",
    "Doctrine": "Artillery Fire-Direction Centre",
    "Sustainment": "Underground Field Surgery",
    "Power": "Trench Generatorium",
    "Logistics": "Siege Supply Magazine",
    "Industry": "Shell & Siege Foundry",
    "Deployment": "Rail/Convoy Staging Yard",
    "Intel": "Forward Observation Post",
    "Fortification": "Deep Trench Redoubt",
    "Emplacement": "Earthshaker Position",
    "Signature": "Grand Siege Battery"
  },
  "Catachan Jungle Fighters": {
    "HQ": "Jungle Command Camp",
    "Muster": "Jungle Fighter Barracks",
    "War Forge": "Light Vehicle Clearing",
    "Doctrine": "Jungle Warfare School",
    "Sustainment": "Field Medicae Shelter",
    "Power": "Camouflaged Generator",
    "Logistics": "Hidden Supply Dump",
    "Industry": "Field Fabrication Camp",
    "Deployment": "Valkyrie Clearing",
    "Intel": "Jungle Recon Post",
    "Fortification": "Camouflaged Fighting Position",
    "Emplacement": "Heavy Stubber Nest",
    "Signature": "Ambush Network Headquarters"
  },
  "Tallarn Desert Raiders": {
    "HQ": "Desert Raider Command Camp",
    "Muster": "Tallarn Barracks",
    "War Forge": "Desert Motor Pool",
    "Doctrine": "Mobile Warfare Tactica",
    "Sustainment": "Field Hospital Tent",
    "Power": "Promethium Generator",
    "Logistics": "Caravan Supply Depot",
    "Industry": "Desert Field Refinery",
    "Deployment": "Raider Staging Ground",
    "Intel": "Long-range Vox Mast",
    "Fortification": "Sand Redoubt",
    "Emplacement": "Anti-Tank Dugout",
    "Signature": "Desert Raid Command Post"
  },
  "Mars Forge": {
    "HQ": "Martian Fabricator Temple",
    "Muster": "Skitarii Muster Maniple",
    "War Forge": "Sacred Machine Forge",
    "Doctrine": "Noospheric Data-Loom",
    "Sustainment": "Reclamation Chapel",
    "Power": "Arc Reactor",
    "Logistics": "Servitor Distribution Vault",
    "Industry": "Omnissian Manufactorum",
    "Deployment": "Mechanicus Landing Platform",
    "Intel": "Noosphere Relay",
    "Fortification": "Martian Bulwark",
    "Emplacement": "Cognis Defence Turret",
    "Signature": "Vault of Archeotech"
  }
});

Object.assign(RAW_SUBFACTION_BUILDINGS, {
  "Ryza Forge": {
    "HQ": "Ryza Plasma Temple",
    "Muster": "Aggressor Maniple Hall",
    "War Forge": "Experimental Weapons Forge",
    "Doctrine": "Plasma Research Crucible",
    "Sustainment": "Cybernetic Reconstruction Bay",
    "Power": "Superheated Plasma Reactor",
    "Logistics": "Plasma Component Vault",
    "Industry": "Experimental Manufactorum",
    "Deployment": "Assault Transport Platform",
    "Intel": "Combat Noosphere Relay",
    "Fortification": "Thermal Redoubt",
    "Emplacement": "Plasma Culverin Battery",
    "Signature": "Ryza Experimental Plasma Crucible"
  },
  "Lucius Forge": {
    "HQ": "Hollow Forge Command Node",
    "Muster": "Lucian Skitarii Vault",
    "War Forge": "Teleportarium Forge",
    "Doctrine": "Solar-Tech Archive",
    "Sustainment": "Cybernetic Reconstruction Vault",
    "Power": "Solar Dynamo",
    "Logistics": "Extrastellar Resource Depot",
    "Industry": "Lucian Materials Forge",
    "Deployment": "Legio Teleportarium",
    "Intel": "Spatial Cogitator Array",
    "Fortification": "Solar Bulwark",
    "Emplacement": "Phosphor Battery",
    "Signature": "Teleportarium Nexus"
  },
  "Graia Forge": {
    "HQ": "Graian Logic Fortress",
    "Muster": "Steel-Mind Barracks",
    "War Forge": "Graian Machine Depot",
    "Doctrine": "Cerebral Cogitator Temple",
    "Sustainment": "Bionic Reclamation Cell",
    "Power": "Redundant Reactor Complex",
    "Logistics": "Automated Supply Vault",
    "Industry": "Relentless Manufactorum",
    "Deployment": "Mechanised Assembly Yard",
    "Intel": "Logic-Net Relay",
    "Fortification": "Unyielding Graian Bastion",
    "Emplacement": "Cognis Autocannon Battery",
    "Signature": "Steel Mind Nexus"
  },
  "Stygies VIII Forge": {
    "HQ": "Hidden Forge Command Node",
    "Muster": "Veiled Skitarii Vault",
    "War Forge": "Clandestine Machine Forge",
    "Doctrine": "Xenarite Research Vault",
    "Sustainment": "Concealed Reclamation Bay",
    "Power": "Masked Reactor",
    "Logistics": "Hidden Supply Vault",
    "Industry": "Secret Fabrication Cell",
    "Deployment": "Covert Transit Gate",
    "Intel": "Sensor-Scrambling Noosphere",
    "Fortification": "Shrouded Bastion",
    "Emplacement": "Concealed Phosphor Battery",
    "Signature": "Xenarite Clandestine Laboratory"
  },
  "T'au Sept": {
    "HQ": "Sept Command Dome",
    "Muster": "Fire Warrior Academy",
    "War Forge": "Battlesuit Assembly Facility",
    "Doctrine": "Earth Caste Laboratory",
    "Sustainment": "Medical Drone Bay",
    "Power": "Fusion Power Core",
    "Logistics": "Greater Good Supply Hub",
    "Industry": "Earth Caste Fabricator",
    "Deployment": "Orca Landing Zone",
    "Intel": "Markerlight Relay",
    "Fortification": "Tidewall Bastion",
    "Emplacement": "Drone Defence Turret",
    "Signature": "Ethereal Council Dome"
  },
  "Vior'la Sept": {
    "HQ": "Fire Caste Assault Command",
    "Muster": "Vior'la Warrior Academy",
    "War Forge": "Rapid Battlesuit Assembly Bay",
    "Doctrine": "Mont'ka Tactical Centre",
    "Sustainment": "Forward Medical Drone Bay",
    "Power": "High-Output Power Core",
    "Logistics": "Rapid Supply Hub",
    "Industry": "Assault Fabricator",
    "Deployment": "Fast Orca Pad",
    "Intel": "Target Acquisition Relay",
    "Fortification": "Mobile Tidewall",
    "Emplacement": "Burst-Cannon Drone Turret",
    "Signature": "Mont'ka Coordination Nexus"
  },
  "Sa'cea Sept": {
    "HQ": "Sa'cea Urban Command Dome",
    "Muster": "Urban Warfare Academy",
    "War Forge": "Armoured Battlesuit Facility",
    "Doctrine": "Kauyon Coordination Centre",
    "Sustainment": "Medical Drone Bay",
    "Power": "Hardened Power Core",
    "Logistics": "Urban Supply Node",
    "Industry": "Sa'cea Fabricator",
    "Deployment": "Devilfish Transit Yard",
    "Intel": "Citywide Marker Network",
    "Fortification": "Reinforced Tidewall",
    "Emplacement": "Rail Rifle Turret",
    "Signature": "Urban Defence Command Grid"
  },
  "Bork'an Sept": {
    "HQ": "Bork'an Scientific Command Dome",
    "Muster": "Fire Caste Training Complex",
    "War Forge": "Advanced Battlesuit Laboratory",
    "Doctrine": "Applied Sciences Institute",
    "Sustainment": "Advanced Medical Drone Lab",
    "Power": "Experimental Fusion Core",
    "Logistics": "Prototype Component Vault",
    "Industry": "Advanced Earth Caste Fabricator",
    "Deployment": "Experimental Aircraft Pad",
    "Intel": "Long-Range Sensor Array",
    "Fortification": "Experimental Shieldwall",
    "Emplacement": "Prototype Rail Battery",
    "Signature": "Bork'an Prototype Institute"
  },
  "Dal'yth Sept": {
    "HQ": "Dal'yth Coalition Command Dome",
    "Muster": "Auxiliary Muster Complex",
    "War Forge": "Coalition Vehicle Facility",
    "Doctrine": "Water Caste Coordination Centre",
    "Sustainment": "Multispecies Medical Bay",
    "Power": "Commerce-District Power Core",
    "Logistics": "Trade Supply Hub",
    "Industry": "Commercial Fabrication Centre",
    "Deployment": "Interstellar Trade Landing Zone",
    "Intel": "Diplomatic Communications Array",
    "Fortification": "Coalition Tidewall",
    "Emplacement": "Integrated Defence Turret",
    "Signature": "Auxiliary Coalition Embassy"
  },
  "Farsight Enclaves": {
    "HQ": "Enclave War Council",
    "Muster": "Fire Warrior War Academy",
    "War Forge": "Crisis Battlesuit Forge",
    "Doctrine": "Mont'ka War Room",
    "Sustainment": "Combat Medical Drone Bay",
    "Power": "Independent Fusion Core",
    "Logistics": "Enclave Supply Depot",
    "Industry": "Enclave Weapons Fabricator",
    "Deployment": "Battlesuit Deployment Pad",
    "Intel": "Forward Marker Relay",
    "Fortification": "Aggressive Tidewall",
    "Emplacement": "Fusion Defence Turret",
    "Signature": "Eight's Battlesuit Arsenal"
  },
  "Marker Network": {
    "HQ": "Drone Network Core",
    "Muster": "Drone Assembly Matrix",
    "War Forge": "Heavy Drone Factory",
    "Doctrine": "Targeting Algorithm Laboratory",
    "Sustainment": "Drone Repair Hub",
    "Power": "Network Power Core",
    "Logistics": "Drone Component Depot",
    "Industry": "Automated Fabricator",
    "Deployment": "Drone Launch Pad",
    "Intel": "Grand Markerlight Grid",
    "Fortification": "Shield Drone Web",
    "Emplacement": "Networked Missile Turret",
    "Signature": "Target Synchronisation Nexus"
  },
  "Guardian Web": {
    "HQ": "Guardian Control Core",
    "Muster": "Defence Drone Factory",
    "War Forge": "Shield Platform Assembly",
    "Doctrine": "Defensive Algorithm Laboratory",
    "Sustainment": "Automated Repair Hub",
    "Power": "Shield Power Core",
    "Logistics": "Guardian Supply Node",
    "Industry": "Drone Fabricator",
    "Deployment": "Rapid Drone Launch Grid",
    "Intel": "Perimeter Sensor Network",
    "Fortification": "Guardian Shield Web",
    "Emplacement": "Interlocking Drone Turrets",
    "Signature": "Aegis Drone Nexus"
  },
  "Recon Swarm": {
    "HQ": "Recon Command Core",
    "Muster": "Scout Drone Factory",
    "War Forge": "Stealth Drone Assembly Bay",
    "Doctrine": "Reconnaissance Algorithm Lab",
    "Sustainment": "Drone Repair Cell",
    "Power": "Lightweight Power Core",
    "Logistics": "Mobile Supply Node",
    "Industry": "Rapid Drone Fabricator",
    "Deployment": "Recon Launch Array",
    "Intel": "Wide-Area Sensor Web",
    "Fortification": "Concealed Shield Node",
    "Emplacement": "Hidden Drone Turret",
    "Signature": "Ghost Network Array"
  },
  "Ironjaw Mob": {
    "HQ": "Big Boss Hut",
    "Muster": "'Ard Boyz Hut",
    "War Forge": "Mega Mek Shop",
    "Doctrine": "Big Mek's Kunnin' Shed",
    "Sustainment": "Painboy Chop Shop",
    "Power": "Kustom Generator",
    "Logistics": "Big Dakka Dump",
    "Industry": "'Eavy Lootin' Yard",
    "Deployment": "Trukk Yard",
    "Intel": "Watcha Tower",
    "Fortification": "Scrapfort",
    "Emplacement": "Big Gunz Nest",
    "Signature": "Mega-Armour Workshop"
  },
  "Speed Freeks": {
    "HQ": "Speedboss Garage",
    "Muster": "Speedboyz Hut",
    "War Forge": "Kustom Speed Shop",
    "Doctrine": "Mekboy Tuning Shed",
    "Sustainment": "Roadside Painboy Hut",
    "Power": "High-Octane Fuel Gubbinz",
    "Logistics": "Mobile Dakka Dump",
    "Industry": "Scrap-Chop Yard",
    "Deployment": "Trukk & Bike Launch Yard",
    "Intel": "Speedwatch Tower",
    "Fortification": "Ramshackle Roadblock",
    "Emplacement": "Drive-By Dakka Tower",
    "Signature": "Racetrack of Gork"
  },
  "Freebooter Fleet": {
    "HQ": "Kaptin's Stronghold",
    "Muster": "Freebooter Crew Shack",
    "War Forge": "Looted Shipyard",
    "Doctrine": "Kaptin's Trophy Room",
    "Sustainment": "Sawbones Hut",
    "Power": "Looted Generator",
    "Logistics": "Plunder Warehouse",
    "Industry": "Lootin' Yard",
    "Deployment": "Kroozer Landing Dock",
    "Intel": "Spotter Mast",
    "Fortification": "Looted Bulwark",
    "Emplacement": "Flash Git Gun Deck",
    "Signature": "Kaptin's Treasure Hold"
  },
  "Goff Mob": {
    "HQ": "Goff Boss Hut",
    "Muster": "Goff Boyz Hut",
    "War Forge": "Brutal Mek Shop",
    "Doctrine": "Waaagh! Fight Pit",
    "Sustainment": "Painboy Hut",
    "Power": "Kustom Generator",
    "Logistics": "Dakka Dump",
    "Industry": "Scrap Yard",
    "Deployment": "Trukk Pen",
    "Intel": "Watcha Tower",
    "Fortification": "'Ard Goff Wall",
    "Emplacement": "Big Shoota Nest",
    "Signature": "Goff Fight Pit"
  }
});

Object.assign(RAW_SUBFACTION_BUILDINGS, {
  "Bad Moon Mob": {
    "HQ": "Flash Boss Palace",
    "Muster": "Flash Boyz Hut",
    "War Forge": "Gold-Toof Mek Shop",
    "Doctrine": "Supa-Kustom Workshop",
    "Sustainment": "Expensive Painboy Hut",
    "Power": "Deluxe Generator Gubbinz",
    "Logistics": "Massive Dakka Dump",
    "Industry": "Teef-Funded Lootin' Yard",
    "Deployment": "Flash Trukk Yard",
    "Intel": "Shiny Watcha Tower",
    "Fortification": "Gold-Plated Scrapfort",
    "Emplacement": "Supa-Dakka Battery",
    "Signature": "Bad Moon Gun Factory"
  },
  "Deathskull Mob": {
    "HQ": "Lootboss Shack",
    "Muster": "Loota Hut",
    "War Forge": "Salvage Mek Shop",
    "Doctrine": "Nicked Tek Workshop",
    "Sustainment": "Looted Painboy Shack",
    "Power": "Stolen Generator",
    "Logistics": "Loot Pile",
    "Industry": "Mega Salvage Yard",
    "Deployment": "Looted Wagon Yard",
    "Intel": "Nicked Vox Tower",
    "Fortification": "Rebuilt Scrapfort",
    "Emplacement": "Looted Gun Nest",
    "Signature": "Lucky Blue Salvage Shrine"
  },
  "Sautekh": {
    "HQ": "Sautekh Crown Tomb",
    "Muster": "Warrior Summoning Core",
    "War Forge": "Dynasty War Foundry",
    "Doctrine": "Phaeron Command Archive",
    "Sustainment": "Resurrection Node",
    "Power": "Gauss Energy Conduit",
    "Logistics": "Dynastic Repository",
    "Industry": "Necrodermis Forge",
    "Deployment": "Monolith Gate",
    "Intel": "Sautekh Obelisk",
    "Fortification": "Expansion Bastion",
    "Emplacement": "Gauss Pylon",
    "Signature": "Stormlord Command Nexus"
  },
  "Mephrit": {
    "HQ": "Mephrit Solar Tomb Core",
    "Muster": "Executioner Summoning Core",
    "War Forge": "Solar Weapon Forge",
    "Doctrine": "Annihilation Archive",
    "Sustainment": "Resurrection Node",
    "Power": "Solar Energy Conduit",
    "Logistics": "Gauss Repository",
    "Industry": "Mephrit Necrodermis Forge",
    "Deployment": "Monolith Gate",
    "Intel": "Solar Targeting Obelisk",
    "Fortification": "Quantum Bastion",
    "Emplacement": "Enhanced Gauss Pylon",
    "Signature": "Solar Annihilation Matrix"
  },
  "Novokh": {
    "HQ": "Novokh Blood Tomb",
    "Muster": "Execution Phalanx Core",
    "War Forge": "Destroyer Foundry",
    "Doctrine": "Slaughter Protocol Archive",
    "Sustainment": "Resurrection Node",
    "Power": "Crimson Energy Conduit",
    "Logistics": "Weapon Repository",
    "Industry": "Necrodermis Forge",
    "Deployment": "Assault Monolith Gate",
    "Intel": "Hunt Obelisk",
    "Fortification": "Quantum Bastion",
    "Emplacement": "Close-Defence Gauss Pylon",
    "Signature": "Destroyer Cult Crucible"
  },
  "Nihilakh": {
    "HQ": "Nihilakh Sovereign Tomb",
    "Muster": "Guardian Summoning Core",
    "War Forge": "Royal War Foundry",
    "Doctrine": "Territorial Protocol Archive",
    "Sustainment": "Enhanced Resurrection Node",
    "Power": "Sovereign Energy Conduit",
    "Logistics": "Dynastic Treasure Repository",
    "Industry": "Necrodermis Forge",
    "Deployment": "Monolith Gate",
    "Intel": "Territory Obelisk",
    "Fortification": "Eternal Quantum Bastion",
    "Emplacement": "Gauss Defence Pylon",
    "Signature": "Crownworld Dominion Node"
  },
  "Nephrekh": {
    "HQ": "Nephrekh Solar Crown Core",
    "Muster": "Translocation Summoning Core",
    "War Forge": "Phase Foundry",
    "Doctrine": "Translocation Archive",
    "Sustainment": "Resurrection Node",
    "Power": "Solar Absorption Conduit",
    "Logistics": "Phase Repository",
    "Industry": "Metagold Forge",
    "Deployment": "Translocation Gate",
    "Intel": "Phase-Sensor Obelisk",
    "Fortification": "Quantum Bastion",
    "Emplacement": "Phase Gauss Pylon",
    "Signature": "Dimensional Translocation Matrix"
  },
  "Szarekhan": {
    "HQ": "Szarekhan Royal Tomb",
    "Muster": "Triarch Summoning Core",
    "War Forge": "Ancestral War Foundry",
    "Doctrine": "Silent King's Archive",
    "Sustainment": "Royal Resurrection Node",
    "Power": "Ancient Energy Conduit",
    "Logistics": "Relic Repository",
    "Industry": "Ancestral Necrodermis Forge",
    "Deployment": "Royal Monolith Gate",
    "Intel": "Triarch Obelisk",
    "Fortification": "Royal Quantum Bastion",
    "Emplacement": "Relic Gauss Pylon",
    "Signature": "Triarch Relic Vault"
  },
  "Tomb Watch": {
    "HQ": "Tomb Guardian Core",
    "Muster": "Guardian Summoning Node",
    "War Forge": "Canoptek Defence Forge",
    "Doctrine": "Tomb Security Matrix",
    "Sustainment": "Reanimation Node",
    "Power": "Tomb Energy Conduit",
    "Logistics": "Guardian Repository",
    "Industry": "Canoptek Fabricator",
    "Deployment": "Tomb Portal",
    "Intel": "Perimeter Obelisk Network",
    "Fortification": "Tomb Bastion",
    "Emplacement": "Automated Gauss Pylon",
    "Signature": "Eternal Watch Matrix"
  },
  "Repair Cohort": {
    "HQ": "Canoptek Maintenance Core",
    "Muster": "Scarab Replication Node",
    "War Forge": "Canoptek Forge",
    "Doctrine": "Restoration Protocol Archive",
    "Sustainment": "Grand Reanimation Complex",
    "Power": "Repair Energy Conduit",
    "Logistics": "Necrodermis Repository",
    "Industry": "Self-Repair Fabricator",
    "Deployment": "Canoptek Portal",
    "Intel": "Damage Monitoring Obelisk",
    "Fortification": "Self-Healing Bastion",
    "Emplacement": "Repairable Gauss Pylon",
    "Signature": "Master Reconstruction Matrix"
  },
  "Hunter Matrix": {
    "HQ": "Canoptek Hunter Core",
    "Muster": "Hunter Construct Node",
    "War Forge": "Stalker Assembly Forge",
    "Doctrine": "Pursuit Algorithm Archive",
    "Sustainment": "Reanimation Node",
    "Power": "Hunter Energy Conduit",
    "Logistics": "Construct Repository",
    "Industry": "Canoptek Fabricator",
    "Deployment": "Rapid Phase Gate",
    "Intel": "Prey Acquisition Matrix",
    "Fortification": "Mobile Quantum Redoubt",
    "Emplacement": "Tracking Gauss Pylon",
    "Signature": "Predator Protocol Nexus"
  },
  "Leviathan": {
    "HQ": "Leviathan Synaptic Hive Node",
    "Muster": "Brood Nest",
    "War Forge": "Norn Gestation Chamber",
    "Doctrine": "Adaptive Evolution Chamber",
    "Sustainment": "Regeneration Spire",
    "Power": "Digestion Pool",
    "Logistics": "Feeder Organism Cluster",
    "Industry": "Biomass Reclamation Pool",
    "Deployment": "Aerial Brood Sac",
    "Intel": "Sensory Tendril Cluster",
    "Fortification": "Spore Chimney",
    "Emplacement": "Biovore Nest",
    "Signature": "Leviathan Norn Nexus"
  },
  "Kraken": {
    "HQ": "Kraken Synaptic Node",
    "Muster": "Rapid Brood Nest",
    "War Forge": "Swift-Beast Gestation Chamber",
    "Doctrine": "Hyper-Adaptive Evolution Chamber",
    "Sustainment": "Regeneration Spire",
    "Power": "Digestion Pool",
    "Logistics": "Mobile Feeder Cluster",
    "Industry": "Rapid Reclamation Pool",
    "Deployment": "Fast Aerial Brood Sac",
    "Intel": "Hunter Tendril Cluster",
    "Fortification": "Living Spore Wall",
    "Emplacement": "Mobile Biovore Nest",
    "Signature": "Kraken Migration Node"
  },
  "Behemoth": {
    "HQ": "Behemoth Synaptic Node",
    "Muster": "Assault Brood Nest",
    "War Forge": "Monstrous Gestation Chamber",
    "Doctrine": "Shock Evolution Chamber",
    "Sustainment": "Regeneration Spire",
    "Power": "Deep Digestion Pool",
    "Logistics": "Feeder Cluster",
    "Industry": "Biomass Reclamation Pit",
    "Deployment": "Tyrannocyte Brood Sac",
    "Intel": "Predator Sensory Organ",
    "Fortification": "Thickened Spore Chimney",
    "Emplacement": "Heavy Biovore Nest",
    "Signature": "Behemoth Crusher Nest"
  },
  "Jormungandr": {
    "HQ": "Jormungandr Subterranean Hive Node",
    "Muster": "Burrow Brood Nest",
    "War Forge": "Subterranean Gestation Chamber",
    "Doctrine": "Tunnel Adaptation Chamber",
    "Sustainment": "Buried Regeneration Organ",
    "Power": "Subsurface Digestion Pool",
    "Logistics": "Underground Feeder Network",
    "Industry": "Buried Reclamation Pool",
    "Deployment": "Tunnel Network",
    "Intel": "Tremor-Sense Cluster",
    "Fortification": "Buried Spore Bastion",
    "Emplacement": "Subterranean Biovore Nest",
    "Signature": "Great Burrow Nexus"
  },
  "Kronos": {
    "HQ": "Kronos Synaptic Hive Node",
    "Muster": "Ranged Brood Nest",
    "War Forge": "Bio-Artillery Gestation Chamber",
    "Doctrine": "Warp-Hunting Evolution Chamber",
    "Sustainment": "Synaptic Regeneration Spire",
    "Power": "Psychic Digestion Pool",
    "Logistics": "Feeder Cluster",
    "Industry": "Biomass Reclamation Pool",
    "Deployment": "Aerial Brood Sac",
    "Intel": "Warp-Sensing Tendril Array",
    "Fortification": "Shadow Spore Chimney",
    "Emplacement": "Exocrine/Biovore Nest",
    "Signature": "Shadow-in-the-Warp Amplifier"
  },
  "Gorgon": {
    "HQ": "Gorgon Synaptic Node",
    "Muster": "Toxic Brood Nest",
    "War Forge": "Venom Gestation Chamber",
    "Doctrine": "Hypertoxin Evolution Chamber",
    "Sustainment": "Adaptive Regeneration Spire",
    "Power": "Digestive Acid Pool",
    "Logistics": "Feeder Cluster",
    "Industry": "Toxic Reclamation Pool",
    "Deployment": "Spore Delivery Sac",
    "Intel": "Chemical Sensory Cluster",
    "Fortification": "Toxic Spore Chimney",
    "Emplacement": "Venom Cannon Nest",
    "Signature": "Hypertoxin Adaptation Organ"
  }
});

Object.assign(RAW_SUBFACTION_BUILDINGS, {
  "Hydra": {
    "HQ": "Hydra Synaptic Hive Node",
    "Muster": "Swarm Brood Nest",
    "War Forge": "Mass Gestation Chamber",
    "Doctrine": "Swarm Evolution Chamber",
    "Sustainment": "Brood Regeneration Spire",
    "Power": "Massive Digestion Pool",
    "Logistics": "Distributed Feeder Clusters",
    "Industry": "High-Throughput Reclamation Pool",
    "Deployment": "Mass Spore Sac",
    "Intel": "Distributed Sensory Web",
    "Fortification": "Layered Spore Chimneys",
    "Emplacement": "Brood Biovore Nest",
    "Signature": "Endless Brood Nexus"
  },
  "Lictor Brood": {
    "HQ": "Vanguard Synaptic Node",
    "Muster": "Lictor Gestation Nest",
    "War Forge": "Vanguard Organism Chamber",
    "Doctrine": "Assassination Adaptation Organ",
    "Sustainment": "Regeneration Cocoon",
    "Power": "Concealed Digestion Pool",
    "Logistics": "Hidden Feeder Organisms",
    "Industry": "Covert Reclamation Pool",
    "Deployment": "Infiltration Spore Node",
    "Intel": "Pheromone Hunter Network",
    "Fortification": "Concealed Spore Cysts",
    "Emplacement": "Ambush Spore Launcher",
    "Signature": "Deathleaper Hunting Nexus"
  },
  "Spore Web": {
    "HQ": "Spore Synaptic Nexus",
    "Muster": "Spore Organism Nest",
    "War Forge": "Spore Gestation Sac",
    "Doctrine": "Atmospheric Adaptation Organ",
    "Sustainment": "Regenerative Spore Pool",
    "Power": "Digestion Pool",
    "Logistics": "Feeder Web",
    "Industry": "Spore Reclamation Pool",
    "Deployment": "Aerial Spore Chimney",
    "Intel": "Planetary Spore-Sense Web",
    "Fortification": "Dense Spore Chimney",
    "Emplacement": "Spore Mine Launcher",
    "Signature": "Mycetic Saturation Network"
  },
  "Genestealer Vanguard": {
    "HQ": "Broodmind Synaptic Node",
    "Muster": "Genestealer Brood Nest",
    "War Forge": "Vanguard Gestation Chamber",
    "Doctrine": "Infiltration Adaptation Organ",
    "Sustainment": "Regeneration Cocoon",
    "Power": "Concealed Digestion Organ",
    "Logistics": "Hidden Feeder Cluster",
    "Industry": "Covert Reclamation Pit",
    "Deployment": "Subterranean Infiltration Tunnel",
    "Intel": "Broodmind Sensory Web",
    "Fortification": "Concealed Cyst Network",
    "Emplacement": "Ambush Bio-Weapon Nest",
    "Signature": "Broodlord Lair"
  },
  "Black Legion": {
    "HQ": "Black Crusade Citadel",
    "Muster": "Legion Mustering Hall",
    "War Forge": "Armoury of Damnation",
    "Doctrine": "Warmaster's Strategium",
    "Sustainment": "Sacrificial Apothecarion",
    "Power": "Warp Nexus",
    "Logistics": "Crusade Supply Vault",
    "Industry": "Dark Manufactorum",
    "Deployment": "Corrupted Drop-Pod Beacon",
    "Intel": "Black Crusade Vox Spire",
    "Fortification": "Chaos Bastion",
    "Emplacement": "Daemon Gun Platform",
    "Signature": "Speartip Command Nexus"
  },
  "Word Bearers": {
    "HQ": "Dark Apostle Citadel",
    "Muster": "Cult Mustering Temple",
    "War Forge": "Daemon Engine Forge",
    "Doctrine": "Forbidden Scripture Archive",
    "Sustainment": "Sacrificial Shrine",
    "Power": "Warp-Ritual Nexus",
    "Logistics": "Offering Vault",
    "Industry": "Daemonic Forge",
    "Deployment": "Summoning Circle",
    "Intel": "Corruption Spire",
    "Fortification": "Profane Bastion",
    "Emplacement": "Daemon Gun Shrine",
    "Signature": "Grand Possession Temple"
  },
  "Iron Warriors": {
    "HQ": "Iron Citadel",
    "Muster": "Siege Legion Barracks",
    "War Forge": "Daemon Siege Forge",
    "Doctrine": "Siege Calculation Archive",
    "Sustainment": "Fleshmetal Repair Pit",
    "Power": "Industrial Warp Reactor",
    "Logistics": "Siege Ammunition Vault",
    "Industry": "Dark Siege Manufactorum",
    "Deployment": "Armoured Staging Yard",
    "Intel": "Siege Observation Spire",
    "Fortification": "Iron Fortress Wall",
    "Emplacement": "Heavy Daemon Artillery",
    "Signature": "Grand Siegeworks"
  },
  "Night Lords": {
    "HQ": "Midnight Citadel",
    "Muster": "Terror Legion Hall",
    "War Forge": "Raptor Armoury",
    "Doctrine": "Terror Strategium",
    "Sustainment": "Fleshcraft Chamber",
    "Power": "Shadow Warp Nexus",
    "Logistics": "Hidden Supply Cache",
    "Industry": "Raiding Forge",
    "Deployment": "Raptor Launch Spire",
    "Intel": "Fear & Reconnaissance Spire",
    "Fortification": "Shadow Bastion",
    "Emplacement": "Ambush Gun Platform",
    "Signature": "Terror Broadcast Spire"
  },
  "Alpha Legion": {
    "HQ": "Hydra Command Cell",
    "Muster": "Covert Legion Facility",
    "War Forge": "Hidden Armoury",
    "Doctrine": "Harrowmaster Intelligence Vault",
    "Sustainment": "Covert Medicae Cell",
    "Power": "Masked Warp Generator",
    "Logistics": "Hidden Supply Network",
    "Industry": "Clandestine Forge",
    "Deployment": "Infiltration Transit Node",
    "Intel": "Hydra Signal Intercept Array",
    "Fortification": "False Bastion",
    "Emplacement": "Concealed Gun Platform",
    "Signature": "Hydra Deception Network"
  },
  "Emperor's Children": {
    "HQ": "Palatine Citadel",
    "Muster": "Perfectionist Legion Hall",
    "War Forge": "Sonic Armoury",
    "Doctrine": "Palace of Excess",
    "Sustainment": "Flesh-Sculptor Chamber",
    "Power": "Resonance Warp Nexus",
    "Logistics": "Trophy Vault",
    "Industry": "Artisan Forge of Excess",
    "Deployment": "Raptor/Transport Stage",
    "Intel": "Sensory Spire",
    "Fortification": "Ornate Chaos Bastion",
    "Emplacement": "Sonic Defence Platform",
    "Signature": "Grand Sonic Resonator"
  },
  "World Eaters": {
    "HQ": "Skull Citadel",
    "Muster": "Berzerker Pit",
    "War Forge": "Brazen Daemon Forge",
    "Doctrine": "Butcher's Nails Shrine",
    "Sustainment": "Blood Surgery Pit",
    "Power": "Blood Warp Nexus",
    "Logistics": "Skull & Weapon Cache",
    "Industry": "Brazen Forge",
    "Deployment": "Assault Transport Yard",
    "Intel": "Blood-Scent Watchtower",
    "Fortification": "Brass Bastion",
    "Emplacement": "Skull Cannon Platform",
    "Signature": "Arena of Khorne"
  },
  "Death Guard": {
    "HQ": "Plague Citadel",
    "Muster": "Plague Marine Mustering Hall",
    "War Forge": "Contagion Engine Forge",
    "Doctrine": "Plague Laboratory",
    "Sustainment": "Grandfather's Regeneration Garden",
    "Power": "Pestilent Warp Reactor",
    "Logistics": "Rotting Supply Vault",
    "Industry": "Blight Forge",
    "Deployment": "Plague Transport Yard",
    "Intel": "Miasma Spire",
    "Fortification": "Rot Bastion",
    "Emplacement": "Plagueburst Emplacement",
    "Signature": "Contagion Garden"
  },
  "Thousand Sons": {
    "HQ": "Prosperine Sorcerer Citadel",
    "Muster": "Rubricae Summoning Hall",
    "War Forge": "Arcane Machine Vault",
    "Doctrine": "Great Sorcerous Archive",
    "Sustainment": "Ritual Restoration Chamber",
    "Power": "Warp Confluence Nexus",
    "Logistics": "Arcane Relic Vault",
    "Industry": "Infernal Artifice Forge",
    "Deployment": "Webway/Warp Portal",
    "Intel": "Divination Spire",
    "Fortification": "Illusory Bastion",
    "Emplacement": "Warpflame Battery",
    "Signature": "Ritual of Change Nexus"
  },
  "Khorne Host": {
    "HQ": "Skull Throne Manifestation",
    "Muster": "Bloodletter Rift",
    "War Forge": "Brass Daemon Engine Pit",
    "Doctrine": "Altar of Slaughter",
    "Sustainment": "Blood Renewal Pit",
    "Power": "Blood Warp Rift",
    "Logistics": "Skull Tithe Heap",
    "Industry": "Brass Forge of Khorne",
    "Deployment": "Blood Gate",
    "Intel": "Hound-Scent Totem",
    "Fortification": "Brass Skull Bastion",
    "Emplacement": "Skull Cannon Rift",
    "Signature": "Great Altar of Khorne"
  },
  "Tzeentch Coven": {
    "HQ": "Impossible Crystal Citadel",
    "Muster": "Horror Conjuration Rift",
    "War Forge": "Mutalith Manifestation Chamber",
    "Doctrine": "Library of Changing Ways",
    "Sustainment": "Regenerative Flux Pool",
    "Power": "Sorcerous Warp Confluence",
    "Logistics": "Impossible Vault",
    "Industry": "Transmutation Nexus",
    "Deployment": "Ninefold Warp Gate",
    "Intel": "All-Seeing Crystal Spire",
    "Fortification": "Illusory Crystal Bastion",
    "Emplacement": "Warpflame Tower",
    "Signature": "Fateweaver's Divination Nexus"
  },
  "Nurgle Host": {
    "HQ": "Garden of Decay",
    "Muster": "Plaguebearer Fecundity Pit",
    "War Forge": "Daemonic Rot Engine Womb",
    "Doctrine": "Tallyman's Plague Garden",
    "Sustainment": "Feculent Regeneration Pool",
    "Power": "Pestilent Warp Growth",
    "Logistics": "Rotting Corpse Heap",
    "Industry": "Biomass Decay Garden",
    "Deployment": "Flyblown Warp Rift",
    "Intel": "Plaguefly Observation Swarm",
    "Fortification": "Feculent Gnarlmaw Wall",
    "Emplacement": "Plague Spewer Organ",
    "Signature": "Grandfather's Garden"
  },
  "Slaanesh Host": {
    "HQ": "Palace of Excess Manifestation",
    "Muster": "Daemonette Pleasure Rift",
    "War Forge": "Fiend Manifestation Chamber",
    "Doctrine": "Hall of Perfect Sensation",
    "Sustainment": "Excess Regeneration Shrine",
    "Power": "Sensory Warp Nexus",
    "Logistics": "Tribute Vault",
    "Industry": "Excess Transmutation Chamber",
    "Deployment": "Quicksilver Warp Gate",
    "Intel": "Sensory Perception Spire",
    "Fortification": "Mirror Bastion",
    "Emplacement": "Sonic Warp Shrine",
    "Signature": "Grand Stage of Excess"
  }
});

// PROFILE_DATA_END

export const SUBFACTION_BUILDING_ORDER = Object.freeze([
  "HQ",
  "Muster",
  "War Forge",
  "Doctrine",
  "Sustainment",
  "Power",
  "Logistics",
  "Industry",
  "Deployment",
  "Intel",
  "Fortification",
  "Emplacement",
  "Signature"
]);

export const SUBFACTION_BUILDING_SLOTS = Object.freeze({
  HQ: "outpost",
  Muster: "barracks",
  "War Forge": "workshop",
  Doctrine: "researchcenter",
  Sustainment: "fieldhospital",
  Power: "generator",
  Logistics: "warehouse",
  Industry: "refinery",
  Deployment: "dropbay",
  Intel: "observationtower",
  Fortification: "bunker",
  Emplacement: "turret",
  Signature: "signature"
});

function normalizeSubfaction(value = "") {
  return String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, "")
    .toLowerCase();
}

function freezeProfile(labels = {}) {
  return Object.freeze(Object.fromEntries(SUBFACTION_BUILDING_ORDER.map(slot => [
    slot,
    Object.freeze({
      slot,
      buildingType: SUBFACTION_BUILDING_SLOTS[slot],
      label: labels[slot]
    })
  ])));
}

export const SUBFACTION_BUILDINGS = Object.freeze(Object.fromEntries(
  Object.entries(RAW_SUBFACTION_BUILDINGS).map(([subfaction, labels]) => [
    subfaction,
    freezeProfile(labels)
  ])
));

const NORMALIZED_PROFILES = new Map(
  Object.entries(SUBFACTION_BUILDINGS).map(([subfaction, profile]) => [
    normalizeSubfaction(subfaction),
    profile
  ])
);

export function subfactionBuildingProfileFor(playerOrSubfaction = {}) {
  const subfaction = typeof playerOrSubfaction === "string"
    ? playerOrSubfaction
    : playerOrSubfaction?.subfaction;
  return NORMALIZED_PROFILES.get(normalizeSubfaction(subfaction)) || null;
}

export function subfactionBuildingLabelFor(playerOrSubfaction, buildingType, fallback = null) {
  const profile = subfactionBuildingProfileFor(playerOrSubfaction);
  const building = profile
    ? Object.values(profile).find(entry => entry.buildingType === buildingType)
    : null;
  return building?.label || fallback || buildingType;
}

export function subfactionBuildingTypesFor(playerOrSubfaction) {
  const profile = subfactionBuildingProfileFor(playerOrSubfaction);
  return profile
    ? SUBFACTION_BUILDING_ORDER.map(slot => profile[slot].buildingType)
    : [];
}

export function validateSubfactionBuildingCatalog({ expectedProfiles = 68 } = {}) {
  const issues = [];
  const profiles = Object.entries(SUBFACTION_BUILDINGS);
  if (profiles.length !== expectedProfiles) issues.push(`Expected ${expectedProfiles} subfactions, found ${profiles.length}.`);
  for (const [subfaction, profile] of profiles) {
    for (const slot of SUBFACTION_BUILDING_ORDER) {
      const entry = profile[slot];
      if (!entry?.label) issues.push(`${subfaction} is missing the ${slot} label.`);
      if (entry?.buildingType !== SUBFACTION_BUILDING_SLOTS[slot]) {
        issues.push(`${subfaction} has the wrong building type for ${slot}.`);
      }
    }
    const types = SUBFACTION_BUILDING_ORDER.map(slot => profile[slot]?.buildingType);
    if (new Set(types).size !== SUBFACTION_BUILDING_ORDER.length) {
      issues.push(`${subfaction} does not expose all 13 unique functional building types.`);
    }
  }
  return Object.freeze({
    valid: issues.length === 0,
    count: profiles.length,
    slotsPerProfile: SUBFACTION_BUILDING_ORDER.length,
    issues: Object.freeze(issues)
  });
}
