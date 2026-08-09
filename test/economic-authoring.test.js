import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  ECONOMIC_NODE_TYPES,
  TRADE_ROUTE_TYPES,
  createEconomicNode,
  createTradeRoute,
  formatResourceMap,
  parseResourceMap,
  routeIsAuthoredAndComplete,
  scoreAuthoredTradeRoute,
  serializeEconomicNode,
  serializeTradeRoute
} from "../src/economy/EconomicMap.js";
import { createResourceZone, drainResourceZone, serializeResourceZone } from "../src/economy/ResourceZones.js";

test("map-authored economic nodes define imports and exports independently of terrain", () => {
  assert.ok(ECONOMIC_NODE_TYPES.includes("hive-city"));
  const node = createEconomicNode("hades", { x: 120, y: 80 }, {
    type: "hive-city",
    exports: parseResourceMap("food:12, requisition:8"),
    imports: parseResourceMap("fuel:6, medical:4")
  });
  assert.deepEqual(node.exports, { food: 12, requisition: 8 });
  assert.equal(formatResourceMap(node.imports), "fuel:6, medical:4");
  assert.equal(node.terrain, undefined);
  const saved = serializeEconomicNode(node, 2, 3);
  assert.equal(saved.schemaVersion, 2);
  assert.deepEqual(saved.position, { x: 240, y: 240, space: "world" });
  assert.deepEqual(saved.economy.flows, node.flows);
  assert.equal(saved.economy.capacity, node.capacity);
});

test("trade routes are valid only when authored between existing economic nodes", () => {
  assert.deepEqual(TRADE_ROUTE_TYPES, ["road", "rail", "sea", "river", "air", "orbital", "underground", "warp"]);
  const from = createEconomicNode("mine", { x: 10, y: 20 }, { type: "mining-colony", exports: { materials: 20 } });
  const to = createEconomicNode("forge", { x: 100, y: 120 }, { type: "manufactorum" });
  const incomplete = createTradeRoute("route-1", { fromNodeId: from.id, points: [{ x: 10, y: 20 }] });
  assert.equal(routeIsAuthoredAndComplete(incomplete, [from, to]), false);
  const route = createTradeRoute("route-2", { type: "rail", fromNodeId: from.id, toNodeId: to.id, points: [from, to], resources: ["materials"] });
  assert.equal(routeIsAuthoredAndComplete(route, [from, to]), true);
  const saved = serializeTradeRoute(route, 2, 2);
  assert.deepEqual(saved.points, [{ x: 20, y: 40 }, { x: 200, y: 240 }]);
});

test("AI evaluates authored routes by shortage, danger, access, and faction preference", () => {
  const from = createEconomicNode("fuel", { x: 0, y: 0 }, { type: "fuel-refinery", exports: { fuel: 16 } });
  const to = createEconomicNode("base", { x: 100, y: 0 }, { type: "forward-operating-base", startingOwner: "guard" });
  const rail = createTradeRoute("rail", { type: "rail", fromNodeId: from.id, toNodeId: to.id, points: [from, to] });
  const guard = { id: "guard", race: "Imperium", faction: "Imperial Guard" };
  const tau = { id: "tau", race: "T'au", faction: "Tau" };
  const guardScore = scoreAuthoredTradeRoute(rail, [from, to], guard, { shortages: ["fuel"] });
  const tauScore = scoreAuthoredTradeRoute(rail, [from, to], tau, { shortages: ["fuel"] });
  assert.equal(guardScore.action, "use");
  assert.ok(guardScore.score > tauScore.score);
  assert.equal(scoreAuthoredTradeRoute(rail, [from, to], guard, { shortages: ["fuel"], blocked: true, danger: 1 }).action, "abandon");
});

test("resource polygons support finite or infinite authored capacity", () => {
  const finite = createResourceZone("ore", { x: 50, y: 50 }, { capacity: 25000, gatherRate: 20, resourceType: "materials" });
  assert.equal(drainResourceZone(finite, 20), 20);
  assert.equal(finite.remaining, 24980);
  const infinite = createResourceZone("food", { x: 80, y: 80 }, { capacity: 100, gatherRate: 12, resourceType: "food", infinite: true });
  assert.equal(drainResourceZone(infinite, 12), 12);
  assert.equal(infinite.remaining, 100);
  assert.equal(serializeResourceZone(infinite).infinite, true);
});

test("runtime contains no procedural resource seeder or trade-route establishment path", async () => {
  const app = await readFile(new URL("../js/app.js", import.meta.url), "utf8");
  assert.doesNotMatch(app, /seedStrategicResourceNodes|createTradePartners|established a physical trade route/);
  assert.match(app, /trade routes are authored by the map designer/);
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /data-editor-tool-target="trade-route"/);
  assert.match(html, /data-editor-tool-target="economic-node"/);
  const sql = await readFile(new URL("../sql/migrations/006_authored_economic_map.sql", import.meta.url), "utf8");
  assert.match(sql, /CREATE TABLE IF NOT EXISTS map_resource_zones/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS economic_nodes/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS authored_trade_routes/);
  assert.match(sql, /CHECK \(authored = 1\)/);
  const presets = JSON.parse(await readFile(new URL("../data/maps/economic-presets.json", import.meta.url), "utf8"));
  for (const key of ["iron", "verdant", "ash"]) {
    assert.ok(presets.presets[key].resourceZones.length > 0);
    assert.ok(presets.presets[key].economicNodes.length > 1);
    assert.ok(presets.presets[key].tradeRoutes.every(route => route.fromNodeId && route.toNodeId && route.points.length >= 2));
  }
});
