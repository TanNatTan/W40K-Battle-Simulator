import assert from "node:assert/strict";
import test from "node:test";

import { assignCombinedArmsSupport, vehicleBattlefieldPurpose } from "../src/formations/FormationSystem.js";

function rng(seed) {
  let state = seed >>> 0;
  return () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
}

function bruteNearest(origin, candidates) {
  let best = null;
  let bestRange = Infinity;
  for (const candidate of candidates) {
    const range = Math.hypot(candidate.x - origin.x, candidate.y - origin.y);
    if (range < bestRange) { bestRange = range; best = candidate; }
  }
  return best;
}

test("indexed nearest-support assignment matches an all-pairs scan on a large mixed army", () => {
  const random = rng(11);
  const units = [];
  const make = (id, role, extra = {}) => units.push({ id, role, alive: true, hp: random() < 0.4 ? 40 : 100, maxHp: 100, x: random() * 3000, y: random() * 1800, name: id, ...extra });
  for (let i = 0; i < 260; i += 1) make(`inf-${i}`, "trooper");
  for (let i = 0; i < 60; i += 1) make(`veh-${i}`, "vehicle", { vehicleState: { type: i % 3 ? "tank" : "artillery" } });
  for (let i = 0; i < 20; i += 1) make(`med-${i}`, "medic");
  const { groups, assignments } = assignCombinedArmsSupport(units);
  const line = [...groups.infantry, ...groups["heavy-infantry"]];
  assert.ok(line.length > 100 && groups.vehicles.length > 20, "fixture is large enough to use the grid");
  for (const vehicle of groups.vehicles) {
    assert.equal(assignments.get(vehicle.id)?.targetId, bruteNearest(vehicle, line)?.id, `screen for ${vehicle.id}`);
    assert.equal(assignments.get(vehicle.id)?.purpose, vehicleBattlefieldPurpose(vehicle));
  }
  for (const infantry of line) {
    assert.equal(assignments.get(infantry.id)?.targetId, bruteNearest(infantry, groups.vehicles)?.id, `armour for ${infantry.id}`);
  }
  const wounded = line.filter(unit => unit.hp < unit.maxHp);
  for (const medic of groups.medical) {
    assert.equal(assignments.get(medic.id)?.targetId, bruteNearest(medic, wounded)?.id, `casualty for ${medic.id}`);
  }
});

test("assignment handles empty and tiny armies", () => {
  assert.equal(assignCombinedArmsSupport([]).assignments.size, 0);
  const small = assignCombinedArmsSupport([
    { id: "a", role: "trooper", alive: true, x: 0, y: 0 },
    { id: "v", role: "vehicle", alive: true, x: 30, y: 0, vehicleState: { type: "tank" } }
  ]);
  assert.equal(small.assignments.get("v").targetId, "a");
  assert.equal(small.assignments.get("a").targetId, "v");
});
