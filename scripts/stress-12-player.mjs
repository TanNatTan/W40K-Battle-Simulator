import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { once } from "node:events";
import { createServer as createNetServer } from "node:net";
import {
  ALLIANCE_EVOLUTION_PLAYERS,
  evaluateAllianceEvolutionRun,
  nextEvolutionSeed
} from "../src/testing/AllianceEvolutionTestSystem.js";

const projectRoot = process.cwd();
const argumentValue = name => process.argv.find(argument => argument.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
const durationMs = Math.max(10_000, (Number(argumentValue("duration")) || 0) * 1000 || Number(process.env.AWT_STRESS_DURATION_MS) || 30_000);
const simulationSpeed = Math.max(1, Math.min(8, Number(argumentValue("speed") || process.env.AWT_STRESS_SPEED) || 8));
const spawnRadius = Math.max(24, Number(argumentValue("spawn-radius") || process.env.AWT_STRESS_SPAWN_RADIUS) || 84);
const twoVsTwo = process.argv.includes("--two-v-two");
const allianceEvolution = process.argv.includes("--alliance-evolution");
const allianceEvolutionSmoke = process.argv.includes("--alliance-evolution-smoke");
const playerCount = twoVsTwo || allianceEvolution ? 4 : Math.max(2, Math.min(12, Number(argumentValue("players")) || 12));
const expectedTeamCount = twoVsTwo || allianceEvolution ? 2 : Math.min(4, playerCount);
const performancePreset = ["auto", "skirmish", "battle", "major", "total"].includes(argumentValue("performance"))
  ? argumentValue("performance")
  : "total";
const fullRoster = process.argv.includes("--full-roster") || process.env.AWT_STRESS_FULL_ROSTER === "1";
const allSpaceMarines = process.argv.includes("--all-space-marines");
const constructionContinuation = process.argv.includes("--construction-continuation");
const expandedArmies = process.argv.includes("--expanded-armies");
const exactLoadUnits = Math.max(0, Math.floor(Number(argumentValue("load-units")) || 0));
const exactLoadBuildings = Math.max(0, Math.floor(Number(argumentValue("load-buildings")) || 0));
const territoryDevelopmentCaptures = Math.max(0, Math.floor(Number(argumentValue("territory-development-captures")) || 0));
const profiling = process.argv.includes("--profile") || process.env.AWT_STRESS_PROFILE === "1";
const diagnosticSnapshots = process.argv.includes("--diagnostic-snapshots");
const duelAuditEnabled = process.argv.includes("--duel-audit");
const spaceMarineGrowthAuditEnabled = process.argv.includes("--space-marine-growth");
const spaceMarineGrowthChapter = argumentValue("chapter") || "Ultramarines";
const evolutionIteration = Math.max(1, Math.floor(Number(argumentValue("iteration")) || 1));
const reportFile = argumentValue("report") ? resolve(argumentValue("report")) : null;
const suppliedProfile = argumentValue("profile-dir") ? resolve(argumentValue("profile-dir")) : null;
const suppliedServerPort = Math.max(0, Math.floor(Number(argumentValue("server-port")) || 0));
const browserPreference = String(argumentValue("browser") || "chrome").toLowerCase();
const chromiumCandidates = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium"
];
const browserPath = chromiumCandidates
  .sort((left, right) => Number(!left.toLowerCase().includes(browserPreference)) - Number(!right.toLowerCase().includes(browserPreference)))
  .find(existsSync);
if (!browserPath) throw new Error("Chrome or Edge is required for the 12-player stress test.");

