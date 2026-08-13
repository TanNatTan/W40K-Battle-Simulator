import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  LIGHTWEIGHT_ENTITY_THRESHOLD,
  adaptiveEntityUpdatePreset,
  adaptivePerformanceRequest,
  adaptiveRenderInterval,
  adaptiveThinkingBudgets,
  largeBattleLoadActive
} from "../src/performance/AdaptiveLoadSystem.js";

test("the 310-unit and 111-building workload enters adaptive load control", () => {
  const workload = 310 + 111 * 0.5;
  assert.equal(LIGHTWEIGHT_ENTITY_THRESHOLD, 280);
  assert.equal(largeBattleLoadActive(workload), true);
  assert.equal(adaptivePerformanceRequest("auto", workload), "total");
  assert.deepEqual(adaptiveEntityUpdatePreset({ id: "battle", nearStride: 1, nearEngagedStride: 1, distantStride: 3 }, workload), {
    id: "battle", nearStride: 8, nearEngagedStride: 4, distantStride: 12
  });
  assert.deepEqual(adaptiveThinkingBudgets("battle", workload), { awareness: 16, sensors: 10 });
  assert.equal(adaptiveRenderInterval("battle", 4, workload), 1 / 15);
});

test("small battles retain their requested simulation cadence", () => {
  const preset = { id: "skirmish", nearStride: 1, nearEngagedStride: 1, distantStride: 2 };
  assert.equal(adaptiveEntityUpdatePreset(preset, 120), preset);
  assert.equal(adaptiveRenderInterval("skirmish", 1, 120), 1 / 30);
});

test("terrain visibility and lightweight entity rendering are live observer controls", () => {
  const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const source = fs.readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
  assert.match(html, /id="awt-terrain-toggle"/);
  assert.match(source, /showTerrain: true/);
  assert.match(source, /lightweightRendering: true/);
  assert.match(source, /if \(state\.showTerrain\) minimapCtx\.drawImage\(minimapTerrainLayer/);
  assert.match(source, /drawDenseStructureBatches\(renderObjects\.structures, true\)/);
  assert.match(source, /drawDenseUnitBatches\(renderObjects\.units, true\)/);
  assert.match(source, /drawLightweightEntityLabels\(renderObjects\.units, renderObjects\.structures\)/);
});
