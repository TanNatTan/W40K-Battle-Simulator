const clamp01 = value => Math.max(0, Math.min(1, Number(value) || 0));

const RACE_METHODS = Object.freeze({
  "Space Marines": Object.freeze({ approach: "elite strike and rapid reinforcement", roles: { offensive: 1, reinforcement: 0.85, capture: 0.72, reserve: 0.55 }, production: { infantry: 0.9, vehicles: 0.7, heavy: 0.78, defenses: 0.45, support: 0.72 } }),
  "Imperial Guard": Object.freeze({ approach: "broad fortified front behind armor and artillery", roles: { "territory-defense": 1, "route-security": 0.9, siege: 0.84, reinforcement: 0.78 }, production: { infantry: 0.82, vehicles: 1, heavy: 1, defenses: 0.88, support: 0.76 } }),
  "Adeptus Mechanicus": Object.freeze({ approach: "secure valuable nodes then escalate machine strength", roles: { "economy-defense": 1, "route-security": 0.82, siege: 0.9, capture: 0.68 }, production: { infantry: 0.45, vehicles: 1, heavy: 0.96, defenses: 0.72, support: 1 } }),
  Chaos: Object.freeze({ approach: "shape several fronts, exploit losses, then concentrate", roles: { ambush: 0.9, offensive: 1, siege: 0.76, capture: 0.62 }, production: { infantry: 0.76, vehicles: 0.82, heavy: 0.9, defenses: 0.5, support: 0.62 } }),
  Orks: Object.freeze({ approach: "expand in several mobs and pile into the largest fight", roles: { offensive: 1, capture: 0.95, reinforcement: 0.72, siege: 0.68 }, production: { infantry: 1, vehicles: 0.9, heavy: 0.82, defenses: 0.42, support: 0.4 } }),
  Necrons: Object.freeze({ approach: "deliberate advance with persistent secured cells", roles: { "territory-defense": 1, capture: 0.78, reserve: 0.76, siege: 0.72 }, production: { infantry: 0.7, vehicles: 0.9, heavy: 1, defenses: 0.88, support: 0.92 } }),
  Tau: Object.freeze({ approach: "reconnaissance and overlapping fire across secure corridors", roles: { reconnaissance: 1, "route-security": 0.82, "territory-defense": 0.78, offensive: 0.62 }, production: { infantry: 0.55, vehicles: 0.92, heavy: 0.8, defenses: 0.7, support: 0.86 } }),
  Tyranids: Object.freeze({ approach: "spread synapse and biomass before massing at weak resistance", roles: { capture: 1, reinforcement: 0.88, offensive: 0.84, reconnaissance: 0.7 }, production: { infantry: 1, vehicles: 0.62, heavy: 0.94, defenses: 0.52, support: 0.72 } })
});

const objectiveRoleBias = signals => ({
  offensive: clamp01((signals.attack || 0) * 0.72 + (signals.targetCommand || 0) * 0.28),
  siege: clamp01((signals.targetInfrastructure || 0) * 0.72 + (signals.attack || 0) * 0.28),
  capture: clamp01((signals.expansion || 0) * 0.6 + (signals.control || 0) * 0.4),
  "territory-defense": clamp01((signals.defense || 0) * 0.65 + (signals.fortification || 0) * 0.35),
  reconnaissance: clamp01(signals.scouting || 0),
  "route-security": clamp01(signals.logistics || 0),
  escort: clamp01(signals.preservation || 0),
  "medical-support": clamp01(signals.preservation || 0),
  reinforcement: clamp01((signals.mobility || 0) * 0.55 + (signals.attack || 0) * 0.45)
});

export function resolveFactionObjectiveDoctrine({ branch = "Space Marines", objectiveId = "annihilation", subfaction = "default", signals = {} } = {}) {
  const race = RACE_METHODS[branch] || RACE_METHODS["Space Marines"];
  const objective = objectiveRoleBias(signals);
  const roleBias = {};
  for (const role of new Set([...Object.keys(race.roles), ...Object.keys(objective)])) {
    roleBias[role] = Math.max(0, (race.roles[role] || 0.35) * 0.55 + (objective[role] || 0) * 0.75);
  }
  return Object.freeze({
    id: `${branch}:${subfaction}:${objectiveId}`,
    branch,
    subfaction,
    objectiveId,
    approach: race.approach,
    roleBias: Object.freeze(roleBias),
    productionPriorities: Object.freeze({ ...race.production }),
    description: `${branch} pursues ${objectiveId.replaceAll("_", " ")} through ${race.approach}, while retaining economy, territory, defense, reinforcement, and reserve responsibilities.`
  });
}

export { RACE_METHODS as FACTION_OBJECTIVE_METHODS };
