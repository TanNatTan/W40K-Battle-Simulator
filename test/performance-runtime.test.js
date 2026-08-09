import test from "node:test";
import assert from "node:assert/strict";
import { Profiler } from "../src/diagnostics/Profiler.js";
import { RuntimeTelemetry } from "../src/diagnostics/RuntimeTelemetry.js";
import { SnapshotRingBuffer } from "../src/replay/SnapshotRingBuffer.js";
import { runFixedStepBudget } from "../src/simulation/FixedStepRunner.js";

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
