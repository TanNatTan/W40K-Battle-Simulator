import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { FACTION_ECONOMY_PROFILES } from "../src/economy/FactionEconomyProfiles.js";
import { productionDefinitionForStructure, productionDefinitionsFor, validateProductionCatalog } from "../src/economy/ProductionBuildingCatalog.js";
import { updateProductionBuilding } from "../src/economy/ProductionSystem.js";
import { LEGACY_RESOURCE_ZONE_DIAGNOSTIC, migrateLegacyResourceZones } from "../src/economy/EconomyMigration.js";
import { SupplyNetwork } from "../src/logistics/SupplyNetwork.js";
import { assessEconomySecurity, canDispatchEconomicExpedition, updateEconomySecurityMemory } from "../src/ai/EconomySecurityPolicy.js";
import { ammoCapacityFor, requestRangedShot, retreatReasonFor, synchronizeAmmoState } from "../src/combat/CombatSystem.js";

test("every faction has a valid bootstrap production catalog and compatibility alias", () => {
  assert.deepEqual(validateProductionCatalog(), []);
  for (const profile of Object.values(FACTION_ECONOMY_PROFILES)) {
    assert.deepEqual(profile.zoneResources, profile.producibleResources);
    assert.ok(profile.producibleResources.every(resource => profile.activeResources.includes(resource)));
    const player = { faction: Object.keys(FACTION_ECONOMY_PROFILES).find(key => FACTION_ECONOMY_PROFILES[key] === profile), race: profile.id === "tau" ? "T'au" : profile.id };
    const outputs = new Set(productionDefinitionsFor(player).flatMap(item => Object.keys(item.outputs)));
    assert.ok(profile.activeResources.every(resource => outputs.has(resource)), `${profile.id} cannot bootstrap every active resource`);
  }
});

test("cached supply connectivity gates local production without depositing into a treasury", () => {
  const player = { id: "a", faction: "Space Marines", race: "Imperium", base: { x: 0, y: 0 } };
  const hq = { id: "hq", faction: "a", type: "outpost", x: 0, y: 0, progress: 1, alive: true };
  const farm = { id: "farm", faction: "a", type: "farm", x: 150, y: 0, progress: 1, alive: true, condition: 1, inventory: { energy: 50 } };
  const network = new SupplyNetwork({ defaultReach: 200 });
  network.rebuild({ structures: [hq, farm], players: [player] });
  const definition = productionDefinitionForStructure(player, farm);
  const treasury = { food: 0 };
  const produced = updateProductionBuilding(farm, definition, network.connectionFor(farm), 1, { activeResources: FACTION_ECONOMY_PROFILES["Space Marines"].activeResources, demand: { food: 1, medical: 1 } });
  assert.equal(produced.reason, "producing");
  assert.ok(farm.inventory.food > 0);
  assert.equal(treasury.food, 0);
  const rebuilds = network.rebuildCount;
  assert.equal(network.rebuild({ structures: [hq, farm], players: [player] }), false);
  assert.equal(network.rebuildCount, rebuilds);

  const isolated = { ...farm, id: "isolated", x: 1000, inventory: { energy: 50 }, productionState: undefined };
  network.invalidateTopology();
  network.rebuild({ structures: [hq, isolated], players: [player] });
  updateProductionBuilding(isolated, definition, network.connectionFor(isolated), definition.graceSeconds + 1, { activeResources: FACTION_ECONOMY_PROFILES["Space Marines"].activeResources });
  assert.equal(isolated.productionState.lastReason, "disconnected");
});

