(() => {
  const modules = window.AWTModules ||= {};

  modules.factions = Object.freeze({
    astartes: {
      deployment: "Drop Pods, Thunderhawks, teleportation",
      buildings: { outpost: "Fortress Monastery", barracks: "Chapter Barracks", workshop: "Armoury", researchcenter: "Librarius", fieldhospital: "Apothecarion", generator: "Plasma Reactor", warehouse: "Supply Depot", refinery: "Manufactorum", dropbay: "Landing Pad", observationtower: "Listening Post", bunker: "Fortress Wall", turret: "Heavy Bolter Turret" },
      roster: {
        builder: ["Servitor"],
        trooper: ["Tactical Marine", "Intercessor", "Assault Intercessor", "Assault Marine", "Devastator", "Hellblaster", "Inceptor", "Aggressor", "Reiver", "Incursor", "Infiltrator"],
        scout: ["Scout Marine", "Eliminator", "Infiltrator"],
        medic: ["Apothecary"], engineer: ["Techmarine"],
        commander: ["Sergeant", "Lieutenant", "Captain", "Chapter Master", "Chaplain", "Librarian", "Judiciar"],
        standard: ["Ancient", "Company Champion", "Bladeguard Veteran"],
        vehicle: ["Rhino", "Razorback", "Impulsor", "Repulsor", "Land Raider", "Predator", "Gladiator", "Vindicator", "Whirlwind", "Dreadnought", "Redemptor Dreadnought"]
      }
    },
    guard: {
      deployment: "Ground deployment, convoys, Valkyries",
      buildings: { outpost: "Command Headquarters", barracks: "Barracks", workshop: "Manufactorum", researchcenter: "Tactica Command", fieldhospital: "Field Hospital", generator: "Generatorium", warehouse: "Supply Warehouse", refinery: "Promethium Refinery", dropbay: "Valkyrie Landing Pad", observationtower: "Vox Relay", bunker: "Bunker Network", turret: "Heavy Weapons Nest" },
      roster: {
        builder: ["Combat Engineer"],
        trooper: ["Guardsman", "Shock Trooper", "Heavy Weapons Team", "Kasrkin", "Tempestus Scion", "Ogryn", "Bullgryn"],
        scout: ["Ratling", "Sentinel Scout"], medic: ["Field Medic"], engineer: ["Combat Engineer"],
        commander: ["Officer", "Commissar", "Priest"], standard: ["Regimental Standard"],
        vehicle: ["Chimera", "Taurox", "Sentinel", "Hellhound", "Basilisk", "Manticore", "Hydra", "Leman Russ", "Rogal Dorn", "Baneblade"]
      }
    },
    chaos: {
      deployment: "Warp beacons, corrupted drop pods, summoning",
      buildings: { outpost: "Dark Citadel", barracks: "Cult Mustering Hall", workshop: "Armoury of Damnation", researchcenter: "Forbidden Archive", fieldhospital: "Sacrificial Shrine", generator: "Warp Nexus", warehouse: "Ammunition Cache", refinery: "Dark Forge", dropbay: "Warp Beacon", observationtower: "Corruption Spire", bunker: "Chaos Bastion", turret: "Daemon Gun Platform" },
      roster: {
        builder: ["Dark Servitor", "Cult Laborer"],
        trooper: ["Cultist", "Chaos Space Marine", "Havoc", "Chosen", "Possessed", "Noise Marine", "Plague Marine", "Rubric Marine", "Khorne Berzerker"],
        scout: ["Raptor", "Warp Talon"], medic: ["Dark Apostle"], engineer: ["Warpsmith"],
        commander: ["Chaos Lord", "Sorcerer", "Exalted Champion"], standard: ["Icon Bearer"],
        vehicle: ["Chaos Rhino", "Predator", "Land Raider", "Defiler", "Maulerfiend", "Forgefiend", "Heldrake", "Venomcrawler"]
      }
    },
    ork: {
      deployment: "Mobs, Trukks, scrap-built arrivals",
      buildings: { outpost: "Boss Camp", barracks: "Boyz Hut", workshop: "Mek Workshop", researchcenter: "Big Mek Tinkerin' Yard", fieldhospital: "Painboy Hut", generator: "Waaagh! Generator", warehouse: "Ammo Dump", mine: "Scrap Yard", farm: "Squig Pen", refinery: "Fuel Still", observationtower: "Watch Tower", bunker: "Scrap Bunker", turret: "Big Gunz Platform" },
      roster: {
        builder: ["Grot", "Mekboy"],
        trooper: ["Gretchin", "Boy", "Shoota Boy", "Slugga Boy", "Burna Boy", "Tankbusta", "Loota", "Nob", "Flash Git", "Meganob"],
        scout: ["Kommando"], medic: ["Painboy"], engineer: ["Big Mek"], commander: ["Warboss", "Weirdboy"], standard: ["Waaagh! Banner Nob"],
        vehicle: ["Trukk", "Battlewagon", "Deff Dread", "Killa Kan", "Looted Wagon", "Scrapjet", "Rukkatrukk Squigbuggy", "Dakkajet"]
      }
    },
    necron: {
      deployment: "Reanimation, portals, teleportation",
      buildings: { outpost: "Tomb Core", barracks: "Summoning Core", workshop: "Canoptek Forge", researchcenter: "Cryptek Archive", fieldhospital: "Resurrection Node", generator: "Energy Conduit", warehouse: "Gauss Repository", dropbay: "Monolith Gate", observationtower: "Obelisk", bunker: "Quantum Bastion", turret: "Gauss Pylon" },
      roster: {
        builder: ["Canoptek Scarab"], trooper: ["Warrior", "Immortal", "Lychguard", "Flayed One"],
        scout: ["Deathmark", "Triarch Praetorian"], medic: ["Technomancer"], engineer: ["Cryptek"],
        commander: ["Royal Warden", "Lord", "Overlord", "Chronomancer", "Plasmancer"], standard: ["Dynastic Herald"],
        vehicle: ["Ghost Ark", "Doomsday Ark", "Annihilation Barge", "Catacomb Command Barge", "Doom Scythe", "Night Scythe", "Monolith"]
      }
    },
    tau: {
      deployment: "Ground cadre, Devilfish, Orca and drone delivery",
      buildings: { outpost: "Command Dome", barracks: "Fire Warrior Barracks", workshop: "Earth Caste Workshop", researchcenter: "Earth Caste Laboratory", fieldhospital: "Medical Bay", generator: "Power Core", warehouse: "Supply Hub", refinery: "Vehicle Assembly Plant", dropbay: "Orca Landing Zone", observationtower: "Communications Relay", bunker: "Tidewall", turret: "Drone Turret" },
      roster: {
        builder: ["Earth Caste Engineer"], trooper: ["Fire Warrior", "Breacher", "Crisis Battlesuit", "Broadside", "Ghostkeel"],
        scout: ["Pathfinder", "Stealth Suit"], medic: ["Medical Drone", "Shield Drone"], engineer: ["Repair Drone"],
        commander: ["Cadre Fireblade", "Ethereal", "Commander", "Darkstrider"], standard: ["Marker Drone"],
        vehicle: ["Devilfish", "Hammerhead", "Skyray", "Piranha", "Stormsurge", "Barracuda"]
      }
    },
    tyranid: {
      deployment: "Biological spawning, burrowing, Tyrannocytes",
      buildings: { outpost: "Hive Node", barracks: "Spawning Pool", workshop: "Evolution Chamber", researchcenter: "Norn Adaptation Node", fieldhospital: "Synapse Nexus", generator: "Digestion Pool", warehouse: "Biomass Pit", mine: "Capillary Feeder", farm: "Biomass Garden", refinery: "Digestion Pool", dropbay: "Tyrannocyte Chimney", observationtower: "Capillary Tower", bunker: "Spore Chimney", turret: "Bio-plasma Spire" },
      roster: {
        builder: ["Ripper Swarm", "Norn Drone"], trooper: ["Termagant", "Hormagaunt", "Genestealer", "Tyranid Warrior", "Venomthrope", "Zoanthrope"],
        scout: ["Gargoyle", "Ravener"], medic: ["Venomthrope"], engineer: ["Norn Drone"],
        commander: ["Tyranid Prime", "Neurotyrant", "Broodlord", "Hive Tyrant", "Swarmlord"], standard: ["Synapse Organism"],
        vehicle: ["Carnifex", "Screamer-Killer", "Trygon", "Mawloc", "Haruspex", "Exocrine", "Tyrannofex", "Tyrannocyte"]
      }
    }
  });
})();
