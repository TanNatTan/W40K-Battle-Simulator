import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  SUBFACTION_BUILDINGS,
  SUBFACTION_BUILDING_ORDER,
  subfactionBuildingLabelFor,
  subfactionBuildingTypesFor,
  validateSubfactionBuildingCatalog
} from "../src/factions/SubfactionBuildingSystem.js";
import {
  BUILDER_REPAIR_CREW_LIMIT,
  activeRepairCrewCount,
  builderRepairCrewLimit,
  builderRepairSlotAvailable,
  claimRepairAssignment,
  releaseStaleRepairAssignment
} from "../src/construction/RepairCrewSystem.js";

test("all 68 subfactions expose their complete 13-building doctrine", () => {
  const validation = validateSubfactionBuildingCatalog();
  assert.equal(validation.valid, true, validation.issues.join("\n"));
  assert.equal(validation.count, 68);
  assert.equal(validation.slotsPerProfile, 13);
  assert.equal(Object.keys(SUBFACTION_BUILDINGS).length, 68);
  assert.equal(SUBFACTION_BUILDING_ORDER.length, 13);

  for (const subfaction of Object.keys(SUBFACTION_BUILDINGS)) {
    assert.deepEqual(subfactionBuildingTypesFor(subfaction), [
      "outpost", "barracks", "workshop", "researchcenter", "fieldhospital", "generator",
      "warehouse", "refinery", "dropbay", "observationtower", "bunker", "turret", "signature"
    ]);
  }
});

test("subfaction building labels preserve the authored faction identity", () => {
  assert.equal(subfactionBuildingLabelFor("Ultramarines", "outpost"), "Macragge Command Bastion");
  assert.equal(subfactionBuildingLabelFor("Emerald Suns", "signature"), "Citadel of Loyola");
  assert.equal(subfactionBuildingLabelFor("Death Korps of Krieg", "turret"), "Earthshaker Position");
  assert.equal(subfactionBuildingLabelFor("Farsight Enclaves", "workshop"), "Crisis Battlesuit Forge");
  assert.equal(subfactionBuildingLabelFor("Goff Mob", "barracks"), "Goff Boyz Hut");
  assert.equal(subfactionBuildingLabelFor("Repair Cohort", "fieldhospital"), "Grand Reanimation Complex");
  assert.equal(subfactionBuildingLabelFor("Leviathan", "signature"), "Leviathan Norn Nexus");
  assert.equal(subfactionBuildingLabelFor("Thousand Sons", "researchcenter"), "Great Sorcerous Archive");
  assert.equal(subfactionBuildingLabelFor("Slaanesh Host", "turret"), "Sonic Warp Shrine");
});

test("resident caretakers lead repairs and severe damage may draw the authored reserve", () => {
  const player = { faction: "Space Marines", subfaction: "Salamanders" };
  const servitor = { id: "s1", faction: "a", role: "builder", name: "Servitor", alive: true };
  const routine = { targetId: "forge", targetType: "building", severity: 0.1, underFire: false };
  const severe = { ...routine, severity: 0.55 };
  const target = { id: "forge", type: "workshop", progress: 1, alive: true, hp: 570, maxHp: 600, condition: 0.95 };
  assert.equal(BUILDER_REPAIR_CREW_LIMIT, 1);
  assert.equal(builderRepairCrewLimit(player, servitor, routine, target), 1);
  assert.equal(builderRepairCrewLimit(player, servitor, severe, target), 3);

  const first = { ...servitor };
  claimRepairAssignment(first, target.id, 10);
  const second = { ...servitor, id: "s2" };
  const third = { ...servitor, id: "s3" };
  assert.equal(activeRepairCrewCount({ units: [first, second, third], targetId: target.id, faction: "a", now: 10.2 }), 1);
  assert.equal(builderRepairSlotAvailable({ player, unit: second, request: routine, target, units: [first, second, third], now: 10.2 }), false);
  assert.equal(builderRepairSlotAvailable({ player, unit: second, request: severe, target, units: [first, second, third], now: 10.2 }), true);
  claimRepairAssignment(second, target.id, 10.2);
  assert.equal(builderRepairSlotAvailable({ player, unit: third, request: severe, target, units: [first, second, third], now: 10.3 }), true);
});

test("stale repair claims expire and Orks use multi-builder repair crews", () => {
  const stale = { id: "s1", faction: "a", role: "builder", name: "Servitor", repairTargetId: "forge", repairAssignmentAt: 2 };
  assert.equal(releaseStaleRepairAssignment(stale, 3), true);
  assert.equal(stale.repairTargetId, null);

  const grot = { id: "g1", faction: "b", role: "builder", name: "Gretchin" };
  assert.equal(builderRepairCrewLimit({ race: "Orks", faction: "Scrap Legion" }, grot, { targetType: "building", severity: 0.1 }, { progress: 1, alive: true, type: "barracks" }), 2);
});

test("browser runtime plans construction above builders and applies the universal repair gate", async () => {
  const source = await readFile(new URL("../js/app.js", import.meta.url), "utf8");
  assert.match(source, /signature:\s*\{ label: "Signature Facility"/);
  assert.match(source, /subfactionBuildingLabelFor\(player, type, fallback\)/);
  assert.match(source, /chooseSubfactionBuildProject\(\{/);
  assert.match(source, /availableBuildingRepairs = state\.sustainmentRequests\.filter/);
  assert.match(source, /builderRepairSlotAvailable\(\{/);
  assert.match(source, /planFactionConstruction\(player\)/);
  assert.match(source, /construction\.state = "planned"/);
  assert.doesNotMatch(source, /tryStartBuilderConstruction/);
  assert.match(source, /builderHomeStatus\(unit, state\.structures\)/);
  assert.match(source, /constructionFirst: true/);
  assert.doesNotMatch(source, /Paused construction to save/);
  assert.match(source, /claimRepairAssignment\(unit, damaged\.id, state\.time\)/);
  const projectAssignment = source.indexOf("const alliedProjects = state.structures");
  const constructionExecution = source.indexOf("if (unit.buildProject)", projectAssignment);
  const buildingRepair = source.indexOf("const damaged = urgentRepair", constructionExecution);
  const resourceCollection = source.indexOf("if (updateResourceCollector(unit, dt)) return;", buildingRepair);
  const obstacleClearing = source.indexOf("const removableObstacle", resourceCollection);
  assert.ok(projectAssignment >= 0 && projectAssignment < constructionExecution);
  assert.ok(constructionExecution < buildingRepair);
  assert.ok(buildingRepair < resourceCollection);
  assert.ok(resourceCollection < obstacleClearing);
});