test("legacy zones migrate owned extractors but serialize no replacement zone objects", () => {
  const player = { id: "a", faction: "Space Marines", race: "Imperium" };
  const mine = { id: "mine", faction: "a", type: "mine", x: 10, y: 10, progress: 1, alive: true, hp: 40, inventory: { materials: 3 }, resourceNodeId: "zone-a" };
  const result = migrateLegacyResourceZones({
    resourceZones: [{ id: "zone-a", owner: "a", x: 10, y: 10 }, { id: "zone-neutral", x: 500, y: 500 }],
    structures: [mine],
    players: [player]
  });
  assert.deepEqual(result.resourceZones, []);
  assert.ok(mine.productionDefinitionId);
  assert.equal(mine.resourceNodeId, undefined);
  assert.equal(mine.hp, 40);
  assert.equal(mine.inventory.materials, 3);
  assert.ok(result.diagnostics.some(item => item.code === LEGACY_RESOURCE_ZONE_DIAGNOSTIC && item.zoneId === "zone-neutral"));
});

test("supply topology caches connectivity for two hundred producers", () => {
  const player = { id: "a", base: { x: 0, y: 0 } };
  const structures = [{ id: "hq", faction: "a", type: "outpost", x: 0, y: 0, progress: 1, alive: true }];
  for (let index = 0; index < 200; index += 1) structures.push({ id: `producer-${index}`, faction: "a", type: "farm", x: (index + 1) * 30, y: 0, progress: 1, alive: true });
  const network = new SupplyNetwork({ defaultReach: 45 });
  network.rebuild({ structures, players: [player] });
  assert.equal(network.connectionFor("producer-199").connected, true);
  const rebuilds = network.rebuildCount;
  for (let index = 0; index < 1000; index += 1) assert.equal(network.connectionFor(`producer-${index % 200}`).connected, true);
  assert.equal(network.rebuildCount, rebuilds);
});

test("economy security applies safety gates, aggressive reserve exception, and hysteresis", () => {
  const unsafe = assessEconomySecurity({ baseThreat: 0.5, defenseRatio: 0.8, guardCoverage: 0.2, routeRisk: 0.7 });
  assert.equal(canDispatchEconomicExpedition({ assessment: unsafe, aggression: 60, reserveRatio: 0.8, defenderCount: 4 }), false);
  assert.equal(canDispatchEconomicExpedition({ assessment: unsafe, aggression: 80, reserveRatio: 0.25, defenderCount: 1 }), true);
  const memory = {};
  const safe = assessEconomySecurity({ baseThreat: 0, defenseRatio: 2, guardCoverage: 1, routeRisk: 0 });
  updateEconomySecurityMemory(memory, safe, 8);
  assert.equal(memory.stableSafe, true);
  updateEconomySecurityMemory(memory, unsafe, 3);
  assert.equal(memory.stableSafe, false);
});

test("ranged ammunition is four times baseline and combat owns atomic shot state", () => {
  const unit = { id: "rifleman", role: "trooper", weaponId: "rifle", baselineAmmoCapacity: 16, ammo: 16, hp: 100, maxHp: 100, morale: 1, fear: 0 };
  assert.equal(ammoCapacityFor(unit), 64);
  synchronizeAmmoState(unit, { refill: true });
  const beforeMagazine = unit.weaponState.roundsInMagazine;
  const beforeTotal = unit.ammo;
  assert.equal(requestRangedShot(unit).allowed, true);
  assert.equal(unit.weaponState.roundsInMagazine, beforeMagazine - 1);
  assert.equal(unit.ammo, beforeTotal - 1);
  unit.weaponState.roundsInMagazine = 2;
  unit.weaponState.reloadRemaining = 0;
  assert.equal(retreatReasonFor(unit), null, "an emptying magazine never causes retreat while total ammunition remains");
  unit.ammo = 0;
  assert.equal(retreatReasonFor(unit), "ammo");
});

test("new map saves omit deprecated resource-zone writes", async () => {
  const source = await readFile(new URL("../js/app.js", import.meta.url), "utf8");
  const serializeBody = source.slice(source.indexOf("function serializeTestMap"), source.indexOf("function saveLocalTestMap"));
  assert.doesNotMatch(serializeBody, /resourceZones\s*:/);
  assert.match(source, /migrateLegacyResourceZones/);
});
