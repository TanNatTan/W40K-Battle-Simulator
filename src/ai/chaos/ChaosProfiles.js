const profile = (id, config) => Object.freeze({
  id,
  ...config,
  commitmentSeconds: config.commitmentSeconds ?? 14,
  thresholds: Object.freeze({ minIntel: 0.35, minimumAssaultRatio: 1, maxOverextension: 0.75, ...config.thresholds }),
  priorities: Object.freeze({ commander: 0.5, infrastructure: 0.5, isolated: 0.5, objective: 0.75, strongEnemy: 0.35, ritual: 0, ...config.priorities }),
  construction: Object.freeze({ military: 0, fortification: 0, logistics: 0, research: 0, ritual: 0, ...config.construction }),
  phaseWeights: Object.freeze(config.phaseWeights || {})
});

export const CHAOS_SUBFACTION_PROFILES = Object.freeze({
  "Black Legion": profile("black-legion", { commitmentSeconds: 18, thresholds: { minimumAssaultRatio: 1.05, maxOverextension: 0.78 }, priorities: { commander: 1, infrastructure: 0.72, objective: 1, strongEnemy: 0.65 }, construction: { military: 0.9, logistics: 0.55 }, reserveFraction: 0.22, style: "decisive_combined_arms_spear_tip" }),
  "Iron Warriors": profile("iron-warriors", { commitmentSeconds: 28, thresholds: { minIntel: 0.5, minimumAssaultRatio: 1.2, minimumSuppressedAssaultRatio: 0.95, maxOverextension: 0.62 }, priorities: { commander: 0.38, infrastructure: 1, objective: 0.92, strongEnemy: 0.78 }, construction: { military: 0.78, fortification: 1, logistics: 1, research: 0.35 }, reserveFraction: 0.2, style: "prepare_suppress_breach_fortify" }),
  "Word Bearers": profile("word-bearers", { commitmentSeconds: 22, thresholds: { minIntel: 0.42, minimumAssaultRatio: 1.08, ritualCommit: 0.68, maxOverextension: 0.66 }, priorities: { commander: 0.55, infrastructure: 0.62, objective: 0.96, ritual: 1 }, construction: { military: 0.45, fortification: 0.72, logistics: 0.62, research: 0.6, ritual: 1 }, reserveFraction: 0.26, style: "ritual_corruption_and_summoning" }),
  "Night Lords": profile("night-lords", { commitmentSeconds: 9, thresholds: { minIntel: 0.5, minimumAssaultRatio: 1.35, isolatedAssaultRatio: 0.7, maxOverextension: 0.82 }, priorities: { commander: 0.92, infrastructure: 0.74, isolated: 1, objective: 0.62, strongEnemy: 0.08 }, construction: { military: 0.35, logistics: 0.42 }, reserveFraction: 0.14, style: "terror_isolation_and_rout" }),
  "Alpha Legion": profile("alpha-legion", { commitmentSeconds: 7, thresholds: { minIntel: 0.62, minimumAssaultRatio: 1.45, isolatedAssaultRatio: 0.82, maxOverextension: 0.86 }, priorities: { commander: 0.76, infrastructure: 1, isolated: 0.86, objective: 0.8, strongEnemy: 0.05 }, construction: { military: 0.25, logistics: 0.68, research: 0.72 }, reserveFraction: 0.3, style: "deception_feints_and_sabotage" }),
  "Emperor's Children": profile("emperors-children", { commitmentSeconds: 13, thresholds: { minimumAssaultRatio: 0.92, maxOverextension: 0.8 }, priorities: { commander: 1, infrastructure: 0.42, isolated: 0.82, objective: 0.74, strongEnemy: 0.62 }, construction: { military: 0.7, research: 0.42 }, reserveFraction: 0.16, style: "precision_excess_and_champion_hunt" }),
  "World Eaters": profile("world-eaters", { commitmentSeconds: 34, thresholds: { minIntel: 0.12, minimumAssaultRatio: 0.75, maxOverextension: 0.94 }, priorities: { commander: 0.74, infrastructure: 0.15, isolated: 0.62, objective: 0.9, strongEnemy: 0.95 }, construction: { military: 1, fortification: -0.8, logistics: -0.45, research: -1 }, reserveFraction: 0.05, style: "continuous_objective_leashed_melee" }),
  "Death Guard": profile("death-guard", { commitmentSeconds: 30, thresholds: { minIntel: 0.3, minimumAssaultRatio: 0.9, maxOverextension: 0.55 }, priorities: { commander: 0.34, infrastructure: 0.62, isolated: 0.2, objective: 1, strongEnemy: 0.7 }, construction: { military: 0.42, fortification: 1, logistics: 0.45, research: 0.25 }, reserveFraction: 0.24, style: "disciplined_attrition_and_occupation" }),
  "Thousand Sons": profile("thousand-sons", { commitmentSeconds: 18, thresholds: { minIntel: 0.58, minimumAssaultRatio: 1.08, maxOverextension: 0.6 }, priorities: { commander: 0.9, infrastructure: 0.56, isolated: 0.42, objective: 1, strongEnemy: 0.25 }, construction: { military: 0.42, fortification: 0.38, logistics: 0.62, research: 1, ritual: 0.86 }, reserveFraction: 0.32, style: "caster_preservation_and_knowledge_recovery" }),
  "Khorne Host": profile("khorne-host", { commitmentSeconds: 40, thresholds: { minIntel: 0.05, minimumAssaultRatio: 0.62, maxOverextension: 1 }, priorities: { commander: 0.7, infrastructure: 0.05, isolated: 0.42, objective: 0.86, strongEnemy: 1 }, construction: { military: 1, fortification: -1, logistics: -0.8, research: -1 }, reserveFraction: 0, style: "lethal_contact_as_momentum" }),
  "Tzeentch Coven": profile("tzeentch-coven", { commitmentSeconds: 6, thresholds: { minIntel: 0.66, minimumAssaultRatio: 1.18, isolatedAssaultRatio: 0.9, maxOverextension: 0.82 }, priorities: { commander: 0.72, infrastructure: 0.82, isolated: 0.65, objective: 1, ritual: 0.95 }, construction: { logistics: 0.5, research: 1, ritual: 1 }, reserveFraction: 0.34, style: "multi_objective_manipulation" }),
  "Nurgle Host": profile("nurgle-host", { commitmentSeconds: 34, thresholds: { minIntel: 0.22, minimumAssaultRatio: 0.86, maxOverextension: 0.48 }, priorities: { commander: 0.25, infrastructure: 0.46, isolated: 0.18, objective: 1, ritual: 0.88 }, construction: { military: 0.25, fortification: 1, logistics: 0.32, ritual: 0.82 }, reserveFraction: 0.2, style: "persistent_corruption_and_area_denial" }),
  "Slaanesh Host": profile("slaanesh-host", { commitmentSeconds: 10, thresholds: { minIntel: 0.46, minimumAssaultRatio: 0.82, maxOverextension: 0.88 }, priorities: { commander: 1, infrastructure: 0.3, isolated: 1, objective: 0.78, strongEnemy: 0.54 }, construction: { military: 0.58, logistics: 0.28 }, reserveFraction: 0.12, style: "speed_isolation_and_morale_collapse" })
});

const normalize = value => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");

export function chaosProfileFor(subfaction) {
  const wanted = normalize(subfaction);
  if (!wanted) return CHAOS_SUBFACTION_PROFILES["Black Legion"];
  return Object.entries(CHAOS_SUBFACTION_PROFILES)
    .find(([name]) => wanted.includes(normalize(name)) || normalize(name).includes(wanted))?.[1]
    || CHAOS_SUBFACTION_PROFILES["Black Legion"];
}
