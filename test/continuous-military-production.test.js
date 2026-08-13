import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  combatProductionCapacity,
  lockProductionManifest,
  productionRequestsToProcess,
  selectMilitaryProducer,
  trimRequestQueue
} from "../src/economy/MilitaryProductionQueueSystem.js";

test("combat production fills the hard army cap instead of stopping at deployment commitment", () => {
  assert.deepEqual(combatProductionCapacity(120, 24), { target: 120, living: 24, availableSlots: 96, shouldQueue: true });
  assert.deepEqual(combatProductionCapacity(120, 120), { target: 120, living: 120, availableSlots: 0, shouldQueue: false });
});

test("training supplies go to the facility that can produce the locked unit", () => {
  const structures = [
    { id: "barracks", faction: "a", type: "barracks", progress: 1, alive: true, condition: 1 },
    { id: "forge", faction: "a", type: "workshop", progress: 1, alive: true, condition: 1 }
  ];
  assert.equal(selectMilitaryProducer({ structures, faction: "a", producerTypes: ["workshop"] }).id, "forge");
  assert.equal(selectMilitaryProducer({ structures, faction: "a", producerTypes: ["fieldhospital"] }), null);

  structures.push({ id: "fresh-barracks", faction: "a", type: "barracks", progress: 1, alive: true, condition: 1, nextTrainingAt: 0 });
  structures[0].nextTrainingAt = 80;
  assert.equal(selectMilitaryProducer({ structures, faction: "a", producerTypes: ["barracks"], now: 20 }).id, "fresh-barracks");

  const request = { type: "train", status: "Requested" };
  const locked = lockProductionManifest(request, [{ name: "Predator", role: "vehicle", producerTypes: ["workshop"] }]);
  assert.equal(locked[0].name, "Predator");
  assert.deepEqual(lockProductionManifest(request, [{ name: "Rhino", role: "vehicle" }]), locked);
});

test("a military production order cannot be starved by higher-priority logistics requests", () => {
  const train = { id: "train", type: "train", status: "Requested" };
  const selected = productionRequestsToProcess([
    { id: "emergency", type: "emergency", status: "Requested" },
    { id: "repair", type: "repair", status: "Requested" },
    train
  ], 2);
  assert.deepEqual(selected.map(request => request.id), ["emergency", "repair", "train"]);

  const crowded = Array.from({ length: 15 }, (_, index) => ({ id: `request-${index}`, type: "resupply", status: "Requested" }));
  crowded.push(train);
  assert.ok(trimRequestQueue(crowded, 12).includes(train));
});

test("runtime keeps a locked military queue, excludes builders, and uses the real producer", () => {
  const source = fs.readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
  assert.match(source, /const unitCap = unitCapFor\(player\)/);
  assert.match(source, /productionManifest: manifest\.map/);
  assert.match(source, /selectMilitaryProducer\(\{ structures: state\.structures, faction: player\.id, producerTypes, now: state\.time \}\)/);
  assert.match(source, /destinationId: producer\.id/);
  assert.match(source, /const producerReadyAt = Number\(producer\?\.nextTrainingAt\) \|\| 0/);
  assert.match(source, /producer\.nextTrainingAt = state\.time \+ /);
  assert.doesNotMatch(source, /state\.time >= state\.nextTrain\[player\.id\]/);
  assert.match(source, /const reservedTrainingRequest = economy\.queue\.find/);
  assert.match(source, /reservedTrainingRequest \? 0 : 5/);
  assert.match(source, /reservedTrainingCargo\[key\] \|\| 0/);
  assert.match(source, /const remainingCapacity = Math\.max\(0, unitCap - \(living \+ guardBatchSize\)\)/);
  assert.match(source, /const nextManifest = productionManifestFor\(player, remainingCapacity\)/);
  assert.match(source, /const marineSquadClass = player\.faction === "Space Marines"/);
  assert.match(source, /reinforcementWaveSize\(\{/);
  assert.match(source, /selectIncompleteAstartesSquad/);
  assert.match(source, /const podRoles = \["Intercessor", "Intercessor", "Assault Intercessor", "Hellblaster"\]/);
  assert.match(source, /pod\.deployedUnitCount = deployedUnits\.length/);
  assert.match(source, /unit\.alive && !unit\.incapacitated && unit\.faction === player\.id/);
  assert.doesNotMatch(source, /const unitCap = desiredFieldStrengthFor\(player\);/);
});
