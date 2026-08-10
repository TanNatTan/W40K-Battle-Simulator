import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  createEconomicNode,
  claimEconomicNode,
  flowsForLandmarkType,
  resourceMapsFromFlows,
  serializeEconomicNode,
  validateEconomicNode
} from "../src/economy/EconomicMap.js";
import { RESOURCE_IDS } from "../src/economy/ResourceCatalog.js";
import { createResourceZone, drainResourceZone, regenerateResourceZone, resourceZoneCenter, touchResourceZoneGeometry } from "../src/economy/ResourceZones.js";
import { StrategicCellIndex } from "../src/performance/StrategicCellIndex.js";

test("canonical resource data and runtime registry agree", async () => {
  const catalog = JSON.parse(await readFile(new URL("../data/economy/resources.json", import.meta.url), "utf8"));
  assert.deepEqual(Object.keys(catalog.resources), [...RESOURCE_IDS]);
});

test("specific landmarks have richer validated flow defaults", () => {
  const refinery = createEconomicNode("refinery", { x: 10, y: 20 }, { type: "fuel-refinery" });
  const farm = createEconomicNode("farm", { x: 20, y: 30 }, { type: "agri-complex" });
  const hive = createEconomicNode("hive", { x: 30, y: 40 }, { type: "hive-city" });
  const depot = createEconomicNode("depot", { x: 40, y: 50 }, { type: "supply-depot" });
  assert.ok(refinery.exports.fuel >= 30);
  assert.ok(farm.exports.food >= 28);
  assert.ok(Object.keys(hive.exports).length >= 2 && Object.keys(hive.imports).length >= 5);
  assert.deepEqual(depot.exports, {});
  assert.ok(depot.captureStock.length >= 5);
  for (const node of [refinery, farm, hive, depot]) assert.equal(validateEconomicNode(node).valid, true);
});

test("legacy landmark maps migrate to v3 resource-flow serialization", () => {
  const node = createEconomicNode("legacy", { x: 50, y: 70 }, { type: "manufactorum", exports: { materials: 12, ammunition: 5 }, imports: { fuel: 4 } });
  assert.equal(node.useTypeDefaults, false);
  assert.deepEqual(resourceMapsFromFlows(node.flows), { exports: { materials: 12, ammunition: 5 }, imports: { fuel: 4 } });
  const saved = serializeEconomicNode(node, 2, 3);
  assert.equal(saved.schemaVersion, 3);
  assert.deepEqual(saved.position, { x: 100, y: 210, space: "world" });
  assert.equal(saved.economy.flows.length, 3);
  const restored = createEconomicNode(saved.id, null, saved);
  assert.deepEqual(restored.exports, node.exports);
  assert.deepEqual(restored.imports, node.imports);
  assert.ok(restored.modifiers.storageMultiplier >= 1);
});

test("capture stock transfers once for each captor transition", () => {
  const node = createEconomicNode("depot", { x: 0, y: 0 }, { type: "supply-depot", captureStock: [{ resource: "fuel", amount: 40 }] });
  const inventory = { fuel: 5 };
  const first = claimEconomicNode(node, "p1", inventory, { fuel: 100 });
  assert.deepEqual(first.granted, { fuel: 40 });
  assert.equal(inventory.fuel, 45);
  assert.equal(claimEconomicNode(node, "p1", inventory, { fuel: 100 }).changed, false);
  claimEconomicNode(node, "p2", { fuel: 0 }, { fuel: 100 });
  const recapture = claimEconomicNode(node, "p1", inventory, { fuel: 100 });
  assert.deepEqual(recapture.granted, { fuel: 40 });
});

test("landmark flow validation rejects unknown resources and bad directions", () => {
  const node = createEconomicNode("bad", { x: 0, y: 0 }, { type: "hive-city", flows: flowsForLandmarkType("hive-city") });
  node.flows.push({ resource: "ammuntion", direction: "produce", rate: 4, enabled: true });
  node.flows.push({ resource: "fuel", direction: "export-ish", rate: 4, enabled: true });
  assert.equal(validateEconomicNode(node).valid, false);
});

test("resource extraction no longer recalculates unchanged polygon geometry", () => {
  const zone = createResourceZone("z", { x: 50, y: 50 }, { capacity: 100, gatherRate: 10 });
  const geometry = zone.geometry;
  drainResourceZone(zone, 5);
  regenerateResourceZone(zone, 1);
  assert.equal(zone.geometry, geometry);
  zone.points[0].x -= 20;
  touchResourceZoneGeometry(zone);
  assert.notEqual(zone.geometry, geometry);
  assert.deepEqual(resourceZoneCenter(zone), zone.geometry.center);
});

test("strategic cell index scans each battlefield collection once per rebuild", () => {
  const index = new StrategicCellIndex(100);
  const units = Array.from({ length: 4000 }, (_, id) => ({ id: `u${id}`, x: id % 1000, y: Math.floor(id / 1000) * 100, alive: true }));
  index.rebuild({ units, structures: [{ id: "s", x: 10, y: 10, alive: true }], resources: [{ id: "r", x: 20, y: 20 }], landmarks: [{ id: "l", x: 30, y: 30, active: true }] });
  for (let x = 0; x < 96; x += 1) index.unitsNear({ x: x * 10, y: 20 }, 80);
  assert.equal(index.stats.unitScans, 1);
  assert.equal(index.stats.structureScans, 1);
  assert.equal(index.unitsById.size, 4000);
});
