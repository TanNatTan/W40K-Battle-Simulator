const clamp = (value, minimum = 0, maximum = 1) => Math.max(minimum, Math.min(maximum, Number(value) || 0));

const action = (id, purpose, bias = {}, requirements = {}) => Object.freeze({ id, purpose, bias: Object.freeze(bias), requirements: Object.freeze(requirements) });

export const CHAOS_ACTION_CATALOG = Object.freeze({
  spear_tip_assault: action("spear_tip_assault", "Commit elite reserves against the objective", { attack: 1.35, logistics: 0.8 }, { glory: 0.12 }),
  decapitation_strike: action("decapitation_strike", "Destroy enemy command capability", { attack: 1.28, expand: 0.82 }, { intelligence: 0.45 }),
  black_crusade_reserve: action("black_crusade_reserve", "Hold a combined-arms reserve for the decisive axis", { defend: 1.18, attack: 1.12 }),
  prepare_battery: action("prepare_battery", "Prepare siege batteries before committing", { logistics: 1.35, attack: 0.84 }),
  build_siege_line: action("build_siege_line", "Construct a protected siege approach", { defend: 1.32, logistics: 1.22 }),
  create_breach: action("create_breach", "Concentrate fire on a fortification breach", { attack: 1.4, defend: 0.7 }, { breach: 0.35 }),
  fortify_captured_ground: action("fortify_captured_ground", "Turn captured ground into a siege anchor", { defend: 1.42, expand: 1.08 }),
  establish_ritual_site: action("establish_ritual_site", "Prepare an objective-linked ritual site", { research: 1.35, defend: 1.18 }),
  feed_ritual: action("feed_ritual", "Convert sacrifice and favor into ritual charge", { research: 1.45, logistics: 1.12 }, { sacrificeValue: 0.08 }),
  summon_daemon_reserve: action("summon_daemon_reserve", "Release the daemon reserve onto the objective", { attack: 1.55, expand: 1.14 }, { ritualCharge: 0.62, daemonReservePower: 0.2 }),
  corrupt_landmark: action("corrupt_landmark", "Corrupt a strategic landmark and its routes", { expand: 1.4, logistics: 1.1 }, { corruption: 0.2 }),
  isolate_target: action("isolate_target", "Separate a vulnerable formation from support", { attack: 1.18, expand: 1.22 }, { intelligence: 0.35 }),
  terror_raid: action("terror_raid", "Collapse morale with a short violent raid", { attack: 1.32, regroup: 0.65 }, { fearPressure: 0.18 }),
  block_retreat: action("block_retreat", "Occupy withdrawal routes before contact", { expand: 1.3, logistics: 1.12 }),
  hunt_routed_target: action("hunt_routed_target", "Destroy a routed enemy before it rallies", { attack: 1.48, defend: 0.62 }, { fearPressure: 0.35 }),
  create_feint: action("create_feint", "Create false pressure away from the real objective", { expand: 1.26, attack: 0.9 }),
  infiltrate: action("infiltrate", "Place hidden assets near a route or objective", { expand: 1.32, research: 1.1 }, { intelligence: 0.42 }),
  sabotage: action("sabotage", "Disable exposed production or logistics", { logistics: 1.28, attack: 1.1 }, { intelligence: 0.5 }),
  strike_revealed_weakness: action("strike_revealed_weakness", "Exploit a weakness confirmed by deception", { attack: 1.5, expand: 1.05 }, { intelligence: 0.65 }),
  perfect_kill: action("perfect_kill", "Focus the most prestigious visible target", { attack: 1.36, research: 0.72 }, { glory: 0.18 }),
  sonic_overload: action("sonic_overload", "Disrupt a defended position with sonic pressure", { attack: 1.24, defend: 0.82 }),
  excess_pursuit: action("excess_pursuit", "Exploit an enemy collapse at extreme speed", { attack: 1.5, expand: 1.18 }, { glory: 0.32 }),
  blood_charge: action("blood_charge", "Commit assault formations to lethal contact", { attack: 1.58, defend: 0.4 }),
  claim_skulls: action("claim_skulls", "Hunt combat-capable survivors for the Blood God", { attack: 1.5, expand: 1.05 }, { favorKhorne: 0.18 }),
  blood_tithe_reinforcement: action("blood_tithe_reinforcement", "Spend blood tithe on fresh assault power", { attack: 1.4, logistics: 0.76 }, { favorKhorne: 0.5 }),
  contagion_front: action("contagion_front", "Advance a persistent contagion front", { expand: 1.3, defend: 1.2 }, { corruption: 0.12 }),
  attrition_grind: action("attrition_grind", "Win through durable sustained pressure", { attack: 1.14, defend: 1.28 }),
  garden_growth: action("garden_growth", "Grow corruption around held objectives", { defend: 1.4, expand: 1.2 }, { favorNurgle: 0.24 }),
  sorcerous_scrying: action("sorcerous_scrying", "Spend time revealing the decisive battlefield pattern", { research: 1.48, defend: 1.08 }),
  warp_reposition: action("warp_reposition", "Reposition valuable formations through the Warp", { expand: 1.35, attack: 1.16 }, { favorTzeentch: 0.25 }),
  mutable_plan: action("mutable_plan", "Switch the operational axis without abandoning the objective", { expand: 1.28, logistics: 1.18 }, { intelligence: 0.45 }),
  impossible_foretelling: action("impossible_foretelling", "Commit only after high-confidence divination", { attack: 1.46, research: 1.16 }, { intelligence: 0.7 }),
  rapid_temptation: action("rapid_temptation", "Draw isolated enemies away from support", { expand: 1.3, attack: 1.18 }),
  perfection_hunt: action("perfection_hunt", "Destroy an elite target to build excess momentum", { attack: 1.4, regroup: 0.7 }, { favorSlaanesh: 0.18 }),
  ecstatic_exploitation: action("ecstatic_exploitation", "Exploit collapsing morale without delay", { attack: 1.52, expand: 1.2 }, { favorSlaanesh: 0.42 })
});

