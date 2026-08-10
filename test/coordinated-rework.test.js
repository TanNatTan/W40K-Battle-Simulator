import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { allocateArmyRoles, calculateArmyRoleBudget } from "../src/ai/ArmyRoleAllocator.js";
import { captureTargetsFor, selectCaptureTarget } from "../src/ai/CaptureObjectiveSystem.js";
import { calculateCost, canAffordCost, costForManifest, spendCost, trainingDelayFor } from "../src/economy/CostSystem.js";
import { selectSpaceMarineWargear } from "../src/combat/WargearSelectionSystem.js";
import { assignResourceCarrier, desiredResourceCarriers, ensureResourceCarrierState, setResourceCarrierState } from "../src/logistics/ResourceCarrierSystem.js";

const costCatalog = JSON.parse(readFileSync(new URL("../data/economy/costs.json", import.meta.url), "utf8"));
const wargearCatalog = JSON.parse(readFileSync(new URL("../data/ai/wargear-doctrines.json", import.meta.url), "utf8"));
const weapons = JSON.parse(readFileSync(new URL("../data/weapons.json", import.meta.url), "utf8"));

function combatMember(index = 0) {
  return { id: `u-${index}`, role: "trooper", hp: 100, maxHp: 100, damage: 16, range: 120, speed: 22, morale: 0.8, ammo: 20, maxAmmo: 20, experience: 30 };
}

test("P1 offense receives the army majority before lower-priority roles", () => {
  const squads = Array.from({ length: 12 }, (_, index) => ({ id: `s-${index}`, readiness: 0.9 }));
  const membersBySquad = new Map(squads.map((squad, index) => [squad.id, [combatMember(index)]]));
  const context = { squadCount: 12, baseThreat: 0.1, territoryThreat: 0.1, reinforcementThreat: 0.1, forceDisadvantage: 0.1 };
  const budget = calculateArmyRoleBudget(context, squads.length);
  assert.equal(budget.offensive.min, 8);
  const result = allocateArmyRoles({ squads, membersBySquad, context, demands: { reserve: 200, reconnaissance: 180, capture: 160, offensive: 20 } });
  assert.ok(result.counts.offensive >= 8);
  assert.ok(result.counts.capture >= 1);
  assert.ok(result.counts.reconnaissance <= 2);
  assert.ok(result.counts.reserve <= 3);
});

test("a base emergency can steal defenders without collapsing offense", () => {
  const context = { squadCount: 12, baseThreat: 1, territoryThreat: 0.8, reinforcementThreat: 0.8, forceDisadvantage: 0.7 };
  const budget = calculateArmyRoleBudget(context, 12);
  assert.equal(budget.emergency, true);
  assert.equal(budget.offensive.min, 5);
  assert.equal(budget["base-defense"].min, 2);
});

test("a completed capture detachment hands off and returns to the offensive pool", () => {
  const squads = Array.from({ length: 6 }, (_, index) => ({ id: `handoff-${index}`, readiness: 0.9, captureCooldownUntil: index === 0 ? 100 : 0 }));
  const membersBySquad = new Map(squads.map((squad, index) => [squad.id, [combatMember(index)]]));
  const result = allocateArmyRoles({ squads, membersBySquad, context: { squadCount: 6, now: 50 }, demands: { capture: 100, offensive: 80 } });
  assert.notEqual(result.assignments.get("handoff-0"), "capture");
  assert.ok([...result.assignments.values()].includes("capture"));
});

test("capture detachments evaluate resource zones and authored economic landmarks", () => {
  const player = { id: "a" };
  const targets = captureTargetsFor({
    player,
    resourceZones: [{ id: "ore", name: "Ore Field", x: 50, y: 50, remaining: 500, resourceType: "materials", gatherRate: 10 }],
    economicNodes: [{ id: "refinery", name: "Promethium Refinery", x: 120, y: 80, active: true, strategicValue: 75, exports: { fuel: 30 } }],
    economy: { zoneResources: ["materials", "fuel"] }
  });
  assert.deepEqual(targets.map(target => target.kind).sort(), ["landmark", "resource-zone"]);
  const choice = selectCaptureTarget({
    player,
    squadCenter: { x: 0, y: 0 },
    targets,
    shortages: ["fuel"],
    resourceNeed: (_owner, resource) => resource === "fuel" ? 150 : 20
  });
  assert.equal(choice.id, "refinery");
});

