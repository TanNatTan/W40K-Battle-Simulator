import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("2v2 browser soak carries the dense battlefield, telemetry, and freeze gates", async () => {
  const soak = await readFile(new URL("../scripts/performance-2v2-soak.mjs", import.meta.url), "utf8");
  const harness = await readFile(new URL("../scripts/stress-12-player.mjs", import.meta.url), "utf8");
  const app = await readFile(new URL("../js/app.js", import.meta.url), "utf8");

  assert.match(soak, /--two-v-two/);
  assert.match(soak, /--players=4/);
  assert.match(soak, /--spawn-radius=160/);
  assert.match(soak, /--load-units=400/);
  assert.match(soak, /--load-buildings=48/);
  assert.match(soak, /--duration=\$\{quick \? 20 : 600\}/);
  assert.match(harness, /maxFrameGapMs/);
  assert.match(harness, /gapsOver500Ms/);
  assert.match(harness, /movement\.movedCombatUnits/);
  assert.match(app, /"render\.fog"/);
  assert.match(app, /"ai\.perception"/);
  assert.match(app, /"intelligence\.vox"/);
  assert.match(app, /"intelligence\.auspex"/);
});
