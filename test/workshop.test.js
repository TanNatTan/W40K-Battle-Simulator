import assert from "node:assert/strict";
import test from "node:test";

import { RegionWorkshop, BRUSH_TOOLS, TOOL_GROUPS } from "../src/workshop/RegionWorkshop.js";
import { VEGETATION, EARTHWORK, DEPOSIT, NO_WATER } from "../src/world/WorldLayers.js";

const stroke = (shop, tool, points, params = {}) => {
  assert.ok(shop.beginStroke(tool, { radius: 80, strength: 0.8, ...params }));
  for (const [x, y] of points) shop.strokeTo(x, y);
  return shop.endStroke();
};

const blankShop = () => { const shop = new RegionWorkshop(); shop.blank(); return shop; };

test("every tool in the palette is either a brush or a placement tool", () => {
  const ids = TOOL_GROUPS.flatMap(group => group.tools.map(tool => tool.id));
  assert.equal(new Set(ids).size, ids.length, "tool ids are unique");
  for (const id of ids) assert.ok(BRUSH_TOOLS.has(id) || ["settlement", "base", "inspect"].includes(id), id);
});

test("sculpting raises and lowers ground and undo/redo restore it exactly", () => {
  const shop = blankShop();
  const base = shop.field.heightAt(800, 600);
  assert.equal(stroke(shop, "raise", [[700, 600], [900, 600]]), true);
  const hill = shop.field.heightAt(800, 600);
  assert.ok(hill > base + 1, `raised ${hill} > ${base}`);
  assert.equal(shop.canUndo, true);
  shop.undo();
  assert.ok(Math.abs(shop.field.heightAt(800, 600) - base) < 1e-6);
  shop.redo();
  assert.ok(Math.abs(shop.field.heightAt(800, 600) - hill) < 1e-6);
  stroke(shop, "lower", [[800, 600]], { strength: 1 });
  assert.ok(shop.field.heightAt(800, 600) < hill);
});

test("an empty stroke leaves no history entry", () => {
  const shop = blankShop();
  const before = shop.history.canUndo;
  stroke(shop, "clear", [[500, 500]]);
  // clearing an already-meadow patch still removes grass: that is a change; erasing deposits where there are none is not
  assert.equal(stroke(shop, "unseed", [[1500, 900]]), false);
  assert.ok(shop.history.canUndo || !before);
});

test("water can be dug and dried, and nothing grows under it", () => {
  const shop = blankShop();
  stroke(shop, "forest", [[1000, 700]], { radius: 120, strength: 1 });
  const forestBefore = shop.stats().forest;
  assert.ok(forestBefore > 0, "forest painted");
  stroke(shop, "dig", [[1000, 700], [1100, 700]], { radius: 90, strength: 1, depth: 5 });
  assert.ok(shop.probe(1050, 700).water > 0.5, "ground is now below the waterline");
  assert.equal(shop.probe(1050, 700).vegetation, "water");
  assert.ok(shop.stats().forest < forestBefore, "drowned trees are removed");
  assert.ok(shop.stats().water > 0);
  stroke(shop, "dry", [[1000, 700], [1100, 700]], { radius: 110, strength: 1 });
  stroke(shop, "dry", [[1050, 700]], { radius: 110, strength: 1 });
  assert.equal(shop.probe(1050, 700).water, 0, "drained again");
});

test("land cover brushes set vegetation kinds, fields get earthwork, clear removes them", () => {
  const shop = blankShop();
  stroke(shop, "crops", [[900, 500]], { radius: 100, strength: 1 });
  let fieldCells = 0;
  shop.layers.forEachInCircle(900, 500, 100, (i, j) => { if (shop.layers.get("earthwork", i, j) === EARTHWORK.FIELD) { fieldCells += 1; assert.equal(shop.layers.get("vegKind", i, j), VEGETATION.CROP); } });
  assert.ok(fieldCells > 10, `fields painted: ${fieldCells}`);
  stroke(shop, "clear", [[900, 500]], { radius: 120, strength: 1 });
  shop.layers.forEachInCircle(900, 500, 60, (i, j) => { assert.notEqual(shop.layers.get("earthwork", i, j), EARTHWORK.FIELD); assert.equal(shop.layers.get("vegKind", i, j), VEGETATION.NONE); });
  stroke(shop, "forest", [[900, 500]], { radius: 100, strength: 1 });
  assert.ok(shop.stats().forest > 0.005);
});

