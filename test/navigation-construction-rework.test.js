import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { NavigationPlanner } from "../src/map/NavigationPlanner.js";
import {
  createNavigationMonitor,
  markNavigationRecovery,
  movementDiagnostic,
  navigationFingerprint,
  sampleNavigationProgress
} from "../src/map/MovementProgressSystem.js";
import { chooseRecoveryPoint, clearNavigationState, recoveryRingCandidates } from "../src/map/StuckRecoverySystem.js";
import { chooseBuilderAssignment } from "../src/construction/BuilderAssignmentSystem.js";
import {
  constructionRefund,
  createConstructionState,
  desiredBuildersFor,
  evaluateConstructionCancellation
} from "../src/construction/ConstructionSystem.js";
import { convoyBaseSpeed, convoyEffectiveSpeed, convoyMovementFactor } from "../src/logistics/ConvoyMovementSystem.js";
import { ConstructionTelemetry } from "../src/diagnostics/ConstructionTelemetry.js";

test("net-progress monitoring detects oscillation and repeated paths despite tiny movement", () => {
  const monitor = createNavigationMonitor(0);
  const goal = { x: 300, y: 0 };
  const path = [{ x: 32, y: 0 }, { x: 64, y: 0 }, { x: 96, y: 0 }];
  let recoveryStage = 0;
  for (let index = 0; index <= 7; index += 1) {
    const sample = sampleNavigationProgress(monitor, {
      now: index * 0.5,
      position: { x: index % 2 ? 2 : 0, y: 0 },
      goal,
      path,
      expectedSpeed: 24
    });
    recoveryStage = Math.max(recoveryStage, sample.recoveryStage || 0);
    if (sample.recoveryStage) markNavigationRecovery(monitor, sample.recoveryStage, { now: index * 0.5, failedPath: path });
  }
  assert.equal(navigationFingerprint(path), "1,0|2,0|3,0");
  assert.ok(recoveryStage >= 2);
  assert.ok(monitor.repeatedPathCount >= 3);
  assert.ok(monitor.failedCells.length > 0);
});

test("movement monitoring does not classify proportionate slow movement as stuck", () => {
  const monitor = createNavigationMonitor(0);
  const goal = { x: 40, y: 0 };
  for (let index = 0; index <= 12; index += 1) {
    const result = sampleNavigationProgress(monitor, {
      now: index * 0.5,
      position: { x: index * 0.5, y: 0 },
      goal,
      expectedSpeed: 1,
      path: []
    });
    assert.equal(result.recoveryStage, 0);
  }
  const diagnostic = movementDiagnostic({ baseSpeed: 20, terrain: 0.5, fatigue: 0.8, suppression: 0.7, legs: 0.5, monitor });
  assert.equal(diagnostic.stuck, false);
  assert.ok(diagnostic.effectiveSpeed < diagnostic.baseSpeed);
});

test("recovery rings choose valid free points and clearing navigation preserves combat state", () => {
  const center = { x: 100, y: 100 };
  const candidates = recoveryRingCandidates(center, { radii: [32, 48], pointsPerRing: 8, seed: 3 });
  assert.equal(candidates.length, 16);
  assert.ok(candidates.every(point => Math.hypot(point.x - center.x, point.y - center.y) >= 31.9));
  const chosen = chooseRecoveryPoint(center, { x: 300, y: 100 }, {
    radii: [32, 48],
    pointsPerRing: 16,
    requireCloser: true,
    valid: point => point.x > 100,
    occupied: point => point.x > 145
  });
  assert.ok(chosen.x > 100 && chosen.x <= 145);
  const unit = { hp: 31, ammo: 4, fuelReserve: 0.2, morale: 0.3, squadId: "s-1", navigationPath: [{ x: 1, y: 1 }], navigationDestination: { x: 4, y: 4 }, detour: { x: 2, y: 2 }, stuckTime: 9 };
  clearNavigationState(unit);
  assert.deepEqual({ hp: unit.hp, ammo: unit.ammo, fuelReserve: unit.fuelReserve, morale: unit.morale, squadId: unit.squadId }, { hp: 31, ammo: 4, fuelReserve: 0.2, morale: 0.3, squadId: "s-1" });
  assert.deepEqual(unit.navigationPath, []);
  assert.equal(unit.navigationDestination, null);
});

