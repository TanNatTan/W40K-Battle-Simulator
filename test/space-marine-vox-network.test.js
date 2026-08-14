import test from "node:test";
import assert from "node:assert/strict";
import { FactionIntelSystem } from "../src/intelligence/FactionIntelSystem.js";
import { TacticalVoxNetwork, VOX_SCOPES } from "../src/intelligence/TacticalVoxNetwork.js";

test("scout contacts propagate over the battle-net without creating a responder dogpile", () => {
  const intel = new FactionIntelSystem();
  const vox = new TacticalVoxNetwork({ intelSystem: intel });
  const report = vox.publish({
    factionId: "marine",
    squadId: "scouts",
    sourceId: "scout-1",
    sourceRole: "Vanguard Infiltrator",
    type: "ENEMY_ASSAULT_APPROACH",
    scope: VOX_SCOPES.ASTARTES_BATTLE_NET,
    position: { x: 300, y: 220 },
    urgency: 0.75,
    requestedResponders: 2
  }, 5);
  assert.ok(report.confidence >= 0.88);
  const squads = [
    { id: "scouts", faction: "marine", center: { x: 290, y: 220 } },
    { id: "reserve", faction: "marine", center: { x: 340, y: 230 }, primaryRole: "reserve", readiness: 0.9 },
    { id: "defenders", faction: "marine", center: { x: 360, y: 250 }, orderType: "Defend Base", readiness: 0.95, objectiveImportance: 0.9 },
    { id: "far", faction: "marine", center: { x: 1000, y: 900 }, readiness: 1 }
  ];
  const responders = vox.selectSupportResponders(report, squads, { maxResponders: 2 });
  assert.ok(responders.length >= 1 && responders.length <= 2);
  assert.equal(responders[0].id, "reserve");
  assert.equal(responders.some(squad => squad.id === "far"), false);
  assert.equal(vox.publish({ ...report }, 5.5), null);
});
