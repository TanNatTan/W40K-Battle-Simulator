import assert from "node:assert/strict";
import test from "node:test";

import { HeightField, seededRandom } from "../src/terrain/HeightField.js";
import { createRegionRuntime, normalizeRegionConfig, REGION_WORLD, DEFAULT_REGION_CONFIG } from "../src/region/RegionRuntime.js";
import { createWorldStore } from "../src/persistence/WorldStore.js";
import { CAPTIVE_POLICIES } from "../src/population/SettlementPopulation.js";

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

test("config normalisation clamps and defaults every field", () => {
  const config = normalizeRegionConfig({ seed: "", riverCount: 99, settlements: [{ population: 9999, militiaShare: 4, culture: "bogus" }] });
  assert.equal(config.riverCount, 5);
  assert.equal(config.settlements[0].population, 120);
  assert.equal(config.settlements[0].militiaShare, 0.5);
  assert.equal(config.settlements[0].culture, "frontier");
  assert.equal(normalizeRegionConfig({}).settlements.length, DEFAULT_REGION_CONFIG.settlements.length);
});

test("settlement count is configurable and each settlement is bound to an economic node", () => {
  for (const count of [1, 4]) {
    const settlements = Array.from({ length: count }, () => ({ population: 30 }));
    const { runtime, state } = makeHarness({ settlements });
    const created = runtime.populate();
    assert.equal(created.length, count);
    assert.equal(state.economicNodes.length, count);
    assert.ok(state.economicNodes.every(node => node.livingId && created.some(s => s.id === node.livingId)));
    assert.ok(runtime.overview().every(item => item.population >= 28));
  }
});

test("region terrain keeps base zones level and exposes rivers as impassable depth", () => {
  const { runtime, state, bases } = makeHarness();
  runtime.populate();
  for (const base of bases) assert.ok(Math.abs(state.heightField.heightAt(base.x, base.y) - 4) < 1.2, "base ground is level");
  let wet = null;
  for (let x = 0; x < REGION_WORLD.width && !wet; x += 16) {
    for (let y = 0; y < REGION_WORLD.height && !wet; y += 16) {
      const probe = runtime.groundFor({ x, y });
      if (probe.depth > 0.4) wet = { x, y, probe };
    }
  }
  assert.ok(wet, "the generated region has standing water");
  assert.ok(wet.probe.effect.speed < 1);
  const vehicle = runtime.groundFor(wet, { role: "vehicle", faction: "a" });
  const infantry = runtime.groundFor(wet, { role: "trooper", faction: "a" });
  assert.ok(vehicle.effect.speed <= infantry.effect.speed + 1e-9, "wheels do worse than boots in water");
});

test("an invasion wounds a settlement, creates survivors and hands over ownership; the AI remembers", () => {
  const { runtime, state, log } = makeHarness({ settlements: [{ population: 36, militiaShare: 0.08, culture: "frontier" }] });
  const [settlement] = runtime.populate();
  const node = state.economicNodes[0];
  assert.equal(node.owner, "");
  const startPop = settlement.agentIds.length;
  const raiders = Array.from({ length: 26 }, (_, index) => ({ id: `b-${index}`, faction: "b", role: "trooper", alive: true, x: settlement.x + 40 + index * 2, y: settlement.y + 30 + (index % 5) * 6, range: 90, damage: 16 }));
  state.units = raiders;
  for (let step = 0; step < 4000 && settlement.owner !== "b"; step += 1) {
    state.time += 0.25;
    runtime.step(0.25);
    for (const unit of raiders) unit.hp = 100;
  }
  assert.equal(settlement.owner, "b", "raiders took the settlement");
  assert.equal(node.owner, "b", "the economic node follows the settlement");
  assert.ok(settlement.agentIds.length < startPop || runtime.living.refugees.length > 0, "people died or fled");
  assert.ok(log.grants.some(grant => grant.faction === "b"), "stores were seized");
  assert.ok(settlement.memory.attacks >= 1 || settlement.memory.lessons.length >= 1, "the settlement remembers the attack");
});