test("forced navigation planning bypasses but does not pollute the shared path cache", () => {
  const planner = new NavigationPlanner({ cellSize: 32, maxVisited: 200, maxCacheEntries: 10 });
  const request = { start: { x: 16, y: 16 }, goal: { x: 176, y: 16 }, profile: "infantry", revision: 1, isPassable: () => true, costAt: () => 1 };
  const normal = planner.findPath(request);
  assert.ok(normal.length > 0);
  assert.ok(planner.cachedPath(request)?.length > 0);
  const cacheSize = planner.cache.size;
  const forced = planner.findPath({ ...request, bypassCache: true, costAt: point => point.x < 100 ? 5 : 1 });
  assert.ok(forced.length > 0);
  assert.equal(planner.cache.size, cacheSize);
  assert.equal(planner.cachedPath({ ...request, bypassCache: true }), null);
});

test("builder assignment fills ideal crews then releases extra builders to independent work", () => {
  assert.equal(desiredBuildersFor("turret"), 1);
  assert.equal(desiredBuildersFor("barracks"), 2);
  assert.equal(desiredBuildersFor("dropbay"), 3);
  const builder = { id: "builder-2", x: 0, y: 0 };
  const barracks = { id: "barracks", type: "barracks", x: 20, y: 0, progress: 0.1, alive: true, assignedBuilders: 1, desiredBuilders: 2, construction: createConstructionState() };
  assert.equal(chooseBuilderAssignment({ builder, projects: [barracks], independentScore: 55 }).action, "join");
  assert.equal(chooseBuilderAssignment({ builder, projects: [{ ...barracks, assignedBuilders: 2 }], independentScore: 55 }).action, "independent");
  assert.equal(chooseBuilderAssignment({ builder, projects: [{ ...barracks, x: 220 }], independentScore: 500, constructionFirst: true }).action, "join");
});

test("construction cancellation is hysteretic and refunds only unspent value", () => {
  assert.deepEqual(constructionRefund({ requisition: 100, materials: 50 }, 0), { requisition: 80, materials: 40 });
  assert.deepEqual(constructionRefund({ requisition: 100 }, 0.25), { requisition: 60.00000000000001 });
  const structure = { id: "foundation", type: "barracks", alive: true, progress: 0.2, construction: { ...createConstructionState(), stalledFor: 9, failedApproaches: 2 } };
  assert.equal(evaluateConstructionCancellation(structure, {}).cancel, false);
  structure.construction.failedApproaches = 3;
  assert.deepEqual(evaluateConstructionCancellation(structure, {}), { cancel: true, reason: "site unreachable" });
  assert.equal(evaluateConstructionCancellation({ ...structure, progress: 0.8 }, { placementConflict: true }).cancel, true);
});

test("construction telemetry records cancellation as a first-class lifecycle stage", () => {
  const telemetry = new ConstructionTelemetry();
  telemetry.record("construction:b-1", "construction", 2, { buildingType: "barracks" });
  const cancellation = telemetry.record("construction:b-1", "cancelled", 9, { blockedReason: "site unreachable" });
  assert.equal(cancellation.previousStage, "construction");
  assert.equal(telemetry.summary().stages.cancelled, 1);
});

test("supply transport speeds are faction-specific and cautious convoys no longer crawl", () => {
  assert.equal(convoyBaseSpeed({ mode: "Wartrukk", routeType: "road" }), 24);
  assert.equal(convoyBaseSpeed({ mode: "Rhino transport", routeType: "road" }), 22);
  assert.equal(convoyBaseSpeed({ mode: "cargo aircraft", routeType: "air" }), 40);
  assert.equal(convoyBaseSpeed({ routeType: "rail" }), 32);
  assert.equal(convoyMovementFactor("Awaiting escort"), 0.6);
  assert.ok(Math.abs(convoyEffectiveSpeed({ mode: "supply truck", routeType: "road", status: "Delivering" }, 0.72) - 14.4) < 1e-9);
  assert.ok(Math.abs(convoyEffectiveSpeed({ mode: "supply truck", routeType: "road", status: "Awaiting escort" }, 0.72) - 8.64) < 1e-9);
});

test("browser runtime wires progress recovery, construction reservations/cancellation, builder balancing, and transport speed", async () => {
  const source = await readFile(new URL("../js/app.js", import.meta.url), "utf8");
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(source, /sampleNavigationProgress\(/);
  assert.match(source, /recoverUnitAtSpawnOrigin\(/);
  assert.match(source, /ignoreCache: true, avoidPreviousPath: true/);
  assert.match(source, /function structureReservationCollisionAt\(/);
  assert.match(source, /function cancelConstruction\(/);
  assert.match(source, /constructionRefund\(/);
  assert.match(source, /chooseBuilderAssignment\(/);
  assert.match(source, /desiredBuildersFor\(/);
  assert.match(source, /convoyEffectiveSpeed\(/);
  assert.doesNotMatch(source, /convoy\.status === "Awaiting escort" \? 0\.24/);
  assert.match(html, /id="awt-movement-diagnostic"/);
});
