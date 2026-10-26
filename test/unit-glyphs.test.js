import assert from "node:assert/strict";
import test from "node:test";

import { GLYPH_KINDS, GLYPH_LEGEND, glyphKind, glyphRadius, glyphScale, traceGlyph, pickGlyph } from "../src/rendering/UnitGlyphs.js";

class RecordingPath {
  constructor() { this.points = []; this.arcs = 0; }
  moveTo(x, y) { this.points.push([x, y]); }
  lineTo(x, y) { this.points.push([x, y]); }
  arc(x, y, r) { this.arcs += 1; this.points.push([x + r, y], [x - r, y], [x, y + r], [x, y - r]); }
  closePath() {}
}

test("every role maps to a shape and every shape is in the legend", () => {
  const kinds = new Set(Object.values(GLYPH_KINDS));
  for (const kind of kinds) assert.ok(GLYPH_LEGEND.some(entry => entry.kind === kind), `${kind} has a legend entry`);
  assert.equal(glyphKind("trooper"), "circle");
  assert.equal(glyphKind("vehicle"), "tank");
  assert.equal(glyphKind("something-new"), "circle", "unknown roles fall back to a circle");
  assert.equal(new Set(GLYPH_LEGEND.map(entry => entry.kind)).size, GLYPH_LEGEND.length);
});

test("roles that act differently look different", () => {
  const shapes = ["trooper", "scout", "commander", "standard", "medic", "builder", "supply", "vehicle", "aircraft"].map(glyphKind);
  assert.equal(new Set(shapes).size, shapes.length);
});

test("traced geometry is centred on the unit and rotates with facing", () => {
  for (const kind of GLYPH_LEGEND.map(entry => entry.kind)) {
    const path = new RecordingPath();
    traceGlyph(path, kind, 100, 50, 0, 1);
    assert.ok(path.points.length >= 3, kind);
    const xs = path.points.map(point => point[0]);
    const ys = path.points.map(point => point[1]);
    assert.ok(Math.min(...xs) < 100 && Math.max(...xs) > 100, `${kind} straddles x`);
    assert.ok(Math.min(...ys) < 50 && Math.max(...ys) > 50, `${kind} straddles y`);
  }
  const east = new RecordingPath();
  const south = new RecordingPath();
  traceGlyph(east, "tank", 0, 0, 0, 1);
  traceGlyph(south, "tank", 0, 0, Math.PI / 2, 1);
  const reach = path => Math.max(...path.points.map(point => point[0]));
  assert.ok(reach(east) > 14, "barrel points east");
  assert.ok(reach(south) < 10, "facing south the barrel is not east");
});

test("markers stay readable when zoomed out but never shrink below the unit's own size", () => {
  assert.ok(glyphScale("circle", 1, 0.2) <= 3);
  assert.equal(glyphScale("circle", 1, 2), 1);
  assert.ok(glyphScale("circle", 1, 0.5) * glyphRadius("circle") * 0.5 >= 4.4, "at least ~4.5px on screen");
  assert.ok(glyphScale("tank", 1.2, 1) >= 1.2);
});

test("picking chooses the unit nearest the pointer relative to its size, and ignores far ones", () => {
  const units = [
    { id: "a", x: 100, y: 100, role: "trooper" },
    { id: "b", x: 110, y: 100, role: "trooper" },
    { id: "tank", x: 140, y: 100, role: "vehicle" }
  ];
  assert.equal(pickGlyph(units, { x: 103, y: 100 }, 12).id, "a");
  assert.equal(pickGlyph(units, { x: 109, y: 101 }, 12).id, "b");
  assert.equal(pickGlyph(units, { x: 150, y: 100 }, 12).id, "tank");
  assert.equal(pickGlyph(units, { x: 400, y: 400 }, 12), null);
});
