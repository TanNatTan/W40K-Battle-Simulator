import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { EconomyZoneManager } from "../src/economy/EconomyZoneManager.js";
import { OBJECTIVE_TYPES, SpatialPartition, TerritorySystem } from "../src/territory/TerritorySystem.js";
import { ConvoyManager, RoadGraph, RouteAI, RouteHistory, RouteManager } from "../src/logistics/RouteSystem.js";

test("Phase 11 dynamic polygon manager mutates, queries, harvests, and restores authored zones", () => {
  const manager = new EconomyZoneManager();
  const zone = manager.create("ore-field", { x: 50, y: 50 }, { resourceType: "materials", capacity: 100, gatherRate: 10 });
  assert.equal(zone.points.length, 4);
  manager.bendEdge(zone.id, 0, 0.5);
  assert.equal(zone.points.length, 5);
  manager.movePoint(zone.id, 1, { x: 80, y: 30 });
  assert.equal(manager.at({ x: 50, y: 50 })[0].id, zone.id);
  assert.equal(manager.harvest(zone.id, 20), 10);
  assert.equal(zone.remaining, 90);
  const saved = manager.toJSON();
  const restored = new EconomyZoneManager(saved.zones);
  assert.equal(restored.byId.get(zone.id).points.length, 5);
  assert.equal(restored.byId.get(zone.id).remaining, 90);
  assert.equal(restored.deletePoint(zone.id, 1), true);
  assert.equal(restored.remove(zone.id), true);
});

test("Phase 12 allocates fixed irregular territory and unit pools and implements every action", () => {
  const partition = new SpatialPartition({ width: 900, height: 600, cellCount: 48, seed: 42 });
  assert.equal(partition.cells.length, 48);
  assert.ok(new Set(partition.cells.map(cell => cell.polygon.length)).size > 1);
  const system = new TerritorySystem(partition, [
    { id: "red", base: { x: 30, y: 30 } },
    { id: "blue", base: { x: 870, y: 570 } }
  ], {
    objectives: OBJECTIVE_TYPES.map((type, index) => ({ ...partition.cells[index + 2].site, type })),
    resourceZones: [{ x: 450, y: 300, richness: 2 }],
    roads: [{ points: [{ x: 20, y: 20 }, { x: 450, y: 300 }, { x: 880, y: 580 }] }]
  });
  const references = [...system.cells];
  const unitReferences = [...system.units];
  assert.equal(system.unitsFor("red").length, 10);
  assert.equal(system.unitsFor("blue").length, 10);
  assert.deepEqual(new Set(system.cells.map(cell => cell.objective)), new Set([null, ...OBJECTIVE_TYPES]));
  const redBase = system.fieldFor("red")[0];
  const neutral = redBase.neighbors.map(id => system.byId.get(id)).find(cell => !cell.owner);
  assert.equal(system.claimCell(neutral.id, "red"), true);
  assert.equal(system.loseCell(neutral.id), true);
  assert.equal(system.reclaimCell(neutral.id, "red"), true);
  assert.equal(system.abandonCell(neutral.id), true);
  assert.equal(system.claimCell(neutral.id, "red"), true);
  assert.equal(system.contestCell(neutral.id, "blue", { attackerStrength: 10000 }), true);
  assert.equal(neutral.owner, "blue");
  assert.equal(system.assertNoNewObjects(), true);
  assert.equal(system.assertNoNewUnits(), true);
  assert.ok(system.cells.every((cell, index) => cell === references[index]));
  assert.ok(system.units.every((unit, index) => unit === unitReferences[index]));
  const saved = JSON.stringify(system.toJSON());
  const restored = new TerritorySystem(new SpatialPartition({ width: 900, height: 600, cellCount: 48, seed: 42 }), [
    { id: "red", base: { x: 30, y: 30 } }, { id: "blue", base: { x: 870, y: 570 } }
  ]);
  restored.loadState(saved);
  assert.equal(restored.territoryCount("blue"), system.territoryCount("blue"));
  assert.equal(restored.units.length, system.units.length);
});

test("Phase 12 unit sieges take twenty seconds alone and gain 20 percent per additional unit", () => {
  const createSystem = () => {
    const partition = new SpatialPartition({ width: 900, height: 600, cellCount: 48, seed: 24 });
    return new TerritorySystem(partition, [
      { id: "red", base: { x: 30, y: 30 } },
      { id: "blue", base: { x: 870, y: 570 } }
    ]);
  };
  const measureCapture = attackerCount => {
    const system = createSystem();
    const target = system.rankSiegeTargets("red")[0].cell;
    const attackers = system.unitsFor("red").slice(0, attackerCount);
    for (const unit of system.units) unit.state = "idle";
    for (const unit of attackers) {
      unit.cellId = target.id;
      unit.targetCellId = target.id;
      unit.path.length = 0;
      unit.state = "capturing";
    }
    let seconds = 0;
    while (target.owner !== "red" && seconds < 200) {
      system._updateSieges(1);
      seconds += 1;
    }
    return seconds;
  };
  assert.ok(Math.abs(measureCapture(1) - 20) <= 2);
  assert.ok(Math.abs(measureCapture(4) - 12.5) <= 2);
});

test("Phase 12 live territory advances only when physical host units occupy the cell", () => {
  const partition = new SpatialPartition({ width: 900, height: 600, cellCount: 48, seed: 91 });
  const system = new TerritorySystem(partition, [
    { id: "red", base: { x: 30, y: 30 } },
    { id: "blue", base: { x: 870, y: 570 } }
  ]);
  const redBase = system.fieldFor("red").find(cell => cell.isBase);
  const target = redBase.neighbors.map(id => system.byId.get(id)).find(cell => !cell.owner);
  assert.ok(target);
  for (let second = 0; second < 90; second += 1) system.advancePhysical(1, []);
  assert.equal(target.owner, null, "empty cells must not be captured by internal/invisible agents");
  for (let second = 0; second < 25 && target.owner !== "red"; second += 1) {
    system.advancePhysical(1, [{ playerId: "red", cellId: target.id, power: 1 }]);
  }
  assert.equal(target.owner, "red", "a physical host unit should complete the capture");
});

