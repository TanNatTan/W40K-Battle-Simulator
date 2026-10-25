import assert from "node:assert/strict";
import test from "node:test";

import {
  generatePlanet, advancePlanet, launchAttack, resolveBattle, updateSupply, tacticalSetupFor,
  applyTacticalResult, planetSummary, ownedRegions, regionStrength, buildRegionRaster, planetRandom
} from "../src/planet/PlanetCampaign.js";

const FACTIONS = [
  { id: "p1", name: "Ultramarines", race: "Imperium", faction: "Space Marines", color: "#3a6", aggression: 0.7 },
  { id: "p2", name: "Waaagh", race: "Orks", faction: "Ork Clans", color: "#6a3", aggression: 0.9 },
  { id: "p3", name: "Hive Fleet", race: "Tyranids", faction: "Tyranids", color: "#a36", aggression: 0.95 }
];

const make = (seed = "T1", regionCount = 48) => generatePlanet({ seed, regionCount, factions: FACTIONS });

test("generation is deterministic and the world graph is connected and symmetric", () => {
  const a = make("SEED");
  const b = make("SEED");
  assert.deepEqual(a.regions.map(r => [r.name, r.biome, r.neighbors]), b.regions.map(r => [r.name, r.biome, r.neighbors]));
  for (const region of a.regions) {
    assert.ok(region.neighbors.length >= 3, `${region.id} has too few neighbours`);
    for (const id of region.neighbors) assert.ok(a.byId.get(id).neighbors.includes(region.id), "links must be symmetric");
  }
  const seen = new Set([a.regions[0].id]);
  const stack = [a.regions[0]];
  while (stack.length) for (const id of stack.pop().neighbors) if (!seen.has(id)) { seen.add(id); stack.push(a.byId.get(id)); }
  assert.equal(seen.size, a.regions.length);
});

test("factions start in distinct capitals with supplied territory", () => {
  const planet = make();
  const capitals = Object.values(planet.factions).map(f => f.capitalId);
  assert.equal(new Set(capitals).size, 3);
  for (const faction of Object.values(planet.factions)) {
    const capital = planet.byId.get(faction.capitalId);
    assert.equal(capital.owner, faction.id);
    assert.ok(regionStrength(capital, faction.id) > 100);
    assert.equal(capital.supply[faction.id], 1);
  }
});

test("battle resolution favours the stronger and better-defended side", () => {
  const random = planetRandom("battle");
  const strongAttack = resolveBattle({ strength: 200, multiplier: 1 }, { strength: 60, multiplier: 1 }, random);
  assert.ok(strongAttack.attackers > 0 && strongAttack.defenders === 0);
  const fortified = resolveBattle({ strength: 80, multiplier: 1 }, { strength: 80, multiplier: 1.8 }, planetRandom("f"));
  assert.ok(fortified.defenders > fortified.attackers);
});

test("a decisive attack conquers a region, applies captive fallout and moves ownership", () => {
  const planet = make("CONQ");
  const faction = planet.factions.p2;
  const from = planet.byId.get(faction.capitalId);
  const target = planet.byId.get(from.neighbors.find(id => planet.byId.get(id).owner !== "p2"));
  target.forces = {};
  target.population = 100;
  target.maxPopulation = 100;
  from.forces.p2 = 400;
  const result = launchAttack(planet, "p2", from, target, 0.9);
  assert.equal(result.outcome, "conquest");
  assert.equal(target.owner, "p2");
  assert.ok(regionStrength(target, "p2") > 0);
  assert.ok(regionStrength(from, "p2") < 400);
});

test("supply collapses when the capital link is cut", () => {
  const planet = make("SUP");
  const faction = planet.factions.p1;
  const capital = planet.byId.get(faction.capitalId);
  const far = planet.regions.find(region => region.owner !== "p1" && !capital.neighbors.includes(region.id)
    && !region.neighbors.some(id => planet.byId.get(id).owner === "p1"));
  far.owner = "p1";
  far.forces.p1 = 50;
  updateSupply(planet);
  assert.equal(far.supply.p1, 0.25);
});

test("a long simulation stays finite and in bounds, and ends or keeps running without errors", () => {
  const planet = make("LONG", 64);
  for (let i = 0; i < 400 && !planet.winner; i += 1) advancePlanet(planet, 2);
  for (const region of planet.regions) {
    assert.ok(Number.isFinite(region.population) && region.population >= 0);
    assert.ok(region.unrest >= 0 && region.unrest <= 1);
    for (const value of Object.values(region.forces)) assert.ok(Number.isFinite(value) && value >= 0);
  }
  const summary = planetSummary(planet);
  assert.equal(summary.length, 3);
  assert.ok(planet.log.length > 0, "the campaign should have produced events");
  const conquests = Object.values(planet.factions).reduce((sum, f) => sum + f.conquests, 0);
  assert.ok(conquests > 0, "someone should have conquered something");
});

test("unrest in a thinly held region produces a rebel-held independent region", () => {
  const planet = make("REB", 30);
  const region = planet.regions.find(r => r.owner === "" ) || planet.regions[5];
  region.owner = "p1";
  region.capitalOf = null;
  region.forces = { p1: 1 };
  region.population = 200;
  region.maxPopulation = 200;
  region.unrest = 0.9;
  advancePlanet(planet, 2);
  assert.ok(String(region.owner).startsWith("rebels:"));
});

test("tactical bridge returns at least two sides and applying a result changes ownership", () => {
  const planet = make("TAC");
  const faction = planet.factions.p1;
  const home = planet.byId.get(faction.capitalId);
  const enemyRegion = planet.regions.find(r => r.owner && r.owner !== "p1" && r.neighbors.length);
  enemyRegion.forces.p1 = 60;
  const setup = tacticalSetupFor(planet, enemyRegion.id);
  assert.ok(setup.sides.length >= 2);
  assert.equal(setup.seedText, `${planet.seed}:${enemyRegion.id}`);
  applyTacticalResult(planet, enemyRegion.id, { winnerId: "p1", survivors: { p1: 0.5 } });
  assert.equal(enemyRegion.owner, "p1");
  assert.ok(home);
});

test("region raster maps every pixel to a valid region", () => {
  const planet = make("RAS", 24);
  const raster = buildRegionRaster(planet, 64, 32);
  assert.equal(raster.length, 64 * 32);
  for (const index of raster) assert.ok(index >= 0 && index < planet.regions.length);
  assert.ok(ownedRegions(planet, "p1").length >= 1);
});
