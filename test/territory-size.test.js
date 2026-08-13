import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  STRATEGIC_TERRITORY_MAX_CELLS,
  STRATEGIC_TERRITORY_MIN_CELLS,
  STRATEGIC_TERRITORY_TARGET_AREA,
  TERRITORY_AREA_SCALE,
  TERRITORY_CELL_SIZE
} from "../src/config/application.js";

test("territory cells provide twice the former usable area", () => {
  const previousCellArea = 96 ** 2;
  const areaRatio = TERRITORY_CELL_SIZE ** 2 / previousCellArea;
  assert.equal(TERRITORY_AREA_SCALE, 2);
  assert.ok(Math.abs(areaRatio - 2) < 0.02);
  assert.equal(STRATEGIC_TERRITORY_TARGET_AREA, 52000);
  assert.equal(STRATEGIC_TERRITORY_MIN_CELLS, 24);
  assert.equal(STRATEGIC_TERRITORY_MAX_CELLS, 60);
});

test("runtime builds the irregular territory pool at the doubled area density", () => {
  const source = fs.readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
  assert.match(source, /worldWidth\(\) \* worldHeight\(\) \/ STRATEGIC_TERRITORY_TARGET_AREA/);
  assert.match(source, /STRATEGIC_TERRITORY_MIN_CELLS/);
  assert.match(source, /STRATEGIC_TERRITORY_MAX_CELLS/);
});
