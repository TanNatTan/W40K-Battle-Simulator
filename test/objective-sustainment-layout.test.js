import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  assessEnemyCondition,
  estimatedFriendlyDamageAssigned,
  finishOpportunityFor,
  overkillPenaltyFor
} from "../src/ai/TargetAssessmentSystem.js";
import { resolveFactionObjectiveDoctrine } from "../src/ai/FactionObjectiveDoctrine.js";
import { createStrategicPortfolio, portfolioRoleFloors } from "../src/ai/StrategicPortfolioSystem.js";
import { allocateArmyRoles } from "../src/ai/ArmyRoleAllocator.js";
import { chooseRegroupPoint, pointInPolygon, regroupCandidates } from "../src/ai/RegroupPointSystem.js";
import { blocksServiceCorridor, buildingClearanceFor, placementRectsOverlap } from "../src/construction/BaseLayoutSystem.js";
import {
  buildSustainmentRequests,
  factionSustainmentCost,
  providerCanService,
  selectSustainmentRequest,
  sustainmentProfileFor
} from "../src/support/SustainmentSystem.js";

const branches = ["Space Marines", "Imperial Guard", "Adeptus Mechanicus", "Chaos", "Orks", "Necrons", "Tau", "Tyranids"];
const objectiveSignals = { attack: 0.9, targetCommand: 0.8, targetInfrastructure: 0.75, expansion: 0.65, control: 0.7, defense: 0.45, fortification: 0.4, scouting: 0.5, logistics: 0.6, preservation: 0.55, mobility: 0.7 };

test("enemy assessment commits safe finishers but avoids unsafe pursuit and overkill", () => {
  const attacker = { id: "marine", x: 0, y: 0, range: 120, damage: 18, accuracy: 0.8, combatCommitment: { pursuitRadius: 150 } };
  const wounded = { id: "ork", x: 70, y: 0, alive: true, hp: 18, maxHp: 100, morale: 0.12, retreating: true };
  const safe = finishOpportunityFor(attacker, wounded, { friendlyPower: 90, enemyPower: 55 });
  assert.equal(assessEnemyCondition(wounded).state, "critical");
  assert.equal(safe.valuable, true);
  assert.equal(safe.safe, true);
  const unsafe = finishOpportunityFor(attacker, { ...wounded, x: 260 }, { friendlyPower: 40, enemyPower: 100 });
  assert.equal(unsafe.safe, false);
  const friendlies = [attacker, { ...attacker, id: "marine-2", targetId: wounded.id, damage: 30 }];
  attacker.targetId = wounded.id;
  const assigned = estimatedFriendlyDamageAssigned(wounded.id, friendlies);
  assert.ok(assigned > wounded.hp);
  assert.ok(overkillPenaltyFor(wounded, assigned) > 0);
});

test("every race interprets the same battle objective distinctly without abandoning map presence", () => {
  const doctrines = branches.map(branch => resolveFactionObjectiveDoctrine({ branch, objectiveId: "annihilation", subfaction: "test", signals: objectiveSignals }));
  assert.equal(new Set(doctrines.map(doctrine => doctrine.approach)).size, branches.length);
  for (const doctrine of doctrines) {
    const portfolio = createStrategicPortfolio({ profile: { branch: doctrine.branch }, doctrine, context: { enemyPressure: 0.2, resourceShortage: 0.3 } });
    const total = Object.values(portfolio.commitments).reduce((sum, value) => sum + value, 0);
    assert.ok(Math.abs(total - 1) < 1e-9);
    assert.ok(portfolio.commitments.battleObjective > 0);
    assert.ok(portfolio.commitments.territory > 0);
    assert.ok(portfolio.commitments.economy > 0);
    assert.ok(portfolio.commitments.baseDefense > 0);
    assert.ok(portfolio.commitments.militaryGrowth > 0);
    const floors = portfolioRoleFloors(portfolio, 8);
    assert.deepEqual(
      [floors["base-defense"], floors["economy-defense"], floors.capture, floors.reserve],
      [1, 1, 1, 1]
    );
  }
});

test("portfolio floors produce a real objective force plus guards, capture, economy, and reserve squads", () => {
  const doctrine = resolveFactionObjectiveDoctrine({ branch: "Chaos", objectiveId: "annihilation", signals: objectiveSignals });
  const strategicPortfolio = createStrategicPortfolio({ profile: { branch: "Chaos" }, doctrine });
  const squads = Array.from({ length: 10 }, (_, index) => ({ id: `squad-${index}`, readiness: 1 }));
  const membersBySquad = new Map(squads.map((squad, index) => [squad.id, [{ id: `unit-${index}`, role: "trooper", hp: 100, maxHp: 100, morale: 0.8, ammo: 20, maxAmmo: 20, damage: 16, range: 120, speed: 22 }]]));
  const result = allocateArmyRoles({ squads, membersBySquad, context: { squadCount: squads.length, strategicPortfolio }, demands: { offensive: 100 } });
  assert.ok(result.counts.offensive >= 1);
  assert.ok(result.counts["base-defense"] >= 1);
  assert.ok(result.counts["economy-defense"] >= 1);
  assert.ok(result.counts.capture >= 1);
  assert.ok(result.counts.reserve >= 1);
});

