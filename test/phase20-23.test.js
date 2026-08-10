import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { assessFactionCapability, chooseEndgameDirective, ENDGAME_ACTIONS } from "../src/victory/VictorySystem.js";
import { ReplayAnalysisSystem, buildAIInspector } from "../src/replay/ReplayAnalysisSystem.js";
import { ObjectPool, SCALE_PRESETS, scalePresetFor, shouldUpdateEntity, statisticalDistantCombat } from "../src/performance/ScaleSystem.js";
import { FACTION_GAMEPLAY_BRANCHES, createFactionGameplayState, updateFactionGameplay } from "../src/factions/DistinctiveGameplaySystem.js";

test("Phase 20 requires all five annihilation conditions rather than headquarters loss", () => {
  const units = [
    { id: "soldier", faction: "red", alive: true, damage: 10, ammo: 4, role: "trooper" },
    { id: "builder", faction: "red", alive: true, role: "builder", buildResources: 1 },
    { id: "ally", faction: "ally", alive: true, damage: 8, ammo: 3, role: "trooper" }
  ];
  const structures = [{ id: "barracks", faction: "red", type: "barracks", alive: true, progress: 1, condition: 1 }];
  const access = [{ id: "edge-route", faction: "red", active: true, condition: 1 }];
  const isAllied = (first, second) => new Set([first, second]).has("ally") && new Set([first, second]).has("red");
  const operational = assessFactionCapability({ factionId: "red", units, structures, reinforcementAccess: access, isAllied });
  assert.equal(operational.defeated, false);
  assert.deepEqual(operational.counts, { combatForces: 1, production: 1, reinforcementAccess: 1, recoveryBuilders: 1, alliedRescue: 1 });

  const rescued = assessFactionCapability({ factionId: "red", units: [units[2]], structures: [], reinforcementAccess: [], isAllied });
  assert.equal(rescued.defeated, false);
  assert.equal(rescued.conditions.noAlliedRescueForce, false);
  const annihilated = assessFactionCapability({ factionId: "red", units: [], structures: [], reinforcementAccess: [], isAllied });
  assert.equal(annihilated.defeated, true);
  assert.ok(Object.values(annihilated.conditions).every(Boolean));
});

test("Phase 20 selects active endgame work instead of stopping after a headquarters", () => {
  const survivor = { id: "survivor", x: 20, y: 30 };
  assert.equal(chooseEndgameDirective({ race: "Orks", visibleSurvivors: [survivor] }).action, "hunt-survivors");
  assert.equal(chooseEndgameDirective({ knownProduction: [{ id: "factory" }] }).action, "destroy-production");
  assert.equal(chooseEndgameDirective({ extractionAccess: [{ id: "spaceport" }] }).action, "block-extraction");
  assert.equal(chooseEndgameDirective({ fogSearchPoints: [{ id: "sector" }] }).action, "search-fog");
  assert.equal(chooseEndgameDirective({ incapacitatedThreats: [{ id: "casualty" }], race: "Tyranids" }).policy, "consume-biomass");
  assert.equal(new Set(ENDGAME_ACTIONS).size, 6);
});

test("Phase 21 replays, seeks event markers, and explains AI decisions", () => {
  const replay = new ReplayAnalysisSystem({ maxSnapshots: 4 });
  for (let index = 0; index < 6; index += 1) replay.recordSnapshot({ t: index * 10, units: [{ id: "u", x: index }] });
  assert.equal(replay.snapshots.length, 4);
  replay.recordEvent({ id: "battle", t: 31, type: "battle" });
  assert.equal(replay.jumpToEvent("battle").t, 30);
  assert.equal(replay.rewind().t, 20);
  assert.equal(replay.fastForward().t, 30);
  replay.play(4);
  assert.equal(replay.playing, true);
  replay.pause();
  assert.equal(replay.playing, false);
  const inspection = buildAIInspector({
    player: { factionAIChoice: "attack" },
    plan: { name: "Purge", method: "combined-arms" },
    decision: { choice: "attack", scores: { attack: 90, defend: 55, logistics: 40 } },
    context: { enemyPressure: 0.7 }
  });
  assert.equal(inspection.currentGoal, "Purge");
  assert.equal(inspection.threatEstimate, 0.7);
  assert.equal(inspection.alternatives[0].name, "defend");
  assert.ok(inspection.confidence > 0);
});

