import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { FactionIntelSystem } from "../src/intelligence/FactionIntelSystem.js";

test("enemy headquarters remain unknown until physically observed and memory stores snapshots", () => {
  const intel = new FactionIntelSystem();
  const enemyBase = { id: "enemy-hq", faction: "enemy", type: "outpost", x: 880, y: 420, hp: 900 };
  assert.equal(intel.knownHeadquarters("marine", "enemy", 0), null);
  const contact = intel.observeStructure("marine", enemyBase, 10, { source: "optical", confidence: 0.92 });
  enemyBase.x = 100;
  enemyBase.hp = 1;
  assert.deepEqual(contact.position, { x: 880, y: 420 });
  assert.equal(Object.hasOwn(contact, "hp"), false);
  assert.equal(intel.knownHeadquarters("marine", "enemy", 12).position.x, 880);
});

test("runtime strategic movement never reads raw enemy spawn coordinates", async () => {
  const app = await readFile(new URL("../js/app.js", import.meta.url), "utf8");
  assert.doesNotMatch(app, /enemy\.base|targetEnemy\.base|enemies\.map\(enemy => enemy\.base/);
  assert.match(app, /knownHostileAnchor/);
  assert.match(app, /exploredFogCells/);
  assert.match(app, /visibleFogCells/);
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const css = await readFile(new URL("../css/simulator.css", import.meta.url), "utf8");
  assert.match(html, /id="awt-fps-reading"/);
  assert.match(html, /id="awt-minimap-toggle"/);
  assert.match(css, /is-collapsed #awt-minimap/);
  assert.match(app, /setMinimapVisible/);
  assert.match(app, /fpsOnePercentLow/);
});
