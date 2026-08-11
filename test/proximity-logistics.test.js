import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { evaluateProximityAwareness, proximityCombatModifiers } from "../src/ai/ProximityAwareness.js";
import { FACTION_ECONOMY_PROFILES } from "../src/economy/FactionEconomyProfiles.js";
import { createResourceZone, syncResourceZone } from "../src/economy/ResourceZones.js";
import { weaponProfileFor } from "../src/combat/CombatSystem.js";

const baseUnit = overrides => ({
  id: "unit",
  alive: true,
  role: "trooper",
  hp: 100,
  maxHp: 100,
  morale: 0.75,
  courage: 0.6,
  discipline: 0.58,
  resolve: 0.65,
  aggression: 0.55,
  vengeance: 0.2,
  suppression: 0,
  alertLevel: 0,
  ...overrides
});

test("nearby hostiles create aggression broadly but fear only under a Guard fear policy", () => {
  const hostile = baseUnit({ id: "enemy", role: "commander", morale: 0.9 });
  const aggressive = baseUnit({ aggression: 0.98, vengeance: 0.8, courage: 0.82, discipline: 0.45 });
  const afraid = baseUnit({ role: "builder", aggression: 0.08, courage: 0.12, discipline: 0.24, morale: 0.28, resolve: 0.2, hp: 45 });
  let aggressiveState = aggressive;
  let afraidState = afraid;
  for (let tick = 0; tick < 12; tick += 1) {
    aggressiveState = { ...aggressiveState, ...evaluateProximityAwareness(aggressiveState, [{ unit: hostile, distance: 18 }], [], 0.2, 160) };
    afraidState = { ...afraidState, ...evaluateProximityAwareness(afraidState, [{ unit: hostile, distance: 18 }], [], 0.2, 160, { usesFear: true }) };
  }
  assert.equal(aggressiveState.alertState, "Aggressive");
  assert.equal(afraidState.alertState, "Afraid");
  assert.ok(proximityCombatModifiers(aggressiveState).confidence > 0);
  assert.ok(proximityCombatModifiers(afraidState).confidence < 0);
  assert.ok(proximityCombatModifiers(afraidState).move < proximityCombatModifiers(aggressiveState).move);
  const fearless = evaluateProximityAwareness(afraid, [{ unit: hostile, distance: 18 }], [], 1, 160);
  assert.notEqual(fearless.alertState, "Afraid");
});

test("alertness decays after nearby enemies disappear", () => {
  const unit = baseUnit({ alertLevel: 0.8, alertState: "Tense" });
  const result = evaluateProximityAwareness(unit, [], [], 1, 160);
  assert.ok(result.alertLevel < unit.alertLevel);
  assert.equal(result.nearestThreatId, null);
});

test("faction resource priorities drive scrap, biomass, and universal food demand", () => {
  for (const profile of Object.values(FACTION_ECONOMY_PROFILES)) {
    assert.ok(profile.activeResources.includes("food"), `${profile.id} should track food`);
    assert.ok(profile.zoneResources.includes("food"), `${profile.id} should capture food zones`);
  }
  assert.ok(FACTION_ECONOMY_PROFILES.Orks.resourcePriorities.scrap > FACTION_ECONOMY_PROFILES.Orks.resourcePriorities.food);
  assert.ok(FACTION_ECONOMY_PROFILES.Tyranids.resourcePriorities.biomass > FACTION_ECONOMY_PROFILES.Tyranids.resourcePriorities.food);
});

test("resource zones support builders and dedicated supply carriers", () => {
  const zone = createResourceZone("zone", { x: 50, y: 50 }, { requiresBuilding: false });
  assert.deepEqual(zone.allowedCollectors, ["builder", "supply"]);
  const legacy = createResourceZone("legacy", { x: 80, y: 80 }, { requiresBuilding: false, allowedCollectors: ["builder", "vehicle"] });
  syncResourceZone(legacy);
  assert.ok(legacy.allowedCollectors.includes("supply"));
  const unarmed = weaponProfileFor({ role: "supply", weaponId: "unarmed" }, {});
  assert.equal(unarmed.damage, 0);
  assert.equal(unarmed.range, 0);
});

test("browser runtime connects headquarters production, physical hauling, and structured landmark controls", async () => {
  const [app, html] = await Promise.all([
    readFile(new URL("../js/app.js", import.meta.url), "utf8"),
    readFile(new URL("../index.html", import.meta.url), "utf8")
  ]);
  assert.match(app, /function updateHeadquartersSupportProduction\(/);
  assert.match(app, /spawnHeadquartersSupportUnit\(player, headquarters, role\)/);
  assert.match(app, /unit\.role === "supply"/);
  assert.match(app, /resourceNeedScore\(player, zone\.resourceType\)/);
  assert.match(app, /Capture \$\{captureTarget\.name\} for needed \$\{captureTarget\.resourceType\}/);
  assert.match(app, /Capture economic landmark \$\{captureTarget\.name\}/);
  assert.match(app, /resourceCaptureNudge/);
  assert.match(app, /Capturing resource frontier/);
  assert.match(app, /if \(decision\.friendlyPower < 1\) continue/);
  assert.match(html, /id="awt-economic-node-flows"/);
  assert.match(html, /id="awt-add-economic-flow"/);
  assert.doesNotMatch(html, /placeholder="food:12, requisition:8"/);
});
