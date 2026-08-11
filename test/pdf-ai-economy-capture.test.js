import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { createStartingHeadquarters, spawnZoneCentroid } from "../src/economy/BattleBootstrapSystem.js";
import { productionDefinitionsFor } from "../src/economy/ProductionBuildingCatalog.js";
import { enabledProductionOutputs, updateProductionBuilding } from "../src/economy/ProductionSystem.js";
import { selectConstructionProject } from "../src/economy/ConstructionPlanningSystem.js";
import { ConstructionTelemetry } from "../src/diagnostics/ConstructionTelemetry.js";
import { SupplyNetwork } from "../src/logistics/SupplyNetwork.js";
import { assessEconomySecurity, assessMacroReadiness } from "../src/ai/EconomySecurityPolicy.js";
import { allocateArmyRoles } from "../src/ai/ArmyRoleAllocator.js";
import { mergeSquadContactBoard, refreshContactMemory } from "../src/ai/PerceptionMemorySystem.js";
import { scoreTargetCandidate, selectTarget } from "../src/ai/TargetSelectionSystem.js";
import { SpatialPartition, TerritorySystem } from "../src/territory/TerritorySystem.js";
import { requestRangedShot, retreatReasonFor, synchronizeAmmoState, updateCombatState } from "../src/combat/CombatSystem.js";

const factionPlayers = [
  { id: "marine", race: "Imperium", faction: "Space Marines" },
  { id: "guard", race: "Imperium", faction: "Imperial Guard" },
  { id: "ork", race: "Orks", faction: "Orks" },
  { id: "tyranid", race: "Tyranids", faction: "Tyranids" },
  { id: "necron", race: "Necrons", faction: "Necrons" },
  { id: "tau", race: "T'au", faction: "T'au" },
  { id: "chaos", race: "Chaos", faction: "Chaos" }
];

test("every race receives one completed bootstrap-safe headquarters at its authored spawn center", () => {
  for (const [index, player] of factionPlayers.entries()) {
    const configured = { ...player, base: { x: 100 + index * 10, y: 150 }, spawnZone: { shape: "circle", size: 80, points: [] } };
    const definition = productionDefinitionsFor(configured).find(item => item.role === "headquarters");
    const hq = createStartingHeadquarters({ player: configured, definition, buildingSpec: { maxHp: 900, hitbox: { w: 44, h: 38 } } });
    assert.equal(hq.progress, 1);
    assert.equal(hq.alive, true);
    assert.equal(hq.headquarters, true);
    assert.deepEqual({ x: hq.x, y: hq.y }, configured.base);
    assert.deepEqual(definition.inputs, {}, `${definition.id} must not depend on a circular bootstrap input`);
  }
  const custom = { id: "custom", base: { x: 0, y: 0 }, spawnZone: { shape: "custom", points: [{ x: 20, y: 20 }, { x: 100, y: 20 }, { x: 100, y: 80 }, { x: 20, y: 80 }] } };
  assert.deepEqual(spawnZoneCentroid(custom), { x: 60, y: 50 });
});

test("supply components unlock topology-tagged outputs and cache summaries", () => {
  const player = { id: "a", race: "Imperium", faction: "Space Marines", base: { x: 0, y: 0 } };
  const definitions = productionDefinitionsFor(player);
  const structure = (id, type, x) => {
    const definition = definitions.find(item => item.buildingType === type);
    return { id, type, x, y: 0, faction: "a", progress: 1, alive: true, condition: 1, productionTags: definition ? [...definition.tags] : [type], productionOutputCapabilities: definition ? Object.keys(definition.outputs) : [] };
  };
  const hq = structure("hq", "outpost", 0);
  const warehouse = structure("store", "warehouse", 40);
  const mine = structure("mine", "mine", 80);
  const workshop = { ...structure("workshop", "workshop", 120), inventory: { energy: 30, materials: 30 } };
  const generator = structure("generator", "generator", 160);
  const network = new SupplyNetwork({ defaultReach: 50 });
  network.rebuild({ structures: [hq, warehouse, mine, workshop, generator], players: [player] });
  const connection = network.connectionFor(workshop);
  assert.equal(connection.connected, true);
  assert.ok(connection.componentSummary.tags.includes("power"));
  assert.ok(connection.componentSummary.tags.includes("materials"));
  const definition = definitions.find(item => item.buildingType === "workshop");
  assert.deepEqual(Object.keys(enabledProductionOutputs(definition, connection)).sort(), ["ammunition", "materials", "parts"]);
  const rebuilds = network.rebuildCount;
  for (let index = 0; index < 100; index += 1) network.componentFor(workshop);
  assert.equal(network.rebuildCount, rebuilds);

  network.invalidateTopology();
  network.rebuild({ structures: [hq, warehouse, mine, workshop], players: [player] });
  assert.deepEqual(Object.keys(enabledProductionOutputs(definition, network.connectionFor(workshop))), ["ammunition"]);
});

