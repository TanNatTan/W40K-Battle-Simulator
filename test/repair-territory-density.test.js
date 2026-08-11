import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { BUILDING_CLEARANCE, buildingClearanceFor, placementRectsOverlap } from "../src/construction/BaseLayoutSystem.js";
import {
  REPAIR_BALANCE,
  buildingRepairRate,
  repairInteractionRange,
  sustainmentProfileFor,
  sustainmentRequestFor
} from "../src/support/SustainmentSystem.js";
import { SpatialPartition, TerritorySystem } from "../src/territory/TerritorySystem.js";

test("builders can reach building footprints and rapidly restore them to full health", () => {
  const builder = { role: "builder", collisionRadius: 3, engineering: 0.8 };
  const building = { id: "hq", faction: "a", type: "outpost", hp: 360, maxHp: 720, hitbox: { w: 40, h: 34 }, alive: true };
  const collisionBoundary = Math.hypot(building.hitbox.w / 2 + builder.collisionRadius, building.hitbox.h / 2 + builder.collisionRadius);
  const repairRange = repairInteractionRange(builder, building);
  assert.ok(repairRange > collisionBoundary, "the service radius must sit outside the completed building hitbox");
  assert.equal(repairRange, collisionBoundary + REPAIR_BALANCE.interactionPadding);

  const profile = sustainmentProfileFor({ race: "Imperium", faction: "Imperial Guard" });
  const rate = buildingRepairRate(builder, building, profile, true);
  assert.ok(rate * 8 >= building.maxHp - building.hp, "a single supplied builder should repair major damage in under eight seconds");

  assert.ok(sustainmentRequestFor({ ...building, hp: building.maxHp - 0.01 }), "repair remains requested until the health bar is full");
  assert.equal(sustainmentRequestFor({ ...building, hp: building.maxHp }), null);
});

test("developed strategic territory survives sieges and isolation until its building is gone", () => {
  const partition = new SpatialPartition({ width: 700, height: 500, cellCount: 42, seed: 77 });
  const system = new TerritorySystem(partition, [
    { id: "red", base: { x: 30, y: 30 } },
    { id: "blue", base: { x: 670, y: 470 } }
  ]);
  const blueBase = system.fieldFor("blue").find(cell => cell.isBase);
  const protectedCells = new Map([[blueBase.id, new Set(["blue"])]]);
  for (let second = 0; second < 90; second += 1) {
    system.advancePhysical(1, [{ playerId: "red", cellId: blueBase.id, power: 5 }], { protectedCells });
  }
  assert.equal(blueBase.owner, "blue");
  assert.equal(blueBase.siege, null);

  const isolated = system.cells.find(cell => !cell.owner && !cell.neighbors.includes(blueBase.id));
  assert.ok(isolated);
  isolated.owner = "blue";
  isolated.state = "claimed";
  system.reconnectIsolatedCells("blue", 0, new Map([[isolated.id, "blue"]]));
  assert.equal(isolated.owner, "blue");
  system.reconnectIsolatedCells("blue", 0);
  assert.equal(isolated.owner, null);
});

test("building clearance is compact while preserving non-overlap and service lanes", () => {
  assert.deepEqual(BUILDING_CLEARANCE, {
    headquarters: 18,
    largeProduction: 14,
    production: 10,
    storage: 9,
    defense: 6,
    turret: 4,
    default: 8
  });
  const clearance = buildingClearanceFor("barracks", { hitbox: { w: 36, h: 30 }, purpose: "Production" });
  const existing = { x: 100, y: 100, hitbox: { w: 36, h: 30 } };
  assert.equal(placementRectsOverlap({ x: 145, y: 100 }, { w: 36, h: 30 }, clearance, existing, clearance), true);
  assert.equal(placementRectsOverlap({ x: 147, y: 100 }, { w: 36, h: 30 }, clearance, existing, clearance), false);
});

test("browser runtime uses fast footprint-aware repairs and operational building anchors", () => {
  const source = fs.readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
  assert.match(source, /repairInteractionRange\(unit, damaged\)/);
  assert.match(source, /buildingRepairRate\(unit, damaged, profile, supplied\)/);
  assert.match(source, /REPAIR_BALANCE\.builderResponseRadius/);
  assert.match(source, /operationalBuildingAnchorsTerritoryCell\(/);
  assert.match(source, /protectedCells\.get\(cellId\)\.add\(structure\.faction\)/);
  assert.match(source, /const cellSiteOffset = Math\.min\(30, TERRITORY_CELL_SIZE \* 0\.3\)/);
});
