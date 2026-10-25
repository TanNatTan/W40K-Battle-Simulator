import assert from "node:assert/strict";
import test from "node:test";

import { SpatialPartition, TerritorySystem } from "../src/territory/TerritorySystem.js";

function makeSystem(resourceZones) {
  const partition = new SpatialPartition({ width: 1200, height: 800, cellCount: 36, seed: 7, relaxIterations: 2 });
  return new TerritorySystem(partition, [
    { id: "a", color: "#fff", base: { x: 100, y: 400 } },
    { id: "b", color: "#000", base: { x: 1100, y: 400 } }
  ], { resourceZones, unitConfig: { unitsPerPlayer: 4 } });
}

test("typed resource zones are indexed per cell", () => {
  const system = makeSystem([
    { x: 600, y: 200, resourceType: "scrap", richness: 3 },
    { x: 600, y: 600, resourceType: "food", richness: 3 }
  ]);
  const scrapCell = system.byId.get(system.partition.closestCell({ x: 600, y: 200 }).id);
  assert.ok(scrapCell.resourceTypes.scrap >= 3);
  assert.ok(scrapCell.typedAccess >= 3);
  assert.ok(scrapCell.resourceAccess >= 3);
});

test("cells holding a resource the faction needs outrank equally rich cells it does not", () => {
  const system = makeSystem([
    { x: 600, y: 200, resourceType: "scrap", richness: 3 },
    { x: 600, y: 600, resourceType: "food", richness: 3 }
  ]);
  const scrapCell = system.byId.get(system.partition.closestCell({ x: 600, y: 200 }).id);
  const foodCell = system.byId.get(system.partition.closestCell({ x: 600, y: 600 }).id);
  // Without needs the two are equal by construction.
  assert.equal(system.resourceValueFor(scrapCell, "a"), system.resourceValueFor(foodCell, "a"));
  system.setResourceNeeds("a", { scrap: 0.9, food: 0.1 });
  assert.ok(system.resourceValueFor(scrapCell, "a") > system.resourceValueFor(foodCell, "a") * 1.8);
  assert.equal(system.neededResourceIn(scrapCell, "a"), "scrap");
  assert.equal(system.neededResourceIn(foodCell, "a"), "food");
  // Another player's needs are independent.
  system.setResourceNeeds("b", { food: 1 });
  assert.ok(system.resourceValueFor(foodCell, "b") > system.resourceValueFor(scrapCell, "b"));
});

test("landmark exports raise a cell's typed value and idle territory units are sent to needed cells", () => {
  const partition = new SpatialPartition({ width: 1200, height: 800, cellCount: 36, seed: 7, relaxIterations: 2 });
  const system = new TerritorySystem(partition, [{ id: "a", color: "#fff", base: { x: 100, y: 400 } }], {
    objectives: [{ x: 300, y: 400, type: "resource-hub", sourceId: "n1", exports: { biomass: 30 } }],
    unitConfig: { unitsPerPlayer: 2 }
  });
  const hub = system.byId.get(system.partition.closestCell({ x: 300, y: 400 }).id);
  assert.ok(hub.resourceTypes.biomass > 3);
  system.setResourceNeeds("a", { biomass: 1 });
  const ranked = system.rankSiegeTargets("a");
  assert.ok(ranked.length > 0);
});

test("browser runtime feeds hard needs into expansion and territory scoring", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../js/app.js", import.meta.url), "utf8");
  assert.match(source, /function hardResourceNeeds\(player\)/);
  assert.match(source, /player\.race === "Orks" && usable\("scrap"\)/);
  assert.match(source, /player\.race === "Tyranids" && usable\("biomass"\)/);
  assert.match(source, /needs\.food = 55/);
  assert.match(source, /Critical need \$\{hardResource\}: capture \$\{hardSource\}/);
  assert.match(source, /syncTerritoryResourceNeeds\(\);/);
  assert.match(source, /resourceZones: state\.resourceZones\.filter/);
});
