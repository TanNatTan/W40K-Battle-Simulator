import test from "node:test";
import assert from "node:assert/strict";

import { PLAYER_IDS, ZOOM_STOPS } from "../src/config/application.js";
import {
  aiConfig,
  economyConfig,
  environmentConfig,
  factionConfig,
  unitSpriteForge
} from "../src/config/runtime-config.js";
import { formatElapsed } from "../src/utilities/format.js";
import { clamp, distance } from "../src/utilities/math.js";
import { seededRandom } from "../src/utilities/random.js";
import { NavigationPlanner } from "../src/map/NavigationPlanner.js";

test("foundation configuration exports are available and immutable", () => {
  assert.equal(PLAYER_IDS.length, 12);
  assert.equal(ZOOM_STOPS.at(-1), 4);
  assert.ok(Object.isFrozen(aiConfig));
  assert.ok(Object.isFrozen(economyConfig));
  assert.ok(Object.isFrozen(environmentConfig));
  assert.ok(Object.isFrozen(factionConfig));
  assert.equal(typeof unitSpriteForge.draw, "function");
});

test("shared math and formatting utilities preserve runtime behavior", () => {
  assert.equal(clamp(14, 0, 10), 10);
  assert.equal(distance({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
  assert.equal(formatElapsed(125), "02:05");
});

test("seeded random sequences are deterministic", () => {
  const left = seededRandom("AWT-TEST");
  const right = seededRandom("AWT-TEST");
  assert.deepEqual([left(), left(), left()], [right(), right(), right()]);
});

test("navigation planner routes autonomous units around blocked cells", () => {
  const planner = new NavigationPlanner({ cellSize: 10, maxVisited: 500 });
  const blocked = new Set(["2,0", "2,1", "2,2", "2,3"]);
  const path = planner.findPath({
    start: { x: 5, y: 5 },
    goal: { x: 45, y: 5 },
    isPassable: point => !blocked.has(`${Math.floor(point.x / 10)},${Math.floor(point.y / 10)}`)
  });
  assert.ok(path.length > 1);
  assert.ok(path.some(point => point.y >= 45 || point.y < 0));
  assert.deepEqual(path.at(-1), { x: 45, y: 5 });
});