test("sustainment triages infantry, vehicle systems, and strategic buildings for compatible providers", () => {
  const units = [
    { id: "wounded", faction: "a", role: "trooper", alive: true, hp: 24, maxHp: 100, bleeding: 0.2 },
    { id: "tank", faction: "a", role: "vehicle", alive: true, hp: 46, maxHp: 200, vehicleSystems: { engine: 0.1, tracks: 0.18, turret: 0.8 } }
  ];
  const structures = [
    { id: "hq", faction: "a", type: "outpost", headquarters: true, alive: true, hp: 300, maxHp: 1000 },
    { id: "turret", faction: "a", type: "turret", alive: true, hp: 50, maxHp: 200 }
  ];
  const requests = buildSustainmentRequests({ units, structures, now: 20, targetedIds: new Set(["hq"]), dependencyCount: target => target.id === "hq" ? 4 : 0 });
  assert.deepEqual(new Set(requests.map(request => request.targetType)), new Set(["infantry", "vehicle", "building"]));
  assert.equal(requests[0].targetId, "hq");
  const byId = new Map([...units, ...structures].map(target => [target.id, target]));
  const medic = { id: "medic", faction: "a", role: "medic", x: 0, y: 0 };
  const engineer = { id: "engineer", faction: "a", role: "engineer", x: 0, y: 0 };
  byId.get("wounded").x = 10;
  byId.get("wounded").y = 0;
  byId.get("tank").x = 12;
  byId.get("tank").y = 0;
  byId.get("hq").x = 16;
  byId.get("hq").y = 0;
  byId.get("turret").x = 18;
  byId.get("turret").y = 0;
  assert.equal(providerCanService(medic, requests.find(request => request.targetId === "wounded")), true);
  assert.equal(providerCanService(medic, requests.find(request => request.targetId === "tank")), false);
  assert.equal(selectSustainmentRequest(medic, requests, { targetById: id => byId.get(id), maximumRange: 100 })?.target.id, "wounded");
  assert.equal(selectSustainmentRequest(engineer, requests, { targetById: id => byId.get(id), maximumRange: 100 })?.target.id, "hq");
  assert.ok(sustainmentProfileFor({ race: "Orks" }).repairRate > sustainmentProfileFor({ race: "Imperium", faction: "Imperial Guard" }).repairRate);
  assert.deepEqual(Object.keys(factionSustainmentCost({ race: "Tyranids" }, { medical: 2 })).sort(), ["biomass"]);
});

test("building placement preserves category clearance and service corridors", () => {
  const productionClearance = buildingClearanceFor("barracks", { hitbox: { w: 34, h: 28 }, purpose: "Production" });
  const defenseClearance = buildingClearanceFor("turret", { hitbox: { w: 18, h: 18 }, purpose: "Defense" });
  assert.ok(productionClearance > defenseClearance);
  const existing = { x: 100, y: 100, hitbox: { w: 36, h: 30 } };
  assert.equal(placementRectsOverlap({ x: 140, y: 100 }, { w: 34, h: 28 }, productionClearance, existing, productionClearance), true);
  assert.equal(placementRectsOverlap({ x: 180, y: 100 }, { w: 34, h: 28 }, productionClearance, existing, productionClearance), false);
  assert.equal(blocksServiceCorridor({ point: { x: 70, y: 0 }, hitbox: { w: 30, h: 24 }, base: { x: 0, y: 0 } }), true);
  assert.equal(blocksServiceCorridor({ point: { x: 70, y: 70 }, hitbox: { w: 30, h: 24 }, base: { x: 0, y: 0 } }), false);
});

test("regroup points are deterministic, distributed, and remain inside the authored spawn zone", () => {
  const circlePlayer = { base: { x: 200, y: 160 }, spawnZone: { shape: "circle", size: 100, points: [] } };
  const squad = { id: "alpha", regroupSerial: 1 };
  const candidates = regroupCandidates(circlePlayer, squad, 24);
  assert.equal(candidates.length, 24);
  assert.ok(candidates.every(point => Math.hypot(point.x - 200, point.y - 160) <= 100));
  assert.ok(candidates.every(point => Math.hypot(point.x - 200, point.y - 160) >= 30));
  const first = chooseRegroupPoint(circlePlayer, squad, { score: point => point.x - point.y });
  const repeated = chooseRegroupPoint(circlePlayer, squad, { score: point => point.x - point.y });
  assert.deepEqual(first, repeated);
  assert.notDeepEqual({ x: first.x, y: first.y }, circlePlayer.base);
  const customPlayer = { base: { x: 50, y: 50 }, spawnZone: { shape: "custom", points: [{ x: 10, y: 10 }, { x: 100, y: 20 }, { x: 90, y: 90 }, { x: 20, y: 100 }] } };
  assert.ok(regroupCandidates(customPlayer, { id: "custom", regroupSerial: 2 }, 20).every(point => pointInPolygon(point, customPlayer.spawnZone.points)));
});

test("browser runtime integrates portfolio AI, condition finishing, sustainment, spacing, and in-zone regrouping", async () => {
  const source = await readFile(new URL("../js/app.js", import.meta.url), "utf8");
  assert.match(source, /finishOpportunityFor\(/);
  assert.match(source, /estimatedFriendlyDamageAssigned\(/);
  assert.match(source, /createStrategicPortfolio\(/);
  assert.match(source, /resolveFactionObjectiveDoctrine\(/);
  assert.match(source, /refreshSustainmentRequests/);
  assert.match(source, /updateSafeFacilityRecovery\(unit, dt\)/);
  assert.match(source, /buildingClearanceFor\(type, spec\)/);
  assert.match(source, /blocksServiceCorridor\(/);
  assert.match(source, /chooseSquadRegroupPoint\(/);
  assert.doesNotMatch(source, /objective\s*=\s*\{\s*\.\.\.baseFor\([^)]*\),\s*regroup:\s*true\s*\}/);
});
