import test from "node:test";
import assert from "node:assert/strict";
import { probableSniperOrigin, revealFromWeaponFire, sniperTacticalDecision, stealthProfileFor, stealthStateFor } from "../src/intelligence/StealthSystem.js";

test("camouflaged snipers reveal a probable origin when firing and relocate after counter-detection", () => {
  const sniper = { id: "elim-1", name: "Eliminator Sniper", role: "sniper", x: 44, y: 72, camouflage: 0.72, range: 210 };
  const concealed = stealthStateFor(sniper, { profile: stealthProfileFor(sniper), cover: 0.8, moving: false, now: 0 });
  assert.notEqual(concealed.state, "EXPOSED");
  revealFromWeaponFire(sniper, 10, 5);
  assert.equal(stealthStateFor(sniper, { cover: 0.8, now: 11 }).state, "EXPOSED");
  const marker = probableSniperOrigin(sniper, 10);
  assert.equal(marker.confidence, 0.64);
  assert.equal(marker.uncertaintyRadius, 55);
  assert.equal(sniperTacticalDecision(sniper, { now: 11, counterDetection: 0.8, relocationPoint: { x: 90, y: 40 } }).action, "RELOCATE");
});