test("the shared ledger prices every manifest member and spends atomically", () => {
  const marine = { faction: "Space Marines", race: "Imperium" };
  const manifest = [{ name: "Sergeant", role: "commander" }, ...Array.from({ length: 4 }, () => ({ name: "Tactical Marine", role: "trooper" }))];
  const cost = costForManifest(marine, manifest, costCatalog);
  assert.ok(cost.requisition >= 126);
  assert.equal(trainingDelayFor(marine, manifest), 33);
  const inventory = Object.fromEntries(Object.entries(cost).map(([resource, amount]) => [resource, amount]));
  assert.equal(canAffordCost(inventory, cost), true);
  assert.equal(spendCost(inventory, cost), true);
  assert.ok(Object.values(inventory).every(value => value === 0));
  assert.equal(spendCost(inventory, cost), false);
  assert.deepEqual(calculateCost({ type: "construction", player: { race: "Necrons" }, baseCost: 40 }, costCatalog), { energy: 40, materials: 18 });
});

test("chapter wargear remains biased, counter-aware, and squad-diverse", () => {
  globalThis.AWTData = { weapons };
  const manifest = [{ name: "Sergeant", role: "commander" }, ...Array.from({ length: 4 }, () => ({ name: "Tactical Marine", role: "trooper" }))];
  const loadout = selectSpaceMarineWargear({
    player: { faction: "Space Marines", subfaction: "Salamanders" },
    manifest,
    squadRole: "siege",
    enemyIntel: { armor: 1, horde: 0.1 },
    economy: { inventory: { ammunition: 800 }, capacity: { ammunition: 1000 } },
    doctrines: wargearCatalog
  });
  assert.equal(loadout.length, 5);
  assert.ok(loadout.filter(member => member.weaponId === "bolt-rifle").length >= 3);
  assert.ok(loadout.some(member => ["meltagun", "multi-melta"].includes(member.weaponId)));
  assert.ok(loadout.filter(member => wargearCatalog.weapons[member.weaponId].category !== "standard").length <= 2);
  assert.ok(loadout.filter(member => wargearCatalog.weapons[member.weaponId].category === "heavy").length <= 1);
  assert.ok(loadout.every(member => Object.keys(member.equipmentCost).length > 0));
});

test("resource carriers persist through repeat deliveries and scale with source demand", () => {
  const carrier = { resourceCargo: { capacity: 32, amount: 0 } };
  assert.equal(ensureResourceCarrierState(carrier).state, "idle");
  assignResourceCarrier(carrier, { sourceId: "fuel-zone", destinationId: "warehouse", resourceType: "fuel" });
  assert.equal(carrier.logisticsState.state, "assigned-pickup");
  setResourceCarrierState(carrier, "returning-to-pickup", { cargo: 0 });
  carrier.logisticsState.deliveries += 1;
  assert.equal(carrier.logisticsState.repeat, true);
  assert.equal(carrier.logisticsState.deliveries, 1);
  const sources = [
    { x: 100, y: 100, remaining: 100, gatherRate: 10 },
    { x: 600, y: 0, remaining: 100, gatherRate: 30 },
    { x: 700, y: 0, remaining: 100, gatherRate: 30 },
    { x: 800, y: 0, remaining: 100, gatherRate: 30 }
  ];
  assert.ok(desiredResourceCarriers(sources, { x: 0, y: 0 }, 2) >= 5);
});

test("runtime integrates dedicated Chaos formations, doubled capacity, costs, and landmark capture", () => {
  const source = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
  assert.match(source, /else if \(player\.race === "Chaos"\)/);
  assert.match(source, /pendingChaosManifestSize = 3 \+ Math\.floor\(battleRandom\(\) \* 4\)/);
  assert.match(source, /name: "Aspiring Champion"/);
  assert.match(source, /const size = 5;/);
  assert.match(source, /amount \* 2/);
  assert.doesNotMatch(source, /0, 999\);\s*\n\s*}/);
  assert.match(source, /costForManifest\(player, groupManifest\)/);
  assert.match(source, /captureTargetsFor\(/);
  assert.match(source, /Capture economic landmark/);
  assert.match(source, /desiredResourceCarriers\(/);
});
