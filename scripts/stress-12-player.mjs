import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join, normalize } from "node:path";
import { once } from "node:events";
import { createServer as createNetServer } from "node:net";

const projectRoot = process.cwd();
const durationMs = Math.max(10_000, Number(process.env.AWT_STRESS_DURATION_MS) || 30_000);
const argumentValue = name => process.argv.find(argument => argument.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
const simulationSpeed = Math.max(1, Math.min(8, Number(argumentValue("speed") || process.env.AWT_STRESS_SPEED) || 8));
const spawnRadius = Math.max(24, Number(argumentValue("spawn-radius") || process.env.AWT_STRESS_SPAWN_RADIUS) || 84);
const fullRoster = process.argv.includes("--full-roster") || process.env.AWT_STRESS_FULL_ROSTER === "1";
const profiling = process.argv.includes("--profile") || process.env.AWT_STRESS_PROFILE === "1";
const browserPath = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium"
].find(existsSync);
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
const profile = mkdtempSync(join(tmpdir(), "awt-12-player-stress-"));
let browser;
let socket;

try {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const serverPort = server.address().port;
  const debugPort = await freePort();
  browser = spawn(browserPath, [
    "--headless=new", "--disable-gpu", "--disable-extensions", "--no-first-run",
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
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const ready = await evaluate("document.querySelector('#autonomous-war-theater')?.dataset.foundryReady === 'true'").catch(() => ({ value: false }));
    if (ready.value) break;
    await delay(100);
  }

  await evaluate(`(() => {
    globalThis.awtStressMetrics = { frames: 0, maxFrameGapMs: 0, gapsOver500Ms: 0, longTasks: 0, maxLongTaskMs: 0, totalLongTaskMs: 0 };
    let previous = performance.now();
    const monitor = now => {
      const gap = now - previous;
      previous = now;
      const metrics = globalThis.awtStressMetrics;
      metrics.frames += 1;
      metrics.maxFrameGapMs = Math.max(metrics.maxFrameGapMs, gap);
      if (gap >= 500) metrics.gapsOver500Ms += 1;
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
    players.value = '12';
    players.dispatchEvent(new Event('change', { bubbles: true }));
    const scale = document.querySelector('#awt-scale-preset');
    scale.value = 'total';
    scale.dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelector('#awt-configure-players').click();
    document.querySelector('#awt-shape-map').click();
    for (const player of root.awtDebugState.players) {
      player.battleObjective = 'annihilation';
      player.battleObjectivePlan = null;
      player.battleObjectiveState = null;
    }
    const fixture = ${fullRoster ? `root.awtDebugControls.prepareFullRosterStressFixture(${spawnRadius})` : "null"};
    document.querySelector('#awt-deploy-map').click();
    return {
      width: root.awtDebugState.world.width,
      height: root.awtDebugState.world.height,
      players: root.awtDebugState.players.length,
      teams: new Set(root.awtDebugState.players.map(player => player.team)).size,
      builders: root.awtDebugState.units.filter(unit => unit.role === 'builder').length,
      mode: root.awtDebugState.mode,
      preset: root.awtDebugState.performanceRequested,
      profiling: ${profiling},
      speedRequested: ${simulationSpeed},
      spawnRadii: root.awtDebugState.players.map(player => player.spawnZone?.size || 0),
      fixture,
      viewport: { width: innerWidth, height: innerHeight },
      error: root.dataset.runtimeError || null
    };
  })()`, 10_000);
  if (setup.value.width !== 1920 || setup.value.height !== 1080 || setup.value.players !== 12
    || setup.value.teams !== 4 || setup.value.builders < 24 || setup.value.mode !== "sim"
    || setup.value.preset !== "total" || setup.value.viewport.width !== 1920 || setup.value.viewport.height !== 1080
    || setup.value.spawnRadii.some(radius => radius !== spawnRadius)
    || (fullRoster && setup.value.fixture.players.some(player => player.missingUnits.length || player.missingBuildings.length
      || player.unitsOutsideSpawnZone.length || player.buildingsOutsideSpawnZone.length))
    || setup.value.error) throw new Error(`Invalid stress setup: ${JSON.stringify(setup.value)}`);

  await delay(1500);
  await evaluate(`(() => {
    globalThis.awtStressMetrics = { frames: 0, maxFrameGapMs: 0, gapsOver500Ms: 0, longTasks: 0, maxLongTaskMs: 0, totalLongTaskMs: 0 };
    const state = document.querySelector('#autonomous-war-theater').awtDebugState;
    globalThis.awtStressStartPositions = Object.fromEntries(state.units
      .filter(unit => unit.alive && !unit.incapacitated && !['builder', 'supply'].includes(unit.role))
      .map(unit => [unit.id, { x: unit.x, y: unit.y }]));
    document.querySelector('[data-speed="${simulationSpeed}"]').click();
  })()`);
  const samples = [];
  const startedAt = performance.now();
  let stagnantSamples = 0;
  let maximumStagnantSamples = 0;
  let previousTime = -1;
  while (performance.now() - startedAt < durationMs) {
    await delay(500);
    const sample = await evaluate(`(() => {
      const root = document.querySelector('#autonomous-war-theater');
      const state = root.awtDebugState;
      const trackedCombatUnits = state.units.filter(unit => unit.alive && globalThis.awtStressStartPositions?.[unit.id]);
      const combatDisplacements = trackedCombatUnits.map(unit => {
        const start = globalThis.awtStressStartPositions[unit.id];
        return Math.hypot(unit.x - start.x, unit.y - start.y);
      });
      return {
        wallTime: performance.now(), simulationTime: state.time, frameCount: state.frameCount,
        lastSuccessfulSimulationAt: state.lastSuccessfulSimulationAt, paused: state.paused, ended: state.ended,
        units: state.units.length, livingUnits: state.units.filter(unit => unit.alive).length,
        structures: state.structures.length, squads: state.squads.length, projectiles: state.projectiles.length,
        casualties: Object.values(state.casualties).reduce((sum, value) => sum + value, 0),
        activeBuilders: state.units.filter(unit => unit.alive && unit.role === 'builder' && unit.buildProject).length,
        speed: state.speed,
        awarenessBudgetUsed: state.awarenessBudgetUsed,
        sensorBudgetUsed: state.sensorBudgetUsed,
        preset: state.performancePreset.id, workerProcessed: state.distantCombatSummary?.processed || 0,
        failures: state.frameFailures, error: root.dataset.runtimeError || null,
        movement: {
          trackedCombatUnits: trackedCombatUnits.length,
          movedCombatUnits: combatDisplacements.filter(value => value >= 12).length,
          maximumDisplacement: Math.max(0, ...combatDisplacements)
        },
        frameMonitor: { ...globalThis.awtStressMetrics },
        simulationFrame: { ...(state.lastSimulationFrame || {}) }
      };
    })()`);
    samples.push({ ...sample.value, probeLatencyMs: sample.latencyMs });
    if (sample.value.simulationTime <= previousTime + 0.0001) stagnantSamples += 1;
    else stagnantSamples = 0;
    maximumStagnantSamples = Math.max(maximumStagnantSamples, stagnantSamples);
    previousTime = sample.value.simulationTime;
    if (sample.value.paused || sample.value.failures || sample.value.error) break;
  }

  const first = samples[0];
  const last = samples.at(-1);
  const maximumProbeLatencyMs = Math.max(...samples.map(sample => sample.probeLatencyMs));
  const report = {
    setup: setup.value,
    durationMs: performance.now() - startedAt,
    samples: samples.length,
    simulationSecondsAdvanced: last.simulationTime - first.simulationTime,
    framesAdvanced: last.frameCount - first.frameCount,
    averageRafFps: last.frameMonitor.frames / Math.max(0.001, (last.wallTime - samples[0].wallTime) / 1000),
    maximumProbeLatencyMs,
    maximumStagnantSamples,
    maxFrameGapMs: last.frameMonitor.maxFrameGapMs,
    gapsOver500Ms: last.frameMonitor.gapsOver500Ms,
    longTasks: last.frameMonitor.longTasks,
    maxLongTaskMs: last.frameMonitor.maxLongTaskMs,
    totalLongTaskMs: last.frameMonitor.totalLongTaskMs,
    final: last,
    profiler: profiling ? await evaluate("globalThis.awtProfiler?.report?.() || []").then(result => result.value) : []
  };
  const frozen = !last || last.paused || last.failures > 0 || last.error
    || report.simulationSecondsAdvanced <= 1 || report.framesAdvanced <= 5
    || maximumStagnantSamples >= 4 || maximumProbeLatencyMs >= 1000 || report.maxFrameGapMs >= 500
    || last.movement.trackedCombatUnits > 0 && last.movement.movedCombatUnits < Math.max(1, Math.floor(last.movement.trackedCombatUnits * 0.05));
  console.log(JSON.stringify(report, null, 2));
  if (last.speed !== simulationSpeed) throw new Error(`Expected ${simulationSpeed}x simulation speed, received ${last.speed}x.`);
  if (frozen) throw new Error(`12-player 1920x1080 simulation froze or became unresponsive: ${JSON.stringify(report)}`);
} finally {
  socket?.close();
  if (browser && browser.exitCode === null) {
    browser.kill();
    await Promise.race([once(browser, "exit").catch(() => {}), delay(2000)]);
  }
  server.close();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try { rmSync(profile, { recursive: true, force: true, maxRetries: 2, retryDelay: 100 }); break; }
    catch (error) { if (attempt === 7) console.warn(error.message); await delay(200); }
  }
}
