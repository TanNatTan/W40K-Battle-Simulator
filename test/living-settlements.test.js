import assert from "node:assert/strict";
import test from "node:test";

import { HeightField, seededRandom } from "../src/terrain/HeightField.js";
import { WorldLayers, EARTHWORK } from "../src/world/WorldLayers.js";
import { generateRegion, pickSettlementSites } from "../src/world/RegionGenerator.js";
import { EcosystemSimulator } from "../src/world/Ecosystem.js";
import { LivingSettlements } from "../src/settlements/LivingSettlements.js";
import { CAPTIVE_POLICIES } from "../src/population/SettlementPopulation.js";
import { DAY } from "../src/settlements/Settlement.js";
import { captureSettlement } from "../src/settlements/Aftermath.js";

const SIZE = { width: 1920, height: 1080 };
const policies = {
  orks: { branch: "orks", ...CAPTIVE_POLICIES.orks },
  imperium: { branch: "imperial_guard", ...CAPTIVE_POLICIES.imperial_guard },
  marines: { branch: "space_marines", ...CAPTIVE_POLICIES.space_marines }
};

function buildWorld({ regionSeed = "BRAVO", seed = 11, population = 40, militiaShare = 0.16, owner = "imperium", culture = "devout", siteIndex = 0, stand = false } = {}) {
  const field = new HeightField(SIZE);
  const layers = new WorldLayers(SIZE);
  const info = generateRegion({ field, layers, seed: regionSeed, ...SIZE });
  const random = seededRandom(seed);
  const eco = new EcosystemSimulator({ layers, field, random });
  const attackers = [];
  const ledger = { grants: {}, recruits: 0, incidents: [] };
  const world = new LivingSettlements({
    field, layers, eco, random,
    host: {
      hostile: (a, b) => a !== b,
      nameOf: f => f,
      policyOf: f => policies[f] || policies.imperium,
      grant: (f, res) => { ledger.grants[f] ||= { food: 0, materials: 0 }; for (const [k, v] of Object.entries(res)) ledger.grants[f][k] = (ledger.grants[f][k] || 0) + v; },
      recruit: (f, n) => { ledger.recruits += n; },
      attack: (id, dmg) => { const u = attackers.find(x => x.id === id); if (u) { u.hp -= dmg; if (u.hp <= 0) u.alive = false; } },
      baseOf: f => (f === "orks" ? { x: 1800, y: 1000 } : { x: 100, y: 100 }),
      incident: text => ledger.incidents.push(text)
    }
  });
  const site = pickSettlementSites(info.sites, 3, 420)[siteIndex];
  const settlement = world.addSettlement({ x: site.x, y: site.y, population, owner, culture, militiaShare });
  if (stand) settlement.doctrine.evacuateBias = 0; // a settlement that will not run
  const run = (seconds, { invaders = true } = {}) => {
    const end = world.time + seconds;
    while (world.time < end) {
      if (invaders) for (const u of attackers) if (u.alive) {
        const d = Math.hypot(settlement.x - u.x, settlement.y - u.y);
        if (d > 40) { u.x += (settlement.x - u.x) / d * u.speed * 0.5; u.y += (settlement.y - u.y) / d * u.speed * 0.5; }
      }
      eco.step(0.5);
      world.step(0.5, { units: attackers.filter(u => u.alive) });
    }
  };
  const invade = (count, faction = "orks", { hp = 60 } = {}) => {
    for (let n = 0; n < count; n += 1) attackers.push({ id: `${faction}-${attackers.length}`, faction, x: settlement.x + 420 + n * 3, y: settlement.y + 100 + n * 7, hp, alive: true, strength: 1, range: 80, damage: 14, speed: 26 });
  };
  return { field, layers, info, eco, world, settlement, attackers, ledger, run, invade };
}

test("a peaceful settlement feeds itself through a full year", () => {
  const w = buildWorld({ owner: null });
  const start = w.world.agentsOf(w.settlement).length;
  w.run(2400, { invaders: false });
  const pop = w.world.agentsOf(w.settlement).length;
  assert.ok(pop >= start * 0.85, `population should hold (${start} -> ${pop})`);
  assert.ok(w.settlement.stats.harvested > 600, "farmers bring in a harvest");
  assert.ok(w.settlement.storage.food > 50, "stores are not empty at year end");
  assert.ok(w.settlement.buildings.some(b => b.type === "granary" && b.hp > 0));
});