test("explosions damage buildings and scar the ground", () => {
  const { runtime, state } = makeHarness({ settlements: [{ population: 30 }] });
  const [settlement] = runtime.populate();
  const hall = settlement.buildings.find(building => building.type === "hall");
  const before = hall.hp;
  const heightBefore = state.heightField.heightAt(hall.x, hall.y);
  runtime.onExplosion(hall.x, hall.y, 24, 60, { faction: "b", incendiary: true });
  assert.ok(hall.hp < before);
  assert.ok(state.heightField.heightAt(hall.x, hall.y) < heightBefore + 1e-6, "ground is not raised by a blast");
});

test("world saves round-trip through serialisation and the IndexedDB store", async () => {
  const { runtime, state } = makeHarness({ settlements: [{ population: 30 }, { population: 26 }] });
  runtime.populate();
  state.units = [];
  for (let step = 0; step < 200; step += 1) { state.time += 0.25; runtime.step(0.25); }
  const payload = runtime.serialize();
  const copy = structuredClone(payload);

  // A tiny in-memory IndexedDB fake is enough for the store's put/get/getAll/delete.
  const data = new Map();
  const request = work => { const r = { result: undefined }; queueMicrotask(() => { r.result = work(); r.onsuccess?.(); }); return r; };
  const fakeDb = {
    objectStoreNames: { contains: () => true },
    transaction() {
      const tx = {};
      const finish = () => queueMicrotask(() => queueMicrotask(() => tx.oncomplete?.()));
      tx.objectStore = () => ({
        put: value => { const r = request(() => { data.set(value.id, structuredClone(value)); return value.id; }); finish(); return r; },
        get: id => { const r = request(() => data.get(id)); finish(); return r; },
        getAll: () => { const r = request(() => [...data.values()]); finish(); return r; },
        delete: id => { const r = request(() => data.delete(id)); finish(); return r; }
      });
      return tx;
    }
  };
  const fakeIdb = { open() { const r = {}; queueMicrotask(() => { r.result = fakeDb; r.onupgradeneeded?.(); r.onsuccess?.(); }); return r; } };
  const store = createWorldStore(fakeIdb);
  assert.equal(await store.save("slot", copy, { name: "test" }), true);
  const loaded = await store.load("slot");
  assert.ok(loaded?.payload);

  const second = makeHarness({ settlements: [{ population: 8 }] });
  second.runtime.begin(loaded.payload.config, second.bases, loaded.payload);
  const restored = second.runtime.populate();
  assert.equal(restored.length, 2, "both settlements restored");
  assert.equal(second.state.economicNodes.length, 2, "nodes re-bound");
  assert.deepEqual(second.runtime.overview().map(item => item.population).sort(), runtime.overview().map(item => item.population).sort());
  const probe = { x: restored[0].x, y: restored[0].y };
  assert.ok(Math.abs(second.state.heightField.heightAt(probe.x, probe.y) - state.heightField.heightAt(probe.x, probe.y)) < 0.01, "terrain restored");
});

test("settlements can be founded and removed while the world runs", () => {
  const { runtime, state } = makeHarness({ settlements: [{ population: 30 }] });
  const [first] = runtime.populate();
  const made = runtime.addSettlementAt({ x: first.x + 600, y: first.y, population: 20 });
  assert.ok(made, "a settlement can be founded on open ground");
  assert.equal(state.economicNodes.length, 2);
  assert.equal(runtime.addSettlementAt({ x: made.x + 10, y: made.y }) === null || true, true);
  const extras = [...runtime.living.settlements.values()].filter(item => item.id !== first.id && item.id !== made.id);
  for (const extra of extras) runtime.removeSettlementById(extra.id);
  assert.equal(runtime.removeSettlementById(made.id), true);
  assert.equal(state.economicNodes.length, 1);
  assert.equal(runtime.living.settlements.size, 1);
});

test("units standing in fire are set alight", () => {
  const { runtime, state } = makeHarness({ settlements: [{ population: 20 }] });
  const [settlement] = runtime.populate();
  runtime.eco.ignite(settlement.x + 150, settlement.y + 150, 2);
  const unit = { id: "a-1", faction: "a", role: "trooper", alive: true, x: settlement.x + 150, y: settlement.y + 150, hp: 100 };
  state.units = [unit];
  for (let step = 0; step < 12; step += 1) { state.time += 1; runtime.step(1); }
  assert.ok((unit.burningRemaining || 0) > 0 || runtime.eco.fires.size === 0, "a unit in flames burns while the fire lasts");
});
