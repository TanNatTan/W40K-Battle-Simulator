import { isAstartesCoreMember } from "../ai/space-marines/SpaceMarineForceComposition.js";

export const GENE_SEED_RECOVERY_SECONDS = 2.5;
export const GENE_SEED_REINFORCEMENT_CHANCE = 0.3;

export function canGenerateGeneSeed(unit = {}) {
  return unit.alive !== true && isAstartesCoreMember(unit) && unit.role !== "vehicle" && !["builder", "supply"].includes(unit.role)
    && !/skull probe|servo.?skull/i.test(`${unit.specialty || ""} ${unit.name || ""}`);
}

export function createGeneSeedRecoveryState() {
  return { phase: "SEARCH", targetId: null, progress: 0, carried: 0, deposited: 0 };
}

export function selectGeneSeedCorpse(apothecary, features = [], distanceTo = (a, b) => Math.hypot((a.x || 0) - (b.x || 0), (a.y || 0) - (b.y || 0))) {
  return features.filter(feature => feature.geneSeed && !feature.geneSeedRecovered && feature.sourceFaction === apothecary.faction)
    .sort((left, right) => distanceTo(apothecary, left) - distanceTo(apothecary, right))[0] || null;
}

export function advanceGeneSeedRecovery(recovery, { apothecary, target, monastery, dt = 0, distanceTo, random = Math.random } = {}) {
  const state = recovery || createGeneSeedRecoveryState();
  if (state.carried > 0) {
    state.phase = "RETURN";
    if (!monastery || distanceTo(apothecary, monastery) > 18) return { state, action: "MOVE_TO_MONASTERY", target: monastery };
    state.deposited += state.carried;
    state.carried = 0;
    state.phase = "SEARCH";
    return { state, action: random() < GENE_SEED_REINFORCEMENT_CHANCE ? "CREATE_MARINE" : "DEPOSIT" };
  }
  if (!target) {
    state.phase = "SEARCH";
    state.targetId = null;
    state.progress = 0;
    return { state, action: "NONE" };
  }
  state.targetId = target.id;
  if (distanceTo(apothecary, target) > 10) {
    state.phase = "APPROACH";
    return { state, action: "MOVE_TO_CORPSE", target };
  }
  state.phase = "HARVEST";
  state.progress += dt;
  if (state.progress < GENE_SEED_RECOVERY_SECONDS) return { state, action: "HARVEST", target };
  state.progress = 0;
  state.carried = 1;
  state.targetId = null;
  target.geneSeedRecovered = true;
  return { state, action: "RECOVERED", target };
}
