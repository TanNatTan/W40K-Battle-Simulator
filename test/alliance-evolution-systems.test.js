import test from "node:test";
import assert from "node:assert/strict";

import {
  ALLIANCE_EVOLUTION_PLAYERS,
  ALLIANCE_EVOLUTION_RULES,
  evaluateAllianceEvolutionRun,
  nextEvolutionSeed
} from "../src/testing/AllianceEvolutionTestSystem.js";
import {
  predictedInterceptPoint,
  projectileArcOffset,
  projectileVisualForWeapon,
  guideProjectile
} from "../src/combat/ProjectileVisualizationSystem.js";
import {
  createWaaaghFieldState,
  isBuiltWaaaghBanner,
  registerWaaaghBannerDestruction,
  updateWaaaghField,
  waaaghBannerAnchors
} from "../src/factions/WaaaghFieldSystem.js";
import {
  SPACE_MARINE_CAPTURE_REQUISITION_BONUS,
  spaceMarineTerritoryIncome,
  uniqueOperationalListeningPosts
} from "../src/economy/SpaceMarineTerritoryIncomeSystem.js";
import {
  forwardOutpostRestockManifest,
  selectForwardResupplyPoint,
  shouldBuildForwardOutpost
} from "../src/logistics/ForwardOutpostSystem.js";
import {
  MOBILIZATION_GRACE_SECONDS,
  combatReadyCount,
  isMobilizationProtected
} from "../src/combat/MobilizationProtectionSystem.js";

test("alliance evolution fixture defines the requested exact 2v2", () => {
  assert.deepEqual(ALLIANCE_EVOLUTION_PLAYERS.map(player => player.subfaction), [
    "Imperial Fists", "Blood Angels", "Ironjaw Mob", "Bad Moon Mob"
  ]);
  assert.deepEqual(ALLIANCE_EVOLUTION_PLAYERS.map(player => player.team), ["1", "1", "2", "2"]);
  assert.equal(ALLIANCE_EVOLUTION_RULES.runDurationMs, 600_000);
  assert.equal(ALLIANCE_EVOLUTION_RULES.consecutivePasses, 3);
  assert.equal(nextEvolutionSeed("test", 2), "test:iteration-2");
});

test("alliance evaluator rejects frame stalls even when average FPS is high", () => {
  const metrics = ALLIANCE_EVOLUTION_PLAYERS.map(player => ({
    ...player,
    objectiveActive: true,
    economyOperational: true,
    builderReplacement: true,
    infantry: player.race === "Orks" ? 130 : 110,
    vehicles: 5,
    producedUnits: 10,
    newBuildings: 2,
    frontlineDistant: true,
    forwardLogistics: 1,
    mapPresence: 0.8,
    viableSquads: 12,
    heavyRanged: 30,
    defensiveForwardPositions: 2,
    importantForwardAreas: 2,
    coveredForwardAreas: 2,
    counterattacks: 1,
    offensiveContribution: 1,
    allySupport: 1,
    assaultStrength: 35,
    jumpMissions: 1,
    regroups: 1,
    fastVehicles: 3,
    repeatedFailedAttacks: 0,
    objectivePresence: 1,
    meleeStrength: 80,
    rangedStrength: 70,
    coreDoctrineUnits: 4,
    waaaghBannerAnchors: 2,
    mobConcentrations: 2,
    vehicleSupport: 1,
    scrap: 20,
    ammunition: 20,
    mekInfrastructureAlive: true
  }));
  const result = evaluateAllianceEvolutionRun(metrics, {
    averageFps: 58,
    onePercentLowFps: 32,
    minimumFiveSecondFps: 35,
    maximumFrameMs: 280,
    p95FrameMs: 20,
    progressiveDecline: false
  });
  assert.equal(result.passed, false);
  assert.ok(result.failed.includes("performance: no frame above 250ms"));
});

test("projectile visuals select the atlas row and lead moving targets", () => {
  assert.equal(projectileVisualForWeapon({ label: "Astartes Bolt Rifle" }).id, "bolt");
  assert.equal(projectileVisualForWeapon({ label: "Hunter guided missile" }).guided, true);
  const aim = predictedInterceptPoint({ x: 0, y: 0 }, { x: 100, y: 0, movementVelocity: { x: 0, y: 10 } }, 100);
  assert.ok(aim.y > 9);
  const projectile = guideProjectile({ guided: true, x: 0, y: 0, vx: 100, vy: 0, turnRate: 1 }, { alive: true, x: 0, y: 100 }, 0.5);
  assert.ok(projectile.vy > 0);
  assert.ok(projectileArcOffset({ arcHeight: 20, traveled: 50, maxTravel: 100 }) > 19);
});

