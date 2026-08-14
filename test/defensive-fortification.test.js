import test from "node:test";
import assert from "node:assert/strict";
import { chooseFortification, scoreFortificationSite } from "../src/construction/DefensiveFortificationSystem.js";

test("fortifications respond to threat, chokepoints, objectives, and chapter doctrine", () => {
  const fort = chooseFortification({ threat: 0.9, chokePointValue: 0.8, objectiveValue: 0.75, supplyConnection: true });
  assert.equal(fort.type.id, "fort");
  const listeningPost = chooseFortification({ threat: 0.25, highGroundValue: 0.72, intelNeed: 0.7 });
  assert.equal(listeningPost.type.buildingType, "observationtower");
  const ordinary = scoreFortificationSite({ chokePointValue: 0.7, objectiveValue: 0.6 });
  const fists = scoreFortificationSite({ chokePointValue: 0.7, objectiveValue: 0.6 }, { subfaction: "Imperial Fists" });
  assert.ok(fists > ordinary);
});
