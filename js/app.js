
    (() => {
      const root = document.getElementById("autonomous-war-theater");
      if (!root || root.dataset.foundryReady === "true") return;
      root.dataset.foundryReady = "true";

      const canvas = root.querySelector("#awt-canvas");
      const ctx = canvas.getContext("2d");
      const economyConfig = window.AWTModules?.economy || {};
      const tradeRouteRules = window.AWTModules?.tradeRoutes || {};
      const VW = 960;
      const VH = 540;
      const ids = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l"];
      const basePositions = ids.map((_, index) => {
        const angle = -Math.PI / 2 + index * Math.PI * 2 / ids.length;
        return { x: 480 + Math.cos(angle) * 390, y: 270 + Math.sin(angle) * 205 };
      });
      const defaultColors = [
        "#3b82f6", "#ef476f", "#22c55e", "#eab308",
        "#a855f7", "#f97316", "#14b8a6", "#ec4899",
        "#84cc16", "#06b6d4", "#8b5cf6", "#f43f5e"
      ];
      let battleRandom = seededRandom("AWT-742918");
      const rand = (min, max) => min + battleRandom() * (max - min);
      const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
      const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
      const pad2 = value => String(value).padStart(2, "0");
      const formatElapsed = seconds => `${pad2(Math.floor(seconds / 60))}:${pad2(Math.floor(seconds % 60))}`;
      const colorProbe = document.createElement("span");
      colorProbe.setAttribute("aria-hidden", "true");
      colorProbe.style.position = "absolute";
      colorProbe.style.visibility = "hidden";
      colorProbe.style.pointerEvents = "none";
      root.append(colorProbe);
      const token = name => {
        colorProbe.style.color = `var(${name})`;
        return getComputedStyle(colorProbe).color;
      };

      const els = {
        overlay: root.querySelector("#awt-overlay"),
        mainActions: root.querySelector("#awt-main-actions"),
        setupPanel: root.querySelector("#awt-setup-panel"),
        playerPanel: root.querySelector("#awt-player-panel"),
        loadPanel: root.querySelector("#awt-load-panel"),
        quitPanel: root.querySelector("#awt-quit-panel"),
        editorBar: root.querySelector("#awt-editor-bar"),
        editorTip: root.querySelector("#awt-editor-tip"),
        battleName: root.querySelector("#awt-battle-name"),
        pause: root.querySelector("#awt-pause-button"),
        inspector: root.querySelector("#awt-inspector"),
        inspectorButton: root.querySelector("#awt-inspector-button"),
        fullscreenButton: root.querySelector("#awt-fullscreen-button"),
        fogButton: root.querySelector("#awt-fog-button"),
        territoryToggle: root.querySelector("#awt-territory-toggle"),
        lightingToggle: root.querySelector("#awt-lighting-toggle"),
        logisticsButton: root.querySelector("#awt-logistics-button"),
        logisticsPanel: root.querySelector("#awt-logistics-panel"),
        logisticsClose: root.querySelector("#awt-logistics-close"),
        logisticsPlayer: root.querySelector("#awt-logistics-player"),
        logisticsPersonality: root.querySelector("#awt-logistics-personality"),
        logisticsResources: root.querySelector("#awt-logistics-resources"),
        logisticsProduction: root.querySelector("#awt-logistics-production"),
        logisticsStorage: root.querySelector("#awt-logistics-storage"),
        logisticsQueue: root.querySelector("#awt-logistics-queue"),
        logisticsConvoys: root.querySelector("#awt-logistics-convoys"),
        logisticsOfficers: root.querySelector("#awt-logistics-officers"),
        supplyRadiusToggle: root.querySelector("#awt-supply-radius-toggle"),
        roadsToggle: root.querySelector("#awt-roads-toggle"),
        zoomOut: root.querySelector("#awt-zoom-out"),
        zoomIn: root.querySelector("#awt-zoom-in"),
        zoomValue: root.querySelector("#awt-zoom-value"),
        fieldMode: root.querySelector("#awt-field-mode"),
        clock: root.querySelector("#awt-clock"),
        weather: root.querySelector("#awt-weather"),
        forceValue: root.querySelector("#awt-a-strength"),
        forceContext: root.querySelector("#awt-a-context"),
        playerCount: root.querySelector("#awt-a-doctrine"),
        buildingValue: root.querySelector("#awt-b-strength"),
        buildingContext: root.querySelector("#awt-b-context"),
        resolutionBadge: root.querySelector("#awt-b-doctrine"),
        unitName: root.querySelector("#awt-unit-name"),
        unitRole: root.querySelector("#awt-unit-role"),
        unitState: root.querySelector("#awt-unit-state"),
        unitSelect: root.querySelector("#awt-unit-select"),
        attachSelect: root.querySelector("#awt-attach-select"),
        attachButton: root.querySelector("#awt-attach-button"),
        healthBar: root.querySelector("#awt-health-bar"),
        moraleBar: root.querySelector("#awt-morale-bar"),
        fatigueBar: root.querySelector("#awt-fatigue-bar"),
        healthValue: root.querySelector("#awt-health-value"),
        moraleValue: root.querySelector("#awt-morale-value"),
        fatigueValue: root.querySelector("#awt-fatigue-value"),
        unitStats: root.querySelector("#awt-unit-stats"),
        unitKills: root.querySelector("#awt-unit-kills"),
        unitDepth: root.querySelector("#awt-unit-depth"),
        squadSummary: root.querySelector("#awt-squad-summary"),
        unitAction: root.querySelector("#awt-unit-action"),
        unitLog: root.querySelector("#awt-unit-log"),
        eventList: root.querySelector("#awt-event-list"),
        eventCount: root.querySelector("#awt-event-count"),
        timeline: root.querySelector("#awt-timeline"),
        timelineMode: root.querySelector("#awt-timeline-mode"),
        timelineTime: root.querySelector("#awt-timeline-time"),
        mapResolution: root.querySelector("#awt-map-resolution"),
        customResolution: root.querySelector("#awt-custom-resolution"),
        customWidth: root.querySelector("#awt-custom-width"),
        customHeight: root.querySelector("#awt-custom-height"),
        playerCountSelect: root.querySelector("#awt-player-count"),
        playerTabs: root.querySelector("#awt-player-tabs"),
        playerPanelTitle: root.querySelector("#awt-player-panel-title"),
        playerName: root.querySelector("#awt-player-name"),
        playerRace: root.querySelector("#awt-player-race"),
        playerFaction: root.querySelector("#awt-player-faction"),
        playerSubfaction: root.querySelector("#awt-player-subfaction"),
        playerTeam: root.querySelector("#awt-player-team"),
        playerDoctrine: root.querySelector("#awt-player-doctrine"),
        playerColor: root.querySelector("#awt-player-color"),
        playerColorValue: root.querySelector("#awt-player-color-value"),
        playerSecondaryColor: root.querySelector("#awt-player-secondary-color"),
        playerSecondaryColorValue: root.querySelector("#awt-player-secondary-color-value"),
        playerPattern: root.querySelector("#awt-player-pattern"),
        spritePanel: root.querySelector("#awt-sprite-panel"),
        spriteFamily: root.querySelector("#awt-sprite-family"),
        spriteVariant: root.querySelector("#awt-sprite-variant"),
        spriteMode: root.querySelector("#awt-sprite-mode"),
        spritePlayer: root.querySelector("#awt-sprite-player"),
        spriteCanvas: root.querySelector("#awt-sprite-canvas"),
        spriteMaskLine: root.querySelector("#awt-sprite-mask-line"),
        editorTool: root.querySelector("#awt-editor-tool"),
        spawnPlayer: root.querySelector("#awt-spawn-player"),
        zoneShape: root.querySelector("#awt-zone-shape"),
        zoneSize: root.querySelector("#awt-zone-size"),
        zoneSizeValue: root.querySelector("#awt-zone-size-value"),
        clearZone: root.querySelector("#awt-clear-zone"),
        paintControls: root.querySelector("#awt-paint-controls"),
        randomBiome: root.querySelector("#awt-random-biome"),
        randomSeed: root.querySelector("#awt-random-seed"),
        randomizeMap: root.querySelector("#awt-randomize-map"),
        brushPresets: root.querySelector("#awt-brush-presets"),
        brushCategory: root.querySelector("#awt-brush-category"),
        brushType: root.querySelector("#awt-brush-type"),
        brushSize: root.querySelector("#awt-brush-size"),
        brushSizeValue: root.querySelector("#awt-brush-size-value"),
        brushOpacity: root.querySelector("#awt-brush-opacity"),
        brushOpacityValue: root.querySelector("#awt-brush-opacity-value"),
        brushOpacityNumber: root.querySelector("#awt-brush-opacity-number"),
        brushHardness: root.querySelector("#awt-brush-hardness"),
        brushHardnessValue: root.querySelector("#awt-brush-hardness-value"),
        brushFalloff: root.querySelector("#awt-brush-falloff"),
        brushFalloffValue: root.querySelector("#awt-brush-falloff-value"),
        brushShape: root.querySelector("#awt-brush-shape"),
        paintMode: root.querySelector("#awt-paint-mode"),
        territoryControls: root.querySelector("#awt-territory-controls"),
        territorySelect: root.querySelector("#awt-territory-select"),
        territoryEditMode: root.querySelector("#awt-territory-edit-mode"),
        territoryName: root.querySelector("#awt-territory-name"),
        territoryOwner: root.querySelector("#awt-territory-owner"),
        territoryResource: root.querySelector("#awt-territory-resource"),
        territoryStrategic: root.querySelector("#awt-territory-strategic"),
        territoryDefense: root.querySelector("#awt-territory-defense"),
        territoryCapture: root.querySelector("#awt-territory-capture"),
        territoryStructures: root.querySelector("#awt-territory-structures"),
        territoryMaxStructures: root.querySelector("#awt-territory-max-structures"),
        territorySupply: root.querySelector("#awt-territory-supply"),
        territoryAbandon: root.querySelector("#awt-territory-abandon"),
        territoryShare: root.querySelector("#awt-territory-share"),
        territoryUnclaimable: root.querySelector("#awt-territory-unclaimable"),
        territoryLocked: root.querySelector("#awt-territory-locked"),
        lightingControls: root.querySelector("#awt-lighting-controls"),
        timeMode: root.querySelector("#awt-time-mode"),
        timeOfDay: root.querySelector("#awt-time-of-day"),
        timeOfDayValue: root.querySelector("#awt-time-of-day-value"),
        dayLength: root.querySelector("#awt-day-length"),
        dayLengthValue: root.querySelector("#awt-day-length-value"),
        latitude: root.querySelector("#awt-latitude"),
        latitudeValue: root.querySelector("#awt-latitude-value"),
        season: root.querySelector("#awt-season"),
        lightingWeather: root.querySelector("#awt-lighting-weather"),
        enableLighting: root.querySelector("#awt-enable-lighting"),
        castShadows: root.querySelector("#awt-cast-shadows"),
        lightingOverlay: root.querySelector("#awt-lighting-overlay"),
        artificialLights: root.querySelector("#awt-artificial-lights"),
        buildingColors: root.querySelector("#awt-building-colors"),
        colorIntensity: root.querySelector("#awt-color-intensity"),
        colorIntensityValue: root.querySelector("#awt-color-intensity-value"),
        factionPreservation: root.querySelector("#awt-faction-preservation"),
        teamEmblems: root.querySelector("#awt-team-emblems"),
        accessibilityPatterns: root.querySelector("#awt-accessibility-patterns"),
        eraseBrush: root.querySelector("#awt-erase-brush")
      };

      let colors = {};
      function refreshColors() {
        colors = {
          background: token("--background"),
          foreground: token("--foreground"),
          card: token("--card"),
          muted: token("--muted"),
          mutedForeground: token("--muted-foreground"),
          border: token("--border"),
          accent: token("--accent"),
          water: token("--viz-series-2"),
          terrain: token("--viz-series-3"),
          danger: token("--viz-series-5"),
          signal: token("--viz-series-6")
        };
      }
      refreshColors();

      const raceCatalog = {
        "Imperium": {
          builder: "Servitor",
          factions: {
            "Space Marines": ["Ultramarines", "Blood Angels", "Imperial Fists"],
            "Imperial Guard": ["Cadian 8th", "Steel Legion", "Tempestus Scions"],
            "Machine Cult": ["Mars Forge", "Ryza Forge", "Lucius Forge"]
          }
        },
        "T'au": {
          builder: "Earth Caste Engineer",
          factions: {
            "Frontier Cadre": ["T'au Sept", "Vior'la Sept", "Sa'cea Sept"],
            "Drone Collective": ["Marker Network", "Guardian Web", "Recon Swarm"]
          }
        },
        "Orks": {
          builder: "Mek Boy",
          factions: {
            "Redfang Horde": ["Ironjaw Mob", "Speed Freeks", "Freebooter Fleet"],
            "Scrap Legion": ["Goff Mob", "Bad Moon Mob", "Deathskull Mob"]
          }
        },
        "Necrons": {
          builder: "Canoptek Scarab",
          factions: {
            "Dynastic Host": ["Sautekh", "Mephrit", "Novokh"],
            "Canoptek Swarm": ["Tomb Watch", "Repair Cohort", "Hunter Matrix"]
          }
        },
        "Tyranids": {
          builder: "Norn Drone",
          factions: {
            "Hive Fleet": ["Leviathan", "Kraken", "Behemoth"],
            "Vanguard Organisms": ["Lictor Brood", "Spore Web", "Genestealer Vanguard"]
          }
        },
        "Chaos": {
          builder: "Dark Servitor",
          factions: {
            "Chaos Space Marines": ["Black Legion", "Word Bearers", "Iron Warriors"],
            "Daemon Host": ["Khorne Host", "Tzeentch Coven", "Nurgle Host"]
          }
        }
      };

      const brushLayers = {
        "Ground": ["ground", "grass", "darkgrass", "tallgrass", "dirt", "mud", "sand", "gravel", "rock", "snow", "ice", "swamp", "pavement", "ash", "lava", "water", "shallowwater", "deepwater", "river", "beach", "forestfloor"],
        "Elevation": ["raise", "lower", "smooth", "flatten", "noise", "terrace", "hill", "mountain", "cliff"],
        "Vegetation": ["shortgrass", "tallgrass", "bushes", "largebush", "flowers", "crops", "sapling", "smalltree", "mediumtree", "largetree", "pinetree", "palmtree", "deadforest", "jungle", "stump", "fallenlog", "vines", "reeds", "lilypads", "trees", "denseforest"],
        "Natural objects": ["pebbles", "smallrocks", "boulders", "crystal", "cave", "cliffwall", "riverbank", "waterfall", "snowdrift"],
        "Roads": ["dirtroad", "stoneroad", "asphalt", "trail", "railway", "bridge", "woodenbridge", "pontoonbridge"],
        "Economy structures": ["headquarters", "resourcecollector", "mine", "refinery", "generator", "farm", "storage", "warehouse"],
        "Military structures": ["barracks", "vehiclefactory", "airfield", "navalyard", "armory", "researchcenter", "medicalcenter", "repairbay"],
        "Defense structures": ["wall", "gate", "turret", "bunker", "pillbox", "watchtower", "radar", "shieldgenerator"],
        "Logistics structures": ["supplydepot", "fueldepot", "ammodepot", "communicationscenter"],
        "Rocks & urban": ["road", "ruins", "building", "factory", "spaceport", "landingpad", "powerplant", "civilian"],
        "Military": ["trenches", "bunker", "foxhole", "barbedwire", "tanktraps", "minefield", "turret", "outpost", "observationtower"],
        "Weather zones": ["heavyfog", "ashstorm", "snowstorm", "heavyrain", "duststorm", "wind", "heat", "radiation", "poison"]
      };

      const brushNames = {
        ground: "Ground", dirt: "Dirt", grass: "Grass", darkgrass: "Dark grass", mud: "Mud", sand: "Sand", gravel: "Gravel", snow: "Snow",
        rock: "Rock", pavement: "Pavement", ash: "Ash", swamp: "Swamp", water: "Water", tallgrass: "Tall grass",
        ice: "Ice", lava: "Lava", shallowwater: "Shallow water", deepwater: "Deep water", river: "River", beach: "Beach", forestfloor: "Forest floor",
        raise: "Raise terrain", lower: "Lower terrain", smooth: "Smooth", flatten: "Flatten",
        noise: "Noise brush", terrace: "Terrace brush", hill: "Hill", mountain: "Mountain", cliff: "Cliff brush",
        bushes: "Bushes", trees: "Trees", denseforest: "Dense forest",
        deadforest: "Dead forest", jungle: "Jungle", crops: "Crops", flowers: "Flowers",
        smallrocks: "Small rocks", boulders: "Boulders", cliffwall: "Cliff wall", cave: "Cave",
        road: "Road", bridge: "Bridge", ruins: "Ruins", building: "Building", wall: "Wall",
        gate: "Gate", factory: "Factory", spaceport: "Spaceport", landingpad: "Landing pad",
        powerplant: "Power plant", barracks: "Barracks", civilian: "Civilian structure",
        trenches: "Trenches", bunker: "Bunker", foxhole: "Foxhole", barbedwire: "Barbed wire",
        tanktraps: "Tank traps", minefield: "Minefield", turret: "Turret", outpost: "Outpost",
        observationtower: "Observation tower", heavyfog: "Heavy fog", ashstorm: "Ash storm",
        snowstorm: "Snowstorm", heavyrain: "Heavy rain", duststorm: "Dust storm",
        wind: "Wind direction", heat: "Heat", radiation: "Radiation", poison: "Poison cloud"
      };

      Object.assign(brushNames, {
        shortgrass: "Short grass", largebush: "Large bush", sapling: "Sapling", smalltree: "Small tree",
        mediumtree: "Medium tree", largetree: "Large tree", pinetree: "Pine tree", palmtree: "Palm tree",
        stump: "Stump", fallenlog: "Fallen log", vines: "Vines", reeds: "Reeds", lilypads: "Lily pads",
        pebbles: "Pebbles", crystal: "Crystal", riverbank: "River bank", waterfall: "Waterfall", snowdrift: "Snow drift",
        dirtroad: "Dirt road", stoneroad: "Stone road", asphalt: "Asphalt", trail: "Trail", railway: "Railway",
        woodenbridge: "Wooden bridge", pontoonbridge: "Pontoon bridge", headquarters: "Headquarters",
        resourcecollector: "Resource collector", mine: "Mine", refinery: "Refinery", generator: "Generator",
        farm: "PHN2ZyB3aWR0aD0iNjgwIiBoZWlnaHQ9IjM4MCIgdmlld0JveD0iMCAwIDY4MCAzODAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CgoKPHJlY3QgeD0iMTgwIiB5PSI3MCIgd2lkdGg9IjMyMCIgaGVpZ2h0PSIyNDAiIHJ4PSI0IiBmaWxsPSIjNWE2MTQ0IiBzdHJva2U9IiMyYTJkMjQiIHN0cm9rZS13aWR0aD0iMyIvPgo8cmVjdCB4PSIxODAiIHk9IjcwIiB3aWR0aD0iMzIwIiBoZWlnaHQ9IjI0MCIgcng9IjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2E4OTk2OCIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtZGFzaGFycmF5PSI0IDQiLz4KPGcgZmlsbD0iIzRhN2EzYSIgc3Ryb2tlPSIjMmE1YTI0IiBzdHJva2Utd2lkdGg9IjIiPgo8cmVjdCB4PSIyMDAiIHk9IjkwIiB3aWR0aD0iODAiIGhlaWdodD0iNzAiIHJ4PSIzIi8+CjxyZWN0IHg9IjI5MCIgeT0iOTAiIHdpZHRoPSI4MCIgaGVpZ2h0PSI3MCIgcng9IjMiLz4KPHJlY3QgeD0iMjAwIiB5PSIxNzAiIHdpZHRoPSI4MCIgaGVpZ2h0PSI3MCIgcng9IjMiLz4KPHJlY3QgeD0iMjkwIiB5PSIxNzAiIHdpZHRoPSI4MCIgaGVpZ2h0PSI3MCIgcng9IjMiLz4KPC9nPgo8ZyBzdHJva2U9IiMzYTZhMmMiIHN0cm9rZS13aWR0aD0iMSI+CjxsaW5lIHgxPSIyMTAiIHkxPSIxMDUiIHgyPSIyNzAiIHkyPSIxMDUiLz4KPGxpbmUgeDE9IjIxMCIgeTE9IjEyMCIgeDI9IjI3MCIgeTI9IjEyMCIvPgo8bGluZSB4MT0iMjEwIiB5MT0iMTM1IiB4Mj0iMjcwIiB5Mj0iMTM1Ii8+CjxsaW5lIHgxPSIyMTAiIHkxPSIxNTAiIHgyPSIyNzAiIHkyPSIxNTAiLz4KPGxpbmUgeDE9IjMwMCIgeTE9IjEwNSIgeDI9IjM2MCIgeTI9IjEwNSIvPgo8bGluZSB4MT0iMzAwIiB5MT0iMTIwIiB4Mj0iMzYwIiB5Mj0iMTIwIi8+CjxsaW5lIHgxPSIzMDAiIHkxPSIxMzUiIHgyPSIzNjAiIHkyPSIxMzUiLz4KPGxpbmUgeDE9IjMwMCIgeTE9IjE1MCIgeDI9IjM2MCIgeTI9IjE1MCIvPgo8bGluZSB4MT0iMjEwIiB5MT0iMTg1IiB4Mj0iMjcwIiB5Mj0iMTg1Ii8+CjxsaW5lIHgxPSIyMTAiIHkxPSIyMDAiIHgyPSIyNzAiIHkyPSIyMDAiLz4KPGxpbmUgeDE9IjIxMCIgeTE9IjIxNSIgeDI9IjI3MCIgeTI9IjIxNSIvPgo8bGluZSB4MT0iMjEwIiB5MT0iMjMwIiB4Mj0iMjcwIiB5Mj0iMjMwIi8+CjxsaW5lIHgxPSIzMDAiIHkxPSIxODUiIHgyPSIzNjAiIHkyPSIxODUiLz4KPGxpbmUgeDE9IjMwMCIgeTE9IjIwMCIgeDI9IjM2MCIgeTI9IjIwMCIvPgo8bGluZSB4MT0iMzAwIiB5MT0iMjE1IiB4Mj0iMzYwIiB5Mj0iMjE1Ii8+CjxsaW5lIHgxPSIzMDAiIHkxPSIyMzAiIHgyPSIzNjAiIHkyPSIyMzAiLz4KPC9nPgo8cmVjdCB4PSI0MDAiIHk9Ijk1IiB3aWR0aD0iODAiIGhlaWdodD0iNjAiIHJ4PSI0IiBmaWxsPSIjNmIzYTJjIiBzdHJva2U9IiMzYTFlMTYiIHN0cm9rZS13aWR0aD0iMyIvPgo8cmVjdCB4PSI0MTUiIHk9IjExMiIgd2lkdGg9IjUwIiBoZWlnaHQ9IjI1IiBmaWxsPSIjNGEyYTIwIi8+CjxsaW5lIHgxPSI0MDAiIHkxPSIyNTUiIHgyPSI0ODAiIHkyPSIyNTUiIHN0cm9rZT0iIzNhM2UyYyIgc3Ryb2tlLXdpZHRoPSI0Ii8+CjxjaXJjbGUgY3g9IjQwMCIgY3k9IjI1NSIgcj0iNyIgZmlsbD0iIzNhM2UyYyIvPgo8Y2lyY2xlIGN4PSI0NDAiIGN5PSIyNTUiIHI9IjciIGZpbGw9IiM0YTkwZDQiLz4KPGNpcmNsZSBjeD0iNDgwIiBjeT0iMjU1IiByPSI3IiBmaWxsPSIjM2EzZTJjIi8+Cjwvc3ZnPg==", storage: "Storage", warehouse: "Warehouse", vehiclefactory: "Vehicle factory",
        airfield: "Airfield", navalyard: "Naval yard", armory: "Armory", researchcenter: "Research center",
        medicalcenter: "Medical center", repairbay: "Repair bay", pillbox: "Pillbox", watchtower: "Watchtower",
        radar: "Radar", shieldgenerator: "Shield generator", supplydepot: "Supply depot", fueldepot: "Fuel depot",
        ammodepot: "Ammunition depot", communicationscenter: "Communications center"
      });

      const vegetationTypes = new Set(brushLayers["Vegetation"]);
      const urbanTypes = new Set([
        ...brushLayers["Roads"], ...brushLayers["Economy structures"], ...brushLayers["Logistics structures"],
        "road", "ruins", "building", "factory", "spaceport", "landingpad", "powerplant", "civilian"
      ]);
      const militaryTypes = new Set([...brushLayers["Military"], ...brushLayers["Military structures"], ...brushLayers["Defense structures"]]);
      const weatherTypes = new Set(brushLayers["Weather zones"]);
      const elevationTypes = new Set(brushLayers["Elevation"]);

      const buildingCatalog = {
        outpost: { label: "Headquarters", cost: 20, purpose: "Command", military: 2, economic: 4, risk: 1, height: 12, light: 55, maxHp: 720, hitbox: { w: 40, h: 34 }, supplyRadius: 135, spriteIndex: 0, produces: { requisition: 7, influence: 2 }, consumes: { energy: 1 }, storage: { requisition: 240, materials: 160, food: 120, medical: 80, influence: 100 } },
        generator: { label: "Generator", cost: 28, purpose: "Energy", military: 0, economic: 5, risk: 2, requires: "outpost", height: 10, light: 80, maxHp: 360, hitbox: { w: 30, h: 28 }, supplyRadius: 70, spriteIndex: 4, produces: { energy: 16 }, consumes: { fuel: 2 }, storage: { energy: 120 } },
        barracks: { label: "Barracks", cost: 42, purpose: "Production", military: 4, economic: 2, risk: 3, requires: "outpost", height: 14, light: 45, maxHp: 520, hitbox: { w: 36, h: 30 }, supplyRadius: 82, consumes: { energy: 2, food: 2, materials: 1 } },
        bunker: { label: "Bunker", cost: 34, purpose: "Defense", military: 5, economic: 0, risk: 1, requires: "outpost", height: 7, light: 26, maxHp: 920, hitbox: { w: 34, h: 26 }, supplyRadius: 45, consumes: { ammunition: 1, energy: 1 } },
        turret: { label: "Automated Turret", cost: 46, purpose: "Defense", military: 6, economic: 0, risk: 2, requires: "generator", height: 16, light: 72, maxHp: 410, hitbox: { w: 22, h: 22 }, supplyRadius: 40, consumes: { ammunition: 2, energy: 2 } },
        workshop: { label: "Manufactorum", cost: 54, purpose: "Technology", military: 3, economic: 4, risk: 4, requires: "generator", height: 18, light: 60, maxHp: 560, hitbox: { w: 38, h: 32 }, supplyRadius: 90, spriteIndex: 1, produces: { ammunition: 9, parts: 5, materials: 3 }, consumes: { energy: 5, materials: 2 } },
        researchcenter: { label: "Research Center", cost: 52, purpose: "Research", military: 3, economic: 3, risk: 3, requires: "generator", height: 16, light: 82, maxHp: 470, hitbox: { w: 36, h: 30 }, supplyRadius: 86, spriteIndex: 1, consumes: { energy: 4, materials: 1, influence: 1 } },
        observationtower: { label: "Observation Tower", cost: 30, purpose: "Intelligence", military: 2, economic: 1, risk: 1, requires: "outpost", height: 28, light: 130, searchlight: true, maxHp: 260, hitbox: { w: 18, h: 18 }, supplyRadius: 55, consumes: { energy: 1 } },
        fieldhospital: { label: "Medical Depot", cost: 40, purpose: "Medical", military: 2, economic: 2, risk: 2, requires: "generator", height: 13, light: 58, maxHp: 420, hitbox: { w: 32, h: 28 }, supplyRadius: 105, produces: { medical: 6 }, consumes: { energy: 3, food: 1 }, storage: { medical: 150, food: 80 } },
        warehouse: { label: "Warehouse", cost: 34, purpose: "Storage", military: 0, economic: 5, risk: 1, requires: "outpost", height: 11, light: 34, maxHp: 470, hitbox: { w: 38, h: 30 }, supplyRadius: 125, spriteIndex: 7, storage: { requisition: 180, materials: 240, parts: 160, food: 120 } },
        fueldepot: { label: "Fuel Depot", cost: 36, purpose: "Storage", military: 0, economic: 4, risk: 5, requires: "outpost", height: 9, light: 42, maxHp: 330, hitbox: { w: 34, h: 28 }, supplyRadius: 105, spriteIndex: 3, storage: { fuel: 260 } },
        ammodepot: { label: "Ammo Depot", cost: 38, purpose: "Storage", military: 2, economic: 3, risk: 5, requires: "outpost", height: 9, light: 30, maxHp: 350, hitbox: { w: 34, h: 26 }, supplyRadius: 110, spriteIndex: 6, storage: { ammunition: 260 } },
        farm: { label: "Supply Farm", cost: 30, purpose: "Food", military: 0, economic: 5, risk: 1, requires: "outpost", height: 6, light: 18, maxHp: 300, hitbox: { w: 40, h: 30 }, supplyRadius: 80, spriteIndex: 5, produces: { food: 13, medical: 1 }, consumes: { energy: 1 }, storage: { food: 100 } },
        mine: { label: "Material Mine", cost: 38, purpose: "Materials", military: 0, economic: 5, risk: 2, requires: "outpost", height: 8, light: 45, maxHp: 440, hitbox: { w: 36, h: 30 }, supplyRadius: 75, spriteIndex: 2, produces: { materials: 14 }, consumes: { energy: 2 }, storage: { materials: 90 } },
        refinery: { label: "Fuel Refinery", cost: 44, purpose: "Fuel", military: 0, economic: 5, risk: 4, requires: "generator", height: 16, light: 70, maxHp: 450, hitbox: { w: 38, h: 32 }, supplyRadius: 78, spriteIndex: 3, produces: { fuel: 11 }, consumes: { energy: 4, materials: 1 }, storage: { fuel: 90 } },
        dropbay: { label: "Orbital Launch Bay", cost: 58, purpose: "Reinforcement", military: 4, economic: 3, risk: 3, requires: "generator", height: 17, light: 90, maxHp: 620, hitbox: { w: 42, h: 34 }, supplyRadius: 95, spriteIndex: 1, consumes: { energy: 4, fuel: 2 } }
      };

      const factionProfiles = window.AWTModules?.factions || {
        astartes: {
          deployment: "Drop Pods, Thunderhawks, teleportation",
          buildings: { outpost: "Fortress Monastery", barracks: "Chapter Barracks", workshop: "Armoury", researchcenter: "Librarius", fieldhospital: "Apothecarion", generator: "Plasma Reactor", warehouse: "Supply Depot", refinery: "Manufactorum", dropbay: "Landing Pad", observationtower: "Listening Post", bunker: "Fortress Wall", turret: "Heavy Bolter Turret" },
          roster: { builder: ["Servitor"], trooper: ["Tactical Marine", "Intercessor", "Assault Intercessor", "Hellblaster"], scout: ["Scout Marine", "Infiltrator", "Eliminator"], medic: ["Apothecary"], engineer: ["Techmarine"], commander: ["Sergeant", "Lieutenant", "Captain", "Chapter Master"], standard: ["Ancient", "Company Champion"], vehicle: ["Rhino", "Predator", "Dreadnought", "Land Raider"] }
        },
        guard: {
          deployment: "Ground deployment, convoys, Valkyries",
          buildings: { outpost: "Command Headquarters", barracks: "Barracks", workshop: "Manufactorum", researchcenter: "Tactica Command", fieldhospital: "Field Hospital", generator: "Generatorium", warehouse: "Supply Warehouse", refinery: "Promethium Refinery", dropbay: "Valkyrie Landing Pad", observationtower: "Vox Relay", bunker: "Bunker Network", turret: "Heavy Weapons Nest" },
          roster: { builder: ["Combat Engineer"], trooper: ["Guardsman", "Shock Trooper", "Kasrkin", "Tempestus Scion"], scout: ["Ratling", "Sentinel Scout"], medic: ["Field Medic"], engineer: ["Combat Engineer"], commander: ["Officer", "Commissar"], standard: ["Regimental Standard"], vehicle: ["Chimera", "Sentinel", "Leman Russ", "Rogal Dorn"] }
        },
        chaos: {
          deployment: "Warp beacons, corrupted drop pods, summoning",
          buildings: { outpost: "Dark Citadel", barracks: "Cult Mustering Hall", workshop: "Armoury of Damnation", researchcenter: "Forbidden Archive", fieldhospital: "Sacrificial Shrine", generator: "Warp Nexus", warehouse: "Ammunition Cache", refinery: "Dark Forge", dropbay: "Warp Beacon", observationtower: "Corruption Spire", bunker: "Chaos Bastion", turret: "Daemon Gun Platform" },
          roster: { builder: ["Dark Servitor", "Cult Laborer"], trooper: ["Cultist", "Chaos Space Marine", "Havoc", "Chosen"], scout: ["Raptor", "Warp Talon"], medic: ["Dark Apostle"], engineer: ["Warpsmith"], commander: ["Chaos Lord", "Exalted Champion"], standard: ["Icon Bearer"], vehicle: ["Chaos Rhino", "Defiler", "Forgefiend", "Venomcrawler"] }
        },
        ork: {
          deployment: "Mobs, Trukks, scrap-built arrivals",
          buildings: { outpost: "Boss Camp", barracks: "Boyz Hut", workshop: "Mek Workshop", researchcenter: "Big Mek Tinkerin' Yard", fieldhospital: "Painboy Hut", generator: "Waaagh! Generator", warehouse: "Ammo Dump", mine: "Scrap Yard", farm: "Squig Pen", refinery: "Fuel Still", observationtower: "Watch Tower", bunker: "Scrap Bunker", turret: "Big Gunz Platform" },
          roster: { builder: ["Grot", "Mekboy"], trooper: ["Slugga Boy", "Shoota Boy", "Burna Boy", "Tankbusta"], scout: ["Kommando"], medic: ["Painboy"], engineer: ["Big Mek"], commander: ["Nob", "Warboss"], standard: ["Waaagh! Banner Nob"], vehicle: ["Trukk", "Battlewagon", "Deff Dread", "Killa Kan"] }
        },
        necron: {
          deployment: "Reanimation, portals, teleportation",
          buildings: { outpost: "Tomb Core", barracks: "Summoning Core", workshop: "Canoptek Forge", researchcenter: "Cryptek Archive", fieldhospital: "Resurrection Node", generator: "Energy Conduit", warehouse: "Gauss Repository", dropbay: "Monolith Gate", observationtower: "Obelisk", bunker: "Quantum Bastion", turret: "Gauss Pylon" },
          roster: { builder: ["Canoptek Scarab"], trooper: ["Warrior", "Immortal", "Lychguard", "Flayed One"], scout: ["Deathmark", "Triarch Praetorian"], medic: ["Technomancer"], engineer: ["Cryptek"], commander: ["Royal Warden", "Lord", "Overlord"], standard: ["Dynastic Herald"], vehicle: ["Ghost Ark", "Doomsday Ark", "Annihilation Barge", "Monolith"] }
        },
        tau: {
          deployment: "Ground cadre, Devilfish, Orca and drone delivery",
          buildings: { outpost: "Command Dome", barracks: "Fire Warrior Barracks", workshop: "Earth Caste Workshop", researchcenter: "Earth Caste Laboratory", fieldhospital: "Medical Bay", generator: "Power Core", warehouse: "Supply Hub", refinery: "Vehicle Assembly Plant", dropbay: "Orca Landing Zone", observationtower: "Communications Relay", bunker: "Tidewall", turret: "Drone Turret" },
          roster: { builder: ["Earth Caste Engineer"], trooper: ["Fire Warrior", "Breacher", "Crisis Battlesuit", "Broadside"], scout: ["Pathfinder", "Stealth Suit"], medic: ["Medical Drone"], engineer: ["Repair Drone"], commander: ["Cadre Fireblade", "Ethereal", "Commander"], standard: ["Marker Drone"], vehicle: ["Devilfish", "Hammerhead", "Skyray", "Piranha"] }
        },
        tyranid: {
          deployment: "Biological spawning, burrowing, Tyrannocytes",
          buildings: { outpost: "Hive Node", barracks: "Spawning Pool", workshop: "Evolution Chamber", researchcenter: "Norn Adaptation Node", fieldhospital: "Synapse Nexus", generator: "Digestion Pool", warehouse: "Biomass Pit", mine: "Capillary Feeder", farm: "Biomass Garden", refinery: "Digestion Pool", dropbay: "Tyrannocyte Chimney", observationtower: "Capillary Tower", bunker: "Spore Chimney", turret: "Bio-plasma Spire" },
          roster: { builder: ["Ripper Swarm", "Norn Drone"], trooper: ["Termagant", "Hormagaunt", "Genestealer", "Tyranid Warrior"], scout: ["Gargoyle", "Ravener"], medic: ["Venomthrope"], engineer: ["Norn Drone"], commander: ["Tyranid Prime", "Neurotyrant", "Hive Tyrant"], standard: ["Synapse Organism"], vehicle: ["Carnifex", "Trygon", "Exocrine", "Tyrannofex"] }
        }
      };

      function factionProfile(playerOrFaction) {
        const player = typeof playerOrFaction === "string" ? playerFor(playerOrFaction) : playerOrFaction;
        if (player.race === "Chaos") return factionProfiles.chaos;
        if (player.race === "Orks") return factionProfiles.ork;
        if (player.race === "Necrons") return factionProfiles.necron;
        if (player.race === "T'au") return factionProfiles.tau;
        if (player.race === "Tyranids") return factionProfiles.tyranid;
        return player.faction === "Space Marines" ? factionProfiles.astartes : factionProfiles.guard;
      }

      function factionBuildingLabel(faction, type) {
        return factionProfile(faction).buildings[type] || buildingCatalog[type]?.label || type;
      }

      function factionUnitName(player, role, index) {
        const roster = factionProfile(player).roster[role] || factionProfile(player).roster.trooper;
        return roster[index % roster.length];
      }

      const economyResourceKeys = ["requisition", "materials", "fuel", "energy", "ammunition", "medical", "food", "influence", "parts"];
      const economyResourceLabels = { requisition: "Req", materials: "Mat", fuel: "Fuel", energy: "Power", ammunition: "Ammo", medical: "Med", food: "Food", influence: "Influence", parts: "Parts" };
      const economySpriteSourceData = {
        ork: "assets/buildings/ork.svg",
        marine: "assets/buildings/marine.svg",
        guard: {
          farm: "assets/buildings/imperial-guard/farm.svg",
          generator: "assets/buildings/imperial-guard/generator.svg",
          refinery: "assets/buildings/imperial-guard/refinery.svg",
          mine: "assets/buildings/imperial-guard/mine.svg",
          workshop: "assets/buildings/imperial-guard/workshop.svg",
          outpost: "assets/buildings/imperial-guard/outpost.svg"
        }
      };
      const economySpriteImages = { guard: {} };
      function registerEconomySprite(family, type, data) {
        if (!data || data.startsWith("__")) return;
        const image = new Image();
        image.onload = () => draw();
        image.src = data.startsWith("assets/") ? data : `data:image/svg+xml;base64,${data}`;
        if (type) economySpriteImages.guard[type] = image;
        else economySpriteImages[family] = image;
      }
      registerEconomySprite("ork", null, economySpriteSourceData.ork);
      registerEconomySprite("marine", null, economySpriteSourceData.marine);
      Object.entries(economySpriteSourceData.guard).forEach(([type, data]) => registerEconomySprite("guard", type, data));

      function buildingSpriteFamily(player) {
        if (player.race === "Orks") return "ork";
        if (player.race === "Imperium" && player.faction === "Space Marines") return "marine";
        if (player.race === "Imperium") return "guard";
        return "procedural";
      }

      function guardSpriteFor(type) {
        return economySpriteImages.guard[type]
          || economySpriteImages.guard[type === "warehouse" || type === "ammodepot" ? "workshop" : type === "fueldepot" ? "refinery" : "outpost"];
      }

      function drawEconomyBuildingSprite(item, width, height) {
        const spec = buildingCatalog[item.type];
        if (spec?.spriteIndex == null || item.progress < 0.42 || item.alive === false) return false;
        const family = buildingSpriteFamily(playerFor(item.faction));
        ctx.save();
        ctx.globalAlpha = clamp(item.progress, 0, 1) * clamp(item.condition ?? 1, 0.25, 1);
        ctx.imageSmoothingEnabled = true;
        if (family === "ork" && economySpriteImages.ork?.complete && economySpriteImages.ork.naturalWidth) {
          const index = spec.spriteIndex;
          const col = index % 4;
          const row = Math.floor(index / 4);
          ctx.drawImage(economySpriteImages.ork, 20 + col * 290, 20 + row * 380, 260, 225, -width * 0.72, -height * 0.72, width * 1.44, height * 1.28);
          ctx.restore();
          return true;
        }
        if (family === "marine" && economySpriteImages.marine?.complete && economySpriteImages.marine.naturalWidth) {
          const index = spec.spriteIndex;
          const col = index % 4;
          const row = Math.floor(index / 4);
          ctx.drawImage(economySpriteImages.marine, 10 + col * 170, 38 + row * 210, 150, 150, -width * 0.7, -height * 0.76, width * 1.4, height * 1.36);
          ctx.restore();
          return true;
        }
        const guard = family === "guard" ? guardSpriteFor(item.type) : null;
        if (guard?.complete && guard.naturalWidth) {
          const sourceHeight = Math.max(180, guard.naturalHeight - 44);
          ctx.drawImage(guard, 140, 26, 400, sourceHeight, -width * 0.78, -height * 0.74, width * 1.56, height * 1.38);
          ctx.restore();
          return true;
        }
        ctx.restore();
        return false;
      }

      const roleNames = {
        builder: "Builder",
        commander: "Squad Leader",
        standard: "Standard Bearer",
        medic: "Medical Specialist",
        engineer: "Combat Engineer",
        scout: "Recon Specialist",
        trooper: "Line Infantry",
        vehicle: "Crewed Vehicle"
      };
      const trainingRoles = ["commander", "trooper", "trooper", "medic", "engineer", "trooper", "standard", "scout", "trooper", "vehicle"];
      const squadNames = ["Alpha", "Bravo", "Cinder", "Delta", "Echo", "Ferro"];
      const namesA = ["Cassian", "Aelius", "Marius", "Lucan", "Titus", "Varro", "Sabian", "Corvin", "Drusus", "Acastus", "Decimus", "Silan"];
      const namesB = ["Rakka", "Gorz", "Skarn", "Vek", "Drokk", "Mazza", "Krag", "Thrum", "Zagga", "Brukk", "Morkai", "Grim"];

      const presets = {
        iron: {
          name: "Iron Pass",
          startMinute: 420,
          resolution: { width: 1920, height: 1080 },
          features: [
            { type: "raise", x: 278, y: 162, r: 68, visual: "elevation" },
            { type: "terrace", x: 666, y: 378, r: 76, visual: "elevation" },
            { type: "trees", x: 312, y: 392, r: 64, visual: "vegetation" },
            { type: "denseforest", x: 710, y: 136, r: 60, visual: "vegetation" },
            { type: "tallgrass", x: 480, y: 158, r: 58, visual: "vegetation" },
            { type: "water", x: 490, y: 286, r: 48, visual: "water" },
            { type: "trenches", x: 405, y: 258, r: 34, visual: "military" },
            { type: "bunker", x: 560, y: 300, r: 30, visual: "military" },
            { type: "heavyrain", x: 530, y: 210, r: 108, visual: "weather" }
          ]
        },
        verdant: {
          name: "Verdant Delta",
          startMinute: 330,
          resolution: { width: 2560, height: 1440 },
          features: [
            { type: "water", x: 475, y: 150, r: 78, visual: "water" },
            { type: "water", x: 510, y: 340, r: 94, visual: "water" },
            { type: "denseforest", x: 265, y: 140, r: 82, visual: "vegetation" },
            { type: "jungle", x: 708, y: 405, r: 72, visual: "vegetation" },
            { type: "tallgrass", x: 350, y: 370, r: 84, visual: "vegetation" },
            { type: "bushes", x: 645, y: 170, r: 80, visual: "vegetation" },
            { type: "heavyfog", x: 480, y: 270, r: 132, visual: "weather" }
          ]
        },
        ash: {
          name: "Ash Meridian",
          startMinute: 1240,
          resolution: { width: 1280, height: 720 },
          features: [
            { type: "raise", x: 350, y: 150, r: 84, visual: "elevation" },
            { type: "cliff", x: 625, y: 390, r: 86, visual: "elevation" },
            { type: "ruins", x: 430, y: 210, r: 44, visual: "urban" },
            { type: "tanktraps", x: 525, y: 330, r: 40, visual: "military" },
            { type: "ash", x: 300, y: 380, r: 88, visual: "ground" },
            { type: "ashstorm", x: 650, y: 180, r: 120, visual: "weather" }
          ]
        }
      };

      const setupPlayers = [
        { id: "a", index: 0, race: "Imperium", faction: "Space Marines", subfaction: "Ultramarines", team: "1", color: defaultColors[0], doctrine: "Fortress" },
        { id: "b", index: 1, race: "Orks", faction: "Redfang Horde", subfaction: "Ironjaw Mob", team: "2", color: defaultColors[1], doctrine: "Aggressive" },
        { id: "c", index: 2, race: "T'au", faction: "Frontier Cadre", subfaction: "T'au Sept", team: "3", color: defaultColors[2], doctrine: "Balanced" },
        { id: "d", index: 3, race: "Necrons", faction: "Dynastic Host", subfaction: "Sautekh", team: "4", color: defaultColors[3], doctrine: "Rush tech" },
        { id: "e", index: 4, race: "Tyranids", faction: "Hive Fleet", subfaction: "Leviathan", team: "1", color: defaultColors[4], doctrine: "Expansion" },
        { id: "f", index: 5, race: "Imperium", faction: "Imperial Guard", subfaction: "Cadian 8th", team: "2", color: defaultColors[5], doctrine: "Balanced" },
        { id: "g", index: 6, race: "Orks", faction: "Scrap Legion", subfaction: "Goff Mob", team: "3", color: defaultColors[6], doctrine: "Aggressive" },
        { id: "h", index: 7, race: "T'au", faction: "Drone Collective", subfaction: "Recon Swarm", team: "4", color: defaultColors[7], doctrine: "Repair first" },
        { id: "i", index: 8, race: "Necrons", faction: "Canoptek Swarm", subfaction: "Tomb Watch", team: "1", color: defaultColors[8], doctrine: "Fortress" },
        { id: "j", index: 9, race: "Tyranids", faction: "Vanguard Organisms", subfaction: "Lictor Brood", team: "2", color: defaultColors[9], doctrine: "Expansion" },
        { id: "k", index: 10, race: "Imperium", faction: "Machine Cult", subfaction: "Mars Forge", team: "3", color: defaultColors[10], doctrine: "Rush tech" },
        { id: "l", index: 11, race: "T'au", faction: "Frontier Cadre", subfaction: "Vior'la Sept", team: "4", color: defaultColors[11], doctrine: "Balanced" }
      ];
      const identificationPatterns = ["solid", "vertical", "diagonal", "split", "checker", "border", "quartered"];
      setupPlayers.forEach((player, index) => {
        player.name = `Player ${index + 1}`;
        player.secondaryColor = defaultColors[(index + 5) % defaultColors.length];
        player.pattern = identificationPatterns[index % identificationPatterns.length];
      });

      const spriteCatalog = {
        "Terrain sheet": ["Grass", "Dark grass", "Tall grass", "Dirt", "Mud", "Sand", "Rock", "Snow", "Ice", "Swamp", "Pavement", "Ash", "Lava", "Water", "Deep water", "River", "Beach", "Cliff edge", "Hill", "Mountain", "Forest floor", "All terrain transitions"],
        "Vegetation": ["Small bush", "Large bush", "Dead bush", "Young tree", "Medium tree", "Large tree", "Dead tree", "Pine tree", "Palm tree", "Jungle tree", "Flowers", "Crop field", "Tall grass clusters", "Stumps", "Logs", "Rocks", "Multiple variations"],
        "Natural objects": ["Boulder", "Crystal", "Cave entrance", "Pond", "Dead tree", "Stump", "Volcanic rock", "Mineral deposit"],
        "Roads & bridges": ["Dirt road", "Stone road", "Asphalt", "Trail", "Railway", "Stone bridge", "Wood bridge", "Pontoon bridge"],
        "Environmental props": ["Crates", "Supply boxes", "Barrels", "Fuel tanks", "Power generator", "Satellite dish", "Street lights", "Road signs", "Concrete barricades", "Destroyed vehicles", "Burning wreckage", "Bridge segments", "Pipe networks", "Storage containers", "Fences", "Gates"],
        "Builder unit": ["Idle", "Walk", "Build", "Repair", "Harvest", "Carry resources", "Return resources", "Destroyed"],
        "Infantry base": ["Idle", "Walk", "Run", "Aim", "Fire", "Reload", "Throw grenade", "Take cover", "Melee", "Heal", "Repair", "Build", "Retreat", "Celebrate", "Death", "All facing directions"],
        "Armor variants": ["Light armor", "Medium armor", "Heavy armor", "Recon armor", "Power armor", "Terminator armor", "Artificer armor", "Scout armor"],
        "Weapon sheet": ["Pistol", "SMG", "Shotgun", "Assault rifle", "Battle rifle", "Sniper rifle", "Machine gun", "Rocket launcher", "Flamer", "Plasma rifle", "Melta", "Chainsword", "Power sword", "Power axe", "Thunder hammer", "Combat knife", "Grenades"],
        "Squad attachments": ["Backpacks", "Medical kits", "Radio packs", "Heavy weapon packs", "Ammo boxes", "Banners", "Standards", "Communication equipment", "Engineering tools", "Power packs", "Shield generators"],
        "Vehicles": ["Scout vehicle", "Transport", "APC", "Tank", "Heavy tank", "Artillery", "Anti-air", "Construction vehicle", "Repair vehicle", "Command vehicle", "Idle animation", "Moving animation", "Destroyed animation", "Turret rotation"],
        "Aircraft": ["Dropship", "Transport aircraft", "Attack helicopter", "Fighter", "Bomber", "Gunship", "Hover animation", "Flying animation", "Landing animation", "Destroyed animation"],
        "Buildings": ["HQ", "Barracks", "Factory", "Vehicle factory", "Airfield", "Power plant", "Generator", "Supply depot", "Storage", "Research center", "Repair bay", "Medical center", "Radar", "Communication tower", "Wall", "Gate", "Bunker", "Turret", "Watch tower", "Outpost"],
        "Construction states": ["Foundation", "25% built", "50% built", "75% built", "Completed", "Destroyed", "Ruined", "Burning"],
        "Resource icons": ["Requisition", "Energy", "Fuel", "Ore", "Food", "Faith", "Influence", "Ammo", "Steel", "Research", "Population"],
        "Projectiles": ["Bullets", "Bolts", "Lasers", "Plasma", "Missiles", "Rockets", "Mortars", "Artillery shells", "Flamethrower", "Smoke", "Tracer rounds"],
        "Explosions & effects": ["Small explosion", "Large explosion", "Smoke", "Dust", "Fire", "Muzzle flash", "Bullet impact", "Spark", "Debris", "Blood", "Energy shield hit", "Healing effect", "Repair sparks"],
        "UI icons": ["Move", "Attack", "Defend", "Hold position", "Patrol", "Retreat", "Build", "Repair", "Heal", "Capture", "Supply", "Upgrade", "Research", "Transport", "Garrison"],
        "Objective markers": ["Strategic point", "Critical location", "Capture zone", "Supply point", "Relic", "Power node", "Spawn point", "HQ marker", "Extraction zone", "Victory point", "Neutral marker", "Friendly marker", "Enemy marker"],
        "Weather effects": ["Rain", "Snow", "Fog", "Ash", "Dust storm", "Smoke", "Lightning", "Cloud shadows", "Wind particles", "Heat distortion"],
        "Decals": ["Crater", "Destroyed ground", "Scorch marks", "Blood stains", "Oil spill", "Broken track marks", "Footprints", "Vehicle tracks", "Burned grass"],
        "Faction overlay pack": ["Helmets", "Shoulder pads", "Chest insignias", "Capes", "Backpacks", "Banners", "Chapter symbols", "Weapon decorations", "Armor trim", "Color masks"]
      };

      const spriteAtlas = new Image();
      let spriteAtlasReady = false;
      const atlasPatterns = {};
      spriteAtlas.decoding = "async";
      spriteAtlas.addEventListener("load", () => {
        spriteAtlasReady = true;
        for (const key of ["grass", "dirt", "sand", "water", "rock", "pavement"]) {
          const source = atlasCells[key];
          const tile = document.createElement("canvas");
          tile.width = source[2];
          tile.height = source[3];
          tile.getContext("2d").drawImage(spriteAtlas, ...source, 0, 0, tile.width, tile.height);
          atlasPatterns[key] = ctx.createPattern(tile, "repeat");
        }
        drawSpritePreview();
        draw();
      });
      spriteAtlas.src = "assets/terrain/sprite-atlas.webp";
      const atlasCells = {
        grass: [0, 0, 128, 128],
        dirt: [128, 0, 128, 128],
        sand: [256, 0, 128, 128],
        water: [384, 0, 128, 128],
        rock: [512, 0, 128, 128],
        pavement: [640, 0, 128, 128],
        tree: [0, 128, 96, 96],
        pine: [96, 128, 96, 96],
        palm: [192, 128, 96, 96],
        bush: [288, 128, 96, 96],
        tallgrass: [384, 128, 96, 96],
        cactus: [480, 128, 96, 96],
        boulder: [576, 128, 96, 96],
        crystal: [672, 128, 96, 96],
        cave: [0, 224, 96, 96],
        pond: [96, 224, 96, 96],
        deadtree: [192, 224, 96, 96],
        stump: [288, 224, 96, 96],
        stoneroad: [384, 224, 96, 96],
        dirtroad: [480, 224, 96, 96],
        stonebridge: [576, 224, 96, 96],
        woodbridge: [672, 224, 96, 96]
      };

      const atlasTypeMap = {
        grass: "grass", darkgrass: "grass", forestfloor: "grass", swamp: "grass",
        dirt: "dirt", mud: "dirt", ash: "dirt", sand: "sand", beach: "sand",
        water: "water", shallowwater: "water", deepwater: "water", river: "water",
        rock: "rock", smallrocks: "boulder", boulders: "boulder", cliff: "boulder",
        pavement: "pavement", asphaltroad: "pavement", concreteroad: "pavement",
        trees: "tree", mediumtree: "tree", largetree: "tree", denseforest: "tree", jungle: "tree",
        pinetree: "pine", palmtree: "palm", bushes: "bush", smallbush: "bush", largebush: "bush",
        tallgrass: "tallgrass", cactus: "cactus", crystal: "crystal", crystals: "crystal", cave: "cave",
        pond: "pond", deadtree: "deadtree", deadforest: "deadtree", stump: "stump", dirtroad: "dirtroad",
        trail: "dirtroad", stoneroad: "stoneroad", railway: "stoneroad", asphalt: "pavement",
        bridge: "stonebridge", woodenbridge: "woodbridge", pontoonbridge: "woodbridge"
      };

      function shadeHex(hex, amount) {
        const clean = hex.replace("#", "");
        const number = Number.parseInt(clean, 16);
        const channel = shift => clamp((number >> shift & 255) + amount, 0, 255);
        return `rgb(${channel(16)}, ${channel(8)}, ${channel(0)})`;
      }

      function populateSpritePlayers() {
        const previous = els.spritePlayer.value;
        els.spritePlayer.textContent = "";
        setupPlayers.forEach((player, index) => {
          const option = document.createElement("option");
          option.value = String(index);
          option.textContent = `P${index + 1} · ${player.color.toUpperCase()} / ${player.secondaryColor.toUpperCase()}`;
          els.spritePlayer.append(option);
        });
        if ([...els.spritePlayer.options].some(option => option.value === previous)) els.spritePlayer.value = previous;
      }

      function populateSpriteVariants() {
        const values = spriteCatalog[els.spriteFamily.value] || [];
        els.spriteVariant.textContent = "";
        for (const value of values) {
          const option = document.createElement("option");
          option.value = value;
          option.textContent = value;
          els.spriteVariant.append(option);
        }
        drawSpritePreview();
      }

      function drawSpritePreview() {
        if (!els.spriteCanvas) return;
        const preview = els.spriteCanvas.getContext("2d");
        preview.imageSmoothingEnabled = false;
        preview.clearRect(0, 0, 320, 180);
        const selectedFamily = els.spriteFamily.value;
        if (spriteAtlasReady && ["Terrain sheet", "Vegetation", "Natural objects", "Roads & bridges"].includes(selectedFamily)) {
          const variant = els.spriteVariant.value.toLowerCase().replace(/\s+/g, "");
          const previewMaps = {
            "Terrain sheet": {
              grass: "grass", darkgrass: "grass", tallgrass: "grass", dirt: "dirt", mud: "dirt",
              sand: "sand", rock: "rock", pavement: "pavement", water: "water",
              deepwater: "water", river: "water", beach: "sand", allterraintransitions: "grass"
            },
            "Vegetation": {
              smallbush: "bush", largebush: "bush", deadbush: "deadtree", youngtree: "tree",
              mediumtree: "tree", largetree: "tree", deadtree: "deadtree", pinetree: "pine",
              palmtree: "palm", jungletree: "tree", tallgrassclusters: "tallgrass",
              stumps: "stump", rocks: "boulder", multiplevariations: "tree"
            },
            "Natural objects": {
              boulder: "boulder", crystal: "crystal", caveentrance: "cave", pond: "pond",
              deadtree: "deadtree", stump: "stump", volcanicrock: "boulder", mineraldeposit: "crystal"
            },
            "Roads & bridges": {
              dirtroad: "dirtroad", stoneroad: "stoneroad", asphalt: "pavement", trail: "dirtroad",
              railway: "stoneroad", stonebridge: "stonebridge", woodbridge: "woodbridge", pontoonbridge: "woodbridge"
            }
          };
          const keys = Object.values(previewMaps[selectedFamily]);
          const key = previewMaps[selectedFamily][variant] || keys[0];
          const cell = atlasCells[key];
          preview.imageSmoothingEnabled = true;
          preview.fillStyle = colors.muted;
          preview.fillRect(0, 0, 320, 180);
          for (let frame = 0; frame < 4; frame += 1) {
            const alternateKey = els.spriteVariant.value.includes("variations") ? keys[frame % keys.length] : key;
            const source = atlasCells[alternateKey] || cell;
            const size = selectedFamily === "Terrain sheet" ? 68 : 74;
            const x = 6 + frame * 78;
            const y = 52 + (frame % 2) * 5;
            preview.drawImage(spriteAtlas, ...source, x, y, size, size);
          }
          els.spritePlayer.disabled = true;
          els.spriteMaskLine.textContent = `${selectedFamily} · cropped source art · optimized atlas`;
          return;
        }
        const player = setupPlayers[Number(els.spritePlayer.value) || 0] || setupPlayers[0];
        const sourceMask = els.spriteMode.value === "mask";
        const primary = sourceMask
          ? ["#990099", "#FF00FF", "#FF66FF"]
          : [shadeHex(player.color, -72), player.color, shadeHex(player.color, 62)];
        const secondary = sourceMask
          ? ["#008888", "#00FFFF", "#88FFFF"]
          : [shadeHex(player.secondaryColor, -58), player.secondaryColor, shadeHex(player.secondaryColor, 58)];
        const material = [colors.border, colors.mutedForeground, colors.foreground];
        const family = selectedFamily;
        const category = /Building|Construction/.test(family)
          ? "building"
          : /Vehicle|Armor|Weapon|attachment/.test(family)
            ? "vehicle"
            : /Aircraft/.test(family)
              ? "aircraft"
              : /Builder|Infantry|Faction/.test(family)
                ? "unit"
                : "tile";
        const scale = 4;
        const pixel = (x, y, w, h, fill) => {
          preview.fillStyle = fill;
          preview.fillRect(Math.round(x * scale), Math.round(y * scale), Math.round(w * scale), Math.round(h * scale));
        };
        for (let frame = 0; frame < 4; frame += 1) {
          const ox = 3 + frame * 20;
          const oy = 9 + (frame % 2);
          if (category === "unit") {
            pixel(ox + 7, oy + 3, 4, 4, material[2]);
            pixel(ox + 5, oy + 7, 8, 7, primary[1]);
            pixel(ox + 5, oy + 12, 3, 4, primary[0]);
            pixel(ox + 10, oy + 12, 3, 4, primary[2]);
            pixel(ox + 3, oy + 8, 2, 6, secondary[1]);
            pixel(ox + 13, oy + 8, 4, 2, material[1]);
            pixel(ox + 15, oy + 9, 3, 1, material[2]);
          } else if (category === "vehicle") {
            pixel(ox + 2, oy + 7, 16, 8, material[0]);
            pixel(ox + 4, oy + 5, 12, 8, primary[1]);
            pixel(ox + 5, oy + 6, 4, 2, primary[2]);
            pixel(ox + 10, oy + 9, 6, 3, secondary[1]);
            pixel(ox + 8, oy + 3, 5, 5, material[2]);
          } else if (category === "aircraft") {
            pixel(ox + 8, oy + 2, 4, 15, material[2]);
            pixel(ox + 2, oy + 8, 16, 4, primary[1]);
            pixel(ox + 5, oy + 6, 10, 8, primary[0]);
            pixel(ox + 9, oy + 5, 2, 5, secondary[2]);
          } else if (category === "building") {
            pixel(ox + 2, oy + 4, 16, 13, material[0]);
            pixel(ox + 4, oy + 5, 12, 9, primary[1]);
            pixel(ox + 4, oy + 5, 12, 2, primary[2]);
            pixel(ox + 6, oy + 9, 3, 5, secondary[1]);
            pixel(ox + 11, oy + 8, 3, 2, material[2]);
          } else {
            pixel(ox + 2, oy + 3, 16, 16, material[0]);
            pixel(ox + 3, oy + 4, 14, 14, colors.muted);
            pixel(ox + 4 + frame, oy + 6, 7, 3, primary[1]);
            pixel(ox + 8, oy + 10, 7, 3, secondary[1]);
            pixel(ox + 6, oy + 14, 5, 2, material[2]);
          }
        }
        els.spritePlayer.disabled = sourceMask;
        els.spriteMaskLine.textContent = sourceMask
          ? "Primary #990099 / #FF00FF / #FF66FF · secondary #008888 / #00FFFF / #88FFFF"
          : `P${player.index + 1} primary ${player.color.toUpperCase()} · secondary ${player.secondaryColor.toUpperCase()} · permanent details preserved`;
      }

      const state = {
        scenario: "iron",
        mode: "menu",
        time: 0,
        startMinute: 420,
        speed: 1,
        paused: true,
        replay: false,
        replayIndex: 0,
        visibility: 82,
        weather: "Localized weather",
        mapResolution: { width: 1920, height: 1080 },
        players: setupPlayers.slice(0, 2).map(player => ({ ...player, base: { ...basePositions[player.index] } })),
        units: [],
        structures: [],
        squads: [],
        projectiles: [],
        features: [],
        incidents: [],
        snapshots: [],
        selectedId: null,
        hover: null,
        camera: { x: VW / 2, y: VH / 2, zoom: 1 },
        cameraFocus: { x: VW / 2, y: VH / 2 },
        panning: false,
        panPointerId: null,
        panStart: null,
        editorTool: "terrain",
        spawnPlayerId: "a",
        brush: "grass",
        brushRadius: 48,
        brushOpacity: 1,
        brushHardness: 1,
        brushFalloff: 0,
        brushShape: "circle",
        paintMode: "replace",
        lastBrushPoint: null,
        erasing: false,
        brushDown: false,
        territories: [],
        territoryOverlay: true,
        lighting: {
          enabled: true,
          shadows: true,
          mode: "dynamic",
          startHour: 7,
          fixedHour: 7,
          dayLengthMinutes: 12,
          latitude: 35,
          season: "spring",
          weather: "clear",
          overlay: false,
          artificial: true,
          buildingColors: true,
          colorIntensity: 0.85,
          factionPreservation: "high",
          teamEmblems: true,
          accessibilityPatterns: true
        },
        selectedTerritoryId: null,
        territoryEditMode: "translate",
        territoryDragIndex: -1,
        territoryDragStart: null,
        nextTerritoryId: 1,
        nextTerritoryTick: 0,
        resources: {},
        economies: {},
        convoys: [],
        dropPods: [],
        tradePartners: [],
        roads: [],
        nextConvoyId: 1,
        nextDropPodId: 1,
        nextLogisticsTick: 0,
        logisticsOpen: false,
        logisticsPlayerId: "a",
        showSupplyRadii: true,
        showRoads: true,
        casualties: {},
        adapted: {},
        nextUnitIndex: {},
        nextTrain: {},
        nextSnapshot: 0,
        nextEconomy: 0,
        nextMilestone: 240,
        battleSeed: "AWT-742918",
        simulationAccumulator: 0,
        spatialAccumulator: 0,
        spatialGrid: new Map(),
        lastFrame: performance.now(),
        uiAccumulator: 0,
        renderAccumulator: 0,
        fastStepAccumulator: 0,
        fastUnitPhase: 0,
        environmentAccumulator: 0,
        separationAccumulator: 0,
        ended: false,
        fogPlayer: "observer",
        explored: {},
        activeSetupPlayer: 0
      };
      root.awtDebugState = state;

      function playerFor(faction) {
        return state.players.find(player => player.id === faction) || setupPlayers.find(player => player.id === faction) || setupPlayers[0];
      }

      function playerColor(faction) {
        return playerFor(faction).color;
      }

      function playerSecondaryColor(faction) {
        const player = playerFor(faction);
        return player.secondaryColor || shadeHex(player.color, 52);
      }

      function economicPersonality(player) {
        if (["Fortress", "Repair first"].includes(player.doctrine)) return "Frugal";
        if (["Aggressive", "Rush tech"].includes(player.doctrine)) return "Aggressive";
        return "Balanced";
      }

      function createEconomy(player) {
        const personality = economicPersonality(player);
        return {
          personality,
          inventory: { ...(economyConfig.startingStockpile || { requisition: 600, materials: 450, fuel: 300, energy: 320, ammunition: 420, medical: 220, food: 360, influence: 180, parts: 240 }) },
          baseCapacity: { ...(economyConfig.baseCapacity || { requisition: 800, materials: 620, fuel: 460, energy: 480, ammunition: 650, medical: 360, food: 520, influence: 320, parts: 420 }) },
          queue: [],
          approvedBuilds: [],
          research: { level: 0, progress: 0, status: "Awaiting a research center" },
          shortages: [],
          emergency: "Supply stable",
          requestSerial: 1,
          nextRequestAt: 0,
          nextTradeAt: 22 + player.index * 3,
          officers: {
            quartermaster: "Auditing four-layer stocks",
            supplyOfficer: "Mapping physical routes",
            factoryOverseer: "Balancing production inputs"
          }
        };
      }

      function economyFor(faction) {
        return state.economies[faction] || (state.economies[faction] = createEconomy(playerFor(faction)));
      }

      function economyCapacity(faction) {
        const economy = economyFor(faction);
        const capacity = { ...economy.baseCapacity };
        for (const structure of state.structures) {
          if (structure.faction !== faction || structure.progress < 1 || structure.alive === false) continue;
          for (const [key, value] of Object.entries(buildingCatalog[structure.type]?.storage || {})) capacity[key] = (capacity[key] || 0) + value;
        }
        return capacity;
      }

      function syncLegacyResources(faction) {
        state.resources[faction] = clamp(economyFor(faction).inventory.requisition || 0, 0, 999);
      }

      function ensureStructureRuntime(structure) {
        const spec = buildingCatalog[structure.type] || {};
        structure.maxHp ??= spec.maxHp || 400;
        structure.hp ??= structure.maxHp * clamp(structure.condition ?? 1, 0, 1);
        structure.hitbox ??= { ...(spec.hitbox || { w: 28, h: 24 }) };
        structure.inventory ??= {};
        structure.alive ??= true;
        structure.condition = clamp(structure.hp / Math.max(1, structure.maxHp), 0.04, 1);
        return structure;
      }

      function structureCollisionAt(point, radius = 4, ignoreId = null, proposedHitbox = null) {
        const proposed = proposedHitbox || { w: radius * 2, h: radius * 2 };
        return state.structures.find(structure => {
          if (structure.id === ignoreId || structure.alive === false || structure.progress < 0.05) return false;
          ensureStructureRuntime(structure);
          return Math.abs(point.x - structure.x) < (structure.hitbox.w + proposed.w) / 2 + 2
            && Math.abs(point.y - structure.y) < (structure.hitbox.h + proposed.h) / 2 + 2;
        }) || null;
      }

      function moveUnitOutsideStructure(unit, structure) {
        ensureStructureRuntime(structure);
        const clearance = Math.max(structure.hitbox.w, structure.hitbox.h) / 2 + (unit.role === "vehicle" ? 10 : 6);
        for (let index = 0; index < 12; index += 1) {
          const angle = index * Math.PI / 6 + unit.index * 0.37;
          const candidate = {
            x: clamp(structure.x + Math.cos(angle) * clearance, 24, VW - 24),
            y: clamp(structure.y + Math.sin(angle) * clearance, 24, VH - 24)
          };
          if (!structureCollisionAt(candidate, unit.role === "vehicle" ? 7 : 3)) {
            unit.x = candidate.x;
            unit.y = candidate.y;
            return true;
          }
        }
        return false;
      }

      function insideSupplyRadius(point, faction) {
        return state.structures.some(structure => {
          if (structure.faction !== faction || structure.progress < 1 || structure.alive === false) return false;
          const radius = buildingCatalog[structure.type]?.supplyRadius || 0;
          return radius > 0 && distance(point, structure) <= radius;
        });
      }

      function nightShadeColor() {
        const channels = String(colors.background).match(/\d+(?:\.\d+)?/g)?.slice(0, 3).map(Number) || [24, 24, 24];
        const luminance = (channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722) / 255;
        return luminance > 0.5 ? colors.foreground : colors.background;
      }

      function formatHour(hour) {
        const normalized = (hour % 24 + 24) % 24;
        const totalMinutes = Math.round(normalized * 60) % 1440;
        return `${pad2(Math.floor(totalMinutes / 60))}:${pad2(totalMinutes % 60)}`;
      }

      function lightingHour(time = state.time) {
        if (state.lighting.mode === "fixed") return state.lighting.fixedHour;
        const daySeconds = Math.max(120, state.lighting.dayLengthMinutes * 60);
        return (state.lighting.startHour + time / daySeconds * 24) % 24;
      }

      function sunState(time = state.time) {
        const hour = lightingHour(time);
        const latitude = Math.abs(state.lighting.latitude) / 60;
        const seasonShift = { spring: 0, summer: 1, autumn: 0, winter: -1 }[state.lighting.season] || 0;
        const daylight = clamp(12 + seasonShift * latitude * 5, 7, 17);
        const sunrise = 12 - daylight / 2;
        const sunset = 12 + daylight / 2;
        const phase = clamp((hour - sunrise) / Math.max(1, sunset - sunrise), 0, 1);
        const aboveHorizon = hour >= sunrise && hour <= sunset;
        const maxAltitude = clamp(72 - latitude * 30 + seasonShift * 9, 24, 82) * Math.PI / 180;
        const altitude = aboveHorizon ? Math.sin(phase * Math.PI) * maxAltitude : 0;
        const azimuth = -Math.PI * 0.82 + phase * Math.PI * 1.64 + state.lighting.latitude / 180 * Math.PI * 0.18;
        const weather = {
          clear: { brightness: 1, shadow: 1, diffusion: 0.05 },
          fog: { brightness: 0.58, shadow: 0.18, diffusion: 0.72 },
          rain: { brightness: 0.7, shadow: 0.42, diffusion: 0.48 },
          snow: { brightness: 1.12, shadow: 0.74, diffusion: 0.18 },
          dust: { brightness: 0.42, shadow: 0.08, diffusion: 0.9 }
        }[state.lighting.weather] || { brightness: 1, shadow: 1, diffusion: 0 };
        let period = "Night";
        if (aboveHorizon) {
          if (hour < sunrise + 0.8) period = "Dawn";
          else if (hour < 10) period = "Morning";
          else if (hour < 14) period = "Noon";
          else if (hour < sunset - 1.4) period = "Afternoon";
          else if (hour < sunset - 0.45) period = "Sunset";
          else period = "Dusk";
        }
        return {
          hour,
          sunrise,
          sunset,
          period,
          altitude,
          azimuth,
          daylight: aboveHorizon,
          intensity: aboveHorizon ? clamp(Math.sin(phase * Math.PI) * weather.brightness, 0.08, 1.15) : 0,
          shadowStrength: aboveHorizon ? weather.shadow : 0,
          diffusion: weather.diffusion
        };
      }

      function featureHeight(feature) {
        const type = feature.type;
        if (["mountain"].includes(type)) return 120;
        if (["cliff", "cliffwall"].includes(type)) return 42;
        if (["hill", "raise", "terrace"].includes(type)) return 24;
        if (["denseforest", "jungle", "largetree"].includes(type)) return 11;
        if (["trees", "mediumtree", "pinetree", "palmtree", "deadforest"].includes(type)) return 8;
        if (["boulders", "cave", "rock"].includes(type)) return 5;
        if (["bushes", "largebush", "tallgrass"].includes(type)) return 2;
        if (["wall", "watchtower", "radar", "communicationscenter"].includes(type)) return 12;
        if (["bridge", "woodenbridge", "pontoonbridge"].includes(type)) return 4;
        return 0;
      }

      function shadowVector(height, time = state.time) {
        const sun = sunState(time);
        if (!sun.daylight || sun.altitude <= 0.015 || height <= 0) return { x: 0, y: 0, length: 0, strength: 0 };
        const length = clamp(height * 2.8 / Math.tan(Math.max(0.055, sun.altitude)), height * 0.45, height * 18);
        const direction = sun.azimuth + Math.PI;
        return {
          x: Math.cos(direction) * length,
          y: Math.sin(direction) * length,
          length,
          strength: sun.shadowStrength * clamp(1 - sun.diffusion * 0.65, 0.08, 1)
        };
      }

      function factionHasPower(faction) {
        return state.structures.some(item => item.faction === faction && item.type === "generator" && item.progress >= 1 && item.condition > 0.25);
      }

      let lightSourceCacheKey = "";
      let lightSourceCache = [];
      function activeLightSources() {
        if (!state.lighting.enabled || !state.lighting.artificial) return [];
        const cacheKey = `${Math.floor(state.time * 4)}|${state.structures.length}|${state.features.length}|${state.lighting.weather}`;
        if (cacheKey === lightSourceCacheKey) return lightSourceCache;
        const sources = [];
        for (const item of state.structures) {
          if (item.progress < 1 || item.condition <= 0.18) continue;
          const spec = buildingCatalog[item.type];
          const powered = item.type === "generator" || factionHasPower(item.faction);
          if (powered && spec?.light) {
            sources.push({
              x: item.x,
              y: item.y,
              radius: spec.light,
              brightness: item.type === "generator" ? 0.92 : 0.66,
              color: item.type === "fieldhospital" ? colors.water : colors.signal,
              faction: item.faction,
              searchlight: Boolean(spec.searchlight),
              direction: state.time * 0.42 + playerFor(item.faction).index * 1.7
            });
          }
          if (item.condition < 0.42) {
            sources.push({ x: item.x, y: item.y, radius: 46, brightness: 0.78, color: colors.danger, faction: item.faction, fire: true });
          }
        }
        for (const feature of state.features) {
          if (feature.type === "lava") sources.push({ x: feature.x, y: feature.y, radius: feature.r * 1.4, brightness: 0.72, color: colors.danger, fire: true });
        }
        lightSourceCacheKey = cacheKey;
        lightSourceCache = sources;
        return lightSourceCache;
      }

      function pointSegmentDistance(point, a, b) {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const denominator = dx * dx + dy * dy || 1;
        const t = clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / denominator, 0, 1);
        return Math.hypot(point.x - (a.x + dx * t), point.y - (a.y + dy * t));
      }

      let shadowCacheBucket = -1;
      const shadowSampleCache = new Map();
      function pointInShadow(point, time = state.time) {
        if (!state.lighting.enabled || !state.lighting.shadows) return false;
        const sun = sunState(time);
        if (!sun.daylight || sun.shadowStrength < 0.08) return false;
        const bucket = Math.floor(state.time * 4);
        if (bucket !== shadowCacheBucket) {
          shadowCacheBucket = bucket;
          shadowSampleCache.clear();
        }
        const cacheKey = `${Math.round(point.x / 8)},${Math.round(point.y / 8)}`;
        if (shadowSampleCache.has(cacheKey)) return shadowSampleCache.get(cacheKey);
        for (const feature of state.features) {
          const height = featureHeight(feature);
          if (!height) continue;
          const vector = shadowVector(height, time);
          const width = Math.max(5, feature.r * (["denseforest", "jungle"].includes(feature.type) ? 0.8 : 0.42));
          if (pointSegmentDistance(point, feature, { x: feature.x + vector.x, y: feature.y + vector.y }) <= width) {
            shadowSampleCache.set(cacheKey, true);
            return true;
          }
        }
        for (const item of state.structures) {
          if (item.progress < 0.25) continue;
          const height = (buildingCatalog[item.type]?.height || 8) * item.progress;
          const vector = shadowVector(height, time);
          if (pointSegmentDistance(point, item, { x: item.x + vector.x, y: item.y + vector.y }) <= 10) {
            shadowSampleCache.set(cacheKey, true);
            return true;
          }
        }
        shadowSampleCache.set(cacheKey, false);
        return false;
      }

      function searchlightExposure(point, source) {
        if (!source.searchlight) return 0;
        const dx = point.x - source.x;
        const dy = point.y - source.y;
        const distanceToSource = Math.hypot(dx, dy);
        if (distanceToSource > source.radius) return 0;
        const angle = Math.atan2(dy, dx);
        const delta = Math.atan2(Math.sin(angle - source.direction), Math.cos(angle - source.direction));
        return Math.abs(delta) < 0.23 ? 1 - distanceToSource / source.radius * 0.35 : 0;
      }

      let lightingSampleCacheKey = "";
      const lightingSampleCache = new Map();
      function lightingAt(point, observerFaction = null, time = state.time) {
        if (!state.lighting.enabled) return { brightness: 1, shadowed: false, artificial: 0, searchlight: 0, period: "Neutral" };
        const sun = sunState(time);
        const sampleCacheKey = `${Math.floor(state.time * 4)}|${Math.round(sun.hour * 4)}|${state.lighting.weather}|${state.structures.length}`;
        if (sampleCacheKey !== lightingSampleCacheKey) {
          lightingSampleCacheKey = sampleCacheKey;
          lightingSampleCache.clear();
        }
        const pointCacheKey = `${Math.round(point.x / 6)},${Math.round(point.y / 6)}|${observerFaction || "none"}`;
        if (lightingSampleCache.has(pointCacheKey)) return lightingSampleCache.get(pointCacheKey);
        const shadowed = pointInShadow(point, time);
        let artificial = 0;
        let searchlight = 0;
        for (const source of activeLightSources()) {
          const distanceToSource = Math.hypot(point.x - source.x, point.y - source.y);
          if (distanceToSource < source.radius) artificial = Math.max(artificial, source.brightness * (1 - distanceToSource / source.radius));
          if (source.searchlight && (!observerFaction || !areAllies(source.faction, observerFaction))) {
            searchlight = Math.max(searchlight, searchlightExposure(point, source));
          }
        }
        const natural = sun.intensity * (shadowed ? 0.46 : 1);
        const brightness = clamp(Math.max(natural, artificial, searchlight), 0, 1.2);
        const result = { brightness, shadowed, artificial, searchlight, period: sun.period };
        lightingSampleCache.set(pointCacheKey, result);
        return result;
      }

      function nightVisionFactor(faction) {
        const race = playerFor(faction).race;
        if (race === "Necrons") return 0.96;
        if (race === "T'au") return 0.88;
        if (race === "Tyranids") return 0.82;
        if (race === "Imperium") return 0.72;
        if (race === "Orks") return 0.48;
        return 0.65;
      }

      function areAllies(a, b) {
        if (a === b) return true;
        return String(playerFor(a).team) === String(playerFor(b).team);
      }

      function baseFor(faction) {
        return playerFor(faction).base || basePositions[0];
      }

      function spawnZoneFor(player) {
        if (!player.spawnZone) player.spawnZone = { shape: "circle", size: 84, points: [] };
        return player.spawnZone;
      }

      function selectedSpawnPlayer() {
        return state.players.find(player => player.id === state.spawnPlayerId) || state.players[0];
      }

      function pointInSpawnZone(point, player) {
        const zone = spawnZoneFor(player);
        if (zone.shape === "square") {
          return Math.abs(point.x - player.base.x) <= zone.size && Math.abs(point.y - player.base.y) <= zone.size;
        }
        if (zone.shape === "custom" && zone.points.length >= 3) {
          let inside = false;
          for (let i = 0, j = zone.points.length - 1; i < zone.points.length; j = i, i += 1) {
            const a = zone.points[i];
            const b = zone.points[j];
            const crosses = (a.y > point.y) !== (b.y > point.y)
              && point.x < (b.x - a.x) * (point.y - a.y) / ((b.y - a.y) || 0.0001) + a.x;
            if (crosses) inside = !inside;
          }
          return inside;
        }
        return distance(point, player.base) <= zone.size;
      }

      function circleTerritoryPoints(center, radius, count = 12) {
        return Array.from({ length: count }, (_, index) => {
          const angle = -Math.PI / 2 + index * Math.PI * 2 / count;
          return {
            x: clamp(center.x + Math.cos(angle) * radius, 0, VW),
            y: clamp(center.y + Math.sin(angle) * radius, 0, VH)
          };
        });
      }

      function territoryCenter(territory) {
        if (!territory?.points?.length) return { x: VW / 2, y: VH / 2 };
        return {
          x: territory.points.reduce((sum, point) => sum + point.x, 0) / territory.points.length,
          y: territory.points.reduce((sum, point) => sum + point.y, 0) / territory.points.length
        };
      }

      function pointInTerritory(point, territory) {
        if (!territory?.points || territory.points.length < 3) return false;
        let inside = false;
        for (let i = 0, j = territory.points.length - 1; i < territory.points.length; j = i, i += 1) {
          const a = territory.points[i];
          const b = territory.points[j];
          const crosses = (a.y > point.y) !== (b.y > point.y)
            && point.x < (b.x - a.x) * (point.y - a.y) / ((b.y - a.y) || 0.0001) + a.x;
          if (crosses) inside = !inside;
        }
        return inside;
      }

      function territoryAt(point) {
        return [...state.territories].reverse().find(territory => pointInTerritory(point, territory));
      }

      function createTerritory(owner, center, radius = 74, overrides = {}) {
        const ownerPlayer = owner ? playerFor(owner) : null;
        const id = `territory-${state.nextTerritoryId++}`;
        return {
          id,
          name: overrides.name || `${ownerPlayer?.faction || "Neutral"} ${state.nextTerritoryId - 1}`,
          owner: owner || "",
          startingOwner: owner || "",
          previousOwner: "",
          status: owner ? "claimed" : "neutral",
          points: circleTerritoryPoints(center, radius),
          resourceValue: 40,
          strategicValue: 50,
          defensibility: 50,
          captureDifficulty: 50,
          allowedStructures: "any",
          maxStructures: 8,
          supplyRequired: true,
          canAbandon: true,
          shareAllies: false,
          unclaimable: false,
          locked: false,
          connected: Boolean(owner),
          claimedAt: state.time,
          isolatedSince: null,
          pressure: 0,
          reason: "Starting territory",
          ...overrides
        };
      }

      function selectedTerritory() {
        return state.territories.find(territory => territory.id === state.selectedTerritoryId) || state.territories[0] || null;
      }

      function clampCamera() {
        const halfW = VW / (2 * state.camera.zoom);
        const halfH = VH / (2 * state.camera.zoom);
        state.camera.x = clamp(state.camera.x, halfW, VW - halfW);
        state.camera.y = clamp(state.camera.y, halfH, VH - halfH);
      }

      function setZoom(value, focus = null) {
        const next = clamp(Math.round(value * 4) / 4, 1, 3);
        if (focus && next > state.camera.zoom) {
          state.camera.x = focus.x;
          state.camera.y = focus.y;
        }
        state.camera.zoom = next;
        clampCamera();
        els.zoomValue.textContent = `View ${next.toFixed(next % 1 ? 2 : 0)}×`;
        els.zoomOut.disabled = next <= 1;
        els.zoomIn.disabled = next >= 3;
        draw();
      }

      function unitLabel(unit) {
        if (unit && buildingCatalog[unit.type] && unit.maxHp) return `${unit.displayName || factionBuildingLabel(unit.faction, unit.type)} · P${playerFor(unit.faction).index + 1}`;
        return `${unit.name} · P${playerFor(unit.faction).index + 1}`;
      }

      function roleLabel(unit) {
        if (unit.role === "builder") return raceCatalog[playerFor(unit.faction).race]?.builder || "Builder";
        return roleNames[unit.role] || "Individual";
      }

      function addUnitLog(unit, text) {
        if (!unit || unit.logs[0] === text) return;
        unit.logs.unshift(text);
        unit.logs = unit.logs.slice(0, 6);
        unit.lastAction = text;
      }

      function incident(text, unitId = null, importance = "normal") {
        state.incidents.unshift({ t: state.time, text, unitId, importance });
        state.incidents = state.incidents.slice(0, 50);
        updateIncidents();
      }

      function setResolution(width, height) {
        const safeWidth = clamp(Math.round(width), 640, 4096);
        const safeHeight = clamp(Math.round(height), 360, 2160);
        state.mapResolution = { width: safeWidth, height: safeHeight };
        const viewportScale = Math.min(1, 960 / safeWidth, 540 / safeHeight);
        canvas.width = Math.round(safeWidth * viewportScale);
        canvas.height = Math.round(safeHeight * viewportScale);
        canvas.style.aspectRatio = `${safeWidth} / ${safeHeight}`;
        canvas.setAttribute("aria-label", `Pixel-based ${safeWidth} by ${safeHeight} autonomous battlefield with terrain data, fog, builders, buildings, squads, and individual units.`);
      }

      function visualForBrush(type) {
        if (["water", "shallowwater", "deepwater", "river"].includes(type)) return "water";
        if (elevationTypes.has(type)) return "elevation";
        if (vegetationTypes.has(type)) return "vegetation";
        if (urbanTypes.has(type)) return "urban";
        if (militaryTypes.has(type)) return "military";
        if (weatherTypes.has(type)) return "weather";
        if (brushLayers["Natural objects"].includes(type) || type === "rock") return "rock";
        return "ground";
      }

      function terrainEffect(type) {
        const effects = {
          water: { speed: 0.46, cover: 0, detection: 1, moisture: 100, elevation: -2, name: "Water" },
          shallowwater: { speed: 0.64, cover: 0.02, detection: 0.96, moisture: 100, elevation: -1, name: "Shallow water" },
          deepwater: { speed: 0.22, cover: 0, detection: 1, moisture: 100, elevation: -5, name: "Deep water" },
          river: { speed: 0.38, cover: 0, detection: 1, moisture: 100, elevation: -2, name: "River" },
          mud: { speed: 0.58, cover: 0.03, detection: 0.98, moisture: 86, elevation: 0, name: "Mud" },
          swamp: { speed: 0.42, cover: 0.12, detection: 0.74, moisture: 94, elevation: -1, name: "Swamp" },
          sand: { speed: 0.78, cover: 0.02, detection: 1, moisture: 12, elevation: 0, name: "Sand" },
          beach: { speed: 0.74, cover: 0.02, detection: 1, moisture: 62, elevation: 0, name: "Beach" },
          snow: { speed: 0.72, cover: 0.04, detection: 0.9, moisture: 48, elevation: 0, name: "Snow" },
          ice: { speed: 0.56, cover: 0, detection: 1, moisture: 54, elevation: 0, name: "Ice" },
          lava: { speed: 0.18, cover: 0, detection: 1.08, moisture: 0, elevation: -1, name: "Lava" },
          darkgrass: { speed: 0.95, cover: 0.06, detection: 0.92, moisture: 66, elevation: 0, name: "Dark grass" },
          forestfloor: { speed: 0.88, cover: 0.08, detection: 0.86, moisture: 70, elevation: 0, name: "Forest floor" },
          tallgrass: { speed: 0.82, cover: 0.12, detection: 0.78, moisture: 64, elevation: 0, name: "Tall grass" },
          bushes: { speed: 0.72, cover: 0.2, detection: 0.67, moisture: 70, elevation: 0, name: "Bushes" },
          trees: { speed: 0.68, cover: 0.28, detection: 0.58, moisture: 72, elevation: 0, name: "Trees" },
          denseforest: { speed: 0.52, cover: 0.36, detection: 0.42, moisture: 78, elevation: 0, name: "Dense forest" },
          jungle: { speed: 0.46, cover: 0.38, detection: 0.38, moisture: 88, elevation: 0, name: "Jungle" },
          boulders: { speed: 0.52, cover: 0.42, detection: 0.58, moisture: 34, elevation: 2, name: "Boulders" },
          wall: { speed: 0.3, cover: 0.48, detection: 0.42, moisture: 28, elevation: 1, name: "Wall" },
          bunker: { speed: 0.7, cover: 0.5, detection: 0.7, moisture: 26, elevation: 1, name: "Bunker" },
          trenches: { speed: 0.78, cover: 0.34, detection: 0.76, moisture: 42, elevation: -1, name: "Trenches" },
          raise: { speed: 0.78, cover: 0.08, detection: 1.14, moisture: 44, elevation: 4, name: "Raised ground" },
          terrace: { speed: 0.8, cover: 0.12, detection: 1.1, moisture: 40, elevation: 3, name: "Terrace" },
          hill: { speed: 0.74, cover: 0.1, detection: 1.16, moisture: 40, elevation: 5, name: "Hill" },
          mountain: { speed: 0.28, cover: 0.38, detection: 1.22, moisture: 28, elevation: 10, name: "Mountain" },
          cliff: { speed: 0.34, cover: 0.4, detection: 1.12, moisture: 32, elevation: 7, name: "Cliff" },
          road: { speed: 1.18, cover: 0, detection: 1, moisture: 30, elevation: 0, name: "Road" },
          bridge: { speed: 1.08, cover: 0, detection: 1, moisture: 52, elevation: 1, name: "Bridge" },
          heavyfog: { speed: 0.92, cover: 0.08, detection: 0.42, moisture: 86, elevation: 0, name: "Heavy fog" },
          ashstorm: { speed: 0.84, cover: 0.12, detection: 0.46, moisture: 18, elevation: 0, name: "Ash storm" },
          heavyrain: { speed: 0.82, cover: 0.04, detection: 0.68, moisture: 92, elevation: 0, name: "Heavy rain" }
        };
        return effects[type] || { speed: 1, cover: 0.03, detection: 0.98, moisture: 52, elevation: 0, name: brushNames[type] || "Ground" };
      }

      function terrainAt(point) {
        let info = { speed: 1, cover: 0.03, detection: 1, moisture: 52, elevation: 0, name: "Ground", type: "ground" };
        for (const feature of state.features) {
          if (Math.hypot(point.x - feature.x, point.y - feature.y) > feature.r) continue;
          const effect = terrainEffect(feature.type);
          info = { ...effect, type: feature.type };
          if (feature.type === "lower") info.elevation -= 3;
        }
        return info;
      }

      function makeUnit(faction, role = "trooper", deploymentSource = "Starting zone") {
        const player = playerFor(faction);
        const index = state.nextUnitIndex[faction] || 0;
        state.nextUnitIndex[faction] = index + 1;
        const base = baseFor(faction);
        const maxHp = role === "vehicle" ? 230 : role === "commander" ? 126 : role === "builder" ? 82 : 100;
        const researchLevel = state.economies[faction]?.research?.level || 0;
        const baseDamage = role === "vehicle" ? 24 : role === "scout" ? 15 : role === "builder" ? 0 : 12;
        const namePool = player.race === "Orks" ? namesB : namesA;
        const unit = {
          id: `${faction}-${index}`,
          faction,
          index,
          name: `${factionUnitName(player, role, index)} ${index + 1}`,
          role,
          x: clamp(base.x + rand(-16, 16), 24, VW - 24),
          y: clamp(base.y + rand(-16, 16), 24, VH - 24),
          hp: maxHp,
          maxHp,
          alive: true,
          morale: rand(0.78, 0.88),
          fear: rand(0.44, 0.54),
          fatigue: rand(0.03, 0.09),
          ammo: role === "builder" ? 0 : role === "vehicle" ? 18 : 16,
          maxAmmo: role === "builder" ? 0 : role === "vehicle" ? 18 : 16,
          accuracy: rand(0.825, 0.875),
          precision: rand(0.815, 0.87),
          courage: rand(0.47, 0.57),
          reflexes: rand(0.46, 0.56),
          strength: rand(0.48, 0.58),
          suppressionResistance: rand(0.46, 0.56),
          camouflage: rand(0.45, 0.55),
          engineering: role === "builder" || role === "engineer" ? rand(0.72, 0.84) : rand(0.43, 0.53),
          medical: role === "medic" ? rand(0.72, 0.84) : rand(0.42, 0.52),
          driving: rand(0.45, 0.58),
          piloting: rand(0.44, 0.56),
          loyalty: rand(0.48, 0.58),
          discipline: rand(0.48, 0.58),
          patience: rand(0.46, 0.56),
          aggression: rand(0.46, 0.56),
          curiosity: rand(0.45, 0.55),
          adaptability: rand(0.47, 0.57),
          age: Math.round(rand(22, player.race === "Imperium" ? 210 : 90)),
          experience: Math.round(rand(4, 42)),
          battles: Math.round(rand(0, 12)),
          kills: 0,
          injuries: 0,
          promotions: 0,
          friends: [],
          rivals: [],
          squadId: null,
          speed: role === "vehicle" ? 30 : role === "scout" ? 26 : 21,
          range: role === "vehicle" ? 150 : role === "scout" ? 130 : role === "builder" ? 0 : 112,
          damage: baseDamage * (1 + Math.min(5, researchLevel) * 0.04),
          researchLevel,
          fireCd: rand(0.2, 1.5),
          healCd: 0,
          buildCd: role === "builder" ? rand(1, 2.5) : rand(12, 22),
          buildProject: null,
          targetId: null,
          retreating: false,
          wounds: 0,
          woundState: "Healthy",
          bleeding: 0,
          suppression: 0,
          aimTime: 0,
          armorProtection: role === "vehicle" ? 16 : role === "commander" ? 12 : role === "scout" ? 6 : 9,
          bodyZones: { head: 1, chest: 1, leftArm: 1, rightArm: 1, leftLeg: 1, rightLeg: 1 },
          vehicleSystems: role === "vehicle" ? { tracks: 1, engine: 1, turret: 1, mainGun: 1, crew: 1, ammoStorage: 1, fuel: 1 } : null,
          deploymentSource,
          status: role === "builder" ? "Evaluating" : "Forming up",
          lastAction: role === "builder" ? "Evaluating economy, risk, and dependencies." : "Awaiting a squad leader.",
          logs: role === "builder" ? ["Surveying deployment zone.", "No build order assigned."] : ["Deployed as an individual.", "Seeking compatible squad."],
          memories: [],
          armor: role === "vehicle" ? "Heavy armor" : role === "scout" ? "Light armor" : role === "commander" ? "Elite trim" : "Medium armor",
          weapon: role === "builder" ? "Engineer tools" : role === "vehicle" ? "Heavy gun" : role === "scout" ? "Carbine" : role === "medic" ? "Rifle" : "Rifle",
          attachment: role === "medic" ? "Medic pack" : role === "engineer" || role === "builder" ? "Engineer tools" : role === "standard" ? "Standard bearer" : "None",
          commandRank: role === "commander" ? 4 : role === "standard" ? 3 : role === "medic" ? 2 : 1
        };
        return unit;
      }

      function rebuildUnitSelect() {
        const previous = state.selectedId;
        els.unitSelect.textContent = "";
        for (const unit of state.units) {
          const option = document.createElement("option");
          option.value = unit.id;
          option.textContent = `${unitLabel(unit)} — ${roleLabel(unit)}`;
          els.unitSelect.append(option);
        }
        state.selectedId = state.units.some(unit => unit.id === previous) ? previous : state.units[0]?.id || null;
        els.unitSelect.value = state.selectedId || "";
        rebuildAttachSelect();
      }

      function rebuildAttachSelect() {
        const selected = state.units.find(unit => unit.id === state.selectedId);
        const previous = els.attachSelect.value;
        els.attachSelect.textContent = "";
        if (!selected) return;
        const compatible = state.units.filter(unit => unit.alive && unit.id !== selected.id && areAllies(unit.faction, selected.faction) && unit.role !== "builder");
        for (const unit of compatible) {
          const option = document.createElement("option");
          option.value = unit.id;
          option.textContent = `${unitLabel(unit)}${unit.squadId ? ` · ${squadFor(unit.squadId)?.name || "Squad"}` : ""}`;
          els.attachSelect.append(option);
        }
        if (compatible.some(unit => unit.id === previous)) els.attachSelect.value = previous;
        els.attachButton.disabled = selected.role === "builder" || compatible.length === 0;
      }

      function squadFor(id) {
        return state.squads.find(squad => squad.id === id);
      }

      function squadMembers(squadId, snapshot = null) {
        const members = state.units.filter(unit => unit.squadId === squadId);
        if (!snapshot) return members.filter(unit => unit.alive);
        return members.filter(unit => snapshot.units.find(item => item.id === unit.id)?.alive);
      }

      function attachUnits(source, target) {
        if (!source || !target || source.id === target.id || !areAllies(source.faction, target.faction)) return;
        let squad = target.squadId ? squadFor(target.squadId) : source.squadId ? squadFor(source.squadId) : null;
        if (!squad) {
          squad = {
            id: `squad-${state.squads.length + 1}`,
            name: `Squad ${squadNames[state.squads.length % squadNames.length]}`,
            leaderId: target.commandRank >= source.commandRank ? target.id : source.id,
            faction: target.faction,
            createdAt: state.time
          };
          state.squads.push(squad);
        }
        source.squadId = squad.id;
        target.squadId = squad.id;
        addUnitLog(source, `Attached to ${squad.name} under ${unitLabel(state.units.find(unit => unit.id === squad.leaderId) || target)}.`);
        addUnitLog(target, `${unitLabel(source)} attached to ${squad.name}.`);
        incident(`${unitLabel(source)} attached to ${unitLabel(target)}, forming ${squad.name}.`, source.id, "info");
        rebuildAttachSelect();
        updateUI(true);
      }

      function autoFormSquads(faction) {
        const candidates = state.units.filter(unit => unit.alive && unit.faction === faction && unit.role !== "builder" && unit.role !== "vehicle" && !unit.squadId);
        const existing = state.squads.find(squad => squad.faction === faction && squadMembers(squad.id).length < 6);
        if (existing && candidates.length) {
          const capacity = 6 - squadMembers(existing.id).length;
          for (const member of candidates.slice(0, capacity)) {
            member.squadId = existing.id;
            addUnitLog(member, `Transferred into ${existing.name}.`);
          }
          return;
        }
        const leader = candidates.find(unit => unit.role === "commander") || candidates[0];
        if (!leader || candidates.length < 3) return;
        const group = candidates.slice(0, Math.min(5, candidates.length));
        let squad = {
          id: `squad-${state.squads.length + 1}`,
          name: `Squad ${squadNames[state.squads.length % squadNames.length]}`,
          leaderId: leader.id,
          faction,
          createdAt: state.time
        };
        state.squads.push(squad);
        for (const member of group) {
          member.squadId = squad.id;
          addUnitLog(member, `Attached to ${squad.name}.`);
        }
        incident(`${playerFor(faction).faction} individuals formed ${squad.name} with one combined health bar.`, leader.id, "info");
      }

      function createTradePartners() {
        const types = ["Hive City", "Manufactorum", "Mechanicus Enclave", "Imperial Navy", "Orbital Station", "Neutral Settlement"];
        return state.players.map((player, index) => {
          const angle = index * Math.PI * 2 / Math.max(1, state.players.length) + Math.PI / 4;
          return {
            id: `trade-${player.id}`,
            faction: player.id,
            name: `${types[index % types.length]} ${index + 1}`,
            x: clamp(VW / 2 + Math.cos(angle) * 420, 35, VW - 35),
            y: clamp(VH / 2 + Math.sin(angle) * 230, 35, VH - 35),
            exports: index % 3 === 0 ? { food: 18, requisition: 8 } : index % 3 === 1 ? { ammunition: 13, materials: 9 } : { fuel: 12, parts: 8 },
            established: false,
            establishedAt: null,
            establishmentCost: { ...(tradeRouteRules.establishmentCost || { influence: 40, materials: 25 }) },
            nextDispatch: Infinity
          };
        });
      }

      function rebuildLogisticsPlayerSelect() {
        els.logisticsPlayer.textContent = "";
        for (const player of state.players) {
          const option = document.createElement("option");
          option.value = player.id;
          option.textContent = `P${player.index + 1} · ${player.faction}`;
          els.logisticsPlayer.append(option);
        }
        if (!state.players.some(player => player.id === state.logisticsPlayerId)) state.logisticsPlayerId = state.players[0]?.id || "a";
        els.logisticsPlayer.value = state.logisticsPlayerId;
      }

      function resetBattle(presetKey = "iron", customFeatures = null) {
        const preset = presets[presetKey] || presets.iron;
        state.scenario = presetKey;
        state.time = 0;
        state.startMinute = preset.startMinute;
        state.battleSeed = `${presetKey}:${state.mapResolution.width}x${state.mapResolution.height}:${state.players.map(player => `${player.race}-${player.doctrine}`).join("|")}`;
        battleRandom = seededRandom(state.battleSeed);
        if (presetKey !== "custom") {
          state.lighting.mode = "dynamic";
          state.lighting.startHour = preset.startMinute / 60;
          state.lighting.fixedHour = preset.startMinute / 60;
          state.lighting.weather = presetKey === "iron" ? "rain" : presetKey === "verdant" ? "fog" : "dust";
        }
        if (!state.players.length) state.players = setupPlayers.slice(0, 2).map(player => ({ ...player, base: { ...basePositions[player.index] } }));
        state.players.forEach((player, index) => {
          player.index = index;
          player.id = ids[index];
          player.base = { ...basePositions[index] };
          player.spawnZone = { shape: "circle", size: 84, points: [] };
          player.deploymentMethod = factionProfile(player).deployment;
        });
        state.camera = { x: VW / 2, y: VH / 2, zoom: 1 };
        state.cameraFocus = { x: VW / 2, y: VH / 2 };
        state.panning = false;
        state.panPointerId = null;
        state.panStart = null;
        els.zoomValue.textContent = "View 1×";
        els.zoomOut.disabled = true;
        els.zoomIn.disabled = false;
        const resolution = presetKey === "custom" ? state.mapResolution : preset.resolution;
        setResolution(resolution.width, resolution.height);
        state.units = [];
        state.structures = [];
        state.squads = [];
        state.projectiles = [];
        state.features = (customFeatures ?? preset.features).map(feature => ({ condition: 1, age: 0, ...feature, visual: feature.visual || visualForBrush(feature.type) }));
        state.nextTerritoryId = 1;
        state.territories = state.players.map(player => createTerritory(player.id, player.base, spawnZoneFor(player).size, {
          name: `${player.faction} heartland`,
          status: "controlled",
          resourceValue: 55,
          strategicValue: 70,
          defensibility: 65,
          claimedAt: -20,
          reason: "Headquarters supply",
          maxStructures: state.players.length > 8 ? 14 : state.players.length > 4 ? 18 : 28
        }));
        state.selectedTerritoryId = state.territories[0]?.id || null;
        state.nextTerritoryTick = 0;
        state.territoryOverlay = true;
        els.territoryToggle.setAttribute("aria-pressed", "true");
        els.territoryToggle.innerHTML = '<i data-lucide="map-pinned" aria-hidden="true"></i>Territory on';
        state.incidents = [];
        state.snapshots = [];
        state.resources = {};
        state.economies = {};
        state.convoys = [];
        state.dropPods = [];
        state.roads = [];
        state.nextConvoyId = 1;
        state.nextDropPodId = 1;
        state.nextLogisticsTick = 0;
        state.casualties = {};
        state.adapted = {};
        state.nextUnitIndex = {};
        state.nextTrain = {};
        state.explored = {};
        for (const player of state.players) {
          state.economies[player.id] = createEconomy(player);
          state.resources[player.id] = state.economies[player.id].inventory.requisition;
          state.casualties[player.id] = 0;
          state.adapted[player.id] = false;
          state.nextUnitIndex[player.id] = 0;
          state.nextTrain[player.id] = 0;
          state.explored[player.id] = new Uint8Array(48 * 27);
          state.units.push(makeUnit(player.id, "builder", "Ground deployment · starting zone"));
        }
        state.tradePartners = createTradePartners();
        state.logisticsPlayerId = state.players[0]?.id || "a";
        rebuildLogisticsPlayerSelect();
        rebuildRoadNetwork();
        state.logisticsOpen = false;
        els.logisticsPanel.hidden = true;
        els.logisticsButton.setAttribute("aria-pressed", "false");
        state.nextSnapshot = 0;
        state.nextEconomy = 0;
        state.nextMilestone = 240;
        state.environmentAccumulator = 0;
        state.separationAccumulator = 0;
        state.renderAccumulator = 0;
        state.fastStepAccumulator = 0;
        state.simulationAccumulator = 0;
        state.spatialAccumulator = 0;
        state.spatialGrid = new Map();
        state.fastUnitPhase = 0;
        state.selectedId = state.units[0]?.id || null;
        state.selectedStructureId = null;
        state.replay = false;
        state.replayIndex = 0;
        state.ended = false;
        state.fogPlayer = "observer";
        els.battleName.textContent = `${presetKey === "custom" ? "Untitled theater" : preset.name} / Builder deployment`;
        rebuildUnitSelect();
        captureSnapshot();
        incident(`${state.players.length} builders deployed. AI priorities are live; no build order was assigned.`, null, "info");
        updateFogButton();
        updateLightingButton();
        if (window.lucide) lucide.createIcons({ attrs: { width: 16, height: 16 } });
        updateUI(true);
      }

      function seededRandom(seedText) {
        let seed = 2166136261;
        for (const character of String(seedText || "FRONTIER-01")) {
          seed ^= character.charCodeAt(0);
          seed = Math.imul(seed, 16777619);
        }
        return () => {
          seed += 0x6D2B79F5;
          let value = seed;
          value = Math.imul(value ^ value >>> 15, value | 1);
          value ^= value + Math.imul(value ^ value >>> 7, value | 61);
          return ((value ^ value >>> 14) >>> 0) / 4294967296;
        };
      }

      function randomizeMap() {
        const biome = els.randomBiome.value;
        const seedText = els.randomSeed.value.trim() || `MAP-${Math.floor(battleRandom() * 999999)}`;
        els.randomSeed.value = seedText;
        const random = seededRandom(`${seedText}:${biome}:${state.players.length}`);
        const profiles = {
          balanced: { base: "grass", terrain: ["grass", "dirt", "sand", "rock", "shallowwater"], props: ["trees", "bushes", "boulders", "pond"], road: "dirtroad" },
          forest: { base: "forestfloor", terrain: ["grass", "darkgrass", "forestfloor", "mud", "shallowwater"], props: ["denseforest", "trees", "pinetree", "bushes", "tallgrass", "pond"], road: "trail" },
          archipelago: { base: "deepwater", terrain: ["sand", "beach", "grass", "shallowwater", "rock"], props: ["palmtree", "bushes", "pond", "boulders"], road: "woodenbridge" },
          desert: { base: "sand", terrain: ["sand", "dirt", "rock", "mud"], props: ["cactus", "boulders", "smallrocks", "crystal"], road: "dirtroad" },
          frozen: { base: "snow", terrain: ["snow", "ice", "rock", "dirt", "shallowwater"], props: ["pinetree", "boulders", "cave", "deadforest"], road: "stoneroad" },
          volcanic: { base: "ash", terrain: ["ash", "rock", "lava", "dirt"], props: ["boulders", "crystal", "cave", "deadforest"], road: "stoneroad" },
          urban: { base: "pavement", terrain: ["pavement", "dirt", "ash", "rock", "grass"], props: ["ruins", "boulders", "crystal", "deadforest"], road: "asphalt" }
        };
        const profile = profiles[biome] || profiles.balanced;
        const generated = [{
          type: profile.base,
          x: VW / 2,
          y: VH / 2,
          r: Math.max(VW, VH),
          shape: "square",
          opacity: 1,
          condition: 1,
          age: 0,
          visual: visualForBrush(profile.base)
        }];
        const patchCount = biome === "archipelago" ? 34 : 42;
        for (let index = 0; index < patchCount; index += 1) {
          const type = profile.terrain[Math.floor(random() * profile.terrain.length)];
          generated.push({
            type,
            x: 40 + random() * (VW - 80),
            y: 34 + random() * (VH - 68),
            r: 28 + random() * (biome === "archipelago" ? 86 : 64),
            shape: random() > 0.56 ? "freeform" : "softcircle",
            hardness: 0.58 + random() * 0.28,
            falloff: 0.08 + random() * 0.28,
            opacity: 0.84 + random() * 0.16,
            condition: 1,
            age: 0,
            visual: visualForBrush(type)
          });
        }
        const propCount = biome === "forest" ? 34 : 22;
        for (let index = 0; index < propCount; index += 1) {
          const type = profile.props[Math.floor(random() * profile.props.length)];
          generated.push({
            type,
            x: 26 + random() * (VW - 52),
            y: 26 + random() * (VH - 52),
            r: 18 + random() * 26,
            shape: "circle",
            opacity: 0.9 + random() * 0.1,
            condition: 1,
            age: 0,
            visual: visualForBrush(type)
          });
        }
        const radiusX = 360 + random() * 40;
        const radiusY = 188 + random() * 20;
        state.players.forEach((player, index) => {
          const angle = -Math.PI / 2 + index * Math.PI * 2 / state.players.length + (random() - 0.5) * 0.18;
          player.base = {
            x: clamp(VW / 2 + Math.cos(angle) * radiusX, 88, VW - 88),
            y: clamp(VH / 2 + Math.sin(angle) * radiusY, 78, VH - 78)
          };
          player.spawnZone = { shape: random() > 0.7 ? "square" : "circle", size: 70 + Math.round(random() * 25), points: [] };
          const builder = state.units.find(unit => unit.faction === player.id && unit.role === "builder");
          if (builder) {
            builder.x = player.base.x;
            builder.y = player.base.y;
          }
        });
        state.features = generated;
        state.nextTerritoryId = 1;
        state.territories = state.players.map(player => {
          const territory = createTerritory(player.id, player.base, spawnZoneFor(player).size, {
            name: `${player.faction} heartland`,
            status: "controlled",
            resourceValue: 48 + Math.round(random() * 20),
            strategicValue: 58 + Math.round(random() * 24),
            defensibility: 48 + Math.round(random() * 30),
            claimedAt: -20,
            reason: "Generated headquarters supply"
          });
          territory.points = territory.points.map(point => {
            const center = territoryCenter(territory);
            const wobble = 0.88 + random() * 0.24;
            return {
              x: clamp(center.x + (point.x - center.x) * wobble, 0, VW),
              y: clamp(center.y + (point.y - center.y) * wobble, 0, VH)
            };
          });
          return territory;
        });
        const neutralCount = Math.max(3, Math.min(9, Math.ceil(state.players.length * 0.75)));
        for (let index = 0; index < neutralCount; index += 1) {
          const center = { x: 110 + random() * (VW - 220), y: 90 + random() * (VH - 180) };
          state.territories.push(createTerritory("", center, 45 + random() * 34, {
            name: `${["Relay", "Crossing", "Ridge", "Basin", "Quarry", "Pass"][index % 6]} ${index + 1}`,
            status: "neutral",
            resourceValue: 35 + Math.round(random() * 55),
            strategicValue: 35 + Math.round(random() * 55),
            defensibility: 25 + Math.round(random() * 60),
            reason: "Generated strategic territory"
          }));
        }
        state.selectedTerritoryId = state.territories[0]?.id || null;
        state.tradePartners = createTradePartners();
        rebuildRoadNetwork();
        state.selectedTerritoryId && rebuildTerritorySelect();
        loadTerritoryForm();
        els.battleName.textContent = `${seedText} / ${els.randomBiome.selectedOptions[0].text}`;
        els.editorTip.textContent = `${els.randomBiome.selectedOptions[0].text} generated · ${generated.length} layers · ${state.territories.length} territories`;
        updateUI(true);
        draw();
      }

      function chooseBuilding(faction) {
        const player = playerFor(faction);
        const economy = economyFor(faction);
        const approved = economy.approvedBuilds.find(type => buildingCatalog[type] && !state.structures.some(item => item.faction === faction && item.type === type && item.alive !== false));
        if (approved) {
          economy.approvedBuilds.splice(economy.approvedBuilds.indexOf(approved), 1);
          return approved;
        }
        const complete = type => state.structures.filter(item => item.faction === faction && item.type === type && item.progress >= 1 && item.alive !== false).length;
        if (!complete("outpost")) return "outpost";
        if (!complete("generator")) return "generator";
        if (!complete("warehouse")) return "warehouse";
        if (!complete("mine")) return "mine";

        const capacity = economyCapacity(faction);
        const ratio = key => clamp((economy.inventory[key] || 0) / Math.max(1, capacity[key] || 1), 0, 1.5);
        const structureCount = state.structures.filter(item => item.faction === faction && item.alive !== false).length;
        const armyCount = state.units.filter(unit => unit.alive && unit.faction === faction && unit.role !== "builder").length;
        const threat = clamp(state.units.filter(unit => unit.alive && !areAllies(unit.faction, faction) && distance(unit, baseFor(faction)) < 210).length / 5, 0, 1);
        const desired = {
          generator: Math.max(1, Math.ceil(structureCount / 6)),
          warehouse: Math.max(1, Math.ceil(structureCount / 7)),
          mine: Math.max(1, Math.ceil(structureCount / 8)),
          farm: Math.max(1, Math.ceil(armyCount / 8)),
          refinery: Math.max(1, Math.ceil(armyCount / 10)),
          barracks: Math.max(1, Math.ceil(armyCount / 7)),
          workshop: Math.max(1, Math.ceil(armyCount / 9)),
          researchcenter: Math.max(1, Math.ceil(Math.max(1, armyCount) / 8)),
          fieldhospital: Math.max(1, Math.ceil(armyCount / 10)),
          observationtower: Math.max(1, Math.ceil(structureCount / 10)),
          bunker: threat > 0.2 ? Math.max(2, Math.ceil(structureCount / 6)) : Math.ceil(structureCount / 12),
          turret: threat > 0.35 ? Math.max(1, Math.ceil(structureCount / 8)) : Math.ceil(structureCount / 16),
          fueldepot: ratio("fuel") > 0.72 ? Math.ceil(structureCount / 12) : 0,
          ammodepot: ratio("ammunition") > 0.72 ? Math.ceil(structureCount / 12) : 0,
          dropbay: ["astartes", "chaos"].includes(Object.keys(factionProfiles).find(key => factionProfiles[key] === factionProfile(player))) ? 1 : 0
        };
        const shortageNeed = {
          generator: 1 - ratio("energy"), warehouse: Math.max(1 - ratio("materials"), 1 - ratio("parts")),
          mine: 1 - ratio("materials"), farm: 1 - ratio("food"), refinery: 1 - ratio("fuel"),
          barracks: clamp((6 - armyCount) / 6, 0, 1), workshop: 1 - ratio("ammunition"), researchcenter: clamp(1 - (economy.research?.level || 0) / 3, 0.25, 1),
          fieldhospital: 1 - ratio("medical"), observationtower: 0.28, bunker: threat, turret: threat,
          fueldepot: ratio("fuel"), ammodepot: ratio("ammunition"), dropbay: player.faction === "Space Marines" ? 0.7 : 0.2
        };
        const doctrineBonus = {
          Fortress: { bunker: 30, turret: 28, observationtower: 18 },
          Aggressive: { barracks: 32, turret: 18, workshop: 16 },
          Expansion: { mine: 30, warehouse: 24, farm: 18, refinery: 18 },
          "Rush tech": { researchcenter: 42, workshop: 28, generator: 22, refinery: 16 },
          "Repair first": { fieldhospital: 34, workshop: 16, bunker: 14 },
          Balanced: {}
        }[player.doctrine] || {};
        const scored = Object.keys(buildingCatalog)
          .filter(type => type !== "outpost")
          .map(type => {
            const spec = buildingCatalog[type];
            const dependencyReady = !spec.requires || complete(spec.requires) > 0;
            const missing = Math.max(0, (desired[type] || 0) - complete(type));
            const resources = clamp(Math.min((economy.inventory.requisition || 0) / Math.max(1, spec.cost), (economy.inventory.materials || 0) / Math.max(1, Math.ceil(spec.cost * 0.55))), 0, 1.4);
            const need = shortageNeed[type] || 0.1;
            const score = (dependencyReady ? 0 : -1000) + missing * 38 + need * 55 + resources * 24 + (doctrineBonus[type] || 0) - spec.risk * (threat * 5 + 1);
            return { type, score };
          })
          .sort((a, b) => b.score - a.score);
        const strongest = scored.slice(0, 3);
        const temperature = player.race === "Orks" ? 24 : player.doctrine === "Aggressive" ? 18 : 11;
        const maxScore = strongest[0]?.score || 0;
        const weights = strongest.map(item => Math.exp((item.score - maxScore) / temperature));
        let roll = battleRandom() * weights.reduce((sum, value) => sum + value, 0);
        for (let index = 0; index < strongest.length; index += 1) {
          roll -= weights[index];
          if (roll <= 0) return strongest[index].type;
        }
        return strongest[0]?.type || "warehouse";
      }

      function constructionAllowedAt(faction, type, site) {
        const spec = buildingCatalog[type];
        if (!spec || structureCollisionAt(site, 0, null, spec.hitbox)) return false;
        const terrain = terrainAt(site);
        if (["deepwater", "lava", "cliff", "mountain"].includes(terrain.type)) return false;
        const territory = territoryAt(site);
        if (!territory) return type === "outpost";
        const territoryStructures = state.structures.filter(structure => structure.alive !== false && pointInTerritory(structure, territory)).length;
        return territory.owner === faction
          && (territory.connected || !territory.supplyRequired || type === "outpost")
          && territory.allowedStructures !== "none"
          && (territory.allowedStructures === "any"
            || territory.allowedStructures === "military" && spec.military >= spec.economic
            || territory.allowedStructures === "economic" && spec.economic >= spec.military)
          && territoryStructures < territory.maxStructures;
      }

      function buildingSite(faction, type) {
        const base = baseFor(faction);
        const count = state.structures.filter(item => item.faction === faction).length;
        const spec = buildingCatalog[type];
        const startAngle = (count * 2.31 + playerFor(faction).index * 0.7) % (Math.PI * 2);
        const candidates = [];
        if (type === "outpost") candidates.push({ x: Math.round(base.x / 16) * 16, y: Math.round(base.y / 16) * 16 });
        for (let ring = 0; ring < 5; ring += 1) {
          const radius = 44 + ring * 34;
          for (let index = 0; index < 12; index += 1) {
            const candidateAngle = startAngle + index * Math.PI / 6 + ring * 0.19;
            candidates.push({
              x: clamp(Math.round((base.x + Math.cos(candidateAngle) * radius) / 16) * 16, 34, VW - 34),
              y: clamp(Math.round((base.y + Math.sin(candidateAngle) * radius) / 16) * 16, 34, VH - 34)
            });
          }
        }
        const viable = candidates.filter(candidate => constructionAllowedAt(faction, type, candidate));
        if (!viable.length) return null;
        return viable.map(candidate => {
          const light = lightingAt(candidate, faction);
          const terrain = terrainAt(candidate);
          const territory = territoryAt(candidate);
          const enemyThreat = state.units.filter(unit => unit.alive && !areAllies(unit.faction, faction) && distance(unit, candidate) < 180).length;
          const resourceValue = (territory?.resourceValue || 40) / 100;
          const defensibility = (territory?.defensibility || 40) / 100 + terrain.cover;
          const supplyConnectivity = insideSupplyRadius(candidate, faction) ? 1 : type === "outpost" ? 0.8 : 0.25;
          const constructionSuitability = clamp(1 - Math.abs(terrain.elevation || 0) * 0.08, 0, 1);
          const expansionValue = clamp(distance(base, candidate) / 220, 0, 1);
          const terrainRisk = ["water", "river", "swamp", "mud"].includes(terrain.type) ? 0.65 : 0;
          const economicBias = spec.economic >= spec.military ? resourceValue * 32 + supplyConnectivity * 38 : defensibility * 34;
          const score = economicBias + constructionSuitability * 26 + expansionValue * 10 - enemyThreat * 30 - terrainRisk * 28 + light.shadowed * 4;
          return { candidate, score };
        }).sort((a, b) => b.score - a.score)[0].candidate;
      }

      function updateBuilder(unit, dt) {
        unit.buildCd -= dt;
        if (unit.buildProject) {
          const structure = state.structures.find(item => item.id === unit.buildProject);
          if (!structure) {
            unit.buildProject = null;
            return;
          }
          if (distance(unit, structure) > 13) {
            const approachDistance = distance(unit, structure);
            moveToward(unit, structure, dt, 0.9);
            const remainingDistance = distance(unit, structure);
            unit.buildStall = remainingDistance < approachDistance - 0.02 ? 0 : (unit.buildStall || 0) + dt;
            if (unit.buildStall > 4) {
              ensureStructureRuntime(structure);
              const startRadius = Math.max(structure.hitbox.w, structure.hitbox.h) / 2 + 9;
              const recoverySites = [];
              for (let ring = 0; ring < 4; ring += 1) {
                const radius = startRadius + ring * 12;
                for (let index = 0; index < 16; index += 1) {
                  const angle = index * Math.PI / 8 + unit.index * 0.23;
                  const candidate = {
                    x: clamp(structure.x + Math.cos(angle) * radius, 24, VW - 24),
                    y: clamp(structure.y + Math.sin(angle) * radius, 24, VH - 24)
                  };
                  const terrain = terrainAt(candidate);
                  if (!structureCollisionAt(candidate, 3, structure.id) && !["deepwater", "lava", "cliff", "mountain"].includes(terrain.type)) {
                    recoverySites.push(candidate);
                  }
                }
                if (recoverySites.length) break;
              }
              recoverySites.sort((a, b) => distance(a, structure) + distance(a, unit) * 0.08 - distance(b, structure) - distance(b, unit) * 0.08);
              if (recoverySites[0]) {
                unit.x = recoverySites[0].x;
                unit.y = recoverySites[0].y;
                unit.detour = null;
                unit.buildStall = 0;
                unit.lastAction = `Recovered a blocked path to ${structure.displayName || factionBuildingLabel(unit.faction, structure.type)} without crossing its collision box.`;
              }
            }
            unit.status = "Moving to site";
            addUnitLog(unit, `Moving to ${buildingCatalog[structure.type].label} site.`);
          } else {
            unit.buildStall = 0;
            const supplied = insideSupplyRadius(structure, unit.faction) || structure.type === "outpost";
            structure.progress = clamp(structure.progress + dt * (0.07 + unit.engineering * 0.04) * (supplied ? 1 : 0.58), 0, 1);
            unit.status = "Building";
            unit.lastAction = `${structure.displayName || factionBuildingLabel(unit.faction, structure.type)} ${Math.round(structure.progress * 100)}% complete${supplied ? "" : " · outside supply radius"}.`;
            if (structure.progress >= 1) {
              ensureStructureRuntime(structure);
              moveUnitOutsideStructure(unit, structure);
              rebuildRoadNetwork();
              incident(`${unitLabel(unit)} completed ${structure.displayName || factionBuildingLabel(unit.faction, structure.type)} and is evaluating the next funded project.`, unit.id, "info");
              unit.memories.push(`Built ${structure.displayName || factionBuildingLabel(unit.faction, structure.type)} at ${formatElapsed(state.time)}.`);
              unit.buildProject = null;
              unit.detour = null;
              unit.buildStall = 0;
              unit.buildCd = rand(0.8, 2.2);
            }
          }
          return;
        }

        const damaged = state.structures.find(item => item.faction === unit.faction && item.progress >= 1 && item.condition < 0.82);
        if (damaged && (playerFor(unit.faction).doctrine === "Repair first" || damaged.condition < 0.5)) {
          if (distance(unit, damaged) > 13) moveToward(unit, damaged, dt);
          else {
            ensureStructureRuntime(damaged);
            const factor = insideSupplyRadius(damaged, unit.faction) ? 1 : 0.45;
            damaged.hp = clamp(damaged.hp + dt * 14 * factor, 0, damaged.maxHp);
            damaged.condition = damaged.hp / damaged.maxHp;
          }
          unit.status = "Repairing";
          unit.lastAction = `Repairing ${buildingCatalog[damaged.type]?.label || "structure"}.`;
          return;
        }

        const factionStructureCount = state.structures.filter(item => item.faction === unit.faction && item.alive !== false).length;
        const structureCap = state.players.length > 8 ? 22 : state.players.length > 4 ? 30 : 42;
        if (factionStructureCount >= structureCap) {
          unit.status = "Maintaining base";
          unit.lastAction = `Simulation safety cap ${structureCap} reached; repairs and supply continue.`;
          return;
        }

        if (unit.buildCd > 0) {
          unit.status = "Evaluating";
          unit.lastAction = "Comparing economy, military value, risk, and dependencies.";
          return;
        }

        const type = chooseBuilding(unit.faction);
        if (!type) {
          unit.status = "Evaluating";
          unit.lastAction = "No valid economy, research, army, or gathering project is currently available.";
          unit.buildCd = 1;
          return;
        }
        const spec = buildingCatalog[type];
        const economy = economyFor(unit.faction);
        const materialCost = Math.ceil(spec.cost * 0.55);
        const dependencyReady = !spec.requires || state.structures.some(item => item.faction === unit.faction && item.type === spec.requires && item.progress >= 1);
        if (!dependencyReady || economy.inventory.requisition < spec.cost || economy.inventory.materials < materialCost) {
          unit.status = "Gathering";
          unit.lastAction = dependencyReady ? `Awaiting ${Math.max(0, spec.cost - Math.floor(economy.inventory.requisition))} requisition and ${Math.max(0, materialCost - Math.floor(economy.inventory.materials))} materials for ${spec.label}.` : `Waiting for ${buildingCatalog[spec.requires]?.label || spec.requires}.`;
          return;
        }

        const site = buildingSite(unit.faction, type);
        if (!site || !constructionAllowedAt(unit.faction, type, site)) {
          unit.status = "Supply blocked";
          unit.lastAction = "Waiting for a connected, collision-free construction site or expanded territory.";
          unit.buildCd = 2;
          return;
        }
        economy.inventory.requisition -= spec.cost;
        economy.inventory.materials -= materialCost;
        syncLegacyResources(unit.faction);
        const structure = {
          id: `building-${state.structures.length + 1}`,
          type,
          faction: unit.faction,
          x: site.x,
          y: site.y,
          progress: 0,
          condition: 1,
          maxHp: spec.maxHp || 400,
          hp: spec.maxHp || 400,
          hitbox: { ...(spec.hitbox || { w: 28, h: 24 }) },
          displayName: factionBuildingLabel(unit.faction, type),
          inventory: {},
          alive: true,
          createdAt: state.time
        };
        state.structures.push(structure);
        unit.buildProject = structure.id;
        unit.status = "Constructing";
        addUnitLog(unit, `AI selected ${structure.displayName}: ${spec.purpose} utility outweighed cost, threat, and collision risk.`);
        incident(`${playerFor(unit.faction).faction} AI funded ${structure.displayName} (${spec.purpose}); the builder will continue while resources and valid sites remain.`, unit.id, "info");
      }

      function moveToward(unit, point, dt, speedFactor = 1) {
        const radius = unit.role === "vehicle" ? 7 : 3;
        const ignoreId = unit.buildProject || null;
        const enclosingStructure = structureCollisionAt(unit, radius, ignoreId);
        if (enclosingStructure) moveUnitOutsideStructure(unit, enclosingStructure);
        if (unit.detour && distance(unit, unit.detour) < 5) unit.detour = null;
        const movementTarget = unit.detour || point;
        const dx = movementTarget.x - unit.x;
        const dy = movementTarget.y - unit.y;
        const d = Math.hypot(dx, dy) || 1;
        const terrain = terrainAt(unit);
        const fuelFactor = unit.role === "vehicle" && (unit.fuelReserve ?? 1) <= 0 ? 0.22 : 1;
        const legCondition = unit.bodyZones ? ((unit.bodyZones.leftLeg || 0) + (unit.bodyZones.rightLeg || 0)) / 2 : 1;
        const suppressionFactor = clamp(1 - (unit.suppression || 0) * 0.42, 0.45, 1);
        const step = unit.speed * terrain.speed * (1 - unit.fatigue * 0.36) * speedFactor * fuelFactor * clamp(legCondition, 0.35, 1) * suppressionFactor * dt;
        const next = { x: clamp(unit.x + dx / d * step, 24, VW - 24), y: clamp(unit.y + dy / d * step, 24, VH - 24) };
        const collision = structureCollisionAt(next, radius, ignoreId);
        if (!collision) {
          unit.x = next.x;
          unit.y = next.y;
          return;
        }
        const slideX = { x: next.x, y: unit.y };
        const slideY = { x: unit.x, y: next.y };
        if (Math.abs(slideX.x - unit.x) > 0.001 && !structureCollisionAt(slideX, radius, ignoreId)) unit.x = slideX.x;
        else if (Math.abs(slideY.y - unit.y) > 0.001 && !structureCollisionAt(slideY, radius, ignoreId)) unit.y = slideY.y;
        else {
          const side = (unit.index + Math.floor(state.time / 3)) % 2 ? 1 : -1;
          const tangents = [side, -side].map(direction => ({
            x: clamp(unit.x - dy / d * step * direction, 24, VW - 24),
            y: clamp(unit.y + dx / d * step * direction, 24, VH - 24)
          }));
          const detour = tangents.find(candidate => !structureCollisionAt(candidate, radius, ignoreId));
          if (detour) {
            unit.x = detour.x;
            unit.y = detour.y;
          } else {
            ensureStructureRuntime(collision);
            const marginX = collision.hitbox.w / 2 + radius + 7;
            const marginY = collision.hitbox.h / 2 + radius + 7;
            const corners = [
              { x: collision.x - marginX, y: collision.y - marginY },
              { x: collision.x + marginX, y: collision.y - marginY },
              { x: collision.x - marginX, y: collision.y + marginY },
              { x: collision.x + marginX, y: collision.y + marginY }
            ]
              .map(candidate => ({ x: clamp(candidate.x, 24, VW - 24), y: clamp(candidate.y, 24, VH - 24) }))
              .filter(candidate => !structureCollisionAt(candidate, radius, ignoreId))
              .sort((a, b) => distance(unit, a) + distance(a, point) - distance(unit, b) - distance(b, point));
            unit.detour = corners[0] || null;
          }
        }
      }

      function enemyPlayerFor(faction) {
        const base = baseFor(faction);
        return state.players
          .filter(player => !areAllies(player.id, faction))
          .sort((a, b) => distance(base, a.base) - distance(base, b.base))[0] || null;
      }

      function objectiveFor(unit) {
        const start = baseFor(unit.faction);
        if (unit.role === "vehicle") {
          const escortJob = state.convoys.find(convoy => convoy.faction === unit.faction && !convoy.finished && convoy.escortRequested);
          if (escortJob) {
            unit.lightPlan = `Escorting ${escortJob.name}`;
            return escortJob;
          }
        }
        const enemy = enemyPlayerFor(unit.faction);
        if (!enemy) return { x: VW / 2, y: VH / 2 };
        const doctrine = playerFor(unit.faction).doctrine;
        const phase = clamp(state.time / 120, 0, 1);
        let progress = 0.38 + phase * 0.3;
        if (doctrine === "Fortress" || doctrine === "Repair first") progress = 0.22 + phase * 0.22;
        if (doctrine === "Aggressive") progress = 0.58 + phase * 0.34;
        const spread = ((unit.index % 5) - 2) * 18;
        const direct = {
          x: start.x + (enemy.base.x - start.x) * progress + spread,
          y: start.y + (enemy.base.y - start.y) * progress - spread
        };
        if (doctrine === "Aggressive") return direct;
        const dx = enemy.base.x - start.x;
        const dy = enemy.base.y - start.y;
        const length = Math.hypot(dx, dy) || 1;
        const perpendicular = { x: -dy / length, y: dx / length };
        const candidates = [-72, -36, 0, 36, 72].map(offset => ({
          x: clamp(direct.x + perpendicular.x * offset, 24, VW - 24),
          y: clamp(direct.y + perpendicular.y * offset, 24, VH - 24)
        }));
        const best = candidates
          .map(candidate => {
            const light = lightingAt(candidate, unit.faction);
            const routeCost = distance(candidate, direct) * 0.35 + light.brightness * 82 + light.searchlight * 145 - (light.shadowed ? 58 : 0);
            return { candidate, routeCost, light };
          })
          .sort((a, b) => a.routeCost - b.routeCost)[0];
        unit.lightPlan = best.light.searchlight > 0.15
          ? "Avoiding searchlight"
          : best.light.shadowed ? "Using shadow route" : best.light.brightness < 0.28 ? "Advancing under darkness" : "Balanced route";
        return best.candidate;
      }

      const spatialCellSize = 64;

      function spatialCellKey(x, y) {
        return `${Math.floor(x / spatialCellSize)},${Math.floor(y / spatialCellSize)}`;
      }

      function rebuildSpatialGrid() {
        const grid = new Map();
        const add = (kind, item) => {
          const key = spatialCellKey(item.x, item.y);
          if (!grid.has(key)) grid.set(key, { units: [], structures: [] });
          grid.get(key)[kind].push(item);
        };
        state.units.filter(unit => unit.alive).forEach(unit => add("units", unit));
        state.structures.filter(structure => structure.alive !== false && structure.progress >= 0.05).forEach(structure => add("structures", structure));
        state.spatialGrid = grid;
      }

      function nearbyCombatObjects(point, radius) {
        if (!state.spatialGrid?.size) return { units: state.units, structures: state.structures };
        const range = Math.ceil(radius / spatialCellSize);
        const cx = Math.floor(point.x / spatialCellSize);
        const cy = Math.floor(point.y / spatialCellSize);
        const result = { units: [], structures: [] };
        for (let ox = -range; ox <= range; ox += 1) {
          for (let oy = -range; oy <= range; oy += 1) {
            const bucket = state.spatialGrid.get(`${cx + ox},${cy + oy}`);
            if (!bucket) continue;
            result.units.push(...bucket.units);
            result.structures.push(...bucket.structures);
          }
        }
        return result;
      }

      function findTarget(unit) {
        const terrain = terrainAt(unit);
        const sensor = unit.range * (state.visibility / 100) * terrain.detection * (unit.role === "scout" ? 1.35 : 1);
        const optics = nightVisionFactor(unit.faction);
        const nearby = nearbyCombatObjects(unit, sensor * 1.7);
        const candidates = [];
        for (const other of nearby.units) {
          if (!other.alive || areAllies(other.faction, unit.faction)) continue;
          const d = distance(unit, other);
          const light = lightingAt(other, unit.faction);
          const ambient = clamp(0.36 + light.brightness * 0.76 + optics * 0.34, 0.42, 1.28);
          const concealment = light.shadowed ? 0.62 : 1;
          const searchlight = light.searchlight > 0.15 ? 1.48 : 1;
          const detectionRadius = sensor * terrainAt(other).detection * ambient * concealment * searchlight;
          other.lightState = light.searchlight > 0.15 ? "Searchlight exposed" : light.shadowed ? "In shadow" : light.period;
          if (d >= detectionRadius) continue;
          const threat = other.role === "vehicle" ? 90 : other.role === "commander" ? 82 : other.role === "medic" ? 68 : 50;
          const distanceValue = (1 - d / Math.max(1, detectionRadius)) * 72;
          const weakness = (1 - other.hp / Math.max(1, other.maxHp)) * 24;
          const commanderPriority = unit.role === "commander" ? 18 : 0;
          candidates.push({ target: other, score: threat + distanceValue + weakness + commanderPriority });
        }
        for (const structure of nearby.structures) {
          if (structure.alive === false || structure.progress < 0.45 || areAllies(structure.faction, unit.faction)) continue;
          ensureStructureRuntime(structure);
          const d = distance(unit, structure);
          const detectionRadius = sensor * (structure.type === "outpost" || structure.type === "generator" ? 1.35 : 1.08);
          if (d >= detectionRadius) continue;
          const strategic = structure.type === "outpost" ? 105 : ["generator", "barracks", "workshop", "dropbay"].includes(structure.type) ? 82 : 58;
          const distanceValue = (1 - d / Math.max(1, detectionRadius)) * 64;
          const weakness = (1 - structure.hp / Math.max(1, structure.maxHp)) * 20;
          candidates.push({ target: structure, score: strategic + distanceValue + weakness });
        }
        candidates.sort((a, b) => b.score - a.score);
        return candidates[0]?.target || null;
      }

      function nearestAlly(unit, predicate, radius = Infinity) {
        let best = null;
        let bestDistance = radius;
        for (const other of state.units) {
          if (!other.alive || !areAllies(other.faction, unit.faction) || other.id === unit.id || !predicate(other)) continue;
          const d = distance(unit, other);
          if (d < bestDistance) {
            best = other;
            bestDistance = d;
          }
        }
        return best;
      }

      function hitChanceFor(unit, target) {
        const isStructure = Boolean(target.maxHp && buildingCatalog[target.type]);
        const cover = isStructure ? terrainAt(target).cover * 0.35 : terrainAt(target).cover;
        const light = lightingAt(target, unit.faction);
        const optics = nightVisionFactor(unit.faction);
        const rangeRatio = distance(unit, target) / Math.max(1, unit.range);
        const rangeModifier = 1 / (1 + Math.pow(rangeRatio / 0.74, 2));
        const aimModifier = clamp(0.42 + 0.58 * (1 - Math.exp(-3.2 * (unit.aimTime || 0))), 0.42, 1);
        const visibilityModifier = clamp(0.48 + light.brightness * 0.62 + (light.searchlight > 0.15 ? 0.22 : 0) + optics * 0.16 - (light.shadowed ? 0.2 : 0), 0.22, 1.2);
        const movementModifier = ["Closing", "Advancing", "Retreating"].includes(unit.status) ? 0.72 : 1;
        const fatigueModifier = clamp(1 - unit.fatigue * 0.42 - (unit.suppression || 0) * 0.58, 0.18, 1);
        const precisionModifier = clamp(0.72 + unit.precision * 0.32, 0.72, 1.05);
        return clamp(unit.accuracy * rangeModifier * aimModifier * visibilityModifier * (1 - cover) * movementModifier * fatigueModifier * precisionModifier, 0.02, 0.98);
      }

      function fireAt(unit, target) {
        const chance = hitChanceFor(unit, target);
        const doctrine = playerFor(unit.faction).doctrine;
        const disciplineThreshold = doctrine === "Aggressive" || playerFor(unit.faction).race === "Orks"
          ? 0.1
          : clamp(0.16 + unit.discipline * 0.18, 0.16, 0.34);
        if (chance < disciplineThreshold) {
          unit.status = "Hold fire";
          unit.lastAction = `${Math.round(chance * 100)}% shot withheld to preserve ammunition.`;
          unit.fireCd = 0.45;
          return false;
        }

        const intendedHit = battleRandom() < chance;
        const dx = target.x - unit.x;
        const dy = target.y - unit.y;
        const directDistance = Math.hypot(dx, dy) || 1;
        const perpendicular = { x: -dy / directDistance, y: dx / directDistance };
        const targetRadius = buildingCatalog[target.type] ? Math.max(target.hitbox?.w || 18, target.hitbox?.h || 18) * 0.22 : target.role === "vehicle" ? 7 : 4;
        const deviation = intendedHit ? rand(-targetRadius * 0.45, targetRadius * 0.45) : rand(targetRadius + 7, targetRadius + 28) * (battleRandom() < 0.5 ? -1 : 1);
        const aimPoint = { x: target.x + perpendicular.x * deviation, y: target.y + perpendicular.y * deviation };
        const aimDx = aimPoint.x - unit.x;
        const aimDy = aimPoint.y - unit.y;
        const aimDistance = Math.hypot(aimDx, aimDy) || 1;
        const projectileSpeed = unit.role === "vehicle" ? 300 : 220;
        state.projectiles.push({
          id: `projectile-${state.time.toFixed(2)}-${unit.id}-${unit.ammo}`,
          x: unit.x,
          y: unit.y,
          previousX: unit.x,
          previousY: unit.y,
          vx: aimDx / aimDistance * projectileSpeed,
          vy: aimDy / aimDistance * projectileSpeed,
          faction: unit.faction,
          shooterId: unit.id,
          intendedTargetId: target.id,
          damage: unit.damage,
          penetration: unit.role === "vehicle" ? 19 : unit.role === "scout" ? 9 : 12,
          suppression: unit.role === "vehicle" ? 0.28 : 0.1,
          traveled: 0,
          maxTravel: Math.min(unit.range * 1.18, aimDistance + 20),
          active: true,
          intendedHit
        });
        unit.ammo -= 1;
        unit.aimTime = 0;
        const rationing = economyFor(unit.faction).shortages.includes("ammunition");
        unit.fireCd = ((unit.role === "vehicle" ? 2.7 : 1.22) + rand(0.15, 0.5)) * (rationing ? 1.75 : 1);
        unit.status = rationing ? "Rationing fire" : "Firing";
        addUnitLog(unit, `Firing on ${unitLabel(target)} at ${Math.round(chance * 100)}% estimated hit probability.`);
        return true;
      }

      function segmentDistanceSquared(a, b, point) {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const lengthSquared = dx * dx + dy * dy || 1;
        const t = clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared, 0, 1);
        const px = a.x + dx * t;
        const py = a.y + dy * t;
        return (point.x - px) ** 2 + (point.y - py) ** 2;
      }

      function segmentIntersectsStructure(a, b, structure) {
        ensureStructureRuntime(structure);
        const minX = structure.x - structure.hitbox.w / 2;
        const maxX = structure.x + structure.hitbox.w / 2;
        const minY = structure.y - structure.hitbox.h / 2;
        const maxY = structure.y + structure.hitbox.h / 2;
        const steps = Math.max(2, Math.ceil(distance(a, b) / 5));
        for (let index = 0; index <= steps; index += 1) {
          const t = index / steps;
          const x = a.x + (b.x - a.x) * t;
          const y = a.y + (b.y - a.y) * t;
          if (x >= minX && x <= maxX && y >= minY && y <= maxY) return true;
        }
        return false;
      }

      function projectileCollision(projectile, previous, current) {
        const structures = state.structures.filter(structure => structure.alive !== false && structure.progress >= 0.2 && !areAllies(structure.faction, projectile.faction) && segmentIntersectsStructure(previous, current, structure));
        if (structures.length) return structures.sort((a, b) => distance(previous, a) - distance(previous, b))[0];
        const units = state.units.filter(unit => unit.alive && !areAllies(unit.faction, projectile.faction));
        return units
          .filter(unit => segmentDistanceSquared(previous, current, unit) <= (unit.role === "vehicle" ? 8 : 4.5) ** 2)
          .sort((a, b) => distance(previous, a) - distance(previous, b))[0] || null;
      }

      function applySuppression(point, faction, intensity) {
        for (const unit of state.units) {
          if (!unit.alive || areAllies(unit.faction, faction)) continue;
          const d = distance(point, unit);
          if (d > 34) continue;
          unit.suppression = clamp((unit.suppression || 0) + intensity * Math.exp(-d / 18), 0, 1);
          unit.morale = clamp(unit.morale - intensity * 0.035, 0, 1);
        }
      }

      function woundStateFor(unit) {
        const ratio = unit.hp / Math.max(1, unit.maxHp);
        if (ratio <= 0) return "Dead";
        if (ratio < 0.16) return "Incapacitated";
        if (ratio < 0.32) return "Critically wounded";
        if (ratio < 0.58) return "Wounded";
        if (ratio < 0.82) return "Lightly wounded";
        return "Healthy";
      }

      function applyProjectileImpact(projectile, target) {
        applySuppression(target || projectile, projectile.faction, projectile.suppression);
        if (!target) return;
        const shooter = state.units.find(unit => unit.id === projectile.shooterId);
        if (buildingCatalog[target.type]) {
          const armor = buildingCatalog[target.type].military * 1.8 + 5;
          const penetrationChance = clamp(0.28 + (projectile.penetration - armor) / 24, 0.06, 0.96);
          const penetrated = battleRandom() < penetrationChance;
          target.hp -= projectile.damage * (penetrated ? rand(0.72, 1.18) : 0.12);
          target.condition = clamp(target.hp / target.maxHp, 0.04, 1);
          if (target.hp <= 0) destroyStructure(target, shooter);
          else if (target.hp < target.maxHp * 0.28 && !target.criticalReported) {
            target.criticalReported = true;
            incident(`${unitLabel(target)} collision box is critical at ${Math.round(target.condition * 100)}% HP.`, target.id, "warning");
          }
          return;
        }

        const zones = ["head", "chest", "chest", "leftArm", "rightArm", "leftLeg", "rightLeg"];
        const zone = zones[Math.floor(battleRandom() * zones.length)];
        const protection = target.armorProtection || 8;
        const penetrationChance = clamp(0.3 + (projectile.penetration - protection) / 20, 0.04, 0.97);
        const penetrated = battleRandom() < penetrationChance;
        const zoneMultiplier = zone === "head" ? 1.55 : zone === "chest" ? 1.15 : zone.includes("Leg") ? 0.82 : 0.72;
        const damage = projectile.damage * zoneMultiplier * (penetrated ? rand(0.76, 1.18) : 0.14);
        target.hp -= damage;
        target.bodyZones[zone] = clamp((target.bodyZones[zone] || 1) - damage / target.maxHp * 1.8, 0, 1);
        target.bleeding = clamp((target.bleeding || 0) + (penetrated ? damage / target.maxHp * 0.42 : 0.01), 0, 0.55);
        target.injuries += penetrated ? 1 : 0;
        target.morale = clamp(target.morale - 0.035 - (target.suppression || 0) * 0.04, 0, 1);
        if (target.vehicleSystems && penetrated) {
          const systems = Object.keys(target.vehicleSystems);
          const system = systems[Math.floor(battleRandom() * systems.length)];
          target.vehicleSystems[system] = clamp(target.vehicleSystems[system] - damage / target.maxHp * 1.6, 0, 1);
          if (system === "tracks" && target.vehicleSystems[system] < 0.25) target.speed *= 0.45;
          if (system === "mainGun" && target.vehicleSystems[system] < 0.25) target.damage *= 0.45;
        }
        target.woundState = woundStateFor(target);
        if (target.hp <= 0) {
          target.hp = 0;
          target.alive = false;
          target.status = "Killed";
          if (shooter) {
            shooter.kills += 1;
            shooter.memories.push(`Defeated ${unitLabel(target)} with a ${zone} hit.`);
          }
          state.casualties[target.faction] += 1;
          incident(`${unitLabel(target)} was killed by a ${zone} impact. Squad health recalculated.`, target.id, "critical");
        } else if (target.hp < target.maxHp * 0.3) {
          target.retreating = true;
          target.status = target.woundState;
          incident(`${unitLabel(target)} is ${target.woundState.toLowerCase()} after a ${zone} hit.`, target.id, "warning");
        }
      }

      function updateProjectiles(dt) {
        for (const projectile of state.projectiles) {
          if (!projectile.active) continue;
          const previous = { x: projectile.x, y: projectile.y };
          projectile.previousX = projectile.x;
          projectile.previousY = projectile.y;
          projectile.x += projectile.vx * dt;
          projectile.y += projectile.vy * dt;
          const current = { x: projectile.x, y: projectile.y };
          projectile.traveled += distance(previous, current);
          const collision = projectileCollision(projectile, previous, current);
          if (collision) {
            projectile.x = collision.x;
            projectile.y = collision.y;
            projectile.active = false;
            applyProjectileImpact(projectile, collision);
          } else if (projectile.traveled >= projectile.maxTravel || projectile.x < 0 || projectile.x > VW || projectile.y < 0 || projectile.y > VH) {
            projectile.active = false;
            applyProjectileImpact(projectile, null);
          }
        }
        state.projectiles = state.projectiles.filter(projectile => projectile.active);
      }

      function destroyStructure(structure, attacker = null) {
        ensureStructureRuntime(structure);
        if (structure.alive === false) return;
        structure.hp = 0;
        structure.condition = 0.04;
        structure.alive = false;
        structure.destroyedAt = state.time;
        const economy = economyFor(structure.faction);
        const capacity = economyCapacity(structure.faction);
        let lost = 0;
        let salvaged = 0;
        for (const [key, localCapacity] of Object.entries(buildingCatalog[structure.type]?.storage || {})) {
          const exposed = Math.min(economy.inventory[key] || 0, (economy.inventory[key] || 0) * localCapacity / Math.max(1, capacity[key] || localCapacity));
          const recovered = exposed * 0.25;
          economy.inventory[key] = Math.max(0, (economy.inventory[key] || 0) - exposed + recovered);
          lost += exposed - recovered;
          salvaged += recovered;
        }
        for (const [key, amount] of Object.entries(structure.inventory || {})) {
          const recovered = amount * 0.25;
          economy.inventory[key] = (economy.inventory[key] || 0) + recovered;
          lost += amount - recovered;
          salvaged += recovered;
        }
        structure.inventory = {};
        syncLegacyResources(structure.faction);
        rebuildRoadNetwork();
        if (attacker) attacker.kills += 1;
        incident(`${unitLabel(structure)} destroyed · ${Math.round(lost)} stock lost, ${Math.round(salvaged)} salvaged.`, attacker?.id || structure.id, "critical");
      }

      function updateMedic(unit, dt) {
        const patient = nearestAlly(unit, ally => ally.hp < ally.maxHp * 0.72, 110);
        if (!patient) return false;
        unit.medicalReserve ??= 2;
        if (unit.medicalReserve <= 0) {
          requestUnitResupply(unit);
          unit.status = "Awaiting medical convoy";
          return true;
        }
        if (distance(unit, patient) > 14) moveToward(unit, patient, dt, 1.05);
        else {
          patient.hp = clamp(patient.hp + dt * 3, 0, patient.maxHp * 0.82);
          patient.morale = clamp(patient.morale + dt * 0.012, 0, 1);
          patient.bleeding = clamp((patient.bleeding || 0) - dt * 0.1, 0, 0.55);
          patient.woundState = woundStateFor(patient);
          unit.medicalReserve = Math.max(0, unit.medicalReserve - dt * 0.08);
        }
        unit.status = distance(unit, patient) > 14 ? "Responding" : "Healing";
        unit.lastAction = `${unit.status} ${unitLabel(patient)}.`;
        return true;
      }

      function updateEngineer(unit, dt) {
        const damaged = state.structures
          .filter(item => areAllies(item.faction, unit.faction) && item.progress >= 1 && item.condition < 0.9)
          .sort((a, b) => distance(unit, a) - distance(unit, b))[0];
        if (!damaged || distance(unit, damaged) > 120) return false;
        if (distance(unit, damaged) > 13) moveToward(unit, damaged, dt);
        else {
          ensureStructureRuntime(damaged);
          const factor = insideSupplyRadius(damaged, unit.faction) ? 1 : 0.45;
          damaged.hp = clamp(damaged.hp + dt * 10 * factor, 0, damaged.maxHp);
          damaged.condition = damaged.hp / damaged.maxHp;
        }
        unit.status = "Repairing";
        unit.lastAction = `Repairing allied ${buildingCatalog[damaged.type]?.label || "structure"}.`;
        return true;
      }

      function updateUnit(unit, dt) {
        if (!unit.alive) return;
        unit.fireCd -= dt;
        unit.healCd -= dt;
        unit.fatigue = clamp(unit.fatigue + dt * 0.0009, 0, 0.94);
        unit.suppression = clamp((unit.suppression || 0) - dt * (0.07 + unit.suppressionResistance * 0.08), 0, 1);
        unit.morale = clamp(unit.morale - unit.suppression * dt * 0.018, 0, 1);
        if ((unit.bleeding || 0) > 0) {
          unit.hp = Math.max(0, unit.hp - unit.bleeding * dt * 2.2);
          unit.bleeding = clamp(unit.bleeding - dt * 0.002, 0, 0.55);
          unit.woundState = woundStateFor(unit);
          if (unit.hp <= 0) {
            unit.alive = false;
            unit.status = "Died from wounds";
            state.casualties[unit.faction] += 1;
            incident(`${unitLabel(unit)} died from untreated bleeding.`, unit.id, "critical");
            return;
          }
        }

        if (unit.role === "builder") {
          updateBuilder(unit, dt);
          return;
        }

        if (unit.hp < unit.maxHp * 0.3 || unit.morale < 0.23 || unit.ammo <= 0) unit.retreating = true;
        if (unit.retreating) {
          const base = baseFor(unit.faction);
          moveToward(unit, base, dt, 1.12);
          unit.status = unit.hp < unit.maxHp * 0.3 ? "Retreating" : unit.ammo <= 0 ? "Reloading" : "Regrouping";
          unit.lastAction = `${unit.status} toward the emergent base.`;
          if (distance(unit, base) < 44) {
            if (unit.ammo <= 0) requestUnitResupply(unit);
            unit.morale = clamp(unit.morale + dt * 0.03, 0, 1);
            unit.fatigue = clamp(unit.fatigue - dt * 0.02, 0, 1);
            unit.hp = clamp(unit.hp + dt * 0.35, 0, unit.maxHp * 0.56);
            if (unit.morale > 0.5 && unit.ammo > 0 && unit.hp > unit.maxHp * 0.38) unit.retreating = false;
          }
          return;
        }

        if (unit.role === "medic" && updateMedic(unit, dt)) return;
        if (unit.role === "engineer" && updateEngineer(unit, dt)) return;

        unit.sensorCooldown = (unit.sensorCooldown || 0) - dt;
        let target = null;
        if (unit.sensorCooldown <= 0) {
          target = findTarget(unit);
          unit.cachedTargetId = target?.id || null;
          unit.sensorCooldown = state.speed >= 8 ? (unit.role === "scout" ? 4 : 6) : (unit.role === "scout" ? 0.2 : 0.4);
        } else if (unit.cachedTargetId) {
          target = state.units.find(candidate => candidate.id === unit.cachedTargetId && candidate.alive)
            || state.structures.find(candidate => candidate.id === unit.cachedTargetId && candidate.alive !== false) || null;
        }
        if (target) {
          unit.targetId = target.id;
          if (distance(unit, target) <= unit.range * 0.92) {
            unit.aimTime = clamp((unit.aimTime || 0) + dt * (0.8 + unit.reflexes), 0, 2.5);
            if (unit.fireCd <= 0 && unit.ammo > 0) fireAt(unit, target);
            else unit.status = "Suppressing";
          } else {
            unit.aimTime = 0;
            moveToward(unit, target, dt, unit.aggression > 0.52 ? 1.08 : 0.88);
            unit.status = "Closing";
          }
          return;
        }

        const squad = unit.squadId ? squadFor(unit.squadId) : null;
        unit.aimTime = 0;
        if (squad && squad.leaderId !== unit.id) {
          const leader = state.units.find(candidate => candidate.id === squad.leaderId && candidate.alive);
          if (leader && distance(unit, leader) > 38) {
            moveToward(unit, leader, dt, 1.08);
            unit.status = "Maintaining squad";
            return;
          }
        }
        unit.objectiveCooldown = (unit.objectiveCooldown || 0) - dt;
        if (!unit.cachedObjective || unit.objectiveCooldown <= 0) {
          unit.cachedObjective = objectiveFor(unit);
          unit.objectiveCooldown = state.speed >= 8 ? 10 : 1.2;
        }
        const objective = unit.cachedObjective;
        if (distance(unit, objective) > 18) {
          moveToward(unit, objective, dt);
          unit.status = unit.lightPlan || "Advancing";
          unit.lastAction = `${unit.lightPlan || "Advancing"} through ${terrainAt(unit).name}.`;
        } else {
          unit.status = "Holding";
          unit.lastAction = "Watching assigned sector.";
          unit.fatigue = clamp(unit.fatigue - dt * 0.0015, 0, 1);
        }
      }

      function roadPathBetween(start, end, seed = 0) {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const length = Math.hypot(dx, dy) || 1;
        const px = -dy / length;
        const py = dx / length;
        const bend = ((seed * 37) % 31 - 15) * Math.min(1, length / 180);
        const points = [
          { x: start.x, y: start.y },
          { x: start.x + dx * 0.34 + px * bend, y: start.y + dy * 0.34 + py * bend },
          { x: start.x + dx * 0.68 - px * bend * 0.7, y: start.y + dy * 0.68 - py * bend * 0.7 },
          { x: end.x, y: end.y }
        ];
        const blocked = points.slice(1, -1).some(point => ["deepwater", "river", "lava", "cliff"].includes(terrainAt(point).type));
        if (blocked) {
          points[1].x = clamp(points[1].x + px * 55, 20, VW - 20);
          points[1].y = clamp(points[1].y + py * 55, 20, VH - 20);
          points[2].x = clamp(points[2].x + px * 55, 20, VW - 20);
          points[2].y = clamp(points[2].y + py * 55, 20, VH - 20);
        }
        return points;
      }

      function rebuildRoadNetwork() {
        const roads = [];
        let serial = 1;
        for (const player of state.players) {
          const nodes = [player.base, ...state.structures
            .filter(item => item.faction === player.id && item.progress >= 1 && item.alive !== false)
            .sort((a, b) => a.createdAt - b.createdAt)];
          for (let index = 1; index < nodes.length; index += 1) {
            const node = nodes[index];
            const previous = nodes.slice(0, index).sort((a, b) => distance(a, node) - distance(b, node))[0];
            roads.push({ id: `road-${serial++}`, faction: player.id, kind: "service road", points: roadPathBetween(previous, node, serial + player.index * 13) });
          }
          const partner = state.tradePartners?.find(item => item.faction === player.id);
          if (partner?.established) roads.push({ id: `road-${serial++}`, faction: player.id, kind: "trade route", points: roadPathBetween(partner, player.base, serial + 91) });
        }
        state.roads = roads.slice(0, 46);
      }

      function routeDestination(convoy) {
        if (convoy.destinationKind === "unit") return state.units.find(unit => unit.id === convoy.destinationId && unit.alive) || convoy.destination;
        if (convoy.destinationKind === "structure") return state.structures.find(item => item.id === convoy.destinationId && item.alive !== false) || convoy.destination;
        return convoy.destination;
      }

      function closestStoragePoint(faction, point = baseFor(faction)) {
        const stores = state.structures.filter(item => item.faction === faction && item.progress >= 1 && item.alive !== false && (buildingCatalog[item.type]?.storage || item.type === "outpost"));
        return stores.sort((a, b) => distance(a, point) - distance(b, point))[0] || baseFor(faction);
      }

      function createConvoy(faction, cargo, origin, destination, options = {}) {
        if (state.convoys.filter(item => !item.finished).length >= 24) return null;
        const validCargo = Object.fromEntries(Object.entries(cargo).filter(([, value]) => value > 0.05));
        if (!Object.keys(validCargo).length) return null;
        const player = playerFor(faction);
        const defaultMode = player.race === "Orks" ? "Wartrukk" : player.faction === "Space Marines" ? "Rhino transport" : player.race === "Imperium" ? "supply truck" : "cargo carrier";
        const convoy = {
          id: `convoy-${state.nextConvoyId++}`,
          name: options.name || `${economyResourceLabels[Object.keys(validCargo)[0]] || "Supply"} Convoy #${state.nextConvoyId - 1}`,
          faction,
          cargo: validCargo,
          x: origin.x,
          y: origin.y,
          origin: { x: origin.x, y: origin.y },
          destination: { x: destination.x, y: destination.y },
          destinationKind: options.destinationKind || "store",
          destinationId: options.destinationId || null,
          route: roadPathBetween(origin, destination, state.nextConvoyId * 7),
          waypoint: 1,
          hp: options.mode === "cargo aircraft" ? 70 : 100,
          maxHp: options.mode === "cargo aircraft" ? 70 : 100,
          mode: options.mode || defaultMode,
          status: options.status || "Delivering",
          escortRequested: false,
          reroutes: 0,
          trade: Boolean(options.trade),
          createdAt: state.time,
          finished: false
        };
        state.convoys.push(convoy);
        return convoy;
      }

      function requestUnitResupply(unit) {
        const economy = economyFor(unit.faction);
        const key = `resupply-${unit.id}`;
        if (economy.queue.some(item => item.key === key && !["Delivered", "Denied"].includes(item.status))) return;
        economy.queue.push({
          id: `${unit.faction}-request-${economy.requestSerial++}`,
          key,
          type: "resupply",
          label: `Resupply ${unit.name}`,
          priority: unit.ammo <= 0 ? 96 : 82,
          status: "Requested",
          targetId: unit.id,
          createdAt: state.time
        });
      }

      function addEconomyRequest(faction, key, type, label, priority, extra = {}) {
        const economy = economyFor(faction);
        if (economy.queue.some(item => item.key === key && !["Delivered", "Denied", "Complete"].includes(item.status))) return;
        economy.queue.push({ id: `${faction}-request-${economy.requestSerial++}`, key, type, label, priority, status: "Requested", createdAt: state.time, ...extra });
      }

      function refreshEconomyRequests(player) {
        const economy = economyFor(player.id);
        const capacity = economyCapacity(player.id);
        economy.shortages = economyResourceKeys.filter(key => (economy.inventory[key] || 0) < (capacity[key] || 1) * 0.16);
        if (economy.shortages.includes("ammunition")) addEconomyRequest(player.id, "emergency-ammo", "emergency", "Emergency ammunition convoy", 100, { resource: "ammunition" });
        if (economy.shortages.includes("fuel")) addEconomyRequest(player.id, "emergency-fuel", "emergency", "Refuel tanks and transports", 94, { resource: "fuel" });
        const damagedHq = state.structures.find(item => item.faction === player.id && item.type === "outpost" && item.alive !== false && item.condition < 0.65);
        if (damagedHq) addEconomyRequest(player.id, "repair-hq", "repair", "Repair headquarters", 100, { targetId: damagedHq.id });
        const hasType = type => state.structures.some(item => item.faction === player.id && item.type === type && item.alive !== false);
        if (!hasType("warehouse")) addEconomyRequest(player.id, "build-warehouse", "build", "Build warehouse", 78, { buildType: "warehouse" });
        if (!hasType("barracks")) addEconomyRequest(player.id, "build-barracks", "build", "Build barracks", 74, { buildType: "barracks" });
        if (economy.shortages.includes("food") && !hasType("farm")) addEconomyRequest(player.id, "build-farm", "build", "Build supply farm", 86, { buildType: "farm" });
        if (economy.shortages.includes("materials") && !hasType("mine")) addEconomyRequest(player.id, "build-mine", "build", "Build material mine", 88, { buildType: "mine" });
        const partner = state.tradePartners.find(item => item.faction === player.id);
        if (partner && !partner.established && hasType("outpost") && hasType("warehouse")) {
          addEconomyRequest(player.id, `establish-${partner.id}`, "trade", `Establish route with ${partner.name}`, 93, { partnerId: partner.id });
        }
        const living = state.units.filter(unit => unit.alive && unit.faction === player.id).length;
        const unitCap = state.players.length > 8 ? 8 : state.players.length > 4 ? 12 : 18;
        if (living < unitCap) addEconomyRequest(player.id, "train-line", "train", "Train line infantry", 70);
        if (player.race === "Imperium" && player.faction === "Space Marines" && living < Math.max(4, unitCap - 1)) addEconomyRequest(player.id, "drop-pod", "dropPod", "Orbital drop-pod reinforcement", 88);
        economy.emergency = economy.shortages.length
          ? `${economyResourceLabels[economy.shortages[0]]} below 16% · conserve fire and protect routes`
          : "Supply stable · reserves maintained";
        economy.officers.quartermaster = economy.shortages.length ? `Ordering ${economy.shortages.map(key => economyResourceLabels[key]).join(", ")}` : "Maintaining reserve targets";
        economy.officers.supplyOfficer = state.convoys.some(item => item.faction === player.id && item.status === "Awaiting escort") ? "Assigning escort to blocked convoy" : "Rerouting physical deliveries";
        economy.officers.factoryOverseer = economy.shortages.includes("ammunition") ? "Increasing ammunition production" : "Balancing production inputs";
      }

      function startDropPod(player, request) {
        const economy = economyFor(player.id);
        const bay = state.structures.find(item => item.faction === player.id && item.type === "dropbay" && item.progress >= 1 && item.alive !== false);
        const costs = { requisition: 28, materials: 16, fuel: 8, ammunition: 12 };
        economy.availablePods ??= 2;
        if (!bay || economy.availablePods < 1) {
          request.status = "Delayed · launch bay or pod unavailable";
          if (!bay && !economy.approvedBuilds.includes("dropbay")) economy.approvedBuilds.push("dropbay");
          return false;
        }
        const bayReady = Object.entries(costs).every(([key, value]) => (bay.inventory[key] || 0) >= value);
        if (!bayReady) {
          if (state.convoys.some(item => !item.finished && item.destinationId === bay.id && item.dropPodSupply)) {
            request.status = "Approved · launch materials in transit";
            return false;
          }
          const available = Object.entries(costs).every(([key, value]) => (economy.inventory[key] || 0) >= value);
          if (!available) {
            request.status = "Delayed · resources unavailable";
            return false;
          }
          Object.entries(costs).forEach(([key, value]) => { economy.inventory[key] -= value; });
          const convoy = createConvoy(player.id, costs, closestStoragePoint(player.id, bay), bay, { destinationKind: "structure", destinationId: bay.id, name: `Drop Pod Preparation #${state.nextConvoyId}` });
          if (convoy) convoy.dropPodSupply = true;
          request.status = "Approved · launch materials in transit";
          return false;
        }
        Object.entries(costs).forEach(([key, value]) => { bay.inventory[key] -= value; });
        economy.availablePods -= 1;
        const frontline = state.territories.filter(item => item.owner === player.id).sort((a, b) => distance(territoryCenter(b), player.base) - distance(territoryCenter(a), player.base))[0];
        const destination = frontline ? territoryCenter(frontline) : player.base;
        state.dropPods.push({
          id: `drop-pod-${state.nextDropPodId++}`,
          faction: player.id,
          requestId: request.id,
          stage: "Approved",
          stageIndex: 0,
          stageEndsAt: state.time + 4,
          destination: { x: destination.x, y: destination.y },
          x: destination.x,
          y: -40,
          deployed: false
        });
        request.status = "Approved · orbital command scheduling";
        syncLegacyResources(player.id);
        return true;
      }

      function processEconomyRequests(player) {
        const economy = economyFor(player.id);
        const reserve = economy.personality === "Frugal" ? 34 : economy.personality === "Aggressive" ? 8 : 20;
        economy.queue.sort((a, b) => b.priority - a.priority || a.createdAt - b.createdAt);
        for (const request of economy.queue.filter(item => !["Delivered", "Denied", "Complete"].includes(item.status)).slice(0, 2)) {
          if (request.type === "build") {
            const existing = state.structures.find(item => item.faction === player.id && item.type === request.buildType && item.alive !== false);
            if (existing) {
              request.status = existing.progress >= 1 ? "Complete" : `Approved · construction ${Math.round(existing.progress * 100)}%`;
              continue;
            }
            if (!economy.approvedBuilds.includes(request.buildType)) economy.approvedBuilds.push(request.buildType);
            request.status = economy.inventory.requisition > reserve ? "Approved · builder assigned" : "Delayed · reserve protected";
          } else if (request.type === "resupply") {
            const unit = state.units.find(item => item.id === request.targetId && item.alive);
            if (!unit) { request.status = "Denied"; continue; }
            if (state.convoys.some(item => !item.finished && item.destinationId === unit.id)) { request.status = "Approved · convoy en route"; continue; }
            const ammo = Math.min(12, economy.inventory.ammunition || 0);
            const medical = Math.min(3, economy.inventory.medical || 0);
            const food = Math.min(4, economy.inventory.food || 0);
            const fuel = unit.role === "vehicle" ? Math.min(10, economy.inventory.fuel || 0) : 0;
            if (ammo + medical + food + fuel <= 0) { request.status = "Delayed · no stock"; continue; }
            economy.inventory.ammunition -= ammo;
            economy.inventory.medical -= medical;
            economy.inventory.food -= food;
            economy.inventory.fuel -= fuel;
            const origin = closestStoragePoint(player.id, unit);
            createConvoy(player.id, { ammunition: ammo, medical, food, fuel }, origin, unit, { destinationKind: "unit", destinationId: unit.id, name: `Frontline Resupply #${state.nextConvoyId}` });
            request.status = ammo < 8 ? "Partially fulfilled · convoy en route" : "Approved · convoy en route";
          } else if (request.type === "emergency") {
            request.status = state.convoys.some(item => item.faction === player.id && item.cargo[request.resource]) ? "Approved · convoy protected" : "Delayed · production increasing";
          } else if (request.type === "repair") {
            request.status = economy.inventory.parts >= 4 ? "Approved · engineer assigned" : "Delayed · spare parts unavailable";
          } else if (request.type === "dropPod") {
            if (!state.dropPods.some(item => item.faction === player.id && !item.deployed)) startDropPod(player, request);
          } else if (request.type === "trade") {
            const partner = state.tradePartners.find(item => item.id === request.partnerId && item.faction === player.id);
            const warehouse = state.structures.find(item => item.faction === player.id && item.type === "warehouse" && item.progress >= 1 && item.alive !== false);
            const headquarters = state.structures.find(item => item.faction === player.id && item.type === "outpost" && item.progress >= 1 && item.alive !== false);
            if (!partner || partner.established) { request.status = "Complete"; continue; }
            const eligibility = tradeRouteRules.canEstablish
              ? tradeRouteRules.canEstablish({ partner, economy, warehouse, headquarters })
              : { allowed: Boolean(warehouse && headquarters) };
            if (!eligibility.allowed && eligibility.reason === "infrastructure") { request.status = "Delayed · headquarters and warehouse required"; continue; }
            const cost = partner.establishmentCost || { influence: 40, materials: 25 };
            if (!eligibility.allowed || !Object.entries(cost).every(([key, value]) => (economy.inventory[key] || 0) >= value)) {
              request.status = "Delayed · diplomatic materials unavailable";
              continue;
            }
            Object.entries(cost).forEach(([key, value]) => { economy.inventory[key] -= value; });
            if (tradeRouteRules.activate) tradeRouteRules.activate(partner, state.time, player.index);
            else {
              partner.established = true;
              partner.establishedAt = state.time;
              partner.nextDispatch = state.time + 28 + player.index * 4;
            }
            request.status = "Complete";
            rebuildRoadNetwork();
            incident(`${player.faction} established a physical trade route with ${partner.name}.`, player.base.id, "info");
          } else if (request.type === "train") {
            const barracks = state.structures.find(item => item.faction === player.id && item.type === "barracks" && item.progress >= 1 && item.alive !== false);
            const trainingCargo = { requisition: 15, food: 3, ammunition: 4, medical: 1 };
            if (!barracks) { request.status = "Delayed · barracks unavailable"; continue; }
            const ready = Object.entries(trainingCargo).every(([key, value]) => (barracks.inventory[key] || 0) >= value);
            if (ready) { request.status = "Approved · squad preparing"; continue; }
            if (state.convoys.some(item => !item.finished && item.destinationId === barracks.id && item.training)) { request.status = "Approved · training supplies en route"; continue; }
            const canShip = Object.entries(trainingCargo).every(([key, value]) => (economy.inventory[key] || 0) >= value);
            if (!canShip) { request.status = "Delayed · supplies unavailable"; continue; }
            Object.entries(trainingCargo).forEach(([key, value]) => { economy.inventory[key] -= value; });
            const convoy = createConvoy(player.id, trainingCargo, closestStoragePoint(player.id, barracks), barracks, { destinationKind: "structure", destinationId: barracks.id, name: `Barracks Supply #${state.nextConvoyId}` });
            if (convoy) convoy.training = true;
            request.status = "Approved · training supplies en route";
          }
        }
        economy.queue = economy.queue.filter(item => state.time - item.createdAt < 150 || !["Delivered", "Denied", "Complete"].includes(item.status)).slice(0, 12);
      }

      function dispatchStructureLogistics(player, structure) {
        const spec = buildingCatalog[structure.type];
        if (!spec || structure.progress < 1 || structure.alive === false) return;
        ensureStructureRuntime(structure);
        const economy = economyFor(player.id);
        const consumes = { parts: 0.25, ...(spec.consumes || {}) };
        const inbound = state.convoys.some(item => !item.finished && item.destinationId === structure.id);
        if (!inbound) {
          const needed = {};
          for (const [key, rate] of Object.entries(consumes)) {
            const desired = rate * 3;
            const amount = Math.min(Math.max(0, desired - (structure.inventory[key] || 0)), economy.inventory[key] || 0);
            if (amount > 0.1) needed[key] = amount;
          }
          if (Object.keys(needed).length) {
            Object.entries(needed).forEach(([key, value]) => { economy.inventory[key] -= value; });
            const origin = closestStoragePoint(player.id, structure);
            createConvoy(player.id, needed, origin, structure, { destinationKind: "structure", destinationId: structure.id, name: `Input Delivery #${state.nextConvoyId}` });
          }
        }
        const canRun = Object.entries(consumes).every(([key, rate]) => (structure.inventory[key] || 0) >= rate);
        if (canRun) {
          Object.entries(consumes).forEach(([key, rate]) => { structure.inventory[key] = Math.max(0, (structure.inventory[key] || 0) - rate); });
          Object.entries(spec.produces || {}).forEach(([key, rate]) => { structure.inventory[key] = (structure.inventory[key] || 0) + rate * clamp(structure.condition, 0.2, 1); });
          if (structure.type === "researchcenter") {
            economy.research ||= { level: 0, progress: 0, status: "Researching" };
            economy.research.progress += 7 * clamp(structure.condition, 0.2, 1);
            economy.research.status = `Research level ${economy.research.level} · ${Math.floor(economy.research.progress)}%`;
            if (economy.research.progress >= 100) {
              economy.research.progress -= 100;
              economy.research.level += 1;
              economy.research.status = `Research level ${economy.research.level} complete`;
              economy.officers.factoryOverseer = `${factionBuildingLabel(player.id, "researchcenter")} completed research level ${economy.research.level}`;
              incident(`${player.faction} completed research level ${economy.research.level}; future production priorities were recalculated.`, structure.id, "info");
            }
          }
        }
        const output = {};
        for (const key of Object.keys(spec.produces || {})) {
          const amount = structure.inventory[key] || 0;
          if (amount >= 4) output[key] = amount;
        }
        if (Object.keys(output).length && !state.convoys.some(item => !item.finished && item.originId === structure.id)) {
          Object.keys(output).forEach(key => { structure.inventory[key] -= output[key]; });
          const destination = closestStoragePoint(player.id, structure);
          if (destination.id === structure.id || distance(destination, structure) < 3) {
            const capacity = economyCapacity(player.id);
            Object.entries(output).forEach(([key, value]) => { economy.inventory[key] = clamp((economy.inventory[key] || 0) + value, 0, capacity[key] || 999); });
          } else {
            const convoy = createConvoy(player.id, output, structure, destination, { destinationKind: "store", name: `Production Haul #${state.nextConvoyId}` });
            if (convoy) convoy.originId = structure.id;
          }
        }
      }

      function updateUnitConsumption(player) {
        const economy = economyFor(player.id);
        const needsFood = !["Necrons", "Tyranids"].includes(player.race);
        for (const unit of state.units.filter(item => item.alive && item.faction === player.id)) {
          unit.rations ??= 6;
          unit.medicalReserve ??= 2;
          unit.fuelReserve ??= unit.role === "vehicle" ? 12 : 0;
          if (needsFood) unit.rations = Math.max(0, unit.rations - 0.28);
          if (unit.role === "vehicle" && ["Advancing", "Closing", "Retreating"].includes(unit.status)) unit.fuelReserve = Math.max(0, unit.fuelReserve - 0.45);
          if (unit.rations < 1.2 || unit.medicalReserve < 0.4 || unit.role === "vehicle" && unit.fuelReserve < 2 || unit.ammo < unit.maxAmmo * 0.18) requestUnitResupply(unit);
          if (unit.rations <= 0) unit.morale = clamp(unit.morale - 0.035, 0.12, 1);
          if (unit.role === "vehicle" && unit.fuelReserve <= 0) unit.fatigue = clamp(unit.fatigue + 0.08, 0, 0.96);
        }
      }

      function dispatchTradeConvoys(player) {
        const partner = state.tradePartners.find(item => item.faction === player.id);
        if (!partner?.established || state.time < partner.nextDispatch || state.convoys.some(item => !item.finished && item.trade && item.faction === player.id)) return;
        const destination = closestStoragePoint(player.id, partner);
        createConvoy(player.id, partner.exports, partner, destination, { trade: true, name: `${partner.name} Trade #${state.nextConvoyId}` });
        partner.nextDispatch = state.time + 46 + player.index * 2;
      }

      function economyTick() {
        const unitCap = state.players.length > 8 ? 8 : state.players.length > 4 ? 12 : 18;
        for (const player of state.players) {
          const economy = economyFor(player.id);
          refreshEconomyRequests(player);
          processEconomyRequests(player);
          for (const structure of state.structures.filter(item => item.faction === player.id)) dispatchStructureLogistics(player, structure);
          updateUnitConsumption(player);
          dispatchTradeConvoys(player);
          const barracks = state.structures.find(item => item.faction === player.id && item.type === "barracks" && item.progress >= 1 && item.alive !== false);
          const living = state.units.filter(unit => unit.alive && unit.faction === player.id).length;
          const trainCost = { requisition: 15, food: 3, ammunition: 4, medical: 1 };
          const canTrain = barracks && Object.entries(trainCost).every(([key, value]) => (barracks.inventory[key] || 0) >= value);
          if (barracks && living < unitCap && canTrain && state.time >= state.nextTrain[player.id]) {
            Object.entries(trainCost).forEach(([key, value]) => { barracks.inventory[key] -= value; });
            const trainedCount = Math.max(0, state.nextUnitIndex[player.id] - 1);
            const role = trainingRoles[trainedCount % trainingRoles.length];
            const unit = makeUnit(player.id, role, `${factionBuildingLabel(player.id, "barracks")} reinforcement wave`);
            state.units.push(unit);
            const hasSupply = insideSupplyRadius(unit, player.id);
            state.nextTrain[player.id] = state.time + (player.doctrine === "Aggressive" ? 7 : 10) + (hasSupply ? 0 : 6);
            const request = economy.queue.find(item => item.key === "train-line");
            if (request) request.status = "Complete";
            incident(`${player.faction} trained ${unitLabel(unit)} after physical supplies reached the barracks.`, unit.id, "info");
            rebuildUnitSelect();
          }
          if ((economy.availablePods || 0) < 2 && economy.inventory.parts >= 8 && economy.inventory.materials >= 6 && state.structures.some(item => item.faction === player.id && item.type === "dropbay" && item.alive !== false)) {
            economy.inventory.parts -= 8;
            economy.inventory.materials -= 6;
            economy.availablePods = (economy.availablePods || 0) + 1;
          }
          autoFormSquads(player.id);
          syncLegacyResources(player.id);
        }
      }

      function deliverConvoy(convoy) {
        const economy = economyFor(convoy.faction);
        if (convoy.destinationKind === "unit") {
          const unit = state.units.find(item => item.id === convoy.destinationId && item.alive);
          if (unit) {
            unit.ammo = clamp(unit.ammo + (convoy.cargo.ammunition || 0) * 2, 0, unit.maxAmmo);
            unit.medicalReserve = (unit.medicalReserve || 0) + (convoy.cargo.medical || 0);
            unit.rations = (unit.rations || 0) + (convoy.cargo.food || 0);
            unit.fuelReserve = (unit.fuelReserve || 0) + (convoy.cargo.fuel || 0);
            economy.queue.filter(item => item.targetId === unit.id).forEach(item => { item.status = "Delivered"; });
          }
        } else if (convoy.destinationKind === "structure") {
          const structure = state.structures.find(item => item.id === convoy.destinationId && item.alive !== false);
          if (structure) Object.entries(convoy.cargo).forEach(([key, value]) => { structure.inventory[key] = (structure.inventory[key] || 0) + value; });
        } else {
          const capacity = economyCapacity(convoy.faction);
          Object.entries(convoy.cargo).forEach(([key, value]) => { economy.inventory[key] = clamp((economy.inventory[key] || 0) + value, 0, capacity[key] || 999); });
        }
        convoy.status = "Delivered";
        convoy.finished = true;
        convoy.finishedAt = state.time;
        syncLegacyResources(convoy.faction);
      }

      function updateConvoys(dt) {
        for (const convoy of state.convoys) {
          if (convoy.finished) continue;
          const destination = routeDestination(convoy);
          if (!destination) { convoy.status = "Destination lost"; convoy.finished = true; continue; }
          convoy.destination = { x: destination.x, y: destination.y };
          const waypoint = convoy.route[convoy.waypoint] || destination;
          const hostile = state.units.filter(unit => unit.alive && !areAllies(unit.faction, convoy.faction) && distance(unit, convoy) < 24);
          const escorts = state.units.filter(unit => unit.alive && areAllies(unit.faction, convoy.faction) && unit.role === "vehicle" && distance(unit, convoy) < 34).length;
          convoy.escorts = escorts;
          if (hostile.length) {
            convoy.hp -= dt * Math.max(2, hostile.length * 2.2) / Math.max(1, escorts + 1);
            if (!escorts) {
              convoy.status = "Awaiting escort";
              convoy.escortRequested = true;
            } else convoy.status = `Under attack · ${escorts} escort`;
          } else if (convoy.status === "Awaiting escort" && escorts) convoy.status = "Escort arrived · continuing";
          if (convoy.hp <= 0) {
            convoy.finished = true;
            convoy.status = "Destroyed";
            convoy.finishedAt = state.time;
            incident(`${convoy.name} was destroyed; remaining cargo lost on the route.`, null, "critical");
            continue;
          }
          const terrainType = terrainAt(waypoint).type;
          if (["deepwater", "lava", "cliff"].includes(terrainType) && convoy.mode !== "cargo aircraft") {
            convoy.reroutes += 1;
            convoy.status = convoy.reroutes >= 2 ? "Road unavailable · cargo aircraft requested" : "Route blocked · rerouting";
            if (convoy.reroutes >= 2) convoy.mode = "cargo aircraft";
            convoy.route = roadPathBetween(convoy, destination, state.nextConvoyId + convoy.reroutes * 19);
            convoy.waypoint = 1;
            continue;
          }
          const dx = waypoint.x - convoy.x;
          const dy = waypoint.y - convoy.y;
          const d = Math.hypot(dx, dy) || 1;
          const speed = convoy.mode === "cargo aircraft" ? 34 : 13;
          const hold = convoy.status === "Awaiting escort" ? 0.24 : 1;
          convoy.x += dx / d * speed * hold * dt;
          convoy.y += dy / d * speed * hold * dt;
          if (d < 7) convoy.waypoint += 1;
          if (distance(convoy, destination) < 9) deliverConvoy(convoy);
          else if (convoy.waypoint >= convoy.route.length) {
            convoy.route = roadPathBetween(convoy, destination, state.nextConvoyId + convoy.reroutes * 23);
            convoy.waypoint = 1;
          }
        }
        state.convoys = state.convoys.filter(item => !item.finished || state.time - (item.finishedAt || state.time) < 20);
      }

      function updateDropPods() {
        const stages = ["Approved", "Preparing pod", "Launch scheduled", "Launched", "Impact", "Deployed"];
        const delays = [4, 6, 5, 4, 2, 999];
        for (const pod of state.dropPods) {
          if (pod.deployed || state.time < pod.stageEndsAt) continue;
          pod.stageIndex = Math.min(stages.length - 1, pod.stageIndex + 1);
          pod.stage = stages[pod.stageIndex];
          pod.stageEndsAt = state.time + delays[pod.stageIndex];
          if (pod.stage === "Launched") incident(`${playerFor(pod.faction).faction} drop pod launched toward the frontline.`, null, "info");
          if (pod.stage === "Impact") { pod.x = pod.destination.x; pod.y = pod.destination.y; }
          if (pod.stage === "Deployed") {
            pod.deployed = true;
            for (const role of ["commander", "trooper", "medic"]) {
              const unit = makeUnit(pod.faction, role, "Orbital drop pod");
              unit.x = pod.destination.x + rand(-8, 8);
              unit.y = pod.destination.y + rand(-8, 8);
              state.units.push(unit);
            }
            const request = economyFor(pod.faction).queue.find(item => item.id === pod.requestId);
            if (request) request.status = "Delivered";
            incident(`${playerFor(pod.faction).faction} drop pod impacted; three Marines deployed.`, null, "info");
            rebuildUnitSelect();
          }
        }
      }

      function territoryTick() {
        for (const territory of state.territories) territory.connected = false;
        for (const territory of state.territories) {
          if (!territory.owner) continue;
          const center = territoryCenter(territory);
          const player = playerFor(territory.owner);
          const suppliedByBase = distance(center, player.base) < 230;
          const suppliedByStructure = state.structures.some(structure =>
            structure.faction === territory.owner
            && structure.progress >= 1
            && ["outpost", "generator", "barracks"].includes(structure.type)
            && distance(center, structure) < 175
          );
          territory.connected = suppliedByBase || suppliedByStructure || !territory.supplyRequired;
        }
        for (let pass = 0; pass < 4; pass += 1) {
          for (const territory of state.territories) {
            if (!territory.owner || territory.connected) continue;
            const center = territoryCenter(territory);
            territory.connected = state.territories.some(other => {
              if (!other.connected || !other.owner) return false;
              const allied = areAllies(other.owner, territory.owner);
              const canShare = other.owner === territory.owner || (allied && (other.shareAllies || territory.shareAllies));
              return canShare && distance(center, territoryCenter(other)) < 185;
            });
          }
        }

        for (const territory of state.territories) {
          const occupants = state.units.filter(unit => unit.alive && pointInTerritory(unit, territory));
          const groups = new Map();
          for (const unit of occupants) groups.set(unit.faction, (groups.get(unit.faction) || 0) + 1);
          const dominant = [...groups.entries()].sort((a, b) => b[1] - a[1])[0];
          const ownerCount = territory.owner ? groups.get(territory.owner) || 0 : 0;
          const enemyCount = territory.owner
            ? occupants.filter(unit => !areAllies(unit.faction, territory.owner)).length
            : 0;
          if (!territory.owner && dominant && !territory.unclaimable && !territory.locked) {
            territory.owner = dominant[0];
            territory.previousOwner = "";
            territory.status = "claimed";
            territory.claimedAt = state.time;
            territory.reason = "Occupied by a unit or squad";
            incident(`${playerFor(territory.owner).faction} claimed ${territory.name} through occupation.`, null, "info");
          } else if (territory.owner && enemyCount > 0) {
            territory.status = "contested";
            if (!territory.locked && !territory.unclaimable && dominant && dominant[0] !== territory.owner && dominant[1] > ownerCount) {
              territory.pressure += dominant[1] * 5;
              if (territory.pressure >= territory.captureDifficulty) {
                territory.previousOwner = territory.owner;
                territory.owner = dominant[0];
                territory.status = "claimed";
                territory.claimedAt = state.time;
                territory.pressure = 0;
                territory.connected = false;
                territory.reason = "Enemy presence removed";
                incident(`${playerFor(territory.owner).faction} seized ${territory.name}.`, null, "critical");
              }
            }
          } else if (territory.owner) {
            territory.pressure = Math.max(0, territory.pressure - 8);
            const fortified = state.structures.some(structure =>
              structure.faction === territory.owner
              && structure.progress >= 1
              && ["bunker", "turret", "outpost"].includes(structure.type)
              && pointInTerritory(structure, territory)
            );
            if (!territory.connected) {
              territory.isolatedSince ??= state.time;
              territory.status = state.time - territory.isolatedSince > 16 ? "cut off" : "isolated";
              for (const unit of occupants.filter(unit => unit.faction === territory.owner)) {
                unit.morale = clamp(unit.morale - 0.018, 0.12, 1);
                unit.ammo = Math.max(0, unit.ammo - 1);
              }
              if (territory.canAbandon && !territory.locked && state.time - territory.isolatedSince > 34 && (state.resources[territory.owner] || 0) < 35) {
                territory.previousOwner = territory.owner;
                territory.owner = "";
                territory.status = "abandoned";
                territory.reason = "Supply recovery was not worthwhile";
              }
            } else {
              territory.isolatedSince = null;
              territory.status = fortified ? "fortified" : state.time - territory.claimedAt < 12 ? "claimed" : "controlled";
            }
          }
        }

        for (const player of state.players) {
          const completeOutposts = state.structures.filter(structure => structure.faction === player.id && structure.type === "outpost" && structure.progress >= 1);
          for (const outpost of completeOutposts) {
            if (state.territories.some(territory => territory.owner === player.id && distance(territoryCenter(territory), outpost) < 70)) continue;
            state.territories.push(createTerritory(player.id, outpost, 70, {
              name: `${player.faction} outpost`,
              status: "fortified",
              strategicValue: 72,
              defensibility: 78,
              reason: "Builder completed an outpost"
            }));
            incident(`${player.faction} established a fortified outpost territory.`, null, "info");
          }
          const ownTerritories = state.territories.filter(territory => territory.owner === player.id);
          const cooldown = player.doctrine === "Aggressive" ? 14 : player.doctrine === "Fortress" ? 28 : 20;
          if (ownTerritories.length >= 8 || state.time - (player.lastTerritoryClaim || 0) < cooldown || (state.resources[player.id] || 0) < 48) continue;
          const candidates = state.units.filter(unit =>
            unit.alive
            && unit.faction === player.id
            && unit.role !== "builder"
            && !state.territories.some(territory => pointInTerritory(unit, territory))
            && !state.units.some(enemy => enemy.alive && !areAllies(enemy.faction, player.id) && distance(unit, enemy) < 70)
          );
          if (!candidates.length) continue;
          const candidate = candidates.sort((a, b) => distance(b, player.base) - distance(a, player.base))[0];
          const connected = ownTerritories.some(territory => territory.connected && distance(candidate, territoryCenter(territory)) < 190);
          if (!connected && player.doctrine !== "Aggressive") continue;
          const terrain = terrainAt(candidate);
          const reason = terrain.elevation > 2 ? "Control high ground"
            : ["water", "river", "bridge"].includes(terrain.type) ? "Hold a river crossing"
              : terrain.type === "road" ? "Protect a road"
                : player.doctrine === "Fortress" ? "Establish a defensive perimeter"
                  : player.doctrine === "Expansion" ? "Secure resources"
                    : player.doctrine === "Aggressive" ? "Create a forward operating base"
                      : "Connect controlled land";
          const radius = player.doctrine === "Fortress" ? 62 : player.doctrine === "Aggressive" ? 88 : 74;
          state.territories.push(createTerritory(player.id, candidate, radius, {
            name: `${player.faction} frontier ${ownTerritories.length}`,
            resourceValue: reason === "Secure resources" ? 68 : 42,
            strategicValue: reason.includes("road") || reason.includes("crossing") || reason.includes("ground") ? 74 : 54,
            defensibility: player.doctrine === "Fortress" ? 78 : 48,
            reason
          }));
          state.resources[player.id] -= 20;
          player.lastTerritoryClaim = state.time;
          incident(`${player.faction} expanded territory: ${reason.toLowerCase()}.`, candidate.id, "info");
        }
        rebuildTerritorySelect();
      }

      function updateTerritoryControl() {
        let changed = false;
        for (const territory of state.territories) {
          const center = territoryCenter(territory);
          territory.connected = !territory.supplyRequired || Boolean(territory.owner && (
            distance(center, baseFor(territory.owner)) < 235
            || state.structures.some(structure => structure.faction === territory.owner && structure.alive !== false && structure.progress >= 1 && (buildingCatalog[structure.type]?.supplyRadius || 0) > 0 && distance(center, structure) < (buildingCatalog[structure.type]?.supplyRadius || 0) + 75)
          ));
        }
        for (let pass = 0; pass < 3; pass += 1) {
          for (const territory of state.territories.filter(item => item.owner && !item.connected)) {
            const center = territoryCenter(territory);
            territory.connected = state.territories.some(other => other.connected && other.owner && (other.owner === territory.owner || areAllies(other.owner, territory.owner) && (other.shareAllies || territory.shareAllies)) && distance(center, territoryCenter(other)) < 185);
          }
        }
        for (const territory of state.territories) {
          const occupants = state.units.filter(unit => unit.alive && pointInTerritory(unit, territory));
          const groups = new Map();
          for (const unit of occupants) groups.set(unit.faction, (groups.get(unit.faction) || 0) + 1);
          const factions = [...groups.keys()];
          if (factions.length >= 2) {
            territory.status = "contested · capture paused";
            territory.reason = `${factions.length} forces present; capture timer paused`;
            continue;
          }
          const claimant = factions[0] || null;
          if (!territory.owner && claimant && !territory.unclaimable && !territory.locked) {
            territory.captureFaction = claimant;
            territory.pressure = (territory.pressure || 0) + (groups.get(claimant) || 1) * 10;
            territory.status = "claiming neutral territory";
            if (territory.pressure >= territory.captureDifficulty * 0.45) {
              territory.owner = claimant;
              territory.status = "claimed";
              territory.claimedAt = state.time;
              territory.pressure = 0;
              territory.reason = "Neutral territory secured";
              changed = true;
              incident(`${playerFor(claimant).faction} secured neutral ${territory.name}.`, null, "info");
            }
            continue;
          }
          if (territory.owner && claimant && claimant !== territory.owner && !areAllies(claimant, territory.owner)) {
            const blockingBuildings = state.structures.filter(structure => structure.alive !== false && structure.progress >= 1 && pointInTerritory(structure, territory) && !areAllies(structure.faction, claimant));
            if (blockingBuildings.length) {
              territory.status = "blocked by enemy buildings";
              territory.reason = `${blockingBuildings.length} hostile hitbox${blockingBuildings.length === 1 ? "" : "es"} must be destroyed`;
              territory.pressure = Math.max(0, (territory.pressure || 0) - 5);
              continue;
            }
            territory.captureFaction = claimant;
            territory.pressure = (territory.pressure || 0) + (groups.get(claimant) || 1) * 8;
            territory.status = "seizing";
            if (!territory.locked && !territory.unclaimable && territory.pressure >= territory.captureDifficulty) {
              territory.previousOwner = territory.owner;
              territory.owner = claimant;
              territory.status = "claimed";
              territory.claimedAt = state.time;
              territory.pressure = 0;
              territory.connected = false;
              territory.reason = "Only one force remained after enemy buildings fell";
              changed = true;
              incident(`${playerFor(claimant).faction} seized ${territory.name}.`, null, "critical");
            }
            continue;
          }
          territory.pressure = Math.max(0, (territory.pressure || 0) - 8);
          if (!territory.owner) territory.status = "neutral";
          else if (!territory.connected) territory.status = "isolated";
          else {
            const fortified = state.structures.some(structure => structure.faction === territory.owner && structure.alive !== false && structure.progress >= 1 && ["bunker", "turret", "outpost"].includes(structure.type) && pointInTerritory(structure, territory));
            territory.status = fortified ? "fortified" : state.time - territory.claimedAt < 12 ? "claimed" : "controlled";
          }
        }
        for (const player of state.players) {
          const completeOutposts = state.structures.filter(structure => structure.faction === player.id && structure.type === "outpost" && structure.progress >= 1 && structure.alive !== false);
          for (const outpost of completeOutposts) {
            if (state.territories.some(territory => territory.owner === player.id && distance(territoryCenter(territory), outpost) < 70)) continue;
            state.territories.push(createTerritory(player.id, outpost, 70, { name: `${player.faction} outpost`, status: "fortified", strategicValue: 72, defensibility: 78, reason: "Headquarters expanded the supply perimeter" }));
            changed = true;
          }
          const own = state.territories.filter(territory => territory.owner === player.id);
          const cooldown = player.doctrine === "Aggressive" ? 16 : player.doctrine === "Fortress" ? 30 : 22;
          if (own.length >= 8 || state.time - (player.lastTerritoryClaim || 0) < cooldown || economyFor(player.id).inventory.requisition < 24) continue;
          const candidate = state.units.filter(unit => unit.alive && unit.faction === player.id && unit.role !== "builder" && !state.territories.some(territory => pointInTerritory(unit, territory)) && !state.units.some(enemy => enemy.alive && !areAllies(enemy.faction, player.id) && distance(unit, enemy) < 70)).sort((a, b) => distance(b, player.base) - distance(a, player.base))[0];
          if (!candidate) continue;
          const connected = own.some(territory => territory.connected && distance(candidate, territoryCenter(territory)) < 190);
          if (!connected && player.doctrine !== "Aggressive") continue;
          state.territories.push(createTerritory(player.id, candidate, player.doctrine === "Aggressive" ? 86 : 72, { name: `${player.faction} frontier ${own.length}`, resourceValue: 52, strategicValue: 62, defensibility: player.doctrine === "Fortress" ? 78 : 48, reason: "AI expanded its connected supply perimeter" }));
          economyFor(player.id).inventory.requisition -= 20;
          player.lastTerritoryClaim = state.time;
          changed = true;
          incident(`${player.faction} expanded its territory toward active forces.`, candidate.id, "info");
        }
        if (changed) rebuildTerritorySelect();
      }

      function updateEnvironment(dt) {
        for (const feature of state.features) {
          feature.age = (feature.age || 0) + dt;
          if (feature.type === "mud") feature.condition = clamp((feature.condition ?? 1) - dt * 0.00035, 0.25, 1);
          if (feature.type === "snow") feature.condition = clamp((feature.condition ?? 1) - dt * 0.00022, 0.35, 1);
          if (feature.type === "grass") feature.condition = clamp((feature.condition ?? 0.7) + dt * 0.00014, 0, 1);
        }
        for (const structure of state.structures) {
          ensureStructureRuntime(structure);
          if (structure.progress >= 1 && structure.alive !== false) {
            const maintained = (structure.inventory.parts || 0) > 0;
            structure.hp = clamp(structure.hp - dt * (maintained ? 0.002 : 0.018), 1, structure.maxHp);
            const nearbyEngineer = state.units.find(unit => unit.alive && areAllies(unit.faction, structure.faction) && unit.role === "engineer" && distance(unit, structure) < 22);
            if (nearbyEngineer) structure.hp = clamp(structure.hp + dt * 4, 1, structure.maxHp);
            structure.condition = clamp(structure.hp / structure.maxHp, 0.04, 1);
            if (["generator", "observationtower", "fieldhospital"].includes(structure.type) && structure.condition <= 0.18 && !structure.powerOutageReported) {
              structure.powerOutageReported = true;
              incident(`${playerFor(structure.faction).faction} ${buildingCatalog[structure.type].label.toLowerCase()} lost lighting power.`, structure.id, "warning");
            }
            if (structure.condition > 0.3) structure.powerOutageReported = false;
          }
        }
      }

      function separateUnits() {
        const living = state.units.filter(unit => unit.alive);
        const cellSize = 28;
        const buckets = new Map();
        living.forEach((unit, index) => {
          unit.separationIndex = index;
          const key = `${Math.floor(unit.x / cellSize)},${Math.floor(unit.y / cellSize)}`;
          if (!buckets.has(key)) buckets.set(key, []);
          buckets.get(key).push(unit);
        });
        for (const a of living) {
          const cx = Math.floor(a.x / cellSize);
          const cy = Math.floor(a.y / cellSize);
          for (let ox = -1; ox <= 1; ox += 1) {
            for (let oy = -1; oy <= 1; oy += 1) {
              for (const b of buckets.get(`${cx + ox},${cy + oy}`) || []) {
                if (b.separationIndex <= a.separationIndex) continue;
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const d = Math.hypot(dx, dy) || 0.01;
            const min = a.role === "vehicle" || b.role === "vehicle" ? 14 : 8;
            if (d >= min) continue;
            const force = (min - d) * 0.14;
            a.x -= dx / d * force;
            a.y -= dy / d * force;
            b.x += dx / d * force;
            b.y += dy / d * force;
              }
            }
          }
        }
      }

      function updateBattle(dt) {
        state.time += dt;
        updateConvoys(dt);
        updateDropPods();
        if (state.time >= state.nextTerritoryTick) {
          territoryTick();
          state.nextTerritoryTick += 2;
        }
        state.environmentAccumulator += dt;
        if (state.environmentAccumulator >= 0.5) {
          updateEnvironment(state.environmentAccumulator);
          state.environmentAccumulator = 0;
        }
        if (state.time >= state.nextEconomy) {
          economyTick();
          state.nextEconomy += 5;
        }
        state.spatialAccumulator += dt;
        if (state.spatialAccumulator >= 0.2 || !state.spatialGrid.size) {
          rebuildSpatialGrid();
          state.spatialAccumulator = 0;
        }
        if (state.speed >= 8) {
          state.units.forEach((unit, index) => {
            if (unit.role === "builder" || index % 2 === state.fastUnitPhase) updateUnit(unit, unit.role === "builder" ? dt : dt * 2);
          });
          state.fastUnitPhase = state.fastUnitPhase ? 0 : 1;
        } else {
          for (const unit of state.units) updateUnit(unit, dt);
        }
        state.separationAccumulator += dt;
        if (state.separationAccumulator >= 0.08) {
          separateUnits();
          state.separationAccumulator = 0;
        }
        updateProjectiles(dt);
        if (state.time >= state.nextSnapshot) {
          captureSnapshot();
          state.nextSnapshot += state.speed >= 8 ? 6 : 1.5;
        }
        if (state.time >= state.nextMilestone) {
          const strongest = state.players
            .map(player => ({ player, score: state.units.filter(unit => unit.alive && unit.faction === player.id).length + state.structures.filter(item => item.faction === player.id && item.progress >= 1).length * 2 }))
            .sort((a, b) => b.score - a.score)[0];
          incident(`${strongest?.player.faction || "No faction"} leads at the ${formatElapsed(state.nextMilestone)} milestone. Simulation continues.`, null, "info");
          state.nextMilestone += 240;
        }
      }

      function captureSnapshot() {
        state.snapshots.push({
          t: state.time,
          resources: { ...state.resources },
          units: state.units.map(unit => ({
            id: unit.id, x: unit.x, y: unit.y, hp: unit.hp, morale: unit.morale,
            fatigue: unit.fatigue, alive: unit.alive, status: unit.status, squadId: unit.squadId
          })),
          structures: state.structures.map(item => ({ ...item }))
        });
        if (state.snapshots.length > 180) state.snapshots.shift();
        els.timeline.max = String(Math.max(0, state.snapshots.length - 1));
        if (!state.replay) {
          els.timeline.value = els.timeline.max;
          state.replayIndex = Number(els.timeline.max);
        }
      }

      function currentSnapshot() {
        return state.replay ? state.snapshots[state.replayIndex] : null;
      }

      function unitView(unit) {
        const snapshot = currentSnapshot();
        if (!snapshot) return unit;
        const historical = snapshot.units.find(item => item.id === unit.id);
        return historical ? { ...unit, ...historical } : unit;
      }

      function beginCanvasFrame() {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const sx = canvas.width / VW;
        const sy = canvas.height / VH;
        const zoom = state.camera.zoom;
        ctx.setTransform(
          sx * zoom,
          0,
          0,
          sy * zoom,
          sx * (VW / 2 - state.camera.x * zoom),
          sy * (VH / 2 - state.camera.y * zoom)
        );
      }

      function traceSpawnZone(player) {
        const zone = spawnZoneFor(player);
        ctx.beginPath();
        if (zone.shape === "square") {
          ctx.rect(player.base.x - zone.size, player.base.y - zone.size, zone.size * 2, zone.size * 2);
        } else if (zone.shape === "custom" && zone.points.length >= 3) {
          ctx.moveTo(zone.points[0].x, zone.points[0].y);
          for (let index = 1; index < zone.points.length; index += 1) ctx.lineTo(zone.points[index].x, zone.points[index].y);
          ctx.closePath();
        } else {
          ctx.arc(player.base.x, player.base.y, zone.size, 0, Math.PI * 2);
        }
      }

      function drawSpawnZone(player) {
        const zone = spawnZoneFor(player);
        ctx.save();
        ctx.fillStyle = player.color;
        ctx.strokeStyle = player.color;
        ctx.globalAlpha = 0.08;
        traceSpawnZone(player);
        ctx.fill();
        ctx.globalAlpha = state.mode === "editor" ? 0.55 : 0.18;
        ctx.lineWidth = 1.5 / state.camera.zoom;
        ctx.setLineDash([6 / state.camera.zoom, 5 / state.camera.zoom]);
        traceSpawnZone(player);
        ctx.stroke();
        ctx.setLineDash([]);
        if (state.mode === "editor" && zone.shape === "custom" && player.id === state.spawnPlayerId) {
          ctx.globalAlpha = 0.9;
          for (const point of zone.points) {
            ctx.beginPath();
            ctx.arc(point.x, point.y, 4 / state.camera.zoom, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
      }

      function traceRoad(points) {
        if (!points?.length) return;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let index = 1; index < points.length; index += 1) {
          const previous = points[index - 1];
          const point = points[index];
          ctx.quadraticCurveTo(previous.x, previous.y, (previous.x + point.x) / 2, (previous.y + point.y) / 2);
        }
        const last = points[points.length - 1];
        ctx.lineTo(last.x, last.y);
      }

      function drawRoadNetwork() {
        if (!state.showRoads) return;
        for (const road of state.roads) {
          ctx.save();
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.strokeStyle = colors.background;
          ctx.globalAlpha = 0.62;
          ctx.lineWidth = 11 / state.camera.zoom;
          traceRoad(road.points);
          ctx.stroke();
          ctx.strokeStyle = road.kind === "trade route" ? colors.signal : playerColor(road.faction);
          ctx.globalAlpha = road.kind === "trade route" ? 0.48 : 0.34;
          ctx.lineWidth = 7 / state.camera.zoom;
          traceRoad(road.points);
          ctx.stroke();
          ctx.strokeStyle = colors.foreground;
          ctx.globalAlpha = 0.34;
          ctx.setLineDash([6 / state.camera.zoom, 7 / state.camera.zoom]);
          ctx.lineWidth = 1 / state.camera.zoom;
          traceRoad(road.points);
          ctx.stroke();
          ctx.restore();
        }
      }

      function drawTradePartners() {
        for (const partner of state.tradePartners || []) {
          ctx.save();
          ctx.translate(partner.x, partner.y);
          ctx.fillStyle = colors.card;
          ctx.strokeStyle = playerColor(partner.faction);
          ctx.globalAlpha = 0.86;
          ctx.lineWidth = 1.5 / state.camera.zoom;
          ctx.beginPath();
          ctx.rect(-7, -7, 14, 14);
          ctx.fill();
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(-4, 0);
          ctx.lineTo(4, 0);
          ctx.moveTo(0, -4);
          ctx.lineTo(0, 4);
          ctx.stroke();
          ctx.fillStyle = colors.foreground;
          ctx.font = `${9 / state.camera.zoom}px system-ui, sans-serif`;
          ctx.textAlign = "center";
          ctx.fillText(partner.established ? partner.name : `${partner.name} · unlinked`, 0, -12 / state.camera.zoom);
          ctx.restore();
        }
      }

      function drawSupplyRadii() {
        if (!state.showSupplyRadii) return;
        for (const structure of state.structures) {
          const radius = buildingCatalog[structure.type]?.supplyRadius || 0;
          if (!radius || structure.progress < 1 || structure.alive === false) continue;
          ctx.save();
          ctx.strokeStyle = playerColor(structure.faction);
          ctx.fillStyle = playerColor(structure.faction);
          ctx.globalAlpha = 0.045;
          ctx.beginPath();
          ctx.arc(structure.x, structure.y, radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 0.22;
          ctx.lineWidth = 1 / state.camera.zoom;
          ctx.setLineDash([5 / state.camera.zoom, 7 / state.camera.zoom]);
          ctx.stroke();
          ctx.restore();
        }
      }

      function drawTransports() {
        for (const convoy of state.convoys) {
          if (convoy.finished && convoy.status !== "Destroyed") continue;
          const color = playerColor(convoy.faction);
          ctx.save();
          ctx.translate(convoy.x, convoy.y);
          ctx.fillStyle = convoy.status === "Destroyed" ? colors.mutedForeground : color;
          ctx.strokeStyle = colors.foreground;
          ctx.globalAlpha = convoy.status === "Destroyed" ? 0.32 : 0.94;
          if (convoy.mode === "cargo aircraft") {
            ctx.beginPath();
            ctx.moveTo(0, -7);
            ctx.lineTo(9, 5);
            ctx.lineTo(0, 2);
            ctx.lineTo(-9, 5);
            ctx.closePath();
            ctx.fill();
          } else {
            ctx.fillRect(-7, -5, 14, 10);
            ctx.strokeRect(-7, -5, 14, 10);
            ctx.fillStyle = colors.background;
            ctx.fillRect(-5, -7, 3, 3);
            ctx.fillRect(2, -7, 3, 3);
          }
          if (!convoy.finished) {
            ctx.fillStyle = colors.background;
            ctx.globalAlpha = 0.65;
            ctx.fillRect(-9, 8, 18, 2);
            ctx.fillStyle = color;
            ctx.globalAlpha = 0.95;
            ctx.fillRect(-9, 8, 18 * clamp(convoy.hp / convoy.maxHp, 0, 1), 2);
            if (convoy.status.includes("escort") || convoy.status.includes("attack")) {
              ctx.fillStyle = colors.foreground;
              ctx.font = `${8 / state.camera.zoom}px system-ui, sans-serif`;
              ctx.textAlign = "center";
              ctx.fillText(convoy.status, 0, -11 / state.camera.zoom);
            }
          }
          ctx.restore();
        }
        for (const pod of state.dropPods) {
          if (pod.deployed) continue;
          const launched = ["Launched", "Impact"].includes(pod.stage);
          const progress = pod.stage === "Launched" ? clamp(1 - (pod.stageEndsAt - state.time) / 4, 0, 1) : pod.stage === "Impact" ? 1 : 0;
          const y = launched ? -30 + (pod.destination.y + 30) * progress : pod.destination.y - 24;
          ctx.save();
          ctx.translate(pod.destination.x, y);
          ctx.strokeStyle = playerColor(pod.faction);
          ctx.fillStyle = colors.foreground;
          ctx.globalAlpha = launched ? 0.92 : 0.42;
          ctx.beginPath();
          ctx.moveTo(0, -9);
          ctx.lineTo(6, 4);
          ctx.lineTo(0, 10);
          ctx.lineTo(-6, 4);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          if (launched) {
            ctx.globalAlpha = 0.38;
            ctx.beginPath();
            ctx.moveTo(-4, -10);
            ctx.lineTo(-8, -26);
            ctx.moveTo(4, -10);
            ctx.lineTo(8, -26);
            ctx.stroke();
          }
          ctx.restore();
        }
      }

      function drawTerrain() {
        ctx.fillStyle = colors.muted;
        ctx.fillRect(0, 0, VW, VH);
        for (const player of state.players) drawSpawnZone(player);
        ctx.globalAlpha = 0.12;
        ctx.strokeStyle = colors.border;
        ctx.lineWidth = 1;
        for (let x = 0; x <= VW; x += 24) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, VH);
          ctx.stroke();
        }
        for (let y = 0; y <= VH; y += 24) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(VW, y);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        for (const feature of state.features) drawFeature(feature);
        drawRoadNetwork();
        drawTradePartners();
        for (const player of state.players) {
          ctx.strokeStyle = player.color;
          ctx.fillStyle = player.color;
          ctx.globalAlpha = 0.76;
          ctx.lineWidth = 2 / state.camera.zoom;
          ctx.beginPath();
          ctx.arc(player.base.x, player.base.y, 18 / state.camera.zoom, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(player.base.x - 8 / state.camera.zoom, player.base.y);
          ctx.lineTo(player.base.x + 8 / state.camera.zoom, player.base.y);
          ctx.moveTo(player.base.x, player.base.y - 8 / state.camera.zoom);
          ctx.lineTo(player.base.x, player.base.y + 8 / state.camera.zoom);
          ctx.stroke();
          ctx.font = `${11 / state.camera.zoom}px system-ui, sans-serif`;
          ctx.textAlign = "center";
          ctx.fillText(`P${player.index + 1}`, player.base.x, player.base.y - 24 / state.camera.zoom);
        }
        ctx.globalAlpha = 1;
      }

      function terrainPaintColor(type) {
        if (type === "water") return "#60A5FA";
        if (type === "shallowwater") return "#BAE6FD";
        if (type === "deepwater" || type === "river") return "#2563EB";
        if (["sand", "beach"].includes(type)) return colors.signal;
        if (["rock", "smallrocks", "boulders", "pavement", "road"].includes(type) || brushLayers["Roads"].includes(type)) return colors.foreground;
        if (["snow", "ice"].includes(type)) return colors.background;
        if (["mud", "ash", "dirt"].includes(type)) return colors.mutedForeground;
        if (type === "lava") return colors.danger;
        return colors.terrain;
      }

      function tracePaintShape(feature) {
        const shape = feature.shape || "circle";
        ctx.beginPath();
        if (shape === "line" && feature.x2 != null && feature.y2 != null) {
          ctx.moveTo(feature.x, feature.y);
          ctx.lineTo(feature.x2, feature.y2);
          return "line";
        }
        if (shape === "square") {
          ctx.rect(feature.x - feature.r, feature.y - feature.r, feature.r * 2, feature.r * 2);
          return "fill";
        }
        if (shape === "freeform") {
          const seed = Math.round(feature.x * 7 + feature.y * 13 + feature.r * 3);
          for (let index = 0; index < 12; index += 1) {
            const angle = index * Math.PI * 2 / 12;
            const wobble = 0.72 + ((seed + index * 37) % 24) / 100;
            const x = feature.x + Math.cos(angle) * feature.r * wobble;
            const y = feature.y + Math.sin(angle) * feature.r * wobble;
            if (index === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          return "fill";
        }
        ctx.arc(feature.x, feature.y, feature.r, 0, Math.PI * 2);
        return "fill";
      }

      function drawFeatureAtlas(feature, visual, opacity, condition) {
        if (!spriteAtlasReady) return false;
        const key = atlasTypeMap[feature.type];
        const cell = atlasCells[key];
        if (!cell) return false;
        const isRoad = brushLayers["Roads"].includes(feature.type);
        if (isRoad) return false;
        const isTexture = cell[2] === 128;
        ctx.save();
        ctx.globalAlpha = opacity * condition * (isTexture ? 0.9 : 1);
        ctx.imageSmoothingEnabled = true;
        if (isRoad && feature.shape === "line" && feature.x2 != null) {
          const dx = feature.x2 - feature.x;
          const dy = feature.y2 - feature.y;
          const length = Math.hypot(dx, dy);
          ctx.translate((feature.x + feature.x2) / 2, (feature.y + feature.y2) / 2);
          ctx.rotate(Math.atan2(dy, dx) + Math.PI / 2);
          ctx.drawImage(spriteAtlas, ...cell, -feature.r, -length / 2, feature.r * 2, length);
          ctx.restore();
          return true;
        }
        if (isTexture) {
          tracePaintShape(feature);
          ctx.clip();
          ctx.fillStyle = atlasPatterns[key] || colors.muted;
          ctx.fillRect(feature.x - feature.r, feature.y - feature.r, feature.r * 2, feature.r * 2);
          ctx.restore();
          return true;
        }
        const dense = ["denseforest", "jungle", "trees", "bushes"].includes(feature.type);
        const count = dense ? 5 : feature.type === "smallrocks" ? 3 : 1;
        const seed = Math.round(feature.x * 11 + feature.y * 17 + feature.r * 5);
        for (let index = 0; index < count; index += 1) {
          const angle = (seed + index * 137) * Math.PI / 180;
          const spread = dense ? feature.r * 0.48 : 0;
          const x = feature.x + Math.cos(angle) * spread;
          const y = feature.y + Math.sin(angle) * spread;
          const size = dense ? Math.max(22, feature.r * 0.82) : Math.max(24, feature.r * 1.55);
          ctx.drawImage(spriteAtlas, ...cell, x - size / 2, y - size / 2, size, size);
        }
        ctx.restore();
        return true;
      }

      function drawFeature(feature) {
        const visual = feature.visual || visualForBrush(feature.type);
        const seed = Math.round(feature.x * 7 + feature.y * 13 + feature.r * 3);
        const condition = feature.condition ?? 1;
        const opacity = clamp(feature.opacity ?? 1, 0, 1);
        const color = terrainPaintColor(feature.type);
        const sourceCell = spriteAtlasReady ? atlasCells[atlasTypeMap[feature.type]] : null;
        const spriteOnly = sourceCell?.[2] === 96 && feature.shape !== "line";
        ctx.save();
        ctx.fillStyle = color;
        ctx.strokeStyle = color;
        ctx.globalAlpha = opacity * condition;
        const traced = tracePaintShape(feature);
        if (traced === "line") {
          ctx.lineWidth = feature.r * 2;
          ctx.lineCap = "round";
          ctx.stroke();
        } else if ((feature.shape || "") === "softcircle") {
          const gradient = ctx.createRadialGradient(feature.x, feature.y, 0, feature.x, feature.y, feature.r);
          gradient.addColorStop(0, color);
          const hardStop = clamp((feature.hardness ?? 0.65) * (1 - (feature.falloff ?? 0) * 0.75), 0, 0.95);
          gradient.addColorStop(hardStop, color);
          gradient.addColorStop(1, "transparent");
          ctx.fillStyle = gradient;
          if (!spriteOnly) ctx.fill();
        } else {
          if (!spriteOnly) ctx.fill();
        }

        const drewAtlas = drawFeatureAtlas(feature, visual, opacity, condition);
        if (visual === "water") {
          ctx.strokeStyle = feature.type === "deepwater" ? "#BAE6FD" : "#2563EB";
          ctx.globalAlpha = Math.min(1, opacity + 0.12);
          ctx.lineWidth = Math.max(1, 1.5 / state.camera.zoom);
          const waveWidth = feature.r * 0.58;
          for (let index = -2; index <= 2; index += 1) {
            ctx.beginPath();
            ctx.moveTo(feature.x - waveWidth, feature.y + index * feature.r * 0.18);
            ctx.quadraticCurveTo(feature.x, feature.y + index * feature.r * 0.18 + Math.sin(seed + index) * 5, feature.x + waveWidth, feature.y + index * feature.r * 0.18);
            ctx.stroke();
          }
        } else if (visual === "elevation") {
          ctx.strokeStyle = colors.foreground;
          ctx.globalAlpha = opacity * 0.72;
          ctx.lineWidth = 1 / state.camera.zoom;
          for (let ring = 0.35; ring <= 0.85; ring += 0.2) {
            ctx.beginPath();
            ctx.ellipse(feature.x, feature.y, feature.r * ring, feature.r * 0.62 * ring, -0.18, 0, Math.PI * 2);
            ctx.stroke();
          }
        } else if (visual === "vegetation" && !drewAtlas) {
          ctx.strokeStyle = colors.foreground;
          ctx.fillStyle = colors.foreground;
          ctx.globalAlpha = opacity * 0.82 * condition;
          const count = feature.type === "denseforest" || feature.type === "jungle" ? 26 : 18;
          for (let index = 0; index < count; index += 1) {
            const angle = (seed + index * 137.5) * Math.PI / 180;
            const radius = feature.r * (0.16 + ((index * 43) % 75) / 100);
            const x = feature.x + Math.cos(angle) * radius;
            const y = feature.y + Math.sin(angle) * radius;
            if (feature.type === "tallgrass" || feature.type === "crops" || feature.type === "flowers") {
              ctx.beginPath();
              ctx.moveTo(x, y + 3);
              ctx.lineTo(x - 2, y - 4);
              ctx.moveTo(x, y + 3);
              ctx.lineTo(x + 2, y - 4);
              ctx.stroke();
            } else {
              ctx.fillRect(Math.round(x) - 1, Math.round(y) - 5, 3, 9);
              ctx.beginPath();
              ctx.arc(x, y - 5, feature.type === "bushes" ? 3 : 5, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        } else if ((visual === "rock" || visual === "urban" || visual === "military") && !drewAtlas) {
          ctx.strokeStyle = colors.foreground;
          ctx.globalAlpha = opacity * 0.74;
          ctx.lineWidth = 1 / state.camera.zoom;
          const count = visual === "urban" ? 6 : 5;
          for (let index = 0; index < count; index += 1) {
            const angle = (seed + index * 73) * Math.PI / 180;
            const radius = feature.r * 0.58;
            const x = feature.x + Math.cos(angle) * radius;
            const y = feature.y + Math.sin(angle) * radius;
            ctx.strokeRect(Math.round(x) - 7, Math.round(y) - 5, 14, 10);
          }
        } else if (visual === "weather") {
          ctx.globalAlpha = Math.min(opacity, 0.28);
          ctx.setLineDash([5, 6]);
          tracePaintShape(feature);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.restore();
      }

      function drawCasterShadow(x, y, radius, height, softness = 0.18, time = state.time) {
        if (!state.lighting.enabled || !state.lighting.shadows) return;
        const vector = shadowVector(height, time);
        if (vector.length <= 0 || vector.strength <= 0.02) return;
        const end = { x: x + vector.x, y: y + vector.y };
        const angle = Math.atan2(vector.y, vector.x);
        const length = Math.max(radius * 0.9, vector.length);
        const width = Math.max(3, radius * (0.7 + softness));
        ctx.save();
        ctx.translate((x + end.x) / 2, (y + end.y) / 2);
        ctx.rotate(angle);
        const gradient = ctx.createLinearGradient(-length / 2, 0, length / 2, 0);
        gradient.addColorStop(0, nightShadeColor());
        gradient.addColorStop(0.72, nightShadeColor());
        gradient.addColorStop(1, "transparent");
        ctx.fillStyle = gradient;
        ctx.globalAlpha = clamp(0.16 + vector.strength * 0.24 - softness * 0.08, 0.08, 0.4);
        ctx.beginPath();
        ctx.ellipse(0, 0, length / 2 + radius * 0.45, width, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      function drawFeatureShadows(time = state.time) {
        for (const feature of state.features) {
          const height = featureHeight(feature);
          if (!height) continue;
          const canopy = ["denseforest", "jungle", "trees"].includes(feature.type);
          const softness = ["bushes", "largebush", "tallgrass"].includes(feature.type) ? 0.56 : canopy ? 0.34 : 0.12;
          const radius = canopy ? feature.r * 0.72 : Math.max(5, feature.r * 0.34);
          drawCasterShadow(feature.x, feature.y, radius, height, softness, time);
        }
      }

      function drawStructureShadows(snapshot) {
        const structures = snapshot?.structures || state.structures;
        const time = currentSnapshot()?.t ?? state.time;
        for (const item of structures) {
          if (item.progress < 0.18 || item.alive === false) continue;
          const height = (buildingCatalog[item.type]?.height || 8) * item.progress;
          const radius = item.type === "outpost" ? 18 : item.type === "observationtower" ? 7 : 13;
          drawCasterShadow(item.x, item.y, radius, height, 0.08, time);
        }
      }

      function drawUnitShadows(snapshot) {
        const time = currentSnapshot()?.t ?? state.time;
        const historicalUnits = snapshot ? new Map(snapshot.units.map(unit => [unit.id, unit])) : null;
        for (const unit of state.units) {
          const view = historicalUnits?.get(unit.id) || unit;
          if (!view.alive) continue;
          const height = unit.role === "vehicle" ? 3.2 : unit.role === "builder" ? 2.4 : 1.8;
          drawCasterShadow(view.x, view.y, unit.role === "vehicle" ? 8 : 3.2, height, 0.12, time);
        }
      }

      function traceTerritory(territory) {
        if (!territory?.points?.length) return false;
        ctx.beginPath();
        ctx.moveTo(territory.points[0].x, territory.points[0].y);
        for (let index = 1; index < territory.points.length; index += 1) ctx.lineTo(territory.points[index].x, territory.points[index].y);
        if (territory.points.length >= 3) ctx.closePath();
        return true;
      }

      function drawTerritories() {
        if (!state.territoryOverlay) return;
        for (const territory of state.territories) {
          if (territory.points.length < 3) continue;
          const owner = territory.owner ? playerFor(territory.owner) : null;
          const color = owner?.color || colors.border;
          const status = territory.status || "neutral";
          const contested = status.startsWith("contested") || status === "seizing" || status.startsWith("blocked");
          const fillOpacity = status === "abandoned" ? 0.04
            : status === "cut off" || status === "isolated" ? 0.09
              : contested ? 0.24
                : status === "fortified" ? 0.23
                  : status === "controlled" ? 0.2
                    : status === "claimed" ? 0.15
                      : 0.04;
          ctx.save();
          ctx.fillStyle = color;
          ctx.strokeStyle = color;
          ctx.globalAlpha = fillOpacity;
          traceTerritory(territory);
          ctx.fill();
          ctx.globalAlpha = status === "abandoned" ? 0.28 : status === "cut off" ? 0.38 : 0.86;
          ctx.lineWidth = contested
            ? (2.2 + Math.sin(state.time * 5) * 0.8) / state.camera.zoom
            : status === "fortified" ? 2.8 / state.camera.zoom : 1.7 / state.camera.zoom;
          if (status === "claimed") ctx.setLineDash([8 / state.camera.zoom, 5 / state.camera.zoom]);
          if (status === "isolated" || status === "cut off") ctx.setLineDash([3 / state.camera.zoom, 7 / state.camera.zoom]);
          if (status === "abandoned") ctx.setLineDash([2 / state.camera.zoom, 9 / state.camera.zoom]);
          traceTerritory(territory);
          ctx.stroke();
          ctx.setLineDash([]);
          const center = territoryCenter(territory);
          ctx.fillStyle = colors.foreground;
          ctx.globalAlpha = 0.74;
          ctx.font = `${10 / state.camera.zoom}px system-ui, sans-serif`;
          ctx.textAlign = "center";
          ctx.fillText(`${territory.name} · ${status}`, center.x, center.y);
          if (state.mode === "editor" && state.editorTool === "territory" && territory.id === state.selectedTerritoryId) {
            ctx.fillStyle = color;
            ctx.globalAlpha = 0.96;
            for (const point of territory.points) {
              ctx.beginPath();
              ctx.arc(point.x, point.y, 4.5 / state.camera.zoom, 0, Math.PI * 2);
              ctx.fill();
              ctx.strokeStyle = colors.foreground;
              ctx.stroke();
            }
          }
          ctx.restore();
        }
      }

      function mixHex(first, second, amount) {
        const parse = value => {
          const hex = String(value || "#808080").replace("#", "");
          return [Number.parseInt(hex.slice(0, 2), 16), Number.parseInt(hex.slice(2, 4), 16), Number.parseInt(hex.slice(4, 6), 16)];
        };
        const a = parse(first);
        const b = parse(second);
        return `rgb(${a.map((value, index) => Math.round(value + (b[index] - value) * clamp(amount, 0, 1))).join(",")})`;
      }

      function drawBuildingPattern(player, width, height, progress) {
        if (!state.lighting.accessibilityPatterns || !state.lighting.buildingColors) return;
        ctx.save();
        ctx.strokeStyle = player.secondaryColor || colors.foreground;
        ctx.fillStyle = player.secondaryColor || colors.foreground;
        ctx.globalAlpha = 0.78 * state.lighting.colorIntensity * progress;
        ctx.lineWidth = 2;
        const pattern = player.pattern || "solid";
        if (pattern === "vertical") ctx.fillRect(-1.5, -height / 2 + 2, 3, height - 4);
        else if (pattern === "diagonal") {
          ctx.beginPath();
          ctx.moveTo(-width / 2 + 3, height / 2 - 3);
          ctx.lineTo(width / 2 - 3, -height / 2 + 3);
          ctx.stroke();
        } else if (pattern === "split") ctx.fillRect(0, -height / 2 + 2, width / 2 - 2, height - 4);
        else if (pattern === "checker") {
          ctx.fillRect(-width / 2 + 3, -height / 2 + 3, width / 3, height / 3);
          ctx.fillRect(0, 0, width / 3, height / 3);
        } else if (pattern === "border") ctx.strokeRect(-width / 2 + 3, -height / 2 + 3, width - 6, height - 6);
        else if (pattern === "quartered") {
          ctx.fillRect(-width / 2 + 3, -height / 2 + 3, width / 2 - 3, height / 2 - 3);
          ctx.fillRect(0, 0, width / 2 - 3, height / 2 - 3);
        }
        ctx.restore();
      }

      function drawBuildingAnimation(item, width, height, primary, secondary) {
        if (item.progress < 0.82 || item.alive === false) return;
        const phase = state.time * 1.7 + Number(String(item.id).replace(/\D/g, "")) * 0.3;
        ctx.save();
        ctx.strokeStyle = primary;
        ctx.fillStyle = secondary;
        ctx.lineWidth = 1.4 / state.camera.zoom;
        ctx.globalAlpha = 0.72 * clamp(item.condition ?? 1, 0.2, 1);
        if (item.type === "generator") {
          ctx.rotate(phase);
          ctx.setLineDash([4, 3]);
          ctx.beginPath();
          ctx.arc(0, 0, Math.min(width, height) * 0.31, 0, Math.PI * 2);
          ctx.stroke();
        } else if (["refinery", "fueldepot"].includes(item.type)) {
          const pulse = 2 + (Math.sin(phase * 1.4) + 1) * 1.3;
          ctx.globalAlpha *= 0.48;
          ctx.beginPath();
          ctx.arc(width * 0.24, -height * 0.5 - pulse, pulse, 0, Math.PI * 2);
          ctx.fill();
        } else if (item.type === "mine") {
          const travel = (phase * 7) % Math.max(8, width - 8) - width / 2 + 4;
          ctx.fillRect(travel, height * 0.22, 3, 3);
        } else if (item.type === "farm") {
          ctx.beginPath();
          ctx.moveTo(-width * 0.4, Math.sin(phase) * 3);
          ctx.lineTo(width * 0.4, -Math.sin(phase) * 3);
          ctx.stroke();
        } else if (["outpost", "observationtower"].includes(item.type)) {
          ctx.rotate(phase * 0.45);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(width * 0.52, 0);
          ctx.stroke();
        } else if (["workshop", "ammodepot", "warehouse"].includes(item.type)) {
          ctx.rotate(phase * 0.65);
          ctx.strokeRect(-4, -4, 8, 8);
        }
        ctx.restore();
      }

      function drawStructures(snapshot) {
        const structures = snapshot?.structures || state.structures;
        for (const item of structures) {
          ensureStructureRuntime(item);
          const player = playerFor(item.faction);
          const captureProgress = item.captureProgress ?? 1;
          const primary = item.previousFaction && captureProgress < 1
            ? mixHex(playerColor(item.previousFaction), player.color, captureProgress)
            : player.color;
          const secondary = item.previousFaction && captureProgress < 1
            ? mixHex(playerSecondaryColor(item.previousFaction), player.secondaryColor, captureProgress)
            : player.secondaryColor;
          const spec = buildingCatalog[item.type];
          ctx.save();
          ctx.translate(item.x, item.y);
          const width = item.hitbox?.w || (item.type === "outpost" ? 34 : item.type === "barracks" ? 30 : 24);
          const height = item.hitbox?.h || (item.type === "outpost" ? 28 : item.type === "bunker" ? 18 : 24);
          const progress = clamp(item.progress, 0, 1);
          if (item.alive === false) {
            ctx.fillStyle = colors.mutedForeground;
            ctx.strokeStyle = colors.foreground;
            ctx.globalAlpha = 0.34;
            ctx.fillRect(-width / 2, -height / 3, width, height * 0.66);
            ctx.beginPath();
            ctx.moveTo(-width / 2, -height / 2);
            ctx.lineTo(width / 2, height / 2);
            ctx.moveTo(width / 2, -height / 2);
            ctx.lineTo(-width / 2, height / 2);
            ctx.stroke();
            ctx.restore();
            continue;
          }
          ctx.fillStyle = colors.mutedForeground;
          ctx.globalAlpha = 0.52 * (item.condition ?? 1);
          ctx.fillRect(-width / 2, -height / 2, width * progress, height);
          ctx.strokeStyle = colors.foreground;
          ctx.globalAlpha = 0.72 * (item.condition ?? 1);
          ctx.lineWidth = 1.5;
          ctx.strokeRect(-width / 2, -height / 2, width * progress, height);
          if (state.lighting.buildingColors) {
            const preservation = { high: 0.58, medium: 0.76, low: 0.94 }[state.lighting.factionPreservation] || 0.7;
            ctx.fillStyle = primary;
            ctx.globalAlpha = state.lighting.colorIntensity * preservation * (item.condition ?? 1);
            const panelProgress = clamp((progress - 0.18) / 0.82, 0, 1);
            ctx.fillRect(-width / 2 + 3, -height / 2 + 3, Math.max(0, (width - 6) * panelProgress), Math.max(2, height * 0.48));
            ctx.fillStyle = secondary;
            ctx.globalAlpha = state.lighting.colorIntensity * 0.86 * panelProgress;
            ctx.fillRect(-width / 2 + 3, 1, Math.max(0, (width - 6) * panelProgress), 3);
            drawBuildingPattern(player, width, height, panelProgress);
            if (item.formerFaction && (item.condition ?? 1) < 0.86) {
              ctx.fillStyle = playerColor(item.formerFaction);
              ctx.globalAlpha = 0.34 * (1 - (item.condition ?? 1) + 0.2);
              ctx.fillRect(-width / 2 + 4, -height / 2 + 4, width * 0.28, height * 0.3);
            }
          }
          drawEconomyBuildingSprite(item, width, height);
          ctx.strokeStyle = primary;
          ctx.fillStyle = secondary;
          ctx.globalAlpha = 0.88 * (item.condition ?? 1);
          if (item.type === "generator") {
            ctx.beginPath();
            ctx.arc(0, 0, 7, 0, Math.PI * 2);
            ctx.stroke();
          } else if (item.type === "turret") {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(14, -8);
            ctx.stroke();
          } else if (item.type === "observationtower") {
            ctx.beginPath();
            ctx.moveTo(0, 10);
            ctx.lineTo(0, -16);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(0, -18, 4, 0, Math.PI * 2);
            ctx.fill();
          } else if (item.type === "barracks") {
            ctx.fillRect(-9, -3, 18 * item.progress, 6);
          }
          if (state.lighting.teamEmblems && progress >= 0.72) {
            ctx.fillStyle = colors.foreground;
            ctx.globalAlpha = 0.84;
            ctx.font = "8px system-ui, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(`T${player.team}`, 0, 3);
          }
          drawBuildingAnimation(item, width, height, primary, secondary);
          if (item.progress < 1) {
            ctx.globalAlpha = 0.28;
            ctx.fillStyle = colors.background;
            ctx.fillRect(-18, height / 2 + 5, 36, 3);
            ctx.globalAlpha = 0.9;
            ctx.fillStyle = primary;
            ctx.fillRect(-18, height / 2 + 5, 36 * item.progress, 3);
          }
          if (state.logisticsOpen || item.condition < 0.88 || item.id === state.selectedStructureId) {
            ctx.strokeStyle = item.id === state.selectedStructureId ? colors.foreground : primary;
            ctx.globalAlpha = item.id === state.selectedStructureId ? 0.9 : 0.36;
            ctx.lineWidth = 1 / state.camera.zoom;
            ctx.setLineDash([3 / state.camera.zoom, 3 / state.camera.zoom]);
            ctx.strokeRect(-width / 2, -height / 2, width, height);
            ctx.setLineDash([]);
          }
          ctx.restore();
          if (item.progress >= 1 && (state.logisticsOpen || item.condition < 0.98 || item.id === state.selectedStructureId)) {
            ctx.fillStyle = colors.background;
            ctx.globalAlpha = 0.7;
            ctx.fillRect(item.x - width / 2, item.y - height / 2 - 6 / state.camera.zoom, width, 3 / state.camera.zoom);
            ctx.fillStyle = primary;
            ctx.globalAlpha = 0.95;
            ctx.fillRect(item.x - width / 2, item.y - height / 2 - 6 / state.camera.zoom, width * clamp(item.hp / item.maxHp, 0, 1), 3 / state.camera.zoom);
          }
          if (item.progress >= 1 && state.mode !== "menu") {
            ctx.fillStyle = colors.foreground;
            ctx.globalAlpha = 0.58;
            ctx.font = "10px system-ui, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(spec?.label || item.type, item.x, item.y + 23);
          }
        }
        ctx.globalAlpha = 1;
      }

      function drawSquads(snapshot) {
        for (const squad of state.squads) {
          const members = squadMembers(squad.id, snapshot);
          if (members.length < 2) continue;
          const views = members.map(unit => {
            const historical = snapshot?.units.find(item => item.id === unit.id);
            return historical ? { unit, view: historical } : { unit, view: unit };
          });
          const cx = views.reduce((sum, item) => sum + item.view.x, 0) / views.length;
          const cy = views.reduce((sum, item) => sum + item.view.y, 0) / views.length;
          const hp = views.reduce((sum, item) => sum + item.view.hp, 0);
          const maxHp = members.reduce((sum, unit) => sum + unit.maxHp, 0);
          const color = playerColor(squad.faction);
          ctx.strokeStyle = color;
          ctx.globalAlpha = 0.24;
          ctx.lineWidth = 1;
          ctx.beginPath();
          for (const item of views) {
            ctx.moveTo(cx, cy);
            ctx.lineTo(item.view.x, item.view.y);
          }
          ctx.stroke();
          ctx.globalAlpha = 0.35;
          ctx.fillStyle = colors.background;
          ctx.fillRect(cx - 25, cy - 23, 50, 4);
          ctx.globalAlpha = 0.92;
          ctx.fillStyle = color;
          ctx.fillRect(cx - 25, cy - 23, 50 * clamp(hp / maxHp, 0, 1), 4);
          ctx.fillStyle = colors.foreground;
          ctx.globalAlpha = 0.74;
          ctx.font = "10px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(`${squad.name} · ${members.length}`, cx, cy - 28);
        }
        ctx.globalAlpha = 1;
      }

      function drawUnit(unit, historical) {
        const view = historical || unit;
        const color = playerColor(unit.faction);
        const secondary = playerSecondaryColor(unit.faction);
        const pattern = playerFor(unit.faction).pattern || "solid";
        const selected = unit.id === state.selectedId;
        ctx.save();
        ctx.translate(Math.round(view.x), Math.round(view.y));
        if (!view.alive) {
          ctx.strokeStyle = color;
          ctx.globalAlpha = 0.34;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-5, -5);
          ctx.lineTo(5, 5);
          ctx.moveTo(5, -5);
          ctx.lineTo(-5, 5);
          ctx.stroke();
          ctx.restore();
          return;
        }
        if (selected) {
          ctx.strokeStyle = colors.foreground;
          ctx.globalAlpha = 0.88;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(0, 0, unit.role === "vehicle" ? 16 : 12, 0, Math.PI * 2);
          ctx.stroke();
          if (unit.range > 0) {
            ctx.globalAlpha = 0.14;
            ctx.setLineDash([3, 4]);
            ctx.beginPath();
            ctx.arc(0, 0, unit.range, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }
        ctx.fillStyle = color;
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.96;
        if (unit.role === "builder") {
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-7, 0);
          ctx.lineTo(7, 0);
          ctx.moveTo(0, -7);
          ctx.lineTo(0, 7);
          ctx.stroke();
          ctx.fillStyle = secondary;
          ctx.globalAlpha = 0.9;
          ctx.fillRect(-2, -2, 4, 4);
          ctx.strokeRect(-3, -3, 6, 6);
        } else if (unit.role === "vehicle") {
          ctx.fillRect(-12, -7, 24, 14);
          ctx.fillStyle = secondary;
          ctx.globalAlpha = 0.88;
          if (pattern === "split" || pattern === "quartered") ctx.fillRect(0, -7, 12, 14);
          else if (pattern === "vertical") ctx.fillRect(-3, -7, 6, 14);
          else if (pattern === "border") ctx.strokeRect(-10, -5, 20, 10);
          else {
            ctx.beginPath();
            ctx.moveTo(-7, 5);
            ctx.lineTo(7, -5);
            ctx.lineTo(11, -5);
            ctx.lineTo(-3, 5);
            ctx.closePath();
            ctx.fill();
          }
          ctx.fillStyle = colors.background;
          ctx.globalAlpha = 0.42;
          ctx.fillRect(-4, -2, 8, 4);
        } else {
          ctx.fillRect(-4, -5, 8, 10);
          ctx.fillRect(4, -1, 3, 2);
          ctx.fillStyle = secondary;
          ctx.globalAlpha = 0.9;
          if (pattern === "split" || pattern === "quartered") ctx.fillRect(0, -5, 4, 10);
          else if (pattern === "border") ctx.strokeRect(-3, -4, 6, 8);
          else ctx.fillRect(-4, -1, 8, 2);
          if (["medic", "engineer", "commander", "standard"].includes(unit.role)) {
            ctx.strokeStyle = colors.foreground;
            ctx.globalAlpha = 0.9;
            ctx.strokeRect(-5, -6, 10, 12);
          }
        }
        if (!unit.squadId && view.hp < unit.maxHp * 0.98) {
          ctx.globalAlpha = 0.35;
          ctx.fillStyle = colors.background;
          ctx.fillRect(-9, 11, 18, 2);
          ctx.globalAlpha = 0.9;
          ctx.fillStyle = color;
          ctx.fillRect(-9, 11, 18 * clamp(view.hp / unit.maxHp, 0, 1), 2);
        }
        if (selected || unit.role === "builder" || unit.role === "commander") {
          ctx.fillStyle = colors.foreground;
          ctx.globalAlpha = 0.78;
          ctx.font = "10px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(unit.name, 0, -15);
        }
        ctx.restore();
      }

      function drawProjectiles() {
        if (state.replay) return;
        for (const projectile of state.projectiles) {
          ctx.strokeStyle = playerColor(projectile.faction);
          ctx.globalAlpha = 0.9;
          ctx.lineWidth = projectile.damage >= 20 ? 2 : 1;
          ctx.beginPath();
          ctx.moveTo(projectile.previousX ?? projectile.x, projectile.previousY ?? projectile.y);
          ctx.lineTo(projectile.x, projectile.y);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      function drawNight() {
        const displayTime = currentSnapshot()?.t ?? state.time;
        const minute = (state.startMinute + displayTime * 4) % 1440;
        const hour = minute / 60;
        let darkness = 0;
        if (hour < 5 || hour > 21) darkness = 0.38;
        else if (hour < 7) darkness = (7 - hour) * 0.12;
        else if (hour > 18.5) darkness = (hour - 18.5) * 0.11;
        if (darkness > 0) {
          ctx.fillStyle = colors.background;
          ctx.globalAlpha = clamp(darkness, 0, 0.42);
          ctx.fillRect(0, 0, VW, VH);
          ctx.globalAlpha = 1;
        }
      }

      const dynamicLightLayer = document.createElement("canvas");
      dynamicLightLayer.width = VW;
      dynamicLightLayer.height = VH;
      const dynamicLightContext = dynamicLightLayer.getContext("2d");

      function drawDynamicLighting() {
        if (!state.lighting.enabled) return;
        const time = currentSnapshot()?.t ?? state.time;
        const sun = sunState(time);
        const weatherDarkness = { clear: 0, fog: 0.1, rain: 0.12, snow: -0.05, dust: 0.2 }[state.lighting.weather] || 0;
        const darkness = clamp((sun.daylight ? 0.22 - sun.intensity * 0.2 : 0.64) + weatherDarkness, 0, 0.72);
        const layer = dynamicLightContext;
        layer.setTransform(1, 0, 0, 1, 0, 0);
        layer.clearRect(0, 0, VW, VH);
        if (darkness > 0.01) {
          layer.fillStyle = nightShadeColor();
          layer.globalAlpha = darkness;
          layer.fillRect(0, 0, VW, VH);
        }
        const sources = activeLightSources();
        if (sources.length && darkness > 0.08) {
          layer.globalCompositeOperation = "destination-out";
          for (const source of sources) {
            const gradient = layer.createRadialGradient(source.x, source.y, 0, source.x, source.y, source.radius);
            gradient.addColorStop(0, "rgba(0,0,0,0.96)");
            gradient.addColorStop(0.45, "rgba(0,0,0,0.58)");
            gradient.addColorStop(1, "rgba(0,0,0,0)");
            layer.fillStyle = gradient;
            layer.globalAlpha = clamp(source.brightness, 0, 1);
            layer.beginPath();
            layer.arc(source.x, source.y, source.radius, 0, Math.PI * 2);
            layer.fill();
            if (source.searchlight) {
              layer.globalAlpha = 0.82;
              layer.beginPath();
              layer.moveTo(source.x, source.y);
              layer.arc(source.x, source.y, source.radius, source.direction - 0.23, source.direction + 0.23);
              layer.closePath();
              layer.fill();
            }
          }
          layer.globalCompositeOperation = "source-over";
        }
        layer.globalAlpha = 1;
        ctx.drawImage(dynamicLightLayer, 0, 0, VW, VH);
        if (sources.length) {
          ctx.save();
          ctx.globalCompositeOperation = "screen";
          for (const source of sources) {
            const glowRadius = source.radius * (source.searchlight ? 0.58 : 0.44);
            const glow = ctx.createRadialGradient(source.x, source.y, 0, source.x, source.y, glowRadius);
            glow.addColorStop(0, source.color);
            glow.addColorStop(1, "transparent");
            ctx.fillStyle = glow;
            ctx.globalAlpha = clamp(source.brightness * (sun.daylight ? 0.09 : 0.22), 0.04, 0.24);
            ctx.beginPath();
            ctx.arc(source.x, source.y, glowRadius, 0, Math.PI * 2);
            ctx.fill();
            if (source.searchlight && !sun.daylight) {
              ctx.fillStyle = source.color;
              ctx.globalAlpha = 0.12;
              ctx.beginPath();
              ctx.moveTo(source.x, source.y);
              ctx.arc(source.x, source.y, source.radius, source.direction - 0.23, source.direction + 0.23);
              ctx.closePath();
              ctx.fill();
            }
          }
          ctx.restore();
        }
      }

      function drawLightingOverlay() {
        if (!state.lighting.enabled || !state.lighting.overlay) return;
        const time = currentSnapshot()?.t ?? state.time;
        const sun = sunState(time);
        const columns = 12;
        const rows = 7;
        const cellW = VW / columns;
        const cellH = VH / rows;
        ctx.save();
        for (let row = 0; row < rows; row += 1) {
          for (let column = 0; column < columns; column += 1) {
            const point = { x: (column + 0.5) * cellW, y: (row + 0.5) * cellH };
            const sample = lightingAt(point, null, time);
            ctx.fillStyle = sample.searchlight > 0.2
              ? colors.danger
              : sample.shadowed
                ? colors.water
                : sample.brightness > 0.55 ? colors.signal : colors.background;
            ctx.globalAlpha = sample.searchlight > 0.2 ? 0.18 : 0.07 + Math.abs(sample.brightness - 0.5) * 0.08;
            ctx.fillRect(column * cellW, row * cellH, cellW, cellH);
          }
        }
        for (const source of activeLightSources()) {
          ctx.strokeStyle = source.searchlight ? colors.danger : source.color;
          ctx.globalAlpha = 0.72;
          ctx.lineWidth = 1.4 / state.camera.zoom;
          ctx.setLineDash(source.searchlight ? [6 / state.camera.zoom, 4 / state.camera.zoom] : []);
          ctx.beginPath();
          ctx.arc(source.x, source.y, source.radius, 0, Math.PI * 2);
          ctx.stroke();
          if (source.searchlight) {
            ctx.beginPath();
            ctx.moveTo(source.x, source.y);
            ctx.lineTo(source.x + Math.cos(source.direction - 0.23) * source.radius, source.y + Math.sin(source.direction - 0.23) * source.radius);
            ctx.moveTo(source.x, source.y);
            ctx.lineTo(source.x + Math.cos(source.direction + 0.23) * source.radius, source.y + Math.sin(source.direction + 0.23) * source.radius);
            ctx.stroke();
          }
        }
        ctx.setLineDash([]);
        ctx.strokeStyle = colors.foreground;
        ctx.fillStyle = colors.foreground;
        ctx.globalAlpha = 0.9;
        ctx.lineWidth = 2 / state.camera.zoom;
        const compass = { x: VW - 74 / state.camera.zoom, y: 52 / state.camera.zoom };
        const arrowLength = 34 / state.camera.zoom;
        ctx.beginPath();
        ctx.moveTo(compass.x, compass.y);
        ctx.lineTo(compass.x + Math.cos(sun.azimuth) * arrowLength, compass.y + Math.sin(sun.azimuth) * arrowLength);
        ctx.stroke();
        ctx.font = `${10 / state.camera.zoom}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(`${sun.period} · ${formatHour(sun.hour)}`, compass.x, compass.y + 22 / state.camera.zoom);
        ctx.restore();
      }

      function visibleSourcesFor(playerId) {
        if (playerId === "observer") return [];
        const player = playerFor(playerId);
        const team = String(player.team);
        const unitSources = state.units
          .filter(unit => unit.alive && String(playerFor(unit.faction).team) === team)
          .map(unit => ({ x: unit.x, y: unit.y, r: unit.role === "scout" ? 145 : unit.role === "builder" ? 92 : 112 }));
        const structureSources = state.structures
          .filter(item => item.progress >= 1 && String(playerFor(item.faction).team) === team)
          .map(item => ({ x: item.x, y: item.y, r: item.type === "observationtower" ? 170 : 78 }));
        const poweredLights = activeLightSources()
          .filter(source => source.faction && String(playerFor(source.faction).team) === team)
          .map(source => ({ x: source.x, y: source.y, r: source.radius * (source.searchlight ? 1 : 0.7) }));
        return unitSources.concat(structureSources, poweredLights);
      }

      function drawFog() {
        if (state.fogPlayer === "observer") return;
        const playerId = state.fogPlayer;
        const sources = visibleSourcesFor(playerId);
        const explored = state.explored[playerId] || new Uint8Array(48 * 27);
        const cellW = VW / 48;
        const cellH = VH / 27;
        for (let gy = 0; gy < 27; gy += 1) {
          for (let gx = 0; gx < 48; gx += 1) {
            const index = gy * 48 + gx;
            const cx = (gx + 0.5) * cellW;
            const cy = (gy + 0.5) * cellH;
            const visible = sources.some(source => Math.hypot(source.x - cx, source.y - cy) <= source.r * state.visibility / 100);
            if (visible) {
              explored[index] = 1;
              continue;
            }
            ctx.fillStyle = colors.background;
            ctx.globalAlpha = explored[index] ? 0.5 : 0.92;
            ctx.fillRect(gx * cellW, gy * cellH, cellW + 1, cellH + 1);
          }
        }
        state.explored[playerId] = explored;
        ctx.globalAlpha = 1;
      }

      function drawEditorCursor() {
        if (state.mode !== "editor" || !state.hover) return;
        if (state.editorTool === "terrain") {
          const blocked = Boolean(territoryAt(state.hover)?.locked);
          const preview = {
            x: state.hover.x,
            y: state.hover.y,
            x2: state.hover.x + state.brushRadius,
            y2: state.hover.y,
            r: state.brushRadius,
            shape: state.brushShape
          };
          ctx.save();
          ctx.fillStyle = blocked ? colors.danger : terrainPaintColor(state.brush);
          ctx.strokeStyle = blocked ? colors.danger : colors.foreground;
          ctx.globalAlpha = Math.max(0.15, state.brushOpacity * 0.35);
          const traced = tracePaintShape(preview);
          if (traced === "line") {
            ctx.lineWidth = state.brushRadius * 2;
            ctx.lineCap = "round";
            ctx.stroke();
          } else {
            ctx.fill();
          }
          ctx.globalAlpha = 0.9;
          ctx.lineWidth = 1 / state.camera.zoom;
          ctx.setLineDash([4 / state.camera.zoom, 4 / state.camera.zoom]);
          tracePaintShape(preview);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = colors.foreground;
          ctx.font = `${10 / state.camera.zoom}px system-ui, sans-serif`;
          ctx.textAlign = "center";
          ctx.fillText(`${brushNames[state.brush] || state.brush} · ${Math.round(state.brushOpacity * 100)}% · ${blocked ? "blocked" : state.brushShape}`, state.hover.x, state.hover.y - state.brushRadius - 8 / state.camera.zoom);
          ctx.restore();
          return;
        }
        ctx.strokeStyle = colors.foreground;
        ctx.globalAlpha = 0.76;
        ctx.setLineDash([4 / state.camera.zoom, 4 / state.camera.zoom]);
        ctx.lineWidth = 1 / state.camera.zoom;
        ctx.beginPath();
        if (state.editorTool === "spawn") {
          const size = 12 / state.camera.zoom;
          ctx.moveTo(state.hover.x - size, state.hover.y);
          ctx.lineTo(state.hover.x + size, state.hover.y);
          ctx.moveTo(state.hover.x, state.hover.y - size);
          ctx.lineTo(state.hover.x, state.hover.y + size);
        } else {
          ctx.arc(state.hover.x, state.hover.y, 5 / state.camera.zoom, 0, Math.PI * 2);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }

      function draw() {
        beginCanvasFrame();
        drawTerrain();
        drawTerritories();
        drawSupplyRadii();
        const snapshot = currentSnapshot();
        const historicalUnits = snapshot ? new Map(snapshot.units.map(unit => [unit.id, unit])) : null;
        drawStructureShadows(snapshot);
        drawUnitShadows(snapshot);
        drawStructures(snapshot);
        drawTransports();
        drawSquads(snapshot);
        for (const unit of state.units) {
          const historical = historicalUnits?.get(unit.id);
          drawUnit(unit, historical);
        }
        drawProjectiles();
        drawDynamicLighting();
        drawFog();
        drawLightingOverlay();
        drawEditorCursor();
      }

      function updateSelectedUnit() {
        const unit = state.units.find(item => item.id === state.selectedId);
        if (!unit) return;
        const view = unitView(unit);
        const squad = unit.squadId ? squadFor(unit.squadId) : null;
        const members = squad ? squadMembers(squad.id, currentSnapshot()) : [];
        const combinedHp = members.reduce((sum, member) => {
          const historical = currentSnapshot()?.units.find(item => item.id === member.id);
          return sum + (historical?.hp ?? member.hp);
        }, 0);
        const combinedMax = members.reduce((sum, member) => sum + member.maxHp, 0);
        const healthRatio = squad && combinedMax ? combinedHp / combinedMax : view.hp / unit.maxHp;
        const hp = Math.round(clamp(healthRatio, 0, 1) * 100);
        const morale = Math.round(view.morale * 100);
        const fatigue = Math.round(view.fatigue * 100);
        const player = playerFor(unit.faction);
        els.unitName.textContent = unitLabel(unit);
        els.unitRole.textContent = `${roleLabel(unit)} · ${player.race} / ${player.subfaction}`;
        els.unitState.textContent = view.status;
        els.healthBar.style.transform = `scaleX(${hp / 100})`;
        els.moraleBar.style.transform = `scaleX(${morale / 100})`;
        els.fatigueBar.style.transform = `scaleX(${fatigue / 100})`;
        els.healthValue.textContent = String(hp);
        els.moraleValue.textContent = String(morale);
        els.fatigueValue.textContent = String(fatigue);
        els.unitStats.textContent = `Accuracy ${(unit.accuracy * 100).toFixed(1)} · Precision ${(unit.precision * 100).toFixed(1)} · Reflexes ${(unit.reflexes * 100).toFixed(0)}`;
        els.unitKills.textContent = `${unit.kills} confirmed`;
        const light = lightingAt(view, unit.faction, currentSnapshot()?.t ?? state.time);
        const lightingState = !state.lighting.enabled ? "Lighting disabled" : light.searchlight > 0.15 ? "Searchlight exposed" : light.shadowed ? "Shadow cover" : `${light.period} light`;
        els.unitDepth.textContent = `Age ${unit.age} · XP ${unit.experience} · Courage ${(unit.courage * 100).toFixed(0)} · Discipline ${(unit.discipline * 100).toFixed(0)} · ${unit.armor} · ${unit.weapon} · ${lightingState}`;
        if (squad) {
          const healthy = members.filter(member => member.hp / member.maxHp > 0.7).length;
          const critical = members.filter(member => member.hp / member.maxHp < 0.3).length;
          els.squadSummary.textContent = `${squad.name} · ${members.length} attached · ${healthy} healthy · ${critical} critical · Combined health ${hp}%`;
        } else {
          els.squadSummary.textContent = "Independent unit · No squad attachment";
        }
        els.unitAction.textContent = state.replay ? `Recorded state: ${view.status.toLowerCase()}.` : unit.lastAction;
        els.unitLog.textContent = "";
        for (const entry of (unit.logs.length ? unit.logs : ["No recorded actions."]).slice(0, 2)) {
          const li = document.createElement("li");
          li.textContent = entry;
          els.unitLog.append(li);
        }
        els.unitSelect.value = unit.id;
        rebuildAttachSelect();
      }

      function updateIncidents() {
        els.eventList.textContent = "";
        for (const item of state.incidents.slice(0, 4)) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "btn btn-ghost btn-block";
          button.textContent = `${formatElapsed(item.t)} · ${item.text}`;
          button.addEventListener("click", () => jumpToIncident(item));
          els.eventList.append(button);
        }
        if (!state.incidents.length) {
          const empty = document.createElement("div");
          empty.className = "text-small";
          empty.textContent = "No incidents recorded.";
          els.eventList.append(empty);
        }
        els.eventCount.textContent = `${state.incidents.length} recorded`;
      }

      function updatePauseButton() {
        if (state.mode === "menu" || state.mode === "editor") {
          els.pause.disabled = true;
          const label = state.mode === "editor" ? "Editing" : "Paused";
          els.pause.innerHTML = `<i data-lucide="${state.mode === "editor" ? "pencil" : "pause"}" aria-hidden="true"></i>${label}`;
        } else {
          els.pause.disabled = false;
          els.pause.innerHTML = `<i data-lucide="${state.paused ? "play" : "pause"}" aria-hidden="true"></i>${state.paused ? "Resume" : "Pause"}`;
        }
        if (window.lucide) lucide.createIcons({ attrs: { width: 16, height: 16 } });
      }

      function setInspector(open) {
        els.inspector.hidden = !open;
        els.inspectorButton.setAttribute("aria-pressed", String(open));
      }

      function updateFullscreenButton() {
        const nativeFullscreen = document.fullscreenElement === root;
        const fallback = root.classList.contains("is-expanded");
        const active = nativeFullscreen || fallback;
        const label = nativeFullscreen ? "Exit full screen" : fallback ? "Restore view" : "Full screen";
        els.fullscreenButton.innerHTML = `<i data-lucide="${active ? "minimize-2" : "maximize-2"}" aria-hidden="true"></i>${label}`;
        if (window.lucide) lucide.createIcons({ attrs: { width: 16, height: 16 } });
      }

      async function toggleFullscreen() {
        if (document.fullscreenElement === root) {
          await document.exitFullscreen();
          return;
        }
        if (root.classList.contains("is-expanded")) {
          root.classList.remove("is-expanded");
          updateFullscreenButton();
          return;
        }
        setInspector(false);
        try {
          await root.requestFullscreen({ navigationUI: "hide" });
        } catch {
          root.classList.add("is-expanded");
          updateFullscreenButton();
        }
      }

      function updateFogButton() {
        const label = state.fogPlayer === "observer" ? "Observer" : `P${playerFor(state.fogPlayer).index + 1} vision`;
        els.fogButton.innerHTML = `<i data-lucide="cloud-fog" aria-hidden="true"></i>${label}`;
        if (window.lucide) lucide.createIcons({ attrs: { width: 16, height: 16 } });
      }

      function cycleFog() {
        const options = ["observer", ...state.players.map(player => player.id)];
        const current = options.indexOf(state.fogPlayer);
        state.fogPlayer = options[(current + 1) % options.length];
        updateFogButton();
        updateUI(true);
        draw();
      }

      function setLogisticsPanel(open) {
        state.logisticsOpen = Boolean(open);
        els.logisticsPanel.hidden = !state.logisticsOpen;
        els.logisticsButton.setAttribute("aria-pressed", String(state.logisticsOpen));
        els.logisticsButton.innerHTML = `<i data-lucide="truck" aria-hidden="true"></i>${state.logisticsOpen ? "Logistics on" : "Logistics"}`;
        if (state.logisticsOpen) updateLogisticsPanel();
        if (window.lucide) lucide.createIcons({ attrs: { width: 16, height: 16 } });
        draw();
      }

      function replaceLogisticsList(element, lines, empty) {
        element.textContent = "";
        for (const line of lines.length ? lines : [empty]) {
          const item = document.createElement("li");
          item.textContent = line;
          element.append(item);
        }
      }

      function updateLogisticsPanel() {
        if (!state.logisticsOpen) return;
        const player = playerFor(state.logisticsPlayerId);
        const economy = economyFor(player.id);
        const capacity = economyCapacity(player.id);
        els.logisticsPlayer.value = player.id;
        els.logisticsPersonality.textContent = `${economy.personality} commander · ${economy.emergency}`;
        els.logisticsResources.textContent = "";
        for (const key of economyResourceKeys) {
          const badge = document.createElement("span");
          badge.className = "viz-badge";
          badge.textContent = `${economyResourceLabels[key]} ${Math.floor(economy.inventory[key] || 0)}/${Math.floor(capacity[key] || 0)}`;
          els.logisticsResources.append(badge);
        }
        const activeStructures = state.structures.filter(item => item.faction === player.id && item.progress >= 1 && item.alive !== false);
        const production = {};
        for (const structure of activeStructures) {
          for (const [key, value] of Object.entries(buildingCatalog[structure.type]?.produces || {})) production[key] = (production[key] || 0) + value * clamp(structure.condition || 1, 0.2, 1);
        }
        replaceLogisticsList(els.logisticsProduction, [
          `Production: ${Object.entries(production).map(([key, value]) => `${economyResourceLabels[key]} +${Math.round(value)}`).join(" · ") || "no active producer"}`,
          `Consumption: ${activeStructures.reduce((sum, item) => sum + Object.keys(buildingCatalog[item.type]?.consumes || {}).length, 0)} building inputs · ${state.units.filter(item => item.alive && item.faction === player.id).length} unit consumers`
        ], "No active production");
        const stores = activeStructures.filter(item => buildingCatalog[item.type]?.storage);
        replaceLogisticsList(els.logisticsStorage, [
          `${stores.length} physical stores · ${stores.map(item => buildingCatalog[item.type].label).join(", ") || "HQ field cache"}`,
          `Destruction rule: 75% exposed stock lost · 25% salvage`
        ], "HQ field cache only");
        replaceLogisticsList(els.logisticsQueue, economy.queue.slice(0, 6).map(item => `${item.priority} · ${item.label} · ${item.status}`), "No pending requests");
        const convoyLines = state.convoys.filter(item => item.faction === player.id && (!item.finished || state.time - (item.finishedAt || 0) < 12)).slice(0, 5).map(item => `${item.name} · ${item.mode} · ${item.status}${item.escorts ? ` · ${item.escorts} escort` : ""}`);
        const podLines = state.dropPods.filter(item => item.faction === player.id && !item.deployed).map(item => `Drop pod · ${item.stage}`);
        const partner = state.tradePartners.find(item => item.faction === player.id);
        const tradeLine = partner
          ? partner.established
            ? `${partner.name} · route established · next trade ${formatElapsed(Math.max(0, partner.nextDispatch - state.time))}`
            : `${partner.name} · no route · AI must establish it`
          : "";
        replaceLogisticsList(els.logisticsConvoys, [...convoyLines, ...podLines, tradeLine].filter(Boolean), "No active transport job");
        const selected = state.structures.find(item => item.id === state.selectedStructureId);
        replaceLogisticsList(els.logisticsOfficers, [
          `Quartermaster · ${economy.officers.quartermaster}`,
          `Supply Officer · ${economy.officers.supplyOfficer}`,
          `Factory Overseer · ${economy.officers.factoryOverseer}`,
          selected ? `${selected.displayName || factionBuildingLabel(selected.faction, selected.type)} · ${Math.round(selected.hp)}/${selected.maxHp} HP · collision ${selected.hitbox.w}×${selected.hitbox.h}` : "Emergency threshold · 16% capacity"
        ], "Logistics staff idle");
      }

      function updateUI(force = false) {
        const snapshot = currentSnapshot();
        const displayTime = snapshot?.t ?? state.time;
        const sun = sunState(displayTime);
        els.clock.textContent = formatHour(sun.hour);
        const weatherCount = state.features.filter(feature => weatherTypes.has(feature.type)).length;
        els.weather.textContent = state.lighting.enabled
          ? `${sun.period} · ${state.lighting.weather} · ${weatherCount || "No"} weather zone${weatherCount === 1 ? "" : "s"}`
          : "Lighting off · shadows suppressed";
        const living = snapshot ? snapshot.units.filter(unit => unit.alive) : state.units.filter(unit => unit.alive);
        const builders = living.filter(item => {
          const model = state.units.find(unit => unit.id === item.id);
          return model?.role === "builder";
        }).length;
        els.forceValue.textContent = `${living.length} active`;
        const visibleForces = state.players.slice(0, 6).map(player => {
          const count = living.filter(item => item.id.startsWith(`${player.id}-`)).length;
          return `P${player.index + 1} ${count}`;
        }).join(" · ");
        els.forceContext.textContent = `${visibleForces}${state.players.length > 6 ? ` · +${state.players.length - 6} players` : ""}`;
        els.playerCount.textContent = `${state.players.length} players`;
        const completeBuildings = (snapshot?.structures || state.structures).filter(item => item.progress >= 1 && item.alive !== false).length;
        els.buildingValue.textContent = `${completeBuildings} building${completeBuildings === 1 ? "" : "s"}`;
        const contestedTerritories = state.territories.filter(territory => String(territory.status).startsWith("contested")).length;
        const activeConvoys = state.convoys.filter(item => !item.finished).length;
        els.buildingContext.textContent = `${state.territories.length} territories${contestedTerritories ? ` · ${contestedTerritories} contested` : ""} · ${activeConvoys} convoy${activeConvoys === 1 ? "" : "s"} · ${state.squads.length} squads · ${state.fogPlayer === "observer" ? "Fog ready" : "Fog active"}`;
        els.resolutionBadge.textContent = `${state.mapResolution.width} × ${state.mapResolution.height}`;
        els.timelineMode.textContent = state.replay ? "REPLAY / PAUSED" : state.paused ? "LIVE RECORD / PAUSED" : "LIVE RECORD";
        els.timelineTime.textContent = `${formatElapsed(displayTime)} / ${formatElapsed(state.time)}`;
        const view = state.fogPlayer === "observer" ? "Observer" : `P${playerFor(state.fogPlayer).index + 1} fog`;
        els.fieldMode.textContent = state.mode === "editor"
          ? `${state.mapResolution.width} × ${state.mapResolution.height} · Pixel editor`
          : state.mode === "menu"
            ? "Observer / Paused"
            : state.replay
              ? `${view} · Replay`
              : `${view} · ${state.speed}×`;
        if (force || state.uiAccumulator >= 0.25) {
          updateSelectedUnit();
          updateLogisticsPanel();
          state.uiAccumulator = 0;
        }
      }

      function jumpToIncident(item) {
        if (!state.snapshots.length) return;
        let closest = 0;
        let best = Infinity;
        state.snapshots.forEach((snapshot, index) => {
          const delta = Math.abs(snapshot.t - item.t);
          if (delta < best) {
            best = delta;
            closest = index;
          }
        });
        state.paused = true;
        state.replay = true;
        state.replayIndex = closest;
        els.timeline.value = String(closest);
        if (item.unitId) state.selectedId = item.unitId;
        setInspector(true);
        updatePauseButton();
        updateUI(true);
      }

      function showMainMenu() {
        root.classList.remove("is-configuring");
        state.paused = true;
        state.mode = "menu";
        state.replay = false;
        els.overlay.hidden = false;
        els.mainActions.hidden = false;
        els.setupPanel.hidden = true;
        els.playerPanel.hidden = true;
        els.spritePanel.hidden = true;
        els.loadPanel.hidden = true;
        els.quitPanel.hidden = true;
        els.editorBar.hidden = true;
        els.editorTip.hidden = true;
        state.logisticsOpen = false;
        els.logisticsPanel.hidden = true;
        els.logisticsButton.setAttribute("aria-pressed", "false");
        setInspector(false);
        updatePauseButton();
        updateUI(true);
      }

      function startSimulation() {
        root.classList.remove("is-configuring");
        canvas.style.cursor = "crosshair";
        state.mode = "sim";
        state.paused = false;
        state.replay = false;
        state.lastFrame = performance.now();
        els.overlay.hidden = true;
        els.editorBar.hidden = true;
        els.editorTip.hidden = true;
        setInspector(root.getBoundingClientRect().width > 680);
        els.battleName.textContent = `${state.scenario === "custom" ? "Custom pixel theater" : presets[state.scenario].name} / Autonomous base growth`;
        updatePauseButton();
        incident("Builder autonomy released. Buildings will be selected from live priorities.", null, "info");
      }

      function saveActivePlayerForm() {
        const player = setupPlayers[state.activeSetupPlayer];
        player.name = els.playerName.value.trim() || `Player ${state.activeSetupPlayer + 1}`;
        player.race = els.playerRace.value;
        player.faction = els.playerFaction.value;
        player.subfaction = els.playerSubfaction.value;
        player.team = els.playerTeam.value;
        player.doctrine = els.playerDoctrine.value;
        player.color = els.playerColor.value;
        player.secondaryColor = els.playerSecondaryColor.value;
        player.pattern = els.playerPattern.value;
      }

      function populateFactionSelect(race, selectedFaction, selectedSubfaction) {
        const factions = raceCatalog[race]?.factions || {};
        els.playerFaction.textContent = "";
        for (const faction of Object.keys(factions)) {
          const option = document.createElement("option");
          option.value = faction;
          option.textContent = faction;
          els.playerFaction.append(option);
        }
        if (selectedFaction && factions[selectedFaction]) els.playerFaction.value = selectedFaction;
        const faction = els.playerFaction.value;
        els.playerSubfaction.textContent = "";
        for (const subfaction of factions[faction] || []) {
          const option = document.createElement("option");
          option.value = subfaction;
          option.textContent = subfaction;
          els.playerSubfaction.append(option);
        }
        if (selectedSubfaction && (factions[faction] || []).includes(selectedSubfaction)) els.playerSubfaction.value = selectedSubfaction;
      }

      function loadActivePlayerForm() {
        const player = setupPlayers[state.activeSetupPlayer];
        els.playerPanelTitle.textContent = `Player ${state.activeSetupPlayer + 1} configuration`;
        els.playerName.value = player.name;
        els.playerRace.value = player.race;
        populateFactionSelect(player.race, player.faction, player.subfaction);
        els.playerTeam.value = player.team;
        els.playerDoctrine.value = player.doctrine;
        els.playerColor.value = player.color;
        els.playerColorValue.textContent = player.color.toUpperCase();
        els.playerSecondaryColor.value = player.secondaryColor;
        els.playerSecondaryColorValue.textContent = player.secondaryColor.toUpperCase();
        els.playerPattern.value = player.pattern;
        const count = Number(els.playerCountSelect.value);
        for (const button of root.querySelectorAll("[data-player-tab]")) {
          const index = Number(button.dataset.playerTab);
          button.hidden = index >= count;
          const active = index === state.activeSetupPlayer;
          button.setAttribute("aria-pressed", String(active));
          button.classList.toggle("btn-primary", active);
        }
      }

      function selectedResolution() {
        if (els.mapResolution.value === "custom") {
          return {
            width: clamp(Number(els.customWidth.value) || 1920, 640, 4096),
            height: clamp(Number(els.customHeight.value) || 1080, 360, 2160)
          };
        }
        const [width, height] = els.mapResolution.value.split("x").map(Number);
        return { width, height };
      }

      function populateSpawnPlayers() {
        const previous = state.spawnPlayerId;
        els.spawnPlayer.textContent = "";
        for (const player of state.players) {
          const option = document.createElement("option");
          option.value = player.id;
          option.textContent = `P${player.index + 1} · ${player.faction}`;
          els.spawnPlayer.append(option);
        }
        state.spawnPlayerId = state.players.some(player => player.id === previous) ? previous : state.players[0]?.id;
        els.spawnPlayer.value = state.spawnPlayerId || "";
      }

      function defaultCustomZone(player) {
        const size = spawnZoneFor(player).size;
        return [
          { x: clamp(player.base.x, 0, VW), y: clamp(player.base.y - size, 0, VH) },
          { x: clamp(player.base.x + size, 0, VW), y: clamp(player.base.y, 0, VH) },
          { x: clamp(player.base.x, 0, VW), y: clamp(player.base.y + size, 0, VH) },
          { x: clamp(player.base.x - size, 0, VW), y: clamp(player.base.y, 0, VH) }
        ];
      }

      function populateTerritoryOwners() {
        const previous = els.territoryOwner.value;
        els.territoryOwner.textContent = "";
        const neutral = document.createElement("option");
        neutral.value = "";
        neutral.textContent = "Neutral";
        els.territoryOwner.append(neutral);
        for (const player of state.players) {
          const option = document.createElement("option");
          option.value = player.id;
          option.textContent = `P${player.index + 1} · ${player.faction}`;
          els.territoryOwner.append(option);
        }
        if ([...els.territoryOwner.options].some(option => option.value === previous)) els.territoryOwner.value = previous;
      }

      function rebuildTerritorySelect() {
        const previous = state.selectedTerritoryId;
        els.territorySelect.textContent = "";
        for (const territory of state.territories) {
          const option = document.createElement("option");
          option.value = territory.id;
          option.textContent = territory.name;
          els.territorySelect.append(option);
        }
        state.selectedTerritoryId = state.territories.some(territory => territory.id === previous)
          ? previous
          : state.territories[0]?.id || null;
        els.territorySelect.value = state.selectedTerritoryId || "";
      }

      function loadTerritoryForm() {
        const territory = selectedTerritory();
        if (!territory) return;
        els.territorySelect.value = territory.id;
        els.territoryEditMode.value = state.territoryEditMode;
        els.territoryName.value = territory.name;
        els.territoryOwner.value = territory.owner || "";
        els.territoryResource.value = String(territory.resourceValue);
        els.territoryStrategic.value = String(territory.strategicValue);
        els.territoryDefense.value = String(territory.defensibility);
        els.territoryCapture.value = String(territory.captureDifficulty);
        els.territoryStructures.value = territory.allowedStructures;
        els.territoryMaxStructures.value = String(territory.maxStructures);
        els.territorySupply.checked = territory.supplyRequired;
        els.territoryAbandon.checked = territory.canAbandon;
        els.territoryShare.checked = territory.shareAllies;
        els.territoryUnclaimable.checked = territory.unclaimable;
        els.territoryLocked.checked = territory.locked;
      }

      function saveTerritoryForm() {
        const territory = selectedTerritory();
        if (!territory) return;
        territory.name = els.territoryName.value.trim() || territory.name;
        territory.owner = els.territoryOwner.value;
        territory.startingOwner = els.territoryOwner.value;
        territory.status = territory.owner ? territory.status === "neutral" ? "controlled" : territory.status : "neutral";
        territory.resourceValue = clamp(Number(els.territoryResource.value) || 0, 0, 100);
        territory.strategicValue = clamp(Number(els.territoryStrategic.value) || 0, 0, 100);
        territory.defensibility = clamp(Number(els.territoryDefense.value) || 0, 0, 100);
        territory.captureDifficulty = clamp(Number(els.territoryCapture.value) || 0, 0, 100);
        territory.allowedStructures = els.territoryStructures.value;
        territory.maxStructures = clamp(Number(els.territoryMaxStructures.value) || 0, 0, 24);
        territory.supplyRequired = els.territorySupply.checked;
        territory.canAbandon = els.territoryAbandon.checked;
        territory.shareAllies = els.territoryShare.checked;
        territory.unclaimable = els.territoryUnclaimable.checked;
        territory.locked = els.territoryLocked.checked;
        rebuildTerritorySelect();
        draw();
      }

      function nearestTerritoryAnchor(territory, point, limit = 22 / state.camera.zoom) {
        let best = -1;
        let bestDistance = limit;
        territory.points.forEach((anchor, index) => {
          const d = distance(anchor, point);
          if (d < bestDistance) {
            best = index;
            bestDistance = d;
          }
        });
        return best;
      }

      function editTerritoryAtPoint(point) {
        const territory = selectedTerritory();
        if (!territory || territory.locked) {
          els.editorTip.textContent = "Select an unlocked territory before editing anchors.";
          return;
        }
        const mode = state.territoryEditMode;
        if (mode === "translate") {
          if (!pointInTerritory(point, territory)) {
            els.editorTip.textContent = `Click inside ${territory.name}, then drag to move the whole territory.`;
            return;
          }
          state.territoryDragStart = {
            point: { ...point },
            points: territory.points.map(anchor => ({ ...anchor }))
          };
          els.editorTip.textContent = `Moving ${territory.name} · drag anywhere inside its border.`;
          return;
        }
        if (mode === "delete") {
          const index = nearestTerritoryAnchor(territory, point);
          if (index >= 0) territory.points.splice(index, 1);
        } else if (mode === "move") {
          state.territoryDragIndex = nearestTerritoryAnchor(territory, point);
        } else if (mode === "bend" && territory.points.length >= 2) {
          let insertAt = territory.points.length;
          let best = Infinity;
          for (let index = 0; index < territory.points.length; index += 1) {
            const a = territory.points[index];
            const b = territory.points[(index + 1) % territory.points.length];
            const midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
            const d = distance(midpoint, point);
            if (d < best) {
              best = d;
              insertAt = index + 1;
            }
          }
          territory.points.splice(insertAt, 0, { x: Math.round(point.x), y: Math.round(point.y) });
        } else {
          territory.points.push({ x: Math.round(point.x), y: Math.round(point.y) });
        }
        els.editorTip.textContent = `${territory.name} · ${territory.points.length} anchors · ${mode}`;
        draw();
      }

      function invalidateLightingCaches() {
        lightSourceCacheKey = "";
        lightingSampleCacheKey = "";
        shadowCacheBucket = -1;
        shadowSampleCache.clear();
        lightingSampleCache.clear();
      }

      function updateLightingButton() {
        const enabled = Boolean(state.lighting.enabled);
        const active = enabled && Boolean(state.lighting.overlay);
        els.lightingToggle.disabled = !enabled;
        els.lightingToggle.setAttribute("aria-pressed", String(active));
        els.lightingToggle.innerHTML = `<i data-lucide="${enabled ? active ? "sun-medium" : "moon-star" : "circle-off"}" aria-hidden="true"></i>${enabled ? `Lighting map ${active ? "on" : "off"}` : "Lighting disabled"}`;
        if (els.lightingOverlay) els.lightingOverlay.checked = active;
        if (window.lucide) lucide.createIcons({ attrs: { width: 16, height: 16 } });
      }

      function syncLightingControls() {
        const configuredHour = state.lighting.mode === "fixed" ? state.lighting.fixedHour : state.lighting.startHour;
        const lightingDisabled = !state.lighting.enabled;
        els.enableLighting.checked = state.lighting.enabled;
        els.castShadows.checked = state.lighting.shadows;
        els.castShadows.disabled = lightingDisabled;
        els.timeMode.value = state.lighting.mode;
        els.timeMode.disabled = lightingDisabled;
        els.timeOfDay.value = String(configuredHour);
        els.timeOfDay.disabled = lightingDisabled;
        els.timeOfDayValue.textContent = formatHour(configuredHour);
        els.dayLength.value = String(state.lighting.dayLengthMinutes);
        els.dayLengthValue.textContent = String(state.lighting.dayLengthMinutes);
        els.dayLength.disabled = lightingDisabled || state.lighting.mode === "fixed";
        els.latitude.value = String(state.lighting.latitude);
        els.latitude.disabled = lightingDisabled;
        els.latitudeValue.textContent = String(state.lighting.latitude);
        els.season.value = state.lighting.season;
        els.season.disabled = lightingDisabled;
        els.lightingWeather.value = state.lighting.weather;
        els.lightingWeather.disabled = lightingDisabled;
        els.lightingOverlay.checked = state.lighting.overlay;
        els.lightingOverlay.disabled = lightingDisabled;
        els.artificialLights.checked = state.lighting.artificial;
        els.artificialLights.disabled = lightingDisabled;
        els.buildingColors.checked = state.lighting.buildingColors;
        els.colorIntensity.value = String(Math.round(state.lighting.colorIntensity * 100));
        els.colorIntensityValue.textContent = String(Math.round(state.lighting.colorIntensity * 100));
        els.factionPreservation.value = state.lighting.factionPreservation;
        els.teamEmblems.checked = state.lighting.teamEmblems;
        els.accessibilityPatterns.checked = state.lighting.accessibilityPatterns;
        updateLightingButton();
      }

      function syncEditorControls() {
        const player = selectedSpawnPlayer();
        if (!player) return;
        const zone = spawnZoneFor(player);
        els.editorTool.value = state.editorTool;
        els.spawnPlayer.value = player.id;
        els.zoneShape.value = zone.shape;
        els.zoneSize.value = String(zone.size);
        els.zoneSizeValue.textContent = String(zone.size);
        const terrainMode = state.editorTool === "terrain";
        const territoryMode = state.editorTool === "territory";
        const lightingMode = state.editorTool === "lighting";
        els.paintControls.hidden = !terrainMode;
        els.territoryControls.hidden = !territoryMode;
        els.lightingControls.hidden = !lightingMode;
        els.brushCategory.disabled = !terrainMode;
        els.brushType.disabled = !terrainMode;
        els.brushSize.disabled = !terrainMode;
        els.eraseBrush.disabled = !terrainMode;
        els.zoneSize.disabled = !["spawn", "zone"].includes(state.editorTool) || zone.shape === "custom";
        els.spawnPlayer.disabled = !["spawn", "zone"].includes(state.editorTool);
        els.zoneShape.disabled = !["spawn", "zone"].includes(state.editorTool);
        els.clearZone.hidden = state.editorTool !== "zone" || zone.shape !== "custom";
        if (territoryMode) loadTerritoryForm();
        if (lightingMode) syncLightingControls();
        canvas.style.cursor = state.editorTool === "spawn" ? "move" : "crosshair";
      }

      function moveSpawn(player, point) {
        const previous = { ...player.base };
        player.base = {
          x: clamp(point.x, 24, VW - 24),
          y: clamp(point.y, 24, VH - 24)
        };
        const zone = spawnZoneFor(player);
        if (zone.shape === "custom" && zone.points.length) {
          const dx = player.base.x - previous.x;
          const dy = player.base.y - previous.y;
          zone.points = zone.points.map(vertex => ({
            x: clamp(vertex.x + dx, 0, VW),
            y: clamp(vertex.y + dy, 0, VH)
          }));
        }
        const builders = state.units.filter(unit => unit.faction === player.id && unit.role === "builder");
        builders.forEach((unit, index) => {
          unit.x = clamp(player.base.x + index * 8, 24, VW - 24);
          unit.y = clamp(player.base.y + index * 8, 24, VH - 24);
        });
        rebuildRoadNetwork();
        state.cameraFocus = { ...player.base };
        els.editorTip.textContent = `P${player.index + 1} spawn moved to (${Math.round(player.base.x)}, ${Math.round(player.base.y)}) · ${zone.shape} zone`;
        draw();
      }

      function addCustomZonePoint(player, point) {
        const zone = spawnZoneFor(player);
        if (zone.shape !== "custom") {
          els.editorTip.textContent = "Choose Custom as the spawn-zone shape first.";
          return;
        }
        if (zone.points.length >= 12) zone.points = [];
        zone.points.push({ x: Math.round(point.x), y: Math.round(point.y) });
        els.editorTip.textContent = `P${player.index + 1} custom zone · ${zone.points.length} point${zone.points.length === 1 ? "" : "s"}${zone.points.length < 3 ? " · add at least 3" : ""}`;
        draw();
      }

      function enterEditor() {
        root.classList.remove("is-configuring");
        saveActivePlayerForm();
        const count = Number(els.playerCountSelect.value);
        state.players = setupPlayers.slice(0, count).map((player, index) => ({
          ...player,
          id: ids[index],
          index,
          base: { ...basePositions[index] }
        }));
        state.mapResolution = selectedResolution();
        state.scenario = "custom";
        resetBattle("custom", []);
        state.spawnPlayerId = state.players[0]?.id || "a";
        state.editorTool = "terrain";
        state.brushOpacity = 1;
        state.brushHardness = 1;
        state.brushFalloff = 0;
        state.brushShape = "circle";
        state.paintMode = "replace";
        setBrushOpacity(100);
        els.brushHardness.value = "100";
        els.brushHardnessValue.textContent = "100";
        els.brushFalloff.value = "0";
        els.brushFalloffValue.textContent = "0";
        els.brushShape.value = "circle";
        els.paintMode.value = "replace";
        populateSpawnPlayers();
        populateTerritoryOwners();
        rebuildTerritorySelect();
        state.mode = "editor";
        state.paused = true;
        state.replay = false;
        els.overlay.hidden = true;
        els.editorBar.hidden = false;
        els.editorTip.hidden = false;
        syncEditorControls();
        selectBrushPreset("grass");
        setInspector(false);
        setZoom(1);
        els.battleName.textContent = `Untitled theater / ${state.mapResolution.width} × ${state.mapResolution.height} pixel editor`;
        updatePauseButton();
        updateUI(true);
      }

      function updateBrushTypes() {
        const values = brushLayers[els.brushCategory.value] || brushLayers.Ground;
        els.brushType.textContent = "";
        for (const value of values) {
          const option = document.createElement("option");
          option.value = value;
          option.textContent = brushNames[value];
          els.brushType.append(option);
        }
        state.brush = els.brushType.value;
        state.erasing = false;
      }

      function pointerPosition(event) {
        const rect = canvas.getBoundingClientRect();
        const cssScale = Math.min(rect.width / canvas.width, rect.height / canvas.height);
        const renderedWidth = canvas.width * cssScale;
        const renderedHeight = canvas.height * cssScale;
        const offsetX = (rect.width - renderedWidth) / 2;
        const offsetY = (rect.height - renderedHeight) / 2;
        const localX = event.clientX - rect.left - offsetX;
        const localY = event.clientY - rect.top - offsetY;
        if (localX < 0 || localY < 0 || localX > renderedWidth || localY > renderedHeight) return null;
        const screenX = localX / renderedWidth * VW;
        const screenY = localY / renderedHeight * VH;
        return {
          x: clamp(state.camera.x + (screenX - VW / 2) / state.camera.zoom, 0, VW),
          y: clamp(state.camera.y + (screenY - VH / 2) / state.camera.zoom, 0, VH)
        };
      }

      function pixelProbe(point) {
        const info = terrainAt(point);
        const pixelX = Math.floor(point.x / VW * state.mapResolution.width);
        const pixelY = Math.floor(point.y / VH * state.mapResolution.height);
        const temperature = Math.round(26 - info.elevation * 1.4 - (info.moisture - 50) * 0.04);
        const owner = state.players.find(player => pointInSpawnZone(point, player));
        const ownerLabel = owner ? `P${owner.index + 1}` : "Neutral";
        const cover = info.cover >= 0.35 ? "High" : info.cover >= 0.16 ? "Medium" : info.cover > 0.05 ? "Light" : "None";
        els.editorTip.textContent = `Pixel (${pixelX}, ${pixelY}) · Terrain ${info.name} · Elevation ${info.elevation} · Moisture ${Math.round(info.moisture)}% · ${temperature}°C · Move ${(1 / info.speed).toFixed(2)} · Visibility ${info.detection.toFixed(2)} · Cover ${cover} · Owner ${ownerLabel}`;
      }

      function selectBrushPreset(type) {
        const isErase = type === "erase";
        state.erasing = isErase;
        if (isErase) {
          state.paintMode = "remove";
          els.paintMode.value = "remove";
        } else {
          if (state.paintMode === "remove") {
            state.paintMode = "replace";
            els.paintMode.value = "replace";
          }
          state.brush = type;
          const category = Object.keys(brushLayers).find(name => brushLayers[name].includes(type));
          if (category) {
            els.brushCategory.value = category;
            updateBrushTypes();
            els.brushType.value = type;
            state.brush = type;
          }
        }
        for (const button of root.querySelectorAll("[data-brush-preset]")) {
          const selected = button.dataset.brushPreset === type;
          button.setAttribute("aria-pressed", String(selected));
          button.classList.toggle("btn-primary", selected);
        }
        els.eraseBrush.setAttribute("aria-pressed", String(isErase));
        els.editorTip.textContent = `${isErase ? "Erase terrain" : brushNames[type] || type} · ${Math.round(state.brushOpacity * 100)}% · ${state.brushShape}`;
        draw();
      }

      function setBrushOpacity(value) {
        const percent = clamp(Math.round(Number(value) || 0), 0, 100);
        state.brushOpacity = percent / 100;
        els.brushOpacity.value = String(percent);
        els.brushOpacityNumber.value = String(percent);
        els.brushOpacityValue.textContent = String(percent);
        draw();
      }

      function applyBrush(point) {
        const lockedTerritory = territoryAt(point);
        if (lockedTerritory?.locked) {
          els.editorTip.textContent = `${lockedTerritory.name} is locked · painting blocked.`;
          return;
        }
        const mode = state.erasing ? "remove" : state.paintMode;
        if (mode === "sample") {
          const sampled = [...state.features].reverse().find(feature => Math.hypot(feature.x - point.x, feature.y - point.y) <= feature.r);
          if (sampled) selectBrushPreset(sampled.type);
          else els.editorTip.textContent = "No painted terrain under the eyedropper.";
          return;
        }
        if (mode === "remove") {
          const before = state.features.length;
          state.features = state.features.filter(feature => Math.hypot(feature.x - point.x, feature.y - point.y) > Math.max(feature.r, state.brushRadius) * 0.72);
          els.editorTip.textContent = `Erase terrain · ${before - state.features.length} layer${before - state.features.length === 1 ? "" : "s"} removed`;
          draw();
          return;
        }
        if (state.brushOpacity <= 0) {
          els.editorTip.textContent = "Opacity 0% · no terrain change.";
          return;
        }
        const type = state.brush;
        const spacing = Math.max(6, state.brushRadius * (state.brushShape === "line" ? 0.18 : 0.42));
        const existing = [...state.features].reverse().find(feature => feature.type === type && Math.hypot(feature.x - point.x, feature.y - point.y) < spacing);
        if (existing && mode === "add") {
          existing.opacity = clamp((existing.opacity ?? 1) + state.brushOpacity * 0.25, 0, 1);
          existing.condition = 1;
          pixelProbe(point);
          draw();
          return;
        }
        if (existing && mode !== "blend" && state.brushShape !== "line") {
          existing.opacity = Math.max(existing.opacity ?? 1, state.brushOpacity);
          existing.hardness = state.brushHardness;
          existing.falloff = state.brushFalloff;
          pixelProbe(point);
          draw();
          return;
        }
        if (mode === "replace") {
          state.features = state.features.filter(feature => {
            if (weatherTypes.has(feature.type)) return true;
            return Math.hypot(feature.x - point.x, feature.y - point.y) > Math.max(feature.r, state.brushRadius) * 0.62;
          });
        }
        const previous = state.lastBrushPoint || point;
        state.features.push({
          type,
          visual: visualForBrush(type),
          x: Math.round(state.brushShape === "line" ? previous.x : point.x),
          y: Math.round(state.brushShape === "line" ? previous.y : point.y),
          x2: Math.round(point.x),
          y2: Math.round(point.y),
          r: state.brushRadius,
          opacity: state.brushOpacity,
          hardness: state.brushHardness,
          falloff: state.brushFalloff,
          shape: state.brushShape,
          condition: 1,
          age: 0
        });
        state.lastBrushPoint = { ...point };
        pixelProbe(point);
        draw();
      }

      function beginRightPan(event) {
        if (!pointerPosition(event)) return false;
        state.panning = true;
        state.panPointerId = event.pointerId;
        state.panStart = {
          clientX: event.clientX,
          clientY: event.clientY,
          cameraX: state.camera.x,
          cameraY: state.camera.y
        };
        state.brushDown = false;
        canvas.setPointerCapture?.(event.pointerId);
        canvas.style.cursor = "grabbing";
        return true;
      }

      function updateRightPan(event) {
        if (!state.panning || !state.panStart) return;
        const rect = canvas.getBoundingClientRect();
        const cssScale = Math.min(rect.width / canvas.width, rect.height / canvas.height);
        const renderedWidth = canvas.width * cssScale;
        const renderedHeight = canvas.height * cssScale;
        const dx = (event.clientX - state.panStart.clientX) / renderedWidth * VW / state.camera.zoom;
        const dy = (event.clientY - state.panStart.clientY) / renderedHeight * VH / state.camera.zoom;
        state.camera.x = state.panStart.cameraX - dx;
        state.camera.y = state.panStart.cameraY - dy;
        clampCamera();
        state.cameraFocus = { x: state.camera.x, y: state.camera.y };
        if (state.mode === "editor") {
          els.editorTip.textContent = `Panning view · center (${Math.round(state.camera.x)}, ${Math.round(state.camera.y)})`;
        }
        draw();
      }

      function endRightPan(event) {
        if (!state.panning) return;
        if (event?.pointerId != null && state.panPointerId !== event.pointerId) return;
        try {
          if (state.panPointerId != null && canvas.hasPointerCapture?.(state.panPointerId)) canvas.releasePointerCapture(state.panPointerId);
        } catch {}
        state.panning = false;
        state.panPointerId = null;
        state.panStart = null;
        canvas.style.cursor = state.mode === "editor" && state.editorTool === "spawn" ? "move" : "crosshair";
      }

      canvas.addEventListener("pointerdown", event => {
        if (event.button === 2) {
          event.preventDefault();
          beginRightPan(event);
          return;
        }
        const point = pointerPosition(event);
        if (!point) return;
        state.cameraFocus = { ...point };
        if (state.mode === "editor") {
          const player = selectedSpawnPlayer();
          if (state.editorTool === "terrain") {
            state.brushDown = true;
            state.lastBrushPoint = null;
            canvas.setPointerCapture?.(event.pointerId);
            applyBrush(point);
          } else if (state.editorTool === "spawn" && player) {
            moveSpawn(player, point);
          } else if (state.editorTool === "zone" && player) {
            addCustomZonePoint(player, point);
          } else if (state.editorTool === "territory") {
            editTerritoryAtPoint(point);
          }
          return;
        }
        let best = null;
        let bestDistance = 24 / state.camera.zoom;
        for (const unit of state.units) {
          const view = unitView(unit);
          const d = Math.hypot(view.x - point.x, view.y - point.y);
          if (d < bestDistance) {
            best = unit;
            bestDistance = d;
          }
        }
        if (best) {
          state.selectedId = best.id;
          state.selectedStructureId = null;
          setInspector(true);
          updateUI(true);
          return;
        }
        const structure = state.structures
          .filter(item => item.progress >= 0.35)
          .sort((a, b) => distance(a, point) - distance(b, point))
          .find(item => {
            ensureStructureRuntime(item);
            return Math.abs(point.x - item.x) <= item.hitbox.w / 2 + 5 && Math.abs(point.y - item.y) <= item.hitbox.h / 2 + 5;
          });
        if (structure) {
          state.selectedStructureId = structure.id;
          state.logisticsPlayerId = structure.faction;
          setLogisticsPanel(true);
          updateUI(true);
        }
      });
      canvas.addEventListener("pointermove", event => {
        if (state.panning) {
          event.preventDefault();
          updateRightPan(event);
          return;
        }
        state.hover = pointerPosition(event);
        if (!state.hover) return;
        state.cameraFocus = { ...state.hover };
        if (state.mode === "editor") {
          if (state.editorTool === "terrain") {
            pixelProbe(state.hover);
            if (state.brushDown) applyBrush(state.hover);
          } else if (state.editorTool === "territory") {
            const territory = selectedTerritory();
            if (territory && state.territoryDragStart && (event.buttons & 1)) {
              const dx = state.hover.x - state.territoryDragStart.point.x;
              const dy = state.hover.y - state.territoryDragStart.point.y;
              territory.points = state.territoryDragStart.points.map(anchor => ({
                x: clamp(anchor.x + dx, 0, VW),
                y: clamp(anchor.y + dy, 0, VH)
              }));
              const center = territoryCenter(territory);
              els.editorTip.textContent = `Moving ${territory.name} · center (${Math.round(center.x)}, ${Math.round(center.y)})`;
              draw();
            } else if (territory && state.territoryDragIndex >= 0 && (event.buttons & 1)) {
              territory.points[state.territoryDragIndex] = { x: Math.round(state.hover.x), y: Math.round(state.hover.y) };
              draw();
            } else {
              els.editorTip.textContent = `${territory?.name || "Territory"} · ${state.territoryEditMode} · pixel (${Math.floor(state.hover.x / VW * state.mapResolution.width)}, ${Math.floor(state.hover.y / VH * state.mapResolution.height)})`;
            }
          } else {
            const pixelX = Math.floor(state.hover.x / VW * state.mapResolution.width);
            const pixelY = Math.floor(state.hover.y / VH * state.mapResolution.height);
            els.editorTip.textContent = `${state.editorTool === "spawn" ? "Move spawn" : "Custom zone point"} · pixel (${pixelX}, ${pixelY})`;
          }
        }
      });
      canvas.addEventListener("pointerup", event => {
        if (state.panning) endRightPan(event);
        state.brushDown = false;
        state.lastBrushPoint = null;
        state.territoryDragIndex = -1;
        state.territoryDragStart = null;
      });
      canvas.addEventListener("pointercancel", event => {
        endRightPan(event);
        state.brushDown = false;
        state.lastBrushPoint = null;
        state.territoryDragIndex = -1;
        state.territoryDragStart = null;
      });
      canvas.addEventListener("pointerleave", () => {
        state.brushDown = false;
        state.territoryDragStart = null;
        state.hover = null;
      });
      canvas.addEventListener("contextmenu", event => event.preventDefault());
      canvas.addEventListener("wheel", event => {
        event.preventDefault();
        const focus = pointerPosition(event) || state.cameraFocus;
        setZoom(state.camera.zoom + (event.deltaY < 0 ? 0.25 : -0.25), focus);
      }, { passive: false });

      root.querySelector("#awt-menu-button").addEventListener("click", showMainMenu);
      els.inspectorButton.addEventListener("click", () => setInspector(els.inspector.hidden));
      root.querySelector("#awt-inspector-close").addEventListener("click", () => setInspector(false));
      els.fullscreenButton.addEventListener("click", toggleFullscreen);
      els.fogButton.addEventListener("click", cycleFog);
      els.territoryToggle.addEventListener("click", () => {
        state.territoryOverlay = !state.territoryOverlay;
        els.territoryToggle.setAttribute("aria-pressed", String(state.territoryOverlay));
        els.territoryToggle.innerHTML = `<i data-lucide="map-pinned" aria-hidden="true"></i>Territory ${state.territoryOverlay ? "on" : "off"}`;
        if (window.lucide) lucide.createIcons({ attrs: { width: 16, height: 16 } });
        draw();
      });
      els.lightingToggle.addEventListener("click", () => {
        state.lighting.overlay = !state.lighting.overlay;
        updateLightingButton();
        draw();
      });
      els.logisticsButton.addEventListener("click", () => setLogisticsPanel(!state.logisticsOpen));
      els.logisticsClose.addEventListener("click", () => setLogisticsPanel(false));
      els.logisticsPlayer.addEventListener("change", () => {
        state.logisticsPlayerId = els.logisticsPlayer.value;
        state.selectedStructureId = null;
        updateLogisticsPanel();
        draw();
      });
      els.supplyRadiusToggle.addEventListener("change", () => {
        state.showSupplyRadii = els.supplyRadiusToggle.checked;
        draw();
      });
      els.roadsToggle.addEventListener("change", () => {
        state.showRoads = els.roadsToggle.checked;
        draw();
      });
      els.zoomOut.addEventListener("click", () => setZoom(state.camera.zoom - 0.25, state.cameraFocus));
      els.zoomIn.addEventListener("click", () => setZoom(state.camera.zoom + 0.25, state.cameraFocus));
      document.addEventListener("fullscreenchange", updateFullscreenButton);

      root.querySelector("#awt-create-map").addEventListener("click", () => {
        root.classList.add("is-configuring");
        els.mainActions.hidden = true;
        els.setupPanel.hidden = false;
      });
      root.querySelector("#awt-open-sprite-lab").addEventListener("click", () => {
        root.classList.add("is-configuring");
        els.mainActions.hidden = true;
        els.spritePanel.hidden = false;
        populateSpritePlayers();
        drawSpritePreview();
      });
      root.querySelector("#awt-sprite-back").addEventListener("click", () => {
        root.classList.remove("is-configuring");
        els.spritePanel.hidden = true;
        els.mainActions.hidden = false;
      });
      els.spriteFamily.addEventListener("change", populateSpriteVariants);
      els.spriteVariant.addEventListener("change", drawSpritePreview);
      els.spriteMode.addEventListener("change", drawSpritePreview);
      els.spritePlayer.addEventListener("change", drawSpritePreview);
      root.querySelector("#awt-setup-back").addEventListener("click", () => {
        root.classList.remove("is-configuring");
        els.setupPanel.hidden = true;
        els.mainActions.hidden = false;
      });
      root.querySelector("#awt-configure-players").addEventListener("click", () => {
        state.activeSetupPlayer = 0;
        els.setupPanel.hidden = true;
        els.playerPanel.hidden = false;
        loadActivePlayerForm();
      });
      root.querySelector("#awt-player-back").addEventListener("click", () => {
        saveActivePlayerForm();
        els.playerPanel.hidden = true;
        els.setupPanel.hidden = false;
      });
      root.querySelector("#awt-shape-map").addEventListener("click", enterEditor);
      els.mapResolution.addEventListener("change", () => {
        els.customResolution.hidden = els.mapResolution.value !== "custom";
      });
      els.playerCountSelect.addEventListener("change", () => {
        const count = Number(els.playerCountSelect.value);
        if (state.activeSetupPlayer >= count) state.activeSetupPlayer = 0;
        loadActivePlayerForm();
      });
      for (const button of root.querySelectorAll("[data-player-tab]")) {
        button.addEventListener("click", () => {
          saveActivePlayerForm();
          state.activeSetupPlayer = Number(button.dataset.playerTab);
          loadActivePlayerForm();
        });
      }
      els.playerRace.addEventListener("change", () => {
        populateFactionSelect(els.playerRace.value);
      });
      els.playerFaction.addEventListener("change", () => {
        populateFactionSelect(els.playerRace.value, els.playerFaction.value);
      });
      els.playerColor.addEventListener("input", () => {
        els.playerColorValue.textContent = els.playerColor.value.toUpperCase();
        saveActivePlayerForm();
        drawSpritePreview();
        draw();
      });
      els.playerSecondaryColor.addEventListener("input", () => {
        els.playerSecondaryColorValue.textContent = els.playerSecondaryColor.value.toUpperCase();
        saveActivePlayerForm();
        drawSpritePreview();
        draw();
      });
      els.playerPattern.addEventListener("change", () => {
        saveActivePlayerForm();
        draw();
      });

      root.querySelector("#awt-load-map").addEventListener("click", () => {
        els.mainActions.hidden = true;
        els.loadPanel.hidden = false;
      });
      root.querySelector("#awt-load-back").addEventListener("click", () => {
        els.loadPanel.hidden = true;
        els.mainActions.hidden = false;
      });
      for (const button of root.querySelectorAll("[data-scenario]")) {
        button.addEventListener("click", () => {
          state.players = setupPlayers.slice(0, 2).map((player, index) => ({ ...player, id: ids[index], index, base: { ...basePositions[index] } }));
          resetBattle(button.dataset.scenario);
          startSimulation();
        });
      }
      root.querySelector("#awt-quit").addEventListener("click", () => {
        els.mainActions.hidden = true;
        els.quitPanel.hidden = false;
        state.paused = true;
        updatePauseButton();
      });
      root.querySelector("#awt-return").addEventListener("click", () => {
        els.quitPanel.hidden = true;
        els.mainActions.hidden = false;
      });

      for (const layerName of Object.keys(brushLayers)) {
        const option = document.createElement("option");
        option.value = layerName;
        option.textContent = layerName;
        els.brushCategory.append(option);
      }
      updateBrushTypes();
      els.editorTool.addEventListener("change", () => {
        state.editorTool = els.editorTool.value;
        syncEditorControls();
        const player = selectedSpawnPlayer();
        const zone = player ? spawnZoneFor(player) : null;
        els.editorTip.textContent = state.editorTool === "terrain"
          ? `Terrain paint · ${brushNames[state.brush] || state.brush} · ${Math.round(state.brushOpacity * 100)}%`
          : state.editorTool === "spawn"
            ? `Click the map to move P${(player?.index ?? 0) + 1}'s spawn.`
            : state.editorTool === "territory"
              ? "Territory anchors ready · choose Pen, Add, Delete, Move, or Bend."
            : state.editorTool === "lighting"
              ? "Lighting map ready · configure the sun, weather, artificial lights, and faction materials."
            : zone?.shape === "custom"
              ? "Click the map to add custom zone points."
              : "Choose Custom as the spawn-zone shape first.";
        draw();
      });
      els.timeMode.addEventListener("change", () => {
        const currentHour = lightingHour();
        state.lighting.mode = els.timeMode.value;
        if (state.lighting.mode === "fixed") state.lighting.fixedHour = currentHour;
        else {
          state.lighting.startHour = currentHour;
          state.time = 0;
        }
        syncLightingControls();
        updateUI(true);
        draw();
      });
      els.timeOfDay.addEventListener("input", () => {
        const hour = Number(els.timeOfDay.value);
        if (state.lighting.mode === "fixed") state.lighting.fixedHour = hour;
        else {
          state.lighting.startHour = hour;
          state.time = 0;
        }
        els.timeOfDayValue.textContent = formatHour(hour);
        updateUI(true);
        draw();
      });
      els.dayLength.addEventListener("input", () => {
        state.lighting.dayLengthMinutes = Number(els.dayLength.value);
        els.dayLengthValue.textContent = els.dayLength.value;
        updateUI(true);
        draw();
      });
      els.latitude.addEventListener("input", () => {
        state.lighting.latitude = Number(els.latitude.value);
        els.latitudeValue.textContent = els.latitude.value;
        updateUI(true);
        draw();
      });
      els.season.addEventListener("change", () => {
        state.lighting.season = els.season.value;
        updateUI(true);
        draw();
      });
      els.lightingWeather.addEventListener("change", () => {
        state.lighting.weather = els.lightingWeather.value;
        invalidateLightingCaches();
        updateUI(true);
        draw();
      });
      els.enableLighting.addEventListener("change", () => {
        state.lighting.enabled = els.enableLighting.checked;
        invalidateLightingCaches();
        syncLightingControls();
        els.editorTip.textContent = state.lighting.enabled
          ? "Lighting restored · natural light, artificial sources, and optional shadows are active."
          : "Lighting removed · neutral visibility and shadow-free rendering are active.";
        updateUI(true);
        draw();
      });
      els.castShadows.addEventListener("change", () => {
        state.lighting.shadows = els.castShadows.checked;
        invalidateLightingCaches();
        els.editorTip.textContent = state.lighting.shadows ? "Dynamic cast shadows enabled." : "Cast shadows removed from terrain, buildings, units, and gameplay visibility.";
        updateUI(true);
        draw();
      });
      els.lightingOverlay.addEventListener("change", () => {
        state.lighting.overlay = els.lightingOverlay.checked;
        invalidateLightingCaches();
        updateLightingButton();
        draw();
      });
      els.artificialLights.addEventListener("change", () => {
        state.lighting.artificial = els.artificialLights.checked;
        invalidateLightingCaches();
        draw();
      });
      els.buildingColors.addEventListener("change", () => {
        state.lighting.buildingColors = els.buildingColors.checked;
        draw();
      });
      els.colorIntensity.addEventListener("input", () => {
        state.lighting.colorIntensity = Number(els.colorIntensity.value) / 100;
        els.colorIntensityValue.textContent = els.colorIntensity.value;
        draw();
      });
      els.factionPreservation.addEventListener("change", () => {
        state.lighting.factionPreservation = els.factionPreservation.value;
        draw();
      });
      els.teamEmblems.addEventListener("change", () => {
        state.lighting.teamEmblems = els.teamEmblems.checked;
        draw();
      });
      els.accessibilityPatterns.addEventListener("change", () => {
        state.lighting.accessibilityPatterns = els.accessibilityPatterns.checked;
        draw();
      });
      els.spawnPlayer.addEventListener("change", () => {
        state.spawnPlayerId = els.spawnPlayer.value;
        const player = selectedSpawnPlayer();
        if (player) {
          state.cameraFocus = { ...player.base };
          if (state.camera.zoom > 1) {
            state.camera.x = player.base.x;
            state.camera.y = player.base.y;
            clampCamera();
          }
        }
        syncEditorControls();
        draw();
      });
      els.zoneShape.addEventListener("change", () => {
        const player = selectedSpawnPlayer();
        if (!player) return;
        const zone = spawnZoneFor(player);
        zone.shape = els.zoneShape.value;
        if (zone.shape === "custom" && zone.points.length < 3) zone.points = defaultCustomZone(player);
        syncEditorControls();
        els.editorTip.textContent = `P${player.index + 1} spawn zone · ${zone.shape}${zone.shape === "custom" ? ` · ${zone.points.length} points` : ` · ${zone.size} px`}`;
        draw();
      });
      els.zoneSize.addEventListener("input", () => {
        const player = selectedSpawnPlayer();
        if (!player) return;
        const zone = spawnZoneFor(player);
        zone.size = Number(els.zoneSize.value);
        els.zoneSizeValue.textContent = String(zone.size);
        draw();
      });
      els.clearZone.addEventListener("click", () => {
        const player = selectedSpawnPlayer();
        if (!player) return;
        spawnZoneFor(player).points = [];
        els.editorTip.textContent = `P${player.index + 1} custom zone cleared · click at least 3 new points.`;
        draw();
      });
      els.brushCategory.addEventListener("change", updateBrushTypes);
      els.brushType.addEventListener("change", () => {
        state.brush = els.brushType.value;
        state.erasing = false;
        const matchingPreset = root.querySelector(`[data-brush-preset="${state.brush}"]`);
        if (matchingPreset) selectBrushPreset(state.brush);
        else {
          for (const button of root.querySelectorAll("[data-brush-preset]")) {
            button.setAttribute("aria-pressed", "false");
            button.classList.remove("btn-primary");
          }
          draw();
        }
      });
      for (const button of root.querySelectorAll("[data-brush-preset]")) {
        button.addEventListener("click", () => selectBrushPreset(button.dataset.brushPreset));
      }
      els.brushSize.addEventListener("input", () => {
        state.brushRadius = Number(els.brushSize.value);
        els.brushSizeValue.textContent = String(state.brushRadius);
        draw();
      });
      els.brushOpacity.addEventListener("input", () => setBrushOpacity(els.brushOpacity.value));
      els.brushOpacityNumber.addEventListener("input", () => setBrushOpacity(els.brushOpacityNumber.value));
      els.brushHardness.addEventListener("input", () => {
        state.brushHardness = Number(els.brushHardness.value) / 100;
        els.brushHardnessValue.textContent = els.brushHardness.value;
        draw();
      });
      els.brushFalloff.addEventListener("input", () => {
        state.brushFalloff = Number(els.brushFalloff.value) / 100;
        els.brushFalloffValue.textContent = els.brushFalloff.value;
        draw();
      });
      els.brushShape.addEventListener("change", () => {
        state.brushShape = els.brushShape.value;
        draw();
      });
      els.paintMode.addEventListener("change", () => {
        state.paintMode = els.paintMode.value;
        state.erasing = state.paintMode === "remove";
        if (state.erasing) selectBrushPreset("erase");
        else if (els.eraseBrush.getAttribute("aria-pressed") === "true") selectBrushPreset(state.brush);
      });
      document.addEventListener("keydown", event => {
        if (state.mode !== "editor" || state.editorTool !== "terrain" || event.ctrlKey || event.metaKey || event.altKey) return;
        if (["INPUT", "SELECT", "TEXTAREA"].includes(event.target?.tagName)) return;
        const button = [...root.querySelectorAll("[data-shortcut]")].find(candidate => candidate.dataset.shortcut === event.key.toLowerCase());
        if (button) {
          event.preventDefault();
          selectBrushPreset(button.dataset.brushPreset);
        }
      });

      els.territorySelect.addEventListener("change", () => {
        state.selectedTerritoryId = els.territorySelect.value;
        loadTerritoryForm();
        draw();
      });
      els.territoryEditMode.addEventListener("change", () => {
        state.territoryEditMode = els.territoryEditMode.value;
        if (state.territoryEditMode === "translate") {
          els.editorTip.textContent = "Move territory · drag from anywhere inside the selected border.";
          return;
        }
        els.editorTip.textContent = `Territory anchor tool · ${state.territoryEditMode}`;
      });
      const territoryPropertyControls = [
        els.territoryName, els.territoryOwner, els.territoryResource, els.territoryStrategic,
        els.territoryDefense, els.territoryCapture, els.territoryStructures, els.territoryMaxStructures,
        els.territorySupply, els.territoryAbandon, els.territoryShare, els.territoryUnclaimable, els.territoryLocked
      ];
      territoryPropertyControls.forEach(control => control.addEventListener("change", saveTerritoryForm));
      root.querySelector("#awt-new-territory").addEventListener("click", () => {
        const center = state.cameraFocus || { x: VW / 2, y: VH / 2 };
        const territory = createTerritory("", center, 64, {
          name: `Territory ${state.nextTerritoryId - 1}`,
          points: [],
          status: "neutral",
          reason: "Map creator"
        });
        state.territories.push(territory);
        state.selectedTerritoryId = territory.id;
        state.territoryEditMode = "pen";
        rebuildTerritorySelect();
        loadTerritoryForm();
        els.editorTip.textContent = "New territory · click the map to add anchor points.";
        draw();
      });
      root.querySelector("#awt-close-territory").addEventListener("click", () => {
        const territory = selectedTerritory();
        if (!territory) return;
        els.editorTip.textContent = territory.points.length >= 3
          ? `${territory.name} closed with ${territory.points.length} anchors.`
          : `${territory.name} needs at least 3 anchors.`;
        draw();
      });
      root.querySelector("#awt-duplicate-territory").addEventListener("click", () => {
        const territory = selectedTerritory();
        if (!territory) return;
        const copy = createTerritory(territory.owner, territoryCenter(territory), 60, {
          ...territory,
          id: `territory-${state.nextTerritoryId - 1}`,
          name: `${territory.name} copy`,
          points: territory.points.map(point => ({ x: clamp(point.x + 18, 0, VW), y: clamp(point.y + 18, 0, VH) })),
          locked: false
        });
        state.territories.push(copy);
        state.selectedTerritoryId = copy.id;
        rebuildTerritorySelect();
        loadTerritoryForm();
        draw();
      });
      root.querySelector("#awt-delete-territory").addEventListener("click", () => {
        const territory = selectedTerritory();
        if (!territory || territory.locked) return;
        state.territories = state.territories.filter(item => item.id !== territory.id);
        state.selectedTerritoryId = state.territories[0]?.id || null;
        rebuildTerritorySelect();
        loadTerritoryForm();
        draw();
      });
      els.randomizeMap.addEventListener("click", randomizeMap);
      root.querySelector("#awt-clear-map").addEventListener("click", () => {
        state.features = [];
        els.editorTip.textContent = "Map cleared · every pixel reset to neutral ground data.";
      });
      root.querySelector("#awt-deploy-map").addEventListener("click", () => {
        state.incidents = [];
        state.snapshots = [];
        state.nextSnapshot = 0;
        captureSnapshot();
        startSimulation();
      });

      els.attachButton.addEventListener("click", () => {
        const source = state.units.find(unit => unit.id === state.selectedId);
        const target = state.units.find(unit => unit.id === els.attachSelect.value);
        attachUnits(source, target);
      });
      els.unitSelect.addEventListener("change", () => {
        state.selectedId = els.unitSelect.value;
        updateUI(true);
      });
      els.pause.addEventListener("click", () => {
        if (state.mode === "menu" || state.mode === "editor") return;
        if (state.replay) {
          state.replay = false;
          state.replayIndex = Math.max(0, state.snapshots.length - 1);
          els.timeline.value = String(state.replayIndex);
        }
        state.paused = !state.paused;
        state.lastFrame = performance.now();
        updatePauseButton();
      });
      els.timeline.addEventListener("input", () => {
        const last = Math.max(0, state.snapshots.length - 1);
        state.replayIndex = clamp(Number(els.timeline.value), 0, last);
        state.replay = state.replayIndex < last;
        state.paused = true;
        updatePauseButton();
        updateUI(true);
      });
      for (const button of root.querySelectorAll("[data-speed]")) {
        button.addEventListener("click", () => {
          state.speed = Number(button.dataset.speed);
          for (const speedButton of root.querySelectorAll("[data-speed]")) {
            const selected = speedButton === button;
            speedButton.setAttribute("aria-pressed", String(selected));
            speedButton.classList.toggle("btn-primary", selected);
          }
          updateUI(true);
        });
      }

      for (const race of Object.keys(raceCatalog)) {
        const option = document.createElement("option");
        option.value = race;
        option.textContent = race;
        els.playerRace.append(option);
      }
      for (const family of Object.keys(spriteCatalog)) {
        const option = document.createElement("option");
        option.value = family;
        option.textContent = family;
        els.spriteFamily.append(option);
      }
      populateSpritePlayers();
      populateSpriteVariants();
      loadActivePlayerForm();

      function frame(now) {
        const rawDt = Math.min(0.25, (now - state.lastFrame) / 1000);
        state.lastFrame = now;
        if (!state.paused && state.mode === "sim" && !state.replay) {
          const simulationStep = 1 / 20;
          state.simulationAccumulator = Math.min(0.6, state.simulationAccumulator + rawDt * state.speed);
          let steps = 0;
          const maxSteps = state.speed >= 8 ? 40 : state.speed >= 4 ? 20 : 10;
          while (state.simulationAccumulator >= simulationStep && steps < maxSteps) {
            updateBattle(simulationStep);
            state.simulationAccumulator -= simulationStep;
            steps += 1;
          }
          if (steps >= maxSteps) state.simulationAccumulator = Math.min(state.simulationAccumulator, simulationStep * 2);
        } else {
          state.simulationAccumulator = 0;
        }
        state.uiAccumulator += rawDt;
        state.renderAccumulator += rawDt;
        const renderInterval = state.speed >= 8 ? 1 / 6 : 1 / 30;
        if (state.renderAccumulator >= renderInterval) {
          draw();
          state.renderAccumulator %= renderInterval;
        }
        if (state.uiAccumulator >= (state.speed >= 8 ? 0.5 : 0.25)) updateUI();
        requestAnimationFrame(frame);
      }

      resetBattle("iron");
      showMainMenu();
      draw();
      updateUI(true);
      updateFullscreenButton();
      updateFogButton();
      updateLightingButton();
      if (window.lucide) lucide.createIcons({ attrs: { width: 16, height: 16 } });
      new MutationObserver(() => {
        refreshColors();
        drawSpritePreview();
      }).observe(root, { attributes: true, subtree: false });
      requestAnimationFrame(frame);
    })();
  
