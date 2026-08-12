import assert from "node:assert/strict";
import test from "node:test";

import {
  defensePackageForMilestone,
  pendingTerritoryDefenseOrder,
  recordTerritoryCapture,
  territoryDefenseOrdersForCapture
} from "../src/territory/TerritoryDefenseSystem.js";

test("every fifth physical territory capture creates a defense package for that cell", () => {
  const player = { id: "a" };
  for (let capture = 1; capture <= 4; capture += 1) assert.equal(recordTerritoryCapture(player, `${capture},0`, capture).orders.length, 0);
  const milestone = recordTerritoryCapture(player, "5,0", 5);
  assert.deepEqual(milestone.orders.map(order => order.buildingType), ["bunker", "turret"]);
  assert.ok(milestone.orders.every(order => order.cellKey === "5,0"));
  for (let capture = 6; capture <= 9; capture += 1) recordTerritoryCapture(player, `${capture},0`, capture);
  assert.deepEqual(recordTerritoryCapture(player, "10,0", 10).orders.map(order => order.buildingType), ["observationtower", "bunker", "turret"]);
});

test("territory defense orders reconcile construction and completion", () => {
  const player = { id: "a", territoryDefenseOrders: territoryDefenseOrdersForCapture({ playerId: "a", cellKey: "5,0", captureCount: 5 })
    .map(order => ({ ...order })) };
  const first = pendingTerritoryDefenseOrder(player, []);
  first.structureId = "fort-1";
  const active = pendingTerritoryDefenseOrder(player, [{ id: "fort-1", alive: true, progress: 0.4 }]);
  assert.equal(active.buildingType, "turret");
  const structure = { id: "fort-1", alive: true, progress: 1, completedAt: 20 };
  pendingTerritoryDefenseOrder(player, [structure]);
  assert.equal(player.territoryDefenseOrders[0].status, "complete");
  assert.deepEqual(defensePackageForMilestone(2), ["observationtower", "bunker", "turret"]);
});
