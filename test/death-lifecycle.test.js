import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { expiredDeadUnitIds, scheduleDeathRemoval } from "../src/simulation/DeathLifecycle.js";

test("dead units receive a fixed cleanup deadline and expire after it", () => {
  const unit = { id: "marine-1", alive: false };
  assert.equal(scheduleDeathRemoval(unit, 12, 8), 20);
  assert.equal(unit.deathStartedAt, 12);
  assert.equal(expiredDeadUnitIds([unit], 19.99, 8).size, 0);
  assert.deepEqual([...expiredDeadUnitIds([unit], 20, 8)], [unit.id]);
});

test("living units never receive a corpse-removal deadline", () => {
  const unit = { id: "ork-1", alive: true };
  assert.equal(scheduleDeathRemoval(unit, 5, 8), null);
  assert.equal(expiredDeadUnitIds([unit], 50, 8).size, 0);
  assert.equal("removalAt" in unit, false);
});

test("loaded dead units missing timestamps begin their retention period safely", () => {
  const unit = { id: "guard-1", alive: false };
  assert.equal(expiredDeadUnitIds([unit], 40, 8).size, 0);
  assert.equal(unit.deathStartedAt, 40);
  assert.equal(unit.removalAt, 48);
});

test("browser simulation schedules and cleans every dead unit", async () => {
  const app = await readFile(new URL("../js/app.js", import.meta.url), "utf8");
  assert.equal((app.match(/scheduleDeathRemoval\(/g) || []).length, 2);
  assert.match(app, /expiredDeadUnitIds\(state\.units, state\.time, UNIT_CORPSE_LIFETIME_SECONDS\)/);
  assert.match(app, /state\.units = state\.units\.filter\(unit => !expiredUnitIds\.has\(unit\.id\)\)/);
  assert.match(app, /passengerIds\.filter\(id => !expiredUnitIds\.has\(id\)\)/);
});
