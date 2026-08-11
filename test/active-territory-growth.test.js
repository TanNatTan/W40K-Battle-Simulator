import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  ACTIVE_FORCE_ROLES,
  desiredActiveForceRatio,
  enforceActiveForceRatio
} from "../src/ai/ActiveForceSystem.js";
import {
  TERRITORY_BUILD_CAPS,
  constructionCapacityForCell
} from "../src/territory/TerritoryConstructionSystem.js";

test("active armies keep 50-82% of ready squads in field roles outside emergencies", () => {
  assert.equal(desiredActiveForceRatio({}, { aggression: 0, expansion: 0 }), 0.5);
  assert.equal(desiredActiveForceRatio({}, { aggression: 100, expansion: 100 }), 0.82);
  assert.ok(
    desiredActiveForceRatio({ subfaction: "Speed Freeks" }, { aggression: 55, expansion: 55 })
      > desiredActiveForceRatio({ subfaction: "Imperial Fists" }, { aggression: 55, expansion: 55 })
  );

  const squads = Array.from({ length: 10 }, (_, index) => ({
    id: `s${index}`,
    readiness: 0.9,
    primaryRole: index === 0 ? "base-defense" : "reserve"
  }));
  const plan = enforceActiveForceRatio({
    player: { subfaction: "Ultramarines" },
    behavior: { aggression: 60, expansion: 60, caution: 50 },
    squads,
    preserveBaseDefense: 1
  });
  assert.ok(plan.active >= plan.required);
  assert.equal(plan.assignments.get("s0"), undefined);
  assert.ok([...plan.assignments.values()].every(role => ACTIVE_FORCE_ROLES.has(role)));

  const emergency = enforceActiveForceRatio({
    player: {},
    behavior: { aggression: 80, expansion: 80 },
    squads,
    baseThreat: 0.8
  });
  assert.equal(emergency.converted.length, 0);
});

test("captured cells cap military and production foundations but not defenses", () => {
  assert.deepEqual(TERRITORY_BUILD_CAPS, {
    "military-production": 5,
    production: 8,
    defense: Infinity,
    hq: Infinity
  });
  const specs = {
    barracks: { capacityClass: "military-production" },
    generator: { capacityClass: "production" },
    bunker: { capacityClass: "defense" }
  };
  const make = (type, index, cellKey = "2,3") => ({
    type,
    faction: "a",
    cellKey,
    progress: index === 0 ? 0 : 1,
    alive: true
  });
  const structures = [
    ...Array.from({ length: 5 }, (_, index) => make("barracks", index)),
    ...Array.from({ length: 8 }, (_, index) => make("generator", index)),
    ...Array.from({ length: 40 }, (_, index) => make("bunker", index))
  ];
  const capacity = type => constructionCapacityForCell({
    type,
    spec: specs[type],
    structures,
    faction: "a",
    cellKey: "2,3",
    cellKeyFor: structure => structure.cellKey,
    specFor: buildingType => specs[buildingType]
  });
  assert.equal(capacity("barracks").available, false);
  assert.equal(capacity("barracks").count, 5);
  assert.equal(capacity("generator").available, false);
  assert.equal(capacity("generator").count, 8);
  assert.equal(capacity("bunker").available, true);
  assert.equal(capacity("bunker").count, 40);
});

test("map editor omits anchors while runtime capture and per-cell growth remain", () => {
  const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const app = fs.readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
  assert.doesNotMatch(html, /Territory anchors|awt-territory-controls|data-editor-tool-target="territory"/);
  assert.doesNotMatch(app, /maxStructures|allowedStructures|selectedTerritoryId|territoryEditMode/);
  assert.match(app, /territoryTick\(\)/);
  assert.match(app, /transferTerritoryCell\(/);
  assert.match(app, /Captured by a physically present combat force/);
  assert.match(app, /kind: "territory-cell"/);
  assert.match(app, /constructionCapacityForCell\(/);
  assert.match(app, /capacityClass: "military-production"/);
  assert.match(app, /capacityClass: "production"/);
  assert.match(app, /capacityClass: "defense"/);
  assert.match(app, /Holding — Ordered/);
  assert.match(app, /Stalled — Navigation recovery/);
});