test("shared multi-output buffers allocate proportionally regardless of key order", () => {
  const connection = { connected: true, throughput: 1, componentId: "test", componentSummary: { tags: [], structureIds: ["producer"] } };
  const run = baseOutputs => {
    const producer = { id: "producer", progress: 1, alive: true, condition: 1, inventory: {} };
    const definition = { baseOutputs, outputs: baseOutputs, inputs: {}, synergyRules: [], bufferCapacity: 5, graceSeconds: 0 };
    return updateProductionBuilding(producer, definition, connection, 1, { activeResources: ["food", "fuel"], demand: { food: 1, fuel: 1 } }).produced;
  };
  const forward = run({ food: 10, fuel: 10 });
  const reverse = run({ fuel: 10, food: 10 });
  assert.equal(forward.food, reverse.food);
  assert.equal(forward.fuel, reverse.fuel);
  assert.equal(forward.food + forward.fuel, 5);
});

test("macro readiness reserves guards before expansion and preserves an aggressive exception", () => {
  const unsafe = assessEconomySecurity({ baseThreat: 0.6, defenseRatio: 0.7, guardCoverage: 0.2, criticalProducers: 2, connectedProducers: 1 });
  const normal = assessMacroReadiness({ assessment: unsafe, headquartersReady: true, reserveRatio: 0.4, defenderCount: 2, aggression: 55, securityStable: false });
  assert.equal(normal.expansionAllowed, false);
  const aggressive = assessMacroReadiness({ assessment: unsafe, headquartersReady: true, reserveRatio: 0.3, defenderCount: 1, aggression: 80, securityStable: false });
  assert.equal(aggressive.aggressiveOverride, true);
  assert.equal(aggressive.expansionAllowed, true);
  const squads = Array.from({ length: 8 }, (_, index) => ({ id: `s-${index}`, readiness: 1 }));
  const membersBySquad = new Map(squads.map(squad => [squad.id, [{ id: `u-${squad.id}`, role: "trooper", hp: 100, maxHp: 100, morale: 1, ammo: 20, maxAmmo: 20 }]]));
  const allocation = allocateArmyRoles({ squads, membersBySquad, context: { squadCount: 8, macroReadiness: normal, criticalProducerNeed: 1, aggression: 55 }, demands: { offensive: 100 } });
  assert.ok(allocation.counts["base-defense"] >= 1);
  assert.ok(allocation.counts["economy-defense"] >= 1);
});

test("construction planning rejects impossible dependencies and records observable stall reasons", () => {
  const project = selectConstructionProject([
    { buildingType: "impossible", utility: 500, dependenciesCanEverBeSatisfied: false, affordableNow: true },
    { buildingType: "generator", utility: 80, prerequisitesSatisfied: true, affordableNow: true, reason: "bootstrap production chain", intendedOutputs: ["energy"] },
    { buildingType: "barracks", utility: 75, prerequisitesSatisfied: true, affordableNow: false }
  ], { random: () => 0, temperature: 1 });
  assert.equal(project.buildingType, "generator");
  assert.deepEqual(project.intendedOutputs, ["energy"]);
  const telemetry = new ConstructionTelemetry();
  telemetry.record("builder:a", "selected", 1, { faction: "a", buildingType: "generator" });
  telemetry.record("builder:a", "funding-wait", 2, { faction: "a", buildingType: "generator", blockedReason: "insufficient-resources" });
  assert.equal(telemetry.summary().blockedReasons["insufficient-resources"], 1);
  assert.equal(telemetry.historyFor("builder:a").length, 2);
});

test("contact memory decays without reading an unseen enemy live position and shares at squad scope", () => {
  const enemy = { id: "enemy", x: 40, y: 60, role: "commander", damage: 20, range: 120 };
  const first = refreshContactMemory({}, [{ unit: enemy }], 10);
  enemy.x = 900;
  enemy.y = 900;
  refreshContactMemory(first, [], 12);
  assert.equal(first.contacts.enemy.lastSeenPosition.x, 40);
  assert.notEqual(first.contacts.enemy.predictedPosition.x, enemy.x);
  assert.ok(first.contacts.enemy.confidence < 1);
  const board = mergeSquadContactBoard({}, [first], 12);
  assert.equal(board.primaryThreatId, "enemy");
  assert.equal(board.contacts.enemy.source, "squad");
});

