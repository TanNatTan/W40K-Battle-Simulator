import assert from "node:assert/strict";
import test from "node:test";

import { HeightField, seededRandom } from "../src/terrain/HeightField.js";
import { WorldLayers } from "../src/world/WorldLayers.js";
import { generateRegion, pickSettlementSites } from "../src/world/RegionGenerator.js";
import { EcosystemSimulator } from "../src/world/Ecosystem.js";
import { LivingSettlements } from "../src/settlements/LivingSettlements.js";
import { EXPANSION, baseRadiusOf, findColonySite } from "../src/settlements/SettlementPlanner.js";
import { createRegionRuntime, REGION_WORLD, DEFAULT_REGION_CONFIG } from "../src/region/RegionRuntime.js";
import { CAPTIVE_POLICIES } from "../src/population/SettlementPopulation.js";

const SIZE = { width: 2560, height: 1440 };

function buildLiving({ seed = 3, population = 75, maxSettlements = 24 } = {}) {
  const field = new HeightField(SIZE);
  const layers = new WorldLayers(SIZE);
  const info = generateRegion({ field, layers, seed: `R${seed}`, ...SIZE });
  const random = seededRandom(seed);
  const eco = new EcosystemSimulator({ layers, field, random });
  const world = new LivingSettlements({ field, layers, eco, random, host: { nameOf: f => f, policyOf: () => ({}), hostile: () => true }, limits: { maxSettlements } });
  const site = pickSettlementSites(info.sites, 3, 420)[0];
  const home = world.addSettlement({ x: site.x, y: site.y, population, owner: "a" });
  const run = seconds => { const end = world.time + seconds; while (world.time < end) { eco.step(0.5); world.step(0.5, { units: [] }); } };
  return { world, home, run };
}

test("a settlement's reach widens as it fills up and never passes its cap", () => {
  const { world, home, run } = buildLiving({ maxSettlements: 1 });
  const base = baseRadiusOf(home);
  assert.equal(base, 120);
  run(1500);
  assert.ok(home.radius > base + 20, `reach should have grown, was ${home.radius}`);
  run(1500);
  assert.ok(home.radius <= base * EXPANSION.maxRadiusFactor + 0.01);
  assert.ok(world.chronicle.some(entry => entry.kind === "expanded"));
});

test("a crowded, fed, calm settlement sends settlers to found a daughter settlement", () => {
  const { world, home, run } = buildLiving();
  run(5200);
  const colonies = [...world.settlements.values()].filter(item => item.parentId === home.id);
  assert.ok(colonies.length >= 1, "no colony was founded");
  const colony = colonies[0];
  assert.equal(colony.owner, home.owner, "a colony keeps its parent's ruler");
  assert.ok(Math.hypot(colony.x - home.x, colony.y - home.y) > home.radius, "colony sits outside the parent's reach");
  assert.ok(colony.agentIds.length > 0 && colony.buildings.some(item => item.type === "hall"));
  assert.ok(colony.fields.length > 0, "settlers start with fields");
  const founder = world.agents.get(colony.agentIds[0]);
  assert.equal(founder.settlementId, colony.id);
  assert.ok(founder.history.some(line => /found/.test(line)));
  assert.ok(world.chronicle.some(entry => entry.kind === "colony"));
});

test("colonies respect the settlement cap and the minimum spacing", () => {
  const capped = buildLiving({ maxSettlements: 1 });
  capped.run(5200);
  assert.equal(capped.world.settlements.size, 1);
  const { world, run } = buildLiving({ seed: 8, maxSettlements: 24 });
  run(7000);
  const all = [...world.settlements.values()];
  for (let a = 0; a < all.length; a += 1) for (let b = a + 1; b < all.length; b += 1) {
    assert.ok(Math.hypot(all[a].x - all[b].x, all[a].y - all[b].y) >= EXPANSION.minSpacing * 0.9, "settlements overlap");
  }
});

test("findColonySite returns open ground away from every settlement", () => {
  const { world, home } = buildLiving();
  const site = findColonySite(world, home);
  assert.ok(site);
  for (const other of world.settlements.values()) assert.ok(Math.hypot(other.x - site.x, other.y - site.y) >= EXPANSION.minSpacing);
});

function makeHarness(configOverrides = {}) {
  const state = {
    time: 0,
    heightField: new HeightField({ width: REGION_WORLD.width, height: REGION_WORLD.height }),
    economicNodes: [],
    units: [],
    camera: { x: 1280, y: 720, zoom: 0.5 },
    dayNight: { weather: "clear" },
    terrainPalette: null,
    worldLayers: null
  };
  const random = seededRandom(7);
  const log = { grants: [], incidents: [], recruits: 0, hits: [] };
  let nodeId = 1;
  const runtime = createRegionRuntime({
    state: () => state,
    random,
    areAllies: (a, b) => a === b,
    nameOf: faction => String(faction),
    factionName: () => "Orks",
    colorOf: () => "#f00",
    policyOf: faction => ({ branch: faction === "b" ? "orks" : "space_marines", ...(faction === "b" ? CAPTIVE_POLICIES.orks : CAPTIVE_POLICIES.space_marines) }),
    stressOf: () => 0,
    baseOf: faction => (faction === "b" ? { x: 2200, y: 1200 } : { x: 300, y: 240 }),
    grant: (faction, resources) => log.grants.push({ faction, resources }),
    recruit: () => { log.recruits += 1; },
    attack: (id, damage) => log.hits.push({ id, damage }),
    incident: text => log.incidents.push(text),
    createNode: (point, overrides) => ({ id: `node-${nodeId++}`, x: point.x, y: point.y, active: true, owner: "", ...overrides }),
    bakeVegetation: () => null,
    deserializeField: payload => HeightField.deserialize(payload, REGION_WORLD)
  });
  const bases = [{ x: 600, y: 360 }, { x: 1960, y: 1080 }];
  runtime.begin({ ...DEFAULT_REGION_CONFIG, seed: "TEST-REGION", ...configOverrides }, bases);
  return { runtime, state, log, bases };
}


test("citizens can be picked and report plain stat values", () => {
  const { runtime } = makeHarness({ settlements: [{ population: 30 }, { population: 24 }] });
  runtime.populate();
  const settlement = [...runtime.living.settlements.values()][0];
  const agent = runtime.living.agents.get(settlement.agentIds[2]);
  const picked = runtime.citizenAt(agent.x + 1, agent.y - 1, 6);
  assert.ok(picked, "nobody found at the point");
  const report = runtime.citizenReport(picked);
  assert.equal(report.name, picked.name);
  assert.ok(report.age >= 0 && report.maxHp > 0);
  for (const key of ["hunger", "fatigue", "fear"]) assert.ok(report[key] >= 0 && report[key] <= 1, key);
  for (const key of ["farming", "mining", "building", "fighting"]) assert.ok(key in report.skills, key);
  assert.equal(report.settlement.name, settlement.name);
  assert.equal(typeof report.activity, "string");
  assert.equal(runtime.citizenById(picked.id), picked);
  picked.alive = false;
  assert.equal(runtime.citizenAt(agent.x, agent.y, 6) === picked, false);
  assert.equal(runtime.citizenById(picked.id), null);
  assert.equal(runtime.citizenAt(-500, -500, 8), null);
});
