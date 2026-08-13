const modules = globalThis.AWTModules ||= {};

export const factionConfig = Object.freeze({
    astartes: {
      deployment: "Drop Pods, Thunderhawks, teleportation",
      buildings: { outpost: "Fortress Monastery", barracks: "Chapter Barracks", workshop: "Armoury", researchcenter: "Librarius", fieldhospital: "Apothecarion", generator: "Plasma Reactor", warehouse: "Supply Depot", refinery: "Manufactorum", dropbay: "Landing Pad", observationtower: "Listening Post", bunker: "Fortress Wall", turret: "Heavy Bolter Turret" },
      roster: {
        builder: ["Servitor"],
        supply: ["Chapter Supply Servitor", "Rhino Supply Carrier"],
        trooper: ["Tactical Marine", "Intercessor", "Assault Intercessor", "Assault Marine", "Devastator", "Hellblaster", "Inceptor", "Aggressor", "Reiver", "Incursor", "Infiltrator"],
        scout: ["Scout Marine", "Skull Probe", "Eliminator", "Infiltrator"],
        medic: ["Apothecary"], engineer: ["Techmarine"],
        commander: ["Sergeant", "Lieutenant", "Captain", "Chapter Master", "Chaplain", "Librarian", "Judiciar"],
        standard: ["Ancient", "Company Champion", "Bladeguard Veteran", "Sternguard", "Vanguard Veteran", "Terminator", "Assault Terminator"],
        vehicle: ["Rhino", "Razorback", "Impulsor", "Repulsor", "Land Raider", "Predator", "Gladiator", "Vindicator", "Whirlwind", "Hunter", "Stalker", "Storm Speeder", "Invader ATV", "Dreadnought", "Redemptor Dreadnought", "Ballistus Dreadnought", "Brutalis Dreadnought", "Thunderhawk", "Stormraven", "Stormtalon", "Stormhawk"]
      }
    },
    guard: {
      deployment: "Ground deployment, convoys, Valkyries",
      buildings: { outpost: "Command Headquarters", barracks: "Barracks", workshop: "Manufactorum", researchcenter: "Tactica Command", fieldhospital: "Field Hospital", generator: "Generatorium", warehouse: "Supply Warehouse", refinery: "Promethium Refinery", dropbay: "Valkyrie Landing Pad", observationtower: "Vox Relay", bunker: "Bunker Network", turret: "Heavy Weapons Nest" },
      roster: {
        builder: ["Combat Engineer"],
        supply: ["Munitorum Cargo Carrier", "Trojan Support Vehicle"],
        trooper: ["Guardsman", "Shock Trooper", "Heavy Weapons Team", "Kasrkin", "Tempestus Scion", "Ogryn", "Bullgryn"],
        scout: ["Ratling", "Sentinel Scout"], medic: ["Field Medic"], engineer: ["Combat Engineer"],
        commander: ["Officer", "Commissar", "Priest"], standard: ["Regimental Standard"],
        vehicle: ["Chimera", "Taurox", "Sentinel", "Hellhound", "Basilisk", "Manticore", "Hydra", "Leman Russ", "Rogal Dorn", "Baneblade"]
      }
    },
    mechanicus: {
      deployment: "Forge-world cohort, armored crawler columns, and noospheric relays",
      buildings: { outpost: "Forge Temple", barracks: "Skitarii Maniple Foundry", workshop: "Cybernetica Workshop", researchcenter: "Noosphere Archive", fieldhospital: "Tech-Priest Reclamation Bay", generator: "Plasma Generatorium", warehouse: "Forge Vault", refinery: "Factorum Refinery", dropbay: "Macro-Lander Pad", observationtower: "Noospheric Relay", bunker: "Aegis Bulwark", turret: "Onager Defense Battery" },
      roster: {
        builder: ["Tech-Priest Enginseer", "Construction Servitor"],
        supply: ["Servitor Cargo Cohort", "Triaros Supply Crawler"],
        trooper: ["Skitarii Ranger", "Skitarii Vanguard", "Kataphron Breacher", "Sicarian Infiltrator"],
        scout: ["Sydonian Dragoon", "Pteraxii Skystalker"], medic: ["Tech-Priest Reclamation Adept"], engineer: ["Tech-Priest Enginseer"],
        commander: ["Skitarii Alpha", "Tech-Priest Dominus", "Tech-Priest Manipulus"], standard: ["Data-Tether Bearer"],
        vehicle: ["Onager Dunecrawler", "Skorpius Dunerider", "Skorpius Disintegrator", "Kastelan Robot"]
      }
    },
    chaos: {
      deployment: "Warp beacons, corrupted drop pods, summoning",
      buildings: { outpost: "Dark Citadel", barracks: "Cult Mustering Hall", workshop: "Armoury of Damnation", researchcenter: "Forbidden Archive", fieldhospital: "Sacrificial Shrine", generator: "Warp Nexus", warehouse: "Ammunition Cache", refinery: "Dark Forge", dropbay: "Warp Beacon", observationtower: "Corruption Spire", bunker: "Chaos Bastion", turret: "Daemon Gun Platform" },
      roster: {
        builder: ["Dark Servitor", "Cult Laborer"],
        supply: ["Traitor Cargo Hauler", "Daemon-bound Supply Carrier"],
        trooper: ["Cultist", "Chaos Space Marine", "Havoc", "Chosen", "Possessed", "Noise Marine", "Plague Marine", "Rubric Marine", "Khorne Berzerker"],
        scout: ["Skull Probe", "Raptor", "Warp Talon"], medic: ["Dark Apostle"], engineer: ["Warpsmith"],
        commander: ["Chaos Lord", "Sorcerer", "Exalted Champion"], standard: ["Icon Bearer"],
        vehicle: ["Chaos Rhino", "Predator", "Land Raider", "Defiler", "Maulerfiend", "Forgefiend", "Heldrake", "Venomcrawler"]
      }
    },
    ork: {
      deployment: "Spore patches, ramshackle camps, mobs and Trukks",
      buildings: { outpost: "Boss Hut", barracks: "Boyz Hut", workshop: "Mek Shop", researchcenter: "Big Mek's Workshop", fieldhospital: "Painboy Hut", generator: "Kustom Generator", warehouse: "Dakka Dump", fueldepot: "Fuel Gubbinz", ammodepot: "Dakka Dump", mine: "Scrap Pile", farm: "Squig Pen", refinery: "Lootin' Yard", dropbay: "Tellyporta Pad", observationtower: "Watcha Tower", bunker: "Waaagh! Banner", turret: "Big Gunz Nest" },
      roster: {
        builder: ["Gretchin"],
        supply: ["Loot Trukk", "Grot Scrap Hauler"],
        trooper: ["Gretchin", "Boy", "Shoota Boy", "Slugga Boy", "Burna Boy", "Tankbusta", "Loota", "Nob", "Flash Git", "Meganob"],
        scout: ["Kommando"], medic: ["Painboy"], engineer: ["Mekboy", "Big Mek"], commander: ["Boss Nob", "Warboss", "Weirdboy"], standard: ["Waaagh! Banner Nob"],
        vehicle: ["Trukk", "Battlewagon", "Deff Dread", "Killa Kan", "Looted Wagon", "Scrapjet", "Rukkatrukk Squigbuggy", "Dakkajet"]
      }
    },
    necron: {
      deployment: "Reanimation, portals, teleportation",
      buildings: { outpost: "Tomb Core", barracks: "Summoning Core", workshop: "Canoptek Forge", researchcenter: "Cryptek Archive", fieldhospital: "Resurrection Node", generator: "Energy Conduit", warehouse: "Gauss Repository", dropbay: "Monolith Gate", observationtower: "Obelisk", bunker: "Quantum Bastion", turret: "Gauss Pylon" },
      roster: {
        builder: ["Canoptek Scarab"], supply: ["Canoptek Logistics Barge", "Canoptek Hauler"], trooper: ["Warrior", "Immortal", "Lychguard", "Flayed One"],
        scout: ["Deathmark", "Triarch Praetorian"], medic: ["Technomancer"], engineer: ["Cryptek"],
        commander: ["Royal Warden", "Lord", "Overlord", "Chronomancer", "Plasmancer"], standard: ["Dynastic Herald"],
        vehicle: ["Ghost Ark", "Doomsday Ark", "Annihilation Barge", "Catacomb Command Barge", "Doom Scythe", "Night Scythe", "Monolith"]
      }
    },
    tau: {
      deployment: "Ground cadre, Devilfish, Orca and drone delivery",
      buildings: { outpost: "Command Dome", barracks: "Fire Warrior Barracks", workshop: "Earth Caste Workshop", researchcenter: "Earth Caste Laboratory", fieldhospital: "Medical Bay", generator: "Power Core", warehouse: "Supply Hub", refinery: "Vehicle Assembly Plant", dropbay: "Orca Landing Zone", observationtower: "Communications Relay", bunker: "Tidewall", turret: "Drone Turret" },
      roster: {
        builder: ["Earth Caste Engineer"], supply: ["Cargo Drone", "Tetra Supply Skimmer"], trooper: ["Fire Warrior", "Breacher", "Crisis Battlesuit", "Broadside", "Ghostkeel"],
        scout: ["Pathfinder", "Stealth Suit"], medic: ["Medical Drone", "Shield Drone"], engineer: ["Repair Drone"],
        commander: ["Cadre Fireblade", "Ethereal", "Commander", "Darkstrider"], standard: ["Marker Drone"],
        vehicle: ["Devilfish", "Hammerhead", "Skyray", "Piranha", "Stormsurge", "Barracuda"]
      }
    },
    tyranid: {
      deployment: "Mycetic Spores, Tyrannocytes, brood nests, tunnels and infestation zones",
      buildings: { outpost: "Synaptic Hive Node", barracks: "Brood Nest", workshop: "Norn Gestation Chamber", researchcenter: "Evolutionary Chamber", fieldhospital: "Synapse Spire", generator: "Digestion Pool", warehouse: "Feeder Organism Cluster", mine: "Infestation Node", farm: "Reclamation Pool", refinery: "Capillary Tower", dropbay: "Aerial Brood Sac", observationtower: "Sensory Tendril Cluster", bunker: "Spore Chimney", turret: "Biovore Nest" },
      roster: {
        builder: ["Ripper Tendril"], supply: ["Biomass Carrier Organism", "Feeder Transport Beast"], trooper: ["Termagant", "Hormagaunt", "Genestealer", "Tyranid Warrior", "Venomthrope", "Zoanthrope"],
        scout: ["Gargoyle", "Ravener"], medic: ["Feeder Organism"], engineer: ["Ripper Tendril"],
        commander: ["Tyranid Prime", "Neurotyrant", "Broodlord", "Hive Tyrant", "Swarmlord"], standard: ["Synapse Organism"],
        vehicle: ["Carnifex", "Screamer-Killer", "Trygon", "Mawloc", "Haruspex", "Exocrine", "Tyrannofex", "Tyrannocyte"]
      }
    }
});

modules.factions = factionConfig;
export default factionConfig;
