import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  SHARED_AI_SYSTEMS,
  enforceFactionIdentity,
  resolveFactionAIProfile,
  scoreStrategicChoices,
  selectStrategicChoice
} from "../src/ai/FactionAISystem.js";
import {
  applyRelationshipEvent,
  relationshipBandFor,
  relationshipPriority,
  serializeRelationshipMemory
} from "../src/relationships/RelationshipSystem.js";
import { createFactionLearningMemory } from "../src/learning/LearningSystem.js";

const catalog = JSON.parse(await readFile(new URL("../data/ai/faction-branches.json", import.meta.url), "utf8"));

test("Phase 17 gives every race one shared core and a distinct strategic branch", () => {
  const players = [
    { race: "Imperium", faction: "Space Marines", subfaction: "Ultramarines" },
    { race: "Imperium", faction: "Imperial Guard", subfaction: "Cadian" },
    { race: "Chaos", faction: "Chaos", subfaction: "Black Legion" },
    { race: "Orks", faction: "Orks", subfaction: "Goffs" },
    { race: "Necrons", faction: "Necrons", subfaction: "Sautekh" },
    { race: "T'au", faction: "Tau", subfaction: "Farsight Enclaves" },
    { race: "Tyranids", faction: "Tyranids", subfaction: "Kraken" }
  ];
  const profiles = players.map(player => resolveFactionAIProfile(player, catalog));
  assert.deepEqual([...new Set(profiles.flatMap(profile => profile.sharedCore))].sort(), [...SHARED_AI_SYSTEMS].sort());
  assert.equal(new Set(profiles.map(profile => profile.branch)).size, 7);
  assert.equal(new Set(profiles.map(profile => JSON.stringify(profile.weights))).size, 7);
  const context = { ownStrength: 0.62, observedEnemyStrength: 0.45, enemyPressure: 0.25, resourceShortage: 0.2, territoryOpportunity: 0.8, routeRisk: 0.1, casualtyRatio: 0.08 };
  assert.ok(new Set(profiles.map(profile => selectStrategicChoice(profile, context).choice)).size >= 2);
});

test("Phase 17 subfactions adjust race strategy without replacing its foundation", () => {
  const ultramarines = resolveFactionAIProfile({ race: "Imperium", faction: "Space Marines", subfaction: "Ultramarines" }, catalog);
  const bloodAngels = resolveFactionAIProfile({ race: "Imperium", faction: "Space Marines", subfaction: "Blood Angels" }, catalog);
  assert.equal(ultramarines.branch, bloodAngels.branch);
  assert.notDeepEqual(ultramarines.weights, bloodAngels.weights);
  assert.strictEqual(ultramarines.sharedCore, bloodAngels.sharedCore);
});

test("Phase 18 relationships form named bands and only nudge priorities", () => {
  assert.equal(relationshipBandFor(82), "Bonded");
  assert.equal(relationshipBandFor(-92), "Enemy");
  assert.ok(Math.abs(relationshipPriority(100, 100, "rescue") - 112) < 1e-9);
  assert.ok(Math.abs(relationshipPriority(100, -100, "rescue") - 88) < 1e-9);
  const trusted = applyRelationshipEvent({ score: 20 }, "savedAlly", 90, null, "saved under fire");
  assert.equal(trusted.score, 32);
  assert.equal(trusted.lastReason, "saved under fire");
  const memory = serializeRelationshipMemory([{ id: "a", faction: "p1", relationships: { b: trusted }, memories: ["Saved B"], kills: 1 }], "battle-1");
  assert.equal(memory.relationships[0].band, "Friendly");
  assert.equal(memory.unitHistory[0].kills, 1);
});

test("Phase 19 refuses unseen enemy knowledge and persists observed learning", () => {
  const profile = resolveFactionAIProfile({ race: "T'au", faction: "Tau", subfaction: "Farsight Enclaves" }, catalog);
  const memory = createFactionLearningMemory(profile);
  assert.equal(memory.observe("enemy-pattern", { formation: "wedge" }, { visible: false, observedAt: 1 }), false);
  assert.equal(memory.observations.length, 0);
  assert.equal(memory.observe("enemy-pattern", { formation: "wedge" }, { visible: true, observedAt: 2 }), true);
  memory.observe("route-safety", { routeId: "north-road", safe: false }, { observedAt: 3 });
  const restored = createFactionLearningMemory(profile, memory.toJSON());
  assert.equal(restored.observations.length, 2);
  assert.ok(restored.routePreference("north-road") < 0);
});

test("Phase 19 learning weights remain inside faction identity boundaries", () => {
  const ork = resolveFactionAIProfile({ race: "Orks", faction: "Orks", subfaction: "Goffs" }, catalog);
  const tau = resolveFactionAIProfile({ race: "T'au", faction: "Tau", subfaction: "Farsight Enclaves" }, catalog);
  const tyranid = resolveFactionAIProfile({ race: "Tyranids", faction: "Tyranids", subfaction: "Behemoth" }, catalog);
  const orkMemory = createFactionLearningMemory(ork);
  for (let index = 0; index < 40; index += 1) orkMemory.observe("failed-assault", { index }, { observedAt: index });
  assert.ok(orkMemory.learnedWeights.attack >= 1.1);
  assert.ok(orkMemory.learnedWeights.melee >= 1.12);
  assert.ok(enforceFactionIdentity(tau, { ...tau.weights, melee: 99 }).melee <= 0.42);
  assert.ok(enforceFactionIdentity(tyranid, { ...tyranid.weights, swarm: 0 }).swarm >= 1.2);
  assert.notDeepEqual(scoreStrategicChoices(ork, {}), scoreStrategicChoices(tau, {}));
});

test("Phase 18 and 19 SQLite persistence tables are versioned", async () => {
  const sql = await readFile(new URL("../sql/migrations/005_ai_relationship_learning.sql", import.meta.url), "utf8");
  for (const table of ["unit_relationships", "unit_history", "battle_history", "faction_ai_memory"]) {
    assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  }
  assert.match(sql, /schema_versions\(version\) VALUES \(5\)/);
});
