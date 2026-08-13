import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dayNightDarkness, globalDayNightVisibility } from "../src/rendering/DayNightSystem.js";
import { EXTRACTABLE_RESOURCES, constructionCostFor, economyProfileFor, formationCostFor } from "../src/economy/FactionEconomyProfiles.js";
import { allocateForceCaps, commandPresenceFor, determineCommitment, updateForceState } from "../src/ai/ForceCommitmentSystem.js";
import { RESOURCE_TYPES } from "../src/economy/ResourceZones.js";

test("global day/night keeps one tint and faction night vision", () => {
  assert.equal(dayNightDarkness("Noon", "clear"), 0);
  assert.ok(dayNightDarkness("Night", "dust") > dayNightDarkness("Night", "clear"));
  assert.ok(globalDayNightVisibility({ period: "Night", nightVision: 0.96 }) > globalDayNightVisibility({ period: "Night", nightVision: 0.2 }));
});

test("only extractable resources can be painted as natural zones", () => {
  assert.deepEqual(RESOURCE_TYPES, EXTRACTABLE_RESOURCES);
  for (const forbidden of ["requisition", "influence", "ammunition", "medical", "faith", "parts"]) assert.equal(RESOURCE_TYPES.includes(forbidden), false);
});

test("faction economies contain only relevant stocks and recruitment costs", () => {
  const tyranids = economyProfileFor({ race: "Tyranids" });
  assert.deepEqual(tyranids.activeResources, ["biomass", "food"]);
  assert.deepEqual(formationCostFor({ race: "Tyranids" }, [{ role: "trooper" }, { role: "commander" }]), { biomass: 26 });
  assert.deepEqual(formationCostFor({ race: "Orks" }, [{ role: "trooper" }, { role: "vehicle" }]), { scrap: 38, fuel: 14 });
  assert.deepEqual(constructionCostFor({ race: "Tyranids" }, 40), { biomass: 54 });
  assert.deepEqual(constructionCostFor({ race: "Necrons" }, 40), { energy: 40, materials: 18 });
});

test("live rendering uses the global tint without dynamic lights or shadow passes", () => {
  const source = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
  const drawStart = source.indexOf("      function draw() {");
  const drawEnd = source.indexOf("      function updateSelectedUnit()", drawStart);
  const drawBody = source.slice(drawStart, drawEnd);
  assert.match(drawBody, /drawDayNightTint\(\)/);
  assert.doesNotMatch(drawBody, /drawDynamicLighting\(\)|drawLightingOverlay\(\)|drawStructureShadows\(\)|drawUnitShadows\(\)/);
  const fogStart = source.indexOf("      function rasterizeVisionSources(teamVisibility) {");
  const fogEnd = source.indexOf("      function updateExploration", fogStart);
  assert.doesNotMatch(source.slice(fogStart, fogEnd), /activeLightSources\(/);
});

test("density allocation produces unequal headcounts at equal battle scale", () => {
  const players = [
    { id: "sm", faction: "Space Marines", race: "Imperium" },
    { id: "ig", faction: "Imperial Guard", race: "Imperium" },
    { id: "ork", race: "Orks" },
    { id: "nid", race: "Tyranids" }
  ];
  const caps = allocateForceCaps(players, 400);
  assert.deepEqual(caps, { sm: 42, ig: 104, ork: 115, nid: 139 });
});

test("commitment can jump directly to all-in while Chapter Masters remain exceptional", () => {
  assert.equal(determineCommitment({ headquartersThreat: 0.8 }), "all-in");
  assert.equal(updateForceState({}, { objectiveImportance: 0.8, enemyStrengthPressure: 0.8, headquartersThreat: 0.8 }).allIn, true);
  const marine = { faction: "Space Marines", race: "Imperium" };
  assert.equal(commandPresenceFor(marine, "all-in", []), "Captain");
  assert.equal(commandPresenceFor(marine, "all-in", ["existential-threat"]), "Chapter Master");
  const runtime = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
  assert.match(runtime, /command: \{ squad: \["Sergeant"\].*exceptional: \["Chapter Master"\]/);
  assert.match(runtime, /commander: \[[^\]]*"Chapter Master"/);
  assert.doesNotMatch(runtime, /commander: \[[^\]]*"Warboss"/);
});
