import assert from "node:assert/strict";
import test from "node:test";

import { QUALITY_PROFILES, detectQuality, qualityProfile, qualityRenderInterval, vegetationPpuFor } from "../src/performance/QualityProfile.js";

test("profiles get cheaper from high to low", () => {
  const { low, balanced, high } = QUALITY_PROFILES;
  assert.ok(low.renderScale < balanced.renderScale && balanced.renderScale < high.renderScale);
  assert.ok(low.maxFps < balanced.maxFps && balanced.maxFps < high.maxFps);
  assert.ok(low.vegetationPpu < balanced.vegetationPpu && balanced.vegetationPpu < high.vegetationPpu);
  assert.ok(low.simBudgetMs <= balanced.simBudgetMs);
  assert.ok(low.rigZoom > balanced.rigZoom && balanced.rigZoom > high.rigZoom, "weaker profiles switch to part rigs later");
  assert.equal(qualityProfile("nonsense").id, "balanced");
});

test("hardware hints pick a starting profile", () => {
  assert.equal(detectQuality({ cores: 2, memoryGb: 4 }), "low");
  assert.equal(detectQuality({ cores: 16, memoryGb: 2 }), "low");
  assert.equal(detectQuality({ cores: 16, memoryGb: 16, softwareRenderer: true }), "low");
  assert.equal(detectQuality({ cores: 8, memoryGb: 16, saveData: true }), "low");
  assert.equal(detectQuality({ cores: 4, memoryGb: 8 }), "balanced");
  assert.equal(detectQuality({ cores: 12, memoryGb: 16 }), "high");
  assert.equal(detectQuality({}), "balanced");
});

test("vegetation detail follows zoom but never exceeds the profile", () => {
  assert.equal(vegetationPpuFor(0.2, QUALITY_PROFILES.high), 0.5);
  assert.equal(vegetationPpuFor(2, QUALITY_PROFILES.high), 1.5);
  assert.equal(vegetationPpuFor(2, QUALITY_PROFILES.low), 0.75);
  assert.ok(vegetationPpuFor(0.5, QUALITY_PROFILES.low) <= 0.75);
});

test("the frame-rate cap only ever lengthens the interval", () => {
  assert.equal(qualityRenderInterval(1 / 10, QUALITY_PROFILES.high), 1 / 10);
  assert.equal(qualityRenderInterval(1 / 60, QUALITY_PROFILES.low), 1 / 20);
});