test("workers dig a trench: the terrain itself changes", () => {
  const w = buildWorld({ owner: "imperium", militiaShare: 0.16, seed: 11 });
  w.run(300, { invaders: false });
  w.invade(9, "orks");
  w.run(700);
  let trenchCells = 0;
  w.layers.forEachInCircle(w.settlement.x, w.settlement.y, w.settlement.radius * 1.4, (i, j) => { if (w.layers.get("earthwork", i, j) === EARTHWORK.TRENCH) trenchCells += 1; });
  assert.ok(w.settlement.stats.trenchMeters > 0, "builders worked on a trench");
  assert.ok(trenchCells > 0, "the earthwork layer records the trench");
});

test("invasion repelled: damage, casualties, adaptation, fortification", () => {
  const w = buildWorld();
  w.run(300, { invaders: false });
  const doctrine = { ...w.settlement.doctrine };
  const pop0 = w.world.agentsOf(w.settlement).length;
  const buildings0 = w.settlement.buildings.length;
  w.invade(9);
  w.run(700);
  const s = w.settlement;
  assert.equal(w.attackers.filter(u => u.alive).length, 0, "militia drove the raiders off");
  assert.equal(s.owner, "imperium", "settlement kept its owner");
  assert.ok(s.memory.lost > 0 && w.world.agentsOf(s).length < pop0 + 4, "people died");
  assert.ok(s.memory.attacks >= 1);
  // The settlement changed how it behaves.
  assert.ok(s.doctrine.militiaShare > doctrine.militiaShare, "more militia");
  assert.ok(s.doctrine.stashShare > doctrine.stashShare && s.hidden.food > 0, "food quietly hidden");
  assert.ok(s.doctrine.scoutRadius > doctrine.scoutRadius, "earlier warning");
  assert.ok(s.memory.lessons.length > 0);
  const walls = s.buildings.filter(b => ["barricade", "palisade", "watchtower"].includes(b.type) && b.hp > 0).length;
  const trench = s.projects.some(p => p.kind === "trench") || s.stats.trenchMeters > 0;
  assert.ok(walls > 0 || trench, "new defenses were built");
  void buildings0;
});

test("invasion succeeds: stores change hands, survivors flee, captives get fates, settlement adapts", () => {
  const w = buildWorld({ militiaShare: 0.08, stand: true });
  w.run(240, { invaders: false });
  const s = w.settlement;
  const food0 = s.storage.food;
  const doctrine = { ...s.doctrine };
  w.invade(16);
  w.run(520);
  assert.equal(s.owner, "orks", "ownership changed");
  assert.ok((w.ledger.grants.orks?.food || 0) > 0, "the conqueror received food");
  assert.ok(w.ledger.grants.orks.food < food0 + 1, "never more than was stored");
  const survivors = w.world.agents.size; // everyone alive anywhere: still in town, on the road, or in a new camp
  assert.ok(survivors > 0, "some people survived the invasion");
  assert.ok(w.world.refugees.length > 0 || w.world.agentsOf(s).some(a => a.role === "captive" || a.role === "enslaved"), "survivors became refugees or captives");
  assert.ok(s.memory.occupiedBy.length === 1 && s.memory.lastAttack, "the settlement remembers");
  assert.ok(s.doctrine.militiaShare > doctrine.militiaShare && s.doctrine.stashShare > doctrine.stashShare, "doctrine adapted");
  assert.ok(s.stats.seizedFood > 0);
  // Captives are decided later and the outcome is recorded.
  w.run(DAY * 2, { invaders: false });
  assert.ok(w.world.chronicle.some(c => c.kind === "captives") || w.world.agentsOf(s).every(a => a.role !== "captive"), "captive fates were resolved");
});