export const CHAOS_PROFILE_ACTIONS = Object.freeze({
  "black-legion": Object.freeze(["black_crusade_reserve", "spear_tip_assault", "decapitation_strike", "strike_revealed_weakness"]),
  "iron-warriors": Object.freeze(["prepare_battery", "build_siege_line", "create_breach", "fortify_captured_ground"]),
  "word-bearers": Object.freeze(["establish_ritual_site", "feed_ritual", "corrupt_landmark", "summon_daemon_reserve"]),
  "night-lords": Object.freeze(["isolate_target", "terror_raid", "block_retreat", "hunt_routed_target"]),
  "alpha-legion": Object.freeze(["create_feint", "infiltrate", "sabotage", "strike_revealed_weakness"]),
  "emperors-children": Object.freeze(["rapid_temptation", "perfect_kill", "sonic_overload", "excess_pursuit"]),
  "world-eaters": Object.freeze(["blood_charge", "claim_skulls", "blood_tithe_reinforcement", "hunt_routed_target"]),
  "death-guard": Object.freeze(["contagion_front", "attrition_grind", "fortify_captured_ground", "garden_growth"]),
  "thousand-sons": Object.freeze(["sorcerous_scrying", "warp_reposition", "mutable_plan", "impossible_foretelling"]),
  "khorne-host": Object.freeze(["blood_charge", "claim_skulls", "blood_tithe_reinforcement", "spear_tip_assault"]),
  "tzeentch-coven": Object.freeze(["create_feint", "sorcerous_scrying", "mutable_plan", "impossible_foretelling"]),
  "nurgle-host": Object.freeze(["garden_growth", "contagion_front", "attrition_grind", "corrupt_landmark"]),
  "slaanesh-host": Object.freeze(["rapid_temptation", "perfection_hunt", "sonic_overload", "ecstatic_exploitation"])
});

export function createChaosStrategicState(overrides = {}) {
  return {
    corruptionByTerritory: { ...(overrides.corruptionByTerritory || {}) },
    favor: { khorne: 0.1, tzeentch: 0.1, nurgle: 0.1, slaanesh: 0.1, ...(overrides.favor || {}) },
    glory: clamp(overrides.glory ?? 0.08),
    ritualCharge: clamp(overrides.ritualCharge),
    warpInstability: clamp(overrides.warpInstability ?? 0.08),
    sacrificeValue: clamp(overrides.sacrificeValue),
    daemonReservePower: clamp(overrides.daemonReservePower ?? 0.3),
    fearPressureByEnemySquad: { ...(overrides.fearPressureByEnemySquad || {}) },
    selectedActionId: overrides.selectedActionId || null,
    actionChangedAt: Number(overrides.actionChangedAt) || 0
  };
}

