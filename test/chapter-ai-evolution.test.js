import test from "node:test";
import assert from "node:assert/strict";
import { resolveFactionAIProfile } from "../src/ai/FactionAISystem.js";
import { scoreProductionCandidate } from "../src/ai/MilitaryProductionPlanner.js";
import {
  CHAPTER_FORCE_STRUCTURE_PROFILES,
  chapterAllowsUnit,
  chapterCoreCapacity,
  runChapterCapacityTest,
  validateChapterCapability
} from "../src/ai/space-marines/ChapterForceStructureProfile.js";
import {
  CHAPTER_EVOLUTION_SEQUENCE,
  chapterDecisionPriorities,
  createChapterEvolutionTest,
  evaluateChapterEvolutionRun,
  recordChapterEvolutionRun,
  runAllChapterCapacityTests
} from "../src/ai/space-marines/ChapterEvolutionTestSystem.js";
import {
  createFactionLearningMemory,
  factionMatchupMemoryKey,
  learningConfidence,
  MEMORY_TYPES
} from "../src/learning/LearningSystem.js";
import { createSimulationDatabase, SIMULATION_DATABASE_STORES, SIMULATION_DATABASE_VERSION } from "../src/persistence/SimulationDatabase.js";

function passingMetrics(chapter) {
  const profile = CHAPTER_FORCE_STRUCTURE_PROFILES[chapter];
  return {
    objectiveCompleted: true,
    objectiveProgress: 1,
    objectiveOrders: 20,
    unrelatedOrders: 0,
    mapPresence: 1,
    economyControl: 1,
    compositionDiversity: 0.9,
    vehicleUtilization: 0.85,
    specialistNeedResponse: 0.9,
    weaponLoadoutDiversity: 0.85,
    antiHomogenization: 1,
    doctrineEvidence: Object.fromEntries(profile.doctrine.behaviors.map(behavior => [behavior, true])),
    organizationValid: true,
    capacityUnblocked: true
  };
}

test("all ten Space Marine Chapters have explicit, non-homogenized force structures", () => {
  assert.deepEqual(CHAPTER_EVOLUTION_SEQUENCE, [
    "Ultramarines", "Blood Angels", "Imperial Fists", "Salamanders", "Emerald Suns",
    "White Scars", "Raven Guard", "Iron Hands", "Space Wolves", "Black Templars"
  ]);
  assert.equal(CHAPTER_FORCE_STRUCTURE_PROFILES.Salamanders.maximumCoreMarines, 840);
  assert.equal(CHAPTER_FORCE_STRUCTURE_PROFILES["Emerald Suns"].maximumCoreMarines, 960);
  assert.equal(CHAPTER_FORCE_STRUCTURE_PROFILES["Space Wolves"].organization, "Great Company Host");
  assert.equal(CHAPTER_FORCE_STRUCTURE_PROFILES["Black Templars"].bounded, false);
  assert.equal(new Set(Object.values(CHAPTER_FORCE_STRUCTURE_PROFILES).map(profile => profile.doctrine.behaviors.join("/"))).size, 10);
});

test("accelerated Chapter capacity tests fill organization without a rendering requirement", () => {
  const results = runAllChapterCapacityTests({ performanceLimit: 2000, resourceLimit: 2000 });
  assert.ok(results.every(result => result.passed));
  assert.equal(runChapterCapacityTest("Ultramarines", { performanceLimit: 2000 }).assignedMarines, 1000);
  assert.equal(runChapterCapacityTest("Salamanders", { performanceLimit: 2000 }).assignedMarines, 840);
  assert.equal(runChapterCapacityTest("Emerald Suns", { performanceLimit: 2000 }).assignedMarines, 960);
  assert.equal(chapterCoreCapacity("Black Templars", { performanceLimit: 1350, resourceLimit: 1700 }), 1350);
});

test("Chapter capability aliases diagnose missing Wolves-equivalent units and Templars reject Librarians", () => {
  const found = validateChapterCapability("Space Wolves", "Wolf Priest", ["Chaplain"]);
  assert.equal(found.found, true);
  assert.equal(found.resolvedName, "Chaplain");
  assert.equal(validateChapterCapability("Space Wolves", "Thunderwolf Cavalry", ["Chaplain"]).diagnostic, "MISSING_CHAPTER_CAPABILITY");
  assert.equal(chapterAllowsUnit("Black Templars", "Librarian"), false);
  const templar = { race: "Imperium", faction: "Space Marines", subfaction: "Black Templars" };
  const scored = scoreProductionCandidate({ name: "Librarian", role: "commander" }, {
    player: templar, plan: { unitPriority: ["psychic"], vehiclePriority: [] }, availableProducerTypes: ["researchcenter"]
  });
  assert.equal(scored.chapterForbidden, 5000);
  assert.ok(scored.score < -4000);
});