test("Phase 21 and 22 browser UI exposes replay, AI inspector, and scale controls", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  for (const id of ["awt-replay-rewind", "awt-replay-play", "awt-replay-forward", "awt-replay-live", "awt-ai-goal", "awt-ai-utilities", "awt-ai-confidence", "awt-scale-preset"]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
});

test("Phase 22 scales thousands of distant units and preserves critical updates", () => {
  assert.deepEqual(Object.keys(SCALE_PRESETS), ["skirmish", "battle", "major", "total"]);
  const preset = scalePresetFor(3000);
  assert.equal(preset.id, "total");
  const scheduled = Array.from({ length: 3000 }, (_, index) => shouldUpdateEntity({ index, frame: 5, distanceFromCamera: 5000, preset }));
  assert.ok(scheduled.filter(Boolean).length <= 310);
  const engaged = Array.from({ length: 3000 }, (_, index) => shouldUpdateEntity({ index, frame: 5, distanceFromCamera: 5000, engaged: true, preset }));
  assert.ok(engaged.filter(Boolean).length > scheduled.filter(Boolean).length);
  assert.ok(engaged.filter(Boolean).length <= 610);
  assert.equal(shouldUpdateEntity({ index: 1, frame: 1, distanceFromCamera: 5000, critical: true, preset }), true);
  const first = { faction: "a", alive: true, hp: 100, damage: 10, accuracy: 1, morale: 1 };
  const second = { faction: "b", alive: true, hp: 100, damage: 8, accuracy: 1, morale: 1 };
  assert.ok(statisticalDistantCombat(first, second, 5, () => 0.5).firstLoss > 0);
  const pool = new ObjectPool(() => ({ id: Math.random(), active: false }), value => { value.active = false; });
  const pooled = pool.acquire();
  pooled.active = true;
  assert.equal(pool.release(pooled), true);
  assert.strictEqual(pool.acquire(), pooled);
});

test("Phase 23 exposes every distinctive race branch and changes runtime doctrine", () => {
  const required = {
    Orks: ["mob-growth", "waaagh-momentum", "nob-succession", "looted-vehicles"],
    Tyranids: ["synapse", "infestation", "digestion-pools", "corpse-reclamation"],
    Necrons: ["reanimation", "tomb-awakening", "teleport-networks", "phase-retreat"],
    Tau: ["markerlight-coordination", "drone-networks", "montka-kauyon"],
    "Imperial Guard": ["platoons", "artillery-doctrine", "trench-networks", "commissar-morale"],
    "Space Marines": ["drop-pods", "gene-seed-recovery", "chapter-doctrines", "rapid-reaction"],
    Chaos: ["corruption", "daemon-summoning", "sacrifice", "warp-instability"]
  };
  for (const [branch, systems] of Object.entries(required)) {
    assert.ok(systems.every(system => FACTION_GAMEPLAY_BRANCHES[branch].systems.includes(system)));
  }
  const orks = updateFactionGameplay(createFactionGameplayState("Orks"), { nearbyMob: 20, kills: 4 }, 4);
  assert.ok(orks.momentum > 0);
  const tyranids = updateFactionGameplay(createFactionGameplayState("Tyranids"), { reclaimedCorpses: 3, synapseCoverage: 0.2 }, 1);
  assert.equal(tyranids.doctrine, "instinctive-behavior");
  const necrons = updateFactionGameplay(createFactionGameplayState("Necrons"), { forceIntegrity: 0.1 }, 1);
  assert.equal(necrons.doctrine, "phase-retreat");
  const tau = updateFactionGameplay(createFactionGameplayState("Tau"), { enemyClosing: true, markerlightTargets: 3 }, 1);
  assert.equal(tau.commandProtocol, "montka");
  const chaos = updateFactionGameplay(createFactionGameplayState("Chaos"), { sacrifices: 20 }, 1);
  assert.ok(chaos.corruption >= 60);
  assert.equal(chaos.doctrine, "daemon-summoning");
});
