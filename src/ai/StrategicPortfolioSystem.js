const clamp01 = value => Math.max(0, Math.min(1, Number(value) || 0));

const BASE_COMMITMENTS = Object.freeze({
  "Space Marines": Object.freeze({ battleObjective: 0.4, territory: 0.13, economy: 0.13, baseDefense: 0.11, militaryGrowth: 0.16, reserve: 0.07 }),
  "Imperial Guard": Object.freeze({ battleObjective: 0.3, territory: 0.16, economy: 0.16, baseDefense: 0.14, militaryGrowth: 0.18, reserve: 0.06 }),
  "Adeptus Mechanicus": Object.freeze({ battleObjective: 0.28, territory: 0.14, economy: 0.2, baseDefense: 0.13, militaryGrowth: 0.2, reserve: 0.05 }),
  Chaos: Object.freeze({ battleObjective: 0.42, territory: 0.14, economy: 0.1, baseDefense: 0.08, militaryGrowth: 0.2, reserve: 0.06 }),
  Orks: Object.freeze({ battleObjective: 0.42, territory: 0.2, economy: 0.08, baseDefense: 0.06, militaryGrowth: 0.2, reserve: 0.04 }),
  Necrons: Object.freeze({ battleObjective: 0.3, territory: 0.16, economy: 0.15, baseDefense: 0.15, militaryGrowth: 0.18, reserve: 0.06 }),
  Tau: Object.freeze({ battleObjective: 0.3, territory: 0.15, economy: 0.17, baseDefense: 0.12, militaryGrowth: 0.18, reserve: 0.08 }),
  Tyranids: Object.freeze({ battleObjective: 0.36, territory: 0.24, economy: 0.1, baseDefense: 0.06, militaryGrowth: 0.2, reserve: 0.04 })
});

function normalizeCommitments(commitments) {
  const total = Object.values(commitments).reduce((sum, value) => sum + Math.max(0, value), 0) || 1;
  return Object.freeze(Object.fromEntries(Object.entries(commitments).map(([key, value]) => [key, Math.max(0, value) / total])));
}

function roleCommitmentsFor(commitments, doctrine = {}) {
  const bias = doctrine.roleBias || {};
  return Object.freeze({
    "base-defense": commitments.baseDefense,
    "economy-defense": commitments.economy * 0.72,
    "route-security": commitments.economy * 0.28,
    "territory-defense": commitments.territory * 0.42,
    capture: commitments.territory * 0.58,
    reserve: commitments.reserve,
    reinforcement: commitments.militaryGrowth * 0.38,
    offensive: commitments.battleObjective * Math.max(0.42, bias.offensive || 0.5),
    siege: commitments.battleObjective * Math.max(0.18, bias.siege || 0.2),
    reconnaissance: commitments.battleObjective * Math.max(0.12, bias.reconnaissance || 0.15),
    ambush: commitments.battleObjective * Math.max(0.08, bias.ambush || 0.08),
    escort: commitments.militaryGrowth * 0.12,
    "medical-support": commitments.militaryGrowth * 0.15
  });
}

export function createStrategicPortfolio({ profile = {}, doctrine = {}, context = {}, allIn = false, lastStand = false, evacuation = false } = {}) {
  const branch = profile.branch || "Space Marines";
  const base = BASE_COMMITMENTS[branch] || BASE_COMMITMENTS["Space Marines"];
  const emergency = clamp01(context.enemyPressure) >= 0.72 || context.macroReadiness?.hqEmergency;
  const waiveFloors = Boolean(allIn || lastStand || evacuation);
  const commitments = { ...base };
  if (emergency && !waiveFloors) {
    commitments.baseDefense += 0.12;
    commitments.reserve += 0.04;
    commitments.battleObjective -= 0.1;
    commitments.territory -= 0.03;
    commitments.militaryGrowth -= 0.03;
  }
  if (clamp01(context.resourceShortage) > 0.5 && !waiveFloors) {
    commitments.economy += 0.08;
    commitments.battleObjective -= 0.05;
    commitments.militaryGrowth -= 0.03;
  }
  if (waiveFloors) {
    commitments.battleObjective = evacuation ? 0.08 : 0.78;
    commitments.baseDefense = lastStand ? 0.16 : 0.04;
    commitments.territory = 0.03;
    commitments.economy = 0.03;
    commitments.militaryGrowth = evacuation ? 0.03 : 0.08;
    commitments.reserve = evacuation ? 0.79 : 0.04;
  }
  const normalized = normalizeCommitments(commitments);
  return Object.freeze({
    branch,
    primaryObjective: doctrine.objectiveId || "annihilation",
    commitments: normalized,
    roleCommitments: roleCommitmentsFor(normalized, doctrine),
    productionPriorities: doctrine.productionPriorities || {},
    waiveFloors,
    emergency,
    doctrineId: doctrine.id || null,
    approach: doctrine.approach || "combined-arms map presence"
  });
}

export function portfolioRoleFloors(portfolio = {}, squadCount = 0) {
  const count = Math.max(0, Math.floor(Number(squadCount) || 0));
  if (!count || portfolio.waiveFloors || !portfolio.commitments) return Object.freeze({});
  const commitments = portfolio.commitments || {};
  const floors = {
    "base-defense": count >= 2 && commitments.baseDefense > 0 ? 1 : 0,
    "economy-defense": count >= 4 && commitments.economy > 0 ? 1 : 0,
    capture: count >= 5 && commitments.territory > 0 ? 1 : 0,
    reserve: count >= 6 && commitments.reserve > 0 ? 1 : 0
  };
  const protectedCount = Object.values(floors).reduce((sum, value) => sum + value, 0);
  floors.offensive = Math.max(1, Math.min(count - protectedCount, Math.round(count * (commitments.battleObjective || 0.4))));
  return Object.freeze(floors);
}

export { BASE_COMMITMENTS as STRATEGIC_PORTFOLIO_BASES };
