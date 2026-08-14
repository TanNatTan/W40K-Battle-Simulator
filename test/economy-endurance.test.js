import test from "node:test";
import assert from "node:assert/strict";
import { runAllFactionEconomyEndurance } from "../src/testing/EconomyEnduranceTest.js";

test("every race sustains a sixty-minute economy and recovers from infrastructure loss", () => {
  const results = runAllFactionEconomyEndurance({ durationMinutes: 60 });
  assert.equal(results.length, 7);
  for (const result of results) {
    assert.equal(result.pass, true, JSON.stringify(result));
    assert.equal(result.deadlock, false);
    assert.ok(result.recoveryCompletedAt > result.recoveryStartedAt);
    assert.ok(result.productionByPhase.every(value => value > 0));
    assert.ok(result.deliveries >= 20);
  }
});
