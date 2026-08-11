import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  builderProducerFor,
  builderProductionPriority,
  builderProductionProfileFor,
  desiredBuilderCount
} from "../src/construction/BuilderProductionSystem.js";
import {
  constrainPointToSpawnZone,
  structureFitsInsideSpawnZone,
  unitFitsInsideSpawnZone
} from "../src/construction/BuilderContainmentSystem.js";
import {
  EMERALD_SUNS,
  applyChapterBattleAdaptation,
  chapterMedicalModifiersFor,
  chapterVisualDefaultsFor
} from "../src/ai/SpaceMarineChapterSystem.js";

const players = {
  marines: { id: "sm", race: "Imperium", faction: "Space Marines", subfaction: "Emerald Suns" },
  guard: { id: "ig", race: "Imperium", faction: "Imperial Guard" },
  mechanicus: { id: "admech", race: "Imperium", faction: "Machine Cult" },
  orks: { id: "orks", race: "Orks", faction: "Redfang Horde" },
  necrons: { id: "necrons", race: "Necrons", faction: "Dynastic Host" },
  tau: { id: "tau", race: "T'au", faction: "Frontier Cadre" },
  tyranids: { id: "nids", race: "Tyranids", faction: "Hive Fleet" }
};

test("each faction trains builders from its authored producer instead of squad production", () => {
  assert.deepEqual(builderProductionProfileFor(players.marines).producerTypes, ["outpost"]);
  assert.deepEqual(builderProductionProfileFor(players.guard).producerTypes, ["outpost", "barracks"]);
  assert.deepEqual(builderProductionProfileFor(players.mechanicus).producerTypes, ["outpost", "workshop"]);
  assert.deepEqual(builderProductionProfileFor(players.orks).producerTypes, ["barracks"]);
  assert.deepEqual(builderProductionProfileFor(players.tau).producerTypes, ["workshop"]);
  assert.deepEqual(builderProductionProfileFor(players.tyranids).producerTypes, ["barracks"]);
  const structures = [
    { id: "hq", faction: "orks", type: "outpost", progress: 1, condition: 1 },
    { id: "hut", faction: "orks", type: "barracks", progress: 1, condition: 0.8 }
  ];
  assert.equal(builderProducerFor(players.orks, structures)?.id, "hut");
  assert.equal(builderProductionPriority(0, 6), 100);
  assert.equal(builderProductionPriority(3, 6) >= 84, true);
  assert.equal(builderProductionPriority(6, 6), 0);
});

test("builder targets scale from 2-4 normally and 6-8 for Orks and Necrons", () => {
  const structures = Array.from({ length: 20 }, (_, index) => ({ faction: "sm", progress: 1, alive: true, id: index }));
  assert.equal(desiredBuilderCount(players.marines, structures, 2), 4);
  assert.equal(desiredBuilderCount(players.orks, structures.map(item => ({ ...item, faction: "orks" })), 6), 8);
  assert.equal(desiredBuilderCount(players.necrons, [], 2), 6);
});

test("builder movement and complete building footprints stay inside an authored spawn zone", () => {
  const center = { x: 100, y: 100 };
  const contains = point => Math.hypot(point.x - center.x, point.y - center.y) <= 80;
  assert.equal(unitFitsInsideSpawnZone({ x: 172, y: 100 }, 6, contains), true);
  assert.equal(unitFitsInsideSpawnZone({ x: 178, y: 100 }, 6, contains), false);
  assert.equal(structureFitsInsideSpawnZone({ x: 100, y: 100 }, { w: 40, h: 32 }, 12, contains), true);
  assert.equal(structureFitsInsideSpawnZone({ x: 166, y: 100 }, { w: 40, h: 32 }, 12, contains), false);
  const constrained = constrainPointToSpawnZone({ x: 240, y: 100 }, center, 6, contains);
  assert.ok(constrained.x < 175 && constrained.x > 170);
  assert.equal(unitFitsInsideSpawnZone(constrained, 6, contains), true);
});

test("Emerald Suns use emerald-gold-white identity and controlled escalation", () => {
  assert.deepEqual(chapterVisualDefaultsFor(players.marines), EMERALD_SUNS.colors);
  assert.equal(chapterMedicalModifiersFor(players.marines).geneSeedPriority, 1.35);
  const measured = applyChapterBattleAdaptation(players.marines, { aggression: 54, caution: 72, expansion: 51, economy: 61 }, { enemyAverageCondition: 0.9, enemySupplyCritical: false });
  const finishing = applyChapterBattleAdaptation(players.marines, { aggression: 54, caution: 72, expansion: 51, economy: 61 }, { enemyAverageCondition: 0.18, enemySupplyCritical: true });
  assert.ok(finishing.aggression > measured.aggression);
  assert.ok(finishing.caution < measured.caution);
  assert.ok(finishing.expansion > measured.expansion);
});

test("browser composition includes builder queues, containment, and Emerald Suns selection", async () => {
  const app = await readFile(new URL("../js/app.js", import.meta.url), "utf8");
  assert.match(app, /"Emerald Suns"/);
  assert.match(app, /"train-builder"/);
  assert.match(app, /updateBuilderProduction\(player\)/);
  assert.match(app, /structureFitsInsideSpawnZone/);
  assert.match(app, /recoverBuilderInsideSpawnZone/);
  assert.match(app, /builderTaskPointAllowed/);
});

