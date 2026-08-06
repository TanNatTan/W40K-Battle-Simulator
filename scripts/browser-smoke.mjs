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
    return { ready: root?.dataset.foundryReady, error: root?.dataset.runtimeError || null, moduleEntry: document.querySelector('script[type=module]')?.getAttribute('src') };
  })()`);
  if (startup.ready !== "true" || startup.error) throw new Error(`Startup failed: ${JSON.stringify(startup)}`);

  await evaluate(`(() => {
    document.querySelector('#awt-create-map').click();
    document.querySelector('#awt-configure-players').click();
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
      minimap: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      cameraBefore: root.dataset.camera,
      error: root.dataset.runtimeError || null
    };
  })()`);
  if (!editor.editing || !editor.editorVisible || !editor.inspectorVisible || editor.tabs !== 5 || !editor.resourcePanelVisible || editor.resourceZones !== 1 || editor.resourceType !== "biomass" || editor.error) {
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
      error: root.dataset.runtimeError || null
    };
  })()`);
  if (simulation.mode !== "sim" || simulation.paused || simulation.units < 2 || simulation.unsourcedUnits !== 0
    || simulation.factionAIDataVersion !== 1 || simulation.factionAIProfiles < 2
    || simulation.factionAIChoices.some(choice => !choice || choice === "establish") || simulation.error) {
    throw new Error(`Simulation smoke check failed: ${JSON.stringify(simulation)}`);
  }

  console.log(JSON.stringify({ startup, editor: { ...editor, cameraAfter }, simulation }, null, 2));
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