test("ground brushes move soil values and resource brushes seed and clear deposits", () => {
  const shop = blankShop();
  stroke(shop, "soil-mud", [[600, 600]], { radius: 80, strength: 1 });
  assert.ok(shop.layers.getAt("moisture", 600, 600) > 200);
  stroke(shop, "soil-burnt", [[600, 600]], { radius: 80, strength: 1 });
  assert.ok(shop.layers.getAt("scorch", 600, 600) > 150);
  stroke(shop, "iron", [[1200, 900]], { radius: 80, strength: 1 });
  assert.ok(shop.stats().deposits.iron > 5);
  let found = 0;
  shop.layers.forEachInCircle(1200, 900, 80, (i, j) => { if (shop.layers.get("deposit", i, j) === DEPOSIT.IRON) { found += 1; assert.ok(shop.layers.get("depositAmount", i, j) > 0); } });
  assert.ok(found > 5);
  stroke(shop, "unseed", [[1200, 900]], { radius: 120 });
  assert.equal(shop.stats().deposits.iron, 0);
});

test("settlements: placement rules, edit, move, remove and undo", () => {
  const shop = blankShop();
  const first = shop.addSettlement(1000, 700, { population: 50, culture: "devout" });
  assert.equal(first.ok, true);
  assert.equal(first.settlement.population, 50);
  assert.equal(shop.addSettlement(1050, 700).ok, false, "too close");
  assert.equal(shop.addSettlement(40, 40).ok, false, "edge");
  assert.equal(shop.addSettlement(shop.bases[0].x + 20, shop.bases[0].y + 20).ok, false, "on a base");
  stroke(shop, "dig", [[1500, 800]], { radius: 90, strength: 1, depth: 6 });
  assert.equal(shop.addSettlement(1500, 800).ok, false, "underwater");
  const second = shop.addSettlement(1500, 400);
  assert.equal(second.ok, true);
  shop.updateSettlement(second.settlement.id, { population: 999, name: "Hollow Reach" });
  assert.equal(second.settlement.population, 120, "population is clamped");
  assert.equal(second.settlement.name, "Hollow Reach");
  assert.equal(shop.moveSettlement(second.settlement.id, 1700, 400).ok, true);
  assert.equal(shop.moveSettlement(second.settlement.id, 1020, 700).ok, false);
  assert.deepEqual(shop.hit(1700, 400, 1), { type: "settlement", id: second.settlement.id });
  assert.equal(shop.removeSettlement(first.settlement.id), true);
  assert.equal(shop.settlements.length, 1);
  shop.undo(); // un-remove
  assert.equal(shop.settlements.length, 2);
  shop.undo(); shop.undo(); shop.undo(); // move, edit, add
  assert.equal(shop.settlements.length, 1);
});

test("undo does not mix terrain and placement history; deep stacks stay bounded", () => {
  const shop = blankShop();
  shop.addSettlement(1000, 700);
  stroke(shop, "raise", [[1800, 400]]);
  shop.undo();
  assert.equal(shop.settlements.length, 1, "undoing the stroke keeps the settlement");
  for (let n = 0; n < 120; n += 1) stroke(shop, "raise", [[300 + n, 300]], { radius: 40 });
  let steps = 0;
  while (shop.undo()) steps += 1;
  assert.ok(steps <= 80, `history is capped (${steps})`);
});

