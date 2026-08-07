export const FACTION_GAMEPLAY_BRANCHES = Object.freeze({
  Orks: Object.freeze({ economy: "scrap", builder: "Gretchin", systems: ["mob-growth", "waaagh-momentum", "strength-leadership", "nob-succession", "warboss-emergence", "looted-vehicles", "orkish-buildings"] }),
  Tyranids: Object.freeze({ economy: "biomass", builder: "Brood organism", systems: ["synapse", "instinctive-behavior", "broods", "infestation", "digestion-pools", "capillary-towers", "mycetic-deployment", "corpse-reclamation"] }),
  Necrons: Object.freeze({ economy: "energy", builder: "Canoptek construct", systems: ["reanimation", "tomb-awakening", "teleport-networks", "phase-retreat", "dynasty-protocols"] }),
  Tau: Object.freeze({ economy: "requisition", builder: "Earth caste engineer", systems: ["markerlight-coordination", "drone-networks", "long-range-doctrine", "battlesuit-support", "montka-kauyon"] }),
  "Imperial Guard": Object.freeze({ economy: "requisition", builder: "Combat engineer", systems: ["platoons", "artillery-doctrine", "trench-networks", "large-convoys", "commissar-morale", "regiment-differences"] }),
  "Space Marines": Object.freeze({ economy: "requisition", builder: "Techmarine", systems: ["drop-pods", "gene-seed-recovery", "chapter-doctrines", "elite-squads", "rapid-reaction", "heroic-leadership"] }),
  Chaos: Object.freeze({ economy: "faith", builder: "Cultist builder", systems: ["corruption", "daemon-summoning", "sacrifice", "legion-doctrines", "warp-instability"] })
});

export function factionGameplayFor(branch) {
  return FACTION_GAMEPLAY_BRANCHES[branch] || FACTION_GAMEPLAY_BRANCHES["Space Marines"];
}

export function createFactionGameplayState(branch) {
  const profile = factionGameplayFor(branch);
  return {
    branch,
    momentum: 0,
    corruption: 0,
    biomass: branch === "Tyranids" ? 24 : 0,
    reanimationCharge: branch === "Necrons" ? 1 : 0,
    markerlightLocks: 0,
    commandProtocol: branch === "Tau" ? "kauyon" : null,
    doctrine: profile.systems[0],
    events: []
  };
}

export function updateFactionGameplay(state, context = {}, dt = 1) {
  const elapsed = Math.max(0, Number(dt) || 0);
  if (state.branch === "Orks") {
    state.momentum = Math.max(0, Math.min(100, state.momentum + ((context.nearbyMob || 0) * 0.08 + (context.kills || 0) * 2 - (context.retreats || 0)) * elapsed));
    if (state.momentum >= 75) state.doctrine = "warboss-emergence";
  } else if (state.branch === "Tyranids") {
    state.biomass = Math.max(0, state.biomass + ((context.reclaimedCorpses || 0) * 3 - (context.spawnCost || 0)) * elapsed);
    state.doctrine = context.synapseCoverage < 0.4 ? "instinctive-behavior" : "synaptic-assault";
  } else if (state.branch === "Necrons") {
    state.reanimationCharge = Math.max(0, Math.min(1, state.reanimationCharge + (context.tombControl ? 0.02 : -0.01) * elapsed));
    state.doctrine = context.forceIntegrity < 0.25 ? "phase-retreat" : "dynasty-protocols";
  } else if (state.branch === "Tau") {
    state.markerlightLocks = Math.max(0, context.markerlightTargets || 0);
    state.commandProtocol = context.enemyClosing ? "montka" : "kauyon";
    state.doctrine = state.commandProtocol;
  } else if (state.branch === "Imperial Guard") {
    state.doctrine = context.entrenched ? "artillery-doctrine" : "platoon-advance";
  } else if (state.branch === "Space Marines") {
    state.doctrine = context.rapidResponseNeeded ? "rapid-reaction" : "chapter-doctrines";
  } else if (state.branch === "Chaos") {
    state.corruption = Math.max(0, Math.min(100, state.corruption + ((context.sacrifices || 0) * 4 + (context.ritualSites || 0) * 0.2 - (context.warpBacklash || 0) * 2) * elapsed));
    state.doctrine = state.corruption >= 60 ? "daemon-summoning" : "corruption";
  }
  return state;
}