test("battle objective remains authoritative while Chapter doctrine changes the method", () => {
  const priorities = chapterDecisionPriorities({
    objectiveNeed: { capture: 80, attack: 40 },
    battlefieldNeed: { capture: 15, attack: 10 },
    learnedExperience: { capture: -20, attack: 20 },
    chapterDoctrine: { capture: -5, attack: 12 },
    learningConfidence: 0.5
  });
  assert.equal(priorities.capture, 80);
  assert.equal(priorities.attack, 72);
});

test("one lucky run cannot evolve a Chapter and any failure resets the three-pass streak", () => {
  const state = createChapterEvolutionTest({ chapters: ["Ultramarines"], passesRequired: 3, runDurationMs: 1000, startedAt: 0 });
  recordChapterEvolutionRun(state, passingMetrics("Ultramarines"), 1000);
  assert.equal(state.consecutivePasses, 1);
  assert.equal(state.completed, false);
  recordChapterEvolutionRun(state, { ...passingMetrics("Ultramarines"), froze: true }, 2000);
  assert.equal(state.consecutivePasses, 0);
  recordChapterEvolutionRun(state, passingMetrics("Ultramarines"), 3000);
  recordChapterEvolutionRun(state, passingMetrics("Ultramarines"), 4000);
  const final = recordChapterEvolutionRun(state, passingMetrics("Ultramarines"), 5000);
  assert.equal(final.passed, true);
  assert.equal(state.completed, true);
  assert.equal(state.chapterResults.Ultramarines.passed, true);
});

test("doctrine and objective scores enforce the 80/90 thresholds independently", () => {
  const result = evaluateChapterEvolutionRun("Raven Guard", passingMetrics("Raven Guard"));
  assert.ok(result.doctrineFidelityScore >= 80);
  assert.ok(result.objectiveAdherenceScore >= 90);
  assert.equal(result.passed, true);
  const unfocused = evaluateChapterEvolutionRun("Raven Guard", { ...passingMetrics("Raven Guard"), objectiveCompleted: false, objectiveProgress: 0.2, objectiveOrders: 1, unrelatedOrders: 9 });
  assert.equal(unfocused.checks.objectiveAdherence, false);
});

test("learning is matchup-scoped, confidence-weighted, decayed, and vision legal", () => {
  const forward = factionMatchupMemoryKey({ race: "Imperium", subfaction: "Ultramarines", opponentRace: "Orks", opponentSubfaction: "Goffs", scenarioId: "alpha" });
  const reverse = factionMatchupMemoryKey({ race: "Orks", subfaction: "Goffs", opponentRace: "Imperium", opponentSubfaction: "Ultramarines", scenarioId: "alpha" });
  assert.notEqual(forward, reverse);
  assert.equal(learningConfidence(4), 0.5);
  for (const type of ["drop-pod-result", "territory-result", "defense-result", "specialist-effectiveness", "enemy-specialist-threat", "vehicle-matchup", "squad-performance", "ambush-result", "flank-result", "capture-unit-effectiveness", "building-loss", "enemy-composition", "battle-result"]) assert.ok(MEMORY_TYPES.includes(type));
  const profile = resolveFactionAIProfile({ race: "Imperium", faction: "Space Marines", subfaction: "Ultramarines" });
  const memory = createFactionLearningMemory(profile, null, { matchupKey: forward });
  assert.equal(memory.observe("enemy-composition", { dominantRole: "vehicle" }, { visible: false }), false);
  memory.observe("vehicle-matchup", { vehicleType: "Predator", enemyType: "Battlewagon", success: true }, { visible: true });
  const row = memory.evidenceFor("vehicle-matchup", "Predator->Battlewagon");
  const before = row.weight;
  memory.decayBetweenBattles();
  assert.equal(row.weight, before * 0.97);
  assert.equal(memory.toJSON().version, 2);
  assert.equal(memory.matchupKey, forward);
});

test("IndexedDB schema v2 exposes the dedicated factionMemory store and read/write API", async () => {
  assert.equal(SIMULATION_DATABASE_VERSION, 2);
  assert.ok(SIMULATION_DATABASE_STORES.includes("factionMemory"));
  const database = createSimulationDatabase(null);
  for (const method of ["saveFactionMemory", "loadFactionMemory", "loadAllFactionMemories", "clearFactionMemory"]) assert.equal(typeof database[method], "function");
  assert.equal(await database.loadFactionMemory("missing"), null);
  assert.deepEqual(await database.loadAllFactionMemories(), []);
});