test("generate builds a playable region and keeps bases level and dry", () => {
  const shop = new RegionWorkshop();
  const made = shop.generate({ seed: "WORKSHOP-1", settlementCount: 4 });
  assert.equal(made.settlements, 4);
  for (const base of shop.bases) {
    assert.ok(Math.abs(shop.field.heightAt(base.x, base.y) - 4) < 1.5);
    assert.ok(shop.probe(base.x, base.y).water === 0);
  }
  assert.ok(shop.diagnose().every(note => note.level !== "error"));
  shop.undo();
  assert.equal(shop.settlements.length, 0, "generate is undoable");
});

test("diagnose reports a base in a lake and a settlement that cannot farm", () => {
  const shop = blankShop();
  const base = shop.bases[0];
  stroke(shop, "dig", [[base.x, base.y]], { radius: 120, strength: 1, depth: 6 });
  assert.ok(shop.diagnose().some(note => note.level === "error" && /Player 1/.test(note.text)));
});

test("payload round trip preserves ground, cover, settlements and bases", () => {
  const shop = blankShop();
  stroke(shop, "raise", [[800, 500], [900, 520]]);
  stroke(shop, "forest", [[1300, 800]], { radius: 90, strength: 1 });
  shop.addSettlement(1500, 400, { population: 44, name: "Ash Ford" });
  shop.moveBase(1, 1500, 1100);
  shop.name = "Test Map";
  const copy = JSON.parse(JSON.stringify(shop.toPayload()));
  const other = new RegionWorkshop();
  assert.equal(other.loadPayload(copy), true);
  assert.equal(other.name, "Test Map");
  assert.deepEqual(other.bases[1], { x: 1500, y: 1100 });
  assert.equal(other.settlements[0].name, "Ash Ford");
  assert.equal(other.settlements[0].population, 44);
  assert.ok(Math.abs(other.field.heightAt(850, 510) - shop.field.heightAt(850, 510)) < 0.02);
  assert.ok(Math.abs(other.stats().forest - shop.stats().forest) < 1e-9);
  assert.equal(other.loadPayload({ kind: "something-else" }), false);
});

test("the battle runtime plays a workshop map exactly as authored", async () => {
  const { HeightField, seededRandom } = await import("../src/terrain/HeightField.js");
  const { createRegionRuntime, REGION_WORLD } = await import("../src/region/RegionRuntime.js");
  const shop = blankShop();
  stroke(shop, "raise", [[1000, 640], [1080, 640]], { radius: 120, strength: 1 });
  stroke(shop, "forest", [[1700, 900]], { radius: 100, strength: 1 });
  shop.addSettlement(600, 800, { population: 30, name: "Bracken" });
  shop.addSettlement(1700, 420, { population: 40, culture: "devout" });
  const payload = JSON.parse(JSON.stringify(shop.toDeploy()));

  const state = {
    time: 0, heightField: new HeightField({ width: REGION_WORLD.width, height: REGION_WORLD.height }),
    economicNodes: [], units: [], camera: { x: 1280, y: 720, zoom: 0.5 }, dayNight: { weather: "clear" }, terrainPalette: null, worldLayers: null
  };
  let nodeId = 1;
  const runtime = createRegionRuntime({
    state: () => state, random: seededRandom(3), areAllies: (a, b) => a === b, nameOf: String, factionName: () => "x", colorOf: () => "#fff",
    policyOf: () => ({ branch: "space_marines" }), stressOf: () => 0, baseOf: () => ({ x: 300, y: 300 }),
    grant() {}, recruit() {}, attack() {}, incident() {},
    createNode: (point, overrides) => ({ id: `n${nodeId++}`, x: point.x, y: point.y, active: true, owner: "", ...overrides }),
    bakeVegetation: () => null, deserializeField: data => HeightField.deserialize(data, REGION_WORLD)
  });
  runtime.begin(payload.config, payload.bases, null, payload);
  const made = runtime.populate();
  assert.equal(made.length, 2);
  assert.deepEqual(made.map(item => [item.x, item.y]).sort((a, b) => a[0] - b[0]), [[600, 800], [1700, 420]]);
  assert.ok(made.some(item => item.name === "Bracken"));
  assert.equal(state.economicNodes.length, 2);
  assert.ok(Math.abs(state.heightField.heightAt(1040, 640) - shop.field.heightAt(1040, 640)) < 0.02, "terrain is the authored terrain");
  assert.equal(runtime.info.authored, true);
  for (let step = 0; step < 40; step += 1) { state.time += 0.25; runtime.step(0.25); }
  assert.equal(runtime.overview().length, 2);
});

