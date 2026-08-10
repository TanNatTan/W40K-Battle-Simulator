import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Profiler } from "../src/diagnostics/Profiler.js";
import { RuntimeTelemetry } from "../src/diagnostics/RuntimeTelemetry.js";
import { SnapshotRingBuffer } from "../src/replay/SnapshotRingBuffer.js";
import { runFixedStepBudget } from "../src/simulation/FixedStepRunner.js";
import { NavigationPlanner } from "../src/map/NavigationPlanner.js";
import { WorkBudget } from "../src/performance/ScaleSystem.js";
import { analyzeDistantUnits } from "../src/performance/DistantSimulation.js";

test("runtime telemetry is throttled and avoids unchanged dataset writes", () => {
  const telemetry = new RuntimeTelemetry({ intervalMs: 1000 });
  const element = { dataset: {} };
  assert.equal(telemetry.shouldUpdate(0), true);
  assert.equal(telemetry.shouldUpdate(999), false);
  assert.equal(telemetry.shouldUpdate(1000), true);
  assert.equal(telemetry.set(element, "livingUnits", 12), true);
  assert.equal(telemetry.set(element, "livingUnits", 12), false);
});

test("fixed-step runner limits work and caps accumulated backlog", () => {
  let clockValue = 0;
  let updates = 0;
  const result = runFixedStepBudget({
    accumulator: 1,
    stepSeconds: 0.05,
    maxSteps: 3,
    maxWorkMs: 8,
    clock: () => clockValue,
    update: () => { updates += 1; clockValue += 2; }
  });
  assert.equal(updates, 3);
  assert.equal(result.steps, 3);
  assert.equal(result.accumulator, 0.2);
  assert.equal(result.droppedBacklog, true);
});

test("snapshot ring buffer retains only the newest entries without shifting length", () => {
  const snapshots = new SnapshotRingBuffer(3);
  snapshots.push({ t: 1 }, { t: 2 }, { t: 3 }, { t: 4 });
  assert.deepEqual(snapshots.map(snapshot => snapshot.t), [2, 3, 4]);
  snapshots.clear();
  assert.equal(snapshots.length, 0);
});

test("profiler records bounded system timing only when enabled", () => {
  let clockValue = 0;
  const profiler = new Profiler({ enabled: true, budgetMs: 8, clock: () => clockValue });
  profiler.profile("simulation", () => { clockValue = 12; });
  assert.deepEqual(profiler.report(), [{
    system: "simulation", calls: 1, averageMs: 12, p50Ms: 12, p90Ms: 12, p95Ms: 12, p99Ms: 12,
    maximumMs: 12, overBudget: 1, callsPerSecond: 1
  }]);
  profiler.reset();
  assert.deepEqual(profiler.report(), []);
});

test("pathfinding work is bounded while cached routes remain free", () => {
  const budget = new WorkBudget(2);
  assert.equal(budget.take(), true);
  assert.equal(budget.take(), true);
  assert.equal(budget.take(), false);
  assert.deepEqual({ used: budget.used, deferred: budget.deferred }, { used: 2, deferred: 1 });
  budget.begin(1);
  assert.equal(budget.remaining, 1);

  const planner = new NavigationPlanner({ cellSize: 16, maxVisited: 1000 });
  const request = { start: { x: 8, y: 8 }, goal: { x: 72, y: 72 }, profile: "infantry", revision: 1 };
  assert.equal(planner.cachedPath(request), null);
  const path = planner.findPath({ ...request, isPassable: () => true });
  assert.ok(path.length > 0);
  const cached = planner.cachedPath(request);
  assert.deepEqual(cached, path);
  cached[0].x = -1;
  assert.notEqual(planner.cachedPath(request)[0].x, -1);
});

test("large-battle runtime uses worker broadphase and spatial projectile collision", async () => {
  const [app, worker] = await Promise.all([
    readFile(new URL("../js/app.js", import.meta.url), "utf8"),
    readFile(new URL("../src/performance/simulation-worker.js", import.meta.url), "utf8")
  ]);
  assert.match(app, /navigationWorkBudget\.take\(\)/);
  assert.match(app, /nearbyCombatObjects\(midpoint,/);
  assert.match(app, /state\.projectiles\.length = activeCount/);
  assert.match(app, /workerThreatIds/);
  assert.match(app, /workerClock - state\.lastWorkerDispatchAt >= 750/);
  assert.match(worker, /analyzeDistantUnits/);

  const analysis = analyzeDistantUnits([
    { id: "a1", faction: "a", team: "1", x: 0, y: 0, alive: true, damage: 10, accuracy: 1, morale: 1 },
    { id: "ally", faction: "c", team: "1", x: 20, y: 0, alive: true, damage: 8, accuracy: 1, morale: 1 },
    { id: "enemy", faction: "b", team: "2", x: 40, y: 0, alive: true, damage: 12, accuracy: 1, morale: 1 }
  ], 1);
  const hint = analysis.unitHints.find(item => item.id === "a1");
  assert.deepEqual(hint.allyIds, ["ally"]);
  assert.deepEqual(hint.hostileIds, ["enemy"]);
  assert.ok(analysis.factions.a.expectedAttrition > 0);
});