test("Phase 12 AI expands only through movement and timed frontier sieges", () => {
  const partition = new SpatialPartition({ width: 1000, height: 700, cellCount: 60, seed: 42 });
  const system = new TerritorySystem(partition, [
    { id: "red", base: { x: 20, y: 20 } },
    { id: "blue", base: { x: 980, y: 680 } }
  ]);
  const initialCells = system.cells.length;
  const initialUnits = system.units.length;
  for (let second = 0; second < 240; second += 1) system.advance(1, { aggression: 1 });
  assert.ok(system.territoryCount("red") > 1 || system.territoryCount("blue") > 1);
  assert.ok(system.log.some(entry => entry.type === "claim"));
  assert.equal(system.cells.length, initialCells);
  assert.equal(system.units.length, initialUnits);
  assert.equal(system.assertNoNewObjects(), true);
  assert.equal(system.assertNoNewUnits(), true);
});

test("Phase 12 annihilate combat captures bases, eliminates factions, and respects game over", () => {
  const partition = new SpatialPartition({ width: 500, height: 300, cellCount: 24, seed: 7 });
  const system = new TerritorySystem(partition, [
    { id: "red", base: { x: 20, y: 20 } },
    { id: "blue", base: { x: 480, y: 280 } }
  ], { startingGarrison: 100 });
  for (const cell of system.cells.filter(cell => cell.owner !== "red")) {
    if (cell.owner === "blue") system.contestCell(cell.id, "red", { attackerStrength: 100000 });
    else system.claimCell(cell.id, "red");
  }
  assert.equal(system.gameOver, true);
  assert.equal(system.winner, "red");
  assert.ok(system.eliminated.has("blue"));
  assert.deepEqual(system.step({ aggression: 1 }), []);
});

test("Phase 13 separates temporary AI supply routes from authored permanent trade routes", () => {
  const nodes = [
    { id: "base", type: "base" }, { id: "bridge", type: "bridge" },
    { id: "detour", type: "road" }, { id: "front", type: "frontline" }
  ];
  const roads = [
    { id: "r1", from: "base", to: "bridge", length: 10 },
    { id: "bridge-road", from: "bridge", to: "front", length: 10, isBridge: true },
    { id: "detour-a", from: "base", to: "detour", length: 16 },
    { id: "detour-b", from: "detour", to: "front", length: 16 }
  ];
  const history = new RouteHistory();
  const graph = new RoadGraph(nodes, roads);
  const routes = new RouteManager(graph, history);
  const supply = routes.createSupplyRoute({ kind: "base-to-frontline", origin: "base", destination: "front", tick: 0, ttlTicks: 20 });
  assert.equal(supply.temporary, true);
  assert.equal(supply.authored, false);
  assert.throws(() => routes.createTradeRoute({ origin: "base", destination: "front" }), /map designer/);
  const trade = routes.createTradeRoute({ authored: true, id: "authored-trade", origin: "base", destination: "front", capacity: 50, resources: ["fuel"] });
  assert.equal(trade.authored, true);
  const convoys = new ConvoyManager(graph, routes, history, 12);
  const convoy = convoys.spawn({ route: supply, routeKind: "supply", faction: "red", cargo: { fuel: 10 } });
  const ai = new RouteAI(graph, routes, convoys, history, "red");
  convoys.tick(1);
  ai.destroy("bridge-road", 2);
  convoys.tick(2);
  for (let tick = 3; tick < 12 && convoy.status === "traveling"; tick += 1) convoys.tick(tick);
  assert.equal(convoy.status, "arrived");
  assert.ok(history.convoy.some(entry => entry.action === "rerouted"));
  assert.ok(history.convoy.some(entry => entry.action === "advanced"));
  ai.secure("r1", 12);
  ai.patrol("r1", 13);
  ai.hold("front", 14);
  ai.escort(convoy.id, 15);
  ai.repair("r1", 16);
  ai.reroute(supply.id, "supply", 17);
  ai.block("r1", 18);
  ai.ambush("r1", 19);
  assert.deepEqual(new Set(history.ai.map(entry => entry.action)), new Set(["destroy", "secure", "patrol", "hold", "escort", "repair", "reroute", "block", "ambush"]));
  routes.expireSupplyRoutes(21);
  assert.equal(supply.active, false);
  assert.equal(trade.active, true);
});

test("Phase 11-13 persistence migration includes all audit tables", async () => {
  const sql = await readFile(new URL("../sql/migrations/007_route_and_territory_history.sql", import.meta.url), "utf8");
  for (const table of ["territory_state", "supply_routes", "road_history", "convoy_history", "trade_history", "ai_actions"]) {
    assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  }
});

test("runtime uses physical captures, faction-owned construction, and warehouse delivery", async () => {
  const app = await readFile(new URL("../js/app.js", import.meta.url), "utf8");
  assert.match(app, /heavyBuilderRace \? \[6, 8\] : \[2, 4\]/);
  assert.match(app, /item\.progress < 1 && item\.faction === unit\.faction/);
  assert.match(app, /structure\.faction !== unit\.faction/);
  assert.match(app, /strategicTerritory\.advancePhysical/);
  assert.match(app, /resourceZoneCaptureTick\(\)/);
  assert.match(app, /closestWarehousePoint\(player\.id, collector\)/);
  assert.doesNotMatch(app, /completed command node secured this cell/i);
});