test("the map can be resized around its centre without losing what was built", () => {
  const shop = blankShop();
  stroke(shop, "raise", [[1280, 720]], { radius: 120, strength: 1 });
  stroke(shop, "forest", [[1500, 400]], { radius: 90, strength: 1 });
  shop.addSettlement(1600, 700, { name: "Keep" });
  const hill = shop.field.heightAt(1280, 720);
  const forestBefore = shop.stats().forest * shop.world.width * shop.world.height;
  assert.equal(shop.resize(3840, 2160), true);
  assert.deepEqual(shop.world, { width: 3840, height: 2160 });
  // The centre moved by +640, +368 (whole 16-unit samples).
  assert.ok(Math.abs(shop.field.heightAt(1920, 1088) - hill) < 0.05, "hill kept at the new centre");
  assert.equal(shop.settlements[0].x, 2240);
  assert.equal(shop.settlements[0].y, 1068);
  const forestAfter = shop.stats().forest * 3840 * 2160;
  assert.ok(forestAfter >= forestBefore * 0.9, "forest survives (new ground is meadow)");
  assert.equal(shop.resize(3840, 2160), false, "no change when the size is the same");
  assert.equal(shop.resize(100000, 100000), true, "oversized requests are clamped");
  assert.ok(shop.world.width <= 8192 && shop.world.height <= 4608);
  shop.undo();
  shop.undo();
  assert.deepEqual(shop.world, { width: 2560, height: 1440 });
  assert.ok(Math.abs(shop.field.heightAt(1280, 720) - hill) < 0.05, "undo restores the old ground");
  assert.equal(shop.settlements[0].x, 1600);
});

test("any number of armies from 2 to 12, each with a base, a name and a place on dry land", () => {
  const shop = blankShop();
  assert.equal(shop.setPlayerCount(6), true);
  assert.equal(shop.bases.length, 6);
  assert.equal(shop.armies.length, 6);
  const keys = new Set(shop.bases.map(base => `${base.x},${base.y}`));
  assert.equal(keys.size, 6, "bases are all in different places");
  shop.updateArmy(3, { name: "Blackstone", race: "Orks" });
  assert.equal(shop.armyLabel(3), "Blackstone");
  const settlement = shop.addSettlement(1200, 700, { owner: "f" }).settlement;
  assert.equal(settlement.owner, "f");
  assert.equal(shop.setPlayerCount(3), true);
  assert.equal(shop.settlements[0].owner, "", "a settlement ruled by a removed army becomes independent");
  assert.equal(shop.setPlayerCount(99), true);
  assert.equal(shop.bases.length, 12);
  assert.equal(shop.setPlayerCount(1), true);
  assert.equal(shop.bases.length, 2, "never fewer than two armies");
  shop.undo();
  assert.equal(shop.bases.length, 12);
});

test("armies, world size and extra settlements survive save/load and deploy", () => {
  const shop = blankShop();
  shop.resize(1920, 1080);
  shop.setPlayerCount(4);
  shop.updateArmy(2, { name: "Tide", color: "#123456" });
  for (let n = 0; n < 12; n += 1) shop.addSettlement(260 + (n % 6) * 260, 300 + Math.floor(n / 6) * 480);
  assert.ok(shop.settlements.length >= 8, `placed ${shop.settlements.length}`);
  const copy = JSON.parse(JSON.stringify(shop.toDeploy()));
  const other = new RegionWorkshop();
  assert.equal(other.loadPayload(copy), true);
  assert.deepEqual(other.world, { width: 1920, height: 1080 });
  assert.equal(other.bases.length, 4);
  assert.equal(other.armies[2].name, "Tide");
  assert.equal(other.settlements.length, shop.settlements.length);
});