function strategicMetrics(state, context) {
  const corruptions = Object.values(state.corruptionByTerritory);
  const fearValues = Object.values(state.fearPressureByEnemySquad);
  return {
    corruption: corruptions.length ? corruptions.reduce((sum, value) => sum + clamp(value), 0) / corruptions.length : clamp(context.corruptionCoverage),
    fearPressure: fearValues.length ? Math.max(...fearValues.map(value => clamp(value))) : clamp(1 - (context.enemyCohesion ?? 1)),
    intelligence: clamp(context.intelligenceConfidence),
    breach: clamp(context.breachProgress),
    favorKhorne: clamp(state.favor.khorne),
    favorTzeentch: clamp(state.favor.tzeentch),
    favorNurgle: clamp(state.favor.nurgle),
    favorSlaanesh: clamp(state.favor.slaanesh),
    glory: clamp(state.glory),
    ritualCharge: clamp(state.ritualCharge),
    sacrificeValue: clamp(state.sacrificeValue),
    daemonReservePower: clamp(state.daemonReservePower)
  };
}

export function advanceChaosStrategicState(state, context = {}, elapsed = 1) {
  const dt = Math.max(0, Math.min(5, Number(elapsed) || 0));
  const pressure = clamp(context.enemyPressure);
  const momentum = clamp(context.offensiveMomentum);
  state.glory = clamp(state.glory + (momentum * 0.006 - pressure * 0.002) * dt);
  state.sacrificeValue = clamp(state.sacrificeValue + clamp(context.sacrificeRate) * 0.018 * dt);
  state.ritualCharge = clamp(state.ritualCharge + (state.sacrificeValue * 0.007 + clamp(context.corruptionCoverage) * 0.004) * dt);
  state.warpInstability = clamp(state.warpInstability + (state.ritualCharge * 0.003 - 0.0015) * dt);
  state.favor.khorne = clamp(state.favor.khorne + clamp(context.meleePressure) * 0.006 * dt);
  state.favor.tzeentch = clamp(state.favor.tzeentch + clamp(context.intelligenceConfidence) * 0.0025 * dt);
  state.favor.nurgle = clamp(state.favor.nurgle + clamp(context.territoryRetention) * 0.0035 * dt);
  state.favor.slaanesh = clamp(state.favor.slaanesh + clamp(1 - (context.enemyCohesion ?? 1)) * 0.005 * dt);
  return state;
}

function requirementsMet(definition, metrics) {
  return Object.entries(definition.requirements).every(([metric, minimum]) => (metrics[metric] || 0) >= minimum);
}

export function availableChaosActions(profileId, state, context = {}) {
  const metrics = strategicMetrics(state, context);
  return (CHAOS_PROFILE_ACTIONS[profileId] || CHAOS_PROFILE_ACTIONS["black-legion"])
    .map(id => CHAOS_ACTION_CATALOG[id])
    .filter(definition => requirementsMet(definition, metrics));
}

export function selectChaosAction(profileId, phase, state, context = {}, now = 0) {
  const available = availableChaosActions(profileId, state, context);
  const phasePreference = {
    assess: ["research", "defend"], shape: ["expand", "logistics", "research"], commit: ["attack"],
    exploit: ["attack", "expand"], consolidate: ["defend", "logistics"], recover: ["logistics", "defend"],
    emergency: ["defend", "logistics"], endgame: ["attack", "expand"]
  }[phase] || ["attack"];
  const scored = available.map((definition, index) => {
    let score = 1 - index * 0.015;
    for (const key of phasePreference) score += Math.max(0, (definition.bias[key] || 1) - 1) * 1.4;
    score += clamp(context.objectiveProgress) * Math.max(0, (definition.bias.attack || 1) - 1);
    return { definition, score };
  }).sort((a, b) => b.score - a.score || a.definition.id.localeCompare(b.definition.id));
  const selected = scored[0]?.definition || CHAOS_ACTION_CATALOG[CHAOS_PROFILE_ACTIONS[profileId]?.[0] || "spear_tip_assault"];
  if (state.selectedActionId !== selected.id) {
    state.selectedActionId = selected.id;
    state.actionChangedAt = now;
  }
  return { selected, available, scores: Object.fromEntries(scored.map(entry => [entry.definition.id, entry.score])) };
}
