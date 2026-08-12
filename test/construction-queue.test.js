import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  constructionLaborDemand,
  constructionQueueCapacity,
  constructionQueueSnapshot
} from "../src/construction/ConstructionQueueSystem.js";
import { builderWorkforceDemand } from "../src/construction/BuilderWorkforceSystem.js";
import { snapConstructionProgress } from "../src/construction/ConstructionSystem.js";

const marine = { id: "p1", race: "Imperium", faction: "Space Marines", subfaction: "Ultramarines" };
const complete = (id, type) => ({ id, type, faction: "p1", alive: true, progress: 1, hp: 100, maxHp: 100 });
const planned = (id, type, desiredBuilders) => ({
  id,
  type,
  faction: "p1",
  alive: true,
  progress: 0,
  desiredBuilders,
  construction: { state: "planned" }
});

test("a headquarters can approve parallel construction without checking builder availability", () => {
  const structures = [complete("hq", "outpost")];
  const queue = constructionQueueSnapshot({ player: marine, structures, claimedTerritoryCells: 8 });
  assert.equal(queue.capacity, 3);
  assert.equal(queue.available, 3);
  assert.equal(Object.hasOwn(queue, "builders"), false);
});

test("planned foundations create their full temporary labor demand", () => {
  const projects = [planned("power", "generator", 1), planned("barracks", "barracks", 2), planned("depot", "warehouse", 1)];
  assert.equal(constructionLaborDemand(projects), 4);
  const demand = builderWorkforceDemand({ player: marine, structures: [complete("hq", "outpost"), ...projects], activeProjects: projects });
  assert.equal(demand.caretakerRequirement, 1);
  assert.equal(demand.constructionDemand, 4);
  assert.equal(demand.desired, 7);
});

test("construction throughput compounds with completed infrastructure and territory", () => {
  const opening = constructionQueueCapacity({ player: marine, structures: [complete("hq", "outpost")], claimedTerritoryCells: 8 });
  const established = constructionQueueCapacity({
    player: marine,
    structures: [
      complete("hq", "outpost"), complete("a", "generator"), complete("b", "barracks"),
      complete("c", "warehouse"), complete("d", "workshop"), complete("e", "refinery"),
      complete("f", "fieldhospital"), complete("g", "researchcenter"), complete("h", "bunker")
    ],
    claimedTerritoryCells: 22
  });
  assert.ok(established.capacity > opening.capacity, `${established.capacity} should exceed ${opening.capacity}`);
});

test("runtime planning precedes workforce response and builders only execute projects", async () => {
  const source = await readFile(new URL("../js/app.js", import.meta.url), "utf8");
  const economyTick = source.slice(source.indexOf("function economyTick"), source.indexOf("function updateTradeRoutes"));
  assert.ok(economyTick.indexOf("planFactionConstruction(player)") < economyTick.indexOf("refreshBuilderWorkforce(player)"));
  assert.match(source, /construction\.state = "planned"/);
  assert.match(source, /leadBuilderId: null/);
  assert.doesNotMatch(source, /tryStartBuilderConstruction/);
});

test("visually complete construction cannot strand a queue slot below one", () => {
  assert.equal(snapConstructionProgress(0.994), 0.994);
  assert.equal(snapConstructionProgress(0.995), 1);
  assert.equal(snapConstructionProgress(0.9977188753779695), 1);
});