const mime = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml", ".webp": "image/webp", ".png": "image/png"
};
const server = createServer(async (request, response) => {
  try {
    const requested = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const relative = requested === "/" ? "index.html" : requested.replace(/^\/+/, "");
    const path = normalize(join(projectRoot, relative));
    if (!path.startsWith(normalize(projectRoot))) throw new Error("Path escaped project root.");
    const body = await readFile(path);
    response.writeHead(200, { "content-type": mime[extname(path)] || "application/octet-stream" });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
});

async function freePort() {
  const probe = createNetServer();
  probe.listen(0, "127.0.0.1");
  await once(probe, "listening");
  const port = probe.address().port;
  probe.close();
  await once(probe, "close");
  return port;
}

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const profile = suppliedProfile || mkdtempSync(join(tmpdir(), "awt-12-player-stress-"));
if (suppliedProfile) mkdirSync(profile, { recursive: true });
let browser;
let socket;

try {
  server.listen(suppliedServerPort, "127.0.0.1");
  await once(server, "listening");
  const serverPort = server.address().port;
  const debugPort = await freePort();
  browser = spawn(browserPath, [
    "--headless=new", "--disable-extensions", "--no-first-run",
    "--disable-background-timer-throttling", "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows",
    "--disable-features=CalculateNativeWinOcclusion,IntensiveWakeUpThrottling,UseEcoQoSForBackgroundProcess",
    "--disable-background-networking", "--disable-component-update", "--disable-default-apps",
    "--disable-sync", "--metrics-recording-only", "--no-default-browser-check",
    `--user-data-dir=${profile}`, `--remote-debugging-port=${debugPort}`,
    "--window-size=1920,1080", "about:blank"
  ], { stdio: "ignore" });

  let target;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const targets = await fetch(`http://127.0.0.1:${debugPort}/json/list`).then(response => response.json());
      target = targets.find(candidate => candidate.type === "page");
      if (target) break;
    } catch {}
    await delay(100);
  }
  if (!target) throw new Error("Browser debugging target did not become available.");

  socket = new WebSocket(target.webSocketDebuggerUrl);
  await once(socket, "open");
  let sequence = 0;
  const pending = new Map();
  socket.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const request = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  });
  const command = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const withTimeout = (promise, milliseconds, label) => Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} exceeded ${milliseconds} ms; page is unresponsive.`)), milliseconds))
  ]);
  const evaluate = async (expression, timeoutMs = 5000) => {
    const startedAt = performance.now();
    const result = await withTimeout(command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }), timeoutMs, "Browser probe");
    if (result.exceptionDetails) {
      const detail = result.exceptionDetails.exception?.description || result.exceptionDetails.exception?.value || result.exceptionDetails.text;
      throw new Error(detail || "Browser evaluation failed.");
    }
    return { value: result.result.value, latencyMs: performance.now() - startedAt };
  };

  await command("Page.enable");
  await command("Runtime.enable");
  await command("Performance.enable");
  await command("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await command("Page.navigate", { url: `http://127.0.0.1:${serverPort}/${profiling ? "?profile" : ""}` });
  await command("Page.bringToFront");
  await command("Emulation.setFocusEmulationEnabled", { enabled: true });
  await command("Emulation.setIdleOverride", { isUserActive: true, isScreenUnlocked: true });
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const ready = await evaluate("document.querySelector('#autonomous-war-theater')?.dataset.foundryReady === 'true'").catch(() => ({ value: false }));
    if (ready.value) break;
    await delay(100);
  }

  await evaluate(`(() => {
    globalThis.awtStressMetrics = { frames: 0, maxFrameGapMs: 0, gapsOver500Ms: 0, longTasks: 0, maxLongTaskMs: 0, totalLongTaskMs: 0 };
    globalThis.awtFrameGapRing = { values: new Float32Array(8192), cursor: 0, size: 0 };
    globalThis.awtFrameGapEvents = [];
    let previous = performance.now();
    const monitor = now => {
      const gap = now - previous;
      previous = now;
      const metrics = globalThis.awtStressMetrics;
      const ring = globalThis.awtFrameGapRing;
      ring.values[ring.cursor] = gap;
      ring.cursor = (ring.cursor + 1) % ring.values.length;
      ring.size = Math.min(ring.values.length, ring.size + 1);
      metrics.frames += 1;
      metrics.maxFrameGapMs = Math.max(metrics.maxFrameGapMs, gap);
      if (gap >= 500) metrics.gapsOver500Ms += 1;
      if (gap >= 50 && globalThis.awtFrameGapEvents.length < 64) {
        const state = document.querySelector('#autonomous-war-theater')?.awtDebugState;
        globalThis.awtFrameGapEvents.push({ gap, at: now, simulationTime: state?.time || 0,
          units: state?.units?.length || 0, structures: state?.structures?.length || 0 });
      }
      requestAnimationFrame(monitor);
    };
    requestAnimationFrame(monitor);
    if (globalThis.PerformanceObserver?.supportedEntryTypes?.includes('longtask')) {
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          const metrics = globalThis.awtStressMetrics;
          metrics.longTasks += 1;
          metrics.maxLongTaskMs = Math.max(metrics.maxLongTaskMs, entry.duration);
          metrics.totalLongTaskMs += entry.duration;
        }
      }).observe({ entryTypes: ['longtask'] });
    }
  })()`);

  const setup = await evaluate(`(() => {
    const root = document.querySelector('#autonomous-war-theater');
    document.querySelector('#awt-create-map').click();
    const resolution = document.querySelector('#awt-map-resolution');
    resolution.value = '1920x1080';
    resolution.dispatchEvent(new Event('change', { bubbles: true }));
    const players = document.querySelector('#awt-player-count');
    players.value = '${playerCount}';
    players.dispatchEvent(new Event('change', { bubbles: true }));
    const scale = document.querySelector('#awt-scale-preset');
    scale.value = '${performancePreset}';
    scale.dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelector('#awt-configure-players').click();
    ${allianceEvolution ? `
    const alliancePlayers = ${JSON.stringify(ALLIANCE_EVOLUTION_PLAYERS)};
    const setAllianceSelect = (selector, value) => {
      const select = document.querySelector(selector);
      select.value = value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      if (select.value !== value) throw new Error('Could not configure ' + selector + ' as ' + value);
    };
    for (const configured of alliancePlayers) {
      document.querySelector('[data-player-tab="' + configured.slot + '"]').click();
      setAllianceSelect('#awt-player-race', configured.race);
      setAllianceSelect('#awt-player-faction', configured.faction);
      setAllianceSelect('#awt-player-subfaction', configured.subfaction);
      setAllianceSelect('#awt-player-team', configured.team);
      setAllianceSelect('#awt-player-battle-objective', 'annihilation');
    }
    ` : ""}
    ${spaceMarineGrowthAuditEnabled ? `
    const setGrowthSelect = (selector, value) => {
      const select = document.querySelector(selector);
      select.value = value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    };
    document.querySelector('[data-player-tab="0"]').click();
    setGrowthSelect('#awt-player-race', 'Imperium');
    setGrowthSelect('#awt-player-faction', 'Space Marines');
    setGrowthSelect('#awt-player-subfaction', ${JSON.stringify(spaceMarineGrowthChapter)});
    setGrowthSelect('#awt-player-team', '1');
    setGrowthSelect('#awt-player-battle-objective', 'annihilation');
    document.querySelector('[data-player-tab="1"]').click();
    setGrowthSelect('#awt-player-race', 'Orks');
    setGrowthSelect('#awt-player-faction', 'Orks');
    setGrowthSelect('#awt-player-subfaction', 'Goffs');
    setGrowthSelect('#awt-player-team', '2');
    setGrowthSelect('#awt-player-battle-objective', 'annihilation');
    ` : ""}
    ${allSpaceMarines ? `
    const chapters = ['Ultramarines', 'Blood Angels', 'Imperial Fists', 'Salamanders', 'Emerald Suns', 'White Scars', 'Raven Guard', 'Iron Hands', 'Space Wolves', 'Black Templars'];
    const setSelect = (selector, value) => {
      const select = document.querySelector(selector);
      select.value = value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    };
    for (let index = 0; index < ${playerCount}; index += 1) {
      document.querySelector('[data-player-tab="' + index + '"]').click();
      setSelect('#awt-player-race', 'Imperium');
      setSelect('#awt-player-faction', 'Space Marines');
      setSelect('#awt-player-subfaction', chapters[index % chapters.length]);
      setSelect('#awt-player-team', String(index % 4 + 1));
      setSelect('#awt-player-battle-objective', index % 2 ? 'territorial_domination' : 'annihilation');
    }
    ` : ""}
    document.querySelector('#awt-shape-map').click();
    ${twoVsTwo ? `
    for (let index = 0; index < root.awtDebugState.players.length; index += 1) {
      root.awtDebugState.players[index].team = index < 2 ? '1' : '2';
    }
    ` : ""}
    for (const player of root.awtDebugState.players) {
      player.battleObjective = 'annihilation';
      player.battleObjectivePlan = null;
      player.battleObjectiveState = null;
      player.spawnZone.size = ${spawnRadius};
    }
    if (${allianceEvolution}) {
      root.awtDebugState.battleSeed = ${JSON.stringify(nextEvolutionSeed("alliance-evolution", evolutionIteration))};
      for (const player of root.awtDebugState.players) {
        player.forceCapOverride = player.race === 'Orks' ? 280 : 240;
      }
    }
    if (${spaceMarineGrowthAuditEnabled}) {
      const marine = root.awtDebugState.players.find(player => player.faction === 'Space Marines');
      const opponent = root.awtDebugState.players.find(player => player.id !== marine?.id);
      if (marine) {
        marine.forceCapOverride = 220;
        const inventory = root.awtDebugState.economies[marine.id].inventory;
        for (const resource of Object.keys(inventory)) inventory[resource] = Math.max(inventory[resource], 6000);
      }
      if (opponent) opponent.forceCapOverride = 40;
    }
    const fixture = ${fullRoster ? `root.awtDebugControls.prepareFullRosterStressFixture(${spawnRadius})` : "null"};
    const exactLoad = ${exactLoadUnits || exactLoadBuildings
      ? `root.awtDebugControls.prepareExactLoadFixture(${exactLoadUnits || 310}, ${exactLoadBuildings || 111})`
      : "null"};
    if (${expandedArmies}) for (const player of root.awtDebugState.players) player.forceCapOverride = null;
    const territoryDevelopmentProbes = ${territoryDevelopmentCaptures > 0
      ? `root.awtDebugState.players.map(player => root.awtDebugControls.captureTerritoryDevelopmentProbe(player.id, ${territoryDevelopmentCaptures}))`
      : "[]"};
    globalThis.awtStressInitialStructureIds = new Set(root.awtDebugState.structures.map(structure => structure.id));
    globalThis.awtStressInitialUnitIds = new Set(root.awtDebugState.units.map(unit => unit.id));
    globalThis.awtStressInitialFactionUnits = Object.fromEntries(root.awtDebugState.players.map(player => [player.id,
      root.awtDebugState.units.filter(unit => unit.faction === player.id).length]));
    globalThis.awtStressInitialFactionBuildings = Object.fromEntries(root.awtDebugState.players.map(player => [player.id,
      root.awtDebugState.structures.filter(structure => structure.faction === player.id).length]));
    globalThis.awtStressConstructionLifecycle = { firstCompletionAt: null, maxConcurrentProjects: 0 };
    document.querySelector('#awt-deploy-map').click();
    if (${allianceEvolution}) root.awtDebugState.paused = true;
    if (${spaceMarineGrowthAuditEnabled}) {
      const marine = root.awtDebugState.players.find(player => player.faction === 'Space Marines');
      const opponent = root.awtDebugState.players.find(player => player.id !== marine?.id);
      // Keep a real hostile economy and combat force in the test, but make its
      // initial infrastructure durable enough that annihilation cannot stop the
      // mandatory ten-minute growth observation early.
      for (const structure of root.awtDebugState.structures.filter(item => item.faction === opponent?.id)) {
        structure.maxHp = Math.max(structure.maxHp || 1, 10_000_000);
        structure.hp = structure.maxHp;
        structure.condition = 1;
      }
      const recoveryBuilder = root.awtDebugState.units.find(unit => unit.faction === opponent?.id && unit.role === 'builder');
      if (recoveryBuilder) {
        recoveryBuilder.maxHp = Math.max(recoveryBuilder.maxHp || 1, 10_000_000);
        recoveryBuilder.hp = recoveryBuilder.maxHp;
      }
    }
    return {
      width: root.awtDebugState.world.width,
      height: root.awtDebugState.world.height,
      players: root.awtDebugState.players.length,
      races: root.awtDebugState.players.map(player => player.race),
      factions: root.awtDebugState.players.map(player => player.faction),
      subfactions: root.awtDebugState.players.map(player => player.subfaction),
      teams: new Set(root.awtDebugState.players.map(player => player.team)).size,
      builders: root.awtDebugState.units.filter(unit => unit.role === 'builder').length,
      mode: root.awtDebugState.mode,
      preset: root.awtDebugState.performanceRequested,
      profiling: ${profiling},
      speedRequested: ${simulationSpeed},
      spawnRadii: root.awtDebugState.players.map(player => player.spawnZone?.size || 0),
      fixture,
      exactLoad,
      territoryDevelopmentProbes,
      fixtureUnits: fixture ? fixture.players.reduce((sum, player) => sum + player.expectedUnitCount, 0) : 0,
      fixtureBuildings: fixture ? fixture.players.reduce((sum, player) => sum + player.expectedBuildingCount, 0) : 0,
      actualStressRosterUnits: root.awtDebugState.units.filter(unit => unit.stressRosterName).length,
      completedStructures: root.awtDebugState.structures.filter(structure => structure.progress >= 1 && structure.alive !== false).length,
      viewport: { width: innerWidth, height: innerHeight },
      error: root.dataset.runtimeError || null
    };
  })()`, 10_000);
  if (setup.value.width !== 1920 || setup.value.height !== 1080 || setup.value.players !== playerCount
    || setup.value.teams !== expectedTeamCount || setup.value.builders < playerCount * 2 || setup.value.mode !== "sim"
    || setup.value.preset !== performancePreset || setup.value.viewport.width !== 1920 || setup.value.viewport.height !== 1080
    || setup.value.spawnRadii.some(radius => radius !== spawnRadius)
    || (fullRoster && setup.value.fixture.players.some(player => player.missingUnits.length || player.missingBuildings.length
      || player.missingBranchUnits.length || player.expectedBuildingCount !== 13 || player.constructionOrder.length !== 13
      || player.productionScheduleLength < 1 || player.caretakerUnfilled !== 0 || player.caretakerAssigned < player.caretakerRequirement
      || player.unitsOutsideSpawnZone.length || player.buildingsOutsideSpawnZone.length))
    || (fullRoster && (setup.value.actualStressRosterUnits !== setup.value.fixtureUnits
      || (!setup.value.exactLoad && setup.value.completedStructures !== setup.value.fixtureBuildings)))
    || (exactLoadUnits > 0 && setup.value.exactLoad?.units !== exactLoadUnits)
    || (exactLoadBuildings > 0 && setup.value.exactLoad?.buildings !== exactLoadBuildings)
    || (allSpaceMarines && (setup.value.races.some(race => race !== "Imperium")
      || setup.value.factions.some(faction => faction !== "Space Marines")))
    || (allianceEvolution && setup.value.subfactions.some((subfaction, index) => subfaction !== ALLIANCE_EVOLUTION_PLAYERS[index].subfaction))
    || (territoryDevelopmentCaptures > 0 && setup.value.territoryDevelopmentProbes.some(probe => !probe
      || probe.captured < territoryDevelopmentCaptures || probe.developmentHistory.length < territoryDevelopmentCaptures))
    || setup.value.error) throw new Error(`Invalid stress setup: ${JSON.stringify(setup.value)}`);

  // Keep image decode out of the measured battle window. The live app begins
  // the same async decode on its setup screen, so this mirrors normal use.
  await evaluate("globalThis.awtProjectileAtlasReady || Promise.resolve(false)", 15_000);
  // Headless Chromium performs first-paint/JIT work in short bursts after
  // navigation. Warm the renderer while this benchmark battle is paused so
  // browser startup is not mislabeled as a battle-frame regression.
  await delay(allianceEvolution ? 5000 : 1500);
  if (allianceEvolution) {
    await evaluate(`(() => {
      const state = document.querySelector('#autonomous-war-theater').awtDebugState;
      state.paused = false;
      document.querySelector('[data-speed="${simulationSpeed}"]').click();
    })()`);
    // Let the browser hand off from CDP and compile each first-use simulation
    // path before the full-duration acceptance window begins.
    await delay(2000);
  }
  const measurementStart = await evaluate(`(() => {
    globalThis.awtStressMetrics = { frames: 0, maxFrameGapMs: 0, gapsOver500Ms: 0, longTasks: 0, maxLongTaskMs: 0, totalLongTaskMs: 0 };
    globalThis.awtFrameGapRing = { values: new Float32Array(8192), cursor: 0, size: 0 };
    globalThis.awtFrameGapEvents = [];
    const state = document.querySelector('#autonomous-war-theater').awtDebugState;
    globalThis.awtStressStartPositions = Object.fromEntries(state.units
      .filter(unit => unit.alive && !unit.incapacitated && !['builder', 'supply'].includes(unit.role))
      .map(unit => [unit.id, { x: unit.x, y: unit.y }]));
    state.paused = false;
    if (state.speed !== ${simulationSpeed}) document.querySelector('[data-speed="${simulationSpeed}"]').click();
    return { wallTime: performance.now(), simulationTime: state.time, frameCount: state.frameCount };
  })()`);
  const samples = [];
  const startedAt = performance.now();
  let stagnantSamples = 0;
  let maximumStagnantSamples = 0;
  let previousTime = -1;
  while (performance.now() - startedAt < durationMs) {
    // The alliance benchmark records every animation-frame gap in-page. A
    // single final state read avoids perturbing the renderer with deep CDP
    // serialization every half-second while retaining a hard timeout if the
    // page actually becomes unresponsive.
    await delay(allianceEvolution ? Math.max(1, durationMs - (performance.now() - startedAt)) : 500);
    const sample = await evaluate(`(() => {
      const root = document.querySelector('#autonomous-war-theater');
      const state = root.awtDebugState;
      const trackedCombatUnits = state.units.filter(unit => unit.alive && globalThis.awtStressStartPositions?.[unit.id]);
      const combatDisplacements = trackedCombatUnits.map(unit => {
        const start = globalThis.awtStressStartPositions[unit.id];
        return Math.hypot(unit.x - start.x, unit.y - start.y);
      });
      const territoryAgents = state.units.filter(unit => unit.alive && unit.territoryAgentMission?.expiresAt > state.time);
      const territoryAgentDisplacements = territoryAgents.map(unit => {
        const start = globalThis.awtStressStartPositions?.[unit.id];
        return start ? Math.hypot(unit.x - start.x, unit.y - start.y) : 0;
      });
      const newStructures = state.structures.filter(structure => !globalThis.awtStressInitialStructureIds?.has(structure.id));
      const completedNewStructures = newStructures.filter(structure => structure.progress >= 1 && structure.alive !== false);
      const lifecycle = globalThis.awtStressConstructionLifecycle;
      if (lifecycle.firstCompletionAt == null && completedNewStructures.length) {
        lifecycle.firstCompletionAt = Math.min(...completedNewStructures.map(structure => structure.completedAt ?? state.time));
      }
      const activeProjectsByFaction = state.players.map(player => state.structures.filter(structure => structure.faction === player.id
        && structure.alive !== false && structure.progress < 1 && structure.construction?.state !== 'cancelled').length);
      lifecycle.maxConcurrentProjects = Math.max(lifecycle.maxConcurrentProjects, ...activeProjectsByFaction);
      const continuedStructures = lifecycle.firstCompletionAt == null ? []
        : newStructures.filter(structure => structure.createdAt > lifecycle.firstCompletionAt + 0.0001);
      const duelAudit = ${duelAuditEnabled} ? state.players.map(player => {
        const structures = state.structures.filter(structure => structure.faction === player.id);
        const operational = structures.filter(structure => structure.alive !== false && structure.progress >= 1);
        const livingUnits = state.units.filter(unit => unit.alive && !unit.incapacitated && unit.faction === player.id);
        const producedUnits = livingUnits.filter(unit => unit.deployment?.sourceType === 'building');
        const combatUnits = livingUnits.filter(unit => !['builder', 'supply'].includes(unit.role));
        const footprint = structure => ({
          left: structure.x - (structure.hitbox?.w || 24) / 2,
          right: structure.x + (structure.hitbox?.w || 24) / 2,
          top: structure.y - (structure.hitbox?.h || 20) / 2,
          bottom: structure.y + (structure.hitbox?.h || 20) / 2
        });
        const placementOverlaps = [];
        for (let leftIndex = 0; leftIndex < operational.length; leftIndex += 1) {
          for (let rightIndex = leftIndex + 1; rightIndex < operational.length; rightIndex += 1) {
            const left = footprint(operational[leftIndex]);
            const right = footprint(operational[rightIndex]);
            if (left.left < right.right && left.right > right.left && left.top < right.bottom && left.bottom > right.top) {
              placementOverlaps.push([operational[leftIndex].id, operational[rightIndex].id]);
            }
          }
        }
        const economy = state.economies[player.id];
        const completionOrder = [...structures]
          .filter(structure => structure.completedAt != null)
          .sort((left, right) => left.completedAt - right.completedAt)
          .map(structure => ({ type: structure.type, name: structure.displayName || structure.type, completedAt: structure.completedAt }));
        return {
          faction: player.id,
          race: player.race,
          army: player.faction,
          subfaction: player.subfaction,
          defeated: Boolean(state.strategicOutcomes?.[player.id]?.defeated),
          combatants: combatUnits.length,
          producedUnits: producedUnits.length,
          producedVehicles: producedUnits.filter(unit => unit.role === 'vehicle').length,
          productionSequence: player.productionSequence || 0,
          lastProductionDirective: player.lastProductionDirective || null,
          activeTrainingOrders: (economy?.queue || []).filter(request => request.type === 'train'
            && !['Delivered', 'Denied', 'Complete'].includes(request.status)).map(request => ({ status: request.status, producerId: request.producerId || null })),
          operationalBuildings: operational.map(structure => structure.type),
          chapterBarracksAlive: operational.some(structure => structure.type === 'barracks'),
          headquartersAlive: operational.some(structure => structure.type === 'outpost'),
          completionOrder,
          placementOverlaps,
          squads: state.squads.filter(squad => squad.faction === player.id
            && state.units.some(unit => unit.alive && unit.squadId === squad.id))
            .map(squad => ({ formation: squad.formation, role: squad.primaryRole || null, order: squad.orderType || squad.currentObjective || null })),
          tacticalStates: [...new Set(combatUnits.map(unit => unit.status))].slice(0, 12),
          assignedCombatants: combatUnits.filter(unit => unit.squadId || unit.territoryAgentMission || unit.cachedObjective).length,
          combatantsAwayFromBase: combatUnits.filter(unit => Math.hypot(unit.x - player.base.x, unit.y - player.base.y) >= 60).length
        };
      }) : [];
      const spaceMarineGrowthAudit = ${spaceMarineGrowthAuditEnabled} ? (() => {
        const player = state.players.find(candidate => candidate.faction === 'Space Marines');
        if (!player) return null;
        const livingInfantry = state.units.filter(unit => unit.alive && !unit.incapacitated
          && unit.faction === player.id && !['builder', 'supply', 'vehicle'].includes(unit.role)
          && !/skull probe|servo.?skull/i.test((unit.specialty || '') + ' ' + (unit.name || '')));
        const squadAudits = state.squads.filter(squad => squad.faction === player.id).map(squad => {
          const members = livingInfantry.filter(unit => unit.squadId === squad.id);
          return { id: squad.id, nominalSize: squad.nominalSize || 0, livingMembers: members.length, templateId: squad.templateId || null };
        }).filter(squad => squad.livingMembers > 0);
        const captureHistory = player.territoryAgentHistory || [];
        const operationalDefenses = state.structures.filter(structure => structure.faction === player.id
          && structure.alive !== false && structure.progress >= 1 && ['bunker', 'turret'].includes(structure.type));
        const deployedPods = state.dropPods.filter(pod => pod.faction === player.id && pod.deployedUnitCount != null);
        return {
          infantry: livingInfantry.length,
          productionSequence: player.productionSequence || 0,
          lastProductionDirective: player.lastProductionDirective || null,
          forceCap: player.forceCapOverride || null,
          productionQueue: (state.economies[player.id]?.queue || []).filter(request => request.type === 'train')
            .map(request => ({ key: request.key, status: request.status, producerTypes: request.producerTypes || [], manifest: request.productionManifest?.map(member => member.name) || [] })),
          economyInventory: { ...(state.economies[player.id]?.inventory || {}) },
          productionBuildings: state.structures.filter(structure => structure.faction === player.id
            && ['barracks', 'armory', 'airpad'].includes(structure.type)).map(structure => ({
              type: structure.type,
              progress: structure.progress,
              condition: structure.condition,
              nextTrainingAt: structure.nextTrainingAt || 0,
              inventory: { ...(structure.inventory || {}) }
            })),
          squads: squadAudits.length,
          fullTenMarineSquads: squadAudits.filter(squad => squad.nominalSize === 10 && squad.livingMembers === 10).length,
          squadAudits,
          scoutCaptureAssignments: captureHistory.filter(entry => /scout marine/i.test(entry.unitName || '')).length,
          skullProbeCaptureAssignments: captureHistory.filter(entry => /skull probe|servo.?skull/i.test(entry.unitName || '')).length,
          eliminatorCaptureAssignments: captureHistory.filter(entry => /eliminator/i.test(entry.unitName || '')).length,
          buildingsLost: player.buildingsLost || 0,
          capturedTerritoriesLost: player.capturedTerritoryCellsLost || 0,
          operationalDefenses: operationalDefenses.map(structure => structure.type),
          deployedDropPods: deployedPods.length,
          dropPodDeployments: deployedPods.map(pod => ({
            units: pod.deployedUnitCount,
            landingScore: pod.landingScore,
            minimumLandingScore: pod.minimumLandingScore,
            antiAir: pod.antiAirRisk || 0
          })),
          smartDropPods: deployedPods.length > 0 && deployedPods.every(pod => pod.deployedUnitCount === 4
            && Number(pod.landingScore) >= Number(pod.minimumLandingScore) && (Number(pod.antiAirRisk) || 0) <= 2.5)
        };
      })() : null;
      return {
        wallTime: performance.now(), simulationTime: state.time, frameCount: state.frameCount,
        lastSuccessfulSimulationAt: state.lastSuccessfulSimulationAt, paused: state.paused, ended: state.ended,
        units: state.units.length, livingUnits: state.units.filter(unit => unit.alive).length,
        structures: state.structures.length, squads: state.squads.length, projectiles: state.projectiles.length,
        casualties: Object.values(state.casualties).reduce((sum, value) => sum + value, 0),
        activeBuilders: state.units.filter(unit => unit.alive && unit.role === 'builder' && unit.buildProject).length,
        speed: state.speed,
        lastFrameFailure: state.lastFrameFailure || null,
        awarenessBudgetUsed: state.awarenessBudgetUsed,
        sensorBudgetUsed: state.sensorBudgetUsed,
        preset: state.performancePreset.id, workerProcessed: state.distantCombatSummary?.processed || 0,
        failures: state.frameFailures, error: root.dataset.runtimeError || null,
        movement: {
          trackedCombatUnits: trackedCombatUnits.length,
          movedCombatUnits: combatDisplacements.filter(value => value >= 12).length,
          maximumDisplacement: Math.max(0, ...combatDisplacements)
        },
        territoryAgents: {
          assigned: territoryAgents.length,
          moved: territoryAgentDisplacements.filter(value => value >= 8).length,
          frontierContacts: state.players.reduce((sum, player) => sum + (player.frontierContacts?.length || 0), 0),
          byFaction: state.players.map(player => ({
            faction: player.id,
            assigned: territoryAgents.filter(unit => unit.faction === player.id).length,
            planned: player.territoryAgentMissions?.length || 0
          }))
        },
        forceProfiles: state.players.map(player => {
          const living = state.units.filter(unit => unit.alive && !unit.incapacitated && unit.faction === player.id);
          return {
            faction: player.id,
            combatants: living.filter(unit => !['builder', 'supply'].includes(unit.role)).length,
            vehicles: living.filter(unit => unit.role === 'vehicle').length,
            builders: living.filter(unit => unit.role === 'builder').length,
            builderDesired: player.builderWorkforce?.desired || 0,
            builderHardCap: player.builderWorkforce?.hardCap || 0,
            reinforcementCapacity: player.forceState?.reinforcementCapacity || 0,
            commitment: player.forceState?.commitment || 0,
            workflow: player.decisionWorkflow?.current?.id || null,
            constructionStatus: player.constructionQueueStatus || null,
            ...(${diagnosticSnapshots} ? {
              structuresState: state.structures.filter(structure => structure.faction === player.id).map(structure => ({
                id: structure.id,
                type: structure.type,
                progress: Number(structure.progress) || 0,
                priority: Number(structure.priority) || 0,
                constructionState: structure.construction?.state || null,
                reason: structure.strategicReason || null,
                x: Math.round(structure.x),
                y: Math.round(structure.y)
              })),
              productionBuildings: state.structures.filter(structure => structure.faction === player.id
                && ['barracks', 'workshop', 'dropbay'].includes(structure.type)).map(structure => ({
                  type: structure.type,
                  progress: Number(structure.progress) || 0,
                  assignedBuilders: structure.assignedBuilderIds?.length || 0,
                  inventory: { ...(structure.inventory || {}) },
                  nextTrainingAt: Number(structure.nextTrainingAt) || 0
                })),
              buildersState: living.filter(unit => unit.role === 'builder').map(unit => ({
                id: unit.id,
                status: unit.status,
                buildProject: unit.buildProject || null,
                homeStructureId: unit.homeStructureId || null,
                x: Math.round(unit.x),
                y: Math.round(unit.y)
              })),
              trainRequests: (state.economies[player.id]?.queue || []).filter(request => request.type === 'train')
                .map(request => ({ status: request.status, label: request.label, manifest: request.productionManifest?.map(member => member.name) || [] }))
            } : {})
          };
        }),
        frameMonitor: { ...globalThis.awtStressMetrics },
        frameReadings: {
          fps: state.frameMetrics?.fps || 0,
          averageMs: state.frameMetrics?.averageMs || 0,
          worstMs: state.frameMetrics?.worstMs || 0,
          onePercentLowFps: state.frameMetrics?.lowOnePercentFps || 0
        },
        simulationFrame: { ...(state.lastSimulationFrame || {}) },
        construction: {
          newStructures: newStructures.length,
          completedNewStructures: completedNewStructures.length,
          firstCompletionAt: lifecycle.firstCompletionAt,
          continuedStructures: continuedStructures.length,
          maximumProgress: Math.max(0, ...newStructures.map(structure => Number(structure.progress) || 0)),
          progressingStructures: newStructures.filter(structure => Number(structure.progress) > 0).length,
          maxConcurrentProjects: lifecycle.maxConcurrentProjects,
          activeProjectsByFaction,
          developmentOrdersByFaction: state.players.map(player => ({
            faction: player.id,
            captures: player.territoryCaptureCount || 0,
            evaluated: (player.territoryDevelopmentHistory || []).length,
            total: (player.territoryDevelopmentOrders || []).length,
            categories: (player.territoryDevelopmentHistory || []).reduce((counts, entry) => {
              counts[entry.category] = (counts[entry.category] || 0) + 1;
              return counts;
            }, {}),
            materialized: (player.territoryDevelopmentOrders || []).filter(order => order.structureId
              && state.structures.some(structure => structure.id === order.structureId && structure.developsTerritoryCell === order.cellKey)).length,
            complete: (player.territoryDevelopmentOrders || []).filter(order => order.status === 'complete').length
          }))
        },
        duelAudit,
        spaceMarineGrowthAudit
      };
    })()`);
    samples.push({ ...sample.value, probeLatencyMs: sample.latencyMs });
    if (sample.value.simulationTime <= previousTime + 0.0001) stagnantSamples += 1;
    else stagnantSamples = 0;
    maximumStagnantSamples = Math.max(maximumStagnantSamples, stagnantSamples);
    previousTime = sample.value.simulationTime;
    if (sample.value.paused || sample.value.failures || sample.value.error) break;
  }

  const first = samples.length > 1 ? samples[0] : {
    ...measurementStart.value,
    frameMonitor: { frames: 0 },
    probeLatencyMs: measurementStart.latencyMs
  };
  const last = samples.at(-1);
  const maximumProbeLatencyMs = Math.max(...samples.map(sample => sample.probeLatencyMs));
  const frameGaps = allianceEvolution ? await evaluate(`(() => {
    const ring = globalThis.awtFrameGapRing;
    if (!ring) return [];
    if (ring.size < ring.values.length) return Array.from(ring.values.slice(0, ring.size));
    return [...ring.values.slice(ring.cursor), ...ring.values.slice(0, ring.cursor)];
  })()`).then(result => result.value) : [];
  const percentile = (values, value) => {
    if (!values.length) return Infinity;
    const sorted = [...values].sort((left, right) => left - right);
    return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * value) - 1))];
  };
  const fiveSecondFps = [];
  for (let start = 0; start < frameGaps.length; start += 1) {
    let elapsed = 0;
    let frames = 0;
    for (let index = start; index < frameGaps.length && elapsed < 5000; index += 1) {
      elapsed += frameGaps[index];
      frames += 1;
    }
    if (elapsed >= 5000) fiveSecondFps.push(frames / (elapsed / 1000));
  }
  const gapWindowFps = gaps => gaps.length
    ? gaps.length / (gaps.reduce((sum, gap) => sum + gap, 0) / 1000)
    : 0;
  const gapQuarter = Math.max(1, Math.floor(frameGaps.length / 4));
  const performanceAudit = allianceEvolution ? {
    averageFps: last.frameMonitor.frames / Math.max(0.001, (last.wallTime - measurementStart.value.wallTime) / 1000),
    onePercentLowFps: 1000 / Math.max(0.001, percentile(frameGaps, 0.99)),
    minimumFiveSecondFps: fiveSecondFps.length ? Math.min(...fiveSecondFps) : 0,
    maximumFrameMs: frameGaps.length ? Math.max(...frameGaps) : Infinity,
    p95FrameMs: percentile(frameGaps, 0.95),
    progressiveDecline: frameGaps.length >= 8
      && gapWindowFps(frameGaps.slice(-gapQuarter)) < gapWindowFps(frameGaps.slice(0, gapQuarter)) * 0.85
  } : null;
  const allianceAudit = allianceEvolution ? await evaluate(`(() => {
    const root = document.querySelector('#autonomous-war-theater');
    const state = root.awtDebugState;
    const range = (a, b) => Math.hypot((a.x || 0) - (b.x || 0), (a.y || 0) - (b.y || 0));
    const living = unit => unit.alive !== false && !unit.incapacitated;
    const operational = structure => structure.alive !== false && structure.progress >= 1;
    const text = subject => ((subject.name || '') + ' ' + (subject.specialty || '') + ' ' + (subject.unitType || '')).toLowerCase();
    return state.players.map(player => {
      const units = state.units.filter(unit => unit.faction === player.id && living(unit));
      const infantry = units.filter(unit => !['builder', 'supply', 'vehicle', 'aircraft'].includes(unit.role)
        && !/skull probe|servo.?skull/.test(text(unit)));
      const vehicles = units.filter(unit => ['vehicle', 'aircraft'].includes(unit.role));
      const structures = state.structures.filter(structure => structure.faction === player.id && operational(structure));
      const squads = state.squads.filter(squad => squad.faction === player.id);
      const viableSquads = squads.filter(squad => infantry.filter(unit => unit.squadId === squad.id).length >= 5);
      const primary = state.territories.find(territory => territory.cellBacked && territory.owner === player.id);
      const claimedCells = primary?.claimedCells?.size || 0;
      const forwardStructures = structures.filter(structure => range(structure, player.base) >= 220);
      const defenses = forwardStructures.filter(structure => ['bunker', 'turret', 'observationtower', 'forwardoutpost'].includes(structure.type));
      const forwardLogistics = forwardStructures.filter(structure => structure.type === 'forwardoutpost');
      const ally = state.players.find(candidate => candidate.id !== player.id && String(candidate.team) === String(player.team));
      const allyUnits = ally ? state.units.filter(unit => unit.faction === ally.id && living(unit)) : [];
      const allySupport = units.filter(unit => allyUnits.some(candidate => range(unit, candidate) <= 105)
        && units.some(friend => friend.id !== unit.id && range(unit, friend) <= 75)).length;
      const orders = squads.map(squad => (squad.orderType || '') + ' ' + (squad.routePhase || '')).join('|').toLowerCase();
      const heavyRanged = infantry.filter(unit => /devastator|hellblaster|eradicat|eliminator|heavy|lascannon|plasma/.test(text(unit))).length;
      const assaultStrength = infantry.filter(unit => /assault|jump|inceptor|sanguinary|bladeguard|vanguard/.test(text(unit))).length;
      const meleeStrength = infantry.filter(unit => /slugga|choppa|nob|stormboy|kommando|meganob|warboss/.test(text(unit))
        || (unit.range || 999) <= 45).length;
      const rangedStrength = infantry.filter(unit => /shoota|tankbusta|flash git|loota|big mek/.test(text(unit))
        || (unit.range || 0) >= 80).length;
      const doctrinePatterns = player.subfaction === 'Ironjaw Mob'
        ? [/slugga/, /nob/, /tankbusta/]
        : [/shoota/, /tankbusta/, /nob/, /big mek/];
      const coreDoctrineUnits = doctrinePatterns.filter(pattern => infantry.some(unit => pattern.test(text(unit)))).length;
      const bannerUnits = units.filter(unit => unit.role === 'standard' || /waa+gh.*banner|banner.*nob/.test(text(unit)));
      const bannerStructures = structures.filter(structure => structure.type === 'waaaghbanner' || /waa+gh.*banner/.test((structure.displayName || '').toLowerCase()));
      const clusters = new Map();
      for (const unit of infantry) {
        const key = Math.floor(unit.x / 100) + ',' + Math.floor(unit.y / 100);
        clusters.set(key, (clusters.get(key) || 0) + 1);
      }
      const mobConcentrations = [...clusters.values()].filter(count => count >= 5).length;
      const vehicleSupport = vehicles.filter(vehicle => infantry.some(unit => range(vehicle, unit) <= 120)).length;
      const economy = state.economies[player.id] || { inventory: {}, queue: [] };
      const producedUnits = Math.max(Number(player.productionSequence) || 0,
        globalThis.awtStressInitialFactionUnits?.[player.id] == null ? 0 : units.length - globalThis.awtStressInitialFactionUnits[player.id]);
      const newBuildings = Math.max(0, state.structures.filter(structure => structure.faction === player.id).length
        - (globalThis.awtStressInitialFactionBuildings?.[player.id] || 0));
      const producerAlive = structures.some(structure => ['outpost', 'barracks', 'workshop', 'airpad'].includes(structure.type));
      const builders = units.filter(unit => unit.role === 'builder');
      const frontlineDistant = units.some(unit => range(unit, player.base) >= 360);
      const importantForwardAreas = Math.min(2, Math.max(0, Math.floor(claimedCells / 5)));
      const objectivePresence = units.filter(unit => range(unit, player.base) >= 180 || unit.territoryAgentMission).length;
      const mapPresence = units.length ? units.filter(unit => range(unit, player.base) >= 90).length / units.length : 0;
      const fastVehicles = vehicles.filter(unit => (unit.speed || unit.vehicleState?.baseSpeed || 0) >= 34).length;
      return {
        factionId: player.id,
        subfaction: player.subfaction,
        objectiveActive: Boolean(player.battleObjective),
        economyOperational: producerAlive && Object.values(economy.inventory || {}).some(value => Number(value) > 0),
        builderReplacement: builders.length >= 1 && producerAlive,
        infantry: infantry.length,
        vehicles: vehicles.length,
        producedUnits,
        newBuildings,
        frontlineDistant,
        forwardLogistics: forwardLogistics.length,
        mapPresence,
        viableSquads: viableSquads.length,
        heavyRanged,
        defensiveForwardPositions: defenses.length,
        importantForwardAreas,
        coveredForwardAreas: Math.min(importantForwardAreas, defenses.length),
        counterattacks: /counter|reinforce contact|defend/.test(orders) ? 1 : 0,
        offensiveContribution: units.reduce((sum, unit) => sum + (unit.kills || 0), 0) + Math.max(0, (player.territoryCaptureCount || 0)),
        allySupport,
        assaultStrength,
        jumpMissions: infantry.filter(unit => /assault|jump|inceptor|sanguinary/.test(text(unit)) && (unit.targetId || range(unit, player.base) > 150)).length,
        regroups: /regroup/.test(orders) || infantry.some(unit => unit.retreating) ? 1 : 0,
        fastVehicles,
        repeatedFailedAttacks: Number(player.repeatedFailedAttacks) || 0,
        objectivePresence,
        meleeStrength,
        rangedStrength,
        coreDoctrineUnits,
        waaaghBannerAnchors: bannerUnits.length + bannerStructures.length,
        mobConcentrations,
        vehicleSupport,
        scrap: Number(economy.inventory?.scrap) || 0,
        ammunition: Number(economy.inventory?.ammunition) || 0,
        mekInfrastructureAlive: structures.some(structure => ['workshop', 'signature'].includes(structure.type)),
        claimedCells,
        requisition: Number(economy.inventory?.requisition) || 0,
        defeat: Boolean(state.strategicOutcomes?.[player.id]?.defeated)
      };
    });
  })()`, 10_000).then(result => result.value) : [];
  const allianceEvaluation = allianceEvolution ? evaluateAllianceEvolutionRun(allianceAudit, performanceAudit) : null;
  const report = {
    setup: setup.value,
    durationMs: performance.now() - startedAt,
    samples: samples.length,
    simulationSecondsAdvanced: last.simulationTime - first.simulationTime,
    framesAdvanced: last.frameCount - first.frameCount,
    averageRafFps: last.frameMonitor.frames / Math.max(0.001, (last.wallTime - measurementStart.value.wallTime) / 1000),
    maximumProbeLatencyMs,
    maximumStagnantSamples,
    maxFrameGapMs: last.frameMonitor.maxFrameGapMs,
    frameGapEvents: allianceEvolution ? await evaluate("globalThis.awtFrameGapEvents || []").then(result => result.value) : [],
    gapsOver500Ms: last.frameMonitor.gapsOver500Ms,
    longTasks: last.frameMonitor.longTasks,
    maxLongTaskMs: last.frameMonitor.maxLongTaskMs,
    totalLongTaskMs: last.frameMonitor.totalLongTaskMs,
    final: last,
    profiler: profiling ? await evaluate("globalThis.awtProfiler?.report?.() || []").then(result => result.value) : [],
    alliance: allianceEvolution ? { metrics: allianceAudit, performance: performanceAudit, evaluation: allianceEvaluation } : null
  };
  const frozen = !last || last.paused || last.failures > 0 || last.error
    || report.simulationSecondsAdvanced <= 1 || report.framesAdvanced <= 5
    || maximumStagnantSamples >= 4 || maximumProbeLatencyMs >= 1000 || report.maxFrameGapMs >= 500
    || last.movement.trackedCombatUnits > 0 && last.movement.movedCombatUnits < Math.max(1, Math.floor(last.movement.trackedCombatUnits * 0.05));
  console.log(JSON.stringify(report, null, 2));
  if (reportFile) {
    mkdirSync(dirname(reportFile), { recursive: true });
    writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }
  if (last.speed !== simulationSpeed) throw new Error(`Expected ${simulationSpeed}x simulation speed, received ${last.speed}x.`);
  if (constructionContinuation && (last.construction.completedNewStructures < 1
    || last.construction.continuedStructures < 1 || last.construction.maxConcurrentProjects < 2)) {
    throw new Error(`Construction did not remain parallel and continue after completion: ${JSON.stringify(last.construction)}`);
  }
  if (territoryDevelopmentCaptures > 0 && last.construction.developmentOrdersByFaction.some(faction => faction.captures < territoryDevelopmentCaptures
    || faction.evaluated < territoryDevelopmentCaptures)) {
    throw new Error(`Captured territory was not evaluated for natural development: ${JSON.stringify(last.construction.developmentOrdersByFaction)}`);
  }
  if (last.forceProfiles.some(profile => profile.builderHardCap > 0 && profile.builders > profile.builderHardCap)) {
    throw new Error(`A faction exceeded its builder hard ceiling: ${JSON.stringify(last.forceProfiles)}`);
  }
  if (expandedArmies && last.forceProfiles.some(profile => profile.reinforcementCapacity <= profile.combatants)) {
    throw new Error(`Expanded per-player force budget was not available: ${JSON.stringify(last.forceProfiles)}`);
  }
  if (spaceMarineGrowthAuditEnabled) {
    const growth = last.spaceMarineGrowthAudit;
    const failures = [];
    if (!growth || growth.infantry < 100) failures.push(`infantry ${growth?.infantry || 0}/100`);
    if (!growth || growth.fullTenMarineSquads < 10) failures.push(`full ten-Marine squads ${growth?.fullTenMarineSquads || 0}/10`);
    if (!growth || growth.scoutCaptureAssignments < 1) failures.push('Scout Marines never received a capture assignment');
    if (!growth || growth.skullProbeCaptureAssignments < 1) failures.push('Skull Probes never received a capture assignment');
    if (growth?.eliminatorCaptureAssignments > 0) failures.push(`Eliminators received ${growth.eliminatorCaptureAssignments} capture assignments`);
    if (!growth || growth.buildingsLost >= 7) failures.push(`lost ${growth?.buildingsLost ?? 'unknown'} buildings (limit 6)`);
    if (!growth || growth.capturedTerritoriesLost >= 5) failures.push(`lost ${growth?.capturedTerritoriesLost ?? 'unknown'} captured territories (limit 4)`);
    if (!growth || growth.operationalDefenses.length < 2) failures.push(`operational defenses ${growth?.operationalDefenses.length || 0}/2`);
    if (!growth || growth.deployedDropPods < 1) failures.push('no Drop Pod deployed');
    if (!growth?.smartDropPods) failures.push('Drop Pod safety or four-unit deployment rule failed');
    if (failures.length) throw new Error(`Space Marine growth audit failed: ${failures.join('; ')}. Snapshot: ${JSON.stringify(growth)}`);
  }
  if (allianceEvolution && !allianceEvolutionSmoke && !allianceEvaluation.passed) {
    throw new Error(`Alliance evolution audit failed: ${allianceEvaluation.failed.join("; ")}`);
  }
  if (frozen) throw new Error(`${playerCount}-player 1920x1080 simulation froze or became unresponsive: ${JSON.stringify(report)}`);
} finally {
  socket?.close();
  if (browser && browser.exitCode === null) {
    browser.kill();
    await Promise.race([once(browser, "exit").catch(() => {}), delay(2000)]);
  }
  server.close();
  if (!suppliedProfile) for (let attempt = 0; attempt < 8; attempt += 1) {
    try { rmSync(profile, { recursive: true, force: true, maxRetries: 2, retryDelay: 100 }); break; }
    catch (error) { if (attempt === 7) console.warn(error.message); await delay(200); }
  }
}
