import assert from "node:assert/strict";
import test from "node:test";

import {
  CAPTIVE_POLICIES,
  allocateCaptives,
  applyCollateral,
  captivePolicyFor,
  chooseAllianceTarget,
  createPopulation,
  enslavedLaborIncome,
  isSettlementNode,
  massacreSpoils,
  militiaCapFor,
  populationBranchFor,
  resolveCapture,
  stepSettlement,
  unrestOutputMultiplier
} from "../src/population/SettlementPopulation.js";

const fixed = value => () => value;

test("settlement nodes get a headcount scaled by type", () => {
  assert.equal(isSettlementNode({ type: "civilian-settlement" }), true);
  assert.equal(isSettlementNode({ type: "fuel-refinery", tags: [] }), true);
  assert.equal(isSettlementNode({ type: "supply-depot", tags: ["storage"] }), false);
  assert.equal(isSettlementNode({ type: "civilian-settlement", active: false }), false);
  const hamlet = createPopulation({ type: "civilian-settlement" }, fixed(0.5));
  const hive = createPopulation({ type: "hive-city" }, fixed(0.5));
  assert.ok(hive.count > hamlet.count * 3);
  assert.equal(hamlet.unrest, "calm");
});

test("captive fates always sum to the captive count and follow faction doctrine", () => {
  for (const [branch, policy] of Object.entries(CAPTIVE_POLICIES)) {
    for (const count of [0, 1, 7, 33, 250]) {
      const fates = allocateCaptives(count, policy, { random: fixed(0.4) });
      assert.equal(fates.recruit + fates.enslave + fates.kill + fates.release, count, `${branch} ${count}`);
    }
  }
  const tyranid = allocateCaptives(100, CAPTIVE_POLICIES.tyranids);
  const marine = allocateCaptives(100, CAPTIVE_POLICIES.space_marines);
  const mechanicus = allocateCaptives(100, CAPTIVE_POLICIES.adeptus_mechanicus);
  assert.ok(tyranid.kill >= 90);
  assert.ok(marine.release > marine.kill * 8);
  assert.ok(mechanicus.enslave > mechanicus.recruit);
  const stressed = allocateCaptives(100, CAPTIVE_POLICIES.imperial_guard, { stress: 1 });
  assert.ok(stressed.release < CAPTIVE_POLICIES.imperial_guard.release * 100);
  assert.equal(populationBranchFor({ race: "Orks", faction: "Scrap Legion" }), "orks");
  assert.equal(captivePolicyFor({ race: "Tau" }), CAPTIVE_POLICIES.tau);
});

test("capturing a settlement turns captives into levies, labour, corpses and freed people", () => {
  const pop = createPopulation({ type: "civilian-settlement" }, fixed(1));
  const before = pop.count;
  const result = resolveCapture(pop, CAPTIVE_POLICIES.chaos, { random: fixed(0.5) });
  assert.ok(result.fates.kill > 0 && result.fates.enslave > 0 && result.fates.recruit > 0);
  assert.equal(pop.count, before - result.fates.kill - result.fates.recruit);
  assert.equal(pop.levy, result.fates.recruit);
  assert.ok(pop.enslaved > 0 && pop.enslaved <= pop.count);
  assert.ok(pop.fear > 20 && pop.grievance > 30);
  const gentle = createPopulation({ type: "civilian-settlement" }, fixed(1));
  resolveCapture(gentle, CAPTIVE_POLICIES.tau, { random: fixed(0.5) });
  assert.ok(gentle.grievance < pop.grievance);
});

test("firefights kill civilians and raise grievance", () => {
  const pop = createPopulation({ type: "civilian-settlement" }, fixed(1));
  const start = pop.count;
  const grievance = pop.grievance;
  let dead = 0;
  for (let n = 0; n < 60; n += 1) dead += applyCollateral(pop, 1, 1, fixed(0.9));
  assert.ok(dead > 5);
  assert.equal(pop.count, start - dead);
  assert.ok(pop.grievance > grievance);
  assert.equal(applyCollateral(pop, 0, 1), 0);
});

test("an abused, unguarded settlement escalates to insurgency and declares independence", () => {
  const pop = createPopulation({ type: "civilian-settlement" }, fixed(1));
  resolveCapture(pop, CAPTIVE_POLICIES.necrons, { random: fixed(0.5), resistance: 1 });
  pop.fear = 10;
  const seen = [];
  let now = 0;
  for (let second = 0; second < 600 && pop.unrest !== "independent"; second += 1) {
    now += 1;
    for (const event of stepSettlement(pop, {}, { ownerId: "a", ownerPresence: 0, fed: 0.2, combatIntensity: 0 }, 1, now)) seen.push(event.to);
    if (pop.unrest === "insurgent") pop.militia = Math.max(pop.militia, 4);
  }
  assert.deepEqual(seen.slice(0, 2), ["restless", "insurgent"]);
  assert.equal(pop.unrest, "independent");
  assert.equal(unrestOutputMultiplier(pop), 0);
  assert.ok(militiaCapFor(pop) >= 1);
});

test("a garrisoned, fed settlement stays calm and keeps loyalty to its protector", () => {
  const pop = createPopulation({ type: "civilian-settlement" }, fixed(0.5));
  for (let second = 0; second < 300; second += 1) {
    stepSettlement(pop, {}, { ownerId: "a", ownerPresence: 4, hostilePresence: 0, fed: 1 }, 1, second);
  }
  assert.equal(pop.unrest, "calm");
  assert.ok(pop.loyalty.a > 30);
  assert.equal(chooseAllianceTarget(pop), "a");
  assert.equal(chooseAllianceTarget({ loyalty: { a: 10 } }), null);
});

test("enslaved labour and massacres feed the right faction resources", () => {
  const pop = { enslaved: 100 };
  assert.ok(enslavedLaborIncome(pop, "orks").scrap > 0);
  assert.ok(enslavedLaborIncome(pop, "adeptus_mechanicus").parts > 0);
  assert.ok(massacreSpoils(50, "tyranids").biomass > 0);
  assert.ok(massacreSpoils(50, "chaos").influence > 0);
  assert.deepEqual(massacreSpoils(50, "space_marines"), {});
});

test("browser runtime wires settlements, captives, rebels and militia into the simulation", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../js/app.js", import.meta.url), "utf8");
  assert.match(source, /onSettlementCaptured\(node, previousOwner, resolvedOwner\)/);
  assert.match(source, /updateSettlements\(state\.settlementAccumulator\)/);
  assert.match(source, /state\.independentPlayers\?\.find/);
  assert.match(source, /ensureRebelFaction\(node, pop\)/);
  assert.match(source, /unit\.militiaNodeId/);
  assert.match(source, /node\.population\?\.unrest === "independent"/);
});
