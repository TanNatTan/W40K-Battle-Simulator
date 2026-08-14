import test from "node:test";
import assert from "node:assert/strict";
import { opticalDetection, SPACE_MARINE_OPTICAL_PROFILE } from "../src/intelligence/DirectionalVisionSystem.js";
import { auspexContact, markActiveScan } from "../src/intelligence/AuspexSystem.js";

test("Astartes optical vision has central, peripheral, and rear blind arcs", () => {
  const marine = { x: 0, y: 0, facing: 0, range: 140, isSpaceMarine: true };
  const front = opticalDetection(marine, { x: 100, y: 0 }, { profile: SPACE_MARINE_OPTICAL_PROFILE, range: 140 });
  const peripheral = opticalDetection(marine, { x: 30, y: 70 }, { profile: SPACE_MARINE_OPTICAL_PROFILE, range: 140 });
  const rear = opticalDetection(marine, { x: -30, y: 0 }, { profile: SPACE_MARINE_OPTICAL_PROFILE, range: 140 });
  assert.equal(front.arc, "central");
  assert.equal(front.detected, true);
  assert.equal(peripheral.arc, "peripheral");
  assert.equal(rear.arc, "blind");
  assert.equal(rear.detected, false);
});

test("Auspex supplies coarse passive contacts and longer active scans without health leakage", () => {
  const marine = { name: "Vanguard Infiltrator", x: 0, y: 0 };
  const hidden = { id: "enemy", x: 135, y: 0, role: "trooper", camouflage: 0.7, hp: 3, vx: 8 };
  assert.equal(auspexContact(marine, hidden, { active: false }).detected, false);
  const active = auspexContact(marine, hidden, { active: true, materialTransmission: 0.9 });
  assert.equal(active.detected, true);
  assert.equal(Object.hasOwn(active, "hp"), false);
  assert.ok(active.uncertaintyRadius > 0);
  assert.equal(markActiveScan(marine, 10), 17);
});
