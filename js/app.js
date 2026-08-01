
    (() => {
      const root = document.getElementById("autonomous-war-theater");
      if (!root || root.dataset.foundryReady === "true") return;
      root.dataset.foundryReady = "true";
      window.addEventListener("error", event => {
        root.dataset.runtimeError = `${event.message || "Runtime error"}${event.lineno ? ` @ ${event.lineno}:${event.colno || 0}` : ""}`;
      });
      window.addEventListener("unhandledrejection", event => {
        root.dataset.runtimeError = `Unhandled promise: ${event.reason?.message || String(event.reason || "unknown")}`;
      });

      const canvas = root.querySelector("#awt-canvas");
      const ctx = canvas.getContext("2d");
      const economyConfig = window.AWTModules?.economy || {};
      const tradeRouteRules = window.AWTModules?.tradeRoutes || {};
      const aiConfig = window.AWTModules?.ai || {};
      const environmentConfig = window.AWTModules?.environment || { profiles: {}, coverValues: { none: 0, light: 0.12, medium: 0.24, heavy: 0.42 } };
      root.dataset.spriteForge = window.AWTModules?.unitSpriteForge ? "marine-guard-ork" : "fallback";
      const VW = 1920;
      const VH = 1080;
      const TILE_SIZE = 64;
      const CHUNK_SIZE = 256;
      const TERRITORY_CELL_SIZE = 96;
      const FOG_CELL_SIZE = TILE_SIZE;
      const UNIT_DEATH_ANIMATION_SECONDS = 1.35;
      const STRUCTURE_DEATH_ANIMATION_SECONDS = 1.9;
      const DEFAULT_WORLD_SIZE = 16384;
      const ZOOM_STOPS = [0.1, 0.25, 0.5, 1, 2, 4];
      const ids = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l"];
      function deploymentPosition(index, count = ids.length, world = { width: DEFAULT_WORLD_SIZE, height: DEFAULT_WORLD_SIZE }) {
        const angle = -Math.PI / 2 + index * Math.PI * 2 / Math.max(1, count);
        const radiusX = Math.max(640, Math.min(world.width * 0.3, world.width / 2 - 320));
        const radiusY = Math.max(640, Math.min(world.height * 0.3, world.height / 2 - 320));
        return {
          x: clamp(world.width / 2 + Math.cos(angle) * radiusX, 160, world.width - 160),
          y: clamp(world.height / 2 + Math.sin(angle) * radiusY, 160, world.height - 160)
        };
      }
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
        zoomLevel: root.querySelector("#awt-zoom-level"),
        zoomValue: root.querySelector("#awt-zoom-value"),
        cameraStatus: root.querySelector("#awt-camera-status"),
        minimap: root.querySelector("#awt-minimap"),
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
      const minimapCtx = els.minimap.getContext("2d");
      const minimapTerrainLayer = document.createElement("canvas");
      minimapTerrainLayer.width = els.minimap.width;
      minimapTerrainLayer.height = els.minimap.height;
      const minimapTerrainCtx = minimapTerrainLayer.getContext("2d");
      const minimapMarkerLayer = document.createElement("canvas");
      minimapMarkerLayer.width = els.minimap.width;
      minimapMarkerLayer.height = els.minimap.height;
      const minimapMarkerCtx = minimapMarkerLayer.getContext("2d");

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
          builder: "Gretchin",
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
          builder: "Ripper Tendril",
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
        "Rocks & urban": ["road", "ruins", "crates", "barricade", "wreck", "building", "factory", "spaceport", "landingpad", "powerplant", "civilian"],
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
        road: "Road", bridge: "Bridge", ruins: "Ruins", crates: "Crates", barricade: "Barricade", wreck: "Vehicle wreck", building: "Building", wall: "Wall",
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
          deployment: "Spore patches, ramshackle camps, mobs and Trukks",
          buildings: { outpost: "Boss Hut", barracks: "Boyz Hut", workshop: "Mek Shop", researchcenter: "Big Mek's Workshop", fieldhospital: "Painboy Hut", generator: "Kustom Generator", warehouse: "Dakka Dump", fueldepot: "Fuel Gubbinz", ammodepot: "Dakka Dump", mine: "Scrap Pile", farm: "Squig Pen", refinery: "Lootin' Yard", dropbay: "Tellyporta Pad", observationtower: "Watcha Tower", bunker: "Waaagh! Banner", turret: "Big Gunz Nest" },
          roster: { builder: ["Gretchin"], trooper: ["Gretchin", "Slugga Boy", "Shoota Boy", "Burna Boy", "Tankbusta"], scout: ["Kommando"], medic: ["Painboy"], engineer: ["Mekboy", "Big Mek"], commander: ["Boss Nob", "Warboss"], standard: ["Waaagh! Banner Nob"], vehicle: ["Trukk", "Battlewagon", "Deff Dread", "Killa Kan"] }
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
          deployment: "Mycetic Spores, Tyrannocytes, brood nests, tunnels and infestation zones",
          buildings: { outpost: "Synaptic Hive Node", barracks: "Brood Nest", workshop: "Norn Gestation Chamber", researchcenter: "Evolutionary Chamber", fieldhospital: "Synapse Spire", generator: "Digestion Pool", warehouse: "Feeder Organism Cluster", mine: "Infestation Node", farm: "Reclamation Pool", refinery: "Capillary Tower", dropbay: "Aerial Brood Sac", observationtower: "Sensory Tendril Cluster", bunker: "Spore Chimney", turret: "Biovore Nest" },
          roster: { builder: ["Ripper Tendril"], trooper: ["Termagant", "Hormagaunt", "Genestealer", "Tyranid Warrior"], scout: ["Gargoyle", "Ravener"], medic: ["Feeder Organism"], engineer: ["Ripper Tendril"], commander: ["Tyranid Prime", "Neurotyrant", "Hive Tyrant"], standard: ["Synapse Organism"], vehicle: ["Carnifex", "Trygon", "Exocrine", "Tyrannofex"] }
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
      const formationTypes = aiConfig.formations || ["line", "column", "wedge", "triangle", "circle", "staggered", "flanking", "escort"];
      const routeOrderTypes = aiConfig.routeOrders || ["Hold Route", "Block Route", "Patrol Route", "Observe Route", "Escort Route", "Keep Route Open", "Delay Enemy", "Destroy Route if Overrun", "Ambush Route"];
      const relationshipBands = aiConfig.relationshipBands || [
        { min: 70, label: "Strong bond" }, { min: 30, label: "Friendly" }, { min: 10, label: "Familiar" },
        { min: -9, label: "Neutral" }, { min: -29, label: "Not close" }, { min: -69, label: "Disliked" }, { min: -100, label: "Hated but tolerated" }
      ];
      const relationshipEvents = aiConfig.relationshipEvents || {};
      const namesA = ["Cassian", "Aelius", "Marius", "Lucan", "Titus", "Varro", "Sabian", "Corvin", "Drusus", "Acastus", "Decimus", "Silan"];
      const namesB = ["Rakka", "Gorz", "Skarn", "Vek", "Drokk", "Mazza", "Krag", "Thrum", "Zagga", "Brukk", "Morkai", "Grim"];

      const presets = {
        iron: {
          name: "Iron Pass",
          startMinute: 420,
          world: { width: 16384, height: 16384 },
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
          world: { width: 32768, height: 32768 },
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
          world: { width: 8192, height: 8192 },
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
        world: {
          width: DEFAULT_WORLD_SIZE,
          height: DEFAULT_WORLD_SIZE,
          tileSize: TILE_SIZE,
          chunkSize: CHUNK_SIZE,
          baseTerrain: "grass"
        },
        terrainChunks: new Map(),
        featureChunks: new Map(),
        shadowFeatureChunks: new Map(),
        featureIndexDirty: true,
        featureEditDirty: false,
        minimapTerrainDirty: true,
        minimapTerrainUpdatedAt: 0,
        minimapMarkerDirty: true,
        minimapMarkerUpdatedAt: 0,
        minimapMarkerCount: 0,
        visibleChunkCount: 0,
        renderedObjectCount: 0,
        players: setupPlayers.slice(0, 2).map((player, index) => ({ ...player, base: deploymentPosition(index, 2) })),
        units: [],
        structures: [],
        squads: [],
        projectiles: [],
        features: [],
        incidents: [],
        snapshots: [],
        selectedId: null,
        hover: null,
        camera: { x: DEFAULT_WORLD_SIZE / 2, y: DEFAULT_WORLD_SIZE / 2, zoom: 1, rotation: 0 },
        cameraFocus: { x: DEFAULT_WORLD_SIZE / 2, y: DEFAULT_WORLD_SIZE / 2 },
        panning: false,
        panPointerId: null,
        panStart: null,
        spaceHeld: false,
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
        roadSpatialIndex: new Map(),
        roadRevision: 0,
        nextConvoyId: 1,
        nextDropPodId: 1,
        nextLogisticsTick: 0,
        logisticsOpen: false,
        logisticsPlayerId: "a",
        showSupplyRadii: true,
        showRoads: true,
        casualties: {},
        deathRemovalStats: { units: 0, structures: 0 },
        adapted: {},
        nextUnitIndex: {},
        nextTrain: {},
        nextSquadId: 1,
        armyPlans: {},
        factionEcology: {},
        strategicOutcomes: {},
        victoryEvaluationAccumulator: 0,
        aiDiagnostics: { relationshipEdges: 0, killPursuits: 0, formationSquads: 0, routeOrders: 0, guardSquads: 0, securedRoads: 0, ambushRoads: 0, checkpoints: 0, environmentCollisions: 0, obstacleProjectileHits: 0 },
        nextSnapshot: 0,
        nextEconomy: 0,
        nextMilestone: 240,
        battleSeed: "AWT-742918",
        simulationAccumulator: 0,
        spatialAccumulator: 0,
        socialAccumulator: 0,
        squadAIAccumulator: 0,
        commanderAIAccumulator: 0,
        armyAIAccumulator: 0,
        roadAIAccumulator: 0,
        factionAIAccumulator: 0,
        spatialGrid: new Map(),
        spatialMembership: new WeakMap(),
        lastFrame: performance.now(),
        uiAccumulator: 0,
        renderAccumulator: 0,
        fastStepAccumulator: 0,
        fastUnitPhase: 0,
        environmentAccumulator: 0,
        separationAccumulator: 0,
        explorationAccumulator: 0,
        ended: false,
        fogPlayer: "observer",
        explored: {},
        visibleFogChunks: {},
        exploredFogCells: {},
        visibleFogCells: {},
        teamFogVisibility: new Map(),
        activeSetupPlayer: 0
      };
      root.awtDebugState = state;
      window.awtDebugState = state;

      const worldWidth = () => state.world.width;
      const worldHeight = () => state.world.height;
      const worldCenter = () => ({ x: worldWidth() / 2, y: worldHeight() / 2 });
      const chunkKey = (x, y) => `${x},${y}`;
      const tileKey = (x, y) => `${x},${y}`;

      function createFogCellMask() {
        const columns = Math.max(1, Math.ceil(worldWidth() / FOG_CELL_SIZE));
        const rows = Math.max(1, Math.ceil(worldHeight() / FOG_CELL_SIZE));
        const data = new Uint8Array(columns * rows);
        const indices = [];
        return {
          columns,
          rows,
          data,
          indices,
          size: 0,
          addCell(x, y) {
            if (x < 0 || y < 0 || x >= columns || y >= rows) return false;
            const index = y * columns + x;
            if (data[index]) return false;
            data[index] = 1;
            indices.push(index);
            this.size += 1;
            return true;
          },
          hasCell(x, y) {
            return x >= 0 && y >= 0 && x < columns && y < rows && Boolean(data[y * columns + x]);
          },
          clear() {
            for (const index of indices) data[index] = 0;
            indices.length = 0;
            this.size = 0;
          },
          unionFrom(other) {
            if (!other || other.columns !== columns || other.rows !== rows) return;
            for (const index of other.indices) {
              if (data[index]) continue;
              data[index] = 1;
              indices.push(index);
              this.size += 1;
            }
          }
        };
      }

      function isFogCellMask(value) {
        return Boolean(value?.data instanceof Uint8Array && typeof value.hasCell === "function");
      }

      function fitWorldZoom() {
        return Math.min(VW / worldWidth(), VH / worldHeight());
      }

      function cameraBounds(buffer = 0) {
        const halfWidth = VW / (2 * state.camera.zoom);
        const halfHeight = VH / (2 * state.camera.zoom);
        return {
          left: Math.max(0, state.camera.x - halfWidth - buffer),
          top: Math.max(0, state.camera.y - halfHeight - buffer),
          right: Math.min(worldWidth(), state.camera.x + halfWidth + buffer),
          bottom: Math.min(worldHeight(), state.camera.y + halfHeight + buffer)
        };
      }

      function chunkRangeForBounds(bounds) {
        const columns = Math.max(1, Math.ceil(worldWidth() / CHUNK_SIZE));
        const rows = Math.max(1, Math.ceil(worldHeight() / CHUNK_SIZE));
        return {
          minX: clamp(Math.floor(bounds.left / CHUNK_SIZE), 0, columns - 1),
          maxX: clamp(Math.floor(Math.max(bounds.left, bounds.right - 0.0001) / CHUNK_SIZE), 0, columns - 1),
          minY: clamp(Math.floor(bounds.top / CHUNK_SIZE), 0, rows - 1),
          maxY: clamp(Math.floor(Math.max(bounds.top, bounds.bottom - 0.0001) / CHUNK_SIZE), 0, rows - 1)
        };
      }

      function gridRangeForBounds(bounds, cellSize) {
        const columns = Math.max(1, Math.ceil(worldWidth() / cellSize));
        const rows = Math.max(1, Math.ceil(worldHeight() / cellSize));
        return {
          minX: clamp(Math.floor(bounds.left / cellSize), 0, columns - 1),
          maxX: clamp(Math.floor(Math.max(bounds.left, bounds.right - 0.0001) / cellSize), 0, columns - 1),
          minY: clamp(Math.floor(bounds.top / cellSize), 0, rows - 1),
          maxY: clamp(Math.floor(Math.max(bounds.top, bounds.bottom - 0.0001) / cellSize), 0, rows - 1)
        };
      }

      function boundsIntersect(a, b) {
        return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;
      }

      function pointVisible(point, padding = 96, bounds = cameraBounds()) {
        return point.x >= bounds.left - padding && point.x <= bounds.right + padding
          && point.y >= bounds.top - padding && point.y <= bounds.bottom + padding;
      }

      function circleVisible(point, radius = 0, bounds = cameraBounds()) {
        return point.x + radius >= bounds.left && point.x - radius <= bounds.right
          && point.y + radius >= bounds.top && point.y - radius <= bounds.bottom;
      }

      function pointsVisible(points, padding = 0, bounds = cameraBounds()) {
        if (!points?.length) return false;
        const xs = points.map(point => point.x);
        const ys = points.map(point => point.y);
        return boundsIntersect(bounds, {
          left: Math.min(...xs) - padding,
          right: Math.max(...xs) + padding,
          top: Math.min(...ys) - padding,
          bottom: Math.max(...ys) + padding
        });
      }

      function worldToCanvas(point) {
        return {
          x: ((point.x - state.camera.x) * state.camera.zoom + VW / 2) * canvas.width / VW,
          y: ((point.y - state.camera.y) * state.camera.zoom + VH / 2) * canvas.height / VH
        };
      }

      function setWorldSize(width, height) {
        const safeWidth = clamp(Math.round((Number(width) || DEFAULT_WORLD_SIZE) / TILE_SIZE) * TILE_SIZE, 2048, 65536);
        const safeHeight = clamp(Math.round((Number(height) || DEFAULT_WORLD_SIZE) / TILE_SIZE) * TILE_SIZE, 2048, 65536);
        state.world.width = safeWidth;
        state.world.height = safeHeight;
        state.terrainChunks = new Map();
        state.featureChunks = new Map();
        state.shadowFeatureChunks = new Map();
        state.featureIndexDirty = true;
        state.featureEditDirty = false;
        state.minimapTerrainDirty = true;
        state.minimapTerrainUpdatedAt = 0;
        state.minimapMarkerDirty = true;
        state.minimapMarkerUpdatedAt = 0;
        canvas.width = VW;
        canvas.height = VH;
        canvas.style.aspectRatio = `${VW} / ${VH}`;
        canvas.setAttribute("aria-label", `A ${VW} by ${VH} camera viewport looking into a ${safeWidth} by ${safeHeight} chunked battlefield.`);
      }

      function terrainChunkAt(chunkX, chunkY, create = false) {
        const key = chunkKey(chunkX, chunkY);
        let chunk = state.terrainChunks.get(key);
        if (!chunk && create) {
          chunk = { x: chunkX, y: chunkY, tiles: new Map(), dirty: true };
          state.terrainChunks.set(key, chunk);
        }
        return chunk;
      }

      function terrainTileAt(point) {
        const tileX = clamp(Math.floor(point.x / TILE_SIZE), 0, Math.ceil(worldWidth() / TILE_SIZE) - 1);
        const tileY = clamp(Math.floor(point.y / TILE_SIZE), 0, Math.ceil(worldHeight() / TILE_SIZE) - 1);
        const chunk = terrainChunkAt(Math.floor(tileX * TILE_SIZE / CHUNK_SIZE), Math.floor(tileY * TILE_SIZE / CHUNK_SIZE));
        return chunk?.tiles.get(tileKey(tileX, tileY)) || { type: state.world.baseTerrain, opacity: 1 };
      }

      function setTerrainTile(tileX, tileY, value) {
        if (tileX < 0 || tileY < 0 || tileX * TILE_SIZE >= worldWidth() || tileY * TILE_SIZE >= worldHeight()) return;
        const chunk = terrainChunkAt(Math.floor(tileX * TILE_SIZE / CHUNK_SIZE), Math.floor(tileY * TILE_SIZE / CHUNK_SIZE), true);
        const key = tileKey(tileX, tileY);
        if (!value || value.type === state.world.baseTerrain) chunk.tiles.delete(key);
        else chunk.tiles.set(key, value);
        chunk.dirty = true;
        state.minimapTerrainDirty = true;
        if (!chunk.tiles.size) state.terrainChunks.delete(chunkKey(chunk.x, chunk.y));
      }

      function isTileTerrainType(type) {
        return brushLayers.Ground.includes(type) || ["water", "shallowwater", "deepwater", "river", "beach", "ice", "lava"].includes(type);
      }

      function paintTerrainTiles(point, type, mode) {
        const radius = Math.max(TILE_SIZE * 0.55, state.brushRadius);
        const previous = state.lastBrushPoint;
        const segmentLength = previous ? Math.hypot(point.x - previous.x, point.y - previous.y) : 0;
        const steps = previous ? Math.max(1, Math.ceil(segmentLength / (TILE_SIZE * 0.45))) : 0;
        const changed = new Set();
        for (let step = 0; step <= steps; step += 1) {
          const progress = steps ? step / steps : 1;
          const stamp = previous ? {
            x: previous.x + (point.x - previous.x) * progress,
            y: previous.y + (point.y - previous.y) * progress
          } : point;
          const minTileX = Math.floor((stamp.x - radius) / TILE_SIZE);
          const maxTileX = Math.floor((stamp.x + radius) / TILE_SIZE);
          const minTileY = Math.floor((stamp.y - radius) / TILE_SIZE);
          const maxTileY = Math.floor((stamp.y + radius) / TILE_SIZE);
          for (let tileY = minTileY; tileY <= maxTileY; tileY += 1) {
            for (let tileX = minTileX; tileX <= maxTileX; tileX += 1) {
              const center = { x: (tileX + 0.5) * TILE_SIZE, y: (tileY + 0.5) * TILE_SIZE };
              const edgeDistance = state.brushShape === "square"
                ? Math.max(Math.abs(center.x - stamp.x), Math.abs(center.y - stamp.y)) / radius
                : Math.hypot(center.x - stamp.x, center.y - stamp.y) / (radius + TILE_SIZE * 0.45);
              if (edgeDistance > 1) continue;
              const hardness = clamp(state.brushHardness, 0, 1);
              const edgeStrength = edgeDistance <= hardness
                ? 1
                : clamp((1 - edgeDistance) / Math.max(0.0001, 1 - hardness), 0, 1);
              const strength = state.brushOpacity * Math.pow(edgeStrength, 1 + state.brushFalloff * 3);
              if (strength <= 0.01) continue;
              const chunk = terrainChunkAt(Math.floor(tileX * TILE_SIZE / CHUNK_SIZE), Math.floor(tileY * TILE_SIZE / CHUNK_SIZE));
              const existing = chunk?.tiles.get(tileKey(tileX, tileY));
              if (mode === "remove") {
                if (!existing) continue;
                const nextOpacity = (existing.opacity ?? 1) * (1 - strength);
                setTerrainTile(tileX, tileY, nextOpacity <= 0.03 ? null : { ...existing, opacity: nextOpacity });
              } else if (mode === "add" && existing) {
                if (existing.type !== type && (existing.opacity ?? 1) >= strength) continue;
                const nextOpacity = existing.type === type
                  ? 1 - (1 - (existing.opacity ?? 1)) * (1 - strength)
                  : strength;
                setTerrainTile(tileX, tileY, { type, opacity: nextOpacity });
              } else if (mode === "blend" && existing) {
                const nextOpacity = existing.type === type
                  ? clamp((existing.opacity ?? 1) + strength * 0.5, 0, 1)
                  : clamp((existing.opacity ?? 1) * 0.35 + strength * 0.65, 0, 1);
                setTerrainTile(tileX, tileY, { type, opacity: nextOpacity });
              } else {
                setTerrainTile(tileX, tileY, { type, opacity: strength });
              }
              changed.add(tileKey(tileX, tileY));
            }
          }
        }
        return changed.size;
      }

      function paintTerrainPatch(point, type, radius, random = Math.random) {
        const minTileX = Math.floor((point.x - radius) / TILE_SIZE);
        const maxTileX = Math.floor((point.x + radius) / TILE_SIZE);
        const minTileY = Math.floor((point.y - radius) / TILE_SIZE);
        const maxTileY = Math.floor((point.y + radius) / TILE_SIZE);
        for (let tileY = minTileY; tileY <= maxTileY; tileY += 1) {
          for (let tileX = minTileX; tileX <= maxTileX; tileX += 1) {
            const centerX = (tileX + 0.5) * TILE_SIZE;
            const centerY = (tileY + 0.5) * TILE_SIZE;
            const edgeNoise = 0.82 + random() * 0.28;
            if (Math.hypot(centerX - point.x, centerY - point.y) <= radius * edgeNoise) {
              setTerrainTile(tileX, tileY, { type, opacity: 0.88 + random() * 0.12 });
            }
          }
        }
      }

      function markFeatureIndexDirty() {
        state.featureIndexDirty = true;
        state.minimapTerrainDirty = true;
      }

      function indexFeature(feature) {
        if (!feature || feature.deleted) return;
        ensureFeatureCollision(feature);
        const radius = Math.max(1, feature.r || 1);
        const left = Math.min(feature.x, feature.x2 ?? feature.x) - radius;
        const right = Math.max(feature.x, feature.x2 ?? feature.x) + radius;
        const top = Math.min(feature.y, feature.y2 ?? feature.y) - radius;
        const bottom = Math.max(feature.y, feature.y2 ?? feature.y) + radius;
        const minChunkX = clamp(Math.floor(left / CHUNK_SIZE), 0, Math.ceil(worldWidth() / CHUNK_SIZE) - 1);
        const maxChunkX = clamp(Math.floor(right / CHUNK_SIZE), 0, Math.ceil(worldWidth() / CHUNK_SIZE) - 1);
        const minChunkY = clamp(Math.floor(top / CHUNK_SIZE), 0, Math.ceil(worldHeight() / CHUNK_SIZE) - 1);
        const maxChunkY = clamp(Math.floor(bottom / CHUNK_SIZE), 0, Math.ceil(worldHeight() / CHUNK_SIZE) - 1);
        for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY += 1) {
          for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX += 1) {
            const key = chunkKey(chunkX, chunkY);
            if (!state.featureChunks.has(key)) state.featureChunks.set(key, []);
            state.featureChunks.get(key).push(feature);
          }
        }
        const height = featureHeight(feature);
        if (height <= 0) return;
        const shadowReach = radius + height * 18;
        const shadowMinX = clamp(Math.floor((Math.min(feature.x, feature.x2 ?? feature.x) - shadowReach) / CHUNK_SIZE), 0, Math.ceil(worldWidth() / CHUNK_SIZE) - 1);
        const shadowMaxX = clamp(Math.floor((Math.max(feature.x, feature.x2 ?? feature.x) + shadowReach) / CHUNK_SIZE), 0, Math.ceil(worldWidth() / CHUNK_SIZE) - 1);
        const shadowMinY = clamp(Math.floor((Math.min(feature.y, feature.y2 ?? feature.y) - shadowReach) / CHUNK_SIZE), 0, Math.ceil(worldHeight() / CHUNK_SIZE) - 1);
        const shadowMaxY = clamp(Math.floor((Math.max(feature.y, feature.y2 ?? feature.y) + shadowReach) / CHUNK_SIZE), 0, Math.ceil(worldHeight() / CHUNK_SIZE) - 1);
        for (let chunkY = shadowMinY; chunkY <= shadowMaxY; chunkY += 1) {
          for (let chunkX = shadowMinX; chunkX <= shadowMaxX; chunkX += 1) {
            const key = chunkKey(chunkX, chunkY);
            if (!state.shadowFeatureChunks.has(key)) state.shadowFeatureChunks.set(key, []);
            state.shadowFeatureChunks.get(key).push(feature);
          }
        }
      }

      function rebuildFeatureIndex() {
        if (!state.featureIndexDirty) return;
        state.featureChunks = new Map();
        state.shadowFeatureChunks = new Map();
        for (const feature of state.features) indexFeature(feature);
        state.featureIndexDirty = false;
      }

      function addIndexedFeature(feature) {
        rebuildFeatureIndex();
        state.features.push(feature);
        indexFeature(feature);
        state.minimapTerrainDirty = true;
      }

      function markFeatureDeleted(feature) {
        if (!feature || feature.deleted) return false;
        feature.deleted = true;
        state.featureEditDirty = true;
        state.minimapTerrainDirty = true;
        return true;
      }

      function compactFeatureEdits() {
        if (!state.featureEditDirty) return;
        state.features = state.features.filter(feature => !feature.deleted);
        state.featureEditDirty = false;
        markFeatureIndexDirty();
      }

      function visibleFeatures(bounds = cameraBounds(CHUNK_SIZE)) {
        rebuildFeatureIndex();
        const found = new Set();
        const range = chunkRangeForBounds(bounds);
        for (let chunkY = range.minY; chunkY <= range.maxY; chunkY += 1) {
          for (let chunkX = range.minX; chunkX <= range.maxX; chunkX += 1) {
            for (const feature of state.featureChunks.get(chunkKey(chunkX, chunkY)) || []) {
              if (!feature.deleted) found.add(feature);
            }
          }
        }
        return [...found];
      }

      function visibleFeatureBuckets(bounds = cameraBounds(CHUNK_SIZE)) {
        rebuildFeatureIndex();
        const buckets = [];
        const range = chunkRangeForBounds(bounds);
        for (let chunkY = range.minY; chunkY <= range.maxY; chunkY += 1) {
          for (let chunkX = range.minX; chunkX <= range.maxX; chunkX += 1) {
            const features = (state.featureChunks.get(chunkKey(chunkX, chunkY)) || [])
              .filter(feature => !feature.deleted && featureIntersectsChunk(feature, chunkX, chunkY));
            if (features?.length) buckets.push({ chunkX, chunkY, features });
          }
        }
        return buckets;
      }

      function shadowFeaturesAt(point) {
        rebuildFeatureIndex();
        const chunkX = clamp(Math.floor(point.x / CHUNK_SIZE), 0, Math.ceil(worldWidth() / CHUNK_SIZE) - 1);
        const chunkY = clamp(Math.floor(point.y / CHUNK_SIZE), 0, Math.ceil(worldHeight() / CHUNK_SIZE) - 1);
        return (state.shadowFeatureChunks.get(chunkKey(chunkX, chunkY)) || []).filter(feature => !feature.deleted);
      }

      function featureDistanceFromPoint(point, feature) {
        if (feature.shape === "line" && feature.x2 != null && feature.y2 != null) {
          return pointSegmentDistance(point, feature, { x: feature.x2, y: feature.y2 });
        }
        if (feature.shape === "square") {
          return Math.max(Math.abs(point.x - feature.x), Math.abs(point.y - feature.y));
        }
        return Math.hypot(point.x - feature.x, point.y - feature.y);
      }

      function pointInsideFeature(point, feature, padding = 0) {
        return featureDistanceFromPoint(point, feature) <= Math.max(1, feature.r || 1) + padding;
      }

      function ensureFeatureCollision(feature) {
        if (!feature || feature.deleted) return feature;
        const profile = environmentConfig.profiles?.[feature.type];
        if (!profile) return feature;
        feature.environmentObstacle = true;
        feature.collisionProfile = profile;
        feature.collisionState ||= "standing";
        feature.collisionAngle ??= ((Math.round(feature.x * 13 + feature.y * 7 + (feature.r || 1) * 11) % 360) * Math.PI / 180);
        feature.maxHp ??= profile.destructible ? Math.max(24, (feature.r || 20) * (profile.family === "heavy-debris" ? 4 : profile.family === "rock" ? 3 : 1.8)) : Infinity;
        feature.hp ??= feature.maxHp;
        feature.coverValue = environmentConfig.coverValues?.[profile.cover || "none"] || 0;
        feature.removable = Boolean(profile.removable);
        feature.crushable = Boolean(profile.crushable);
        return feature;
      }

      function featureCollisionShapes(feature, layer = "movement") {
        ensureFeatureCollision(feature);
        const profile = feature.collisionProfile;
        if (!profile || feature.collisionState === "cleared") return [];
        const radius = Math.max(4, feature.r || 12);
        if (feature.collisionState === "fallen" && profile.family.includes("tree")) {
          const angle = feature.collisionAngle || 0;
          const length = radius * 1.35;
          return [{ shape: "capsule", x1: feature.x - Math.cos(angle) * length * 0.5, y1: feature.y - Math.sin(angle) * length * 0.5, x2: feature.x + Math.cos(angle) * length * 0.5, y2: feature.y + Math.sin(angle) * length * 0.5, r: Math.max(3, radius * 0.08) }];
        }
        if (layer === "vision") {
          if (profile.canopy) return [{ shape: "circle", x: feature.x, y: feature.y - radius * 0.12, r: profile.canopy <= 1 ? radius * profile.canopy : profile.canopy, opacity: profile.family === "brush" ? 0.28 : profile.cover === "heavy" ? 0.72 : 0.52 }];
          if (["rock", "heavy-debris"].includes(profile.family)) return [{ shape: "ellipse", x: feature.x, y: feature.y, rx: radius * (profile.width || 0.62), ry: radius * (profile.height || 0.5), angle: feature.collisionAngle, opacity: 0.82 }];
          return [];
        }
        if (profile.family === "tree-cluster") {
          const shapes = [];
          const seed = Math.round(feature.x * 11 + feature.y * 17 + radius * 5);
          for (let index = 0; index < 5; index += 1) {
            const angle = (seed + index * 137) * Math.PI / 180;
            const spread = radius * 0.48;
            shapes.push({ shape: "circle", x: feature.x + Math.cos(angle) * spread, y: feature.y + Math.sin(angle) * spread + radius * 0.12, r: Math.max(3.5, Math.min(9, profile.trunk || radius * 0.08)) });
          }
          return shapes;
        }
        if (profile.family === "tree") return [{ shape: "circle", x: feature.x, y: feature.y + radius * 0.2, r: Math.max(2, profile.trunk || radius * 0.1) }];
        if (profile.movement === "capsule" || profile.family === "log") {
          const angle = feature.collisionAngle || 0;
          const length = radius * 1.45;
          return [{ shape: "capsule", x1: feature.x - Math.cos(angle) * length * 0.5, y1: feature.y - Math.sin(angle) * length * 0.5, x2: feature.x + Math.cos(angle) * length * 0.5, y2: feature.y + Math.sin(angle) * length * 0.5, r: profile.width || Math.max(3, radius * 0.1) }];
        }
        if (["rotated-rect", "rect"].includes(profile.movement)) return [{ shape: "rect", x: feature.x, y: feature.y, halfW: radius * (profile.width || 0.7) * 0.5, halfH: radius * (profile.height || 0.5) * 0.5, angle: profile.movement === "rect" ? 0 : feature.collisionAngle }];
        if (profile.movement === "ellipse") return [{ shape: "ellipse", x: feature.x, y: feature.y, rx: radius * (profile.width || 0.62), ry: radius * (profile.height || 0.5), angle: feature.collisionAngle }];
        if (profile.movement === "circle") return [{ shape: "circle", x: feature.x, y: feature.y, r: profile.width ? radius * profile.width : Math.max(3, radius * 0.34) }];
        return [];
      }

      function pointSegmentDistanceSquared(point, a, b) {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const length = dx * dx + dy * dy || 1;
        const t = clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / length, 0, 1);
        const x = a.x + dx * t;
        const y = a.y + dy * t;
        return (point.x - x) ** 2 + (point.y - y) ** 2;
      }

      function pointOverlapsCollisionShape(point, shape, padding = 0) {
        if (shape.shape === "circle") return distance(point, shape) < shape.r + padding;
        if (shape.shape === "capsule") return pointSegmentDistanceSquared(point, { x: shape.x1, y: shape.y1 }, { x: shape.x2, y: shape.y2 }) < (shape.r + padding) ** 2;
        const angle = -(shape.angle || 0);
        const dx = point.x - shape.x;
        const dy = point.y - shape.y;
        const localX = dx * Math.cos(angle) - dy * Math.sin(angle);
        const localY = dx * Math.sin(angle) + dy * Math.cos(angle);
        if (shape.shape === "rect") return Math.abs(localX) < shape.halfW + padding && Math.abs(localY) < shape.halfH + padding;
        if (shape.shape === "ellipse") return (localX / Math.max(1, shape.rx + padding)) ** 2 + (localY / Math.max(1, shape.ry + padding)) ** 2 < 1;
        return false;
      }

      function featureBlocksUnit(feature, unit) {
        const profile = ensureFeatureCollision(feature)?.collisionProfile;
        if (!profile || profile.movement === "soft" || feature.collisionState === "cleared") return false;
        if (["log", "medium-debris"].includes(profile.family) && unit.role !== "vehicle") return false;
        return true;
      }

      function nearbyEnvironmentFeatures(point, radius = 64) {
        return visibleFeatures({ left: point.x - radius, right: point.x + radius, top: point.y - radius, bottom: point.y + radius })
          .filter(feature => !feature.deleted && environmentConfig.profiles?.[feature.type]);
      }

      function environmentCollisionAt(point, unit, padding = unit?.collisionRadius || 3) {
        for (const feature of nearbyEnvironmentFeatures(point, Math.max(48, padding + 36))) {
          if (!featureBlocksUnit(feature, unit)) continue;
          for (const shape of featureCollisionShapes(feature, "movement")) {
            if (pointOverlapsCollisionShape(point, shape, padding)) return { feature, shape };
          }
        }
        return null;
      }

      function environmentalMovementFactor(point, unit) {
        let factor = 1;
        for (const feature of nearbyEnvironmentFeatures(point, 42)) {
          const profile = ensureFeatureCollision(feature)?.collisionProfile;
          if (!profile || !pointInsideFeature(point, feature)) continue;
          if (profile.movement === "soft" || (["log", "medium-debris"].includes(profile.family) && unit.role !== "vehicle")) factor /= profile.movementCost || (profile.family === "rubble" ? 1.25 : 1.1);
        }
        return clamp(factor, 0.42, 1);
      }

      function segmentHitsFeature(a, b, feature, layer = "projectile", padding = 0) {
        const steps = Math.max(2, Math.ceil(distance(a, b) / 3));
        const shapes = featureCollisionShapes(feature, layer === "vision" ? "vision" : "movement");
        for (let index = 0; index <= steps; index += 1) {
          const t = index / steps;
          const point = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
          if (shapes.some(shape => pointOverlapsCollisionShape(point, shape, padding))) return point;
        }
        return null;
      }

      function visionOcclusionBetween(a, b) {
        const bounds = { left: Math.min(a.x, b.x), right: Math.max(a.x, b.x), top: Math.min(a.y, b.y), bottom: Math.max(a.y, b.y) };
        let transmission = 1;
        for (const feature of visibleFeatures(bounds)) {
          if (!environmentConfig.profiles?.[feature.type] || feature.deleted) continue;
          const hit = segmentHitsFeature(a, b, feature, "vision");
          if (!hit) continue;
          const opacity = featureCollisionShapes(feature, "vision")[0]?.opacity || 0;
          transmission *= 1 - opacity;
          if (transmission <= 0.12) return 0.12;
        }
        return clamp(transmission, 0.12, 1);
      }

      function environmentalCoverAt(point) {
        let cover = 0;
        for (const feature of nearbyEnvironmentFeatures(point, 48)) {
          ensureFeatureCollision(feature);
          if (feature.collisionState === "cleared") continue;
          const reach = Math.max(8, (feature.r || 12) * (feature.collisionProfile?.family === "tree" ? 0.58 : 0.8));
          if (distance(point, feature) <= reach) cover = Math.max(cover, feature.coverValue || 0);
        }
        return cover;
      }

      function syncObstacleRoadImpact(feature) {
        if (!feature?.environmentObstacle || feature.collisionState === "cleared") return;
        const impactKey = `${state.roadRevision}:${feature.collisionState}:${feature.type}`;
        if (feature.roadImpactState === impactKey) return;
        const roadHit = nearestRoadSegment(feature, Math.max(18, (feature.r || 12) * 0.7));
        if (!roadHit?.segment) return;
        const hard = featureBlocksUnit(feature, { role: "vehicle" });
        if (!hard) return;
        const flags = new Set(roadHit.segment.operationalFlags || []);
        flags.add(feature.collisionState === "fallen" ? "fallen tree" : feature.collisionProfile?.family === "heavy-debris" ? "wreck" : "obstructed");
        flags.add(roadHit.distance <= (roadHit.segment.width || 7) ? "blocked" : "partially obstructed");
        flags.add("damaged");
        roadHit.segment.operationalFlags = [...flags];
        roadHit.segment.condition = clamp(roadHit.segment.condition - 0.08, 0, 1);
        feature.roadImpactState = impactKey;
      }

      function damageEnvironmentFeature(feature, damage, attacker = null) {
        ensureFeatureCollision(feature);
        if (!feature?.collisionProfile?.destructible || !Number.isFinite(feature.maxHp)) return false;
        feature.hp = Math.max(0, feature.hp - damage);
        feature.condition = clamp(feature.hp / Math.max(1, feature.maxHp), 0, 1);
        if (feature.hp > 0) return false;
        if (feature.collisionProfile.family.includes("tree") && feature.collisionState === "standing") {
          feature.collisionState = "fallen";
          feature.hp = feature.maxHp * 0.42;
          feature.condition = 0.42;
          feature.type = "fallenlog";
          feature.collisionProfile = environmentConfig.profiles.fallenlog;
          incident(`A tree was felled${attacker ? ` by ${unitLabel(attacker)}` : ""}; its trunk now blocks movement and provides cover.`, attacker?.id || null, "warning");
        } else {
          feature.collisionState = "cleared";
          feature.condition = 0.12;
          feature.removedAt = state.time;
          const roadHit = nearestRoadSegment(feature, Math.max(18, (feature.r || 12) * 0.8));
          if (roadHit?.segment) {
            roadHit.segment.operationalFlags = (roadHit.segment.operationalFlags || []).filter(flag => !["fallen tree", "wreck", "obstructed", "partially obstructed", "blocked"].includes(flag));
            roadHit.segment.condition = clamp(roadHit.segment.condition + 0.12, 0, 1);
          }
        }
        markFeatureIndexDirty();
        syncObstacleRoadImpact(feature);
        return true;
      }

      function featureIntersectsChunk(feature, chunkX, chunkY) {
        const left = chunkX * CHUNK_SIZE;
        const top = chunkY * CHUNK_SIZE;
        if (feature.shape === "square") {
          return boundsIntersect(
            { left, top, right: left + CHUNK_SIZE, bottom: top + CHUNK_SIZE },
            { left: feature.x - feature.r, top: feature.y - feature.r, right: feature.x + feature.r, bottom: feature.y + feature.r }
          );
        }
        const center = { x: left + CHUNK_SIZE / 2, y: top + CHUNK_SIZE / 2 };
        const reach = Math.max(1, feature.r || 1) + CHUNK_SIZE * Math.SQRT1_2;
        return featureDistanceFromPoint(center, feature) <= reach;
      }

      function featureAt(point) {
        return [...visibleFeatures({ left: point.x, right: point.x, top: point.y, bottom: point.y })]
          .reverse()
          .find(feature => pointInsideFeature(point, feature));
      }

      root.awtDebugSnapshot = () => ({
        viewport: { width: canvas.width, height: canvas.height },
        world: { ...state.world, terrainChunkCount: state.terrainChunks.size },
        camera: { ...state.camera },
        visibleBounds: cameraBounds(),
        visibleChunkCount: state.visibleChunkCount,
        renderedObjectCount: state.renderedObjectCount,
        totals: {
          features: state.features.length,
          units: state.units.length,
          structures: state.structures.length,
          projectiles: state.projectiles.length,
          resourceNodes: state.features.filter(feature => feature.resourceNode).length,
          depletedNodes: state.features.filter(feature => feature.resourceNode && feature.reserve <= 0).length,
          squads: state.squads.length
        },
        wounds: state.units.reduce((summary, unit) => { summary[unit.woundState || "Healthy"] = (summary[unit.woundState || "Healthy"] || 0) + 1; return summary; }, {}),
        productionGroups: state.squads.reduce((summary, squad) => { summary[squad.templateId || "mixed"] = (summary[squad.templateId || "mixed"] || 0) + 1; return summary; }, {}),
        operationalDepth: Object.fromEntries(state.players.map(player => [player.id, economyFor(player.id).operationalDepth || null])),
        strategicOutcomes: structuredClone(state.strategicOutcomes)
      });

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
            x: clamp(structure.x + Math.cos(angle) * clearance, 24, worldWidth() - 24),
            y: clamp(structure.y + Math.sin(angle) * clearance, 24, worldHeight() - 24)
          };
          const radius = unit.collisionRadius || (unit.role === "vehicle" ? 14 : 3);
          if (!structureCollisionAt(candidate, radius) && !environmentCollisionAt(candidate, unit, radius)) {
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

      let lightSourceCacheKey = "";
      let lightSourceCache = [];
      let lightSourceChunks = new Map();
      function activeLightSources(time = state.time) {
        if (!state.lighting.enabled || !state.lighting.artificial) {
          lightSourceCacheKey = "";
          lightSourceCache = [];
          lightSourceChunks = new Map();
          return lightSourceCache;
        }
        const snapshot = state.replay ? currentSnapshot() : null;
        const structures = snapshot?.structures || state.structures;
        const cacheKey = `${state.replay ? `replay:${state.replayIndex}:` : "live:"}${Math.floor(time * 4)}|${structures.length}|${state.features.length}|${state.lighting.weather}`;
        if (cacheKey === lightSourceCacheKey) return lightSourceCache;
        const sources = [];
        const poweredFactions = new Set(
          structures
            .filter(item => item.alive !== false && item.type === "generator" && item.progress >= 1 && item.condition > 0.25)
            .map(item => item.faction)
        );
        for (const item of structures) {
          if (item.alive === false || item.progress < 1 || item.condition <= 0.18) continue;
          const spec = buildingCatalog[item.type];
          const powered = item.type === "generator" || poweredFactions.has(item.faction);
          if (powered && spec?.light) {
            sources.push({
              x: item.x,
              y: item.y,
              radius: spec.light,
              brightness: item.type === "generator" ? 0.92 : 0.66,
              color: item.type === "fieldhospital" ? colors.water : colors.signal,
              faction: item.faction,
              searchlight: Boolean(spec.searchlight),
              direction: time * 0.42 + playerFor(item.faction).index * 1.7
            });
          }
          if (item.condition < 0.42) {
            sources.push({ x: item.x, y: item.y, radius: 46, brightness: 0.78, color: colors.danger, faction: item.faction, fire: true });
          }
        }
        for (const feature of state.features) {
          if (feature.deleted) continue;
          if (feature.type === "lava") sources.push({ x: feature.x, y: feature.y, radius: feature.r * 1.4, brightness: 0.72, color: colors.danger, fire: true });
        }
        lightSourceCacheKey = cacheKey;
        lightSourceCache = sources;
        lightSourceChunks = new Map();
        for (const source of sources) {
          const range = chunkRangeForBounds({
            left: clamp(source.x - source.radius, 0, worldWidth()),
            right: clamp(source.x + source.radius, 0, worldWidth()),
            top: clamp(source.y - source.radius, 0, worldHeight()),
            bottom: clamp(source.y + source.radius, 0, worldHeight())
          });
          for (let chunkY = range.minY; chunkY <= range.maxY; chunkY += 1) {
            for (let chunkX = range.minX; chunkX <= range.maxX; chunkX += 1) {
              const key = chunkKey(chunkX, chunkY);
              if (!lightSourceChunks.has(key)) lightSourceChunks.set(key, []);
              lightSourceChunks.get(key).push(source);
            }
          }
        }
        return lightSourceCache;
      }

      function lightSourcesInBounds(bounds, time = state.time) {
        activeLightSources(time);
        const found = new Set();
        const range = chunkRangeForBounds(bounds);
        for (let chunkY = range.minY; chunkY <= range.maxY; chunkY += 1) {
          for (let chunkX = range.minX; chunkX <= range.maxX; chunkX += 1) {
            for (const source of lightSourceChunks.get(chunkKey(chunkX, chunkY)) || []) found.add(source);
          }
        }
        return [...found].filter(source => circleVisible(source, source.radius, bounds));
      }

      function lightSourcesAt(point, time = state.time) {
        activeLightSources(time);
        return lightSourceChunks.get(chunkKey(
          clamp(Math.floor(point.x / CHUNK_SIZE), 0, Math.ceil(worldWidth() / CHUNK_SIZE) - 1),
          clamp(Math.floor(point.y / CHUNK_SIZE), 0, Math.ceil(worldHeight() / CHUNK_SIZE) - 1)
        )) || [];
      }

      function pointSegmentDistance(point, a, b) {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const denominator = dx * dx + dy * dy || 1;
        const t = clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / denominator, 0, 1);
        return Math.hypot(point.x - (a.x + dx * t), point.y - (a.y + dy * t));
      }

      let shadowCacheBucket = "";
      const shadowSampleCache = new Map();
      function pointInShadow(point, time = state.time) {
        if (!state.lighting.enabled || !state.lighting.shadows) return false;
        const sun = sunState(time);
        if (!sun.daylight || sun.shadowStrength < 0.08) return false;
        const bucket = state.replay
          ? `replay:${state.replayIndex}:${time.toFixed(3)}`
          : `live:${Math.floor(time * 4)}`;
        if (bucket !== shadowCacheBucket) {
          shadowCacheBucket = bucket;
          shadowSampleCache.clear();
        }
        const cacheKey = `${Math.round(point.x / 8)},${Math.round(point.y / 8)}`;
        if (shadowSampleCache.has(cacheKey)) return shadowSampleCache.get(cacheKey);
        for (const feature of shadowFeaturesAt(point)) {
          const height = featureHeight(feature);
          if (!height) continue;
          const vector = shadowVector(height, time);
          const width = Math.max(5, feature.r * (["denseforest", "jungle"].includes(feature.type) ? 0.8 : 0.42));
          if (pointSegmentDistance(point, feature, { x: feature.x + vector.x, y: feature.y + vector.y }) <= width) {
            shadowSampleCache.set(cacheKey, true);
            return true;
          }
        }
        const snapshot = state.replay ? currentSnapshot() : null;
        const nearbyStructures = snapshot
          ? replayObjectsInBounds(snapshot, {
            left: clamp(point.x - 560, 0, worldWidth()),
            right: clamp(point.x + 560, 0, worldWidth()),
            top: clamp(point.y - 560, 0, worldHeight()),
            bottom: clamp(point.y + 560, 0, worldHeight())
          }).structures
          : nearbyCombatObjects(point, 560).structures;
        for (const item of nearbyStructures) {
          if (item.alive === false) continue;
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
        const temporalKey = state.replay
          ? `replay:${state.replayIndex}:${time.toFixed(3)}`
          : `live:${Math.floor(time * 4)}`;
        const sampleCacheKey = `${temporalKey}|${Math.round(sun.hour * 4)}|${state.lighting.weather}|${state.structures.length}`;
        if (sampleCacheKey !== lightingSampleCacheKey) {
          lightingSampleCacheKey = sampleCacheKey;
          lightingSampleCache.clear();
        }
        const pointCacheKey = `${Math.round(point.x / 6)},${Math.round(point.y / 6)}|${observerFaction || "none"}`;
        if (lightingSampleCache.has(pointCacheKey)) return lightingSampleCache.get(pointCacheKey);
        const shadowed = pointInShadow(point, time);
        let artificial = 0;
        let searchlight = 0;
        for (const source of lightSourcesAt(point, time)) {
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
        return playerFor(faction).base || deploymentPosition(0, state.players.length, state.world);
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
            x: clamp(center.x + Math.cos(angle) * radius, 0, worldWidth()),
            y: clamp(center.y + Math.sin(angle) * radius, 0, worldHeight())
          };
        });
      }

      function territoryCellKey(x, y) {
        const cellX = clamp(Math.floor(x / TERRITORY_CELL_SIZE), 0, Math.ceil(worldWidth() / TERRITORY_CELL_SIZE) - 1);
        const cellY = clamp(Math.floor(y / TERRITORY_CELL_SIZE), 0, Math.ceil(worldHeight() / TERRITORY_CELL_SIZE) - 1);
        return `${cellX},${cellY}`;
      }

      function territoryCellCoordinates(key) {
        const [x, y] = String(key).split(",").map(Number);
        return { x, y };
      }

      function territoryCellCenter(key) {
        const cell = territoryCellCoordinates(key);
        return {
          x: clamp((cell.x + 0.5) * TERRITORY_CELL_SIZE, 0, worldWidth()),
          y: clamp((cell.y + 0.5) * TERRITORY_CELL_SIZE, 0, worldHeight())
        };
      }

      function seedTerritoryCells(center, radius) {
        const cells = new Set();
        const minX = Math.floor((center.x - radius) / TERRITORY_CELL_SIZE);
        const maxX = Math.floor((center.x + radius) / TERRITORY_CELL_SIZE);
        const minY = Math.floor((center.y - radius) / TERRITORY_CELL_SIZE);
        const maxY = Math.floor((center.y + radius) / TERRITORY_CELL_SIZE);
        for (let y = minY; y <= maxY; y += 1) {
          for (let x = minX; x <= maxX; x += 1) {
            const key = territoryCellKey((x + 0.5) * TERRITORY_CELL_SIZE, (y + 0.5) * TERRITORY_CELL_SIZE);
            if (distance(territoryCellCenter(key), center) <= radius + TERRITORY_CELL_SIZE * 0.62) cells.add(key);
          }
        }
        cells.add(territoryCellKey(center.x, center.y));
        return cells;
      }

      function convexHull(points) {
        if (points.length <= 3) return points;
        const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
        const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
        const lower = [];
        for (const point of sorted) {
          while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) lower.pop();
          lower.push(point);
        }
        const upper = [];
        for (let index = sorted.length - 1; index >= 0; index -= 1) {
          const point = sorted[index];
          while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) upper.pop();
          upper.push(point);
        }
        lower.pop();
        upper.pop();
        return lower.concat(upper);
      }

      function syncTerritoryPoints(territory) {
        if (!territory?.cellBacked || !(territory.claimedCells instanceof Set) || !territory.claimedCells.size) return;
        const corners = [];
        for (const key of territory.claimedCells) {
          const { x, y } = territoryCellCoordinates(key);
          const left = x * TERRITORY_CELL_SIZE;
          const top = y * TERRITORY_CELL_SIZE;
          corners.push(
            { x: left, y: top }, { x: left + TERRITORY_CELL_SIZE, y: top },
            { x: left + TERRITORY_CELL_SIZE, y: top + TERRITORY_CELL_SIZE }, { x: left, y: top + TERRITORY_CELL_SIZE }
          );
        }
        territory.points = convexHull(corners).map(point => ({ x: clamp(point.x, 0, worldWidth()), y: clamp(point.y, 0, worldHeight()) }));
      }

      function territoryCenter(territory) {
        if (territory?.cellBacked && territory.claimedCells instanceof Set && territory.claimedCells.size) {
          let x = 0;
          let y = 0;
          for (const key of territory.claimedCells) {
            const center = territoryCellCenter(key);
            x += center.x;
            y += center.y;
          }
          return { x: x / territory.claimedCells.size, y: y / territory.claimedCells.size };
        }
        if (!territory?.points?.length) return worldCenter();
        return {
          x: territory.points.reduce((sum, point) => sum + point.x, 0) / territory.points.length,
          y: territory.points.reduce((sum, point) => sum + point.y, 0) / territory.points.length
        };
      }

      function pointInTerritory(point, territory) {
        if (territory?.cellBacked && territory.claimedCells instanceof Set) return territory.claimedCells.has(territoryCellKey(point.x, point.y));
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
        const primary = state.territories.find(territory => territory.cellBacked && pointInTerritory(point, territory));
        return primary || [...state.territories].reverse().find(territory => !territory.cellBacked && pointInTerritory(point, territory));
      }

      function createTerritory(owner, center, radius = 74, overrides = {}) {
        const ownerPlayer = owner ? playerFor(owner) : null;
        const id = `territory-${state.nextTerritoryId++}`;
        const cellBacked = overrides.cellBacked ?? Boolean(owner);
        const territory = {
          id,
          name: overrides.name || `${ownerPlayer?.faction || "Neutral"} ${state.nextTerritoryId - 1}`,
          owner: owner || "",
          startingOwner: owner || "",
          previousOwner: "",
          status: owner ? "claimed" : "neutral",
          points: circleTerritoryPoints(center, radius),
          cellBacked,
          cellSize: TERRITORY_CELL_SIZE,
          claimedCells: cellBacked ? seedTerritoryCells(center, radius) : new Set(),
          frontierCells: new Set(),
          influencedCells: new Set(),
          controlledCells: new Set(),
          contestedCells: new Set(),
          disconnectedCells: new Set(),
          cellPressure: new Map(),
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
        if (territory.cellBacked) syncTerritoryPoints(territory);
        return territory;
      }

      function selectedTerritory() {
        return state.territories.find(territory => territory.id === state.selectedTerritoryId) || state.territories[0] || null;
      }

      function clampCamera() {
        const halfW = VW / (2 * state.camera.zoom);
        const halfH = VH / (2 * state.camera.zoom);
        state.camera.x = halfW * 2 >= worldWidth()
          ? worldWidth() / 2
          : clamp(state.camera.x, halfW, worldWidth() - halfW);
        state.camera.y = halfH * 2 >= worldHeight()
          ? worldHeight() / 2
          : clamp(state.camera.y, halfH, worldHeight() - halfH);
      }

      function setZoom(value, focus = null) {
        const fitZoom = fitWorldZoom();
        const minimum = Math.min(0.1, fitZoom);
        const requested = value === "fit" ? fitZoom : Number(value);
        const isFitRequest = value === "fit" || Math.abs(requested - fitZoom) < 0.0000001;
        const next = isFitRequest ? fitZoom : clamp(Math.round(requested * 1000) / 1000, minimum, 4);
        const previous = state.camera.zoom;
        if (focus && previous > 0 && next !== previous) {
          state.camera.x = focus.x - (focus.x - state.camera.x) * previous / next;
          state.camera.y = focus.y - (focus.y - state.camera.y) * previous / next;
        }
        state.camera.zoom = next;
        clampCamera();
        const fit = Math.abs(next - fitZoom) < 0.0000001;
        const matchingStop = ZOOM_STOPS.find(stop => Math.abs(stop - next) < 0.001);
        els.zoomLevel.value = fit ? "fit" : matchingStop ? String(matchingStop) : "custom";
        els.zoomValue.textContent = fit ? `Fit · ${Math.round(next * 100)}%` : `${Math.round(next * 100)}%`;
        els.zoomOut.disabled = next <= minimum + 0.0001;
        els.zoomIn.disabled = next >= 4;
        if (els.cameraStatus) els.cameraStatus.textContent = `Camera ${Math.round(state.camera.x)}, ${Math.round(state.camera.y)} · ${Math.round(next * 100)}%`;
        draw();
      }

      function stepZoom(direction) {
        const fit = fitWorldZoom();
        const minimum = Math.min(0.1, fit);
        const levels = [...new Set([fit, ...ZOOM_STOPS, 4])].filter(level => level >= minimum).sort((a, b) => a - b);
        const current = state.camera.zoom;
        const next = direction > 0
          ? levels.find(level => level > current + 0.0001) ?? 4
          : [...levels].reverse().find(level => level < current - 0.0001) ?? minimum;
        setZoom(next, state.cameraFocus);
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

      function personalityFor(unit) {
        if ((unit.vengeance || 0) > 0.68 || unit.aggression > 0.66 && unit.loyalty > 0.62) return "Vengeful";
        if (unit.aggression > 0.62 && unit.courage > 0.52) return "Aggressive";
        if (unit.discipline > 0.62 && unit.patience > 0.52) return "Disciplined";
        if (unit.patience > 0.64 || unit.courage < 0.43) return "Cautious";
        if (unit.loyalty > 0.64) return "Protective";
        return "Steady";
      }

      function ensureIndividualRuntime(unit) {
        unit.relationships ||= {};
        unit.relationshipCooldowns ||= {};
        unit.friends ||= [];
        unit.rivals ||= [];
        unit.personality ||= personalityFor(unit);
        unit.combatIntent ||= "Follow objective";
        unit.killConfidence ??= 0;
        unit.combatCommitment ||= null;
        unit.protectTargetId ||= null;
        unit.protectionRequested ??= false;
        unit.protectionRequestedAt ??= null;
        unit.assignedEscortSquadId ||= null;
        unit.lastEscortSeenAt ??= null;
        unit.lastAllyKillerAt ??= null;
        unit.rations ??= 6;
        unit.medicalReserve ??= 2;
      }

      function relationshipBand(score) {
        return relationshipBands.find(band => score >= band.min)?.label || "Hated but tolerated";
      }

      function refreshRelationshipLists(unit) {
        const entries = Object.entries(unit.relationships || {}).sort((a, b) => b[1].score - a[1].score);
        unit.friends = entries.filter(([, record]) => record.score >= 30).slice(0, 6).map(([id]) => id);
        unit.rivals = entries.filter(([, record]) => record.score <= -30).sort((a, b) => a[1].score - b[1].score).slice(0, 6).map(([id]) => id);
        if (entries.length > 32) {
          const keep = new Set([...entries.slice(0, 16), ...entries.slice(-16)].map(([id]) => id));
          for (const id of Object.keys(unit.relationships)) if (!keep.has(id)) delete unit.relationships[id];
        }
        const retainedIds = new Set(Object.keys(unit.relationships || {}));
        for (const [key, expiresAt] of Object.entries(unit.relationshipCooldowns || {})) {
          const subjectId = key.split(":")[0];
          if (expiresAt <= state.time || !retainedIds.has(subjectId)) delete unit.relationshipCooldowns[key];
        }
      }

      function adjustRelationship(observer, subject, amount, reason, options = {}) {
        if (!observer || !subject || observer.id === subject.id || !Number.isFinite(amount)) return;
        ensureIndividualRuntime(observer);
        ensureIndividualRuntime(subject);
        const key = `${subject.id}:${options.event || reason}`;
        const cooldown = options.cooldown ?? 0;
        if (cooldown && (observer.relationshipCooldowns[key] || 0) > state.time) return;
        if (cooldown) observer.relationshipCooldowns[key] = state.time + cooldown;
        const previous = observer.relationships[subject.id]?.score || 0;
        const next = clamp(previous + amount, -100, 100);
        observer.relationships[subject.id] = { score: next, lastAt: state.time, lastReason: reason };
        refreshRelationshipLists(observer);
        const beforeBand = relationshipBand(previous);
        const afterBand = relationshipBand(next);
        if (beforeBand !== afterBand || Math.abs(amount) >= 9) {
          addUnitLog(observer, `${afterBand} toward ${subject.name}: ${reason}.`);
          observer.memories.push(`${subject.name} became ${afterBand.toLowerCase()} after ${reason}.`);
          observer.memories = observer.memories.slice(-18);
        }
        if (options.reciprocal && !options._reciprocal) {
          adjustRelationship(subject, observer, amount * options.reciprocal, reason, { ...options, reciprocal: 0, _reciprocal: true });
        }
      }

      function recordRelationshipEvent(observer, subject, event, reason, options = {}) {
        const amount = options.amount ?? relationshipEvents[event] ?? 0;
        adjustRelationship(observer, subject, amount, reason, {
          event,
          cooldown: options.cooldown ?? 18,
          reciprocal: options.reciprocal ?? (areAllies(observer.faction, subject.faction) ? 0.65 : 0)
        });
      }

      function strongestRelationships(unit, limit = 3) {
        return Object.entries(unit.relationships || {})
          .map(([id, record]) => ({ other: state.units.find(candidate => candidate.id === id), ...record }))
          .filter(item => item.other)
          .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
          .slice(0, limit);
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
          dirtroad: { speed: 1.16, cover: 0.02, detection: 1, moisture: 34, elevation: 0, name: "Dirt road" },
          stoneroad: { speed: 1.25, cover: 0, detection: 1.04, moisture: 24, elevation: 0, name: "Stone road" },
          asphalt: { speed: 1.34, cover: 0, detection: 1.06, moisture: 20, elevation: 0, name: "Asphalt road" },
          asphaltroad: { speed: 1.34, cover: 0, detection: 1.06, moisture: 20, elevation: 0, name: "Asphalt road" },
          concreteroad: { speed: 1.3, cover: 0, detection: 1.04, moisture: 20, elevation: 0, name: "Concrete road" },
          trail: { speed: 1.08, cover: 0.04, detection: 0.94, moisture: 38, elevation: 0, name: "Trail" },
          railway: { speed: 0.92, cover: 0.02, detection: 1.04, moisture: 24, elevation: 0, name: "Railway" },
          bridge: { speed: 1.08, cover: 0, detection: 1, moisture: 52, elevation: 1, name: "Bridge" },
          stonebridge: { speed: 1.13, cover: 0.04, detection: 1.04, moisture: 52, elevation: 1, name: "Stone bridge" },
          woodbridge: { speed: 1.02, cover: 0.02, detection: 1, moisture: 58, elevation: 1, name: "Wood bridge" },
          woodenbridge: { speed: 1.02, cover: 0.02, detection: 1, moisture: 58, elevation: 1, name: "Wood bridge" },
          pontoonbridge: { speed: 0.9, cover: 0, detection: 1, moisture: 70, elevation: 0, name: "Pontoon bridge" },
          heavyfog: { speed: 0.92, cover: 0.08, detection: 0.42, moisture: 86, elevation: 0, name: "Heavy fog" },
          ashstorm: { speed: 0.84, cover: 0.12, detection: 0.46, moisture: 18, elevation: 0, name: "Ash storm" },
          heavyrain: { speed: 0.82, cover: 0.04, detection: 0.68, moisture: 92, elevation: 0, name: "Heavy rain" }
        };
        return effects[type] || { speed: 1, cover: 0.03, detection: 0.98, moisture: 52, elevation: 0, name: brushNames[type] || "Ground" };
      }

      function blendTerrainEffect(base, overlay, opacity, type) {
        const amount = clamp(opacity ?? 1, 0, 1);
        return {
          speed: base.speed + (overlay.speed - base.speed) * amount,
          cover: base.cover + (overlay.cover - base.cover) * amount,
          detection: base.detection + (overlay.detection - base.detection) * amount,
          moisture: base.moisture + (overlay.moisture - base.moisture) * amount,
          elevation: base.elevation + (overlay.elevation - base.elevation) * amount,
          name: amount >= 0.98 ? overlay.name : `${overlay.name} blend`,
          type
        };
      }

      function terrainAt(point) {
        const tile = terrainTileAt(point);
        const baseEffect = terrainEffect(state.world.baseTerrain);
        let info = blendTerrainEffect(baseEffect, terrainEffect(tile.type), tile.opacity, tile.type);
        for (const feature of visibleFeatures({ left: point.x, right: point.x, top: point.y, bottom: point.y })) {
          if (!pointInsideFeature(point, feature)) continue;
          const effect = terrainEffect(feature.type);
          info = blendTerrainEffect(info, effect, (feature.opacity ?? 1) * (feature.condition ?? 1), feature.type);
          if (feature.type === "lower") info.elevation -= 3;
        }
        info.cover = Math.max(info.cover, environmentalCoverAt(point));
        for (const feature of nearbyEnvironmentFeatures(point, 64)) {
          const visionShape = featureCollisionShapes(feature, "vision")[0];
          if (visionShape && pointOverlapsCollisionShape(point, visionShape)) info.detection *= 1 - (visionShape.opacity || 0) * 0.48;
        }
        info.detection = clamp(info.detection, 0.18, 1.2);
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
          x: clamp(base.x + rand(-16, 16), 24, worldWidth() - 24),
          y: clamp(base.y + rand(-16, 16), 24, worldHeight() - 24),
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
          courage: rand(0.38, 0.7),
          reflexes: rand(0.46, 0.56),
          strength: rand(0.48, 0.58),
          suppressionResistance: rand(0.46, 0.56),
          camouflage: rand(0.45, 0.55),
          engineering: role === "builder" || role === "engineer" ? rand(0.72, 0.84) : rand(0.43, 0.53),
          medical: role === "medic" ? rand(0.72, 0.84) : rand(0.42, 0.52),
          driving: rand(0.45, 0.58),
          piloting: rand(0.44, 0.56),
          loyalty: rand(0.36, 0.74),
          discipline: rand(0.34, 0.76),
          patience: rand(0.32, 0.76),
          aggression: rand(0.28, 0.78),
          vengeance: rand(0.2, 0.82),
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
          relationships: {},
          relationshipCooldowns: {},
          squadId: null,
          formationSlot: null,
          collisionRadius: role === "vehicle" ? 14 : player.faction === "Space Marines" ? 5 : player.race === "Orks" && role === "builder" ? 2 : 3,
          speed: role === "vehicle" ? 30 : role === "scout" ? 26 : 21,
          range: role === "vehicle" ? 150 : role === "scout" ? 130 : role === "builder" ? 0 : 112,
          damage: baseDamage * (1 + Math.min(5, researchLevel) * 0.04),
          researchLevel,
          fireCd: rand(0.2, 1.5),
          healCd: 0,
          buildCd: role === "builder" ? rand(1, 2.5) : rand(12, 22),
          buildProject: null,
          targetId: null,
          combatIntent: "Follow objective",
          killConfidence: 0,
          combatCommitment: null,
          protectTargetId: null,
          protectionRequested: false,
          retreating: false,
          wounds: 0,
          woundState: "Healthy",
          bleeding: 0,
          incapacitated: false,
          stabilized: false,
          incapacitatedAt: null,
          bleedOutTime: 0,
          carriedById: null,
          carryingPatientId: null,
          rescueRequested: false,
          evacuated: false,
          conditionMultiplier: 1,
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
        if (player.race === "Orks") {
          unit.orkRank = role === "commander" ? "Boss Nob" : role === "builder" ? "Gretchin" : "Boy";
          unit.dominance = 0;
          unit.spriteScale = role === "commander" ? 1.18 : role === "builder" ? 0.72 : 1;
          unit.aggression = clamp(unit.aggression + 0.2, 0, 1);
          unit.courage = clamp(unit.courage + (role === "builder" ? -0.24 : 0.18), 0.08, 1);
          unit.discipline = clamp(unit.discipline - 0.16, 0.08, 1);
          unit.strength = clamp(unit.strength + (role === "builder" ? -0.18 : 0.16), 0.12, 1);
          if (role === "builder") {
            unit.maxHp = 56;
            unit.hp = unit.maxHp;
            unit.engineering = rand(0.58, 0.72);
            unit.weapon = "Scrap tools";
            unit.attachment = "Grot tool sack";
            unit.logs = ["Scrounging for scrap.", "Keeping out of da boss's way."];
          }
        }
        if (player.race === "Tyranids") {
          unit.synapse = role === "commander" || role === "standard" || unit.name.includes("Tyranid Warrior") || unit.name.includes("Zoanthrope");
          unit.underSynapse = unit.synapse;
          unit.instinctiveBehavior = role === "scout" ? "Hunt" : role === "builder" ? "Feed and tend" : role === "vehicle" ? "Territorial predator" : "Seek synapse";
          unit.morale = 1;
          unit.fear = 0;
          unit.loyalty = 1;
          unit.vengeance = 0;
          unit.logs = role === "builder" ? ["Tending the infestation.", "Awaiting synaptic growth direction."] : ["Linked to the Hive Mind.", "Awaiting target-priority impulse."];
          if (role === "builder") {
            unit.weapon = "Feeder tendrils";
            unit.attachment = "Biomass nodules";
          }
        }
        if (unit.role === "vehicle" && /Land Raider|Baneblade|Rogal Dorn|Battlewagon|Carnifex|Tyrannofex/i.test(unit.name)) unit.collisionRadius = 22;
        ensureIndividualRuntime(unit);
        if (player.race === "Tyranids") unit.personality = unit.synapse ? "Synaptic relay" : "Instinctive bioform";
        return unit;
      }

      function rebuildUnitSelect() {
        const previous = state.selectedId;
        els.unitSelect.textContent = "";
        const selectableUnits = state.units.filter(unit => objectVisibleToFog(unit));
        for (const unit of selectableUnits) {
          const option = document.createElement("option");
          option.value = unit.id;
          option.textContent = `${unitLabel(unit)} — ${roleLabel(unit)}`;
          els.unitSelect.append(option);
        }
        state.selectedId = selectableUnits.some(unit => unit.id === previous) ? previous : selectableUnits[0]?.id || null;
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

      function ensureSquadRuntime(squad) {
        if (!squad) return null;
        squad.templateId ||= "mixed";
        squad.nominalSize ||= 6;
        squad.formation ||= "wedge";
        squad.formationSince ??= state.time;
        squad.heading ??= 0;
        squad.objective ||= null;
        squad.targetId ||= null;
        squad.protectedAssetId ||= null;
        squad.orderType ||= "Advance";
        squad.roadId ||= null;
        squad.routeSegmentId ||= null;
        squad.routeAnchor ||= null;
        squad.routePhase ||= null;
        squad.routePhaseSince ??= state.time;
        squad.routeLastTick ??= state.time;
        squad.patrolWaypoint ??= 0;
        squad.cohesion ??= 1;
        squad.reinforcementState ||= "None";
        squad.slotAssignments ||= {};
        squad.nextPlanAt ??= 0;
        squad.orderIssuedAt ??= state.time;
        squad.orderCommitUntil ??= state.time;
        squad.lastCreditedOrderAt ??= null;
        squad.actingLeaderId ||= null;
        squad.leadershipState ||= "Assigned leader";
        return squad;
      }

      function createSquad(faction, leader, options = {}) {
        const serial = state.nextSquadId++;
        const squad = ensureSquadRuntime({
          id: `squad-${serial}`,
          name: options.name || `Squad ${squadNames[(serial - 1) % squadNames.length]}`,
          leaderId: leader?.id || null,
          faction,
          createdAt: state.time,
          ...options
        });
        state.squads.push(squad);
        return squad;
      }

      function squadMembers(squadId, snapshot = null) {
        const members = state.units.filter(unit => unit.squadId === squadId);
        if (!snapshot) return members.filter(unit => unit.alive);
        return members.filter(unit => snapshot.units.find(item => item.id === unit.id)?.alive);
      }

      function livingSquadMemberMap() {
        const map = new Map();
        for (const unit of state.units) {
          if (!unit.alive || !unit.squadId) continue;
          if (!map.has(unit.squadId)) map.set(unit.squadId, []);
          map.get(unit.squadId).push(unit);
        }
        return map;
      }

      function attachUnits(source, target) {
        if (!source || !target || source.id === target.id || !areAllies(source.faction, target.faction)) return;
        let squad = target.squadId ? squadFor(target.squadId) : source.squadId ? squadFor(source.squadId) : null;
        if (!squad) {
          squad = createSquad(target.faction, target.commandRank >= source.commandRank ? target : source);
        }
        ensureSquadRuntime(squad);
        const atomicGuardSquad = String(squad.templateId).startsWith("guard-");
        const sourceSquad = squadFor(source.squadId);
        if (sourceSquad && String(sourceSquad.templateId).startsWith("guard-") && sourceSquad.id !== squad.id) {
          addUnitLog(source, `Attachment denied: survivors leave ${sourceSquad.name} only through the Guard merge and redistribution workflow.`);
          incident(`${unitLabel(source)} remained with atomic ${sourceSquad.name}.`, source.id, "warning");
          return;
        }
        if (atomicGuardSquad && source.squadId !== squad.id) {
          const templateKey = squad.templateId.replace("guard-", "");
          const missingSpecs = missingGuardTemplateSpecs(templateKey, squad, Math.max(0, squad.nominalSize - squadMembers(squad.id).length));
          const compatibleSlot = missingSpecs.some(spec => spec.title === source.specialty);
          if (source.faction !== squad.faction || squadMembers(squad.id).length >= squad.nominalSize || !compatibleSlot) {
            addUnitLog(source, `Attachment denied: ${squad.name} accepts only a matching Guard replacement detachment within its roster capacity.`);
            incident(`${unitLabel(source)} could not attach individually to atomic ${squad.name}.`, source.id, "warning");
            return;
          }
        }
        source.squadId = squad.id;
        target.squadId = squad.id;
        seedSquadRelationships([source, target], state.units.find(unit => unit.id === squad.leaderId));
        addUnitLog(source, `Attached to ${squad.name} under ${unitLabel(state.units.find(unit => unit.id === squad.leaderId) || target)}.`);
        addUnitLog(target, `${unitLabel(source)} attached to ${squad.name}.`);
        incident(`${unitLabel(source)} attached to ${unitLabel(target)}, forming ${squad.name}.`, source.id, "info");
        rebuildAttachSelect();
        updateUI(true);
      }

      function autoFormSquads(faction) {
        if (playerFor(faction).faction === "Imperial Guard") return;
        const candidates = state.units.filter(unit => unit.alive && unit.faction === faction && unit.role !== "builder" && unit.role !== "vehicle" && !unit.squadId);
        const existing = state.squads.find(squad => squad.faction === faction && squadMembers(squad.id).length < 6);
        if (existing && candidates.length) {
          const capacity = 6 - squadMembers(existing.id).length;
          for (const member of candidates.slice(0, capacity)) {
            member.squadId = existing.id;
            addUnitLog(member, `Transferred into ${existing.name}.`);
            seedSquadRelationships([member, ...squadMembers(existing.id).filter(other => other.id !== member.id).slice(0, 5)], state.units.find(unit => unit.id === existing.leaderId));
          }
          return;
        }
        const leader = candidates.find(unit => unit.role === "commander") || candidates[0];
        if (!leader || candidates.length < 3) return;
        const group = candidates.slice(0, Math.min(5, candidates.length));
        const squad = createSquad(faction, leader);
        for (const member of group) {
          member.squadId = squad.id;
          addUnitLog(member, `Attached to ${squad.name}.`);
        }
        seedSquadRelationships(group, leader);
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
            x: clamp(worldWidth() / 2 + Math.cos(angle) * 2600, 35, worldWidth() - 35),
            y: clamp(worldHeight() / 2 + Math.sin(angle) * 2600, 35, worldHeight() - 35),
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
        const nextWorld = presetKey === "custom" ? state.world : preset.world;
        setWorldSize(nextWorld.width, nextWorld.height);
        state.world.baseTerrain = presetKey === "ash" ? "ash" : presetKey === "verdant" ? "forestfloor" : "grass";
        state.battleSeed = `${presetKey}:${worldWidth()}x${worldHeight()}:${state.players.map(player => `${player.race}-${player.doctrine}`).join("|")}`;
        battleRandom = seededRandom(state.battleSeed);
        if (presetKey !== "custom") {
          state.lighting.mode = "dynamic";
          state.lighting.startHour = preset.startMinute / 60;
          state.lighting.fixedHour = preset.startMinute / 60;
          state.lighting.weather = presetKey === "iron" ? "rain" : presetKey === "verdant" ? "fog" : "dust";
        }
        if (!state.players.length) state.players = setupPlayers.slice(0, 2).map((player, index) => ({ ...player, base: deploymentPosition(index, 2, state.world) }));
        state.players.forEach((player, index) => {
          player.index = index;
          player.id = ids[index];
          player.base = deploymentPosition(index, state.players.length, state.world);
          player.spawnZone = { shape: "circle", size: 84, points: [] };
          player.deploymentMethod = factionProfile(player).deployment;
        });
        const center = worldCenter();
        const initialZoom = fitWorldZoom();
        state.camera = { x: center.x, y: center.y, zoom: initialZoom, rotation: 0 };
        state.cameraFocus = { ...center };
        state.panning = false;
        state.panPointerId = null;
        state.panStart = null;
        els.zoomLevel.value = "fit";
        els.zoomValue.textContent = `Fit · ${Math.round(initialZoom * 100)}%`;
        els.zoomOut.disabled = initialZoom <= 0.1001;
        els.zoomIn.disabled = false;
        state.units = [];
        state.structures = [];
        state.squads = [];
        state.projectiles = [];
        state.features = (customFeatures ?? preset.features).map(feature => {
          const scaled = presetKey === "custom" ? feature : {
            ...feature,
            x: feature.x / 960 * worldWidth(),
            y: feature.y / 540 * worldHeight(),
            x2: feature.x2 == null ? undefined : feature.x2 / 960 * worldWidth(),
            y2: feature.y2 == null ? undefined : feature.y2 / 540 * worldHeight(),
            r: feature.r / 540 * Math.min(worldWidth(), worldHeight())
          };
          return { condition: 1, age: 0, ...scaled, visual: scaled.visual || visualForBrush(scaled.type) };
        });
        seedStrategicResourceNodes(battleRandom);
        markFeatureIndexDirty();
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
        replayRenderCache = { key: "", grid: new Map(), units: [], structures: [] };
        state.resources = {};
        state.economies = {};
        state.convoys = [];
        state.dropPods = [];
        state.roads = [];
        state.roadSpatialIndex = new Map();
        state.roadRevision = 0;
        state.nextConvoyId = 1;
        state.nextDropPodId = 1;
        state.nextLogisticsTick = 0;
        state.casualties = {};
        state.deathRemovalStats = { units: 0, structures: 0 };
        state.adapted = {};
        state.nextUnitIndex = {};
        state.nextTrain = {};
        state.nextSquadId = 1;
        state.armyPlans = {};
        state.factionEcology = {};
        state.strategicOutcomes = {};
        state.victoryEvaluationAccumulator = 0;
        state.aiDiagnostics = { relationshipEdges: 0, killPursuits: 0, formationSquads: 0, routeOrders: 0, guardSquads: 0, securedRoads: 0, ambushRoads: 0, checkpoints: 0, environmentCollisions: 0, obstacleProjectileHits: 0 };
        state.explored = {};
        state.visibleFogChunks = {};
        state.exploredFogCells = {};
        state.visibleFogCells = {};
        state.teamFogVisibility = new Map();
        state.explorationAccumulator = 0;
        const exploredByTeam = new Map();
        for (const player of state.players) {
          state.economies[player.id] = createEconomy(player);
          state.resources[player.id] = state.economies[player.id].inventory.requisition;
          state.casualties[player.id] = 0;
          state.adapted[player.id] = false;
          state.nextUnitIndex[player.id] = 0;
          state.nextTrain[player.id] = 0;
          state.armyPlans[player.id] = { goal: "Establish foothold", targetFaction: null, issuedAt: 0 };
          state.factionEcology[player.id] = player.race === "Orks"
            ? { sporeSaturation: 18, waaaghMomentum: 0.18, lastEmergenceAt: -30, warbossId: null }
            : player.race === "Tyranids"
              ? { biomass: 24, adaptation: 0, synapseCoverage: 0, lastGestationAt: -30 }
              : {};
          state.strategicOutcomes[player.id] = { status: "Building operational capability", defeated: false, surrendered: false };
          player.productionCycle = 0;
          player.hasEstablishedCapability = false;
          const team = String(player.team);
          if (!exploredByTeam.has(team)) {
            exploredByTeam.set(team, { chunks: new Set(), cells: createFogCellMask() });
          }
          const explored = exploredByTeam.get(team);
          state.explored[player.id] = explored.chunks;
          state.exploredFogCells[player.id] = explored.cells;
          state.units.push(makeUnit(player.id, "builder", "Ground deployment · starting zone"));
        }
        invalidateLightingCaches();
        updateExploration(0, true);
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
        state.socialAccumulator = 0;
        state.squadAIAccumulator = 0;
        state.commanderAIAccumulator = 0;
        state.armyAIAccumulator = 0;
        state.roadAIAccumulator = 0;
        state.factionAIAccumulator = 0;
        state.spatialGrid = new Map();
        state.spatialMembership = new WeakMap();
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
        state.world.baseTerrain = profile.base;
        state.terrainChunks = new Map();
        const generated = [];
        const patchCount = Math.min(120, Math.max(biome === "archipelago" ? 48 : 42, Math.round(Math.min(worldWidth(), worldHeight()) / 256)));
        for (let index = 0; index < patchCount; index += 1) {
          const type = profile.terrain[Math.floor(random() * profile.terrain.length)];
          const point = {
            x: 160 + random() * (worldWidth() - 320),
            y: 160 + random() * (worldHeight() - 320)
          };
          paintTerrainPatch(point, type, 220 + random() * (biome === "archipelago" ? 720 : 520), random);
        }
        const propCount = Math.min(120, biome === "forest" ? patchCount : Math.round(patchCount * 0.62));
        for (let index = 0; index < propCount; index += 1) {
          const type = profile.props[Math.floor(random() * profile.props.length)];
          generated.push({
            type,
            x: 64 + random() * (worldWidth() - 128),
            y: 64 + random() * (worldHeight() - 128),
            r: 28 + random() * 72,
            shape: "circle",
            opacity: 0.9 + random() * 0.1,
            condition: 1,
            age: 0,
            visual: visualForBrush(type)
          });
        }
        state.players.forEach((player, index) => {
          const deployment = deploymentPosition(index, state.players.length, state.world);
          player.base = {
            x: clamp(deployment.x + (random() - 0.5) * 240, 88, worldWidth() - 88),
            y: clamp(deployment.y + (random() - 0.5) * 240, 78, worldHeight() - 78)
          };
          player.spawnZone = { shape: random() > 0.7 ? "square" : "circle", size: 70 + Math.round(random() * 25), points: [] };
          const builder = state.units.find(unit => unit.faction === player.id && unit.role === "builder");
          if (builder) {
            builder.x = player.base.x;
            builder.y = player.base.y;
          }
        });
        state.features = generated;
        seedStrategicResourceNodes(random);
        markFeatureIndexDirty();
        rebuildSpatialGrid();
        state.minimapMarkerDirty = true;
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
          return territory;
        });
        state.selectedTerritoryId = state.territories[0]?.id || null;
        state.tradePartners = createTradePartners();
        rebuildRoadNetwork();
        state.selectedTerritoryId && rebuildTerritorySelect();
        loadTerritoryForm();
        els.battleName.textContent = `${seedText} / ${els.randomBiome.selectedOptions[0].text}`;
        els.editorTip.textContent = `${els.randomBiome.selectedOptions[0].text} generated · ${state.terrainChunks.size} terrain chunks · ${generated.length} objects · ${state.territories.length} territories`;
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
        const constructionRadius = Math.max(spec.hitbox?.w || 28, spec.hitbox?.h || 24) * 0.48;
        if (environmentCollisionAt(site, { role: "vehicle", collisionRadius: constructionRadius, maxHp: 80, strength: 0.5 }, constructionRadius)) return false;
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
        const desiredResource = extractorResourceType[type];
        if (desiredResource) {
          for (const node of state.features.filter(feature => feature.resourceNode && feature.resourceType === desiredResource && feature.reserve > 0)) {
            const territory = territoryAt(node);
            if (!territory || territory.owner !== faction) continue;
            for (let index = 0; index < 8; index += 1) {
              const angle = index * Math.PI / 4;
              candidates.push({
                x: clamp(Math.round((node.x + Math.cos(angle) * (node.r + 28)) / 16) * 16, 34, worldWidth() - 34),
                y: clamp(Math.round((node.y + Math.sin(angle) * (node.r + 28)) / 16) * 16, 34, worldHeight() - 34)
              });
            }
          }
        }
        for (let ring = 0; ring < 5; ring += 1) {
          const radius = 44 + ring * 34;
          for (let index = 0; index < 12; index += 1) {
            const candidateAngle = startAngle + index * Math.PI / 6 + ring * 0.19;
            candidates.push({
              x: clamp(Math.round((base.x + Math.cos(candidateAngle) * radius) / 16) * 16, 34, worldWidth() - 34),
              y: clamp(Math.round((base.y + Math.sin(candidateAngle) * radius) / 16) * 16, 34, worldHeight() - 34)
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
        ensureIndividualRuntime(unit);
        unit.buildCd -= dt;
        unit.builderDecisionCd = (unit.builderDecisionCd || 0) - dt;
        if (unit.hp < unit.maxHp * 0.3 || unit.morale < 0.23) unit.retreating = true;
        if (unit.retreating) {
          const base = baseFor(unit.faction);
          unit.protectionRequested = true;
          moveToward(unit, base, dt, 1.12);
          unit.status = unit.hp < unit.maxHp * 0.3 ? "Builder retreating" : "Builder regrouping";
          unit.lastAction = "Withdrawing from the work site and requesting protection.";
          if (distance(unit, base) < 44) {
            unit.morale = clamp(unit.morale + dt * 0.035, 0, 1);
            unit.fatigue = clamp(unit.fatigue - dt * 0.025, 0, 1);
            unit.hp = clamp(unit.hp + dt * 0.45, 0, unit.maxHp * 0.58);
            if (unit.morale > 0.5 && unit.hp > unit.maxHp * 0.4) {
              unit.retreating = false;
              unit.protectionRequested = false;
            }
          }
          return;
        }
        const nearbyThreats = nearbyCombatObjects(unit, 150).units.filter(other => other.alive && !areAllies(other.faction, unit.faction));
        const capableEscort = nearbyCombatObjects(unit, 72).units.find(other => other.alive
          && areAllies(other.faction, unit.faction)
          && other.id !== unit.id
          && other.role !== "builder"
          && other.damage > 0
          && other.ammo > 0
          && !other.retreating
          && other.hp > other.maxHp * 0.45
          && other.protectTargetId === unit.id);
        const risk = clamp(nearbyThreats.length / 5, 0, 1);
        const escortTrust = capableEscort ? clamp((relationshipScore(unit, capableEscort) + 50) / 150, 0.1, 1) : 0;
        const riskTolerance = clamp(0.16 + unit.courage * 0.38 + unit.loyalty * 0.12 + unit.aggression * 0.08 + (capableEscort ? 0.07 + escortTrust * 0.11 : 0), 0.15, 0.82);
        unit.protectionRequested = risk > 0.15;
        if (unit.protectionRequested && unit.protectionRequestedAt == null) unit.protectionRequestedAt = state.time;
        if (!unit.protectionRequested) {
          unit.protectionRequestedAt = null;
          unit.assignedEscortSquadId = null;
        }
        if (capableEscort) unit.lastEscortSeenAt = state.time;
        if (risk > riskTolerance) {
          const assignedSquad = squadFor(unit.assignedEscortSquadId);
          const assignedLeader = assignedSquad ? state.units.find(other => other.id === assignedSquad.leaderId && other.alive) : null;
          const requestAge = state.time - (unit.protectionRequestedAt ?? state.time);
          if (assignedLeader && !capableEscort && requestAge > 6 && state.time - (unit.lastEscortSeenAt ?? unit.protectionRequestedAt ?? state.time) > 6) {
            recordRelationshipEvent(unit, assignedLeader, "exposedAlly", "left the construction detail exposed", { cooldown: 45, reciprocal: 0.15 });
          } else if (!assignedLeader && !capableEscort && requestAge > 10) {
            const responsibleOfficer = nearbyCombatObjects(unit, 190).units
              .filter(other => other.alive && areAllies(other.faction, unit.faction) && other.role === "commander")
              .sort((a, b) => distance(unit, a) - distance(unit, b))[0];
            if (responsibleOfficer) recordRelationshipEvent(unit, responsibleOfficer, "ignoredEscort", "did not answer a protection request", { cooldown: 55, reciprocal: 0.1 });
          }
          moveToward(unit, baseFor(unit.faction), dt, 1.08);
          unit.status = "Awaiting protection";
          unit.lastAction = `Construction risk ${Math.round(risk * 100)}% exceeds tolerance; requesting an allied escort.`;
          return;
        }

        const player = playerFor(unit.faction);
        const removableObstacle = nearbyEnvironmentFeatures(unit, 110)
          .filter(feature => feature.removable && feature.collisionState !== "cleared"
            && (player.race !== "Orks" || ["heavy-debris", "medium-debris", "biomass"].includes(feature.collisionProfile?.family)))
          .sort((a, b) => distance(unit, a) - distance(unit, b))[0];
        if (!unit.buildProject && removableObstacle) {
          if (distance(unit, removableObstacle) > 14 + (unit.collisionRadius || 3)) moveToward(unit, removableObstacle, dt, player.race === "Orks" ? 1.1 : 0.9);
          else {
            const cleared = damageEnvironmentFeature(removableObstacle, dt * (8 + unit.engineering * 12), unit);
            if (player.race === "Orks") {
              economyFor(unit.faction).inventory.materials += dt * 0.8;
              unit.status = "Lootin' scrap";
              unit.lastAction = `Dragging usable scrap out of ${brushNames[removableObstacle.type] || "wreckage"} for da Meks.`;
            } else if (player.race === "Tyranids") {
              state.factionEcology[unit.faction].biomass += dt * 0.7;
              unit.status = "Reclaiming biomass";
              unit.lastAction = "Feeder tendrils are dissolving recoverable biomass.";
            } else {
              unit.status = "Clearing obstacle";
              unit.lastAction = `Clearing ${brushNames[removableObstacle.type] || "debris"} from movement and road layers.`;
            }
            if (cleared) incident(`${unitLabel(unit)} cleared an environmental obstacle and updated the local route grid.`, unit.id, "info");
          }
          return;
        }

        const repairDoctrine = playerFor(unit.faction).doctrine === "Repair first";
        const urgentRepair = nearbyCombatObjects(unit, 260).structures
          .filter(item => item.alive !== false && areAllies(item.faction, unit.faction) && item.progress >= 1 && item.condition < (repairDoctrine ? 0.82 : 0.5))
          .sort((a, b) => a.condition - b.condition || distance(unit, a) - distance(unit, b))[0];
        if (unit.buildProject && urgentRepair && (repairDoctrine || urgentRepair.condition < 0.3)) {
          unit.buildProject = null;
          unit.lastAction = `Paused construction to save ${buildingCatalog[urgentRepair.type]?.label || "an allied structure"}.`;
        }
        if (!unit.buildProject && !urgentRepair && unit.builderDecisionCd <= 0) {
          const alliedProject = state.structures
            .filter(item => item.alive !== false && item.progress < 1 && areAllies(item.faction, unit.faction) && distance(unit, item) < 260)
            .map(item => {
              const lead = state.units.find(other => other.id === item.leadBuilderId);
              return { item, score: 90 - distance(unit, item) * 0.18 + relationshipScore(unit, lead) * 0.12 };
            })
            .sort((a, b) => b.score - a.score)[0]?.item;
          if (alliedProject) {
            unit.buildProject = alliedProject.id;
            alliedProject.contributors ||= {};
            alliedProject.contributors[unit.id] ||= 0;
            const lead = state.units.find(other => other.id === alliedProject.leadBuilderId);
            if (lead) recordRelationshipEvent(unit, lead, "completedTogether", "joined an allied construction project", { cooldown: 30, reciprocal: 0.7 });
          }
          unit.builderDecisionCd = 0.75;
        }
        if (unit.buildProject) {
          const structure = state.structures.find(item => item.id === unit.buildProject);
          if (!structure || structure.alive === false) {
            if (structure?.alive === false) addUnitLog(unit, `Abandoned destroyed ${structure.displayName || buildingCatalog[structure.type]?.label || "construction project"}.`);
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
                    x: clamp(structure.x + Math.cos(angle) * radius, 24, worldWidth() - 24),
                    y: clamp(structure.y + Math.sin(angle) * radius, 24, worldHeight() - 24)
                  };
                  const terrain = terrainAt(candidate);
                  if (!structureCollisionAt(candidate, unit.collisionRadius || 3, structure.id)
                    && !environmentCollisionAt(candidate, unit, unit.collisionRadius || 3)
                    && !["deepwater", "lava", "cliff", "mountain"].includes(terrain.type)) {
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
            const supplied = insideSupplyRadius(structure, unit.faction) || insideSupplyRadius(structure, structure.faction) || structure.type === "outpost";
            structure.contributors ||= {};
            structure.contributors[unit.id] = (structure.contributors[unit.id] || 0) + dt;
            structure.activeBuilderTimes ||= {};
            structure.activeBuilderTimes[unit.id] = state.time;
            const activeBuilders = Object.values(structure.activeBuilderTimes).filter(lastAt => state.time - lastAt <= 0.6).length;
            const collaborationFactor = 1 / (1 + 0.35 * Math.max(0, activeBuilders - 1));
            const constructionPlayer = playerFor(unit.faction);
            const orkSupervisor = constructionPlayer.race === "Orks" && nearbyCombatObjects(unit, 46).units.some(other => other.alive && other.faction === unit.faction && other.id !== unit.id && ["engineer", "commander"].includes(other.role));
            const growthFactor = constructionPlayer.race === "Tyranids" ? 1.12 : constructionPlayer.race === "Orks" && orkSupervisor ? 1.28 : 1;
            structure.progress = clamp(structure.progress + dt * (0.07 + unit.engineering * 0.04) * collaborationFactor * (supplied ? 1 : 0.58) * growthFactor, 0, 1);
            unit.status = constructionPlayer.race === "Tyranids" ? "Growing structure" : constructionPlayer.race === "Orks" ? "Grot construction" : "Building";
            unit.lastAction = constructionPlayer.race === "Tyranids"
              ? `${structure.displayName || factionBuildingLabel(unit.faction, structure.type)} ${Math.round(structure.progress * 100)}% gestated${supplied ? "" : " · synaptic supply weak"}.`
              : `${structure.displayName || factionBuildingLabel(unit.faction, structure.type)} ${Math.round(structure.progress * 100)}% complete${orkSupervisor ? " · workin' faster under supervision" : supplied ? "" : " · outside supply radius"}.`;
            if (structure.progress >= 1 && !structure.completedAt) {
              structure.completedAt = state.time;
              ensureStructureRuntime(structure);
              for (const contributor of state.units.filter(other => other.buildProject === structure.id)) {
                moveUnitOutsideStructure(contributor, structure);
                contributor.buildProject = null;
                contributor.detour = null;
                contributor.buildStall = 0;
                contributor.buildCd = rand(0.8, 2.2);
              }
              rebuildRoadNetwork();
              incident(`${unitLabel(unit)} completed ${structure.displayName || factionBuildingLabel(unit.faction, structure.type)} and is evaluating the next funded project.`, unit.id, "info");
              unit.memories.push(`Built ${structure.displayName || factionBuildingLabel(unit.faction, structure.type)} at ${formatElapsed(state.time)}.`);
            }
          }
          return;
        }

        const damaged = urgentRepair || nearbyCombatObjects(unit, 260).structures
          .filter(item => item.alive !== false && areAllies(item.faction, unit.faction) && item.progress >= 1 && item.condition < (repairDoctrine ? 0.82 : 0.5))
          .sort((a, b) => a.condition - b.condition || distance(unit, a) - distance(unit, b))[0];
        if (damaged) {
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

        const damagedRoad = nearestRoadSegment(unit, 180, candidate => areAllies(candidate.road.controllerFaction || candidate.road.faction, unit.faction)
          && (candidate.segment.condition < 0.72 || candidate.segment.operationalFlags?.some(flag => ["wreck", "fallen tree", "obstructed", "partially obstructed", "collapsed", "cratered", "blocked", "damaged", "mined", "flooded"].includes(flag))));
        if (damagedRoad?.segment) {
          const target = damagedRoad.point;
          if (distance(unit, target) > 12) moveToward(unit, target, dt);
          else {
            damagedRoad.segment.condition = clamp(damagedRoad.segment.condition + dt * (0.025 + unit.engineering * 0.04), 0, 1);
            if (damagedRoad.segment.condition > 0.78) damagedRoad.segment.operationalFlags = (damagedRoad.segment.operationalFlags || []).filter(flag => !["wreck", "fallen tree", "obstructed", "partially obstructed", "blocked", "damaged", "mined", "flooded", "collapsed", "cratered"].includes(flag));
            damagedRoad.road.condition = damagedRoad.road.segments.reduce((sum, segment) => sum + segment.condition, 0) / damagedRoad.road.segments.length;
          }
          unit.status = "Repairing route";
          unit.lastAction = `Restoring ${damagedRoad.road.name || damagedRoad.road.id} for allied traffic.`;
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
        const builderPlayer = playerFor(unit.faction);
        const advancedOrkProject = builderPlayer.race === "Orks" && ["workshop", "researchcenter", "refinery", "dropbay", "turret"].includes(type);
        const supervisingMek = advancedOrkProject && nearbyCombatObjects(unit, 120).units.find(other => other.alive && other.faction === unit.faction && other.role === "engineer");
        if (advancedOrkProject && !supervisingMek) {
          unit.status = "Haulin' for a Mek";
          unit.lastAction = `${factionBuildingLabel(unit.faction, type)} needs a Mekboy; this Gretchin is gathering scrap and waiting for supervision.`;
          unit.buildCd = 2;
          return;
        }
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
          biological: builderPlayer.race === "Tyranids",
          constructionMethod: builderPlayer.race === "Tyranids" ? "grown bio-organism" : builderPlayer.race === "Orks" ? "scrap-built" : "constructed",
          inventory: {},
          alive: true,
          createdAt: state.time,
          leadBuilderId: unit.id,
          contributors: { [unit.id]: 0 },
          completedAt: null
        };
        state.structures.push(structure);
        unit.buildProject = structure.id;
        unit.status = builderPlayer.race === "Tyranids" ? "Growing bio-structure" : builderPlayer.race === "Orks" ? "Lashin' scrap together" : "Constructing";
        addUnitLog(unit, builderPlayer.race === "Tyranids"
          ? `The Hive Mind selected ${structure.displayName}; feeder tendrils began growing a stationary organism.`
          : `AI selected ${structure.displayName}: ${spec.purpose} utility outweighed cost, threat, and collision risk.`);
        incident(`${playerFor(unit.faction).faction} ${builderPlayer.race === "Tyranids" ? "began growing" : "funded"} ${structure.displayName} (${spec.purpose}).`, unit.id, "info");
      }

      function moveToward(unit, point, dt, speedFactor = 1) {
        const radius = unit.collisionRadius || (unit.role === "vehicle" ? 14 : 3);
        const ignoreId = unit.buildProject || null;
        const enclosingStructure = structureCollisionAt(unit, radius, ignoreId);
        if (enclosingStructure) moveUnitOutsideStructure(unit, enclosingStructure);
        if (unit.detour && distance(unit, unit.detour) < 5) unit.detour = null;
        const movementTarget = unit.detour || point;
        const dx = movementTarget.x - unit.x;
        const dy = movementTarget.y - unit.y;
        const d = Math.hypot(dx, dy) || 1;
        const terrain = terrainAt(unit);
        if ((unit.nextRoadProbeAt || 0) <= state.time) {
          const localRoad = nearestRoadSegment(unit, 22);
          const flags = localRoad?.segment?.operationalFlags || [];
          const onUsableRoad = localRoad
            && localRoad.distance <= (localRoad.segment.width || 7) + radius + 3
            && localRoad.segment.status !== "Blocked"
            && !flags.some(flag => ["blocked", "collapsed", "cratered", "roadblock"].includes(flag));
          if (onUsableRoad) {
            const condition = localRoad.segment.condition ?? 1;
            const congestion = (localRoad.segment.traffic || 0) / Math.max(1, localRoad.segment.capacity || 1);
            const surface = localRoad.segment.roadType === "paved" ? 1.32 : localRoad.segment.roadType === "bridge" ? 1.18 : localRoad.segment.roadType === "trail" ? 1.06 : 1.16;
            unit.roadMovementFactor = clamp(surface * (0.62 + condition * 0.42) - congestion * 0.16, 0.55, 1.38);
            unit.currentRoadSegmentId = localRoad.segment.id;
          } else {
            unit.roadMovementFactor = 1;
            unit.currentRoadSegmentId = null;
          }
          unit.nextRoadProbeAt = state.time + (state.speed >= 8 ? 3 : 0.45);
        }
        const fuelFactor = unit.role === "vehicle" && (unit.fuelReserve ?? 1) <= 0 ? 0.22 : 1;
        const legCondition = unit.bodyZones ? ((unit.bodyZones.leftLeg || 0) + (unit.bodyZones.rightLeg || 0)) / 2 : 1;
        const suppressionFactor = clamp(1 - (unit.suppression || 0) * 0.42, 0.45, 1);
        const obstacleMovement = environmentalMovementFactor(unit, unit);
        const step = unit.speed * terrain.speed * obstacleMovement * (unit.roadMovementFactor || 1) * (1 - unit.fatigue * 0.36) * speedFactor * fuelFactor * clamp(legCondition, 0.35, 1) * suppressionFactor * (unit.conditionMultiplier || 1) * dt;
        const next = { x: clamp(unit.x + dx / d * step, 24, worldWidth() - 24), y: clamp(unit.y + dy / d * step, 24, worldHeight() - 24) };
        const blockedAt = candidate => structureCollisionAt(candidate, radius, ignoreId) || environmentCollisionAt(candidate, unit, radius);
        let collision = blockedAt(next);
        if (collision?.feature) state.aiDiagnostics.environmentCollisions += 1;
        if (collision?.feature && unit.role === "vehicle" && collision.feature.crushable && (unit.maxHp >= 190 || unit.strength > 0.72)) {
          damageEnvironmentFeature(collision.feature, collision.feature.maxHp || 100, unit);
          collision = blockedAt(next);
        }
        if (!collision) {
          unit.x = next.x;
          unit.y = next.y;
          unit.stuckTime = 0;
          return;
        }
        const slideX = { x: next.x, y: unit.y };
        const slideY = { x: unit.x, y: next.y };
        if (Math.abs(slideX.x - unit.x) > 0.001 && !blockedAt(slideX)) { unit.x = slideX.x; unit.stuckTime = 0; }
        else if (Math.abs(slideY.y - unit.y) > 0.001 && !blockedAt(slideY)) { unit.y = slideY.y; unit.stuckTime = 0; }
        else {
          unit.stuckTime = (unit.stuckTime || 0) + dt;
          const side = (unit.index + Math.floor(state.time / 3)) % 2 ? 1 : -1;
          const tangents = [side, -side].map(direction => ({
            x: clamp(unit.x - dy / d * step * direction, 24, worldWidth() - 24),
            y: clamp(unit.y + dx / d * step * direction, 24, worldHeight() - 24)
          }));
          const detour = tangents.find(candidate => !blockedAt(candidate));
          if (detour) {
            unit.x = detour.x;
            unit.y = detour.y;
            unit.stuckTime = 0;
          } else if (collision.feature) {
            const shape = collision.shape;
            const center = shape.shape === "capsule"
              ? { x: (shape.x1 + shape.x2) / 2, y: (shape.y1 + shape.y2) / 2 }
              : { x: shape.x, y: shape.y };
            const normalX = unit.x - center.x;
            const normalY = unit.y - center.y;
            const normalLength = Math.hypot(normalX, normalY) || 1;
            const clearance = radius + Math.max(shape.r || 0, shape.rx || 0, shape.ry || 0, shape.halfW || 0, shape.halfH || 0) + 8;
            unit.detour = {
              x: clamp(center.x + normalX / normalLength * clearance - dy / d * clearance * 0.55 * side, 24, worldWidth() - 24),
              y: clamp(center.y + normalY / normalLength * clearance + dx / d * clearance * 0.55 * side, 24, worldHeight() - 24)
            };
            if (unit.stuckTime > 1.5) {
              unit.cachedObjective = null;
              unit.objectiveCooldown = 0;
              unit.lastAction = `Repathing around ${brushNames[collision.feature.type] || collision.feature.type}.`;
              unit.stuckTime = 0;
            }
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
              .map(candidate => ({ x: clamp(candidate.x, 24, worldWidth() - 24), y: clamp(candidate.y, 24, worldHeight() - 24) }))
              .filter(candidate => !blockedAt(candidate))
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
        const assignedSquad = unit.squadId ? ensureSquadRuntime(squadFor(unit.squadId)) : null;
        const protectedAsset = unit.protectTargetId
          ? state.units.find(item => item.id === unit.protectTargetId && item.alive)
            || state.convoys.find(item => item.id === unit.protectTargetId && !item.finished)
            || state.structures.find(item => item.id === unit.protectTargetId && item.alive !== false)
          : null;
        if (protectedAsset) {
          if (assignedSquad?.formation === "escort" && unit.formationSlot) {
            unit.lightPlan = `Screening ${protectedAsset.name || unitLabel(protectedAsset)} in escort formation`;
            return unit.formationSlot;
          }
          unit.lightPlan = `Protecting ${protectedAsset.name || unitLabel(protectedAsset)}`;
          return protectedAsset;
        }
        if (assignedSquad) {
          if (assignedSquad.leaderId !== unit.id && unit.formationSlot) {
            unit.lightPlan = `${assignedSquad.formation} formation`;
            return unit.formationSlot;
          }
          if (assignedSquad.objective) {
            unit.lightPlan = assignedSquad.orderType || "Following commander order";
            return assignedSquad.objective;
          }
        }
        const start = baseFor(unit.faction);
        if (unit.role === "vehicle") {
          const escortJob = state.convoys.find(convoy => convoy.faction === unit.faction && !convoy.finished && convoy.escortRequested);
          if (escortJob) {
            unit.lightPlan = `Escorting ${escortJob.name}`;
            return escortJob;
          }
        }
        const enemy = enemyPlayerFor(unit.faction);
        if (!enemy) return worldCenter();
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
          x: clamp(direct.x + perpendicular.x * offset, 24, worldWidth() - 24),
          y: clamp(direct.y + perpendicular.y * offset, 24, worldHeight() - 24)
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

      function relationshipScore(unit, other) {
        return unit?.relationships?.[other?.id]?.score || 0;
      }

      function vengeanceDrive(unit, target) {
        if (!unit || !target || unit.lastAllyKillerId !== target.id || unit.lastAllyKillerAt == null) return 0;
        const age = state.time - unit.lastAllyKillerAt;
        if (age >= 120) {
          unit.lastAllyKillerId = null;
          unit.lastAllyKillerAt = null;
          return 0;
        }
        const personalityScale = {
          Vengeful: 1,
          Aggressive: 0.78,
          Protective: 0.72,
          Steady: 0.5,
          Disciplined: 0.38,
          Cautious: 0.24
        }[unit.personality] ?? 0.5;
        return clamp((1 - age / 120) * personalityScale, 0, 1);
      }

      function updateSocialAI() {
        for (const unit of state.units) {
          if (!unit.alive) continue;
          if (playerFor(unit.faction).race === "Tyranids") {
            unit.relationships = {};
            unit.friends = [];
            unit.rivals = [];
            continue;
          }
          ensureIndividualRuntime(unit);
          let relationshipDecayed = false;
          for (const record of Object.values(unit.relationships || {})) {
            if (state.time - (record.lastAt ?? state.time) <= 180 || Math.abs(record.score) < 0.1) continue;
            record.score = Math.abs(record.score) <= 0.12 ? 0 : record.score - Math.sign(record.score) * 0.12;
            relationshipDecayed = true;
          }
          if (relationshipDecayed) refreshRelationshipLists(unit);
          const nearby = nearbyCombatObjects(unit, 62).units
            .filter(other => other.alive && other.id !== unit.id)
            .sort((a, b) => distance(unit, a) - distance(unit, b))
            .slice(0, 8);
          for (const other of nearby) {
            if (unit.id > other.id) continue;
            ensureIndividualRuntime(other);
            if (areAllies(unit.faction, other.faction)) {
              if (unit.squadId && unit.squadId === other.squadId && unit.targetId && other.targetId) {
                recordRelationshipEvent(unit, other, "foughtTogether", "fought beside one another", { cooldown: 24, reciprocal: 1 });
              }
              if (unit.role === "builder" && other.role === "builder" && unit.buildProject && unit.buildProject === other.buildProject) {
                recordRelationshipEvent(unit, other, "completedTogether", "cooperated on allied construction", { cooldown: 28, reciprocal: 1 });
              }
              if (unit.protectTargetId === other.id || other.protectTargetId === unit.id) {
                const protector = unit.protectTargetId === other.id ? unit : other;
                const protectedUnit = protector === unit ? other : unit;
                const activeDanger = protectedUnit.protectionRequested || nearbyCombatObjects(protectedUnit, 90).units.some(candidate => candidate.alive && !areAllies(candidate.faction, protectedUnit.faction));
                const incidentKey = protectedUnit.protectionRequestedAt ?? (activeDanger ? Math.floor(state.time / 30) : null);
                if (activeDanger && protectedUnit.lastProtectionCreditKey !== incidentKey) {
                  recordRelationshipEvent(protectedUnit, protector, "protectedBuilder", "answered a protection request under threat", { cooldown: 30, reciprocal: 0.45 });
                  protectedUnit.lastProtectionCreditKey = incidentKey;
                }
              }
              if (unit.squadId && unit.squadId === other.squadId && unit.retreating !== other.retreating) {
                const withdrawing = unit.retreating ? unit : other;
                const endangered = withdrawing === unit ? other : unit;
                const leftUnderFire = nearbyCombatObjects(endangered, 54).units.some(candidate => candidate.alive && !areAllies(candidate.faction, endangered.faction)
                  && (candidate.targetId === endangered.id || distance(candidate, endangered) < 28));
                if (leftUnderFire) recordRelationshipEvent(endangered, withdrawing, "abandoned", "withdrew while an ally remained under fire", { cooldown: 60, reciprocal: 0.2 });
              }
              const giver = unit.rations > other.rations + 3 ? unit : other.rations > unit.rations + 3 ? other : null;
              const receiver = giver === unit ? other : giver === other ? unit : null;
              if (giver && receiver && receiver.rations < 2.5) {
                const key = `${receiver.id}:sharedSupplies`;
                if ((giver.relationshipCooldowns[key] || 0) <= state.time) {
                  const transfer = Math.min(1.5, giver.rations - 3);
                  giver.rations -= transfer;
                  receiver.rations += transfer;
                  recordRelationshipEvent(receiver, giver, "sharedSupplies", "shared field supplies", { cooldown: 22, reciprocal: 0.4 });
                }
              }
            } else if (unit.targetId === other.id || other.targetId === unit.id) {
              recordRelationshipEvent(unit, other, "enemyHarm", "met as battlefield enemies", { cooldown: 35, reciprocal: 1 });
            }
          }
        }
        state.aiDiagnostics.relationshipEdges = Math.floor(state.units.reduce((sum, unit) => sum + Object.keys(unit.relationships || {}).length, 0) / 2);
        state.aiDiagnostics.killPursuits = state.units.filter(unit => unit.alive && unit.combatIntent === "Eliminate").length;
      }

      function combatPowerScore(actor) {
        if (!actor || actor.alive === false) return 0;
        const hpRatio = clamp((actor.hp ?? 0) / Math.max(1, actor.maxHp ?? actor.hp ?? 1), 0, 1);
        if (actor.role) {
          const ammoReadiness = actor.maxAmmo ? clamp(actor.ammo / Math.max(1, actor.maxAmmo), 0, 1) : 0;
          const weaponPower = clamp((actor.damage || 0) / 16 + (actor.range || 0) / 260, 0.12, 2.4);
          const armorPower = actor.role === "vehicle" ? 1.75 : actor.role === "commander" ? 1.24 : actor.role === "builder" ? 0.18 : actor.role === "medic" ? 0.34 : 1;
          const readiness = actor.retreating ? 0.18 : actor.ammo <= 0 ? 0.24 : 0.55 + ammoReadiness * 0.45;
          return hpRatio * weaponPower * armorPower * readiness * clamp(0.45 + (actor.morale ?? 0.5) * 0.55, 0.25, 1);
        }
        const armedTypes = new Set(["outpost", "barracks", "workshop", "dropbay"]);
        return hpRatio * (armedTypes.has(actor.type) ? 0.8 : 0.22) * clamp(actor.condition ?? 1, 0.1, 1);
      }

      function killCommitmentFor(unit, target) {
        const nearby = nearbyCombatObjects(unit, Math.max(120, unit.range * 1.35));
        const allies = [...nearby.units, ...nearby.structures].filter(other => other.alive !== false && areAllies(other.faction, unit.faction));
        const enemies = [...nearby.units, ...nearby.structures].filter(other => other.alive !== false && !areAllies(other.faction, unit.faction));
        const targetHp = target.hp / Math.max(1, target.maxHp || target.hp || 1);
        const targetMorale = target.morale ?? target.condition ?? 0.7;
        const ownReadiness = clamp((unit.hp / unit.maxHp * 0.46) + (unit.morale * 0.3) + (unit.ammo / Math.max(1, unit.maxAmmo) * 0.24), 0, 1);
        const alliedPower = allies.reduce((sum, other) => sum + combatPowerScore(other), 0);
        const enemyPower = enemies.reduce((sum, other) => sum + combatPowerScore(other), 0);
        const forceAdvantage = clamp((alliedPower - enemyPower) / Math.max(1, alliedPower + enemyPower), -1, 1);
        const vulnerability = clamp((1 - targetHp) * 0.62 + (1 - targetMorale) * 0.2 + (target.retreating ? 0.18 : 0), 0, 1);
        const targetRange = target.range || unit.range;
        const weaponAdvantage = clamp((unit.range - targetRange) / Math.max(unit.range, targetRange), -1, 1);
        const vengeance = Math.max(vengeanceDrive(unit, target), relationshipScore(unit, target) <= -55 ? 0.5 : 0);
        const incomingThreat = clamp(enemyPower / Math.max(1, alliedPower + 1), 0, 1);
        const distancePenalty = clamp(distance(unit, target) / Math.max(1, unit.range * 2.4), 0, 1);
        const lowAmmo = clamp(1 - unit.ammo / Math.max(1, unit.maxAmmo), 0, 1);
        const isolation = allies.length <= 1 ? 1 : clamp(1 - allies.length / 5, 0, 1);
        const race = playerFor(unit.faction).race;
        const factionConfidence = race === "Orks"
          ? (state.factionEcology[unit.faction]?.waaaghMomentum || 0) * 14 + allies.filter(other => other.role && other.role !== "builder").length * 1.8
          : race === "Tyranids" ? unit.underSynapse ? 10 : vulnerability * 8 - isolation * 6 : 0;
        const confidence = clamp(
          50 + 16 * (ownReadiness - 0.5) + 18 * forceAdvantage + 15 * vulnerability
          + 8 * (unit.morale - 0.5) + 8 * (unit.aggression - 0.5) + 10 * weaponAdvantage
          + 6 * vengeance - 14 * incomingThreat - 9 * distancePenalty - 12 * lowAmmo
          - 8 * unit.fatigue - 12 * isolation + factionConfidence,
          0, 100
        );
        const caution = clamp((unit.patience + unit.discipline + (1 - unit.courage)) / 3, 0, 1);
        const threshold = clamp(56 + 10 * (unit.discipline - 0.5) + 10 * (caution - 0.5) - 10 * (unit.aggression - 0.5) - 6 * vengeance
          - (race === "Orks" ? 8 : race === "Tyranids" && unit.underSynapse ? 5 : 0), 38, 72);
        let intent = confidence >= threshold ? "Eliminate" : confidence >= threshold - 12 ? "Force retreat" : confidence >= 28 && unit.ammo > 2 ? "Suppress" : "Ignore";
        if (target.retreating && confidence < threshold) intent = "Force retreat";
        const pursuitRadius = clamp(unit.range * (0.9 + 1.3 * unit.aggression + 0.5 * vengeance - 0.6 * caution), unit.range * 0.65, unit.range * 2.4);
        return {
          targetId: target.id, intent, confidence, threshold, evaluatedAt: state.time, active: true, rejected: false,
          expiresAt: state.time + (state.speed >= 8 ? 5 : 1.4), originX: unit.x, originY: unit.y, pursuitRadius
        };
      }

      const extractorResourceType = { mine: "materials", refinery: "fuel", farm: "food", generator: "energy" };

      function seedStrategicResourceNodes(random = battleRandom) {
        state.features = state.features.filter(feature => !feature.resourceNode);
        const categories = ["materials", "fuel", "food", "energy"];
        const center = worldCenter();
        const nearCount = state.players.length * categories.length;
        const count = clamp(state.players.length * 6 + Math.round(Math.min(worldWidth(), worldHeight()) / 2048), 16, 48);
        for (let index = 0; index < count; index += 1) {
          const near = index < nearCount;
          const category = near ? categories[Math.floor(index / state.players.length) % categories.length] : categories[index % categories.length];
          const far = !near;
          const anchor = near ? state.players[index % state.players.length].base : center;
          const angle = random() * Math.PI * 2;
          const radius = far ? Math.min(worldWidth(), worldHeight()) * (0.16 + random() * 0.34) : 70 + random() * 110;
          const richness = far ? 1.35 + random() * 0.65 : 0.75 + random() * 0.45;
          const capacity = Math.round((far ? 720 : 320) * richness);
          state.features.push({
            id: `resource-node-${index}`, type: category === "materials" ? "crystal" : category === "fuel" ? "wreckage" : category === "food" ? "crops" : "powerplant",
            resourceNode: true, resourceType: category, reserve: capacity, maxReserve: capacity, richness,
            strategicObjective: far && index % 3 === 0, x: clamp(anchor.x + Math.cos(angle) * radius, 90, worldWidth() - 90),
            y: clamp(anchor.y + Math.sin(angle) * radius, 90, worldHeight() - 90), r: far ? 28 : 20, shape: "circle", opacity: 0.9,
            condition: 1, age: 0, visual: category === "food" ? "vegetation" : category === "materials" ? "rock" : "urban"
          });
        }
        markFeatureIndexDirty();
      }

      function resourceNodeForStructure(structure) {
        const category = extractorResourceType[structure.type];
        if (!category) return null;
        return state.features
          .filter(feature => feature.resourceNode && feature.resourceType === category && feature.reserve > 0)
          .sort((a, b) => distance(structure, a) - distance(structure, b))[0] || null;
      }

      function formationGroupFor(member, index) {
        if (index === 0 || member.role === "commander") return "command";
        if (member.hp / Math.max(1, member.maxHp) < 0.58) return "protected";
        if (["medic", "engineer", "builder"].includes(member.role) || /medic|vox|standard|gunner|heavy|mortar/i.test(`${member.specialty || ""} ${member.weapon || ""}`)) return "support";
        return member.index % 2 ? "left" : "right";
      }

      function formationLocalPosition(formation, index, count, member = null, groupRank = 0) {
        if (index === 0 && formation === "escort") return { x: 0, y: Math.max(20, count * 3.5) };
        if (index === 0) return { x: 0, y: 0 };
        const centered = index - (count - 1) / 2;
        if (formation === "line") return { x: centered * 14, y: Math.abs(centered) * 1.5 };
        if (formation === "column") return { x: (index % 2 ? -1 : 1) * 5, y: -Math.floor((index + 1) / 2) * 14 };
        if (formation === "wedge" || formation === "triangle") {
          if (["support", "protected"].includes(member?.formationGroup)) return { x: (groupRank % 2 ? -1 : 1) * (7 + groupRank * 3), y: -16 - groupRank * 9 };
          const depth = Math.ceil(index / 2);
          return { x: (index % 2 ? -1 : 1) * depth * 13, y: -depth * 12 };
        }
        if (formation === "circle" || formation === "escort") {
          const protectedMember = ["support", "protected"].includes(member?.formationGroup);
          const radius = protectedMember ? 11 + groupRank * 3 : Math.max(20, count * 3.5);
          const angle = index / Math.max(1, count) * Math.PI * 2 - Math.PI / 2;
          return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
        }
        if (formation === "staggered") return { x: centered * 11, y: (index % 2 ? -10 : 6) - Math.abs(centered) * 2 };
        if (formation === "flanking") {
          if (["command", "support", "protected"].includes(member?.formationGroup)) return { x: groupRank % 2 ? -9 : 9, y: -18 - groupRank * 10 };
          const side = member?.formationGroup === "left" ? -1 : 1;
          return { x: side * (42 + groupRank * 12), y: 22 - groupRank * 9 };
        }
        return { x: centered * 12, y: 0 };
      }

      function scoreSquadFormations({ squad, members, center, enemies, protectedAsset, nearbyRoad, regrouping }) {
        const terrain = terrainAt(center);
        const doctrine = playerFor(squad.faction).doctrine;
        const rangedRatio = members.filter(member => member.role === "vehicle" || /rifle|bolter|plasma|melta|launcher|mortar|cannon|gun/i.test(`${member.weapon || ""} ${member.specialty || ""}`)).length / Math.max(1, members.length);
        const woundedRatio = members.filter(member => member.hp / member.maxHp < 0.58).length / Math.max(1, members.length);
        const threatBins = new Set(enemies.map(enemy => Math.floor((((Math.atan2(enemy.y - center.y, enemy.x - center.x) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 2)))));
        const surrounded = threatBins.size >= 3 || enemies.length >= Math.max(3, members.length * 0.7);
        const openGround = clamp(1 - terrain.cover, 0, 1);
        const concealed = clamp(terrain.cover + (1 - terrain.detection) * 0.45, 0, 1);
        const narrowTerrain = ["trees", "denseforest", "jungle", "ruins", "trenches", "bridge"].includes(terrain.type) ? 1 : 0;
        const moving = distance(center, squad.objective || center) > 45;
        const scores = {
          line: 24 + rangedRatio * 24 + openGround * 18 + (["Hold Route", "Block Route", "Delay Enemy", "Destroy Route if Overrun", "Keep Route Open"].includes(squad.orderType) ? 30 : 0),
          column: 20 + (nearbyRoad ? 32 : 0) + narrowTerrain * 18 + (moving ? 10 : 0) + (["Patrol Route", "Regroup"].includes(squad.orderType) ? 32 : 0),
          wedge: 22 + (moving ? 18 : 0) + (doctrine === "Aggressive" ? 24 : 0) + openGround * 10,
          triangle: 24 + (moving ? 14 : 0) + members.length * 0.8 + (doctrine === "Balanced" ? 16 : 0),
          circle: 12 + (surrounded ? 58 : 0) + woundedRatio * 22 + (squad.orderType === "Hold Route" ? 10 : 0),
          staggered: 20 + concealed * 25 + (squad.orderType === "Observe Route" ? 35 : 0) + (squad.orderType === "Ambush Route" ? 18 : 0) + (["Delay Enemy", "Destroy Route if Overrun"].includes(squad.orderType) ? 12 : 0) + enemies.filter(enemy => enemy.role === "vehicle").length * 4,
          flanking: 8 + concealed * 22 + (members.length >= 6 ? 24 : -55) + (enemies.length ? 15 : -12) + (squad.orderType === "Ambush Route" ? 44 : 0) + (doctrine === "Aggressive" ? 12 : 0),
          escort: (protectedAsset ? 72 : -35) + (squad.orderType === "Escort Route" ? 42 : 0) + woundedRatio * 10
        };
        if (regrouping) scores.column += 80;
        if (surrounded) scores.circle += 20;
        return scores;
      }

      function safeFormationPosition(point, unit) {
        const radius = unit.collisionRadius || (unit.role === "vehicle" ? 14 : 3);
        const invalid = candidate => structureCollisionAt(candidate, radius, null)
          || environmentCollisionAt(candidate, unit, radius)
          || ["deepwater", "lava", "cliff", "mountain"].includes(terrainAt(candidate).type);
        if (!invalid(point)) return point;
        for (let ring = 1; ring <= 10; ring += 1) {
          for (let index = 0; index < 12; index += 1) {
            const angle = index * Math.PI / 6;
            const candidate = {
              x: clamp(point.x + Math.cos(angle) * ring * 8, 20, worldWidth() - 20),
              y: clamp(point.y + Math.sin(angle) * ring * 8, 20, worldHeight() - 20)
            };
            if (!invalid(candidate)) return candidate;
          }
        }
        return { x: unit.x, y: unit.y };
      }

      function squadAssetById(id) {
        return state.units.find(item => item.id === id && item.alive)
          || state.convoys.find(item => item.id === id && !item.finished)
          || state.structures.find(item => item.id === id && item.alive !== false)
          || null;
      }

      function roadMidpoint(road) {
        const points = road?.points || [];
        return points[Math.floor(points.length / 2)] || worldCenter();
      }

      function roadTacticalAnchor(road, orderType, squad = null) {
        const segments = road?.segments || [];
        if (!segments.length) return roadMidpoint(road);
        let segment = squad?.routeSegmentId ? segments.find(item => item.id === squad.routeSegmentId) : null;
        if (!segment) {
          const enemy = squad ? enemyPlayerFor(squad.faction) : null;
          const worldDiagonal = Math.hypot(worldWidth(), worldHeight()) || 1;
          const score = item => {
            const midpoint = { x: (item.start.x + item.end.x) / 2, y: (item.start.y + item.end.y) / 2 };
            const flags = item.operationalFlags || [];
            const traffic = (item.traffic || 0) / Math.max(1, item.capacity || 1);
            const hostileFacing = enemy ? 1 - clamp(distance(midpoint, enemy.base) / worldDiagonal, 0, 1) : 0;
            const choke = (item.bridge ? 0.55 : 0) + clamp(1 - (item.width || 8) / 16, 0, 1) * 0.45;
            const contested = item.control === "Contested" ? 1 : item.control === "Enemy controlled" ? 0.82 : 0;
            const hazard = flags.some(flag => ["collapsed", "blocked", "cratered"].includes(flag)) || item.status === "Blocked" ? 1
              : flags.includes("mined") || item.status === "Mined" ? 0.92
                : flags.includes("flooded") || item.status === "Flooded" ? 0.78
                  : flags.includes("wreck") ? 0.68 : clamp(1 - (item.condition ?? 1), 0, 1);
            if (orderType === "Keep Route Open") return hazard * 130 + traffic * 24 + (item.supplyImportance || 0) * 32;
            if (orderType === "Hold Route") return contested * 58 + choke * 40 + (item.supplyImportance || 0) * 36 + traffic * 16;
            if (["Block Route", "Destroy Route if Overrun"].includes(orderType)) return choke * 62 + hostileFacing * 26 + (item.supplyImportance || 0) * 34 + traffic * 12;
            if (orderType === "Delay Enemy") return hostileFacing * 44 + choke * 32 + contested * 28 + (item.cover || 0) * 22;
            if (["Ambush Route", "Observe Route"].includes(orderType)) {
              const terrain = terrainAt(midpoint);
              return (item.cover || 0) * 38 + (item.ambushRisk || 0) * 30 + traffic * 22
                + (1 - (item.visibility || 0)) * (orderType === "Ambush Route" ? 18 : 8)
                + clamp((terrain.elevation || 0) / 8, -1, 1) * (orderType === "Observe Route" ? 14 : 5)
                + choke * 18;
            }
            return (item.supplyImportance || 0) * 20 + traffic * 8;
          };
          segment = segments.reduce((best, item) => !best || score(item) > score(best) ? item : best, null) || segments[Math.floor(segments.length / 2)];
          if (squad && orderType !== "Patrol Route") squad.routeSegmentId = segment.id;
        }
        const midpoint = { x: (segment.start.x + segment.end.x) / 2, y: (segment.start.y + segment.end.y) / 2 };
        if (!["Ambush Route", "Observe Route"].includes(orderType)) {
          const anchor = { ...midpoint, roadId: road.id, segmentId: segment.id };
          if (squad) squad.routeAnchor = anchor;
          return anchor;
        }
        const dx = segment.end.x - segment.start.x;
        const dy = segment.end.y - segment.start.y;
        const length = Math.hypot(dx, dy) || 1;
        const side = ((squad?.id || "").length + playerFor(squad?.faction || road.faction).index) % 2 ? 1 : -1;
        const offset = orderType === "Ambush Route" ? 30 : 20;
        const anchor = {
          x: clamp(midpoint.x - dy / length * offset * side, 20, worldWidth() - 20),
          y: clamp(midpoint.y + dx / length * offset * side, 20, worldHeight() - 20),
          roadId: road.id,
          segmentId: segment.id
        };
        if (squad) squad.routeAnchor = anchor;
        return anchor;
      }

      function routeSegmentForSquad(road, squad) {
        return road?.segments?.find(segment => segment.id === squad?.routeSegmentId)
          || road?.segments?.find(segment => segment.id === squad?.routeAnchor?.segmentId)
          || null;
      }

      function setSquadRoutePhase(squad, phase) {
        if (squad.routePhase === phase) return;
        squad.routePhase = phase;
        squad.routePhaseSince = state.time;
      }

      function establishRoadPost(segment, squad, kind, integrity = 0.68) {
        if (!segment || !squad || segment.checkpoint && !areAllies(segment.checkpoint.faction, squad.faction)) return false;
        if (!segment.checkpoint) {
          segment.checkpoint = { faction: squad.faction, kind, integrity, establishedAt: state.time, lastSupportedAt: state.time };
          segment.operationalFlags = [...new Set([...(segment.operationalFlags || []), "checkpoint", ...(kind === "roadblock" ? ["roadblock"] : [])])];
          if (kind === "roadblock") segment.status = "Blocked";
          const leader = state.units.find(unit => unit.id === squad.leaderId && unit.alive);
          incident(`${squad.name} established a ${kind} on ${segment.id}.`, leader?.id || null, "info");
        } else {
          segment.checkpoint.integrity = clamp(segment.checkpoint.integrity + 0.08, 0, 1);
          segment.checkpoint.lastSupportedAt = state.time;
        }
        return true;
      }

      function orderSquadToRegroup(squad, members, reason) {
        squad.orderType = "Regroup";
        squad.roadId = null;
        squad.routeSegmentId = null;
        squad.routeAnchor = null;
        squad.routePhase = "withdrawing";
        squad.protectedAssetId = null;
        squad.targetId = null;
        squad.objective = { ...baseFor(squad.faction), regroup: true };
        squad.orderIssuedAt = state.time;
        squad.orderCommitUntil = state.time + 16;
        for (const member of members) {
          member.protectTargetId = null;
          member.cachedObjective = null;
          member.cachedTargetId = null;
          member.targetId = null;
        }
        const leader = state.units.find(unit => unit.id === squad.leaderId && unit.alive);
        if (leader) addUnitLog(leader, reason);
      }

      function updateRouteOrderState(squad, members, leader, road, center) {
        if (!road || !routeOrderTypes.includes(squad.orderType)) return null;
        const anchor = squad.routeAnchor || roadTacticalAnchor(road, squad.orderType, squad);
        const segment = routeSegmentForSquad(road, squad);
        if (!segment || !anchor) return null;
        const tickDt = clamp(state.time - (squad.routeLastTick ?? state.time), 0, 3);
        squad.routeLastTick = state.time;
        const atPost = distance(center, anchor) < 38;
        const localUnits = nearbyCombatObjects(anchor, 92).units.filter(unit => unit.alive);
        const friendlies = localUnits.filter(unit => areAllies(unit.faction, squad.faction));
        const hostiles = localUnits.filter(unit => !areAllies(unit.faction, squad.faction));
        const friendlyPower = friendlies.reduce((sum, unit) => sum + combatPowerScore(unit), 0)
          + (segment.checkpoint && areAllies(segment.checkpoint.faction, squad.faction) ? 0.8 * segment.checkpoint.integrity : 0);
        const hostilePower = hostiles.reduce((sum, unit) => sum + combatPowerScore(unit), 0)
          + (segment.checkpoint && !areAllies(segment.checkpoint.faction, squad.faction) ? 0.8 * segment.checkpoint.integrity : 0);
        const heavySingleThreat = hostiles.some(unit => unit.role === "vehicle" || combatPowerScore(unit) >= 1.35);
        const overrun = (hostiles.length >= 2 || heavySingleThreat) && hostilePower > Math.max(1.4, friendlyPower * 1.35);
        const flags = segment.operationalFlags || [];
        const specialists = members.filter(member => member.role === "engineer" || member.role === "builder" || /engineer|grenadier|demolition/i.test(`${member.specialty || ""} ${member.attachment || ""}`));
        const phaseAge = state.time - (squad.routePhaseSince ?? state.time);

        if (squad.orderType === "Hold Route") {
          if (!atPost) setSquadRoutePhase(squad, "deploying");
          else if (segment.checkpoint && areAllies(segment.checkpoint.faction, squad.faction)) {
            segment.checkpoint.lastSupportedAt = state.time;
            setSquadRoutePhase(squad, overrun ? "contested" : "holding");
          } else if (!segment.checkpoint) {
            if (squad.routePhase !== "fortifying") setSquadRoutePhase(squad, "fortifying");
            else if (phaseAge >= 6 && establishRoadPost(segment, squad, "checkpoint", 0.72)) setSquadRoutePhase(squad, "holding");
          } else setSquadRoutePhase(squad, "contesting enemy checkpoint");
        } else if (squad.orderType === "Block Route") {
          if (!atPost) setSquadRoutePhase(squad, "deploying roadblock");
          else if (segment.checkpoint?.kind === "roadblock" && areAllies(segment.checkpoint.faction, squad.faction)) {
            segment.checkpoint.lastSupportedAt = state.time;
            setSquadRoutePhase(squad, "blocking traffic");
          } else if (segment.checkpoint && areAllies(segment.checkpoint.faction, squad.faction)) {
            if (squad.routePhase !== "converting allied post") setSquadRoutePhase(squad, "converting allied post");
            else if (phaseAge >= 4) {
              segment.checkpoint.kind = "roadblock";
              segment.checkpoint.integrity = Math.max(segment.checkpoint.integrity, 0.72);
              segment.checkpoint.lastSupportedAt = state.time;
              segment.operationalFlags = [...new Set([...(segment.operationalFlags || []), "checkpoint", "roadblock"])];
              segment.status = "Blocked";
              setSquadRoutePhase(squad, "blocking traffic");
            }
          } else if (!segment.checkpoint) {
            if (squad.routePhase !== "preparing roadblock") setSquadRoutePhase(squad, "preparing roadblock");
            else if (phaseAge >= 7 && establishRoadPost(segment, squad, "roadblock", 0.78)) setSquadRoutePhase(squad, "blocking traffic");
          } else setSquadRoutePhase(squad, "contesting enemy checkpoint");
        } else if (squad.orderType === "Observe Route") {
          if (!atPost) setSquadRoutePhase(squad, "moving to observation post");
          else {
            setSquadRoutePhase(squad, hostiles.length ? "reporting contact" : "observing traffic");
            if (!segment.checkpoint && state.time - squad.orderIssuedAt >= 8) establishRoadPost(segment, squad, "observation post", 0.52);
            if (segment.checkpoint && areAllies(segment.checkpoint.faction, squad.faction)) segment.checkpoint.lastSupportedAt = state.time;
          }
        } else if (squad.orderType === "Keep Route Open") {
          if (!atPost) setSquadRoutePhase(squad, "securing damaged segment");
          else {
            if (segment.checkpoint?.kind === "roadblock" && areAllies(segment.checkpoint.faction, squad.faction)) {
              segment.checkpoint.kind = "route checkpoint";
              segment.checkpoint.lastSupportedAt = state.time;
              segment.operationalFlags = (segment.operationalFlags || []).filter(flag => flag !== "roadblock");
              segment.status = "Secured";
            }
            const removable = specialists.length ? ["wreck", "fallen tree", "obstructed", "partially obstructed", "blocked", "damaged", "mined", "flooded", "collapsed", "cratered"] : ["wreck", "fallen tree", "partially obstructed", "damaged"];
            if ((segment.condition ?? 1) < 0.86 || flags.some(flag => removable.includes(flag))) {
              setSquadRoutePhase(squad, specialists.length ? "clearing and repairing" : "securing for engineers");
              segment.condition = clamp(segment.condition + tickDt * (0.002 + specialists.length * 0.008), 0, 1);
              if (segment.condition > (specialists.length ? 0.8 : 0.68)) {
                segment.operationalFlags = (segment.operationalFlags || []).filter(flag => !removable.includes(flag));
              }
            } else {
              setSquadRoutePhase(squad, "escorting traffic");
              if (!segment.checkpoint) establishRoadPost(segment, squad, "route checkpoint", 0.62);
              if (segment.checkpoint && areAllies(segment.checkpoint.faction, squad.faction)) segment.checkpoint.lastSupportedAt = state.time;
            }
          }
        } else if (squad.orderType === "Delay Enemy") {
          if (!atPost) setSquadRoutePhase(squad, "deploying delaying screen");
          else if (!hostiles.length) setSquadRoutePhase(squad, "screening approach");
          else if (!overrun) setSquadRoutePhase(squad, "suppressing advance");
          else {
            const currentMidpoint = { x: (segment.start.x + segment.end.x) / 2, y: (segment.start.y + segment.end.y) / 2 };
            const fallback = (road.segments || [])
              .filter(candidate => candidate.id !== segment.id)
              .map(candidate => ({ candidate, midpoint: { x: (candidate.start.x + candidate.end.x) / 2, y: (candidate.start.y + candidate.end.y) / 2 } }))
              .filter(item => distance(item.midpoint, baseFor(squad.faction)) + 8 < distance(currentMidpoint, baseFor(squad.faction)))
              .sort((a, b) => distance(a.midpoint, currentMidpoint) - distance(b.midpoint, currentMidpoint))[0];
            squad.routeFallbacks = (squad.routeFallbacks || 0) + 1;
            if (fallback && squad.routeFallbacks <= 2) {
              squad.routeSegmentId = fallback.candidate.id;
              squad.routeAnchor = { ...fallback.midpoint, roadId: road.id, segmentId: fallback.candidate.id };
              squad.objective = squad.routeAnchor;
              setSquadRoutePhase(squad, "falling back by bounds");
              for (const member of members) member.cachedObjective = null;
            } else orderSquadToRegroup(squad, members, `Withdrew ${squad.name} after the delaying line was overrun.`);
          }
        } else if (squad.orderType === "Destroy Route if Overrun") {
          if (!atPost) setSquadRoutePhase(squad, "deploying demolition guard");
          else if (!overrun) setSquadRoutePhase(squad, "guarding demolition point");
          else if (squad.demolishedSegmentId !== segment.id) {
            squad.demolishedSegmentId = segment.id;
            segment.condition = Math.min(segment.condition ?? 1, segment.bridge ? 0.04 : 0.12);
            segment.checkpoint = null;
            segment.operationalFlags = [...new Set([...(segment.operationalFlags || []), segment.bridge ? "collapsed" : "cratered", "blocked", "damaged"])];
            incident(`${squad.name} destroyed ${segment.bridge ? "a bridge" : "its assigned route segment"} after hostile forces overran the position.`, leader.id, "critical");
            orderSquadToRegroup(squad, members, `Demolition complete; ${squad.name} is regrouping.`);
          }
        } else if (squad.orderType === "Ambush Route") {
          if (!atPost) setSquadRoutePhase(squad, "moving concealed");
          else {
            setSquadRoutePhase(squad, "waiting in concealment");
            const canMine = isImperialGuard(playerFor(squad.faction)) && specialists.length > 0;
            if (canMine && !squad.mineLaid && state.time - squad.orderIssuedAt >= 8) {
              segment.operationalFlags = [...new Set([...(segment.operationalFlags || []), "mined", "damaged"])];
              segment.mineFaction = squad.faction;
              squad.mineLaid = true;
              incident(`${squad.name} prepared a layered mine ambush on ${road.name || road.id}.`, leader.id, "warning");
            }
          }
        } else if (squad.orderType === "Patrol Route") setSquadRoutePhase(squad, "patrolling waypoints");

        const valuableConvoy = state.convoys.find(convoy => !convoy.finished && !areAllies(convoy.faction, squad.faction)
          && (convoy.activeSegmentId === segment.id || distance(convoy, anchor) < 64));
        return { anchor, segment, atPost, friendlies, hostiles, friendlyPower, hostilePower, overrun, valuableConvoy };
      }

      function updateSquadAI() {
        const membersBySquad = livingSquadMemberMap();
        for (const squad of state.squads) {
          ensureSquadRuntime(squad);
          const roster = [...(membersBySquad.get(squad.id) || [])];
          const fieldRoster = roster.filter(member => !member.reinforcementRendezvous);
          const members = [...(fieldRoster.length ? fieldRoster : roster)].sort((a, b) => {
            if (a.id === squad.leaderId) return -1;
            if (b.id === squad.leaderId) return 1;
            return b.commandRank - a.commandRank || a.index - b.index;
          });
          if (!members.length) continue;
          let leader = members.find(unit => unit.id === squad.leaderId);
          if (!leader) {
            leader = [...members].sort((a, b) => b.commandRank + b.discipline + b.experience / 100 - a.commandRank - a.discipline - a.experience / 100)[0];
            squad.leaderId = leader.id;
            leader.commandRank = Math.max(leader.commandRank, 3);
            leader.temporaryOfficer = true;
            squad.actingLeaderId = leader.id;
            squad.leadershipState = `Acting ${leader.name}`;
            addUnitLog(leader, `Assumed command of ${squad.name} after loss of its leader.`);
          }
          const senior = [...members].sort((a, b) => b.commandRank - a.commandRank || b.discipline - a.discipline || b.experience - a.experience)[0];
          if (senior && senior.id !== leader.id && senior.commandRank > leader.commandRank) {
            const actingLeader = leader;
            leader = senior;
            squad.leaderId = senior.id;
            if (senior.role === "commander") {
              actingLeader.temporaryOfficer = false;
              squad.actingLeaderId = null;
              squad.leadershipState = `Officer attached · ${senior.name}`;
            }
            if (actingLeader.alive && actingLeader.aggression > 0.55) {
              recordRelationshipEvent(actingLeader, senior, "rivalry", "was superseded in squad command", { cooldown: 90, reciprocal: 0.35 });
            }
            addUnitLog(senior, `Took formal command of ${squad.name} after joining the formation.`);
          }
          const retreatRatio = members.filter(member => member.retreating || member.hp < member.maxHp * 0.34 || member.morale < 0.28).length / members.length;
          const averageMorale = members.reduce((sum, member) => sum + member.morale, 0) / members.length;
          if (squad.orderType !== "Regroup" && (retreatRatio >= 0.45 || averageMorale < 0.3)) {
            orderSquadToRegroup(squad, members, `Ordered ${squad.name} to regroup after cohesion and morale fell below the combat threshold.`);
          }
          const protectedAsset = squadAssetById(squad.protectedAssetId);
          const assignedRoad = state.roads.find(road => road.id === squad.roadId);
          const plan = state.armyPlans[squad.faction] || {};
          const enemy = state.players.find(player => player.id === plan.targetFaction) || enemyPlayerFor(squad.faction);
          const center = {
            x: members.reduce((sum, member) => sum + member.x, 0) / members.length,
            y: members.reduce((sum, member) => sum + member.y, 0) / members.length
          };
          const routeState = assignedRoad ? updateRouteOrderState(squad, members, leader, assignedRoad, center) : null;
          const regrouping = squad.orderType === "Regroup" && squad.orderCommitUntil > state.time;
          if (regrouping) squad.objective = { ...baseFor(squad.faction), regroup: true };
          else if (protectedAsset) squad.objective = { x: protectedAsset.x, y: protectedAsset.y, assetId: protectedAsset.id };
          else if (assignedRoad) {
            const points = assignedRoad.points || [];
            if (squad.orderType === "Patrol Route" && points.length) {
              squad.patrolDirection ||= 1;
              squad.patrolWaypoint = clamp(squad.patrolWaypoint ?? 0, 0, points.length - 1);
              if (distance(leader, points[squad.patrolWaypoint]) < 22) {
                if (squad.patrolWaypoint >= points.length - 1) squad.patrolDirection = -1;
                else if (squad.patrolWaypoint <= 0) squad.patrolDirection = 1;
                squad.patrolWaypoint = clamp(squad.patrolWaypoint + squad.patrolDirection, 0, points.length - 1);
              }
              const waypoint = points[squad.patrolWaypoint];
              const patrolRoad = nearestRoadSegment(waypoint, 80, candidate => candidate.road.id === assignedRoad.id);
              squad.routeSegmentId = patrolRoad?.segment.id || null;
              squad.routeAnchor = { ...waypoint, roadId: assignedRoad.id, segmentId: squad.routeSegmentId };
              squad.objective = squad.routeAnchor;
            } else squad.objective = squad.routeAnchor || roadTacticalAnchor(assignedRoad, squad.orderType, squad);
          } else if (enemy) {
            const start = baseFor(squad.faction);
            const aggression = playerFor(squad.faction).doctrine === "Aggressive" ? 0.72 : 0.48;
            squad.objective = {
              x: start.x + (enemy.base.x - start.x) * clamp(aggression + state.time / 900, 0.35, 0.88),
              y: start.y + (enemy.base.y - start.y) * clamp(aggression + state.time / 900, 0.35, 0.88)
            };
          }
          let target = regrouping ? null : squadAssetById(squad.targetId);
          const restrictiveOrder = ["Hold Route", "Block Route", "Patrol Route", "Observe Route", "Ambush Route", "Keep Route Open", "Delay Enemy", "Destroy Route if Overrun", "Escort Route"].includes(squad.orderType);
          const combatAnchor = squad.routeAnchor || squad.objective || (assignedRoad ? roadMidpoint(assignedRoad) : null);
          const leaderRejectedTarget = Boolean(target && leader.combatCommitment && leader.combatCommitment.targetId === target.id
            && (leader.combatCommitment.intent === "Ignore" || leader.combatCommitment.intent === "Force retreat" && target.retreating));
          const targetAllowed = candidate => candidate && canDetectTarget(leader, candidate)
            && !(restrictiveOrder && combatAnchor && distance(candidate, combatAnchor) > Math.max(leader.range, 100));
          if (target && (!targetAllowed(target) || leaderRejectedTarget)) target = null;
          if (!regrouping && !target) {
            const candidate = findTarget(leader);
            if (targetAllowed(candidate)) target = candidate;
          }
          squad.targetId = target?.id || null;
          const enemies = nearbyCombatObjects(center, 100).units.filter(unit => unit.alive && !areAllies(unit.faction, squad.faction));
          if (squad.orderType === "Ambush Route") {
            const targetClose = target && distance(center, target) <= Math.max(74, leader.range * 0.76);
            const convoyClose = Boolean(routeState?.valuableConvoy);
            squad.ambushPhase = targetClose || convoyClose ? "engage" : "waiting";
            setSquadRoutePhase(squad, convoyClose ? "striking convoy" : targetClose ? "engaging kill zone" : "waiting in concealment");
            if (!targetClose && !convoyClose) {
              target = null;
              squad.targetId = null;
            }
          } else squad.ambushPhase = null;
          const nearbyRoad = nearestRoadSegment(center, 28)?.road;
          const formationScores = scoreSquadFormations({ squad, members, center, enemies, protectedAsset, nearbyRoad, regrouping });
          const [desiredFormation, desiredScore] = Object.entries(formationScores).sort((a, b) => b[1] - a[1] || formationTypes.indexOf(a[0]) - formationTypes.indexOf(b[0]))[0];
          const currentScore = formationScores[squad.formation] ?? -Infinity;
          const emergencyChange = desiredFormation === "circle" && enemies.length > 0 || desiredFormation === "escort" && protectedAsset || regrouping && desiredFormation === "column";
          if (desiredFormation !== squad.formation && (emergencyChange || state.time - squad.formationSince > 4 && desiredScore >= currentScore + 15)) {
            squad.formation = desiredFormation;
            squad.formationSince = state.time;
          }
          squad.formationScores = formationScores;
          squad.formationScore = formationScores[squad.formation] || 0;
          const facing = target || squad.objective;
          if (facing && distance(center, facing) > 2) squad.heading = Math.atan2(facing.y - center.y, facing.x - center.x);
          const anchor = squad.formation === "escort" && protectedAsset ? protectedAsset : leader;
          const forward = { x: Math.cos(squad.heading), y: Math.sin(squad.heading) };
          const right = { x: -forward.y, y: forward.x };
          let inPosition = 0;
          const groupRanks = new Map();
          members.forEach((member, index) => {
            member.formationGroup = formationGroupFor(member, index);
            const groupRank = groupRanks.get(member.formationGroup) || 0;
            groupRanks.set(member.formationGroup, groupRank + 1);
            const local = formationLocalPosition(squad.formation, index, members.length, member, groupRank);
            const slot = safeFormationPosition({
              x: clamp(anchor.x + right.x * local.x + forward.x * local.y, 20, worldWidth() - 20),
              y: clamp(anchor.y + right.y * local.x + forward.y * local.y, 20, worldHeight() - 20)
            }, member);
            member.formationSlot = slot;
            squad.slotAssignments[member.id] = slot;
            if (distance(member, slot) < 24) inPosition += 1;
          });
          squad.cohesion = inPosition / members.length;
          if (distance(leader, squad.objective || leader) < 30 && squad.orderType !== "Advance" && squad.lastCreditedOrderAt !== squad.orderIssuedAt) {
            for (const member of members.slice(1)) {
              recordRelationshipEvent(member, leader, "successfulOrder", "completed a commander route order", { cooldown: 55, reciprocal: 0.25 });
            }
            squad.lastCreditedOrderAt = squad.orderIssuedAt;
          }
        }
        state.aiDiagnostics.formationSquads = state.squads.filter(squad => membersBySquad.has(squad.id) && formationTypes.includes(squad.formation)).length;
        state.aiDiagnostics.guardSquads = state.squads.filter(squad => membersBySquad.has(squad.id) && String(squad.templateId).startsWith("guard-")).length;
      }

      function updateArmyAI() {
        for (const player of state.players) {
          const enemies = state.players.filter(other => !areAllies(other.id, player.id));
          const target = enemies.sort((a, b) => distance(player.base, a.base) - distance(player.base, b.base))[0] || null;
          const economy = economyFor(player.id);
          const contestedRoad = state.roads.some(road => areAllies(road.faction, player.id) && ["Contested", "Enemy controlled", "Blocked"].includes(road.status));
          const force = state.units.filter(unit => unit.alive && unit.faction === player.id && unit.role !== "builder").length;
          let goal = "Advance on enemy command";
          if (contestedRoad || economy.shortages?.length) goal = "Keep supply network open";
          else if (force < 5) goal = "Consolidate squads and hold routes";
          else if (player.doctrine === "Fortress") goal = "Secure approaches and deny routes";
          else if (player.doctrine === "Aggressive") goal = "Break enemy routes and eliminate resistance";
          state.armyPlans[player.id] = { goal, targetFaction: target?.id || null, issuedAt: state.time };
        }
      }

      function issueSquadOrder(squad, type, road = null, protectedAsset = null, members = null) {
        ensureSquadRuntime(squad);
        const assignedMembers = members || squadMembers(squad.id);
        if (squad.orderType === type && squad.roadId === (road?.id || null) && squad.protectedAssetId === (protectedAsset?.id || null)) {
          for (const member of assignedMembers) member.protectTargetId = protectedAsset?.id || null;
          if (protectedAsset) {
            protectedAsset.assignedEscortSquadId = squad.id;
            protectedAsset.escortSquadId = squad.id;
          }
          return;
        }
        const previousAsset = squadAssetById(squad.protectedAssetId);
        if (previousAsset && previousAsset.assignedEscortSquadId === squad.id) previousAsset.assignedEscortSquadId = null;
        if (previousAsset && previousAsset.escortSquadId === squad.id) previousAsset.escortSquadId = null;
        squad.orderType = type;
        squad.roadId = road?.id || null;
        squad.routeSegmentId = null;
        squad.routeAnchor = null;
        squad.routePhase = null;
        squad.routePhaseSince = state.time;
        squad.routeLastTick = state.time;
        squad.patrolWaypoint = 0;
        squad.patrolDirection = 1;
        squad.routeFallbacks = 0;
        squad.mineLaid = false;
        squad.demolishedSegmentId = null;
        squad.ambushPhase = null;
        squad.protectedAssetId = protectedAsset?.id || null;
        squad.orderIssuedAt = state.time;
        squad.orderCommitUntil = state.time + 18;
        squad.objective = null;
        for (const member of assignedMembers) {
          member.protectTargetId = protectedAsset?.id || null;
          member.cachedObjective = null;
          member.objectiveCooldown = 0;
        }
        if (protectedAsset) {
          protectedAsset.assignedEscortSquadId = squad.id;
          protectedAsset.escortSquadId = squad.id;
          protectedAsset.protectionAssignedAt = state.time;
        }
        const leader = state.units.find(unit => unit.id === squad.leaderId);
        if (leader) addUnitLog(leader, `${type}${road ? ` on ${road.name || road.id}` : ""}.`);
      }

      function updateCommanderAI() {
        const membersBySquad = livingSquadMemberMap();
        const unitById = new Map(state.units.map(unit => [unit.id, unit]));
        for (const player of state.players) {
          const squads = state.squads.filter(squad => squad.faction === player.id && membersBySquad.has(squad.id));
          if (!squads.length) continue;
          const protectionRequests = state.units.filter(unit => unit.alive && unit.role === "builder" && areAllies(unit.faction, player.id) && unit.protectionRequested);
          const escortConvoys = state.convoys.filter(convoy => convoy.faction === player.id && !convoy.finished && convoy.escortRequested).slice(0, 3);
          const usedSquads = new Set();
          for (const asset of [...protectionRequests, ...escortConvoys]) {
            const squad = squads.filter(item => !usedSquads.has(item.id) && (item.orderCommitUntil <= state.time || item.protectedAssetId === asset.id))
              .sort((a, b) => {
                const leaderA = unitById.get(a.leaderId);
                const leaderB = unitById.get(b.leaderId);
                const trustA = asset.role ? relationshipScore(asset, leaderA) : 0;
                const trustB = asset.role ? relationshipScore(asset, leaderB) : 0;
                return distance(leaderA || player.base, asset) - clamp(trustA, -60, 60) * 0.22
                  - distance(leaderB || player.base, asset) + clamp(trustB, -60, 60) * 0.22;
              })[0];
            if (!squad) continue;
            issueSquadOrder(squad, "Escort Route", null, asset, membersBySquad.get(squad.id));
            usedSquads.add(squad.id);
          }
          const friendlyRoads = state.roads
            .filter(road => areAllies(road.faction, player.id))
            .sort((a, b) => {
              const urgency = road => (road.supplyImportance || 0) * 1.2 + (road.ambushRisk || 0)
                + (["Contested", "Enemy controlled", "Blocked", "Mined", "Flooded"].includes(road.status) ? 1 : 0);
              return urgency(b) - urgency(a);
            });
          const enemyRoads = state.roads.filter(road => !areAllies(road.faction, player.id)).sort((a, b) => distance(player.base, roadMidpoint(a)) - distance(player.base, roadMidpoint(b)));
          for (let index = 0; index < squads.length; index += 1) {
            const squad = squads[index];
            if (usedSquads.has(squad.id)) continue;
            if (squad.orderCommitUntil > state.time) continue;
            const friendlyRoad = friendlyRoads[index % Math.max(1, friendlyRoads.length)];
            const enemyRoad = enemyRoads[index % Math.max(1, enemyRoads.length)];
            if (player.doctrine === "Aggressive" && enemyRoad && index >= squads.length - 2) issueSquadOrder(squad, index % 2 ? "Ambush Route" : "Block Route", enemyRoad, null, membersBySquad.get(squad.id));
            else if (friendlyRoad?.status === "Contested" || friendlyRoad?.status === "Enemy controlled") {
              const demolitionStand = (friendlyRoad.supplyImportance || 0) > 0.72 && friendlyRoad.segments?.some(segment => segment.bridge);
              issueSquadOrder(squad, demolitionStand && index % 3 === 0 ? "Destroy Route if Overrun" : index % 2 ? "Delay Enemy" : "Hold Route", friendlyRoad, null, membersBySquad.get(squad.id));
            }
            else if (["Blocked", "Mined", "Flooded", "Damaged", "Congested"].includes(friendlyRoad?.status) || (friendlyRoad?.condition ?? 1) < 0.65 || friendlyRoad?.ambushRisk > 0.55) issueSquadOrder(squad, "Keep Route Open", friendlyRoad, null, membersBySquad.get(squad.id));
            else if (friendlyRoad || enemyRoad) issueSquadOrder(squad, index % 3 === 0 ? "Patrol Route" : index % 3 === 1 ? "Observe Route" : "Hold Route", friendlyRoad || enemyRoad, null, membersBySquad.get(squad.id));
            else issueSquadOrder(squad, "Advance", null, null, membersBySquad.get(squad.id));
          }
        }
        state.aiDiagnostics.routeOrders = state.squads.filter(squad => membersBySquad.has(squad.id) && routeOrderTypes.includes(squad.orderType)).length;
        state.aiDiagnostics.ambushRoads = state.squads.filter(squad => membersBySquad.has(squad.id) && squad.orderType === "Ambush Route").length;
      }

      const spatialCellSize = 64;

      function spatialGridKey(cellX, cellY) {
        return cellY * Math.max(1, Math.ceil(worldWidth() / spatialCellSize)) + cellX;
      }

      function seedSquadRelationships(members, leader = null) {
        for (let index = 0; index < members.length; index += 1) {
          const member = members[index];
          ensureIndividualRuntime(member);
          for (let otherIndex = index + 1; otherIndex < members.length; otherIndex += 1) {
            const other = members[otherIndex];
            adjustRelationship(member, other, leader && (member.id === leader.id || other.id === leader.id) ? 8 : 4, "joined the same squad", { reciprocal: 1 });
          }
        }
      }

      function spatialCellKey(x, y) {
        return spatialGridKey(Math.floor(x / spatialCellSize), Math.floor(y / spatialCellSize));
      }

      function rebuildSpatialGrid() {
        if (!(state.spatialGrid instanceof Map)) state.spatialGrid = new Map();
        if (!(state.spatialMembership instanceof WeakMap)) state.spatialMembership = new WeakMap();
        const sync = (kind, item) => {
          const key = spatialCellKey(item.x, item.y);
          const previous = state.spatialMembership.get(item);
          if (previous?.key === key && previous.kind === kind) return;
          if (previous) {
            const previousBucket = state.spatialGrid.get(previous.key);
            previousBucket?.[previous.kind]?.delete(item);
            if (previousBucket && !previousBucket.units.size && !previousBucket.structures.size) {
              state.spatialGrid.delete(previous.key);
            }
          }
          let bucket = state.spatialGrid.get(key);
          if (!bucket) {
            bucket = { units: new Set(), structures: new Set() };
            state.spatialGrid.set(key, bucket);
          }
          bucket[kind].add(item);
          state.spatialMembership.set(item, { key, kind });
        };
        for (const unit of state.units) sync("units", unit);
        for (const structure of state.structures) sync("structures", structure);
      }

      function nearbyCombatObjects(point, radius) {
        const withinRadius = (item, padding = 0) => distance(point, item) <= radius + padding;
        if (!state.spatialGrid?.size) {
          return {
            units: state.units.filter(unit => unit.alive && withinRadius(unit, unit.role === "vehicle" ? 8 : 4)),
            structures: state.structures.filter(item => item.alive !== false && withinRadius(item, Math.max(item.hitbox?.w || 0, item.hitbox?.h || 0) / 2))
          };
        }
        const range = Math.ceil(radius / spatialCellSize);
        const cx = Math.floor(point.x / spatialCellSize);
        const cy = Math.floor(point.y / spatialCellSize);
        const columns = Math.max(1, Math.ceil(worldWidth() / spatialCellSize));
        const rows = Math.max(1, Math.ceil(worldHeight() / spatialCellSize));
        const result = { units: [], structures: [] };
        for (let ox = -range; ox <= range; ox += 1) {
          for (let oy = -range; oy <= range; oy += 1) {
            const cellX = cx + ox;
            const cellY = cy + oy;
            if (cellX < 0 || cellY < 0 || cellX >= columns || cellY >= rows) continue;
            const bucket = state.spatialGrid.get(spatialGridKey(cellX, cellY));
            if (!bucket) continue;
            for (const unit of bucket.units) {
              if (unit.alive) result.units.push(unit);
            }
            for (const structure of bucket.structures) {
              if (structure.alive !== false) result.structures.push(structure);
            }
          }
        }
        return {
          units: result.units.filter(unit => withinRadius(unit, unit.role === "vehicle" ? 8 : 4)),
          structures: result.structures.filter(item => withinRadius(item, Math.max(item.hitbox?.w || 0, item.hitbox?.h || 0) / 2))
        };
      }

      function spatialObjectsInBounds(bounds) {
        if (!state.spatialGrid?.size) rebuildSpatialGrid();
        const minX = Math.floor(bounds.left / spatialCellSize);
        const maxX = Math.floor(bounds.right / spatialCellSize);
        const minY = Math.floor(bounds.top / spatialCellSize);
        const maxY = Math.floor(bounds.bottom / spatialCellSize);
        const cellCount = (maxX - minX + 1) * (maxY - minY + 1);
        const objectCount = state.units.length + state.structures.length;
        if (!state.spatialGrid.size || cellCount > Math.max(4096, objectCount * 2)) {
          return {
            units: state.units.filter(unit => pointVisible(unit, 96, bounds)),
            structures: state.structures.filter(item => pointVisible(item, 96, bounds))
          };
        }
        const units = [];
        const structures = [];
        for (let y = minY; y <= maxY; y += 1) {
          for (let x = minX; x <= maxX; x += 1) {
            const bucket = state.spatialGrid.get(spatialGridKey(x, y));
            if (!bucket) continue;
            units.push(...bucket.units);
            structures.push(...bucket.structures);
          }
        }
        return { units, structures };
      }

      let replayRenderCache = { key: "", grid: new Map(), units: [], structures: [] };
      function replayObjectsInBounds(snapshot, bounds) {
        const key = `${state.replayIndex}:${snapshot?.t ?? "live"}:${snapshot?.units?.length || 0}:${snapshot?.structures?.length || 0}`;
        if (replayRenderCache.key !== key) {
          const liveUnits = new Map(state.units.map(unit => [unit.id, unit]));
          const units = (snapshot?.units || []).map(item => ({ ...(liveUnits.get(item.id) || {}), ...item }));
          const structures = (snapshot?.structures || []).map(item => ({ ...item }));
          const grid = new Map();
          const add = (kind, item) => {
            const cellKey = spatialCellKey(item.x, item.y);
            if (!grid.has(cellKey)) grid.set(cellKey, { units: [], structures: [] });
            grid.get(cellKey)[kind].push(item);
          };
          for (const unit of units) add("units", unit);
          for (const structure of structures) add("structures", structure);
          replayRenderCache = { key, grid, units, structures };
        }
        const minX = Math.floor(bounds.left / spatialCellSize);
        const maxX = Math.floor(bounds.right / spatialCellSize);
        const minY = Math.floor(bounds.top / spatialCellSize);
        const maxY = Math.floor(bounds.bottom / spatialCellSize);
        const cellCount = (maxX - minX + 1) * (maxY - minY + 1);
        const objectCount = replayRenderCache.units.length + replayRenderCache.structures.length;
        if (cellCount > Math.max(4096, objectCount * 2)) {
          return {
            units: replayRenderCache.units.filter(unit => pointVisible(unit, 96, bounds)),
            structures: replayRenderCache.structures.filter(item => pointVisible(item, 96, bounds))
          };
        }
        const units = [];
        const structures = [];
        for (let y = minY; y <= maxY; y += 1) {
          for (let x = minX; x <= maxX; x += 1) {
            const bucket = replayRenderCache.grid.get(spatialGridKey(x, y));
            if (!bucket) continue;
            units.push(...bucket.units);
            structures.push(...bucket.structures);
          }
        }
        return { units, structures };
      }

      function combatTargetById(id) {
        if (!id) return null;
        return state.units.find(candidate => candidate.id === id && candidate.alive && !candidate.incapacitated)
          || state.structures.find(candidate => candidate.id === id && candidate.alive !== false) || null;
      }

      function canDetectTarget(unit, target) {
        if (!unit || !target) return false;
        const terrain = terrainAt(unit);
        const sensor = unit.range * (state.visibility / 100) * terrain.detection * (unit.role === "scout" ? 1.35 : 1);
        if (buildingCatalog[target.type]) return distance(unit, target) < sensor * (target.type === "outpost" || target.type === "generator" ? 1.35 : 1.08);
        const light = lightingAt(target, unit.faction);
        const optics = nightVisionFactor(unit.faction);
        const ambient = clamp(0.36 + light.brightness * 0.76 + optics * 0.34, 0.42, 1.28);
        const concealment = light.shadowed ? 0.62 : 1;
        const searchlight = light.searchlight > 0.15 ? 1.48 : 1;
        const occlusion = visionOcclusionBetween(unit, target);
        return distance(unit, target) < sensor * terrainAt(target).detection * ambient * concealment * searchlight * clamp(0.45 + occlusion * 0.55, 0.45, 1);
      }

      function findTarget(unit) {
        const terrain = terrainAt(unit);
        const sensor = unit.range * (state.visibility / 100) * terrain.detection * (unit.role === "scout" ? 1.35 : 1);
        const optics = nightVisionFactor(unit.faction);
        const nearby = nearbyCombatObjects(unit, sensor * 1.7);
        const candidates = [];
        for (const other of nearby.units) {
          if (!other.alive || other.incapacitated || areAllies(other.faction, unit.faction)) continue;
          const d = distance(unit, other);
          const light = lightingAt(other, unit.faction);
          const ambient = clamp(0.36 + light.brightness * 0.76 + optics * 0.34, 0.42, 1.28);
          const concealment = light.shadowed ? 0.62 : 1;
          const searchlight = light.searchlight > 0.15 ? 1.48 : 1;
          const detectionRadius = sensor * terrainAt(other).detection * ambient * concealment * searchlight * clamp(0.45 + visionOcclusionBetween(unit, other) * 0.55, 0.45, 1);
          other.lightState = light.searchlight > 0.15 ? "Searchlight exposed" : light.shadowed ? "In shadow" : light.period;
          if (d >= detectionRadius) continue;
          const threat = other.role === "vehicle" ? 90 : other.role === "commander" ? 82 : other.role === "medic" ? 68 : 50;
          const distanceValue = (1 - d / Math.max(1, detectionRadius)) * 72;
          const weakness = (1 - other.hp / Math.max(1, other.maxHp)) * 24;
          const commanderPriority = unit.role === "commander" ? 18 : 0;
          const vengeance = vengeanceDrive(unit, other) * 32 + clamp(-relationshipScore(unit, other) * 0.12, 0, 10);
          const commitmentBias = unit.combatCommitment?.targetId === other.id && unit.combatCommitment.intent !== "Ignore" ? 14 : 0;
          const race = playerFor(unit.faction).race;
          const factionBias = race === "Orks"
            ? weakness * 0.85 + (state.factionEcology[unit.faction]?.waaaghMomentum || 0) * 24 + nearby.units.filter(actor => actor.alive && actor.faction === unit.faction).length * 2
            : race === "Tyranids"
              ? (unit.underSynapse ? (other.role === "commander" ? 30 : other.role === "vehicle" ? 22 : 8) : distanceValue * 0.35) + weakness * 0.4
              : 0;
          candidates.push({ target: other, score: threat + distanceValue + weakness + commanderPriority + vengeance + commitmentBias + factionBias });
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
        return clamp(unit.accuracy * rangeModifier * aimModifier * visibilityModifier * (1 - cover) * movementModifier * fatigueModifier * precisionModifier * (unit.conditionMultiplier || 1), 0.02, 0.98);
      }

      function fireAt(unit, target) {
        const chance = hitChanceFor(unit, target);
        const doctrine = playerFor(unit.faction).doctrine;
        let disciplineThreshold = doctrine === "Aggressive" || playerFor(unit.faction).race === "Orks"
          ? 0.1
          : clamp(0.16 + unit.discipline * 0.18, 0.16, 0.34);
        if (unit.combatIntent === "Eliminate") disciplineThreshold = Math.max(0.08, disciplineThreshold - unit.killConfidence / 500);
        if (unit.combatIntent === "Suppress") disciplineThreshold = Math.max(0.12, disciplineThreshold - 0.04);
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
        const collisions = [];
        const bounds = { left: Math.min(previous.x, current.x) - 16, right: Math.max(previous.x, current.x) + 16, top: Math.min(previous.y, current.y) - 16, bottom: Math.max(previous.y, current.y) + 16 };
        for (const feature of visibleFeatures(bounds)) {
          const profile = ensureFeatureCollision(feature)?.collisionProfile;
          if (!profile || profile.movement === "soft" || feature.collisionState === "cleared") continue;
          const hit = segmentHitsFeature(previous, current, feature, "projectile", 0.8);
          if (hit) collisions.push({ target: feature, point: hit, distance: distance(previous, hit) });
        }
        const structures = state.structures.filter(structure => structure.alive !== false && structure.progress >= 0.2 && !areAllies(structure.faction, projectile.faction) && segmentIntersectsStructure(previous, current, structure));
        for (const structure of structures) collisions.push({ target: structure, point: structure, distance: distance(previous, structure) });
        const units = state.units.filter(unit => unit.alive && !areAllies(unit.faction, projectile.faction));
        for (const unit of units.filter(unit => segmentDistanceSquared(previous, current, unit) <= (unit.collisionRadius || (unit.role === "vehicle" ? 8 : 4.5)) ** 2)) {
          collisions.push({ target: unit, point: unit, distance: distance(previous, unit) });
        }
        const collision = collisions.sort((a, b) => a.distance - b.distance)[0];
        if (!collision) return null;
        if (collision.target.environmentObstacle) collision.target.impactPoint = collision.point;
        return collision.target;
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
        if (!unit.alive) return "Dead";
        if (unit.incapacitated || ratio <= 0.16) return "Incapacitated";
        if (ratio < 0.48) return "Gravely Injured";
        if (ratio < 0.78) return "Injured";
        return "Healthy";
      }

      function enterIncapacitated(unit, cause = "battlefield trauma") {
        if (!unit?.alive || unit.incapacitated) return;
        unit.incapacitated = true;
        unit.incapacitatedAt = state.time;
        unit.hp = Math.max(1, unit.hp);
        unit.woundState = "Incapacitated";
        unit.status = "Incapacitated";
        unit.retreating = false;
        unit.targetId = null;
        unit.cachedTargetId = null;
        unit.combatCommitment = null;
        unit.rescueRequested = true;
        unit.lastAction = `Unable to fight after ${cause}; awaiting a safe rescue window.`;
        incident(`${unitLabel(unit)} was incapacitated. Nearby allies will secure the area before treatment or evacuation.`, unit.id, "critical");
      }

      function finishUnitDeath(unit, cause = "fatal wounds") {
        if (!unit?.alive) return;
        unit.hp = 0;
        unit.alive = false;
        unit.incapacitated = false;
        unit.woundState = "Dead";
        unit.status = cause;
        unit.deathStartedAt = state.time;
        const carrier = state.units.find(item => item.id === unit.carriedById);
        if (carrier) carrier.carryingPatientId = null;
        unit.carriedById = null;
        state.casualties[unit.faction] = (state.casualties[unit.faction] || 0) + 1;
        handleFactionDeath(unit, null);
      }

      function applyProjectileImpact(projectile, target) {
        applySuppression(target || projectile, projectile.faction, projectile.suppression);
        if (!target) return;
        const shooter = state.units.find(unit => unit.id === projectile.shooterId);
        if (target.environmentObstacle) {
          state.aiDiagnostics.obstacleProjectileHits += 1;
          damageEnvironmentFeature(target, projectile.damage * (0.75 + projectile.penetration * 0.025), shooter);
          return;
        }
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
        const catastrophic = penetrated && (zone === "head" && damage > target.maxHp * 0.34 || target.hp < -target.maxHp * 0.18);
        if (target.hp <= 0 && !catastrophic) {
          enterIncapacitated(target, `a ${zone} impact`);
          if (shooter) {
            shooter.combatCommitment = null;
            shooter.targetId = null;
            shooter.memories.push(`Incapacitated ${unitLabel(target)} with a ${zone} hit.`);
          }
          return;
        }
        if (target.hp <= 0) {
          target.hp = 0;
          target.alive = false;
          target.incapacitated = false;
          target.woundState = "Dead";
          target.status = "Killed";
          target.deathStartedAt = state.time;
          if (shooter) {
            const endangeredAlly = target.targetId
              ? state.units.find(unit => unit.id === target.targetId && unit.alive && areAllies(unit.faction, shooter.faction))
              : null;
            shooter.kills += 1;
            shooter.memories.push(`Defeated ${unitLabel(target)} with a ${zone} hit.`);
            shooter.combatCommitment = null;
            shooter.targetId = null;
            adjustRelationship(target, shooter, relationshipEvents.enemyKill ?? -16, "was killed by this enemy", { event: "enemyKill" });
            const witnesses = nearbyCombatObjects(target, 130).units.filter(unit => unit.alive && areAllies(unit.faction, target.faction));
            for (const witness of witnesses.slice(0, 12)) {
              witness.lastAllyKillerId = shooter.id;
              witness.lastAllyKillerAt = state.time;
              recordRelationshipEvent(witness, shooter, "enemyKill", `killed ${target.name}`, { cooldown: 45, reciprocal: 0 });
            }
            if (endangeredAlly && endangeredAlly.id !== shooter.id
              && (endangeredAlly.role === "builder" || endangeredAlly.role === "medic" || endangeredAlly.hp < endangeredAlly.maxHp * 0.55)) {
              recordRelationshipEvent(endangeredAlly, shooter, "savedFromDanger", `eliminated ${target.name} while it threatened them`, { cooldown: 75, reciprocal: 0.35 });
            }
            for (const ally of nearbyCombatObjects(shooter, 90).units.filter(unit => unit.alive && areAllies(unit.faction, shooter.faction) && unit.id !== shooter.id).slice(0, 8)) {
              recordRelationshipEvent(ally, shooter, "foughtTogether", "secured a nearby kill", { cooldown: 24, reciprocal: 0.5 });
            }
          }
          state.casualties[target.faction] += 1;
          handleFactionDeath(target, shooter);
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
          } else if (projectile.traveled >= projectile.maxTravel || projectile.x < 0 || projectile.x > worldWidth() || projectile.y < 0 || projectile.y > worldHeight()) {
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
        for (const builder of state.units) {
          if (builder.buildProject !== structure.id) continue;
          builder.buildProject = null;
          builder.buildStall = 0;
          builder.detour = null;
          builder.status = "Project lost";
          builder.lastAction = `Construction project ${structure.displayName || buildingCatalog[structure.type]?.label || structure.id} was destroyed.`;
        }
        syncLegacyResources(structure.faction);
        rebuildRoadNetwork();
        if (attacker) attacker.kills += 1;
        incident(`${unitLabel(structure)} destroyed · ${Math.round(lost)} stock lost, ${Math.round(salvaged)} salvaged.`, attacker?.id || structure.id, "critical");
      }

      function cleanupCompletedDeathAnimations() {
        const expiredUnitIds = new Set(state.units
          .filter(unit => !unit.alive && state.time - (unit.deathStartedAt ?? 0) >= UNIT_DEATH_ANIMATION_SECONDS)
          .map(unit => unit.id));
        const expiredStructureIds = new Set(state.structures
          .filter(structure => structure.alive === false && state.time - (structure.destroyedAt ?? 0) >= STRUCTURE_DEATH_ANIMATION_SECONDS)
          .map(structure => structure.id));
        if (!expiredUnitIds.size && !expiredStructureIds.size) return;
        state.deathRemovalStats.units += expiredUnitIds.size;
        state.deathRemovalStats.structures += expiredStructureIds.size;
        state.units = state.units.filter(unit => !expiredUnitIds.has(unit.id));
        state.structures = state.structures.filter(structure => !expiredStructureIds.has(structure.id));
        for (const unit of state.units) {
          if (expiredUnitIds.has(unit.targetId)) unit.targetId = null;
          if (expiredUnitIds.has(unit.cachedTargetId)) unit.cachedTargetId = null;
          if (expiredUnitIds.has(unit.protectTargetId) || expiredStructureIds.has(unit.protectTargetId)) unit.protectTargetId = null;
          if (expiredUnitIds.has(unit.carryingPatientId)) unit.carryingPatientId = null;
          if (expiredUnitIds.has(unit.carriedById)) unit.carriedById = null;
          if (expiredStructureIds.has(unit.buildProject)) unit.buildProject = null;
          let relationshipsChanged = false;
          for (const expiredId of expiredUnitIds) {
            if (!unit.relationships?.[expiredId]) continue;
            delete unit.relationships[expiredId];
            relationshipsChanged = true;
          }
          if (relationshipsChanged) refreshRelationshipLists(unit);
        }
        if (expiredUnitIds.has(state.selectedId)) state.selectedId = state.units.find(unit => unit.alive)?.id || null;
        if (expiredStructureIds.has(state.selectedStructureId)) state.selectedStructureId = null;
        state.spatialGrid = new Map();
        state.spatialMembership = new WeakMap();
        rebuildSpatialGrid();
        rebuildUnitSelect();
        state.minimapMarkerDirty = true;
      }

      function updateMedic(unit, dt) {
        const patient = nearestAlly(unit, ally => ally.incapacitated || ally.hp < ally.maxHp * 0.78, 130);
        if (!patient) return false;
        unit.medicalReserve ??= 2;
        const hostiles = nearbyCombatObjects(patient, 75).units.filter(other => other.alive && !other.incapacitated && !areAllies(other.faction, unit.faction));
        if (hostiles.length && distance(unit, patient) > 24) {
          unit.status = "Holding for safe treatment";
          unit.lastAction = `Hostiles prevent a safe approach to ${unitLabel(patient)}.`;
          return false;
        }
        if (distance(unit, patient) > 14) moveToward(unit, patient, dt, 1.05);
        else {
          const criticalBeforeCare = patient.incapacitated || patient.hp / Math.max(1, patient.maxHp) < 0.48;
          const careFactor = unit.medicalReserve > 0 ? 1 : 0.32;
          patient.hp = clamp(patient.hp + dt * 2.4 * careFactor, 1, patient.maxHp * 0.78);
          patient.morale = clamp(patient.morale + dt * 0.012, 0, 1);
          patient.bleeding = clamp((patient.bleeding || 0) - dt * 0.14 * careFactor, 0, 0.55);
          if (patient.incapacitated && patient.bleeding < 0.045) {
            patient.stabilized = true;
            patient.rescueRequested = false;
            patient.status = "Stabilized";
          }
          patient.woundState = woundStateFor(patient);
          unit.medicalReserve = Math.max(0, unit.medicalReserve - dt * 0.06);
          if (criticalBeforeCare) recordRelationshipEvent(patient, unit, "savedFromDanger", "stabilized critical battlefield wounds", { cooldown: 90, reciprocal: 0.3 });
        }
        unit.status = distance(unit, patient) > 14 ? "Responding" : unit.medicalReserve > 0 ? "Stabilizing" : "Basic field aid";
        unit.lastAction = `${unit.status} ${unitLabel(patient)}.`;
        return true;
      }

      function updateEngineer(unit, dt) {
        const roadDamage = nearestRoadSegment(unit, 115, candidate => areAllies(candidate.road.controllerFaction || candidate.road.faction, unit.faction)
          && (candidate.segment.condition < 0.68 || candidate.segment.operationalFlags?.some(flag => ["wreck", "fallen tree", "obstructed", "partially obstructed", "collapsed", "cratered", "blocked", "damaged", "mined", "flooded"].includes(flag))));
        if (roadDamage?.segment) {
          if (distance(unit, roadDamage.point) > 12) moveToward(unit, roadDamage.point, dt);
          else {
            roadDamage.segment.condition = clamp(roadDamage.segment.condition + dt * (0.02 + unit.engineering * 0.035), 0, 1);
            if (roadDamage.segment.condition > 0.78) roadDamage.segment.operationalFlags = (roadDamage.segment.operationalFlags || []).filter(flag => !["wreck", "fallen tree", "obstructed", "partially obstructed", "blocked", "damaged", "mined", "flooded", "collapsed", "cratered"].includes(flag));
            roadDamage.road.condition = roadDamage.road.segments.reduce((sum, segment) => sum + segment.condition, 0) / roadDamage.road.segments.length;
          }
          unit.status = "Clearing route";
          unit.lastAction = `Repairing ${roadDamage.road.name || roadDamage.road.id} after damage or obstruction.`;
          return true;
        }
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
          const ally = nearbyCombatObjects(damaged, 60).units.find(other => other.alive && other.id !== unit.id && areAllies(other.faction, unit.faction));
          if (ally) recordRelationshipEvent(ally, unit, "repairedAlly", "repaired an allied asset", { cooldown: 35, reciprocal: 0.3 });
        }
        unit.status = "Repairing";
        unit.lastAction = `Repairing allied ${buildingCatalog[damaged.type]?.label || "structure"}.`;
        return true;
      }

      function updateReinforcementRendezvous(unit, dt) {
        if (!unit.reinforcementRendezvous || !unit.guardBatchId) return false;
        const squad = squadFor(unit.rendezvousTargetSquadId || unit.squadId);
        const fieldMembers = squad ? squadMembers(squad.id).filter(member => !member.reinforcementRendezvous) : [];
        const fieldLeader = fieldMembers.find(member => member.id === squad?.leaderId)
          || [...fieldMembers].sort((a, b) => b.commandRank - a.commandRank || b.discipline - a.discipline)[0];
        const batch = state.units.filter(member => member.alive && member.guardBatchId === unit.guardBatchId && member.reinforcementRendezvous);
        if (!squad || !fieldLeader) {
          for (const member of batch) {
            member.reinforcementRendezvous = false;
            member.rendezvousTargetSquadId = null;
          }
          return false;
        }
        const batchCenter = {
          x: batch.reduce((sum, member) => sum + member.x, 0) / Math.max(1, batch.length),
          y: batch.reduce((sum, member) => sum + member.y, 0) / Math.max(1, batch.length)
        };
        if (distance(batchCenter, fieldLeader) < 42) {
          for (const member of batch) {
            member.reinforcementRendezvous = false;
            member.rendezvousTargetSquadId = null;
            member.cachedObjective = null;
            member.formationSlot = null;
          }
          squad.reinforcementState = "Replacement detachment rendezvoused";
          seedSquadRelationships([fieldLeader, ...batch], fieldLeader);
          incident(`${batch.length}-member replacement detachment rendezvoused with ${squad.name}.`, fieldLeader.id, "info");
          return false;
        }
        const localThreat = nearbyCombatObjects(unit, Math.max(72, unit.range * 0.75)).units
          .some(other => other.alive && !areAllies(other.faction, unit.faction));
        if (localThreat) return false;
        const batchIndex = Math.max(0, batch.findIndex(member => member.id === unit.id));
        const angle = batchIndex / Math.max(1, batch.length) * Math.PI * 2;
        const point = { x: fieldLeader.x + Math.cos(angle) * 12, y: fieldLeader.y + Math.sin(angle) * 12 };
        moveToward(unit, point, dt, 1.08);
        unit.status = "Replacement rendezvous";
        unit.lastAction = `Moving with an atomic ${batch.length}-member detachment to ${squad.name}.`;
        return true;
      }

      function isSynapseCreature(unit) {
        return Boolean(unit?.alive && playerFor(unit.faction).race === "Tyranids"
          && (unit.synapse || unit.role === "commander" || unit.role === "standard" || /Warrior|Zoanthrope|Neuro/i.test(unit.name)));
      }

      function nearestSynapseSource(unit) {
        const sources = [
          ...state.units.filter(other => isSynapseCreature(other) && other.faction === unit.faction),
          ...state.structures.filter(structure => structure.alive !== false && structure.progress >= 1 && structure.faction === unit.faction && ["outpost", "fieldhospital", "observationtower"].includes(structure.type))
        ];
        return sources.sort((a, b) => distance(unit, a) - distance(unit, b))[0] || null;
      }

      function orkDominanceScore(unit, followers = 0) {
        const victories = Math.min(1, (unit.battles || 0) / 14);
        const success = Math.min(1, (unit.kills || 0) / 9);
        const reputation = Math.min(1, ((unit.experience || 0) + (unit.promotions || 0) * 18) / 100);
        const cunning = ((unit.adaptability || 0.5) + (unit.curiosity || 0.5)) / 2;
        return 0.3 * (unit.strength || 0.5) + 0.2 * success + 0.15 * victories + 0.15 * Math.min(1, followers / 10) + 0.1 * reputation + 0.1 * cunning;
      }

      function makeOrkWarboss(unit, ecology, previous = null) {
        if (!unit || unit.orkRank === "Warboss") return;
        if (previous && previous.alive) {
          previous.orkRank = "Boss Nob";
          previous.spriteScale = Math.max(1.08, (previous.spriteScale || 1) - 0.08);
          previous.commandRank = Math.min(previous.commandRank, 4);
        }
        unit.orkRank = "Warboss";
        unit.role = "commander";
        unit.commandRank = 6;
        unit.promotions = (unit.promotions || 0) + 1;
        unit.spriteScale = Math.max(1.38, unit.spriteScale || 1);
        const oldMax = unit.maxHp;
        unit.maxHp = Math.max(unit.maxHp, 158 + Math.round(unit.dominance * 52));
        unit.hp += unit.maxHp - oldMax;
        unit.damage = Math.max(unit.damage, 18 + unit.dominance * 9);
        unit.armorProtection = Math.max(unit.armorProtection, 14);
        if (!unit.name.startsWith("Warboss ")) unit.name = `Warboss ${unit.name.replace(/^(Boss Nob|Nob|Boy)\s*/i, "")}`;
        ecology.warbossId = unit.id;
        incident(`${unitLabel(unit)} became Warboss after proving to be the biggest, strongest and most dominant Ork.`, unit.id, "critical");
      }

      function updateOrkCulture(player) {
        const ecology = state.factionEcology[player.id] ||= { sporeSaturation: 18, waaaghMomentum: 0.18, lastEmergenceAt: -30, warbossId: null };
        const orks = state.units.filter(unit => unit.alive && unit.faction === player.id);
        const fighters = orks.filter(unit => unit.role !== "builder");
        const engaged = fighters.filter(unit => unit.targetId || unit.status === "Firing").length;
        ecology.waaaghMomentum = clamp((ecology.waaaghMomentum || 0) + engaged * 0.012 - 0.018, 0, 1);
        ecology.sporeSaturation = clamp((ecology.sporeSaturation || 0) + orks.length * 0.012, 0, 100);
        for (const ork of fighters) {
          const followers = fighters.filter(other => other.id !== ork.id && (other.squadId && other.squadId === ork.squadId || relationshipScore(other, ork) >= 18)).length;
          ork.dominance = orkDominanceScore(ork, followers);
          const nearbyMob = nearbyCombatObjects(ork, 85).units.filter(other => other.alive && other.faction === player.id && other.role !== "builder").length;
          ork.morale = clamp(ork.morale + nearbyMob * 0.006 + ecology.waaaghMomentum * 0.018, 0, 1);
          ork.killConfidence = clamp((ork.killConfidence || 0) + nearbyMob * 1.5 + ecology.waaaghMomentum * 6, 0, 100);
          if (!ork.targetId && state.time >= (ork.nextOrkIdleAt || 0)) {
            const actions = ["testing an over-tuned shoota", "looking for a louder fight", "looting nearby wreckage", "starting a brief scrap", "painting trophies on wargear", "gathering around da boss"];
            const action = actions[(ork.index + Math.floor(state.time / 9)) % actions.length];
            ork.status = "Orky idling";
            ork.lastAction = action;
            if (action.includes("shoota") && ork.ammo > 1) ork.ammo -= 1;
            if (action.includes("scrap")) { ork.experience += 1; ork.hp = Math.max(1, ork.hp - 1); }
            if (action.includes("looting")) economyFor(player.id).inventory.materials += 0.4;
            ork.nextOrkIdleAt = state.time + 18 + ork.index % 9;
          }
        }
        const current = orks.find(unit => unit.id === ecology.warbossId && unit.alive) || fighters.find(unit => unit.orkRank === "Warboss");
        const challenger = [...fighters].sort((a, b) => (b.dominance || 0) - (a.dominance || 0))[0];
        if (challenger && (!current || challenger.id !== current.id && challenger.dominance > (current.dominance || 0) * 1.12 + 0.05 && (challenger.kills > 0 || challenger.experience > 26))) makeOrkWarboss(challenger, ecology, current);
        else if (current) ecology.warbossId = current.id;
        for (const squad of state.squads.filter(squad => squad.faction === player.id)) {
          const members = squadMembers(squad.id);
          const nearBoss = current && members.some(member => distance(member, current) < 150);
          if (nearBoss) squad.cohesion = clamp((squad.cohesion || 0) + 0.12, 0, 1);
          if (!routeOrderTypes.includes(squad.orderType) && state.time - (squad.formationSince || 0) > 12) {
            squad.formation = ecology.waaaghMomentum > 0.7 ? "wedge" : members.some(member => member.role === "vehicle") ? "flanking" : "circle";
            squad.formationSince = state.time;
          }
        }
        const cap = unitCapFor(player);
        if (orks.length < cap && ecology.sporeSaturation >= 32 && state.time - ecology.lastEmergenceAt > 42) {
          const patch = state.features.filter(feature => !feature.deleted && feature.orkSpores).sort((a, b) => distance(a, player.base) - distance(b, player.base))[0];
          const grot = makeUnit(player.id, "builder", "Grown from an Orkoid spore patch");
          if (patch) { grot.x = patch.x + rand(-6, 6); grot.y = patch.y + rand(-6, 6); }
          state.units.push(grot);
          ecology.sporeSaturation -= 24;
          ecology.lastEmergenceAt = state.time;
          incident(`${unitLabel(grot)} emerged first from a maturing Orkoid spore patch and began gathering scrap.`, grot.id, "info");
          rebuildUnitSelect();
        }
      }

      function updateTyranidSwarm(player) {
        const ecology = state.factionEcology[player.id] ||= { biomass: 24, adaptation: 0, synapseCoverage: 0, lastGestationAt: -30 };
        const swarm = state.units.filter(unit => unit.alive && unit.faction === player.id);
        let linked = 0;
        for (const organism of swarm) {
          const source = nearestSynapseSource(organism);
          const range = source?.role === "commander" || source?.type === "outpost" ? 190 : 145;
          organism.underSynapse = Boolean(organism.synapse || source && distance(organism, source) <= range);
          if (organism.underSynapse) {
            linked += 1;
            organism.morale = 1;
            organism.suppression = clamp((organism.suppression || 0) - 0.18, 0, 1);
            organism.instinctiveState = "Synaptically coordinated";
            if (!organism.targetId) {
              organism.status = organism.role === "builder" ? "Tending infestation" : "Awaiting synaptic impulse";
              organism.lastAction = organism.role === "builder" ? "Growing and feeding stationary bio-organisms." : "Motionless until the Hive Mind assigns a useful action.";
            }
          } else {
            organism.morale = clamp(organism.morale, 0.34, 0.62);
            organism.instinctiveState = organism.instinctiveBehavior || "Seek synapse";
            const brood = organism.squadId ? squadFor(organism.squadId) : null;
            if (brood) brood.cohesion = clamp((brood.cohesion || 0) - 0.08, 0, 1);
          }
        }
        ecology.synapseCoverage = swarm.length ? linked / swarm.length : 0;
        for (const corpse of state.features.filter(feature => !feature.deleted && feature.type === "biomassremains" && distance(feature, player.base) < 520)) {
          const feeder = swarm.find(unit => ["builder", "medic"].includes(unit.role) && distance(unit, corpse) < 18);
          if (!feeder) continue;
          ecology.biomass += Math.max(2, (corpse.r || 8) * 0.45);
          corpse.collisionState = "cleared";
          corpse.deleted = true;
          feeder.lastAction = "Reclaiming dead biomass for the swarm.";
          markFeatureIndexDirty();
        }
      }

      function updateFactionAI() {
        for (const player of state.players) {
          if (player.race === "Orks") updateOrkCulture(player);
          else if (player.race === "Tyranids") updateTyranidSwarm(player);
        }
      }

      function handleFactionDeath(unit, killer = null) {
        if (!unit || unit.deathProcessed) return;
        unit.deathProcessed = true;
        const player = playerFor(unit.faction);
        if (player.faction === "Space Marines") {
          addIndexedFeature({ type: "wreckage", recoverableEquipment: true, geneSeed: true, sourceFaction: unit.faction, x: unit.x, y: unit.y, r: unit.role === "vehicle" ? 16 : 7, shape: "circle", opacity: 0.82, condition: 1, age: 0, visual: "urban" });
        } else if (player.race !== "Orks" && player.race !== "Tyranids") {
          addIndexedFeature({ type: "wreckage", recoverableEquipment: true, sourceFaction: unit.faction, x: unit.x, y: unit.y, r: unit.role === "vehicle" ? 17 : 6, shape: "circle", opacity: 0.7, condition: 1, age: 0, visual: "urban" });
        }
        if (player.race === "Orks") {
          const ecology = state.factionEcology[unit.faction] ||= { sporeSaturation: 0, waaaghMomentum: 0, lastEmergenceAt: -30, warbossId: null };
          ecology.sporeSaturation = clamp(ecology.sporeSaturation + (unit.role === "commander" ? 12 : unit.role === "builder" ? 2 : 5), 0, 100);
          addIndexedFeature({ type: "biomassremains", orkSpores: true, orkLoot: true, recoverableEquipment: true, x: unit.x, y: unit.y, r: unit.role === "commander" ? 15 : 9, shape: "circle", opacity: 0.72, condition: 1, age: 0, visual: "vegetation" });
          for (const other of nearbyCombatObjects(unit, 95).units.filter(other => other.alive && other.faction === unit.faction)) {
            if (other.role === "builder") { other.retreating = true; other.morale = clamp(other.morale - 0.3, 0, 1); }
            else { other.morale = clamp(other.morale + 0.12, 0, 1); other.aggression = clamp(other.aggression + 0.08, 0, 1); }
          }
          if (ecology.warbossId === unit.id || unit.orkRank === "Warboss") {
            ecology.warbossId = null;
            incident("The Warboss is dead; nearby Nobs begin an immediate dominance struggle.", unit.id, "critical");
          }
        } else if (player.race === "Tyranids") {
          const ecology = state.factionEcology[unit.faction] ||= { biomass: 0, adaptation: 0, synapseCoverage: 0 };
          ecology.adaptation = clamp(ecology.adaptation + 0.02, 0, 1);
          addIndexedFeature({ type: "biomassremains", tyranidBiomass: true, x: unit.x, y: unit.y, r: unit.role === "vehicle" ? 18 : 8, shape: "circle", opacity: 0.8, condition: 1, age: 0, visual: "vegetation" });
          if (isSynapseCreature({ ...unit, alive: true })) {
            for (const other of nearbyCombatObjects(unit, 170).units.filter(other => other.alive && other.faction === unit.faction && !other.synapse)) {
              other.underSynapse = false;
              other.suppression = clamp((other.suppression || 0) + 0.34, 0, 1);
              other.instinctiveState = other.instinctiveBehavior || "Disorganized instinct";
            }
            incident("A synapse organism died; lesser bioforms fell back on instinctive behaviour while the Hive Mind reroutes control.", unit.id, "critical");
          }
        }
        if (killer && player.race === "Tyranids") state.factionEcology[unit.faction].lastThreatFaction = killer.faction;
      }

      function casualtyTreatmentPoint(unit) {
        return state.structures
          .filter(item => item.alive !== false && item.progress >= 1 && areAllies(item.faction, unit.faction) && item.type === "fieldhospital")
          .sort((a, b) => distance(unit, a) - distance(unit, b))[0] || baseFor(unit.faction);
      }

      function updateIncapacitated(unit, dt) {
        unit.woundState = "Incapacitated";
        unit.conditionMultiplier = 0.12;
        const carrier = state.units.find(item => item.id === unit.carriedById && item.alive && !item.incapacitated);
        if (carrier) {
          unit.x = carrier.x - Math.cos(carrier.index || 0) * 4;
          unit.y = carrier.y - Math.sin(carrier.index || 0) * 4;
          const treatment = casualtyTreatmentPoint(unit);
          moveToward(carrier, treatment, dt, 0.62);
          carrier.status = "Carrying casualty";
          carrier.lastAction = `Evacuating ${unitLabel(unit)} after the fighting subsided.`;
          unit.status = "Being evacuated";
          if (distance(carrier, treatment) < 18) {
            carrier.carryingPatientId = null;
            unit.carriedById = null;
            unit.evacuated = true;
            unit.stabilized = true;
            unit.bleeding = 0;
            unit.hp = Math.max(unit.hp, unit.maxHp * 0.22);
            unit.status = "Recovering at aid station";
          }
          return;
        }
        if (unit.evacuated) {
          unit.hp = clamp(unit.hp + dt * 0.45, 1, unit.maxHp * 0.52);
          if (unit.hp >= unit.maxHp * 0.48) {
            unit.incapacitated = false;
            unit.evacuated = false;
            unit.woundState = "Gravely Injured";
            unit.conditionMultiplier = 0.55;
            unit.status = "Returned to limited duty";
            incident(`${unitLabel(unit)} survived evacuation and returned to limited duty.`, unit.id, "info");
          }
          return;
        }
        const unsafe = nearbyCombatObjects(unit, 82).units.some(other => other.alive && !other.incapacitated && !areAllies(other.faction, unit.faction));
        if (!unsafe && unit.stabilized) {
          const treatment = casualtyTreatmentPoint(unit);
          const carrierCandidate = state.units
            .filter(other => other.alive && !other.incapacitated && !other.carryingPatientId && areAllies(other.faction, unit.faction) && other.id !== unit.id && other.role !== "vehicle")
            .sort((a, b) => distance(unit, a) - distance(unit, b))[0];
          const preserveVeteran = unit.experience > 24 || unit.role === "commander" || state.lighting.factionPreservation === "high";
          if (carrierCandidate && distance(unit, carrierCandidate) < 34 && (preserveVeteran || distance(unit, treatment) < 180)) {
            carrierCandidate.carryingPatientId = unit.id;
            unit.carriedById = carrierCandidate.id;
            return;
          }
        }
        if (!unit.stabilized && !unsafe) {
          const shelter = casualtyTreatmentPoint(unit);
          moveToward(unit, shelter, dt, 0.12);
          unit.status = "Crawling to cover";
        } else unit.status = unsafe ? "Down under fire" : "Stabilized · evacuation deferred";
      }

      function updateUnit(unit, dt) {
        if (!unit.alive) return;
        unit.fireCd -= dt;
        unit.healCd -= dt;
        unit.fatigue = clamp(unit.fatigue + dt * 0.0009, 0, 0.94);
        unit.suppression = clamp((unit.suppression || 0) - dt * (0.07 + unit.suppressionResistance * 0.08), 0, 1);
        unit.morale = clamp(unit.morale - unit.suppression * dt * 0.018, 0, 1);
        if ((unit.bleeding || 0) > 0) {
          unit.hp = unit.hp - unit.bleeding * dt * (unit.stabilized ? 0.18 : 2.2);
          unit.bleeding = clamp(unit.bleeding - dt * 0.002, 0, 0.55);
          unit.woundState = woundStateFor(unit);
          if (unit.hp <= 0) {
            if (!unit.incapacitated) enterIncapacitated(unit, "untreated blood loss");
            unit.bleedOutTime = (unit.bleedOutTime || 0) + dt;
            unit.hp = 1;
            if (!unit.stabilized && unit.bleedOutTime > 18) {
              finishUnitDeath(unit, "Died from wounds");
              incident(`${unitLabel(unit)} died from untreated bleeding.`, unit.id, "critical");
              return;
            }
          }
        }

        if (unit.incapacitated) {
          updateIncapacitated(unit, dt);
          return;
        }
        if (unit.carryingPatientId) {
          const patient = state.units.find(item => item.id === unit.carryingPatientId && item.alive && item.incapacitated);
          if (patient) {
            unit.status = "Carrying casualty";
            return;
          }
          unit.carryingPatientId = null;
        }

        unit.woundState = woundStateFor(unit);
        unit.conditionMultiplier = unit.woundState === "Gravely Injured" ? 0.55 : unit.woundState === "Injured" ? 0.82 : 1;
        if (unit.woundState === "Gravely Injured") {
          unit.morale = clamp(unit.morale - dt * 0.002, 0, 1);
          unit.fatigue = clamp(unit.fatigue + dt * 0.002, 0, 0.96);
        }

        const race = playerFor(unit.faction).race;
        if (race === "Tyranids") {
          unit.retreating = false;
          if (!unit.underSynapse && !unit.synapse && unit.role !== "builder") {
            const nearbyPrey = nearbyCombatObjects(unit, Math.max(56, unit.range * 0.55)).units.find(other => other.alive && !areAllies(other.faction, unit.faction));
            const synapse = nearestSynapseSource(unit);
            if (!nearbyPrey && synapse && distance(unit, synapse) > 42) {
              moveToward(unit, synapse, dt, 0.92);
              unit.status = "Seeking synapse";
              unit.lastAction = `Instinctive behaviour: ${unit.instinctiveBehavior || "return to the synaptic web"}.`;
              return;
            }
          }
        }

        if (unit.role === "builder") {
          updateBuilder(unit, dt);
          return;
        }

        if (race !== "Tyranids" && (unit.hp < unit.maxHp * 0.3 || unit.morale < 0.23 || unit.ammo <= 0)) unit.retreating = true;
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

        if (updateReinforcementRendezvous(unit, dt)) return;
        if (unit.role === "medic" && updateMedic(unit, dt)) return;
        if (unit.role === "engineer" && updateEngineer(unit, dt)) return;

        const assignedSquad = unit.squadId ? ensureSquadRuntime(squadFor(unit.squadId)) : null;
        unit.sensorCooldown = (unit.sensorCooldown || 0) - dt;
        let target = null;
        const holdingAmbush = assignedSquad?.orderType === "Ambush Route" && assignedSquad.ambushPhase !== "engage";
        if (holdingAmbush) {
          unit.cachedTargetId = null;
          unit.targetId = null;
        } else if (unit.sensorCooldown <= 0) {
          const sharedTarget = assignedSquad?.orderType === "Regroup" ? null : combatTargetById(assignedSquad?.targetId);
          const retainedTarget = combatTargetById(unit.cachedTargetId);
          const retainCommitment = retainedTarget
            && unit.combatCommitment?.targetId === retainedTarget.id
            && unit.combatCommitment.active !== false
            && !unit.combatCommitment.rejected
            && canDetectTarget(unit, retainedTarget);
          target = sharedTarget && !areAllies(sharedTarget.faction, unit.faction) ? sharedTarget : retainCommitment ? retainedTarget : findTarget(unit);
          unit.cachedTargetId = target?.id || null;
          unit.sensorCooldown = state.speed >= 8 ? (unit.role === "scout" ? 4 : 6) : (unit.role === "scout" ? 0.2 : 0.4);
        } else if (unit.cachedTargetId) {
          target = combatTargetById(unit.cachedTargetId);
        }
        if (target) {
          unit.targetId = target.id;
          if (!unit.combatCommitment || unit.combatCommitment.targetId !== target.id || unit.combatCommitment.expiresAt <= state.time) {
            const previousCommitment = unit.combatCommitment;
            const nextCommitment = killCommitmentFor(unit, target);
            if (previousCommitment?.targetId === target.id) {
              nextCommitment.originX = previousCommitment.originX;
              nextCommitment.originY = previousCommitment.originY;
            }
            unit.combatCommitment = nextCommitment;
          }
          const commitment = unit.combatCommitment;
          commitment.active = true;
          commitment.rejected = false;
          unit.killConfidence = Math.round(commitment.confidence);
          unit.combatIntent = commitment.intent;
          const restrictiveOrder = ["Hold Route", "Block Route", "Patrol Route", "Observe Route", "Ambush Route", "Keep Route Open", "Delay Enemy", "Destroy Route if Overrun", "Escort Route", "Regroup"].includes(assignedSquad?.orderType);
          const orderLeash = restrictiveOrder
            ? Math.max(unit.range * 0.75, 86) : Infinity;
          const orderRoad = assignedSquad?.roadId ? state.roads.find(road => road.id === assignedSquad.roadId) : null;
          const orderAnchor = assignedSquad?.routeAnchor || assignedSquad?.objective || (orderRoad ? roadMidpoint(orderRoad) : null);
          const outsideOrder = orderAnchor && distance(target, orderAnchor) > orderLeash;
          const outsidePursuit = distance({ x: commitment.originX, y: commitment.originY }, target) > commitment.pursuitRadius;
          if (commitment.intent === "Ignore" || commitment.intent === "Force retreat" && target.retreating || outsideOrder || outsidePursuit) {
            unit.cachedTargetId = null;
            unit.targetId = null;
            commitment.active = false;
            commitment.rejected = true;
            unit.killConfidence = 0;
            target = null;
          } else if ((assignedSquad?.leaderId !== unit.id || assignedSquad?.formation === "escort") && unit.formationSlot && distance(unit, unit.formationSlot) > 18 && (restrictiveOrder || commitment.intent !== "Eliminate" || commitment.confidence < commitment.threshold + 5) && distance(unit, target) > unit.range * 0.35) {
            moveToward(unit, unit.formationSlot, dt, assignedSquad.cohesion < 0.55 ? 1.12 : 1.02);
            if (distance(unit, target) <= unit.range * 0.92 && unit.fireCd <= 0 && unit.ammo > 0) fireAt(unit, target);
            unit.status = `Fighting in ${assignedSquad.formation}`;
            unit.lastAction = `${assignedSquad.orderType} · restoring formation while maintaining contact.`;
            return;
          } else if (distance(unit, target) <= unit.range * 0.92) {
            unit.aimTime = clamp((unit.aimTime || 0) + dt * (0.8 + unit.reflexes), 0, 2.5);
            if (unit.fireCd <= 0 && unit.ammo > 0) fireAt(unit, target);
            else unit.status = commitment.intent === "Eliminate" ? "Finishing target" : "Suppressing";
            return;
          } else if (commitment.intent === "Eliminate" || commitment.intent === "Force retreat") {
            unit.aimTime = 0;
            moveToward(unit, target, dt, commitment.intent === "Eliminate" ? 1.12 : 0.9);
            unit.status = commitment.intent === "Eliminate" ? "Pursuing kill" : "Pressuring retreat";
            unit.lastAction = `${commitment.intent} at ${unit.killConfidence}% confidence.`;
            return;
          } else {
            unit.cachedTargetId = null;
            unit.targetId = null;
            commitment.active = false;
            commitment.rejected = true;
            unit.killConfidence = 0;
            target = null;
          }
        }

        unit.targetId = null;
        unit.combatIntent = "Follow objective";
        unit.killConfidence = 0;
        if (unit.combatCommitment) unit.combatCommitment.active = false;
        unit.aimTime = 0;
        if (assignedSquad && (assignedSquad.leaderId !== unit.id || assignedSquad.formation === "escort")) {
          const leader = state.units.find(candidate => candidate.id === assignedSquad.leaderId && candidate.alive);
          const slot = unit.formationSlot || leader;
          if (slot && distance(unit, slot) > 10) {
            moveToward(unit, slot, dt, assignedSquad.cohesion < 0.55 ? 1.12 : 1.02);
            unit.status = `Forming ${assignedSquad.formation}`;
            unit.lastAction = `${assignedSquad.orderType} · deforming around terrain into ${assignedSquad.formation} formation.`;
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
          unit.status = holdingAmbush ? "Ambush waiting" : "Holding";
          unit.lastAction = holdingAmbush ? "Holding fire discipline for a valuable target on the route." : "Watching assigned sector.";
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
        const convoyBody = { role: "vehicle", collisionRadius: 12, maxHp: 100, strength: 0.58 };
        const blocked = points.slice(1, -1).some(point => ["deepwater", "river", "lava", "cliff"].includes(terrainAt(point).type)
          || environmentCollisionAt(point, convoyBody, convoyBody.collisionRadius));
        if (blocked) {
          points[1].x = clamp(points[1].x + px * 55, 20, worldWidth() - 20);
          points[1].y = clamp(points[1].y + py * 55, 20, worldHeight() - 20);
          points[2].x = clamp(points[2].x + px * 55, 20, worldWidth() - 20);
          points[2].y = clamp(points[2].y + py * 55, 20, worldHeight() - 20);
        }
        return points;
      }

      function strategicRoadPath(start, end, seed = 0) {
        const candidates = [0, 17, 41, 73, 109].map(offset => roadPathBetween(start, end, seed + offset));
        return candidates.map(points => {
          let cost = 0;
          for (let index = 0; index < points.length; index += 1) {
            const terrain = terrainAt(points[index]);
            cost += (1 / Math.max(0.12, terrain.speed)) * 18 - terrain.cover * 4 + Math.abs(terrain.elevation || 0) * 2;
            if (["deepwater", "lava", "cliff", "mountain"].includes(terrain.type)) cost += 180;
          }
          for (let index = 1; index < points.length; index += 1) cost += distance(points[index - 1], points[index]);
          return { points, cost };
        }).sort((a, b) => a.cost - b.cost)[0].points;
      }

      function roadEndpointId(node, fallback) {
        return String(node.id || fallback || `${Math.round(node.x)}-${Math.round(node.y)}`).replace(/[^a-z0-9-]/gi, "-").toLowerCase();
      }

      function buildRoadSegments(roadId, points, kind, previousRoad = null) {
        const centerline = points.length ? [{ ...points[0] }] : [];
        for (let pointIndex = 1; pointIndex < points.length; pointIndex += 1) {
          const start = points[pointIndex - 1];
          const end = points[pointIndex];
          const steps = Math.max(1, Math.ceil(distance(start, end) / CHUNK_SIZE));
          for (let step = 1; step <= steps; step += 1) {
            const t = step / steps;
            centerline.push({ x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t });
          }
        }
        return centerline.slice(1).map((point, index) => {
          const start = centerline[index];
          const midpoint = { x: (start.x + point.x) / 2, y: (start.y + point.y) / 2 };
          const terrain = terrainAt(midpoint);
          const previous = previousRoad?.segments?.find(segment => segment.id === `${roadId}-segment-${index}`);
          const roadType = ["water", "river", "shallowwater", "deepwater"].includes(terrain.type)
            ? "bridge" : kind === "trade route" ? "paved" : terrain.type === "forestfloor" ? "trail" : "dirt";
          return {
            id: `${roadId}-segment-${index}`,
            start: { x: start.x, y: start.y },
            end: { x: point.x, y: point.y },
            length: distance(start, point),
            type: roadType,
            roadType,
            bridge: roadType === "bridge",
            condition: previous?.condition ?? 1,
            width: roadType === "bridge" ? 7 : kind === "trade route" ? 10 : roadType === "trail" ? 5 : 8,
            capacity: roadType === "bridge" ? 6 : kind === "trade route" ? 16 : roadType === "trail" ? 5 : 10,
            traffic: previous?.traffic ?? 0,
            control: previous?.control || "Unsecured",
            controllerFaction: previous?.controllerFaction || null,
            visibility: previous?.visibility ?? clamp(terrain.detection, 0, 1),
            ambushRisk: previous?.ambushRisk ?? clamp(terrain.cover * 0.65 + (1 - terrain.detection) * 0.35, 0, 1),
            cover: terrain.cover,
            supplyImportance: previous?.supplyImportance ?? (kind === "trade route" ? 0.9 : 0.55),
            status: previous?.status || "Clear",
            operationalFlags: previous?.operationalFlags || [],
            checkpoint: previous?.checkpoint ? { ...previous.checkpoint } : null,
            mineFaction: previous?.mineFaction || null
          };
        });
      }

      function closestPointOnRoadSegment(point, segment) {
        const dx = segment.end.x - segment.start.x;
        const dy = segment.end.y - segment.start.y;
        const lengthSquared = dx * dx + dy * dy || 1;
        const t = clamp(((point.x - segment.start.x) * dx + (point.y - segment.start.y) * dy) / lengthSquared, 0, 1);
        return { x: segment.start.x + dx * t, y: segment.start.y + dy * t };
      }

      function rebuildRoadSpatialIndex() {
        state.roadSpatialIndex = new Map();
        for (const road of state.roads) {
          for (const segment of road.segments || []) {
            const record = { road, segment };
            const steps = Math.max(1, Math.ceil(segment.length / (spatialCellSize * 0.55)));
            for (let step = 0; step <= steps; step += 1) {
              const t = step / steps;
              const cellX = Math.floor((segment.start.x + (segment.end.x - segment.start.x) * t) / spatialCellSize);
              const cellY = Math.floor((segment.start.y + (segment.end.y - segment.start.y) * t) / spatialCellSize);
              for (let ox = -1; ox <= 1; ox += 1) {
                for (let oy = -1; oy <= 1; oy += 1) {
                  const x = cellX + ox;
                  const y = cellY + oy;
                  if (x < 0 || y < 0 || x >= Math.ceil(worldWidth() / spatialCellSize) || y >= Math.ceil(worldHeight() / spatialCellSize)) continue;
                  const key = spatialGridKey(x, y);
                  if (!state.roadSpatialIndex.has(key)) state.roadSpatialIndex.set(key, new Set());
                  state.roadSpatialIndex.get(key).add(record);
                }
              }
            }
          }
        }
      }

      function nearestRoadSegment(point, maximumDistance = Infinity, predicate = null) {
        let best = null;
        let bestDistance = maximumDistance;
        let candidates = null;
        if (Number.isFinite(maximumDistance) && state.roadSpatialIndex?.size) {
          candidates = [];
          const seen = new Set();
          const range = Math.ceil(maximumDistance / spatialCellSize) + 1;
          const cx = Math.floor(point.x / spatialCellSize);
          const cy = Math.floor(point.y / spatialCellSize);
          const columns = Math.ceil(worldWidth() / spatialCellSize);
          const rows = Math.ceil(worldHeight() / spatialCellSize);
          for (let ox = -range; ox <= range; ox += 1) {
            for (let oy = -range; oy <= range; oy += 1) {
              const cellX = cx + ox;
              const cellY = cy + oy;
              if (cellX < 0 || cellY < 0 || cellX >= columns || cellY >= rows) continue;
              for (const record of state.roadSpatialIndex.get(spatialGridKey(cellX, cellY)) || []) {
                if (seen.has(record.segment.id)) continue;
                seen.add(record.segment.id);
                candidates.push(record);
              }
            }
          }
        }
        if (!candidates) candidates = state.roads.flatMap(road => (road.segments || []).map(segment => ({ road, segment })));
        for (const candidate of candidates) {
          if (predicate && !predicate(candidate)) continue;
          const closest = closestPointOnRoadSegment(point, candidate.segment);
          const d = distance(point, closest);
          if (d >= bestDistance) continue;
          bestDistance = d;
          best = { ...candidate, point: closest, distance: d };
        }
        return best;
      }

      function routeForLogistics(start, end, faction, seed = 0) {
        const routeBlocked = road => (road.segments || []).some(segment => segment.status === "Blocked" || (segment.operationalFlags || []).some(flag => ["blocked", "collapsed", "cratered", "roadblock"].includes(flag)));
        const usableRoads = state.roads.filter(road => road.points?.length > 1
          && (areAllies(road.controllerFaction || road.faction, faction) || areAllies(road.faction, faction))
          && !routeBlocked(road));
        const nodes = new Map();
        const adjacency = new Map();
        const addNode = (id, point) => {
          if (!nodes.has(id)) nodes.set(id, { id, x: point.x, y: point.y });
          if (!adjacency.has(id)) adjacency.set(id, []);
        };
        for (const road of usableRoads) {
          addNode(road.fromId, road.points[0]);
          addNode(road.toId, road.points[road.points.length - 1]);
          const roadLength = (road.segments || []).reduce((sum, segment) => sum + segment.length, 0);
          const hostileControl = road.control === "Enemy controlled" ? 260 : road.control === "Contested" ? 110 : 0;
          const hazardPenalty = road.operationalFlags?.includes("mined") ? 210 : road.operationalFlags?.includes("flooded") ? 95 : road.operationalFlags?.includes("wreck") ? 55 : 0;
          const congestion = (road.segments || []).reduce((sum, segment) => sum + (segment.traffic || 0) / Math.max(1, segment.capacity || 1), 0);
          const conditionPenalty = (1 - (road.condition ?? 1)) * 0.55;
          const edgeCost = roadLength * clamp(0.74 + conditionPenalty + (road.ambushRisk || 0) * 0.42 + congestion * 0.04 - (road.supplyImportance || 0) * 0.08, 0.62, 2.2)
            + hostileControl + hazardPenalty;
          adjacency.get(road.fromId).push({ to: road.toId, road, reverse: false, cost: edgeCost });
          adjacency.get(road.toId).push({ to: road.fromId, road, reverse: true, cost: edgeCost });
        }
        if (nodes.size) {
          const rankedStarts = [...nodes.values()].sort((a, b) => distance(start, a) - distance(start, b)).slice(0, 3);
          const rankedEnds = [...nodes.values()].sort((a, b) => distance(end, a) - distance(end, b)).slice(0, 3);
          const distances = new Map([...nodes.keys()].map(id => [id, Infinity]));
          const previous = new Map();
          const frontier = [];
          for (const node of rankedStarts) {
            const connectorCost = distance(start, node) * 1.12;
            distances.set(node.id, connectorCost);
            previous.set(node.id, null);
            frontier.push(node.id);
          }
          const visited = new Set();
          while (frontier.length) {
            frontier.sort((a, b) => distances.get(a) - distances.get(b));
            const current = frontier.shift();
            if (visited.has(current)) continue;
            visited.add(current);
            for (const edge of adjacency.get(current) || []) {
              const nextDistance = distances.get(current) + edge.cost;
              if (nextDistance >= distances.get(edge.to)) continue;
              distances.set(edge.to, nextDistance);
              previous.set(edge.to, { from: current, edge });
              frontier.push(edge.to);
            }
          }
          const destinationNode = rankedEnds
            .map(node => ({ node, score: distances.get(node.id) + distance(node, end) * 1.12 }))
            .filter(candidate => Number.isFinite(candidate.score) && previous.get(candidate.node.id))
            .sort((a, b) => a.score - b.score)[0];
          if (destinationNode && destinationNode.score < distance(start, end) * 1.58) {
            const edges = [];
            let cursor = destinationNode.node.id;
            while (previous.get(cursor)) {
              const step = previous.get(cursor);
              edges.push(step.edge);
              cursor = step.from;
            }
            edges.reverse();
            const route = [{ x: start.x, y: start.y }];
            const append = point => {
              const last = route[route.length - 1];
              if (!last || distance(last, point) > 1) route.push({ x: point.x, y: point.y });
            };
            for (const edge of edges) {
              const points = edge.reverse ? [...edge.road.points].reverse() : edge.road.points;
              for (const point of points) append(point);
            }
            append(end);
            return route;
          }
        }
        return strategicRoadPath(start, end, seed);
      }

      function rebuildRoadNetwork() {
        const previousRoads = new Map(state.roads.map(road => [road.id, road]));
        const roads = [];
        for (const player of state.players) {
          const nodes = [player.base, ...state.structures
            .filter(item => item.faction === player.id && item.progress >= 1 && item.alive !== false)
            .sort((a, b) => a.createdAt - b.createdAt)];
          for (let index = 1; index < nodes.length; index += 1) {
            const node = nodes[index];
            const previous = nodes.slice(0, index).sort((a, b) => distance(a, node) - distance(b, node))[0];
            const fromId = roadEndpointId(previous, `base-${player.id}`);
            const toId = roadEndpointId(node, `node-${index}`);
            const id = `road-${player.id}-${fromId}-${toId}`;
            const old = previousRoads.get(id);
            const points = strategicRoadPath(previous, node, index + player.index * 13);
            const segments = buildRoadSegments(id, points, "service road", old);
            roads.push({
              id, name: `${player.faction} route ${index}`, faction: player.id, builderFaction: player.id,
              fromId, toId, kind: "service road", hierarchy: index === 1 ? "main supply route" : "local access",
              points, segments, condition: segments.reduce((sum, segment) => sum + segment.condition, 0) / Math.max(1, segments.length),
              traffic: old?.traffic || 0, control: old?.control || "Unsecured", controllerFaction: old?.controllerFaction || null,
              visibility: old?.visibility ?? 0.65, ambushRisk: old?.ambushRisk ?? 0.2, cover: old?.cover ?? 0.1,
              supplyImportance: old?.supplyImportance ?? (index === 1 ? 0.85 : 0.55), status: old?.status || "Clear",
              operationalFlags: old?.operationalFlags || []
            });
          }
          const partner = state.tradePartners?.find(item => item.faction === player.id);
          if (partner?.established) {
            const id = `road-${player.id}-${roadEndpointId(partner)}-base-${player.id}`;
            const old = previousRoads.get(id);
            const points = strategicRoadPath(partner, player.base, player.index + 91);
            const segments = buildRoadSegments(id, points, "trade route", old);
            roads.push({
              id, name: `${partner.name} trade artery`, faction: player.id, builderFaction: player.id,
              fromId: partner.id, toId: `base-${player.id}`, kind: "trade route", hierarchy: "strategic supply artery",
              points, segments, condition: segments.reduce((sum, segment) => sum + segment.condition, 0) / Math.max(1, segments.length),
              traffic: old?.traffic || 0, control: old?.control || "Unsecured", controllerFaction: old?.controllerFaction || null,
              visibility: old?.visibility ?? 0.72, ambushRisk: old?.ambushRisk ?? 0.24, cover: old?.cover ?? 0.08,
              supplyImportance: 1, status: old?.status || "Clear", operationalFlags: old?.operationalFlags || []
            });
          }
        }
        state.roads = roads;
        state.roadRevision += 1;
        rebuildRoadSpatialIndex();
        const validRoadIds = new Set(roads.map(road => road.id));
        for (const squad of state.squads) {
          if (!squad.roadId || validRoadIds.has(squad.roadId)) continue;
          squad.roadId = null;
          squad.routeSegmentId = null;
          squad.routeAnchor = null;
          squad.routePhase = null;
          squad.objective = null;
          squad.targetId = null;
          if (squad.orderType !== "Regroup") squad.orderType = "Advance";
          squad.orderCommitUntil = 0;
        }
        for (const convoy of state.convoys) {
          if (convoy.finished) continue;
          const destination = routeDestination(convoy);
          if (!destination) continue;
          convoy.route = routeForLogistics(convoy, destination, convoy.faction, state.nextConvoyId + state.roadRevision * 17);
          convoy.waypoint = 1;
          convoy.roadRevision = state.roadRevision;
        }
      }

      function updateRoadDynamics(dt) {
        const trafficBySegment = new Map();
        const squadById = new Map(state.squads.map(squad => [squad.id, squad]));
        for (const convoy of state.convoys) {
          if (convoy.finished || convoy.mode === "cargo aircraft" || !convoy.activeSegmentId) continue;
          trafficBySegment.set(convoy.activeSegmentId, (trafficBySegment.get(convoy.activeSegmentId) || 0) + 1);
        }
        for (const road of state.roads) {
          let trafficTotal = 0;
          let riskTotal = 0;
          let visibilityTotal = 0;
          let conditionTotal = 0;
          let supplyTotal = 0;
          const controlCounts = new Map();
          for (const segment of road.segments || []) {
            const midpoint = { x: (segment.start.x + segment.end.x) / 2, y: (segment.start.y + segment.end.y) / 2 };
            const nearby = nearbyCombatObjects(midpoint, 72).units.filter(unit => unit.alive);
            const traffic = trafficBySegment.get(segment.id) || 0;
            segment.traffic = segment.traffic * 0.72 + traffic * 0.28;
            const factionPower = new Map();
            for (const unit of nearby) factionPower.set(unit.faction, (factionPower.get(unit.faction) || 0) + unit.hp / Math.max(1, unit.maxHp) * (unit.role === "vehicle" ? 2 : 1));
            if (segment.checkpoint) {
              const defenders = nearby.filter(unit => areAllies(unit.faction, segment.checkpoint.faction))
                .reduce((sum, unit) => sum + combatPowerScore(unit), 0);
              const attackers = nearby.filter(unit => !areAllies(unit.faction, segment.checkpoint.faction))
                .reduce((sum, unit) => sum + combatPowerScore(unit), 0);
              if (attackers > defenders + 0.9) {
                segment.checkpoint.integrity = clamp(segment.checkpoint.integrity - dt * 0.018 * clamp(attackers - defenders, 0.6, 3), 0, 1);
                if (segment.checkpoint.integrity <= 0.04) {
                  const destroyed = segment.checkpoint;
                  segment.checkpoint = null;
                  segment.condition = clamp(segment.condition - 0.08, 0, 1);
                  segment.operationalFlags = [...new Set([...(segment.operationalFlags || []).filter(flag => !["checkpoint", "roadblock"].includes(flag)), "wreck", "damaged"])];
                  incident(`${destroyed.kind} on ${road.name || road.id} was overrun and destroyed.`, null, "warning");
                }
              } else if (defenders > 0) {
                segment.checkpoint.integrity = clamp(segment.checkpoint.integrity + dt * 0.004 * clamp(defenders, 0.4, 2), 0, 1);
                segment.checkpoint.lastSupportedAt = state.time;
              } else if (state.time - (segment.checkpoint.lastSupportedAt ?? segment.checkpoint.establishedAt ?? state.time) > 45) {
                const decay = segment.checkpoint.kind === "observation post" ? 0.006 : 0.002;
                segment.checkpoint.integrity = clamp(segment.checkpoint.integrity - dt * decay, 0, 1);
                if (segment.checkpoint.integrity <= 0.04) segment.checkpoint = null;
              }
            }
            if (segment.checkpoint) {
              const postPower = { "observation post": 0.34, "route checkpoint": 0.56, checkpoint: 0.7, roadblock: 0.82 }[segment.checkpoint.kind] || 0.5;
              const recentlySupported = state.time - (segment.checkpoint.lastSupportedAt ?? segment.checkpoint.establishedAt ?? state.time) <= 45;
              factionPower.set(segment.checkpoint.faction, (factionPower.get(segment.checkpoint.faction) || 0) + postPower * segment.checkpoint.integrity * (recentlySupported ? 1 : 0.25));
            }
            const ranked = [...factionPower.entries()].sort((a, b) => b[1] - a[1]);
            const terrain = terrainAt(midpoint);
            segment.cover = terrain.cover;
            segment.visibility = clamp(terrain.detection * (state.visibility / 100), 0.08, 1);
            const hostilePower = ranked.filter(([faction]) => !areAllies(faction, road.faction)).reduce((sum, [, power]) => sum + power, 0);
            const friendlyPower = ranked.filter(([faction]) => areAllies(faction, road.faction)).reduce((sum, [, power]) => sum + power, 0);
            const friendlyLeader = ranked.find(([faction]) => areAllies(faction, road.faction));
            const hostileLeader = ranked.find(([faction]) => !areAllies(faction, road.faction));
            const contested = friendlyPower > 0 && hostilePower > 0 && Math.min(friendlyPower, hostilePower) / Math.max(friendlyPower, hostilePower) > 0.55;
            segment.controllerFaction = contested ? null : friendlyPower >= hostilePower ? friendlyLeader?.[0] || null : hostileLeader?.[0] || null;
            segment.control = contested ? "Contested" : friendlyPower > hostilePower ? "Secured" : hostilePower > 0 ? "Enemy controlled" : "Unsecured";
            const observers = nearby.filter(unit => {
              const squad = squadById.get(unit.squadId);
              return squad?.orderType === "Observe Route" && squad.roadId === road.id && squad.routeSegmentId === segment.id;
            });
            const observationPostActive = segment.checkpoint?.kind === "observation post"
              && state.time - (segment.checkpoint.lastSupportedAt ?? segment.checkpoint.establishedAt ?? state.time) <= 30;
            segment.observationFaction = observers[0]?.faction || (observationPostActive ? segment.checkpoint.faction : null);
            const friendlyObservation = segment.observationFaction && areAllies(segment.observationFaction, road.faction);
            if (segment.observationFaction) segment.visibility = clamp(segment.visibility + (friendlyObservation ? 0.2 : 0.12), 0.08, 1);
            const checkpointSecurity = segment.checkpoint && areAllies(segment.checkpoint.faction, road.faction) ? segment.checkpoint.integrity * 0.18 : 0;
            segment.ambushRisk = clamp(segment.cover * 0.42 + (1 - segment.visibility) * 0.3 + hostilePower / Math.max(1, hostilePower + friendlyPower) * 0.5 + segment.traffic / Math.max(1, segment.capacity) * 0.16 - (friendlyObservation ? 0.2 : 0) - checkpointSecurity, 0, 1);
            const weatherWear = ["rain", "snow", "dust"].includes(state.lighting.weather) ? 0.00018 : 0.00006;
            segment.condition = clamp(segment.condition - dt * weatherWear * (1 + segment.traffic / Math.max(1, segment.capacity)), 0, 1);
            const hierarchyBaseline = road.hierarchy === "strategic supply artery" ? 0.82 : road.hierarchy === "main supply route" ? 0.68 : road.kind === "trade route" ? 0.76 : 0.38;
            segment.supplyImportance = clamp(hierarchyBaseline + segment.traffic / Math.max(1, segment.capacity) * 0.28, 0, 1);
            const persistentFlags = (segment.operationalFlags || []).filter(flag => ["wreck", "mined", "flooded", "collapsed", "cratered", "fallen tree", "obstructed", "partially obstructed"].includes(flag));
            if (state.lighting.weather === "rain" && segment.condition < 0.58 && (["mud", "swamp", "river", "shallowwater"].includes(terrain.type) || segment.bridge) && !persistentFlags.includes("flooded")) persistentFlags.push("flooded");
            segment.operationalFlags = [...new Set(persistentFlags)];
            if (!persistentFlags.includes("mined")) segment.mineFaction = null;
            if (persistentFlags.length) segment.operationalFlags.push("damaged");
            if (segment.condition < 0.55) segment.operationalFlags.push("damaged");
            if (segment.condition < 0.18) segment.operationalFlags.push("blocked");
            if (segment.traffic > segment.capacity) segment.operationalFlags.push("congested");
            if (segment.control === "Contested") segment.operationalFlags.push("contested");
            if (segment.observationFaction) segment.operationalFlags.push("under observation");
            if (segment.checkpoint) segment.operationalFlags.push("checkpoint");
            if (segment.checkpoint?.kind === "roadblock") segment.operationalFlags.push("roadblock");
            segment.operationalFlags = [...new Set(segment.operationalFlags)];
            segment.status = segment.condition < 0.18 || persistentFlags.some(flag => ["collapsed", "cratered", "fallen tree", "obstructed"].includes(flag)) || segment.checkpoint?.kind === "roadblock" ? "Blocked"
              : persistentFlags.includes("mined") ? "Mined"
                : persistentFlags.includes("flooded") ? "Flooded"
                  : segment.control === "Contested" ? "Contested"
                    : segment.control === "Enemy controlled" ? "Enemy controlled"
                      : segment.traffic > segment.capacity ? "Congested"
                        : segment.condition < 0.55 || persistentFlags.includes("wreck") || persistentFlags.includes("partially obstructed") ? "Damaged"
                          : segment.operationalFlags.includes("under observation") ? "Under observation"
                            : segment.control === "Secured" ? "Secured" : "Clear";
            if (segment.controllerFaction) controlCounts.set(segment.controllerFaction, (controlCounts.get(segment.controllerFaction) || 0) + 1);
            trafficTotal += segment.traffic;
            riskTotal += segment.ambushRisk;
            visibilityTotal += segment.visibility;
            conditionTotal += segment.condition;
            supplyTotal += segment.supplyImportance;
          }
          const count = Math.max(1, road.segments?.length || 0);
          road.traffic = trafficTotal;
          road.ambushRisk = riskTotal / count;
          road.visibility = visibilityTotal / count;
          road.condition = conditionTotal / count;
          road.supplyImportance = supplyTotal / count;
          road.cover = (road.segments || []).reduce((sum, segment) => sum + segment.cover, 0) / count;
          road.controllerFaction = [...controlCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
          const statuses = road.segments?.map(segment => segment.status) || [];
          road.status = statuses.includes("Blocked") ? "Blocked"
            : statuses.includes("Mined") ? "Mined"
              : statuses.includes("Flooded") ? "Flooded"
                : statuses.includes("Contested") ? "Contested"
                  : statuses.includes("Enemy controlled") ? "Enemy controlled"
                    : statuses.includes("Congested") ? "Congested"
                      : statuses.includes("Damaged") ? "Damaged"
                        : statuses.includes("Under observation") ? "Under observation"
                          : statuses.includes("Secured") ? "Secured" : "Clear";
          road.control = road.status === "Contested" ? "Contested" : road.controllerFaction ? areAllies(road.controllerFaction, road.faction) ? "Secured" : "Enemy controlled" : "Unsecured";
          road.operationalFlags = [...new Set((road.segments || []).flatMap(segment => segment.operationalFlags))];
        }
        state.aiDiagnostics.securedRoads = state.roads.filter(road => road.status === "Secured").length;
        state.aiDiagnostics.checkpoints = state.roads.reduce((sum, road) => sum + (road.segments || []).filter(segment => segment.checkpoint).length, 0);
      }

      function routeDestination(convoy) {
        if (convoy.destinationKind === "unit") return state.units.find(unit => unit.id === convoy.destinationId && unit.alive) || null;
        if (convoy.destinationKind === "structure") return state.structures.find(item => item.id === convoy.destinationId && item.alive !== false) || null;
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
          route: routeForLogistics(origin, destination, faction, state.nextConvoyId * 7),
          waypoint: 1,
          hp: options.mode === "cargo aircraft" ? 70 : 100,
          maxHp: options.mode === "cargo aircraft" ? 70 : 100,
          mode: options.mode || defaultMode,
          status: options.status || "Delivering",
          escortRequested: false,
          reroutes: 0,
          roadRevision: state.roadRevision,
          activeSegmentId: null,
          trade: Boolean(options.trade),
          training: Boolean(options.training),
          trainingRequestId: options.trainingRequestId || null,
          dropPodSupply: Boolean(options.dropPodSupply),
          originId: options.originId || null,
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

      function isImperialGuard(player) {
        return player?.race === "Imperium" && player?.faction === "Imperial Guard";
      }

      function unitCapFor(player) {
        const generic = state.players.length > 8 ? 8 : state.players.length > 4 ? 12 : 18;
        if (!isImperialGuard(player)) return generic;
        return state.players.length > 8 ? 17 : state.players.length > 4 ? 25 : 36;
      }

      function expandedGuardTemplate(templateKey) {
        const template = aiConfig.guardTemplates?.[templateKey] || aiConfig.guardTemplates?.standard;
        if (!template) return [];
        return template.members.flatMap(spec => Array.from({ length: spec.count || 1 }, (_, index) => ({ ...spec, count: undefined, ordinal: index + 1 })));
      }

      function guardTrainingCost(templateKey, memberCount = null) {
        const count = memberCount ?? expandedGuardTemplate(templateKey).length ?? 10;
        if (count <= 0) return {};
        const multiplier = aiConfig.guardTemplates?.[templateKey]?.costMultiplier ?? 1;
        return {
          requisition: Math.max(14, Math.ceil(count * 5.5 * multiplier)),
          food: Math.max(4, Math.ceil(count * 2.1 * multiplier)),
          ammunition: Math.max(7, Math.ceil(count * 2.5 * multiplier)),
          medical: Math.max(1, Math.ceil(count * 0.5 * multiplier))
        };
      }

      function missingGuardTemplateSpecs(templateKey, squad, maximum) {
        const remaining = new Map();
        for (const member of squadMembers(squad.id)) {
          const key = member.specialty || member.name;
          remaining.set(key, (remaining.get(key) || 0) + 1);
        }
        const missing = [];
        for (const spec of expandedGuardTemplate(templateKey)) {
          const present = remaining.get(spec.title) || 0;
          if (present > 0) remaining.set(spec.title, present - 1);
          else missing.push(spec);
        }
        return missing.slice(0, maximum);
      }

      function guardRosterCanAcceptMembers(templateKey, targetSquad, incomingMembers) {
        const capacity = new Map();
        for (const spec of expandedGuardTemplate(templateKey)) capacity.set(spec.title, (capacity.get(spec.title) || 0) + 1);
        const combined = [...squadMembers(targetSquad.id), ...incomingMembers];
        const used = new Map();
        for (const member of combined) {
          const title = member.specialty || member.name;
          if (!capacity.has(title)) return false;
          used.set(title, (used.get(title) || 0) + 1);
          if (used.get(title) > capacity.get(title)) return false;
        }
        return combined.length <= expandedGuardTemplate(templateKey).length;
      }

      function manageGuardSquads(player) {
        if (!isImperialGuard(player)) return;
        const guardSquads = state.squads.filter(squad => squad.faction === player.id && String(squad.templateId).startsWith("guard-"));
        for (const squad of guardSquads) {
          if (squad.disbandedAt) continue;
          ensureSquadRuntime(squad);
          const members = squadMembers(squad.id);
          const ratio = members.length / Math.max(1, squad.nominalSize);
          if (!members.length) {
            squad.leaderId = null;
            squad.actingLeaderId = null;
            squad.leadershipState = "Awaiting reconstitution";
            squad.reinforcementState = "Reconstituting full squad";
            squad.orderType = "Regroup";
            squad.roadId = null;
            squad.routeSegmentId = null;
            squad.routeAnchor = null;
            squad.objective = { ...player.base };
            continue;
          }
          const rendezvousing = members.filter(member => member.reinforcementRendezvous);
          if (rendezvousing.length) {
            squad.reinforcementState = `${rendezvousing.length}-member replacement detachment en route`;
            continue;
          }
          if (ratio < 0.38) {
            const templateKey = squad.templateId.replace("guard-", "");
            const mergeTarget = guardSquads.find(other => !other.disbandedAt && other.id !== squad.id && other.templateId === squad.templateId
              && squadMembers(other.id).length + members.length <= other.nominalSize
              && guardRosterCanAcceptMembers(templateKey, other, members));
            if (mergeTarget && distance(state.units.find(unit => unit.id === mergeTarget.leaderId) || player.base, state.units.find(unit => unit.id === squad.leaderId) || player.base) < 180) {
              for (const member of members) {
                member.squadId = mergeTarget.id;
                member.protectTargetId = mergeTarget.protectedAssetId || null;
                member.formationSlot = null;
              }
              mergeTarget.reinforcementState = `Merged ${squad.name}`;
              const mergedMissing = Math.max(0, mergeTarget.nominalSize - squadMembers(mergeTarget.id).length);
              const replacementRequest = economyFor(player.id).queue.find(request => request.key === "train-line"
                && !["Delivered", "Denied", "Complete"].includes(request.status)
                && [squad.id, mergeTarget.id].includes(request.targetSquadId));
              if (replacementRequest) {
                if (mergedMissing > 0) {
                  replacementRequest.targetSquadId = mergeTarget.id;
                  replacementRequest.memberCount = replacementRequest.lockedAt == null
                    ? mergedMissing
                    : Math.min(replacementRequest.memberCount ?? mergedMissing, mergedMissing);
                  replacementRequest.guardTemplateKey = mergeTarget.templateId.replace("guard-", "");
                  replacementRequest.label = `Raise replacement detachment for ${mergeTarget.name}`;
                } else {
                  replacementRequest.status = "Denied";
                  replacementRequest.cancelledReason = "Merged squad returned to full strength";
                }
              }
              squad.disbandedAt = state.time;
              incident(`${squad.name} merged into ${mergeTarget.name}; its survivors remain a single coherent Guard formation.`, mergeTarget.leaderId, "warning");
              continue;
            }
            const sourceLeader = state.units.find(unit => unit.id === squad.leaderId && unit.alive) || members[0];
            if (ratio < 0.25 && sourceLeader && distance(sourceLeader, player.base) < 72) {
              const available = new Set(members.map(member => member.id));
              const recipients = guardSquads
                .filter(other => !other.disbandedAt && other.id !== squad.id && other.templateId === squad.templateId && squadMembers(other.id).length < other.nominalSize)
                .sort((a, b) => squadMembers(a.id).length / a.nominalSize - squadMembers(b.id).length / b.nominalSize);
              let redistributed = 0;
              for (const recipient of recipients) {
                let recipientReceived = 0;
                const needed = missingGuardTemplateSpecs(recipient.templateId.replace("guard-", ""), recipient, recipient.nominalSize - squadMembers(recipient.id).length);
                for (const spec of needed) {
                  const survivor = members.find(member => available.has(member.id) && member.specialty === spec.title);
                  if (!survivor) continue;
                  survivor.squadId = recipient.id;
                  survivor.protectTargetId = recipient.protectedAssetId || null;
                  survivor.formationSlot = null;
                  available.delete(survivor.id);
                  redistributed += 1;
                  recipientReceived += 1;
                }
                if (recipientReceived) recipient.reinforcementState = `Received ${recipientReceived} survivors from ${squad.name}`;
                if (!available.size) break;
              }
              if (redistributed) incident(`${squad.name} redistributed ${redistributed} compatible survivors after returning to base.`, sourceLeader.id, "warning");
              if (!available.size) {
                const replacementRequest = economyFor(player.id).queue.find(request => request.key === "train-line"
                  && request.targetSquadId === squad.id && !["Delivered", "Denied", "Complete"].includes(request.status));
                if (replacementRequest) {
                  replacementRequest.status = "Denied";
                  replacementRequest.cancelledReason = "Squad disbanded after survivors were redistributed";
                }
                squad.disbandedAt = state.time;
                continue;
              }
            }
            squad.reinforcementState = "Return to base";
            squad.orderType = "Regroup";
            squad.roadId = null;
            squad.protectedAssetId = null;
            squad.targetId = null;
            squad.objective = { ...player.base };
            squad.orderCommitUntil = state.time + 16;
            squad.slotAssignments = {};
            for (const member of squadMembers(squad.id)) {
              member.protectTargetId = null;
              member.cachedTargetId = null;
              member.targetId = null;
              member.formationSlot = null;
              if (member.combatCommitment) {
                member.combatCommitment.active = false;
                member.combatCommitment.rejected = true;
              }
            }
          } else if (ratio < 1) squad.reinforcementState = `Awaiting ${squad.nominalSize - members.length} replacements`;
          else squad.reinforcementState = "Full strength";
        }
        state.squads = state.squads.filter(squad => !squad.disbandedAt);
      }

      function selectGuardTraining(player, availableSlots = Infinity) {
        manageGuardSquads(player);
        const damaged = state.squads
          .filter(squad => {
            if (squad.faction !== player.id || !String(squad.templateId).startsWith("guard-")) return false;
            const members = squadMembers(squad.id);
            const missing = squad.nominalSize - members.length;
            return missing >= 2 || missing === 1 && !members.some(member => member.role === "commander");
          })
          .sort((a, b) => squadMembers(a.id).length / a.nominalSize - squadMembers(b.id).length / b.nominalSize)[0];
        if (damaged && damaged.nominalSize - squadMembers(damaged.id).length <= availableSlots) {
          const templateKey = damaged.templateId.replace("guard-", "");
          return { templateKey, targetSquadId: damaged.id, memberCount: damaged.nominalSize - squadMembers(damaged.id).length };
        }
        if (damaged) return null;
        const count = state.squads.filter(squad => squad.faction === player.id && String(squad.templateId).startsWith("guard-")).length;
        const cycle = ["standard", "standard", "heavy", "standard", "command", "veteran", "conscript"];
        for (let offset = 0; offset < cycle.length; offset += 1) {
          const templateKey = cycle[(count + offset) % cycle.length];
          if (expandedGuardTemplate(templateKey).length <= availableSlots) return { templateKey, targetSquadId: null, memberCount: null };
        }
        return null;
      }

      function spawnGuardSquad(player, barracks, templateKey = "standard", targetSquadId = null, batchCount = null) {
        const fullSpecs = expandedGuardTemplate(templateKey);
        const targetSquad = targetSquadId ? squadFor(targetSquadId) : null;
        const fieldLeader = targetSquad ? state.units.find(unit => unit.id === targetSquad.leaderId && unit.alive) : null;
        const missing = targetSquad ? Math.max(0, targetSquad.nominalSize - squadMembers(targetSquad.id).length) : fullSpecs.length;
        if (!fullSpecs.length) return [];
        const requestedCount = targetSquad ? Math.min(missing, batchCount ?? missing) : fullSpecs.length;
        const memberSpecs = targetSquad ? missingGuardTemplateSpecs(templateKey, targetSquad, requestedCount) : fullSpecs;
        const minimumReplacementBatch = memberSpecs.some(spec => spec.role === "commander") ? 1 : 2;
        if (!memberSpecs.length || memberSpecs.length !== requestedCount || requestedCount < (targetSquad ? minimumReplacementBatch : fullSpecs.length)) return [];
        const batchId = `guard-batch-${state.time.toFixed(2)}-${state.nextUnitIndex[player.id]}`;
        const newUnits = memberSpecs.map((spec, index) => {
          const unit = makeUnit(player.id, spec.role || "trooper", `${factionBuildingLabel(player.id, "barracks")} squad deployment`);
          unit.name = `${spec.title}${spec.ordinal > 1 ? ` ${spec.ordinal}` : ""}`;
          unit.specialty = spec.title;
          unit.weapon = spec.weapon || unit.weapon;
          unit.attachment = spec.attachment || unit.attachment;
          unit.guardBatchId = batchId;
          unit.reinforcementRendezvous = Boolean(fieldLeader && distance(fieldLeader, barracks) > 56);
          unit.rendezvousTargetSquadId = unit.reinforcementRendezvous ? targetSquad.id : null;
          const angle = index / Math.max(1, memberSpecs.length) * Math.PI * 2;
          const radius = 22 + Math.floor(index / 8) * 10;
          unit.x = clamp(barracks.x + Math.cos(angle) * radius, 24, worldWidth() - 24);
          unit.y = clamp(barracks.y + Math.sin(angle) * radius, 24, worldHeight() - 24);
          if (spec.title?.includes("Veteran")) { unit.experience += 24; unit.accuracy = clamp(unit.accuracy + 0.06, 0, 1); }
          if (templateKey === "veteran") {
            unit.morale = clamp(unit.morale + 0.1, 0, 1);
            unit.courage = clamp(unit.courage + 0.08, 0, 1);
            unit.reflexes = clamp(unit.reflexes + 0.08, 0, 1);
            unit.discipline = clamp(unit.discipline + 0.07, 0, 1);
          }
          if (spec.title?.includes("Conscript")) {
            unit.experience = Math.max(0, unit.experience - 8);
            unit.morale = clamp(unit.morale - 0.12, 0, 1);
            unit.courage = clamp(unit.courage - 0.08, 0, 1);
            unit.discipline = clamp(unit.discipline - 0.12, 0, 1);
            if (spec.title === "Conscript Overseer") unit.commandRank = 2;
          }
          unit.personality = personalityFor(unit);
          return unit;
        });
        const leader = newUnits.find(unit => unit.role === "commander") || newUnits[0];
        const squad = targetSquad || createSquad(player.id, leader, {
          name: `${aiConfig.guardTemplates?.[templateKey]?.label || "Guard Squad"} ${state.nextSquadId}`,
          templateId: `guard-${templateKey}`,
          nominalSize: fullSpecs.length,
          formation: templateKey === "heavy" ? "line" : templateKey === "command" ? "escort" : "triangle",
          reinforcementState: "Full strength"
        });
        for (const unit of newUnits) unit.squadId = squad.id;
        state.units.push(...newUnits);
        const currentLeader = state.units.find(unit => unit.id === squad.leaderId && unit.alive);
        const senior = [...squadMembers(squad.id)].sort((a, b) => b.commandRank - a.commandRank || b.discipline - a.discipline || b.experience - a.experience)[0];
        const rendezvousPending = newUnits.some(unit => unit.reinforcementRendezvous);
        if (!currentLeader || !rendezvousPending && senior && senior.commandRank > currentLeader.commandRank) squad.leaderId = (senior || leader).id;
        const formalLeader = state.units.find(unit => unit.id === squad.leaderId && unit.alive);
        if (formalLeader?.role === "commander" && !rendezvousPending) {
          for (const member of squadMembers(squad.id)) if (member.id !== formalLeader.id) member.temporaryOfficer = false;
          squad.actingLeaderId = null;
          squad.leadershipState = `Officer assigned · ${formalLeader.name}`;
        }
        squad.reinforcementState = rendezvousPending ? `${newUnits.length}-member replacement detachment en route` : targetSquad ? "Replacement detachment arrived" : "Full strength";
        seedSquadRelationships(rendezvousPending ? newUnits : [...squadMembers(squad.id)], rendezvousPending ? leader : state.units.find(unit => unit.id === squad.leaderId));
        incident(targetSquad
          ? `${player.faction} deployed ${newUnits.length} replacements to ${squad.name} as one detachment.`
          : `${player.faction} deployed ${squad.name} atomically with ${newUnits.length} members in ${squad.formation} formation.`, leader.id, "info");
        rebuildUnitSelect();
        return newUnits;
      }

      function productionManifestFor(player, availableSlots) {
        const cycle = player.productionCycle || 0;
        let manifest;
        if (player.faction === "Space Marines") {
          const size = cycle % 3 === 2 ? 10 : 5;
          manifest = [{ name: "Sergeant", role: "commander" }, ...Array.from({ length: size - 1 }, () => ({ name: cycle % 2 ? "Intercessor" : "Tactical Marine", role: "trooper" }))];
        } else if (player.race === "Orks") {
          if (cycle % 6 === 5) manifest = [{ name: "Mekboy", role: "engineer" }];
          else if (cycle % 4 === 3) manifest = [{ name: "Runtherd", role: "commander" }, ...Array.from({ length: 15 }, () => ({ name: "Gretchin", role: "trooper" }))];
          else {
            const kind = cycle % 3 === 1 ? "Shoota Boy" : cycle % 3 === 2 ? "Slugga Boy" : "Boy";
            const count = kind === "Boy" ? 9 : 11;
            manifest = [{ name: "Nob", role: "commander" }, ...Array.from({ length: count - 1 }, () => ({ name: kind, role: "trooper" }))];
          }
        } else if (player.race === "Tyranids") {
          manifest = cycle % 5 === 4 ? [{ name: "Tyranid Prime", role: "commander" }] : cycle % 3 === 2
            ? Array.from({ length: 3 }, () => ({ name: "Tyranid Warrior", role: "trooper" }))
            : Array.from({ length: 10 }, () => ({ name: cycle % 2 ? "Hormagaunt" : "Termagant", role: "trooper" }));
        } else if (player.race === "Necrons") {
          manifest = cycle % 4 === 3 ? [{ name: "Overlord", role: "commander" }] : Array.from({ length: cycle % 3 === 2 ? 5 : 10 }, () => ({ name: cycle % 3 === 2 ? "Immortal" : "Warrior", role: "trooper" }));
        } else if (player.race === "T'au") {
          manifest = cycle % 4 === 3 ? [{ name: "Crisis Battlesuit", role: "trooper" }] : [{ name: "Shas'ui", role: "commander" }, ...Array.from({ length: 9 }, () => ({ name: "Fire Warrior", role: "trooper" }))];
        } else manifest = [{ name: factionUnitName(player, trainingRoles[cycle % trainingRoles.length], cycle), role: trainingRoles[cycle % trainingRoles.length] }];
        return manifest.length <= availableSlots ? manifest : [];
      }

      function spawnProductionGroup(player, barracks, manifest) {
        if (!manifest.length) return [];
        const source = player.race === "Tyranids" ? `Brood gestated beneath the ${factionBuildingLabel(player.id, "barracks")}`
          : player.race === "Orks" ? `Mob mustered at the ${factionBuildingLabel(player.id, "barracks")}`
            : `${factionBuildingLabel(player.id, "barracks")} formation deployment`;
        const units = manifest.map((member, index) => {
          const unit = makeUnit(player.id, member.role, source);
          unit.name = `${member.name} ${unit.index + 1}`;
          unit.specialty = member.name;
          const angle = index / Math.max(1, manifest.length) * Math.PI * 2;
          const ring = 20 + Math.floor(index / 10) * 10;
          unit.x = clamp(barracks.x + Math.cos(angle) * ring, 24, worldWidth() - 24);
          unit.y = clamp(barracks.y + Math.sin(angle) * ring, 24, worldHeight() - 24);
          return unit;
        });
        const leader = units.find(unit => unit.role === "commander") || units[0];
        const template = player.faction === "Space Marines" ? "Astartes combat squad" : player.race === "Orks" ? "Ork mob" : player.race === "Tyranids" ? "Tyranid brood" : player.race === "Necrons" ? "Necron phalanx" : player.race === "T'au" ? "Fire Warrior team" : "formation";
        const squad = createSquad(player.id, leader, { name: `${template} ${state.nextSquadId}`, templateId: `group-${player.race.toLowerCase()}`, nominalSize: units.length, formation: player.race === "Orks" ? "circle" : player.race === "Tyranids" ? "wedge" : "line", reinforcementState: "Full strength" });
        for (const unit of units) unit.squadId = squad.id;
        state.units.push(...units);
        seedSquadRelationships(units, leader);
        player.productionCycle = (player.productionCycle || 0) + 1;
        incident(`${player.faction} deployed ${template} atomically with ${units.length} members.`, leader.id, "info");
        rebuildUnitSelect();
        return units;
      }

      function refreshEconomyRequests(player) {
        const economy = economyFor(player.id);
        const capacity = economyCapacity(player.id);
        economy.shortages = economyResourceKeys.filter(key => (economy.inventory[key] || 0) < (capacity[key] || 1) * 0.16);
        for (const request of economy.queue.filter(item => item.type === "emergency" && !["Delivered", "Denied", "Complete"].includes(item.status))) {
          if (!economy.shortages.includes(request.resource)) request.status = "Complete";
        }
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
        const unitCap = unitCapFor(player);
        if (living < unitCap) {
          if (isImperialGuard(player)) {
            const training = selectGuardTraining(player, unitCap - living);
            const request = economy.queue.find(item => item.key === "train-line" && !["Delivered", "Denied", "Complete"].includes(item.status));
            if (!training) {
              if (request?.lockedAt == null) request.status = "Delayed · atomic Guard detachment does not fit the current population cap";
              else if (request) request.status = "Approved · locked replacement manifest awaiting capacity";
            } else {
              const label = training.targetSquadId ? `Raise replacement detachment for ${squadFor(training.targetSquadId)?.name || "Guard squad"}` : `Raise ${aiConfig.guardTemplates?.[training.templateKey]?.label || "Guard squad"}`;
              if (request && request.lockedAt == null) Object.assign(request, { label, guardTemplateKey: training.templateKey, targetSquadId: training.targetSquadId, memberCount: training.memberCount });
              else addEconomyRequest(player.id, "train-line", "train", label, 76, { guardTemplateKey: training.templateKey, targetSquadId: training.targetSquadId, memberCount: training.memberCount });
            }
          } else addEconomyRequest(player.id, "train-line", "train", "Train line infantry", 70);
        }
        if (player.race === "Imperium" && player.faction === "Space Marines" && living < Math.max(4, unitCap - 1) && shouldUseDropPod(player)) addEconomyRequest(player.id, "drop-pod", "dropPod", "Orbital drop-pod reinforcement", 88);
        economy.emergency = economy.shortages.length
          ? `${economyResourceLabels[economy.shortages[0]]} below 16% · conserve fire and protect routes`
          : "Supply stable · reserves maintained";
        economy.officers.quartermaster = economy.shortages.length ? `Ordering ${economy.shortages.map(key => economyResourceLabels[key]).join(", ")}` : "Maintaining reserve targets";
        economy.officers.supplyOfficer = state.convoys.some(item => item.faction === player.id && item.status === "Awaiting escort") ? "Assigning escort to blocked convoy" : "Rerouting physical deliveries";
        economy.officers.factoryOverseer = economy.shortages.includes("ammunition") ? "Increasing ammunition production" : "Balancing production inputs";
      }

      function dropPodLandingScore(player, point) {
        const terrain = terrainAt(point);
        if (["deepwater", "river", "lava", "cliff", "mountain"].includes(terrain.type)) return null;
        if (structureCollisionAt(point, 16) || environmentCollisionAt(point, { role: "vehicle", collisionRadius: 12, maxHp: 80, strength: 0.5 }, 12)) return null;
        const allies = state.units.filter(unit => unit.alive && areAllies(unit.faction, player.id) && distance(point, unit) < 105);
        const closeAllies = allies.filter(unit => distance(point, unit) < 28);
        if (closeAllies.length > 2) return null;
        const enemies = state.units.filter(unit => unit.alive && !areAllies(unit.faction, player.id) && distance(point, unit) < 170);
        const immediate = enemies.filter(unit => distance(point, unit) < 48);
        const antiAir = state.structures.filter(structure => structure.alive !== false && !areAllies(structure.faction, player.id) && ["turret", "observationtower"].includes(structure.type) && distance(point, structure) < 210).length
          + enemies.filter(unit => unit.role === "vehicle" && distance(point, unit) < 150).length * 0.7;
        const road = nearestRoadSegment(point, 80);
        const hostileStructure = state.structures.find(structure => structure.alive !== false && !areAllies(structure.faction, player.id) && distance(point, structure) < 130);
        const threatenedAlly = allies.filter(unit => unit.hp < unit.maxHp * 0.7 || unit.protectionRequested).length;
        const objective = hostileStructure ? 34 : road ? 22 + (road.road?.supplyImportance || 0) * 18 : 0;
        const reinforcementImpact = Math.min(38, enemies.length * 7 + threatenedAlly * 12);
        const cover = terrain.cover * 42 + environmentalCoverAt(point) * 35;
        const escape = road ? 18 : terrain.speed * 10;
        const scatterRisk = Math.abs(terrain.elevation || 0) * 8 + closeAllies.length * 18;
        const dangerTolerance = player.doctrine === "Aggressive" ? 0.72 : player.doctrine === "Fortress" ? 0.38 : 0.52;
        const impactDanger = immediate.length * 24 * (1 - dangerTolerance * 0.55);
        const score = objective + reinforcementImpact + cover + escape - scatterRisk - antiAir * 24 - impactDanger;
        return { point, score, objective, enemyCount: enemies.length, antiAir, ownership: territoryAt(point)?.owner || "neutral" };
      }

      function bestDropPodLandingZone(player) {
        const candidates = [];
        const addAround = (center, count = 8, radius = 72) => {
          if (!center) return;
          candidates.push({ x: center.x, y: center.y });
          for (let index = 0; index < count; index += 1) {
            const angle = index * Math.PI * 2 / count + player.index * 0.37;
            candidates.push({ x: clamp(center.x + Math.cos(angle) * radius, 30, worldWidth() - 30), y: clamp(center.y + Math.sin(angle) * radius, 30, worldHeight() - 30) });
          }
        };
        addAround(player.base, 6, 70);
        for (const ally of state.units.filter(unit => unit.alive && areAllies(unit.faction, player.id) && (unit.hp < unit.maxHp * 0.72 || unit.role === "commander")).slice(0, 10)) addAround(ally, 6, 64);
        for (const structure of state.structures.filter(structure => structure.alive !== false && !areAllies(structure.faction, player.id)).slice(0, 12)) addAround(structure, 10, 95);
        for (const road of state.roads.slice(0, 12)) addAround(roadMidpoint(road), 8, 78);
        for (const territory of state.territories.filter(item => item.cellBacked)) {
          for (const key of [...(territory.frontierCells || [])].slice(0, 12)) addAround(territoryCellCenter(key), 4, 52);
        }
        const evaluated = candidates.map(point => dropPodLandingScore(player, point)).filter(Boolean).sort((a, b) => b.score - a.score);
        return evaluated[0] || dropPodLandingScore(player, player.base) || { point: { ...player.base }, score: 0, ownership: player.id };
      }

      function shouldUseDropPod(player) {
        const activePod = state.dropPods.some(pod => pod.faction === player.id && !pod.deployed);
        if (activePod) return false;
        const landing = bestDropPodLandingZone(player);
        const distant = distance(player.base, landing.point) > 420;
        const urgent = landing.score > 34;
        const groundRoute = nearestRoadSegment(player.base, 65) && nearestRoadSegment(landing.point, 65);
        return urgent && (distant || !groundRoute || landing.enemyCount >= 2);
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
          const convoy = createConvoy(player.id, costs, closestStoragePoint(player.id, bay), bay, { destinationKind: "structure", destinationId: bay.id, name: `Drop Pod Preparation #${state.nextConvoyId}`, dropPodSupply: true });
          if (!convoy) {
            request.status = "Delayed · convoy capacity unavailable";
            return false;
          }
          Object.entries(costs).forEach(([key, value]) => { economy.inventory[key] -= value; });
          request.status = "Approved · launch materials in transit";
          return false;
        }
        Object.entries(costs).forEach(([key, value]) => { bay.inventory[key] -= value; });
        economy.availablePods -= 1;
        const landing = bestDropPodLandingZone(player);
        const destination = landing.point;
        state.dropPods.push({
          id: `drop-pod-${state.nextDropPodId++}`,
          faction: player.id,
          requestId: request.id,
          stage: "Approved",
          stageIndex: 0,
          stageEndsAt: state.time + 4,
          destination: { x: destination.x, y: destination.y },
          landingScore: Math.round(landing.score),
          landingOwnership: landing.ownership,
          landingThreats: landing.enemyCount || 0,
          antiAirRisk: landing.antiAir || 0,
          x: destination.x,
          y: -40,
          deployed: false
        });
        request.status = `Approved · orbital command scheduling · LZ ${landing.ownership} · score ${Math.round(landing.score)}`;
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
            const origin = closestStoragePoint(player.id, unit);
            const convoy = createConvoy(player.id, { ammunition: ammo, medical, food, fuel }, origin, unit, { destinationKind: "unit", destinationId: unit.id, name: `Frontline Resupply #${state.nextConvoyId}` });
            if (!convoy) { request.status = "Delayed · convoy capacity unavailable"; continue; }
            economy.inventory.ammunition -= ammo;
            economy.inventory.medical -= medical;
            economy.inventory.food -= food;
            economy.inventory.fuel -= fuel;
            request.status = ammo < 8 ? "Partially fulfilled · convoy en route" : "Approved · convoy en route";
          } else if (request.type === "emergency") {
            request.status = state.convoys.some(item => item.faction === player.id && item.cargo[request.resource]) ? "Approved · convoy protected" : "Delayed · production increasing";
          } else if (request.type === "repair") {
            const target = state.structures.find(item => item.id === request.targetId && item.alive !== false);
            if (!target || target.condition >= 0.9) request.status = target ? "Complete" : "Denied";
            else request.status = economy.inventory.parts >= 4 ? "Approved · engineer assigned" : "Delayed · spare parts unavailable";
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
            const trainingCargo = isImperialGuard(player)
              ? guardTrainingCost(request.guardTemplateKey || "standard", request.memberCount)
              : { requisition: 15, food: 3, ammunition: 4, medical: 1 };
            if (!barracks) { request.status = "Delayed · barracks unavailable"; continue; }
            const ready = Object.entries(trainingCargo).every(([key, value]) => (barracks.inventory[key] || 0) >= value);
            if (ready) { request.status = "Approved · squad preparing"; continue; }
            if (state.convoys.some(item => !item.finished && item.trainingRequestId === request.id)) { request.status = "Approved · training supplies en route"; continue; }
            const canShip = Object.entries(trainingCargo).every(([key, value]) => (economy.inventory[key] || 0) >= value);
            if (!canShip) { request.status = "Delayed · supplies unavailable"; continue; }
            const convoy = createConvoy(player.id, trainingCargo, closestStoragePoint(player.id, barracks), barracks, {
              destinationKind: "structure", destinationId: barracks.id, name: `Barracks Supply #${state.nextConvoyId}`,
              training: true, trainingRequestId: request.id
            });
            if (!convoy) { request.status = "Delayed · convoy capacity unavailable"; continue; }
            Object.entries(trainingCargo).forEach(([key, value]) => { economy.inventory[key] -= value; });
            request.lockedAt = state.time;
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
            const origin = closestStoragePoint(player.id, structure);
            const convoy = createConvoy(player.id, needed, origin, structure, { destinationKind: "structure", destinationId: structure.id, name: `Input Delivery #${state.nextConvoyId}` });
            if (convoy) Object.entries(needed).forEach(([key, value]) => { economy.inventory[key] -= value; });
          }
        }
        const resourceNode = resourceNodeForStructure(structure);
        const nodeDistance = resourceNode ? distance(structure, resourceNode) : Infinity;
        const reserveRatio = resourceNode ? resourceNode.reserve / Math.max(1, resourceNode.maxReserve) : 0;
        const depletionFactor = !extractorResourceType[structure.type] ? 1
          : nodeDistance > 120 ? 0.18
            : reserveRatio > 0.75 ? 1 : reserveRatio > 0.45 ? 0.76 : reserveRatio > 0.2 ? 0.48 : reserveRatio > 0 ? 0.24 : 0;
        structure.resourceNodeId = resourceNode?.id || null;
        structure.depositStatus = !extractorResourceType[structure.type] ? "Not an extractor"
          : !resourceNode || nodeDistance > 120 ? "Off-deposit · 18% local yield"
            : reserveRatio <= 0 ? "Deposit exhausted" : `${Math.round(reserveRatio * 100)}% deposit remaining`;
        const canRun = depletionFactor > 0 && Object.entries(consumes).every(([key, rate]) => (structure.inventory[key] || 0) >= rate);
        if (canRun) {
          Object.entries(consumes).forEach(([key, rate]) => { structure.inventory[key] = Math.max(0, (structure.inventory[key] || 0) - rate); });
          Object.entries(spec.produces || {}).forEach(([key, rate]) => { structure.inventory[key] = (structure.inventory[key] || 0) + rate * clamp(structure.condition, 0.2, 1) * depletionFactor; });
          if (resourceNode && nodeDistance <= 120 && extractorResourceType[structure.type]) {
            const drain = Object.values(spec.produces || {}).reduce((sum, value) => sum + value, 0) * 0.55;
            resourceNode.reserve = Math.max(0, resourceNode.reserve - drain);
            resourceNode.condition = clamp(resourceNode.reserve / Math.max(1, resourceNode.maxReserve), 0.12, 1);
            if (resourceNode.reserve <= 0 && !resourceNode.exhaustionReported) {
              resourceNode.exhaustionReported = true;
              incident(`${player.faction} exhausted a ${resourceNode.resourceType} deposit and must expand its supply network.`, structure.id, "warning");
            }
          }
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
          const destination = closestStoragePoint(player.id, structure);
          if (destination.id === structure.id || distance(destination, structure) < 3) {
            Object.keys(output).forEach(key => { structure.inventory[key] -= output[key]; });
            const capacity = economyCapacity(player.id);
            Object.entries(output).forEach(([key, value]) => { economy.inventory[key] = clamp((economy.inventory[key] || 0) + value, 0, capacity[key] || 999); });
          } else {
            const convoy = createConvoy(player.id, output, structure, destination, { destinationKind: "store", name: `Production Haul #${state.nextConvoyId}`, originId: structure.id });
            if (convoy) Object.keys(output).forEach(key => { structure.inventory[key] -= output[key]; });
          }
        }
      }

      function updateUnitConsumption(player) {
        const economy = economyFor(player.id);
        const needsFood = !["Necrons", "Tyranids"].includes(player.race);
        const army = state.units.filter(item => item.alive && item.faction === player.id && !item.incapacitated);
        const controlledCells = primaryTerritoryFor(player.id)?.controlledCells?.size || 1;
        const operationalStructures = state.structures.filter(item => item.faction === player.id && item.alive !== false && item.progress >= 1);
        const supportCapacity = 7 + controlledCells * 0.65 + operationalStructures.filter(item => ["outpost", "warehouse", "farm", "mine", "refinery"].includes(item.type)).length * 2.5;
        const pressure = clamp((army.length - supportCapacity) / Math.max(1, supportCapacity), 0, 2.5);
        const upkeep = 1 + pressure * 1.8;
        economy.territoryPressure = pressure;
        economy.supportCapacity = supportCapacity;
        economy.operationalDepth = {
          logisticsReach: controlledCells,
          defendableForces: Math.floor(supportCapacity),
          reinforcementRoutes: state.roads.filter(road => areAllies(road.controllerFaction || road.faction, player.id) && road.condition > 0.35).length,
          strategicNodes: state.features.filter(feature => feature.resourceNode && feature.strategicObjective && territoryAt(feature)?.owner === player.id).length
        };
        for (const unit of state.units.filter(item => item.alive && item.faction === player.id)) {
          unit.rations ??= 6;
          unit.medicalReserve ??= 2;
          unit.fuelReserve ??= unit.role === "vehicle" ? 12 : 0;
          if (needsFood) unit.rations = Math.max(0, unit.rations - 0.28 * upkeep);
          if (unit.role === "vehicle" && ["Advancing", "Closing", "Retreating"].includes(unit.status)) unit.fuelReserve = Math.max(0, unit.fuelReserve - 0.45 * upkeep);
          if (pressure > 0.4 && unit.ammo > 0) unit.ammo = Math.max(0, unit.ammo - pressure * 0.12);
          if (unit.rations < 1.2 || unit.role === "vehicle" && unit.fuelReserve < 2 || unit.ammo < unit.maxAmmo * 0.18) requestUnitResupply(unit);
          if (unit.rations <= 0) unit.morale = clamp(unit.morale - 0.035, 0.12, 1);
          if (pressure > 0.65) unit.morale = clamp(unit.morale - 0.012 * pressure, 0.08, 1);
          if (unit.role === "vehicle" && unit.fuelReserve <= 0) unit.fatigue = clamp(unit.fatigue + 0.08, 0, 0.96);
        }
      }

      function dispatchTradeConvoys(player) {
        const partner = state.tradePartners.find(item => item.faction === player.id);
        if (!partner?.established || state.time < partner.nextDispatch || state.convoys.some(item => !item.finished && item.trade && item.faction === player.id)) return;
        const destination = closestStoragePoint(player.id, partner);
        const convoy = createConvoy(player.id, partner.exports, partner, destination, { trade: true, name: `${partner.name} Trade #${state.nextConvoyId}` });
        partner.nextDispatch = state.time + (convoy ? 46 + player.index * 2 : 6);
      }

      function economyTick() {
        for (const player of state.players) {
          const unitCap = unitCapFor(player);
          const economy = economyFor(player.id);
          refreshEconomyRequests(player);
          processEconomyRequests(player);
          for (const structure of state.structures.filter(item => item.faction === player.id)) dispatchStructureLogistics(player, structure);
          updateUnitConsumption(player);
          dispatchTradeConvoys(player);
          const barracks = state.structures.find(item => item.faction === player.id && item.type === "barracks" && item.progress >= 1 && item.alive !== false);
          const living = state.units.filter(unit => unit.alive && unit.faction === player.id).length;
          let trainingRequest = economy.queue.find(item => item.key === "train-line" && !["Delivered", "Denied", "Complete"].includes(item.status));
          if (trainingRequest?.targetSquadId && !squadFor(trainingRequest.targetSquadId)) {
            trainingRequest.status = "Denied";
            trainingRequest.cancelledReason = "Replacement target merged or disbanded";
            trainingRequest = null;
          }
          const guardPlayer = isImperialGuard(player);
          let guardTraining = guardPlayer
            ? trainingRequest
              ? { templateKey: trainingRequest.guardTemplateKey || "standard", targetSquadId: trainingRequest.targetSquadId || null, memberCount: trainingRequest.memberCount ?? null }
              : selectGuardTraining(player, unitCap - living)
            : null;
          let guardBatchSize = guardTraining
            ? guardTraining.targetSquadId
              ? Math.min(
                Math.max(0, squadFor(guardTraining.targetSquadId)?.nominalSize - squadMembers(guardTraining.targetSquadId).length),
                guardTraining.memberCount ?? Infinity
              )
              : expandedGuardTemplate(guardTraining.templateKey).length
            : 1;
          if (guardTraining?.targetSquadId && guardBatchSize <= 0) {
            if (trainingRequest) trainingRequest.status = "Complete";
            guardTraining = null;
          } else if (guardTraining?.targetSquadId && guardBatchSize === 1) {
            const targetSquad = squadFor(guardTraining.targetSquadId);
            const loneSpec = targetSquad ? missingGuardTemplateSpecs(guardTraining.templateKey, targetSquad, 1)[0] : null;
            if (loneSpec?.role !== "commander") {
              if (trainingRequest) {
                trainingRequest.status = "Denied";
                trainingRequest.cancelledReason = "Guard replacements deploy in detachments; a lone non-command vacancy remains open";
              }
              guardTraining = null;
            }
          }
          const groupManifest = guardPlayer ? [] : productionManifestFor(player, unitCap - living);
          if (!guardTraining) guardBatchSize = guardPlayer ? 0 : groupManifest.length;
          const trainCost = guardTraining ? guardTrainingCost(guardTraining.templateKey, guardBatchSize) : { requisition: 15, food: 3, ammunition: 4, medical: 1 };
          const canTrain = barracks && Object.entries(trainCost).every(([key, value]) => (barracks.inventory[key] || 0) >= value);
          const batchFits = living + guardBatchSize <= unitCap;
          if (barracks && living < unitCap && canTrain && batchFits && (!guardPlayer || guardTraining) && state.time >= state.nextTrain[player.id]) {
            let trainingSucceeded = false;
            if (guardTraining) {
              const spawned = spawnGuardSquad(player, barracks, guardTraining.templateKey, guardTraining.targetSquadId, guardBatchSize);
              trainingSucceeded = spawned.length === guardBatchSize;
              if (!trainingSucceeded && trainingRequest) trainingRequest.status = "Delayed · replacement manifest could not deploy atomically";
            } else trainingSucceeded = spawnProductionGroup(player, barracks, groupManifest).length === groupManifest.length && groupManifest.length > 0;
            if (trainingSucceeded) {
              Object.entries(trainCost).forEach(([key, value]) => { barracks.inventory[key] -= value; });
              const hasSupply = insideSupplyRadius(barracks, player.id);
              state.nextTrain[player.id] = state.time + (guardTraining ? 18 + guardBatchSize * 1.2 : 10 + guardBatchSize * 0.9) + (hasSupply ? 0 : 6);
              if (trainingRequest) trainingRequest.status = "Complete";
            }
          } else if (trainingRequest && guardTraining && !batchFits) {
            trainingRequest.status = `Delayed · full ${guardBatchSize}-member detachment exceeds population cap`;
          }
          if ((economy.availablePods || 0) < 2 && economy.inventory.parts >= 8 && economy.inventory.materials >= 6 && state.structures.some(item => item.faction === player.id && item.type === "dropbay" && item.alive !== false)) {
            economy.inventory.parts -= 8;
            economy.inventory.materials -= 6;
            economy.availablePods = (economy.availablePods || 0) + 1;
          }
          if (isImperialGuard(player)) manageGuardSquads(player);
          else autoFormSquads(player.id);
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
          if (!destination) {
            const request = convoy.trainingRequestId ? economyFor(convoy.faction).queue.find(item => item.id === convoy.trainingRequestId) : null;
            if (request) {
              request.lockedAt = null;
              request.status = "Delayed · barracks lost; training cargo returning to storage";
            }
            const returnPoint = closestStoragePoint(convoy.faction, convoy);
            convoy.destinationKind = "store";
            convoy.destinationId = null;
            convoy.destination = { x: returnPoint.x, y: returnPoint.y };
            convoy.route = routeForLogistics(convoy, returnPoint, convoy.faction, state.nextConvoyId + convoy.reroutes * 31);
            convoy.waypoint = 1;
            convoy.status = "Destination lost · returning cargo";
            continue;
          }
          convoy.destination = { x: destination.x, y: destination.y };
          const waypoint = convoy.route[convoy.waypoint] || destination;
          const localActors = nearbyCombatObjects(convoy, 76).units;
          const hostile = localActors.filter(unit => {
            const squad = squadFor(unit.squadId);
            return unit.alive && !areAllies(unit.faction, convoy.faction) && distance(unit, convoy) < 24
              && !(squad?.orderType === "Ambush Route" && squad.ambushPhase !== "engage");
          });
          const ambushers = localActors.filter(unit => {
            const squad = squadFor(unit.squadId);
            return unit.alive && !areAllies(unit.faction, convoy.faction) && squad?.orderType === "Ambush Route" && squad.ambushPhase === "engage"
              && (!convoy.activeSegmentId || squad.routeSegmentId === convoy.activeSegmentId || distance(unit, convoy) < 64);
          });
          const escorts = localActors.filter(unit => unit.alive && areAllies(unit.faction, convoy.faction) && distance(unit, convoy) < 38
            && (unit.protectTargetId === convoy.id || unit.squadId === convoy.escortSquadId || unit.squadId === convoy.assignedEscortSquadId)).length;
          convoy.escorts = escorts;
          const attackerIds = new Set([...hostile, ...ambushers].map(unit => unit.id));
          if (attackerIds.size) {
            const attackPressure = hostile.length * 2.2 + ambushers.filter(unit => !hostile.some(other => other.id === unit.id)).length * 3.2;
            convoy.hp -= dt * Math.max(2, attackPressure) / Math.max(1, escorts + 1);
            if (!escorts) {
              convoy.status = ambushers.length ? `Ambushed · ${ambushers.length} attackers` : "Awaiting escort";
              convoy.escortRequested = true;
            } else convoy.status = ambushers.length ? `Ambushed · ${escorts} escort` : `Under attack · ${escorts} escort`;
          } else if (convoy.status === "Awaiting escort" && escorts) convoy.status = "Escort arrived · continuing";
          if (convoy.hp <= 0) {
            convoy.finished = true;
            convoy.status = "Destroyed";
            convoy.finishedAt = state.time;
            const wreckedRoad = nearestRoadSegment(convoy, 34);
            if (wreckedRoad) {
              wreckedRoad.segment.condition = clamp(wreckedRoad.segment.condition - 0.24, 0, 1);
              wreckedRoad.segment.operationalFlags = [...new Set([...(wreckedRoad.segment.operationalFlags || []), "wreck", "damaged"])]
            }
            incident(`${convoy.name} was destroyed; remaining cargo lost on the route.`, null, "critical");
            continue;
          }
          const terrainType = terrainAt(waypoint).type;
          if (["deepwater", "lava", "cliff"].includes(terrainType) && convoy.mode !== "cargo aircraft") {
            convoy.reroutes += 1;
            convoy.status = convoy.reroutes >= 2 ? "Road unavailable · cargo aircraft requested" : "Route blocked · rerouting";
            if (convoy.reroutes >= 2) convoy.mode = "cargo aircraft";
            convoy.route = routeForLogistics(convoy, destination, convoy.faction, state.nextConvoyId + convoy.reroutes * 19);
            convoy.waypoint = 1;
            continue;
          }
          const dx = waypoint.x - convoy.x;
          const dy = waypoint.y - convoy.y;
          const d = Math.hypot(dx, dy) || 1;
          const activeRoad = nearestRoadSegment(convoy, 24);
          convoy.activeSegmentId = activeRoad && activeRoad.distance <= (activeRoad.segment.width || 7) + 5 ? activeRoad.segment.id : null;
          const activeFlags = activeRoad?.segment?.operationalFlags || [];
          if (convoy.mode !== "cargo aircraft" && activeRoad && activeFlags.includes("mined") && activeRoad.segment.mineFaction && !areAllies(activeRoad.segment.mineFaction, convoy.faction)) {
            convoy.triggeredMines ||= [];
            if (!convoy.triggeredMines.includes(activeRoad.segment.id)) {
              convoy.triggeredMines.push(activeRoad.segment.id);
              convoy.hp -= 28;
              activeRoad.segment.condition = clamp(activeRoad.segment.condition - 0.14, 0, 1);
              activeRoad.segment.operationalFlags = [...new Set(activeFlags.filter(flag => flag !== "mined").concat("wreck", "damaged"))];
              activeRoad.segment.mineFaction = null;
              convoy.status = "Mine strike · route damaged";
              convoy.escortRequested = true;
              incident(`${convoy.name} struck an enemy mine on ${activeRoad.road.name || activeRoad.road.id}.`, null, "critical");
            }
          }
          if (convoy.mode !== "cargo aircraft" && activeRoad && state.time >= (convoy.blockedRerouteUntil || 0)
            && (activeRoad.segment.status === "Blocked" || activeFlags.some(flag => ["blocked", "collapsed", "cratered", "roadblock"].includes(flag)))) {
            convoy.reroutes += 1;
            convoy.status = convoy.reroutes >= 2 ? "Road unavailable · cargo aircraft requested" : "Blocked segment · rerouting";
            if (convoy.reroutes >= 2) convoy.mode = "cargo aircraft";
            convoy.route = routeForLogistics(convoy, destination, convoy.faction, state.nextConvoyId + convoy.reroutes * 29);
            convoy.waypoint = 1;
            convoy.blockedRerouteUntil = state.time + 4;
            continue;
          }
          const roadSpeed = activeRoad ? clamp((activeRoad.segment.condition ?? 0.2) * 1.1 + 0.28 - (activeRoad.segment.traffic || 0) / Math.max(1, activeRoad.segment.capacity) * 0.18, 0.28, 1.35) : 0.72;
          const speed = convoy.mode === "cargo aircraft" ? 34 : 13 * roadSpeed;
          const hold = convoy.status === "Awaiting escort" ? 0.24 : 1;
          convoy.x += dx / d * speed * hold * dt;
          convoy.y += dy / d * speed * hold * dt;
          if (d < 7) convoy.waypoint += 1;
          if (distance(convoy, destination) < 9) deliverConvoy(convoy);
          else if (convoy.waypoint >= convoy.route.length) {
            convoy.route = routeForLogistics(convoy, destination, convoy.faction, state.nextConvoyId + convoy.reroutes * 23);
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
          if (pod.stage === "Launched") incident(`${playerFor(pod.faction).faction} drop pod launched toward a ${pod.landingOwnership || "neutral"} landing zone (score ${pod.landingScore ?? 0}, ${pod.landingThreats || 0} nearby threats).`, null, "info");
          if (pod.stage === "Impact") { pod.x = pod.destination.x; pod.y = pod.destination.y; }
          if (pod.stage === "Deployed") {
            pod.deployed = true;
            for (const [index, role] of ["commander", "trooper", "medic"].entries()) {
              const unit = makeUnit(pod.faction, role, "Orbital drop pod");
              const angle = index * Math.PI * 2 / 3;
              let landingPoint = { x: pod.destination.x + Math.cos(angle) * 14, y: pod.destination.y + Math.sin(angle) * 14 };
              for (let attempt = 0; attempt < 10; attempt += 1) {
                const candidate = { x: clamp(pod.destination.x + Math.cos(angle + attempt * 0.63) * (14 + attempt * 3), 24, worldWidth() - 24), y: clamp(pod.destination.y + Math.sin(angle + attempt * 0.63) * (14 + attempt * 3), 24, worldHeight() - 24) };
                if (!structureCollisionAt(candidate, unit.collisionRadius) && !environmentCollisionAt(candidate, unit, unit.collisionRadius)) { landingPoint = candidate; break; }
              }
              unit.x = landingPoint.x;
              unit.y = landingPoint.y;
              state.units.push(unit);
            }
            const request = economyFor(pod.faction).queue.find(item => item.id === pod.requestId);
            if (request) request.status = "Delivered";
            incident(`${playerFor(pod.faction).faction} drop pod impacted; three Marines deployed.`, null, "info");
            rebuildUnitSelect();
          }
        }
      }

      function primaryTerritoryFor(faction) {
        return state.territories.find(territory => territory.cellBacked && territory.owner === faction) || null;
      }

      function neighboringTerritoryCells(key) {
        const { x, y } = territoryCellCoordinates(key);
        const neighbors = [];
        const maxX = Math.ceil(worldWidth() / TERRITORY_CELL_SIZE) - 1;
        const maxY = Math.ceil(worldHeight() / TERRITORY_CELL_SIZE) - 1;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (x + dx >= 0 && x + dx <= maxX && y + dy >= 0 && y + dy <= maxY) neighbors.push(`${x + dx},${y + dy}`);
        }
        return neighbors;
      }

      function territoryOwnerForCell(key) {
        return state.territories.find(territory => territory.cellBacked && territory.claimedCells?.has(key)) || null;
      }

      function transferTerritoryCell(key, faction, reason) {
        const target = primaryTerritoryFor(faction);
        if (!target) return false;
        const previous = territoryOwnerForCell(key);
        if (previous?.owner === faction) return false;
        if (previous) {
          previous.claimedCells.delete(key);
          previous.controlledCells.delete(key);
          previous.influencedCells.delete(key);
          previous.contestedCells.delete(key);
          previous.disconnectedCells.delete(key);
          previous.cellPressure.delete(key);
          syncTerritoryPoints(previous);
        }
        target.claimedCells.add(key);
        target.influencedCells.add(key);
        target.claimedAt = state.time;
        target.reason = reason;
        syncTerritoryPoints(target);
        state.minimapMarkerDirty = true;
        return true;
      }

      function rebuildTerritoryTopology(territory) {
        territory.frontierCells = new Set();
        territory.controlledCells = new Set();
        territory.influencedCells = new Set(territory.claimedCells);
        territory.contestedCells ||= new Set();
        territory.disconnectedCells = new Set();
        territory.disconnectedSince ||= new Map();
        const owner = territory.owner;
        const base = baseFor(owner);
        const supplyStructures = state.structures.filter(structure => structure.alive !== false && structure.progress >= 1
          && areAllies(structure.faction, owner) && (buildingCatalog[structure.type]?.supplyRadius || 0) > 0);
        for (const key of territory.claimedCells) {
          const center = territoryCellCenter(key);
          const supplied = distance(center, base) <= 235 || supplyStructures.some(structure => distance(center, structure) <= (buildingCatalog[structure.type]?.supplyRadius || 0) + TERRITORY_CELL_SIZE * 0.7);
          const defended = state.units.some(unit => unit.alive && areAllies(unit.faction, owner) && territoryCellKey(unit.x, unit.y) === key && unit.role !== "scout");
          if (supplied || defended) territory.controlledCells.add(key);
          if (neighboringTerritoryCells(key).some(neighbor => !territory.claimedCells.has(neighbor))) territory.frontierCells.add(key);
        }
        const start = territory.claimedCells.has(territoryCellKey(base.x, base.y))
          ? territoryCellKey(base.x, base.y)
          : [...territory.claimedCells].sort((a, b) => distance(territoryCellCenter(a), base) - distance(territoryCellCenter(b), base))[0];
        const connected = new Set(start ? [start] : []);
        const queue = start ? [start] : [];
        while (queue.length) {
          const key = queue.shift();
          for (const neighbor of neighboringTerritoryCells(key)) {
            if (!territory.claimedCells.has(neighbor) || connected.has(neighbor)) continue;
            connected.add(neighbor);
            queue.push(neighbor);
          }
        }
        for (const key of territory.claimedCells) {
          if (connected.has(key)) {
            territory.disconnectedSince.delete(key);
            continue;
          }
          territory.disconnectedCells.add(key);
          if (!territory.disconnectedSince.has(key)) territory.disconnectedSince.set(key, state.time);
        }
        territory.connected = territory.disconnectedCells.size === 0;
      }

      function territoryExpansionDecision(player, territory) {
        if (!territory.frontierCells.size) return null;
        const candidates = new Set();
        for (const frontier of territory.frontierCells) {
          for (const neighbor of neighboringTerritoryCells(frontier)) if (!territory.claimedCells.has(neighbor)) candidates.add(neighbor);
          if (candidates.size >= 96) break;
        }
        const race = player.race;
        const ecology = state.factionEcology?.[player.id] || {};
        const options = [];
        for (const key of candidates) {
          const point = territoryCellCenter(key);
          const terrain = terrainAt(point);
          if (["deepwater", "lava", "cliff", "mountain"].includes(terrain.type)) continue;
          const road = nearestRoadSegment(point, TERRITORY_CELL_SIZE * 0.78);
          const resourceNodes = state.features.filter(feature => feature.resourceNode && feature.reserve > 0 && distance(point, feature) < TERRITORY_CELL_SIZE * 0.9);
          const localStructures = state.structures.filter(structure => structure.alive !== false && distance(point, structure) < TERRITORY_CELL_SIZE * 0.8);
          const friendly = state.units.filter(unit => unit.alive && unit.faction === player.id && distance(point, unit) < TERRITORY_CELL_SIZE * 1.2);
          const hostile = state.units.filter(unit => unit.alive && !areAllies(unit.faction, player.id) && distance(point, unit) < TERRITORY_CELL_SIZE * 1.4);
          const objective = localStructures.some(structure => structure.faction === player.id) ? 34 : localStructures.length ? 26 : 0;
          const routeValue = road ? 28 + (road.road?.supplyImportance || 0) * 28 : 0;
          const resources = resourceNodes.length
            ? resourceNodes.reduce((sum, node) => sum + 34 * node.richness + (node.strategicObjective ? 24 : 0), 0)
            : ["rock", "boulders", "crystal", "forestfloor"].includes(terrain.type) ? 22 : terrain.type === "road" ? 16 : 8;
          const defensibility = terrain.cover * 55 + Math.max(0, terrain.elevation || 0) * 5;
          const connection = neighboringTerritoryCells(key).filter(neighbor => territory.claimedCells.has(neighbor)).length * 18;
          const threat = hostile.reduce((sum, unit) => sum + (unit.role === "vehicle" ? 2.4 : unit.role === "commander" ? 1.7 : 1), 0) * 18;
          const maintenance = territory.claimedCells.size * 0.38 + distance(point, player.base) / 210;
          let reason = null;
          let culture = 0;
          if (road) reason = "Secure a road and supply route";
          if (resourceNodes.length) reason = `Secure a ${resourceNodes[0].resourceType} deposit`;
          if (localStructures.length) reason = "Protect or capture a strategic node";
          if (distance(point, player.base) < 250) reason = "Protect the primary base";
          if (race === "Orks" && (friendly.length >= 2 || hostile.length)) {
            reason = hostile.length ? "Spread toward a good fight" : "Expand the camp around mob activity";
            culture += friendly.length * 7 + (ecology.waaaghMomentum || 0) * 22;
          }
          if (race === "Tyranids") {
            const synapse = state.units.some(unit => unit.alive && unit.faction === player.id && unit.synapse && distance(point, unit) < 190)
              || state.structures.some(structure => structure.alive !== false && structure.faction === player.id && ["outpost", "fieldhospital", "mine"].includes(structure.type) && distance(point, structure) < 190);
            if (synapse) {
              reason = localStructures.some(structure => !areAllies(structure.faction, player.id)) ? "Infest strategic biomass" : "Extend synaptic infestation";
              culture += 26 + Math.min(22, (ecology.biomass || 0) * 0.12);
            }
          }
          if (race === "Imperium" && player.faction === "Imperial Guard") {
            reason ||= road ? "Extend a road-bound frontline" : friendly.length >= 2 ? "Broaden the connected frontline" : null;
            culture += connection * 0.22;
          }
          if (race === "Imperium" && player.faction === "Space Marines") {
            const threatenedAlly = friendly.some(unit => unit.hp < unit.maxHp * 0.65) && hostile.length;
            if (threatenedAlly) reason = "Fortify a threatened allied position";
            if (!reason || (!road && !objective && !resourceNodes.length && !threatenedAlly)) continue;
            culture -= 20;
          }
          if (!reason && player.doctrine === "Expansion" && resources >= 20) reason = "Reach valuable resources";
          if (!reason && connection >= 36 && territory.disconnectedCells.size) reason = "Reconnect isolated territory";
          if (!reason) continue;
          const value = resources + objective + routeValue + defensibility + connection + culture - threat - maintenance;
          options.push({ key, point, reason, value, hostilePower: hostile.length, friendlyPower: friendly.length });
        }
        const threshold = player.faction === "Space Marines" ? 68 : player.race === "Tyranids" ? 48 : player.race === "Orks" ? 42 : player.doctrine === "Fortress" ? 58 : 50;
        return options.sort((a, b) => b.value - a.value).find(option => option.value >= threshold) || null;
      }

      function territoryTick() {
        const occupantsByCell = new Map();
        for (const unit of state.units) {
          if (!unit.alive) continue;
          const key = territoryCellKey(unit.x, unit.y);
          if (!occupantsByCell.has(key)) occupantsByCell.set(key, new Map());
          const groups = occupantsByCell.get(key);
          const power = unit.role === "vehicle" ? 3 : unit.role === "commander" ? 2 : unit.role === "builder" ? 0.35 : 1;
          groups.set(unit.faction, (groups.get(unit.faction) || 0) + power);
        }
        let changed = false;
        for (const territory of state.territories.filter(item => item.cellBacked && item.owner)) {
          rebuildTerritoryTopology(territory);
          territory.contestedCells = new Set();
          for (const key of [...territory.claimedCells]) {
            const groups = occupantsByCell.get(key) || new Map();
            const ownerPower = groups.get(territory.owner) || 0;
            const hostile = [...groups.entries()].filter(([faction]) => !areAllies(faction, territory.owner)).sort((a, b) => b[1] - a[1])[0];
            if (hostile && hostile[1] > 0) {
              territory.contestedCells.add(key);
              const pressure = Math.max(0, (territory.cellPressure.get(key) || 0) + hostile[1] * 4 - ownerPower * 3);
              territory.cellPressure.set(key, pressure);
              const claimantTerritory = primaryTerritoryFor(hostile[0]);
              const connectedAttack = claimantTerritory && neighboringTerritoryCells(key).some(neighbor => claimantTerritory.claimedCells.has(neighbor));
              if (hostile[1] >= 2 && hostile[1] > ownerPower && (connectedAttack || playerFor(hostile[0]).doctrine === "Aggressive") && pressure >= territory.captureDifficulty) {
                changed = transferTerritoryCell(key, hostile[0], `Captured from ${playerFor(territory.owner).faction}`) || changed;
                incident(`${playerFor(hostile[0]).faction} captured a cell from ${playerFor(territory.owner).faction}.`, null, "critical");
              }
            } else territory.cellPressure.set(key, Math.max(0, (territory.cellPressure.get(key) || 0) - 8));
          }
          for (const key of [...territory.disconnectedCells]) {
            const isolatedFor = state.time - (territory.disconnectedSince.get(key) || state.time);
            const defended = (occupantsByCell.get(key)?.get(territory.owner) || 0) >= 1;
            const fortified = state.structures.some(structure => structure.alive !== false && structure.faction === territory.owner && territoryCellKey(structure.x, structure.y) === key);
            if (territory.canAbandon && !territory.locked && isolatedFor > 42 && !defended && !fortified) {
              territory.claimedCells.delete(key);
              territory.disconnectedSince.delete(key);
              territory.reason = "Abandoned an indefensible disconnected cell";
              changed = true;
            }
          }
          territory.status = territory.contestedCells.size ? `contested · ${territory.contestedCells.size} cells`
            : territory.disconnectedCells.size ? `isolated · ${territory.disconnectedCells.size} cells`
              : territory.controlledCells.size === territory.claimedCells.size ? "controlled" : "influenced frontier";
          territory.connected = territory.disconnectedCells.size === 0;
        }

        for (const player of state.players) {
          const territory = primaryTerritoryFor(player.id);
          if (!territory) continue;
          for (const outpost of state.structures.filter(structure => structure.faction === player.id && structure.type === "outpost" && structure.progress >= 1 && structure.alive !== false)) {
            const key = territoryCellKey(outpost.x, outpost.y);
            if (!territory.claimedCells.has(key)) changed = transferTerritoryCell(key, player.id, "A completed command node secured this cell") || changed;
            territory.controlledCells.add(key);
          }
          rebuildTerritoryTopology(territory);
          const cooldown = player.faction === "Space Marines" ? 30 : player.race === "Tyranids" ? 12 : player.race === "Orks" ? 10 : player.doctrine === "Aggressive" ? 14 : player.doctrine === "Fortress" ? 28 : 20;
          if (state.time - (player.lastTerritoryClaim || 0) < cooldown) continue;
          const decision = territoryExpansionDecision(player, territory);
          if (!decision) continue;
          const previous = territoryOwnerForCell(decision.key);
          if (previous && previous.owner !== player.id && (decision.friendlyPower < 2 || decision.friendlyPower <= decision.hostilePower)) continue;
          if (transferTerritoryCell(decision.key, player.id, decision.reason)) {
            player.lastTerritoryClaim = state.time;
            territory.lastExpansionValue = Math.round(decision.value);
            territory.lastExpansionReason = decision.reason;
            economyFor(player.id).inventory.influence = Math.max(0, (economyFor(player.id).inventory.influence || 0) - 1);
            incident(`${player.faction} expanded its primary territory: ${decision.reason.toLowerCase()} (value ${Math.round(decision.value)}).`, null, "info");
            changed = true;
          }
        }
        if (changed) {
          for (const territory of state.territories.filter(item => item.cellBacked)) syncTerritoryPoints(territory);
          state.minimapMarkerDirty = true;
          rebuildTerritorySelect();
        }
        root.dataset.territoryObjects = String(state.territories.filter(item => item.cellBacked).length);
        root.dataset.territoryCells = String(state.territories.reduce((sum, territory) => sum + (territory.claimedCells?.size || 0), 0));
      }

      function updateTerritoryControl() {
        // Kept as a compatibility entry point for older saves/tools. Runtime control now mutates
        // the single cell-backed primary territory instead of appending frontier polygons.
        return territoryTick();
        /* legacy polygon implementation retained below for save migration reference only
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
        if (changed) rebuildTerritorySelect(); */
      }

      function updateEnvironment(dt) {
        for (const feature of state.features) {
          if (feature.deleted) continue;
          ensureFeatureCollision(feature);
          feature.age = (feature.age || 0) + dt;
          if (feature.type === "mud") feature.condition = clamp((feature.condition ?? 1) - dt * 0.00035, 0.25, 1);
          if (feature.type === "snow") feature.condition = clamp((feature.condition ?? 1) - dt * 0.00022, 0.35, 1);
          if (feature.type === "grass") feature.condition = clamp((feature.condition ?? 0.7) + dt * 0.00014, 0, 1);
          if (feature.environmentObstacle && (feature.collisionState !== "standing" || feature.collisionProfile?.family === "heavy-debris")) syncObstacleRoadImpact(feature);
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
            const min = Math.max(5, (a.collisionRadius || (a.role === "vehicle" ? 14 : 3)) + (b.collisionRadius || (b.role === "vehicle" ? 14 : 3)));
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

      function evaluateStrategicOutcomes() {
        const capabilities = new Map();
        for (const player of state.players) {
          const economy = economyFor(player.id);
          const combatUnits = state.units.filter(unit => unit.alive && !unit.incapacitated && unit.faction === player.id && unit.damage > 0 && (unit.ammo > 0 || unit.role === "vehicle"));
          const production = state.structures.filter(structure => structure.alive !== false && structure.progress >= 1 && structure.faction === player.id && ["barracks", "dropbay"].includes(structure.type));
          const rebuildSupply = (economy.inventory.requisition || 0) >= 12 && (economy.inventory.materials || 0) >= 4;
          const reinforcementRoutes = state.roads.filter(road => areAllies(road.controllerFaction || road.faction, player.id) && road.condition > 0.35).length
            + state.tradePartners.filter(route => route.faction === player.id && route.established).length
            + production.filter(structure => structure.type === "dropbay").length;
          const commanders = combatUnits.filter(unit => unit.role === "commander");
          const operationalForces = combatUnits.filter(unit => unit.role !== "commander").length;
          const alliedRescue = state.units.filter(unit => unit.alive && !unit.incapacitated && areAllies(unit.faction, player.id) && unit.faction !== player.id && unit.damage > 0).length;
          const capable = combatUnits.length > 0 || production.length > 0 && rebuildSupply || reinforcementRoutes > 0 || commanders.length > 0 && operationalForces > 0 || alliedRescue > 0;
          if (combatUnits.length || production.length) player.hasEstablishedCapability = true;
          capabilities.set(player.id, { combatUnits: combatUnits.length, production: production.length, reinforcementRoutes, commanders: commanders.length, operationalForces, alliedRescue, capable });
        }
        for (const player of state.players) {
          const report = capabilities.get(player.id);
          const outcome = state.strategicOutcomes[player.id] ||= { status: "Operational", defeated: false, surrendered: false };
          if (outcome.defeated) continue;
          const forceMorale = state.units.filter(unit => unit.alive && unit.faction === player.id).reduce((sum, unit) => sum + unit.morale, 0) / Math.max(1, state.units.filter(unit => unit.alive && unit.faction === player.id).length);
          const enemyPower = [...capabilities.entries()].filter(([id]) => !areAllies(id, player.id)).reduce((sum, [, item]) => sum + item.combatUnits + item.production * 2, 0);
          const ownPower = report.combatUnits + report.production * 2 + report.reinforcementRoutes;
          const mayWithdraw = player.faction === "Imperial Guard" || player.race === "T'au" || player.race === "Chaos";
          if (!report.capable && (player.hasEstablishedCapability || state.time > 180)) {
            outcome.defeated = true;
            outcome.surrendered = mayWithdraw && forceMorale < 0.42;
            outcome.status = outcome.surrendered ? "Surrendered · military capability collapsed" : "Defeated · no operational military capability";
            outcome.decidedAt = state.time;
            incident(`${player.faction} ${outcome.surrendered ? "surrendered" : "lost the war"}: no combat force, rebuilding production, reinforcement route, operational commander, or allied rescue force remains.`, null, "critical");
          } else if (ownPower < enemyPower * 0.22 && state.time > 90) {
            if (mayWithdraw) outcome.status = forceMorale < 0.38 ? "Evaluating withdrawal or surrender" : "Withdrawing to preserve operational forces";
            else outcome.status = player.race === "Tyranids" ? "Consuming reserves · no surrender" : player.race === "Orks" ? "Last Waaagh! · no surrender" : "Last stand · no surrender";
          } else outcome.status = `Operational · ${report.combatUnits} combat, ${report.production} production, ${report.reinforcementRoutes} routes`;
        }
        const activeTeams = new Set(state.players.filter(player => !state.strategicOutcomes[player.id]?.defeated).map(player => String(player.team)));
        if (activeTeams.size === 1 && state.players.some(player => state.strategicOutcomes[player.id]?.defeated)) {
          state.victoriousTeam = [...activeTeams][0];
          root.dataset.victory = `Team ${state.victoriousTeam}`;
        } else {
          state.victoriousTeam = null;
          delete root.dataset.victory;
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
        const spatialInterval = 0.2 * Math.max(1, state.speed);
        if (state.spatialAccumulator >= spatialInterval || !state.spatialGrid.size) {
          rebuildSpatialGrid();
          state.spatialAccumulator = 0;
        }
        state.roadAIAccumulator += dt;
        if (state.roadAIAccumulator >= 3) {
          updateRoadDynamics(state.roadAIAccumulator);
          state.roadAIAccumulator = 0;
        }
        state.armyAIAccumulator += dt;
        if (state.armyAIAccumulator >= 5) {
          updateArmyAI();
          state.armyAIAccumulator = 0;
        }
        state.factionAIAccumulator += dt;
        if (state.factionAIAccumulator >= 3) {
          updateFactionAI();
          state.factionAIAccumulator = 0;
        }
        state.commanderAIAccumulator += dt;
        if (state.commanderAIAccumulator >= 3) {
          updateCommanderAI();
          state.commanderAIAccumulator = 0;
        }
        state.squadAIAccumulator += dt;
        if (state.squadAIAccumulator >= 0.5) {
          updateSquadAI();
          state.squadAIAccumulator = 0;
        }
        state.socialAccumulator += dt;
        if (state.socialAccumulator >= 2) {
          updateSocialAI();
          state.socialAccumulator = 0;
        }
        state.victoryEvaluationAccumulator += dt;
        if (state.victoryEvaluationAccumulator >= 5) {
          evaluateStrategicOutcomes();
          state.victoryEvaluationAccumulator = 0;
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
        cleanupCompletedDeathAnimations();
        updateExploration(dt);
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
            id: unit.id, faction: unit.faction, name: unit.name, role: unit.role, index: unit.index,
            x: unit.x, y: unit.y, hp: unit.hp, maxHp: unit.maxHp, morale: unit.morale,
            fatigue: unit.fatigue, alive: unit.alive, status: unit.status, squadId: unit.squadId,
            range: unit.range, spriteScale: unit.spriteScale, deathStartedAt: unit.deathStartedAt,
            combatIntent: unit.combatIntent, killConfidence: unit.killConfidence
          })),
          structures: state.structures.map(item => ({ ...item })),
          squads: state.squads.map(squad => ({
            id: squad.id, name: squad.name, leaderId: squad.leaderId, faction: squad.faction,
            formation: squad.formation, orderType: squad.orderType, roadId: squad.roadId,
            cohesion: squad.cohesion, reinforcementState: squad.reinforcementState
          })),
          roads: state.roads.map(road => ({ id: road.id, condition: road.condition, status: road.status, control: road.control, ambushRisk: road.ambushRisk }))
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
        for (let index = 1; index < points.length; index += 1) ctx.lineTo(points[index].x, points[index].y);
      }

      function drawRoadNetwork() {
        if (!state.showRoads) return;
        for (const road of state.roads) {
          if (!pointsVisible(road.points, 24)) continue;
          if (state.camera.zoom < 0.15 && road.hierarchy === "local access") continue;
          const midpoint = roadMidpoint(road);
          const dynamicVisible = state.fogPlayer === "observer" || objectVisibleToFog({ ...midpoint, faction: road.faction });
          const baseColor = road.kind === "trade route" ? colors.signal : playerColor(road.faction);
          const segmentColor = segment => segment.status === "Blocked" ? "#ef4444"
            : segment.status === "Mined" ? "#ec4899"
              : segment.status === "Flooded" ? "#38bdf8"
                : segment.status === "Contested" ? "#f97316"
                  : segment.status === "Enemy controlled" ? "#dc2626"
                    : ["Damaged", "Congested"].includes(segment.status) ? "#eab308"
                      : segment.status === "Under observation" ? "#a78bfa"
                        : segment.status === "Secured" && segment.controllerFaction ? playerColor(segment.controllerFaction) : baseColor;
          const averageWidth = (road.segments || []).reduce((sum, segment) => sum + segment.width, 0) / Math.max(1, road.segments?.length || 0);
          ctx.save();
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.strokeStyle = colors.background;
          ctx.globalAlpha = 0.62;
          ctx.lineWidth = clamp(averageWidth + 4, 8, 15) / state.camera.zoom;
          traceRoad(road.points);
          ctx.stroke();
          ctx.strokeStyle = baseColor;
          ctx.globalAlpha = clamp(0.25 + (road.condition || 0) * 0.42, 0.22, 0.68);
          ctx.lineWidth = clamp(averageWidth, 5, 11) / state.camera.zoom;
          traceRoad(road.points);
          ctx.stroke();
          for (const segment of road.segments || []) {
            const segmentMidpoint = { x: (segment.start.x + segment.end.x) / 2, y: (segment.start.y + segment.end.y) / 2 };
            const segmentVisible = state.fogPlayer === "observer" || objectVisibleToFog({ ...segmentMidpoint, faction: road.faction });
            if (!segmentVisible) continue;
            ctx.setLineDash(segment.status === "Blocked" ? [3 / state.camera.zoom, 3 / state.camera.zoom] : []);
            ctx.strokeStyle = segmentColor(segment);
            ctx.globalAlpha = clamp(0.34 + (segment.condition ?? 1) * 0.45, 0.28, 0.82);
            ctx.lineWidth = clamp(segment.width, 5, 11) / state.camera.zoom;
            traceRoad([segment.start, segment.end]);
            ctx.stroke();
            if (segment.checkpoint) {
              const marker = 3.5 / state.camera.zoom;
              ctx.setLineDash([]);
              ctx.fillStyle = colors.card;
              ctx.strokeStyle = playerColor(segment.checkpoint.faction);
              ctx.globalAlpha = clamp(0.48 + segment.checkpoint.integrity * 0.42, 0.48, 0.9);
              ctx.lineWidth = 1.4 / state.camera.zoom;
              ctx.beginPath();
              if (segment.checkpoint.kind === "observation post") ctx.arc(segmentMidpoint.x, segmentMidpoint.y, marker, 0, Math.PI * 2);
              else ctx.rect(segmentMidpoint.x - marker, segmentMidpoint.y - marker, marker * 2, marker * 2);
              ctx.fill();
              ctx.stroke();
              if (segment.checkpoint.kind === "roadblock") {
                ctx.beginPath();
                ctx.moveTo(segmentMidpoint.x - marker * 1.4, segmentMidpoint.y - marker * 1.4);
                ctx.lineTo(segmentMidpoint.x + marker * 1.4, segmentMidpoint.y + marker * 1.4);
                ctx.moveTo(segmentMidpoint.x + marker * 1.4, segmentMidpoint.y - marker * 1.4);
                ctx.lineTo(segmentMidpoint.x - marker * 1.4, segmentMidpoint.y + marker * 1.4);
                ctx.stroke();
              }
            }
          }
          ctx.strokeStyle = colors.foreground;
          ctx.globalAlpha = 0.34;
          ctx.setLineDash([6 / state.camera.zoom, 7 / state.camera.zoom]);
          ctx.lineWidth = 1 / state.camera.zoom;
          traceRoad(road.points);
          ctx.stroke();
          if (dynamicVisible && state.camera.zoom >= 0.35) {
            ctx.setLineDash([]);
            ctx.fillStyle = colors.foreground;
            ctx.globalAlpha = 0.72;
            ctx.font = `${9 / state.camera.zoom}px system-ui, sans-serif`;
            ctx.textAlign = "center";
            ctx.fillText(`${road.status} · ${Math.round((road.condition || 0) * 100)}% · risk ${Math.round((road.ambushRisk || 0) * 100)}%`, midpoint.x, midpoint.y - 9 / state.camera.zoom);
          }
          ctx.restore();
        }
      }

      function drawTradePartners() {
        for (const partner of state.tradePartners || []) {
          if (!pointVisible(partner, 80)) continue;
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
        if (!state.showSupplyRadii || state.camera.zoom < 0.15) return;
        for (const structure of state.structures) {
          const radius = buildingCatalog[structure.type]?.supplyRadius || 0;
          if (!radius || structure.progress < 1 || structure.alive === false) continue;
          if (!circleVisible(structure, radius)) continue;
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
        if (state.camera.zoom < 0.15) return;
        for (const convoy of state.convoys) {
          if (convoy.finished && convoy.status !== "Destroyed") continue;
          if (!pointVisible(convoy, 48) || !objectVisibleToFog(convoy)) continue;
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
          if (!pointVisible(pod.destination, 80) || !objectVisibleToFog({ ...pod.destination, faction: pod.faction })) continue;
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

      function terrainChunkPreview(chunk) {
        if (!chunk.preview) {
          chunk.preview = document.createElement("canvas");
          chunk.preview.width = CHUNK_SIZE / TILE_SIZE;
          chunk.preview.height = CHUNK_SIZE / TILE_SIZE;
        }
        if (!chunk.dirty) return chunk.preview;
        const preview = chunk.preview.getContext("2d");
        preview.clearRect(0, 0, chunk.preview.width, chunk.preview.height);
        for (const [key, tile] of chunk.tiles) {
          const [tileX, tileY] = key.split(",").map(Number);
          preview.fillStyle = terrainPaintColor(tile.type);
          preview.globalAlpha = tile.opacity ?? 1;
          preview.fillRect(tileX - chunk.x * chunk.preview.width, tileY - chunk.y * chunk.preview.height, 1, 1);
        }
        preview.globalAlpha = 1;
        chunk.dirty = false;
        return chunk.preview;
      }

      function drawSparseTerrainTiles(bounds) {
        const lowDetail = state.camera.zoom < 0.15;
        const range = chunkRangeForBounds(bounds);
        const visibleChunkSlots = (range.maxX - range.minX + 1) * (range.maxY - range.minY + 1);
        const chunks = [];
        if (lowDetail && visibleChunkSlots > Math.max(64, state.terrainChunks.size * 2)) {
          for (const chunk of state.terrainChunks.values()) {
            if (chunk.x >= range.minX && chunk.x <= range.maxX && chunk.y >= range.minY && chunk.y <= range.maxY) chunks.push(chunk);
          }
        } else {
          for (let chunkY = range.minY; chunkY <= range.maxY; chunkY += 1) {
            for (let chunkX = range.minX; chunkX <= range.maxX; chunkX += 1) {
              const chunk = state.terrainChunks.get(chunkKey(chunkX, chunkY));
              if (chunk) chunks.push(chunk);
            }
          }
        }
        ctx.imageSmoothingEnabled = !lowDetail;
        for (const chunk of chunks) {
          if (lowDetail) {
            ctx.globalAlpha = 1;
            ctx.drawImage(terrainChunkPreview(chunk), chunk.x * CHUNK_SIZE, chunk.y * CHUNK_SIZE, CHUNK_SIZE, CHUNK_SIZE);
            continue;
          }
          for (const [key, tile] of chunk.tiles) {
            const [tileX, tileY] = key.split(",").map(Number);
            const x = tileX * TILE_SIZE;
            const y = tileY * TILE_SIZE;
            if (x + TILE_SIZE < bounds.left || x > bounds.right || y + TILE_SIZE < bounds.top || y > bounds.bottom) continue;
            ctx.fillStyle = atlasPatterns[atlasTypeMap[tile.type]] || terrainPaintColor(tile.type);
            ctx.globalAlpha = tile.opacity ?? 1;
            ctx.fillRect(x, y, TILE_SIZE + 0.5, TILE_SIZE + 0.5);
          }
        }
        ctx.imageSmoothingEnabled = true;
        ctx.globalAlpha = 1;
      }

      function drawFeatureChunkLod(buckets) {
        for (const bucket of buckets) {
          const representative = bucket.features[0];
          const left = bucket.chunkX * CHUNK_SIZE;
          const top = bucket.chunkY * CHUNK_SIZE;
          const density = clamp(bucket.features.length / 18, 0.14, 0.62);
          ctx.fillStyle = terrainPaintColor(representative.type);
          ctx.globalAlpha = density * 0.42;
          ctx.fillRect(left, top, CHUNK_SIZE, CHUNK_SIZE);
          ctx.globalAlpha = 0.72;
          ctx.beginPath();
          ctx.arc(left + CHUNK_SIZE / 2, top + CHUNK_SIZE / 2, Math.min(52, 3.2 / state.camera.zoom + bucket.features.length), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      function drawTerrain(
        bounds = cameraBounds(CHUNK_SIZE),
        terrainFeatures = state.camera.zoom < 0.15 ? visibleFeatureBuckets(bounds) : visibleFeatures(bounds)
      ) {
        const basePattern = atlasPatterns[atlasTypeMap[state.world.baseTerrain]];
        ctx.fillStyle = basePattern || terrainPaintColor(state.world.baseTerrain);
        ctx.fillRect(bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top);
        drawSparseTerrainTiles(bounds);
        for (const player of state.players) {
          if (circleVisible(player.base, spawnZoneFor(player).size, bounds)) drawSpawnZone(player);
        }
        ctx.globalAlpha = 0.14;
        ctx.strokeStyle = colors.border;
        ctx.lineWidth = 1 / state.camera.zoom;
        const gridSize = state.camera.zoom >= 0.25 ? TILE_SIZE : CHUNK_SIZE * (CHUNK_SIZE * state.camera.zoom < 12 ? 4 : 1);
        const startX = Math.floor(bounds.left / gridSize) * gridSize;
        const startY = Math.floor(bounds.top / gridSize) * gridSize;
        for (let x = startX; x <= bounds.right; x += gridSize) {
          ctx.beginPath();
          ctx.moveTo(x, bounds.top);
          ctx.lineTo(x, bounds.bottom);
          ctx.stroke();
        }
        for (let y = startY; y <= bounds.bottom; y += gridSize) {
          ctx.beginPath();
          ctx.moveTo(bounds.left, y);
          ctx.lineTo(bounds.right, y);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        if (state.camera.zoom < 0.15) drawFeatureChunkLod(terrainFeatures);
        else for (const feature of terrainFeatures) drawFeature(feature);
        drawRoadNetwork();
        drawTradePartners();
        for (const player of state.players) {
          if (!pointVisible(player.base, 48, bounds)) continue;
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
        ctx.strokeStyle = colors.foreground;
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 2 / state.camera.zoom;
        ctx.strokeRect(0, 0, worldWidth(), worldHeight());
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
        if (feature.resourceNode) {
          const ratio = clamp(feature.reserve / Math.max(1, feature.maxReserve), 0, 1);
          const nodeColor = { materials: "#d9b45d", fuel: "#d27843", food: "#79b85a", energy: "#62c8eb" }[feature.resourceType] || colors.foreground;
          ctx.globalAlpha = 0.9;
          ctx.strokeStyle = nodeColor;
          ctx.lineWidth = Math.max(1.5, 2 / state.camera.zoom);
          ctx.beginPath();
          ctx.arc(feature.x, feature.y, feature.r + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio);
          ctx.stroke();
          if (feature.strategicObjective) {
            ctx.fillStyle = nodeColor;
            ctx.beginPath();
            for (let point = 0; point < 10; point += 1) {
              const angle = -Math.PI / 2 + point * Math.PI / 5;
              const radius = point % 2 ? 3 : 7;
              const x = feature.x + Math.cos(angle) * radius;
              const y = feature.y + Math.sin(angle) * radius;
              if (!point) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.closePath(); ctx.fill();
          }
          if (state.camera.zoom >= 0.42) {
            ctx.fillStyle = colors.foreground;
            ctx.font = "9px system-ui, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(`${feature.resourceType} ${Math.round(ratio * 100)}%`, feature.x, feature.y + feature.r + 18);
          }
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
        for (const feature of visibleFeatures(cameraBounds(CHUNK_SIZE))) {
          const height = featureHeight(feature);
          if (!height) continue;
          const canopy = ["denseforest", "jungle", "trees"].includes(feature.type);
          const softness = ["bushes", "largebush", "tallgrass"].includes(feature.type) ? 0.56 : canopy ? 0.34 : 0.12;
          const radius = canopy ? feature.r * 0.72 : Math.max(5, feature.r * 0.34);
          drawCasterShadow(feature.x, feature.y, radius, height, softness, time);
        }
      }

      function drawStructureShadows(snapshot, visibleStructures = state.structures) {
        const time = currentSnapshot()?.t ?? state.time;
        const bounds = cameraBounds(CHUNK_SIZE);
        for (const item of visibleStructures) {
          if (item.progress < 0.18 || item.alive === false) continue;
          const height = (buildingCatalog[item.type]?.height || 8) * item.progress;
          const radius = item.type === "outpost" ? 18 : item.type === "observationtower" ? 7 : 13;
          const vector = shadowVector(height, time);
          if (!boundsIntersect(bounds, {
            left: Math.min(item.x, item.x + vector.x) - radius,
            right: Math.max(item.x, item.x + vector.x) + radius,
            top: Math.min(item.y, item.y + vector.y) - radius,
            bottom: Math.max(item.y, item.y + vector.y) + radius
          })) continue;
          drawCasterShadow(item.x, item.y, radius, height, 0.08, time);
        }
      }

      function drawUnitShadows(snapshot, visibleUnits = state.units) {
        const time = currentSnapshot()?.t ?? state.time;
        for (const unit of visibleUnits) {
          if (!unit.alive) continue;
          if (!pointVisible(unit, 80)) continue;
          const height = unit.role === "vehicle" ? 3.2 : unit.role === "builder" ? 2.4 : 1.8;
          drawCasterShadow(unit.x, unit.y, unit.role === "vehicle" ? 8 : 3.2, height, 0.12, time);
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

      function drawCellTerritory(territory) {
        if (!(territory.claimedCells instanceof Set) || !territory.claimedCells.size) return;
        const bounds = cameraBounds(TERRITORY_CELL_SIZE);
        const color = territory.owner ? playerColor(territory.owner) : colors.border;
        ctx.save();
        for (const key of territory.claimedCells) {
          const { x, y } = territoryCellCoordinates(key);
          const left = x * TERRITORY_CELL_SIZE;
          const top = y * TERRITORY_CELL_SIZE;
          if (left > bounds.right || left + TERRITORY_CELL_SIZE < bounds.left || top > bounds.bottom || top + TERRITORY_CELL_SIZE < bounds.top) continue;
          const contested = territory.contestedCells?.has(key);
          const disconnected = territory.disconnectedCells?.has(key);
          const controlled = territory.controlledCells?.has(key);
          ctx.fillStyle = color;
          ctx.globalAlpha = contested ? 0.26 : disconnected ? 0.07 : controlled ? 0.18 : 0.1;
          ctx.fillRect(left, top, TERRITORY_CELL_SIZE, TERRITORY_CELL_SIZE);
          ctx.strokeStyle = color;
          ctx.globalAlpha = contested ? 0.92 : disconnected ? 0.38 : 0.76;
          ctx.lineWidth = (contested ? 2.4 : 1.5) / state.camera.zoom;
          if (contested) ctx.setLineDash([4 / state.camera.zoom, 3 / state.camera.zoom]);
          else if (disconnected) ctx.setLineDash([3 / state.camera.zoom, 7 / state.camera.zoom]);
          const neighbors = new Set(neighboringTerritoryCells(key));
          const edge = (neighbor, x1, y1, x2, y2) => {
            if (neighbor && territory.claimedCells.has(neighbor)) return;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
          };
          edge(`${x},${y - 1}`, left, top, left + TERRITORY_CELL_SIZE, top);
          edge(`${x + 1},${y}`, left + TERRITORY_CELL_SIZE, top, left + TERRITORY_CELL_SIZE, top + TERRITORY_CELL_SIZE);
          edge(`${x},${y + 1}`, left + TERRITORY_CELL_SIZE, top + TERRITORY_CELL_SIZE, left, top + TERRITORY_CELL_SIZE);
          edge(`${x - 1},${y}`, left, top + TERRITORY_CELL_SIZE, left, top);
          ctx.setLineDash([]);
        }
        const center = territoryCenter(territory);
        if (pointVisible(center, 120, bounds)) {
          ctx.fillStyle = colors.foreground;
          ctx.globalAlpha = 0.78;
          ctx.font = `${10 / state.camera.zoom}px system-ui, sans-serif`;
          ctx.textAlign = "center";
          ctx.fillText(`${territory.name} · ${territory.status}`, center.x, center.y);
        }
        ctx.restore();
      }

      function drawTerritories() {
        if (!state.territoryOverlay) return;
        for (const territory of state.territories) {
          if (territory.cellBacked) {
            drawCellTerritory(territory);
            continue;
          }
          if (territory.points.length < 3) continue;
          if (!pointsVisible(territory.points, 48)) continue;
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

      function drawStructures(snapshot, visibleStructures = state.structures) {
        for (const item of visibleStructures) {
          if (!pointVisible(item, 96)) continue;
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
            const renderTime = snapshot?.t ?? state.time;
            const deathProgress = clamp((renderTime - (item.destroyedAt ?? renderTime)) / STRUCTURE_DEATH_ANIMATION_SECONDS, 0, 1);
            const fade = 1 - deathProgress;
            ctx.rotate(Math.sin(item.x * 0.17 + item.y * 0.11) * 0.08 * deathProgress);
            ctx.scale(1 + deathProgress * 0.18, 1 - deathProgress * 0.38);
            ctx.fillStyle = colors.mutedForeground;
            ctx.strokeStyle = colors.foreground;
            ctx.globalAlpha = 0.58 * fade;
            ctx.fillRect(-width / 2, -height / 3, width, height * 0.66);
            ctx.beginPath();
            ctx.moveTo(-width / 2, -height / 2);
            ctx.lineTo(width / 2, height / 2);
            ctx.moveTo(width / 2, -height / 2);
            ctx.lineTo(-width / 2, height / 2);
            ctx.stroke();
            ctx.fillStyle = colors.danger;
            for (let spark = 0; spark < 8; spark += 1) {
              const angle = spark * Math.PI / 4 + item.x * 0.01;
              const radius = (width * 0.18 + deathProgress * width * 0.72) * (0.72 + spark % 3 * 0.12);
              ctx.globalAlpha = fade * (0.7 - spark * 0.045);
              ctx.fillRect(Math.cos(angle) * radius - 1, Math.sin(angle) * radius - 1, 2.5, 2.5);
            }
            ctx.restore();
            continue;
          }
          ctx.fillStyle = colors.mutedForeground;
          ctx.globalAlpha = 0.52 * (item.condition ?? 1);
          ctx.strokeStyle = colors.foreground;
          ctx.globalAlpha = 0.72 * (item.condition ?? 1);
          ctx.lineWidth = 1.5;
          if (item.biological) {
            const pulse = 0.96 + Math.sin(state.time * 1.4 + item.x * 0.01) * 0.04;
            ctx.save();
            ctx.scale(pulse * progress, pulse);
            ctx.beginPath();
            ctx.ellipse(0, 0, width / 2, height / 2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            for (let rootIndex = 0; rootIndex < 6; rootIndex += 1) {
              const angle = rootIndex * Math.PI / 3;
              ctx.beginPath();
              ctx.moveTo(Math.cos(angle) * width * 0.3, Math.sin(angle) * height * 0.3);
              ctx.quadraticCurveTo(Math.cos(angle + 0.25) * width * 0.72, Math.sin(angle + 0.25) * height * 0.72, Math.cos(angle) * width, Math.sin(angle) * height);
              ctx.stroke();
            }
            ctx.restore();
          } else {
            ctx.fillRect(-width / 2, -height / 2, width * progress, height);
            ctx.strokeRect(-width / 2, -height / 2, width * progress, height);
          }
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
            ctx.fillText(item.displayName || factionBuildingLabel(item.faction, item.type), item.x, item.y + 23);
          }
        }
        ctx.globalAlpha = 1;
      }

      function drawSquads(snapshot, visibleUnits = state.units) {
        const groups = new Map();
        for (const unit of visibleUnits) {
          if (!unit.squadId) continue;
          if (!unit.alive || !pointVisible(unit, 72)) continue;
          if (!groups.has(unit.squadId)) groups.set(unit.squadId, []);
          groups.get(unit.squadId).push(unit);
        }
        for (const squad of snapshot?.squads || state.squads) {
          const members = groups.get(squad.id) || [];
          if (members.length < 2) continue;
          const views = members.map(unit => ({ unit, view: unit }));
          const cx = views.reduce((sum, item) => sum + item.view.x, 0) / views.length;
          const cy = views.reduce((sum, item) => sum + item.view.y, 0) / views.length;
          if (!pointVisible({ x: cx, y: cy }, 72)) continue;
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
          ctx.fillText(`${squad.name} · ${members.length} · ${squad.formation || "line"}`, cx, cy - 28);
          if (state.camera.zoom >= 0.45) {
            ctx.globalAlpha = 0.58;
            ctx.font = "8px system-ui, sans-serif";
            ctx.fillText(`${squad.orderType || "Advance"} · cohesion ${Math.round((squad.cohesion || 0) * 100)}%`, cx, cy - 37);
          }
        }
        ctx.globalAlpha = 1;
      }

      function drawUnit(unit, historical) {
        const view = historical || unit;
        if (!pointVisible(view, Math.max(96, unit.range || 0))) return;
        const color = playerColor(unit.faction);
        const secondary = playerSecondaryColor(unit.faction);
        const pattern = playerFor(unit.faction).pattern || "solid";
        const selected = unit.id === state.selectedId;
        ctx.save();
        ctx.translate(Math.round(view.x), Math.round(view.y));
        if (view.alive && state.camera.zoom < 0.15) {
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.92;
          ctx.beginPath();
          ctx.arc(0, 0, 2.5 / state.camera.zoom, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          return;
        }
        if (!view.alive) {
          const renderTime = currentSnapshot()?.t ?? state.time;
          const deathProgress = clamp((renderTime - (view.deathStartedAt ?? unit.deathStartedAt ?? renderTime)) / UNIT_DEATH_ANIMATION_SECONDS, 0, 1);
          const fade = 1 - deathProgress;
          ctx.globalAlpha = fade;
          ctx.rotate((unit.index % 2 ? 1 : -1) * deathProgress * 0.42);
          ctx.scale(1 + deathProgress * 0.18, 1 - deathProgress * 0.3);
          const forgedBody = window.AWTModules?.unitSpriteForge?.draw(ctx, { ...unit, alive: false }, { primary: color, secondary, accent: colors.foreground }, currentSnapshot()?.t ?? state.time);
          if (forgedBody) {
            ctx.fillStyle = colors.danger;
            ctx.globalAlpha = fade * 0.55;
            ctx.beginPath();
            ctx.arc(0, 0, 4 + deathProgress * 10, 0, Math.PI * 2);
            ctx.strokeStyle = colors.danger;
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.restore();
            return;
          }
          ctx.strokeStyle = color;
          ctx.globalAlpha = 0.5 * fade;
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
        if ((unit.spriteScale || 1) !== 1) ctx.scale(unit.spriteScale, unit.spriteScale);
        ctx.fillStyle = color;
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.96;
        const forgedSprite = window.AWTModules?.unitSpriteForge?.draw(ctx, unit, { primary: color, secondary, accent: colors.foreground }, currentSnapshot()?.t ?? state.time);
        if (!forgedSprite && unit.role === "builder") {
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
        } else if (!forgedSprite && unit.role === "vehicle") {
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
        } else if (!forgedSprite) {
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
        if (state.camera.zoom < 0.15) return;
        if (state.replay) return;
        for (const projectile of state.projectiles) {
          if (!objectVisibleToFog(projectile)) continue;
          if (!pointVisible(projectile, 48) && !pointVisible({ x: projectile.previousX ?? projectile.x, y: projectile.previousY ?? projectile.y }, 48)) continue;
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
        const sources = lightSourcesInBounds(cameraBounds(CHUNK_SIZE), time).filter(source => objectVisibleToFog(source));
        if (sources.length && darkness > 0.08) {
          layer.globalCompositeOperation = "destination-out";
          for (const source of sources) {
            const screen = worldToCanvas(source);
            const radius = source.radius * state.camera.zoom * canvas.width / VW;
            const gradient = layer.createRadialGradient(screen.x, screen.y, 0, screen.x, screen.y, radius);
            gradient.addColorStop(0, "rgba(0,0,0,0.96)");
            gradient.addColorStop(0.45, "rgba(0,0,0,0.58)");
            gradient.addColorStop(1, "rgba(0,0,0,0)");
            layer.fillStyle = gradient;
            layer.globalAlpha = clamp(source.brightness, 0, 1);
            layer.beginPath();
            layer.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
            layer.fill();
            if (source.searchlight) {
              layer.globalAlpha = 0.82;
              layer.beginPath();
              layer.moveTo(screen.x, screen.y);
              layer.arc(screen.x, screen.y, radius, source.direction - 0.23, source.direction + 0.23);
              layer.closePath();
              layer.fill();
            }
          }
          layer.globalCompositeOperation = "source-over";
        }
        layer.globalAlpha = 1;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(dynamicLightLayer, 0, 0, canvas.width, canvas.height);
        ctx.restore();
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
        if (!state.lighting.enabled || !state.lighting.overlay || state.fogPlayer !== "observer") return;
        const time = currentSnapshot()?.t ?? state.time;
        const sun = sunState(time);
        const columns = 12;
        const rows = 7;
        const bounds = cameraBounds();
        const cellW = (bounds.right - bounds.left) / columns;
        const cellH = (bounds.bottom - bounds.top) / rows;
        ctx.save();
        for (let row = 0; row < rows; row += 1) {
          for (let column = 0; column < columns; column += 1) {
            const point = { x: bounds.left + (column + 0.5) * cellW, y: bounds.top + (row + 0.5) * cellH };
            const sample = lightingAt(point, null, time);
            ctx.fillStyle = sample.searchlight > 0.2
              ? colors.danger
              : sample.shadowed
                ? colors.water
                : sample.brightness > 0.55 ? colors.signal : colors.background;
            ctx.globalAlpha = sample.searchlight > 0.2 ? 0.18 : 0.07 + Math.abs(sample.brightness - 0.5) * 0.08;
            ctx.fillRect(bounds.left + column * cellW, bounds.top + row * cellH, cellW, cellH);
          }
        }
        for (const source of lightSourcesInBounds(bounds, time).filter(item => objectVisibleToFog(item))) {
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
        const compass = { x: bounds.right - 74 / state.camera.zoom, y: bounds.top + 52 / state.camera.zoom };
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

      function rasterizeVisionSources(teamVisibility) {
        const visibilityScale = state.visibility / 100;
        const add = (team, source) => {
          const key = String(team);
          const visible = teamVisibility.get(key);
          if (!visible) return;
          const radius = Math.max(0, source.r * visibilityScale);
          const range = gridRangeForBounds({
            left: clamp(source.x - radius, 0, worldWidth()),
            right: clamp(source.x + radius, 0, worldWidth()),
            top: clamp(source.y - radius, 0, worldHeight()),
            bottom: clamp(source.y + radius, 0, worldHeight())
          }, FOG_CELL_SIZE);
          for (let cellY = range.minY; cellY <= range.maxY; cellY += 1) {
            for (let cellX = range.minX; cellX <= range.maxX; cellX += 1) {
              const left = cellX * FOG_CELL_SIZE;
              const top = cellY * FOG_CELL_SIZE;
              const nearestX = clamp(source.x, left, left + FOG_CELL_SIZE);
              const nearestY = clamp(source.y, top, top + FOG_CELL_SIZE);
              const dx = source.x - nearestX;
              const dy = source.y - nearestY;
              if (dx * dx + dy * dy <= radius * radius) visible.cells.addCell(cellX, cellY);
            }
          }
        };
        const snapshot = state.replay ? currentSnapshot() : null;
        const liveUnits = snapshot ? new Map(state.units.map(unit => [unit.id, unit])) : null;
        const units = snapshot
          ? snapshot.units.map(unit => ({ ...(liveUnits.get(unit.id) || {}), ...unit }))
          : state.units;
        const structures = snapshot?.structures || state.structures;
        for (const unit of units) {
          if (!unit.alive) continue;
          add(playerFor(unit.faction).team, { x: unit.x, y: unit.y, r: unit.role === "scout" ? 145 : unit.role === "builder" ? 92 : 112 });
        }
        for (const item of structures) {
          if (item.alive === false || item.progress < 1) continue;
          add(playerFor(item.faction).team, { x: item.x, y: item.y, r: item.type === "observationtower" ? 170 : 78 });
        }
        for (const source of activeLightSources(currentSnapshot()?.t ?? state.time)) {
          if (!source.faction) continue;
          add(playerFor(source.faction).team, { x: source.x, y: source.y, r: source.radius * (source.searchlight ? 1 : 0.7) });
        }
      }

      function updateExploration(dt = 0, force = false) {
        state.explorationAccumulator += dt;
        const explorationInterval = 0.5 * Math.max(1, state.speed);
        if (!force && state.explorationAccumulator < explorationInterval) return;
        state.explorationAccumulator = 0;
        const teamVisibility = new Map();
        for (const player of state.players) {
          const team = String(player.team);
          if (teamVisibility.has(team)) continue;
          let visible = state.teamFogVisibility.get(team);
          const expectedColumns = Math.max(1, Math.ceil(worldWidth() / FOG_CELL_SIZE));
          const expectedRows = Math.max(1, Math.ceil(worldHeight() / FOG_CELL_SIZE));
          if (!visible || visible.cells.columns !== expectedColumns || visible.cells.rows !== expectedRows) {
            visible = { chunks: new Set(), cells: createFogCellMask() };
            state.teamFogVisibility.set(team, visible);
          } else {
            visible.chunks.clear();
            visible.cells.clear();
          }
          teamVisibility.set(team, visible);
        }
        rasterizeVisionSources(teamVisibility);
        for (const visible of teamVisibility.values()) {
          for (const index of visible.cells.indices) {
            const cellX = index % visible.cells.columns;
            const cellY = Math.floor(index / visible.cells.columns);
            visible.chunks.add(chunkKey(
              Math.floor(cellX * FOG_CELL_SIZE / CHUNK_SIZE),
              Math.floor(cellY * FOG_CELL_SIZE / CHUNK_SIZE)
            ));
          }
        }
        const teamExploration = new Map();
        for (const player of state.players) {
          const team = String(player.team);
          const visible = teamVisibility.get(team) || { chunks: new Set(), cells: createFogCellMask() };
          let exploredState = teamExploration.get(team);
          if (!exploredState) {
            const explored = state.explored[player.id] instanceof Set ? state.explored[player.id] : new Set();
            const exploredCells = isFogCellMask(state.exploredFogCells[player.id]) ? state.exploredFogCells[player.id] : createFogCellMask();
            for (const key of visible.chunks) explored.add(key);
            exploredCells.unionFrom(visible.cells);
            exploredState = { chunks: explored, cells: exploredCells };
            teamExploration.set(team, exploredState);
          }
          state.visibleFogChunks[player.id] = visible.chunks;
          state.visibleFogCells[player.id] = visible.cells;
          state.explored[player.id] = exploredState.chunks;
          state.exploredFogCells[player.id] = exploredState.cells;
        }
        state.minimapMarkerDirty = true;
      }

      function objectVisibleToFog(item, playerId = state.fogPlayer, padding = 0) {
        if (playerId === "observer" || !item?.faction) return true;
        if (String(playerFor(item.faction).team) === String(playerFor(playerId).team)) return true;
        const visible = state.visibleFogCells[playerId];
        const range = gridRangeForBounds({
          left: clamp(item.x - padding, 0, worldWidth()),
          right: clamp(item.x + padding, 0, worldWidth()),
          top: clamp(item.y - padding, 0, worldHeight()),
          bottom: clamp(item.y + padding, 0, worldHeight())
        }, FOG_CELL_SIZE);
        for (let cellY = range.minY; cellY <= range.maxY; cellY += 1) {
          for (let cellX = range.minX; cellX <= range.maxX; cellX += 1) {
            if (isFogCellMask(visible) ? visible.hasCell(cellX, cellY) : visible instanceof Set && visible.has(chunkKey(cellX, cellY))) return true;
          }
        }
        return false;
      }

      function drawFog() {
        if (state.fogPlayer === "observer") return;
        const playerId = state.fogPlayer;
        const bounds = cameraBounds(CHUNK_SIZE);
        const explored = state.explored[playerId] instanceof Set ? state.explored[playerId] : new Set();
        const visible = state.visibleFogChunks[playerId] instanceof Set ? state.visibleFogChunks[playerId] : new Set();
        const range = chunkRangeForBounds(bounds);
        for (let gy = range.minY; gy <= range.maxY; gy += 1) {
          for (let gx = range.minX; gx <= range.maxX; gx += 1) {
            const key = chunkKey(gx, gy);
            if (visible.has(key)) continue;
            ctx.fillStyle = colors.background;
            ctx.globalAlpha = explored.has(key) ? 0.5 : 0.92;
            ctx.fillRect(gx * CHUNK_SIZE, gy * CHUNK_SIZE, CHUNK_SIZE + 1, CHUNK_SIZE + 1);
          }
        }
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

      function buildOverviewClusters(visibleObjects) {
        const cellSize = 24 / state.camera.zoom;
        const collect = (items, deadTest) => {
          const cells = new Map();
          for (const item of items) {
            const dead = deadTest(item);
            const cellX = Math.floor(item.x / cellSize);
            const cellY = Math.floor(item.y / cellSize);
            const key = `${item.faction}:${dead ? "dead" : "live"}:${cellX}:${cellY}`;
            let cell = cells.get(key);
            if (!cell) {
              cell = { x: 0, y: 0, count: 0, faction: item.faction, dead };
              cells.set(key, cell);
            }
            cell.x += item.x;
            cell.y += item.y;
            cell.count += 1;
          }
          for (const cell of cells.values()) {
            cell.x /= cell.count;
            cell.y /= cell.count;
          }
          return [...cells.values()];
        };
        return {
          units: collect(visibleObjects.units, item => !item.alive),
          structures: collect(visibleObjects.structures, item => item.alive === false)
        };
      }

      function drawOverviewClusters(clusters) {
        ctx.save();
        for (const cell of clusters.structures) {
          const size = (4 + Math.min(6, Math.log2(cell.count + 1))) / state.camera.zoom;
          ctx.fillStyle = cell.dead ? colors.mutedForeground : playerColor(cell.faction);
          ctx.globalAlpha = cell.dead ? 0.34 : 0.86;
          ctx.fillRect(cell.x - size / 2, cell.y - size / 2, size, size);
        }
        for (const cell of clusters.units) {
          const radius = (2.6 + Math.min(5, Math.log2(cell.count + 1))) / state.camera.zoom;
          ctx.fillStyle = cell.dead ? colors.mutedForeground : playerColor(cell.faction);
          ctx.globalAlpha = cell.dead ? 0.3 : 0.92;
          ctx.beginPath();
          ctx.arc(cell.x, cell.y, radius, 0, Math.PI * 2);
          ctx.fill();
          if (!cell.dead && cell.count > 4) {
            ctx.fillStyle = colors.background;
            ctx.globalAlpha = 0.9;
            ctx.font = `${8 / state.camera.zoom}px system-ui, sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(String(cell.count), cell.x, cell.y);
          }
        }
        ctx.restore();
      }

      function renderMinimapFeature(layer, feature, scaleX, scaleY) {
        layer.fillStyle = terrainPaintColor(feature.type);
        layer.strokeStyle = terrainPaintColor(feature.type);
        if (feature.shape === "line" && feature.x2 != null && feature.y2 != null) {
          layer.lineWidth = Math.max(1, feature.r * 2 * Math.min(scaleX, scaleY));
          layer.beginPath();
          layer.moveTo(feature.x * scaleX, feature.y * scaleY);
          layer.lineTo(feature.x2 * scaleX, feature.y2 * scaleY);
          layer.stroke();
          return;
        }
        if (feature.shape === "square") {
          layer.fillRect(
            (feature.x - feature.r) * scaleX,
            (feature.y - feature.r) * scaleY,
            Math.max(1, feature.r * 2 * scaleX),
            Math.max(1, feature.r * 2 * scaleY)
          );
          return;
        }
        layer.beginPath();
        layer.ellipse(
          feature.x * scaleX,
          feature.y * scaleY,
          Math.max(0.7, feature.r * scaleX),
          Math.max(0.7, feature.r * scaleY),
          0,
          0,
          Math.PI * 2
        );
        layer.fill();
      }

      function renderMinimapTerrain(now) {
        if (!state.minimapTerrainDirty) return;
        if (state.minimapTerrainUpdatedAt && now - state.minimapTerrainUpdatedAt < 120) return;
        const width = minimapTerrainLayer.width;
        const height = minimapTerrainLayer.height;
        const scaleX = width / worldWidth();
        const scaleY = height / worldHeight();
        minimapTerrainCtx.setTransform(1, 0, 0, 1, 0, 0);
        minimapTerrainCtx.clearRect(0, 0, width, height);
        minimapTerrainCtx.fillStyle = terrainPaintColor(state.world.baseTerrain);
        minimapTerrainCtx.globalAlpha = 0.82;
        minimapTerrainCtx.fillRect(0, 0, width, height);
        for (const chunk of state.terrainChunks.values()) {
          for (const [key, tile] of chunk.tiles) {
            const [tileX, tileY] = key.split(",").map(Number);
            minimapTerrainCtx.fillStyle = terrainPaintColor(tile.type);
            minimapTerrainCtx.globalAlpha = tile.opacity ?? 1;
            minimapTerrainCtx.fillRect(
              tileX * TILE_SIZE * scaleX,
              tileY * TILE_SIZE * scaleY,
              Math.max(0.55, TILE_SIZE * scaleX),
              Math.max(0.55, TILE_SIZE * scaleY)
            );
          }
        }
        minimapTerrainCtx.globalAlpha = 0.46;
        for (const feature of state.features) {
          if (!feature.deleted) renderMinimapFeature(minimapTerrainCtx, feature, scaleX, scaleY);
        }
        minimapTerrainCtx.globalAlpha = 1;
        state.minimapTerrainDirty = false;
        state.minimapTerrainUpdatedAt = now;
      }

      function minimapMarkerVisible(item, playerId) {
        return objectVisibleToFog(item, playerId, item?.hitbox ? Math.max(item.hitbox.w, item.hitbox.h) / 2 : 0);
      }

      function minimapTerritoryVisible(territory, playerId) {
        if (playerId === "observer") return true;
        if (territory.owner && String(playerFor(territory.owner).team) === String(playerFor(playerId).team)) return true;
        const explored = state.explored[playerId] instanceof Set ? state.explored[playerId] : new Set();
        const samples = [territoryCenter(territory), ...territory.points];
        return samples.some(point => explored.has(chunkKey(
          clamp(Math.floor(point.x / CHUNK_SIZE), 0, Math.ceil(worldWidth() / CHUNK_SIZE) - 1),
          clamp(Math.floor(point.y / CHUNK_SIZE), 0, Math.ceil(worldHeight() / CHUNK_SIZE) - 1)
        )));
      }

      function renderMinimapMarkers(now) {
        if (!state.minimapMarkerDirty || (state.minimapMarkerUpdatedAt && now - state.minimapMarkerUpdatedAt < 250)) return;
        const width = minimapMarkerLayer.width;
        const height = minimapMarkerLayer.height;
        const scaleX = width / worldWidth();
        const scaleY = height / worldHeight();
        const layer = minimapMarkerCtx;
        layer.setTransform(1, 0, 0, 1, 0, 0);
        layer.clearRect(0, 0, width, height);
        if (state.fogPlayer !== "observer") {
          const explored = state.explored[state.fogPlayer] instanceof Set ? state.explored[state.fogPlayer] : new Set();
          const visible = state.visibleFogChunks[state.fogPlayer] instanceof Set ? state.visibleFogChunks[state.fogPlayer] : new Set();
          layer.fillStyle = colors.background;
          layer.globalAlpha = 0.78;
          layer.fillRect(0, 0, width, height);
          layer.globalCompositeOperation = "destination-out";
          layer.globalAlpha = 0.56;
          for (const key of explored) {
            const [chunkX, chunkY] = key.split(",").map(Number);
            layer.fillRect(chunkX * CHUNK_SIZE * scaleX, chunkY * CHUNK_SIZE * scaleY, Math.max(1, CHUNK_SIZE * scaleX), Math.max(1, CHUNK_SIZE * scaleY));
          }
          layer.globalAlpha = 1;
          for (const key of visible) {
            const [chunkX, chunkY] = key.split(",").map(Number);
            layer.fillRect(chunkX * CHUNK_SIZE * scaleX, chunkY * CHUNK_SIZE * scaleY, Math.max(1, CHUNK_SIZE * scaleX), Math.max(1, CHUNK_SIZE * scaleY));
          }
          layer.globalCompositeOperation = "source-over";
        }
        if (state.showRoads) {
          layer.lineCap = "round";
          layer.lineWidth = 1;
          for (const road of state.roads) {
            if (!road.points?.length) continue;
            layer.strokeStyle = road.kind === "trade route" ? colors.signal : playerColor(road.faction);
            layer.globalAlpha = 0.24;
            layer.beginPath();
            layer.moveTo(road.points[0].x * scaleX, road.points[0].y * scaleY);
            for (let index = 1; index < road.points.length; index += 1) layer.lineTo(road.points[index].x * scaleX, road.points[index].y * scaleY);
            layer.stroke();
            for (const segment of road.segments || []) {
              const midpoint = { x: (segment.start.x + segment.end.x) / 2, y: (segment.start.y + segment.end.y) / 2 };
              const dynamicVisible = state.fogPlayer === "observer" || minimapMarkerVisible({ ...midpoint, faction: road.faction }, state.fogPlayer);
              if (!dynamicVisible) continue;
              layer.strokeStyle = segment.status === "Blocked" ? "#ef4444"
                : segment.status === "Mined" ? "#ec4899"
                  : segment.status === "Flooded" ? "#38bdf8"
                    : segment.status === "Contested" ? "#f97316"
                      : ["Damaged", "Congested"].includes(segment.status) ? "#eab308"
                        : road.kind === "trade route" ? colors.signal : playerColor(segment.controllerFaction || road.faction);
              layer.globalAlpha = 0.58;
              layer.beginPath();
              layer.moveTo(segment.start.x * scaleX, segment.start.y * scaleY);
              layer.lineTo(segment.end.x * scaleX, segment.end.y * scaleY);
              layer.stroke();
            }
          }
        }
        layer.globalAlpha = 0.48;
        layer.lineWidth = 1;
        for (const territory of state.territories) {
          if (territory.cellBacked && territory.claimedCells instanceof Set) {
            layer.fillStyle = territory.owner ? playerColor(territory.owner) : colors.border;
            layer.globalAlpha = 0.2;
            for (const key of territory.claimedCells) {
              const { x, y } = territoryCellCoordinates(key);
              layer.fillRect(
                x * TERRITORY_CELL_SIZE * scaleX,
                y * TERRITORY_CELL_SIZE * scaleY,
                Math.max(0.7, TERRITORY_CELL_SIZE * scaleX),
                Math.max(0.7, TERRITORY_CELL_SIZE * scaleY)
              );
            }
            layer.globalAlpha = 0.48;
            continue;
          }
          if (territory.points.length < 3 || !minimapTerritoryVisible(territory, state.fogPlayer)) continue;
          layer.strokeStyle = territory.owner ? playerColor(territory.owner) : colors.border;
          layer.beginPath();
          layer.moveTo(territory.points[0].x * scaleX, territory.points[0].y * scaleY);
          for (let index = 1; index < territory.points.length; index += 1) layer.lineTo(territory.points[index].x * scaleX, territory.points[index].y * scaleY);
          layer.closePath();
          layer.stroke();
        }
        const unitCells = new Map();
        for (const unit of state.units) {
          if (!unit.alive || !minimapMarkerVisible(unit, state.fogPlayer)) continue;
          const x = Math.floor(unit.x * scaleX);
          const y = Math.floor(unit.y * scaleY);
          unitCells.set(`${unit.faction}:${x}:${y}`, { x, y, faction: unit.faction });
        }
        layer.globalAlpha = 0.92;
        for (const cell of unitCells.values()) {
          layer.fillStyle = playerColor(cell.faction);
          layer.fillRect(cell.x - 1, cell.y - 1, 3, 3);
        }
        const structureCells = new Map();
        for (const structure of state.structures) {
          if (structure.alive === false || !minimapMarkerVisible(structure, state.fogPlayer)) continue;
          const x = Math.floor(structure.x * scaleX);
          const y = Math.floor(structure.y * scaleY);
          structureCells.set(`${structure.faction}:${x}:${y}`, { x, y, faction: structure.faction });
        }
        for (const cell of structureCells.values()) {
          layer.fillStyle = playerColor(cell.faction);
          layer.fillRect(cell.x - 1.5, cell.y - 1.5, 3, 3);
        }
        layer.globalAlpha = 1;
        state.minimapMarkerCount = unitCells.size + structureCells.size;
        root.dataset.minimapMarkers = String(state.minimapMarkerCount);
        state.minimapMarkerDirty = false;
        state.minimapMarkerUpdatedAt = now;
      }

      function drawMinimap() {
        const now = performance.now();
        renderMinimapTerrain(now);
        renderMinimapMarkers(now);
        const width = els.minimap.width;
        const height = els.minimap.height;
        const scaleX = width / worldWidth();
        const scaleY = height / worldHeight();
        minimapCtx.setTransform(1, 0, 0, 1, 0, 0);
        minimapCtx.clearRect(0, 0, width, height);
        minimapCtx.drawImage(minimapTerrainLayer, 0, 0);
        minimapCtx.drawImage(minimapMarkerLayer, 0, 0);
        const bounds = cameraBounds();
        minimapCtx.strokeStyle = "#ffffff";
        minimapCtx.globalAlpha = 0.96;
        minimapCtx.lineWidth = 2;
        minimapCtx.strokeRect(
          bounds.left * scaleX,
          bounds.top * scaleY,
          Math.max(2, (bounds.right - bounds.left) * scaleX),
          Math.max(2, (bounds.bottom - bounds.top) * scaleY)
        );
        minimapCtx.globalAlpha = 1;
      }

      function draw() {
        const bounds = cameraBounds(CHUNK_SIZE);
        const spatialObjects = spatialObjectsInBounds(bounds);
        const visibleObjects = {
          units: spatialObjects.units.filter(unit => objectVisibleToFog(unit)),
          structures: spatialObjects.structures.filter(item => objectVisibleToFog(item, state.fogPlayer, item.hitbox ? Math.max(item.hitbox.w, item.hitbox.h) / 2 : 0))
        };
        const range = chunkRangeForBounds(bounds);
        const chunkColumns = range.maxX - range.minX + 1;
        const chunkRows = range.maxY - range.minY + 1;
        const overviewMode = state.camera.zoom < 0.15;
        const terrainFeatures = overviewMode ? visibleFeatureBuckets(bounds) : visibleFeatures(bounds);
        const snapshot = currentSnapshot();
        const snapshotObjects = snapshot ? replayObjectsInBounds(snapshot, bounds) : null;
        const renderObjects = snapshot ? {
          units: snapshotObjects.units.filter(unit => objectVisibleToFog(unit)),
          structures: snapshotObjects.structures.filter(item => objectVisibleToFog(item, state.fogPlayer, item.hitbox ? Math.max(item.hitbox.w, item.hitbox.h) / 2 : 0))
        } : visibleObjects;
        const overviewClusters = overviewMode ? buildOverviewClusters(renderObjects) : null;
        const renderedActors = overviewClusters
          ? overviewClusters.units.length + overviewClusters.structures.length
          : renderObjects.units.length + renderObjects.structures.length;
        const renderedProjectiles = overviewMode ? 0 : state.projectiles.filter(item => pointVisible(item, 48, bounds) && objectVisibleToFog(item)).length;
        state.visibleChunkCount = chunkColumns * chunkRows;
        state.renderedObjectCount = renderedActors + renderedProjectiles + terrainFeatures.length;
        els.cameraStatus.textContent = `Camera ${Math.round(state.camera.x)}, ${Math.round(state.camera.y)} · ${Math.round(state.camera.zoom * 100)}% · ${state.visibleChunkCount} chunks`;
        root.dataset.worldSize = `${worldWidth()}x${worldHeight()}`;
        root.dataset.camera = `${state.camera.x.toFixed(2)},${state.camera.y.toFixed(2)},${state.camera.zoom.toFixed(3)}`;
        root.dataset.visibleChunks = String(state.visibleChunkCount);
        root.dataset.renderedObjects = String(state.renderedObjectCount);
        root.dataset.terrainChunks = String(state.terrainChunks.size);
        root.dataset.featureCount = String(state.features.length);
        root.dataset.collisionObstacles = String(state.features.filter(feature => !feature.deleted && ensureFeatureCollision(feature)?.environmentObstacle && feature.collisionState !== "cleared").length);
        root.dataset.territoryObjects = String(state.territories.filter(territory => territory.cellBacked).length);
        root.dataset.territoryCells = String(state.territories.reduce((sum, territory) => sum + (territory.claimedCells?.size || 0), 0));
        root.dataset.synapseCoverage = String(Math.round(Math.max(0, ...Object.values(state.factionEcology).map(item => item.synapseCoverage || 0)) * 100));
        root.dataset.waaaghMomentum = String(Math.round(Math.max(0, ...Object.values(state.factionEcology).map(item => item.waaaghMomentum || 0)) * 100));
        root.dataset.dropPods = String(state.dropPods.length);
        root.dataset.hostileDropPods = String(state.dropPods.filter(pod => pod.landingOwnership && ![pod.faction, "allied"].includes(pod.landingOwnership)).length);
        root.dataset.dropPodScores = state.dropPods.map(pod => Math.round(pod.landingScore || 0)).join(",");
        root.dataset.exploredChunks = String(state.explored[state.fogPlayer]?.size || 0);
        root.dataset.visibleFogChunks = String(state.visibleFogChunks[state.fogPlayer]?.size || 0);
        root.dataset.exploredFogCells = String(state.exploredFogCells[state.fogPlayer]?.size || 0);
        root.dataset.visibleFogCells = String(state.visibleFogCells[state.fogPlayer]?.size || 0);
        root.dataset.aiLayers = "4";
        root.dataset.relationshipEdges = String(state.aiDiagnostics.relationshipEdges);
        root.dataset.killPursuits = String(state.aiDiagnostics.killPursuits);
        root.dataset.formationSquads = String(state.aiDiagnostics.formationSquads);
        root.dataset.routeOrders = String(state.aiDiagnostics.routeOrders);
        root.dataset.guardSquads = String(state.aiDiagnostics.guardSquads);
        root.dataset.securedRoads = String(state.aiDiagnostics.securedRoads);
        root.dataset.checkpoints = String(state.aiDiagnostics.checkpoints);
        root.dataset.ambushRoads = String(state.aiDiagnostics.ambushRoads);
        root.dataset.environmentCollisions = String(state.aiDiagnostics.environmentCollisions);
        root.dataset.obstacleProjectileHits = String(state.aiDiagnostics.obstacleProjectileHits);
        root.dataset.resourceNodes = String(state.features.filter(feature => feature.resourceNode).length);
        root.dataset.depletedNodes = String(state.features.filter(feature => feature.resourceNode && feature.reserve <= 0).length);
        root.dataset.incapacitated = String(state.units.filter(unit => unit.alive && unit.incapacitated).length);
        root.dataset.casualtyStates = [...new Set(state.units.map(unit => unit.woundState || "Healthy"))].join(",");
        root.dataset.deathAnimations = String(state.units.filter(unit => !unit.alive).length + state.structures.filter(structure => structure.alive === false).length);
        root.dataset.deathRemovals = `${state.deathRemovalStats.units},${state.deathRemovalStats.structures}`;
        root.dataset.simulationPaused = String(state.paused);
        root.dataset.productionGroups = [...new Set(state.squads.map(squad => squad.templateId).filter(Boolean))].join(",");
        root.dataset.territoryPressure = state.players.map(player => `${player.id}:${Math.round((economyFor(player.id).territoryPressure || 0) * 100)}`).join(",");
        root.dataset.strategicOutcomes = state.players.map(player => `${player.id}:${state.strategicOutcomes[player.id]?.status || "forming"}`).join("|");
        beginCanvasFrame();
        drawTerrain(bounds, terrainFeatures);
        drawTerritories();
        drawSupplyRadii();
        if (overviewMode) {
          drawOverviewClusters(overviewClusters);
        } else {
          const shadowBounds = cameraBounds(640);
          const shadowCandidates = snapshot ? replayObjectsInBounds(snapshot, shadowBounds).structures : spatialObjectsInBounds(shadowBounds).structures;
          const visibleShadowStructures = shadowCandidates.filter(item => objectVisibleToFog(item, state.fogPlayer, item.hitbox ? Math.max(item.hitbox.w, item.hitbox.h) / 2 : 0));
          drawStructureShadows(snapshot, visibleShadowStructures);
          drawUnitShadows(snapshot, renderObjects.units);
          drawStructures(snapshot, renderObjects.structures);
          drawTransports();
          drawSquads(snapshot, renderObjects.units);
          for (const unit of renderObjects.units) drawUnit(unit);
        }
        drawProjectiles();
        drawDynamicLighting();
        drawLightingOverlay();
        drawFog();
        drawEditorCursor();
        drawMinimap();
      }

      function updateSelectedUnit() {
        const unit = state.units.find(item => item.id === state.selectedId);
        if (!unit) return;
        if (!objectVisibleToFog(unit)) {
          state.selectedId = null;
          setInspector(false);
          return;
        }
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
        els.unitStats.textContent = `Accuracy ${(unit.accuracy * 100).toFixed(1)} · Precision ${(unit.precision * 100).toFixed(1)} · Reflexes ${(unit.reflexes * 100).toFixed(0)} · ${unit.personality} · ${view.combatIntent || unit.combatIntent} ${view.killConfidence ?? unit.killConfidence}%`;
        els.unitKills.textContent = `${unit.kills} confirmed`;
        const light = lightingAt(view, unit.faction, currentSnapshot()?.t ?? state.time);
        const lightingState = !state.lighting.enabled ? "Lighting disabled" : light.searchlight > 0.15 ? "Searchlight exposed" : light.shadowed ? "Shadow cover" : `${light.period} light`;
        const social = strongestRelationships(unit).map(item => `${item.other.name}: ${relationshipBand(item.score)} (${Math.round(item.score)})`).join(" · ");
        els.unitDepth.textContent = `Age ${unit.age} · XP ${unit.experience} · Courage ${(unit.courage * 100).toFixed(0)} · Discipline ${(unit.discipline * 100).toFixed(0)} · ${unit.armor} · ${unit.weapon} · ${lightingState}${social ? ` · Bonds: ${social}` : " · Bonds forming"}`;
        if (squad) {
          const healthy = members.filter(member => member.hp / member.maxHp > 0.7).length;
          const critical = members.filter(member => member.hp / member.maxHp < 0.3).length;
          els.squadSummary.textContent = `${squad.name} · ${members.length}/${squad.nominalSize || members.length} · ${squad.formation || "line"} · ${squad.orderType || "Advance"}${squad.routePhase ? ` / ${squad.routePhase}` : ""} · cohesion ${Math.round((squad.cohesion || 0) * 100)}% · ${healthy} healthy · ${critical} critical · ${squad.leadershipState || "Assigned leader"} · ${squad.reinforcementState || "No reinforcement request"} · Combined health ${hp}%`;
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
        updateExploration(0, true);
        state.minimapMarkerDirty = true;
        rebuildUnitSelect();
        const selectedStructure = state.structures.find(item => item.id === state.selectedStructureId);
        if (selectedStructure && !objectVisibleToFog(selectedStructure, state.fogPlayer, selectedStructure.hitbox ? Math.max(selectedStructure.hitbox.w, selectedStructure.hitbox.h) / 2 : 0)) {
          state.selectedStructureId = null;
          setLogisticsPanel(false);
        }
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
        const armyPlan = state.armyPlans[player.id] || { goal: "Establish foothold" };
        const strategicOutcome = state.strategicOutcomes[player.id]?.status || "Building operational capability";
        const pressureLabel = economy.territoryPressure > 0 ? ` · Territory support pressure ${Math.round(economy.territoryPressure * 100)}%` : "";
        els.logisticsPersonality.textContent = `${economy.personality} commander · Army goal: ${armyPlan.goal} · ${strategicOutcome}${pressureLabel} · ${economy.emergency}`;
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
        const routeOrders = state.squads.filter(squad => squad.faction === player.id && routeOrderTypes.includes(squad.orderType));
        const routeState = state.roads.filter(road => areAllies(road.faction, player.id));
        const guardSquads = state.squads.filter(squad => squad.faction === player.id && String(squad.templateId).startsWith("guard-"));
        replaceLogisticsList(els.logisticsOfficers, [
          `Army → Commander → Squad → Individual · ${routeOrders.length} route orders active`,
          `Routes · ${routeState.filter(road => road.status === "Secured").length} secured · ${routeState.filter(road => road.status === "Contested").length} contested · ${routeState.filter(road => road.status === "Damaged" || road.status === "Blocked").length} damaged/blocked · ${routeState.reduce((sum, road) => sum + (road.segments || []).filter(segment => segment.checkpoint).length, 0)} checkpoints`,
          ...(guardSquads.length ? [`Imperial Guard · ${guardSquads.length} atomic squads · ${guardSquads.map(squad => `${squad.name}: ${squad.reinforcementState}`).join("; ")}`] : []),
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
        const territoryCellCount = state.territories.reduce((sum, territory) => sum + (territory.claimedCells?.size || 0), 0);
        const activeConvoys = state.convoys.filter(item => !item.finished).length;
        els.buildingContext.textContent = `${state.territories.filter(item => item.cellBacked).length} primary territories · ${territoryCellCount} cells${contestedTerritories ? ` · ${contestedTerritories} contested` : ""} · ${activeConvoys} convoy${activeConvoys === 1 ? "" : "s"} · ${state.squads.length} squads · ${state.fogPlayer === "observer" ? "Fog ready" : "Fog active"}`;
        els.resolutionBadge.textContent = `${worldWidth()} × ${worldHeight()}`;
        els.timelineMode.textContent = state.replay ? "REPLAY / PAUSED" : state.paused ? "LIVE RECORD / PAUSED" : "LIVE RECORD";
        els.timelineTime.textContent = `${formatElapsed(displayTime)} / ${formatElapsed(state.time)}`;
        const view = state.fogPlayer === "observer" ? "Observer" : `P${playerFor(state.fogPlayer).index + 1} fog`;
        els.fieldMode.textContent = state.mode === "editor"
          ? `${worldWidth()} × ${worldHeight()} · World editor`
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
        updateExploration(0, true);
        els.overlay.hidden = true;
        els.editorBar.hidden = true;
        els.editorTip.hidden = true;
        setInspector(root.getBoundingClientRect().width > 680);
        els.battleName.textContent = `${state.scenario === "custom" ? "Custom world theater" : presets[state.scenario].name} / Autonomous base growth`;
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
            width: clamp(Number(els.customWidth.value) || DEFAULT_WORLD_SIZE, 2048, 65536),
            height: clamp(Number(els.customHeight.value) || DEFAULT_WORLD_SIZE, 2048, 65536)
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
          { x: clamp(player.base.x, 0, worldWidth()), y: clamp(player.base.y - size, 0, worldHeight()) },
          { x: clamp(player.base.x + size, 0, worldWidth()), y: clamp(player.base.y, 0, worldHeight()) },
          { x: clamp(player.base.x, 0, worldWidth()), y: clamp(player.base.y + size, 0, worldHeight()) },
          { x: clamp(player.base.x - size, 0, worldWidth()), y: clamp(player.base.y, 0, worldHeight()) }
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
        if (territory.cellBacked) {
          const requestedOwner = els.territoryOwner.value;
          const duplicatePrimary = state.territories.some(other => other !== territory && other.cellBacked && other.owner === requestedOwner);
          if (requestedOwner && !duplicatePrimary) territory.owner = requestedOwner;
          els.territoryOwner.value = territory.owner;
        } else {
          territory.owner = "";
          els.territoryOwner.value = "";
        }
        territory.startingOwner = territory.owner;
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
        state.minimapMarkerDirty = true;
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
        if (!territory || territory.locked || territory.cellBacked) {
          if (territory?.cellBacked) {
            els.editorTip.textContent = `${territory.name} is cell-backed; its single primary shape changes through AI expansion and capture decisions.`;
            return;
          }
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
        state.minimapMarkerDirty = true;
        els.editorTip.textContent = `${territory.name} · ${territory.points.length} anchors · ${mode}`;
        draw();
      }

      function invalidateLightingCaches() {
        lightSourceCacheKey = "";
        lightSourceChunks = new Map();
        lightingSampleCacheKey = "";
        shadowCacheBucket = "";
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
          x: clamp(point.x, 24, worldWidth() - 24),
          y: clamp(point.y, 24, worldHeight() - 24)
        };
        const zone = spawnZoneFor(player);
        if (zone.shape === "custom" && zone.points.length) {
          const dx = player.base.x - previous.x;
          const dy = player.base.y - previous.y;
          zone.points = zone.points.map(vertex => ({
            x: clamp(vertex.x + dx, 0, worldWidth()),
            y: clamp(vertex.y + dy, 0, worldHeight())
          }));
        }
        const builders = state.units.filter(unit => unit.faction === player.id && unit.role === "builder");
        builders.forEach((unit, index) => {
          unit.x = clamp(player.base.x + index * 8, 24, worldWidth() - 24);
          unit.y = clamp(player.base.y + index * 8, 24, worldHeight() - 24);
        });
        rebuildSpatialGrid();
        state.minimapMarkerDirty = true;
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
        const selectedWorld = selectedResolution();
        setWorldSize(selectedWorld.width, selectedWorld.height);
        state.players = setupPlayers.slice(0, count).map((player, index) => ({
          ...player,
          id: ids[index],
          index,
          base: deploymentPosition(index, count, state.world)
        }));
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
        setZoom("fit");
        els.battleName.textContent = `Untitled theater / ${worldWidth()} × ${worldHeight()} world editor`;
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

      function pointerPosition(event, allowOutsideWorld = false) {
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
        const point = {
          x: state.camera.x + (screenX - VW / 2) / state.camera.zoom,
          y: state.camera.y + (screenY - VH / 2) / state.camera.zoom
        };
        if (!allowOutsideWorld && (point.x < 0 || point.x > worldWidth() || point.y < 0 || point.y > worldHeight())) return null;
        return allowOutsideWorld ? {
          x: clamp(point.x, 0, worldWidth()),
          y: clamp(point.y, 0, worldHeight())
        } : point;
      }

      function pixelProbe(point) {
        const info = terrainAt(point);
        const pixelX = Math.floor(point.x);
        const pixelY = Math.floor(point.y);
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
          const sampled = featureAt(point);
          selectBrushPreset(sampled?.type || terrainTileAt(point).type);
          return;
        }
        if (mode === "remove") {
          const clearedTiles = paintTerrainTiles(point, state.world.baseTerrain, "remove");
          state.lastBrushPoint = { ...point };
          let removedFeatures = 0;
          for (const feature of visibleFeatures({ left: point.x, right: point.x, top: point.y, bottom: point.y })) {
            if (featureDistanceFromPoint(point, feature) <= Math.max(feature.r, state.brushRadius) * 0.72) {
              if (markFeatureDeleted(feature)) removedFeatures += 1;
            }
          }
          els.editorTip.textContent = `Erase terrain · ${clearedTiles} tile${clearedTiles === 1 ? "" : "s"} reset · ${removedFeatures} overlay${removedFeatures === 1 ? "" : "s"} removed`;
          draw();
          return;
        }
        if (state.brushOpacity <= 0) {
          els.editorTip.textContent = "Opacity 0% · no terrain change.";
          return;
        }
        const type = state.brush;
        if (isTileTerrainType(type)) {
          const changed = paintTerrainTiles(point, type, mode);
          state.lastBrushPoint = { ...point };
          els.editorTip.textContent = `${brushNames[type] || type} · ${changed} tile${changed === 1 ? "" : "s"} · chunked terrain`;
          pixelProbe(point);
          draw();
          return;
        }
        const spacing = Math.max(6, state.brushRadius * (state.brushShape === "line" ? 0.18 : 0.42));
        const existing = visibleFeatures({
          left: clamp(point.x - spacing, 0, worldWidth()),
          right: clamp(point.x + spacing, 0, worldWidth()),
          top: clamp(point.y - spacing, 0, worldHeight()),
          bottom: clamp(point.y + spacing, 0, worldHeight())
        }).reverse().find(feature => feature.type === type && featureDistanceFromPoint(point, feature) < spacing);
        if (existing && mode === "add") {
          existing.opacity = clamp((existing.opacity ?? 1) + state.brushOpacity * 0.25, 0, 1);
          existing.condition = 1;
          state.minimapTerrainDirty = true;
          pixelProbe(point);
          draw();
          return;
        }
        if (existing && mode !== "blend" && state.brushShape !== "line") {
          existing.opacity = Math.max(existing.opacity ?? 1, state.brushOpacity);
          existing.hardness = state.brushHardness;
          existing.falloff = state.brushFalloff;
          state.minimapTerrainDirty = true;
          pixelProbe(point);
          draw();
          return;
        }
        if (mode === "replace") {
          for (const feature of visibleFeatures({ left: point.x, right: point.x, top: point.y, bottom: point.y })) {
            if (weatherTypes.has(feature.type)) continue;
            if (featureDistanceFromPoint(point, feature) <= Math.max(feature.r, state.brushRadius) * 0.62) markFeatureDeleted(feature);
          }
        }
        const previous = state.lastBrushPoint || point;
        addIndexedFeature({
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

      function beginRightPan(event, trigger = "pointer") {
        if (!pointerPosition(event, true)) return false;
        state.panning = true;
        state.panPointerId = event.pointerId;
        state.panStart = {
          clientX: event.clientX,
          clientY: event.clientY,
          cameraX: state.camera.x,
          cameraY: state.camera.y,
          trigger
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
        canvas.style.cursor = state.spaceHeld ? "grab" : state.mode === "editor" && state.editorTool === "spawn" ? "move" : "crosshair";
      }

      canvas.addEventListener("pointerdown", event => {
        const panTrigger = event.button === 1 ? "middle" : event.button === 2 ? "right" : event.button === 0 && state.spaceHeld ? "space" : null;
        if (panTrigger) {
          event.preventDefault();
          beginRightPan(event, panTrigger);
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
          if (!objectVisibleToFog(unit)) continue;
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
          .filter(item => item.progress >= 0.35 && objectVisibleToFog(item, state.fogPlayer, item.hitbox ? Math.max(item.hitbox.w, item.hitbox.h) / 2 : 0))
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
                x: clamp(anchor.x + dx, 0, worldWidth()),
                y: clamp(anchor.y + dy, 0, worldHeight())
              }));
              const center = territoryCenter(territory);
              state.minimapMarkerDirty = true;
              els.editorTip.textContent = `Moving ${territory.name} · center (${Math.round(center.x)}, ${Math.round(center.y)})`;
              draw();
            } else if (territory && state.territoryDragIndex >= 0 && (event.buttons & 1)) {
              territory.points[state.territoryDragIndex] = { x: Math.round(state.hover.x), y: Math.round(state.hover.y) };
              state.minimapMarkerDirty = true;
              draw();
            } else {
              els.editorTip.textContent = `${territory?.name || "Territory"} · ${state.territoryEditMode} · world (${Math.floor(state.hover.x)}, ${Math.floor(state.hover.y)})`;
            }
          } else {
            const pixelX = Math.floor(state.hover.x);
            const pixelY = Math.floor(state.hover.y);
            els.editorTip.textContent = `${state.editorTool === "spawn" ? "Move spawn" : "Custom zone point"} · pixel (${pixelX}, ${pixelY})`;
          }
        }
      });
      canvas.addEventListener("pointerup", event => {
        if (state.panning) endRightPan(event);
        state.brushDown = false;
        state.lastBrushPoint = null;
        compactFeatureEdits();
        state.territoryDragIndex = -1;
        state.territoryDragStart = null;
      });
      canvas.addEventListener("pointercancel", event => {
        endRightPan(event);
        state.brushDown = false;
        state.lastBrushPoint = null;
        compactFeatureEdits();
        state.territoryDragIndex = -1;
        state.territoryDragStart = null;
      });
      canvas.addEventListener("pointerleave", () => {
        state.brushDown = false;
        state.territoryDragStart = null;
        state.hover = null;
        compactFeatureEdits();
      });
      canvas.addEventListener("contextmenu", event => event.preventDefault());
      canvas.addEventListener("wheel", event => {
        event.preventDefault();
        if (event.deltaY === 0) return;
        const focus = pointerPosition(event, true) || { x: state.camera.x, y: state.camera.y };
        const factor = event.ctrlKey ? 1.1 : 1.25;
        setZoom(state.camera.zoom * (event.deltaY < 0 ? factor : 1 / factor), focus);
      }, { passive: false });

      function recenterFromMinimap(event) {
        const rect = els.minimap.getBoundingClientRect();
        state.camera.x = clamp((event.clientX - rect.left) / rect.width * worldWidth(), 0, worldWidth());
        state.camera.y = clamp((event.clientY - rect.top) / rect.height * worldHeight(), 0, worldHeight());
        clampCamera();
        state.cameraFocus = { x: state.camera.x, y: state.camera.y };
        draw();
      }

      els.minimap.addEventListener("pointerdown", event => {
        event.preventDefault();
        els.minimap.setPointerCapture?.(event.pointerId);
        recenterFromMinimap(event);
      });
      els.minimap.addEventListener("pointermove", event => {
        if (event.buttons & 1) recenterFromMinimap(event);
      });
      els.minimap.addEventListener("pointerup", event => {
        try {
          if (els.minimap.hasPointerCapture?.(event.pointerId)) els.minimap.releasePointerCapture(event.pointerId);
        } catch {}
      });

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
      els.zoomOut.addEventListener("click", () => stepZoom(-1));
      els.zoomIn.addEventListener("click", () => stepZoom(1));
      els.zoomLevel.addEventListener("change", () => setZoom(els.zoomLevel.value, state.cameraFocus));
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
          state.players = setupPlayers.slice(0, 2).map((player, index) => ({ ...player, id: ids[index], index, base: deploymentPosition(index, 2, presets[button.dataset.scenario]?.world || state.world) }));
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
          if (state.camera.zoom > fitWorldZoom() + 0.0001) {
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
        if (event.code !== "Space" || event.repeat || ["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(event.target?.tagName)) return;
        if (!["editor", "sim"].includes(state.mode)) return;
        state.spaceHeld = true;
        canvas.classList.add("is-pan-ready");
        if (!state.panning) canvas.style.cursor = "grab";
        event.preventDefault();
      });
      document.addEventListener("keyup", event => {
        if (event.code !== "Space") return;
        state.spaceHeld = false;
        canvas.classList.remove("is-pan-ready");
        if (state.panning && state.panStart?.trigger === "space") endRightPan();
        else canvas.style.cursor = state.mode === "editor" && state.editorTool === "spawn" ? "move" : "crosshair";
      });
      window.addEventListener("blur", () => {
        state.spaceHeld = false;
        canvas.classList.remove("is-pan-ready");
        endRightPan();
        compactFeatureEdits();
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
        const center = state.cameraFocus || worldCenter();
        const territory = createTerritory("", center, 64, {
          name: `Territory ${state.nextTerritoryId - 1}`,
          points: [],
          status: "neutral",
          reason: "Map creator"
        });
        state.territories.push(territory);
        state.minimapMarkerDirty = true;
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
          owner: "",
          startingOwner: "",
          cellBacked: false,
          claimedCells: new Set(),
          frontierCells: new Set(),
          influencedCells: new Set(),
          controlledCells: new Set(),
          contestedCells: new Set(),
          disconnectedCells: new Set(),
          cellPressure: new Map(),
          points: territory.points.map(point => ({ x: clamp(point.x + 18, 0, worldWidth()), y: clamp(point.y + 18, 0, worldHeight()) })),
          locked: false
        });
        state.territories.push(copy);
        state.minimapMarkerDirty = true;
        state.selectedTerritoryId = copy.id;
        rebuildTerritorySelect();
        loadTerritoryForm();
        draw();
      });
      root.querySelector("#awt-delete-territory").addEventListener("click", () => {
        const territory = selectedTerritory();
        if (!territory || territory.locked || territory.cellBacked) {
          if (territory?.cellBacked) els.editorTip.textContent = "Primary army territories cannot be deleted; edit their cells through simulation control.";
          return;
        }
        state.territories = state.territories.filter(item => item.id !== territory.id);
        state.minimapMarkerDirty = true;
        state.selectedTerritoryId = state.territories[0]?.id || null;
        rebuildTerritorySelect();
        loadTerritoryForm();
        draw();
      });
      els.randomizeMap.addEventListener("click", randomizeMap);
      root.querySelector("#awt-clear-map").addEventListener("click", () => {
        state.features = [];
        state.terrainChunks = new Map();
        state.world.baseTerrain = "grass";
        markFeatureIndexDirty();
        els.editorTip.textContent = "Map cleared · sparse tiles and overlays reset to grass.";
        draw();
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
        lightSourceCacheKey = "";
        lightSourceChunks = new Map();
        shadowCacheBucket = "";
        shadowSampleCache.clear();
        lightingSampleCacheKey = "";
        lightingSampleCache.clear();
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
        state.minimapTerrainDirty = true;
        state.minimapMarkerDirty = true;
        drawSpritePreview();
      }).observe(root, { attributes: true, attributeFilter: ["class", "style", "data-theme"], subtree: false });
      requestAnimationFrame(frame);
    })();
  