test("target utility values dangerous enemies and prevents marginal target flicker", () => {
  const attacker = { id: "self", role: "trooper", range: 140, penetration: 10 };
  const harmless = { id: "support", role: "medic", hp: 100, maxHp: 100, damage: 1, range: 20 };
  const heavy = { id: "heavy", role: "trooper", hp: 100, maxHp: 100, damage: 36, range: 220 };
  const harmlessScore = scoreTargetCandidate(attacker, harmless, { distance: 25, detectionRadius: 160 });
  const heavyScore = scoreTargetCandidate(attacker, heavy, { distance: 65, detectionRadius: 160 });
  assert.ok(heavyScore > harmlessScore);
  const sticky = selectTarget([harmless, heavy], { currentTargetId: harmless.id, switchThreshold: 16, score: target => target.id === harmless.id ? 100 : 110 });
  assert.equal(sticky.target.id, harmless.id);
  const forced = selectTarget([harmless, heavy], { currentTargetId: harmless.id, switchThreshold: 16, score: target => target.id === harmless.id ? 100 : 130 });
  assert.equal(forced.target.id, heavy.id);
});

test("the immediately previous owner recaptures in half time only while unopposed", () => {
  const partition = new SpatialPartition({ width: 500, height: 300, cellCount: 14, seed: 7, relaxIterations: 1 });
  const players = [{ id: "a", base: { x: 35, y: 150 } }, { id: "b", base: { x: 465, y: 150 } }];
  const system = new TerritorySystem(partition, players, { unitConfig: { unitsPerPlayer: 1, baseCaptureSeconds: 60, perUnitBonus: 0 } });
  const target = system.cells.find(cell => !cell.isBase && cell.neighbors.some(id => system.byId.get(id)?.owner === "a")) || system.cells.find(cell => !cell.isBase);
  assert.equal(system.claimCell(target.id, "a"), true);
  assert.equal(system.contestCell(target.id, "b"), true);
  assert.equal(target.previousOwnerId, "a");
  system.advancePhysical(29, [{ playerId: "a", cellId: target.id, power: 1 }]);
  assert.equal(target.owner, "b");
  assert.equal(target.siege.eligibleForRecaptureBonus, true);
  system.advancePhysical(1, [{ playerId: "a", cellId: target.id, power: 1 }]);
  assert.equal(target.owner, "a");

  system.contestCell(target.id, "b");
  system.advancePhysical(30, [{ playerId: "a", cellId: target.id, power: 2 }, { playerId: "b", cellId: target.id, power: 1 }]);
  assert.equal(target.owner, "b", "defending presence disables the half-time bonus");
  assert.equal(target.siege.eligibleForRecaptureBonus, false);
  const restored = new TerritorySystem(partition, players, { unitConfig: { unitsPerPlayer: 1, baseCaptureSeconds: 60, perUnitBonus: 0 } }).loadState(system.toJSON());
  assert.equal(restored.byId.get(target.id).previousOwnerId, "a");
  assert.equal(restored.byId.get(target.id).siege.attackerId, "a");
});

test("public objective state exposes control and progress without hidden force details", () => {
  const partition = new SpatialPartition({ width: 400, height: 240, cellCount: 10, seed: 4, relaxIterations: 1 });
  const players = [{ id: "a", base: { x: 30, y: 120 } }, { id: "b", base: { x: 370, y: 120 } }];
  const system = new TerritorySystem(partition, players, { objectives: [{ id: "forge", sourceId: "forge", type: "strategic-point", x: 200, y: 120 }] });
  const view = system.objectivePublicStates()[0];
  assert.equal(view.objectiveId, "forge");
  assert.ok(["neutral", "controlled"].includes(view.state));
  assert.equal(Object.hasOwn(view, "units"), false);
  assert.equal(Object.hasOwn(view, "forceStrength"), false);
});

test("ranged units reload in active combat and never retreat for an empty magazine with reserve", () => {
  const unit = { id: "rifleman", role: "trooper", targetId: "enemy", baselineAmmoCapacity: 16, ammo: 16, hp: 100, maxHp: 100, morale: 1, fear: 0 };
  synchronizeAmmoState(unit, { refill: true });
  unit.weaponState.roundsInMagazine = 0;
  const result = requestRangedShot(unit);
  assert.equal(result.reason, "reload-started");
  assert.equal(unit.targetId, "enemy");
  assert.equal(retreatReasonFor(unit), null);
  updateCombatState(unit, result.profile.reloadTime);
  assert.ok(unit.weaponState.roundsInMagazine > 0);
  assert.equal(unit.targetId, "enemy");
  assert.equal(retreatReasonFor(unit), null);
});

test("browser runtime wires bootstrap HQs and public objective markers independently of territory overlay", async () => {
  const source = await readFile(new URL("../js/app.js", import.meta.url), "utf8");
  assert.match(source, /createStartingHeadquarters\(/);
  assert.match(source, /player\.hasEstablishedHeadquarters = true/);
  assert.match(source, /function drawStrategicObjectives\(/);
  assert.match(source, /drawFog\(\);\s*drawStrategicObjectives\(\);/);
  assert.match(source, /objectivePublicStates\(\)/);
});