test("Waaagh banners amplify nearby Orks and their destruction backfires", () => {
  const player = { id: "ork-a", race: "Orks", subfaction: "Ironjaw Mob" };
  const banner = { id: "banner-a", faction: player.id, role: "standard", name: "Nob with Waaagh! Banner", alive: true, x: 0, y: 0 };
  const boy = { id: "boy-a", faction: player.id, alive: true, x: 10, y: 0, hp: 50, maxHp: 50, morale: 0.8, kills: 1 };
  const field = createWaaaghFieldState();
  assert.equal(isBuiltWaaaghBanner({ id: "fort", faction: player.id, type: "bunker", alive: true, progress: 1 }, player), false);
  assert.equal(isBuiltWaaaghBanner({ id: "totem", faction: player.id, type: "waaaghbanner", alive: true, progress: 1 }, player), true);
  assert.equal(waaaghBannerAnchors(player, [banner, boy], []).length, 1);
  updateWaaaghField(field, { now: 1, player, units: [banner, boy], structures: [], territoryCount: 2 });
  assert.ok(boy.waaaghMeleeMultiplier > 1);
  assert.ok(boy.waaaghVehicleReliability > 1);
  assert.ok(boy.waaaghMekEfficiency > 1);
  const before = field.momentum;
  const event = registerWaaaghBannerDestruction(field, { banner, now: 2, units: [boy], player });
  assert.equal(field.momentum, Math.max(0, before - 15));
  assert.ok(boy.waaaghConfusedUntil > 2);
  assert.deepEqual(event.affected, [boy.id]);
});

test("Marine territories and unique listening posts produce requisition", () => {
  const player = { id: "sm-a", faction: "Space Marines" };
  const structures = [
    { id: "lp-a", faction: player.id, type: "observationtower", alive: true, progress: 1, cell: "1,1" },
    { id: "lp-b", faction: player.id, type: "observationtower", alive: true, progress: 1, cell: "1,1" },
    { id: "lp-c", faction: player.id, type: "observationtower", alive: true, progress: 1, cell: "2,1" }
  ];
  const posts = uniqueOperationalListeningPosts(structures, player.id, structure => structure.cell);
  assert.equal(posts.length, 2);
  const income = spaceMarineTerritoryIncome({ player, claimedTerritories: 3, structures, cellKeyFor: structure => structure.cell, seconds: 2 });
  assert.equal(income.requisition, 50);
  assert.equal(SPACE_MARINE_CAPTURE_REQUISITION_BONUS, 5);
});

test("forward outposts are chosen only when they shorten a safe resupply trip", () => {
  const unit = { faction: "sm-a", x: 500, y: 0 };
  const hq = { id: "hq", faction: "sm-a", x: 0, y: 0, type: "outpost", progress: 1, alive: true };
  const outpost = { id: "fo", faction: "sm-a", x: 430, y: 0, type: "forwardoutpost", progress: 1, alive: true,
    inventory: { ammunition: 40, medical: 10, parts: 10, fuel: 20, food: 20 } };
  assert.equal(selectForwardResupplyPoint({ unit, structures: [outpost], headquarters: hq }).id, "fo");
  assert.equal(shouldBuildForwardOutpost({ frontlineDistance: 420, nearestOutpostDistance: 300, threat: 0.4, territorySafe: true }), true);
  assert.ok(forwardOutpostRestockManifest(outpost).ammunition > 0);
});

test("opening forces cannot spawn-rush a builder camp before viable mobilization", () => {
  const builders = [{ faction: "ork", role: "builder", alive: true }];
  const muster = [{ faction: "ork", type: "barracks", progress: 1, condition: 1, alive: true }];
  assert.equal(combatReadyCount(builders, "ork"), 0);
  assert.equal(isMobilizationProtected({ now: 40, targetFaction: "ork", attackerFaction: "marine", units: builders, structures: muster }), true);
  const ready = Array.from({ length: 12 }, () => ({ faction: "ork", role: "trooper", alive: true }));
  assert.equal(isMobilizationProtected({ now: 40, targetFaction: "ork", attackerFaction: "marine", units: [...builders, ...ready], structures: muster }), false);
  assert.equal(isMobilizationProtected({ now: MOBILIZATION_GRACE_SECONDS, targetFaction: "ork", attackerFaction: "marine", units: builders, structures: [] }), false);
});