test("a destroyed granary means less is seized", () => {
  const intact = buildWorld({ militiaShare: 0.08, seed: 5, stand: true });
  const broken = buildWorld({ militiaShare: 0.08, seed: 5, stand: true });
  intact.run(240, { invaders: false });
  broken.run(240, { invaders: false });
  for (const b of broken.settlement.buildings.filter(x => x.type === "granary")) broken.world.destroyBuilding(broken.settlement, b, "test");
  // The same conquest of the same town, with and without a granary to loot.
  const a = captureSettlement(intact.world, intact.settlement, "marines");
  const c = captureSettlement(broken.world, broken.settlement, "marines");
  assert.equal(intact.settlement.owner, "marines");
  assert.ok(a.seized.food > c.seized.food * 1.5, `intact granary should yield far more (${Math.round(a.seized.food)} vs ${Math.round(c.seized.food)})`);
  assert.ok(a.fraction > c.fraction);
});

test("a gentler conqueror leaves rations, a brutal one strips the town", () => {
  const gentle = buildWorld({ seed: 6, stand: true });
  const brutal = buildWorld({ seed: 6, stand: true });
  gentle.run(240, { invaders: false }); brutal.run(240, { invaders: false });
  const g = captureSettlement(gentle.world, gentle.settlement, "marines");
  const b = captureSettlement(brutal.world, brutal.settlement, "orks");
  assert.ok(gentle.settlement.storage.food > brutal.settlement.storage.food, "marines leave bread for the workers");
  assert.ok(b.seized.food > g.seized.food);
});

test("hidden stores survive a conquest", () => {
  const w = buildWorld({ militiaShare: 0.08, stand: true });
  w.run(200, { invaders: false });
  w.settlement.doctrine.stashShare = 0.4;
  w.run(DAY * 3, { invaders: false });
  const hidden = w.settlement.hidden.food;
  assert.ok(hidden > 20, "settlement set food aside");
  w.invade(16);
  w.run(520);
  assert.equal(w.settlement.owner, "orks");
  assert.ok(w.settlement.hidden.food > hidden * 0.4, "hidden food was not found");
});

test("explosions kill people, wreck buildings and scar the ground", () => {
  const w = buildWorld({ owner: "imperium" });
  w.run(60, { invaders: false });
  const s = w.settlement;
  const pop = w.world.agentsOf(s).length;
  const height = w.field.heightAt(s.x, s.y);
  const out = w.world.damageArea(s.x, s.y, 70, 90, { faction: "orks", incendiary: true });
  assert.ok(out.killed + out.structures > 0);
  assert.ok(w.world.agentsOf(s).length <= pop);
  assert.ok(w.field.heightAt(s.x, s.y) < height - 0.3, "a crater formed");
  assert.ok(w.layers.getAt("scorch", s.x, s.y) > 100);
});

test("resistance odds depend on conditions and are never certain", () => {
  const harsh = buildWorld({ militiaShare: 0.08, seed: 3 });
  harsh.run(200, { invaders: false });
  const calm = buildWorld({ militiaShare: 0.08, seed: 3 });
  calm.run(200, { invaders: false });
  for (const w of [harsh, calm]) { w.world.agentsOf(w.settlement).forEach(a => { a.loyalty.orks = w === harsh ? -0.9 : 0.6; }); w.settlement.owner = "orks"; w.settlement.occupation = { by: "orks", since: 0 }; w.settlement.hidden.materials = w === harsh ? 40 : 0; }
  harsh.world.agentsOf(harsh.settlement).forEach(a => { a.traits.charisma = 0.9; a.traits.courage = 0.8; });
  harsh.run(DAY * 1.2, { invaders: false });
  calm.run(DAY * 1.2, { invaders: false });
  assert.ok(harsh.settlement.resistanceOdds > calm.settlement.resistanceOdds, "oppression with arms and a leader raises the odds");
  assert.ok(harsh.settlement.resistanceOdds < 1);
});

test("the world survives a save and load", () => {
  const w = buildWorld({ owner: null });
  w.run(300, { invaders: false });
  const payload = JSON.parse(JSON.stringify(w.world.serialize()));
  const copy = LivingSettlements.deserialize(payload, { field: w.field, layers: w.layers, eco: w.eco, random: seededRandom(2), host: {} });
  assert.equal(copy.settlements.size, 1);
  assert.equal(copy.agentsOf([...copy.settlements.values()][0]).length, w.world.agentsOf(w.settlement).length);
  copy.step(30);
  assert.ok(copy.time > payload.time);
});
