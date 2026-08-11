import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import factionConfig from "../js/modules/faction-config.js";
import {
  SUBFACTION_BRANCH_ARCHETYPES,
  constructionOrderFor,
  nextProductionDirectiveFor,
  productionBranchFor,
  productionProducerTypesFor,
  validateSubfactionProductionBranches
} from "../src/factions/SubfactionProductionDoctrine.js";

const families = [
  { player: { subfaction: "Blood Angels", faction: "Space Marines", race: "Imperium" }, roster: factionConfig.astartes.roster },
  { player: { subfaction: "Death Korps of Krieg", faction: "Imperial Guard", race: "Imperium" }, roster: factionConfig.guard.roster },
  { player: { subfaction: "Mars Forge", faction: "Machine Cult", race: "Imperium" }, roster: factionConfig.mechanicus.roster },
  { player: { subfaction: "Iron Warriors", faction: "Chaos Space Marines", race: "Chaos" }, roster: factionConfig.chaos.roster },
  { player: { subfaction: "Speed Freeks", faction: "Orks", race: "Orks" }, roster: factionConfig.ork.roster },
  { player: { subfaction: "Repair Cohort", faction: "Dynastic Host", race: "Necrons" }, roster: factionConfig.necron.roster },
  { player: { subfaction: "Farsight Enclaves", faction: "Frontier Cadre", race: "T'au" }, roster: factionConfig.tau.roster },
  { player: { subfaction: "Lictor Brood", faction: "Hive Fleet", race: "Tyranids" }, roster: factionConfig.tyranid.roster }
];

test("all 68 subfactions have a dependency-safe thirteen-building branch", () => {
  assert.equal(Object.keys(SUBFACTION_BRANCH_ARCHETYPES).length, 68);
  const validation = validateSubfactionProductionBranches(factionConfig.astartes.roster);
  assert.equal(validation.valid, true, validation.issues.join("\n"));
  assert.equal(validation.count, 68);
  assert.notDeepEqual(constructionOrderFor("Blood Angels"), constructionOrderFor("Imperial Fists"));
  assert.notDeepEqual(constructionOrderFor("White Scars"), constructionOrderFor("Iron Hands"));
});

test("every faction-family branch schedules every unit and vehicle in its roster", () => {
  for (const { player, roster } of families) {
    const branch = productionBranchFor(player, roster);
    const expected = Object.entries(roster).flatMap(([role, names]) => names.map(name => `${role}:${name}`));
    const actual = branch.completeRosterOrder.map(entry => `${entry.role}:${entry.name}`);
    assert.equal(branch.constructionOrder.length, 13, `${player.subfaction} building count`);
    assert.equal(new Set(branch.constructionOrder).size, 13, `${player.subfaction} unique buildings`);
    for (const entry of expected) assert.ok(actual.includes(entry), `${player.subfaction} omitted ${entry}`);
    assert.ok(branch.productionSchedule.length >= branch.unitOrder.length + branch.vehicleOrder.length);
    assert.deepEqual(nextProductionDirectiveFor(player, roster, 0), {
      ...branch.productionSchedule[0],
      producerTypes: productionProducerTypesFor(branch.productionSchedule[0]),
      branchId: branch.id,
      archetype: branch.archetype
    });
  }
});

test("vehicles use war forges and aircraft prefer deployment facilities", () => {
  assert.deepEqual(productionProducerTypesFor({ role: "vehicle", name: "Leman Russ" }), ["workshop"]);
  assert.deepEqual(productionProducerTypesFor({ role: "vehicle", name: "Thunderhawk" }), ["dropbay", "workshop"]);
  assert.deepEqual(productionProducerTypesFor({ role: "trooper", name: "Intercessor" }), ["barracks"]);
});

test("browser runtime consumes the branch for both construction and production", async () => {
  const app = await readFile(new URL("../js/app.js", import.meta.url), "utf8");
  assert.match(app, /chooseSubfactionBuildProject\(\{/);
  assert.match(app, /branchBonus/);
  assert.match(app, /chooseMilitaryProduction\(\{/);
  assert.doesNotMatch(app, /nextProductionDirectiveFor\(player, roster, cycle\)/);
  assert.match(app, /groupManifest\[0\]\?\.producerTypes/);
  assert.match(app, /spawnProductionGroup\(player, producer, groupManifest\)/);
});
