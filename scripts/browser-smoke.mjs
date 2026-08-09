import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join, normalize } from "node:path";
import { once } from "node:events";
import { createServer as createNetServer } from "node:net";

const root = process.cwd();
const chromeCandidates = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium"
];
const browserPath = chromeCandidates.find(existsSync);
if (!browserPath) throw new Error("Chrome or Edge is required for the browser smoke test.");

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp"
};

const server = createServer(async (request, response) => {
  try {
    const requested = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const relative = requested === "/" ? "index.html" : requested.replace(/^\/+/, "");
    const path = normalize(join(root, relative));
    if (!path.startsWith(normalize(root))) throw new Error("Path escaped project root.");
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

const profile = mkdtempSync(join(tmpdir(), "awt-browser-smoke-"));
let browser;
let socket;

try {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const serverPort = server.address().port;
  const debugPort = await freePort();
  browser = spawn(browserPath, [
    "--headless=new", "--disable-gpu", "--disable-extensions", "--no-first-run",
    `--user-data-dir=${profile}`, `--remote-debugging-port=${debugPort}`, "--window-size=1440,900", "about:blank"
  ], { stdio: "ignore" });

  let target;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const targets = await fetch(`http://127.0.0.1:${debugPort}/json/list`).then(response => response.json());
      target = targets.find(item => item.type === "page");
      if (target) break;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (!target) throw new Error("Browser debugging target did not become available.");

  socket = new WebSocket(target.webSocketDebuggerUrl);
  await once(socket, "open");
  let sequence = 0;
  const pending = new Map();
  socket.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  });
  const command = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "Browser evaluation failed.");
    return result.result.value;
  };

  await command("Page.enable");
  await command("Runtime.enable");
  await command("Page.navigate", { url: `http://127.0.0.1:${serverPort}/` });
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const ready = await evaluate("document.querySelector('#autonomous-war-theater')?.dataset.foundryReady === 'true'").catch(() => false);
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  const startup = await evaluate(`(() => {
    const root = document.querySelector('#autonomous-war-theater');
    return { ready: root?.dataset.foundryReady, error: root?.dataset.runtimeError || null, moduleEntry: document.querySelector('script[type=module]')?.getAttribute('src'), economicMapDataVersion: globalThis.AWTData?.economicMaps?.version || null };
  })()`);
  if (startup.ready !== "true" || startup.economicMapDataVersion !== 1 || startup.error) throw new Error(`Startup failed: ${JSON.stringify(startup)}`);

  const playerSetup = await evaluate(`(() => {
    document.querySelector('#awt-create-map').click();
    document.querySelector('#awt-configure-players').click();
    const objective = document.querySelector('#awt-player-battle-objective');
    const race = document.querySelector('#awt-player-race');
    const subfaction = document.querySelector('#awt-player-subfaction');
    const result = {
      raceCount: race?.options?.length || 0,
      selectedRace: race?.value || null,
      subfactionCount: subfaction?.options?.length || 0,
      objectiveCount: objective?.options?.length || 0,
      selectedObjective: objective?.value || null,
      objectiveName: document.querySelector('#awt-objective-name')?.textContent || null,
      objectiveMethod: document.querySelector('#awt-objective-method')?.textContent || null,
      doctrineControl: Boolean(document.querySelector('#awt-player-doctrine')),
      presetControl: Boolean(document.querySelector('#awt-player-ai-preset')),
      temperamentControls: document.querySelectorAll('[id^="awt-ai-aggression"], [id^="awt-ai-caution"], [id^="awt-ai-expansion"], [id^="awt-ai-economy"]').length
    };
    document.querySelector('[data-player-tab="1"]').click();
    result.secondPlayer = {
      title: document.querySelector('#awt-player-panel-title')?.textContent || null,
      race: race.value,
      faction: document.querySelector('#awt-player-faction').value,
      subfaction: subfaction.value,
      objective: objective.value
    };
    race.value = 'Chaos';
    race.dispatchEvent(new Event('change', { bubbles: true }));
    result.changedRace = {
      race: race.value,
      faction: document.querySelector('#awt-player-faction').value,
      subfactionCount: subfaction.options.length,
      hasNightLords: [...subfaction.options].some(option => option.value === 'Night Lords'),
      objectiveCount: objective.options.length,
      objectiveName: document.querySelector('#awt-objective-name')?.textContent || null
    };
    document.querySelector('[data-player-tab="0"]').click();
    return result;
  })()`);
  if (playerSetup.raceCount !== 6 || playerSetup.selectedRace !== 'Imperium' || playerSetup.subfactionCount < 9
    || playerSetup.objectiveCount !== 18 || !playerSetup.selectedObjective || !playerSetup.objectiveName || !playerSetup.objectiveMethod
    || playerSetup.secondPlayer?.title !== 'Player 2 configuration' || playerSetup.secondPlayer?.race !== 'Orks'
    || playerSetup.changedRace?.race !== 'Chaos' || playerSetup.changedRace?.faction !== 'Chaos Space Marines'
    || playerSetup.changedRace?.subfactionCount < 9 || !playerSetup.changedRace?.hasNightLords
    || playerSetup.changedRace?.objectiveCount !== 18 || playerSetup.changedRace?.objectiveName !== "Slaughter in the Gods' Name"
    || playerSetup.doctrineControl || playerSetup.presetControl || playerSetup.temperamentControls) {
    throw new Error(`Battle objective setup failed: ${JSON.stringify(playerSetup)}`);
  }
  if (process.env.AWT_SMOKE_SETUP_SCREENSHOT) {
    const screenshot = await command("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    await writeFile(process.env.AWT_SMOKE_SETUP_SCREENSHOT, Buffer.from(screenshot.data, "base64"));
  }
  await evaluate(`(() => {
    document.querySelector('#awt-shape-map').click();
    document.querySelector('#awt-zoom-in').click();
    document.querySelector('#awt-minimap').scrollIntoView({ block: 'center' });
  })()`);
  await new Promise(resolve => setTimeout(resolve, 250));

  await evaluate(`(() => {
    const tool = document.querySelector('#awt-editor-tool');
    tool.value = 'resource';
    tool.dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelector('#awt-new-resource-zone').click();
    const type = document.querySelector('#awt-resource-type');
    type.value = 'biomass';
    type.dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelector('[data-editor-tool-target="economic-node"]').click();
    document.querySelector('#awt-new-economic-node').click();
    const firstName = document.querySelector('#awt-economic-node-name');
    firstName.value = 'Hive City Alpha';
    firstName.dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelector('#awt-new-economic-node').click();
    const secondName = document.querySelector('#awt-economic-node-name');
    secondName.value = 'Manufactorum Delta';
    secondName.dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelector('[data-editor-tool-target="trade-route"]').click();
    document.querySelector('#awt-new-trade-route').click();
    const state = document.querySelector('#autonomous-war-theater').awtDebugState;
    const from = document.querySelector('#awt-trade-route-from');
    const to = document.querySelector('#awt-trade-route-to');
    from.value = state.economicNodes[0].id;
    from.dispatchEvent(new Event('change', { bubbles: true }));
    to.value = state.economicNodes[1].id;
    to.dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelector('#awt-randomize-map').click();
  })()`);

  const editor = await evaluate(`(() => {
    const root = document.querySelector('#autonomous-war-theater');
    const minimap = document.querySelector('#awt-minimap');
    const rect = minimap.getBoundingClientRect();
    return {
      editing: root.classList.contains('is-editing'),
      editorVisible: !document.querySelector('#awt-editor-bar').hidden,
      inspectorVisible: !document.querySelector('#awt-editor-inspector').hidden,
      tabs: document.querySelectorAll('.awt-editor-tab').length,
      resourcePanelVisible: !document.querySelector('#awt-resource-controls').hidden,
      resourceZones: root.awtDebugState?.resourceZones?.length || 0,
      resourceType: root.awtDebugState?.resourceZones?.[0]?.resourceType || null,
      economicNodes: root.awtDebugState?.economicNodes?.length || 0,
      tradeRoutes: root.awtDebugState?.tradeRoutes?.length || 0,
      generatedTradeRoutes: Number(root.dataset.generatedTradeRoutes || 0),
      minimap: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      cameraBefore: root.dataset.camera,
      error: root.dataset.runtimeError || null
    };
  })()`);
  if (!editor.editing || !editor.editorVisible || !editor.inspectorVisible || editor.tabs !== 9 || editor.resourceZones !== 1
    || editor.resourceType !== "biomass" || editor.economicNodes !== 2 || editor.tradeRoutes !== 1 || editor.generatedTradeRoutes !== 0 || editor.error) {
    throw new Error(`Editor smoke check failed: ${JSON.stringify(editor)}`);
  }

  const x = editor.minimap.x + editor.minimap.width * 0.2;
  const y = editor.minimap.y + editor.minimap.height * 0.25;
  await command("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
  await command("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1 });
  await new Promise(resolve => setTimeout(resolve, 100));
  const cameraAfter = await evaluate("document.querySelector('#autonomous-war-theater').dataset.camera");
  if (cameraAfter === editor.cameraBefore) throw new Error("Interactive minimap did not move the camera.");

  if (process.env.AWT_SMOKE_SCREENSHOT) {
    await evaluate("window.scrollTo({ top: 0, behavior: 'instant' })");
    await new Promise(resolve => setTimeout(resolve, 100));
    const screenshot = await command("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    await writeFile(process.env.AWT_SMOKE_SCREENSHOT, Buffer.from(screenshot.data, "base64"));
  }

  await evaluate("document.querySelector('#awt-deploy-map').click()");
  await new Promise(resolve => setTimeout(resolve, 3600));
  const simulation = await evaluate(`(() => {
    const root = document.querySelector('#autonomous-war-theater');
    return {
      mode: root.awtDebugState?.mode,
      paused: root.awtDebugState?.paused,
      units: root.awtDebugState?.units?.length,
      navigationRevision: Number(root.dataset.navigationRevision || 0),
      unsourcedUnits: Number(root.dataset.unsourcedUnits || 0),
      factionAIDataVersion: globalThis.AWTData?.factionAI?.version || null,
      factionAIProfiles: Object.keys(root.awtDebugState?.factionAIProfiles || {}).length,
      factionAIChoices: root.awtDebugState?.players?.map(player => player.factionAIChoice),
      battleObjectives: root.dataset.battleObjectives || null,
      objectiveMethods: root.dataset.objectiveMethods || null,
      dynamicBehaviors: root.awtDebugState?.players?.map(player => player.dynamicAIBehavior),
      error: root.dataset.runtimeError || null
    };
  })()`);
  if (simulation.mode !== "sim" || simulation.paused || simulation.units < 2 || simulation.unsourcedUnits !== 0
    || simulation.factionAIDataVersion !== 1 || simulation.factionAIProfiles < 2
    || simulation.factionAIChoices.some(choice => !choice || choice === "establish") || !simulation.battleObjectives || !simulation.objectiveMethods
    || simulation.dynamicBehaviors.some(behavior => !behavior || !Number.isFinite(behavior.aggression)) || simulation.error) {
    throw new Error(`Simulation smoke check failed: ${JSON.stringify(simulation)}`);
  }

  const sampleLifecycle = () => evaluate(`(() => {
    const root = document.querySelector('#autonomous-war-theater');
    return {
      time: root.awtDebugState.time,
      paused: root.awtDebugState.paused,
      frames: Number(root.dataset.frameCount || 0),
      failures: Number(root.dataset.frameFailures || 0),
      failurePhase: root.awtDebugState.lastFrameFailure?.phase || null
    };
  })()`);
  const runningStart = await sampleLifecycle();
  await new Promise(resolve => setTimeout(resolve, 900));
  const runningEnd = await sampleLifecycle();
  if (runningEnd.time <= runningStart.time || runningEnd.frames <= runningStart.frames || runningEnd.paused) {
    throw new Error(`Simulation did not advance continuously: ${JSON.stringify({ runningStart, runningEnd })}`);
  }
  await evaluate("document.querySelector('#awt-pause-button').click()");
  const pausedStart = await sampleLifecycle();
  await new Promise(resolve => setTimeout(resolve, 500));
  const pausedEnd = await sampleLifecycle();
  if (!pausedEnd.paused || Math.abs(pausedEnd.time - pausedStart.time) > 0.001 || pausedEnd.frames <= pausedStart.frames) {
    throw new Error(`Pause stopped the frame scheduler or advanced simulation: ${JSON.stringify({ pausedStart, pausedEnd })}`);
  }
  await evaluate(`(() => {
    document.querySelector('#awt-pause-button').click();
    document.querySelector('[data-speed="8"]').click();
  })()`);
  const resumedStart = await sampleLifecycle();
  await new Promise(resolve => setTimeout(resolve, 900));
  const resumedEnd = await sampleLifecycle();
  if (resumedEnd.paused || resumedEnd.time <= resumedStart.time + 2 || resumedEnd.frames <= resumedStart.frames) {
    throw new Error(`Resume/8x lifecycle failed: ${JSON.stringify({ resumedStart, resumedEnd })}`);
  }
  await new Promise(resolve => setTimeout(resolve, 1500));
  const builderHealth = await evaluate(`(() => {
    const root = document.querySelector('#autonomous-war-theater');
    const state = root.awtDebugState;
    const builders = state.units.filter(unit => unit.role === 'builder');
    return {
      paused: state.paused,
      failures: Number(root.dataset.frameFailures || 0),
      builderCount: builders.length,
      livingBuilders: builders.filter(unit => unit.alive).length,
      activeProjects: builders.filter(unit => unit.buildProject).length,
      statuses: builders.map(unit => unit.status),
      buildersByFaction: state.players.map(player => ({
        faction: player.id,
        race: player.race,
        count: builders.filter(unit => unit.faction === player.id).length
      })),
      structures: state.structures.length,
      completedStructures: state.structures.filter(structure => structure.progress >= 1).length
    };
  })()`);
  const invalidBuilderGroup = builderHealth.buildersByFaction.find(group => {
    const [minimum, maximum] = group.race === 'Necrons' || group.race === 'Orks' ? [6, 8] : [2, 4];
    return group.count < minimum || group.count > maximum;
  });
  if (builderHealth.paused || builderHealth.failures !== 0 || builderHealth.builderCount < 4
    || builderHealth.livingBuilders !== builderHealth.builderCount || invalidBuilderGroup
    || builderHealth.structures < builderHealth.buildersByFaction.length) {
    throw new Error(`Builder lifecycle failed: ${JSON.stringify(builderHealth)}`);
  }
  const squadRoleProbe = await evaluate(`(() => {
    const root = document.querySelector('#autonomous-war-theater');
    const assignment = root.awtDebugControls.spawnSquadRoleProbe();
    return {
      ...assignment,
      overlay: root.awtDebugState.squadRoleOverlay,
      togglePresent: Boolean(document.querySelector('#awt-squad-role-toggle')),
      inspectorPresent: Boolean(document.querySelector('#awt-squad-role-summary'))
    };
  })()`);
  if (squadRoleProbe.roleCount !== 12 || !squadRoleProbe.primaryRole || !squadRoleProbe.secondaryRole
    || !squadRoleProbe.currentObjective || !squadRoleProbe.assignedZone || !squadRoleProbe.commanderId
    || !Number.isFinite(squadRoleProbe.readiness) || !squadRoleProbe.overlay
    || !squadRoleProbe.togglePresent || !squadRoleProbe.inspectorPresent) {
    throw new Error(`Squad role assignment failed: ${JSON.stringify(squadRoleProbe)}`);
  }
  const phase20to23 = await evaluate(`(() => {
    const root = document.querySelector('#autonomous-war-theater');
    return {
      victoryRule: root.dataset.phase20Victory,
      endgameOrders: root.dataset.endgameOrders,
      replayDiagnostics: root.dataset.phase21Replay,
      performanceScale: root.dataset.phase22Scale,
      factionBranches: root.dataset.phase23Branches,
      telemetryIntervalMs: Number(root.dataset.telemetryIntervalMs || 0),
      dayNightModel: root.dataset.dayNightModel,
      dynamicLighting: root.dataset.dynamicLighting,
      forceCommitment: root.dataset.forceCommitment,
      economyProfiles: root.dataset.economyProfiles,
      resourceZoneOptions: [...document.querySelectorAll('#awt-resource-type option')].map(option => option.value),
      lightingLabels: [...document.querySelectorAll('#awt-lighting-controls .form-check-label')].map(item => item.textContent.trim()),
      aiGoal: document.querySelector('#awt-ai-goal')?.textContent,
      replayButtons: document.querySelectorAll('.awt-replay-controls button').length,
      snapshots: root.awtDebugState.snapshots.length,
      snapshotCapacity: root.awtDebugState.snapshots.capacity,
      simulationStepsThisFrame: root.awtDebugState.lastSimulationFrame?.steps ?? null
    };
  })()`);
  if (phase20to23.victoryRule !== "five-capability-annihilation" || !phase20to23.endgameOrders
    || !phase20to23.replayDiagnostics || !phase20to23.performanceScale || !phase20to23.factionBranches
    || !phase20to23.aiGoal?.startsWith("Current goal:") || phase20to23.replayButtons !== 4 || phase20to23.snapshots < 2
    || phase20to23.telemetryIntervalMs !== 1000 || phase20to23.snapshotCapacity !== 180
    || phase20to23.simulationStepsThisFrame > 3 || phase20to23.dayNightModel !== "global-tint-and-visibility"
    || phase20to23.dynamicLighting !== "false" || !phase20to23.forceCommitment?.includes(":")
    || !phase20to23.economyProfiles?.includes("space-marines") || !phase20to23.economyProfiles?.includes("chaos")
    || phase20to23.resourceZoneOptions.some(resource => ["requisition", "influence", "ammunition", "medical", "faith", "parts"].includes(resource))
    || !phase20to23.lightingLabels.includes("Visual night tint") || !phase20to23.lightingLabels.includes("Night affects detection")) {
    throw new Error(`Phase 20-23 integration failed: ${JSON.stringify(phase20to23)}`);
  }
  const replayBefore = await evaluate(`(() => {
    document.querySelector('#awt-replay-rewind').click();
    const state = document.querySelector('#autonomous-war-theater').awtDebugState;
    return { replay: state.replay, index: state.replayIndex };
  })()`);
  await evaluate("document.querySelector('#awt-replay-play').click()");
  await new Promise(resolve => setTimeout(resolve, 500));
  const replayAfter = await evaluate(`(() => {
    const state = document.querySelector('#autonomous-war-theater').awtDebugState;
    return { replay: state.replay, playing: state.replayPlaying, index: state.replayIndex };
  })()`);
  if (!replayBefore.replay || replayAfter.index <= replayBefore.index) {
    throw new Error(`Replay transport failed: ${JSON.stringify({ replayBefore, replayAfter })}`);
  }
  await evaluate("document.querySelector('#awt-replay-live').click()");
  await new Promise(resolve => setTimeout(resolve, 150));
  const liveAfterReplay = await sampleLifecycle();
  if (liveAfterReplay.paused) throw new Error(`Replay did not return to live simulation: ${JSON.stringify(liveAfterReplay)}`);
  const faultStart = await sampleLifecycle();
  await evaluate("document.querySelector('#autonomous-war-theater').awtDebugControls.injectSimulationFault('smoke fault')");
  await new Promise(resolve => setTimeout(resolve, 500));
  const faultEnd = await sampleLifecycle();
  if (!faultEnd.paused || faultEnd.failures !== faultStart.failures + 1 || faultEnd.failurePhase !== "simulation" || faultEnd.frames <= faultStart.frames) {
    throw new Error(`Frame failure boundary failed: ${JSON.stringify({ faultStart, faultEnd })}`);
  }
  const lifecycle = { runningStart, runningEnd, pausedStart, pausedEnd, resumedStart, resumedEnd, faultStart, faultEnd };

  console.log(JSON.stringify({ startup, playerSetup, editor: { ...editor, cameraAfter }, simulation, builderHealth, squadRoleProbe, phase20to23, replayTransport: { replayBefore, replayAfter, liveAfterReplay }, lifecycle }, null, 2));
} finally {
  socket?.close();
  if (browser && browser.exitCode === null) {
    browser.kill();
    await Promise.race([
      once(browser, "exit").catch(() => {}),
      new Promise(resolve => setTimeout(resolve, 2000))
    ]);
  }
  server.close();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      rmSync(profile, { recursive: true, force: true, maxRetries: 2, retryDelay: 100 });
      break;
    } catch (error) {
      if (attempt === 7) console.warn(`Temporary browser profile could not be removed: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
}
