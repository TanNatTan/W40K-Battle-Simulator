const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, Number(value) || 0));

export const BREAK_POLICY_IDS = Object.freeze({
  ASTARTES: "astartes-resolve",
  GUARD: "guard-combat-stress",
  MECHANICUS: "noosphere-integrity",
  ORKS: "mob-momentum",
  TAU: "fire-caste-discipline",
  NECRONS: "command-protocols",
  TYRANIDS: "synapse",
  CHAOS: "zeal-and-ambition",
  DEFAULT: "cohesion"
});

export const BREAK_POLICIES = Object.freeze({
  [BREAK_POLICY_IDS.ASTARTES]: Object.freeze({ usesFear: false, usesMoraleRout: false, tacticalWithdrawal: true, casualtyThreshold: 0.18, pressureMechanic: "resolve" }),
  [BREAK_POLICY_IDS.GUARD]: Object.freeze({ usesFear: true, usesMoraleRout: true, tacticalWithdrawal: true, casualtyThreshold: 0.3, pressureMechanic: "combat-stress", commissarIntervention: true }),
  [BREAK_POLICY_IDS.MECHANICUS]: Object.freeze({ usesFear: false, usesMoraleRout: false, tacticalWithdrawal: true, casualtyThreshold: 0.22, pressureMechanic: "noosphere-integrity" }),
  [BREAK_POLICY_IDS.ORKS]: Object.freeze({ usesFear: false, usesMoraleRout: false, tacticalWithdrawal: false, casualtyThreshold: 0.08, pressureMechanic: "mob-momentum" }),
  [BREAK_POLICY_IDS.TAU]: Object.freeze({ usesFear: false, usesMoraleRout: false, tacticalWithdrawal: true, casualtyThreshold: 0.24, pressureMechanic: "discipline" }),
  [BREAK_POLICY_IDS.NECRONS]: Object.freeze({ usesFear: false, usesMoraleRout: false, tacticalWithdrawal: false, casualtyThreshold: 0.05, pressureMechanic: "command-protocols" }),
  [BREAK_POLICY_IDS.TYRANIDS]: Object.freeze({ usesFear: false, usesMoraleRout: false, tacticalWithdrawal: false, casualtyThreshold: 0.04, pressureMechanic: "synapse" }),
  [BREAK_POLICY_IDS.CHAOS]: Object.freeze({ usesFear: false, usesMoraleRout: false, tacticalWithdrawal: false, casualtyThreshold: 0.1, pressureMechanic: "zeal" }),
  [BREAK_POLICY_IDS.DEFAULT]: Object.freeze({ usesFear: false, usesMoraleRout: false, tacticalWithdrawal: true, casualtyThreshold: 0.22, pressureMechanic: "cohesion" })
});

export function breakPolicyIdFor(player = {}) {
  const race = String(player.race || "").toLowerCase();
  const faction = String(player.faction || "").toLowerCase();
  if (faction.includes("space marine")) return BREAK_POLICY_IDS.ASTARTES;
  if (faction.includes("imperial guard") || faction.includes("astra militarum")) return BREAK_POLICY_IDS.GUARD;
  if (faction.includes("mechanicus") || faction.includes("machine cult")) return BREAK_POLICY_IDS.MECHANICUS;
  if (race.includes("ork")) return BREAK_POLICY_IDS.ORKS;
  if (race.includes("tau") || faction.includes("t'au")) return BREAK_POLICY_IDS.TAU;
  if (race.includes("necron")) return BREAK_POLICY_IDS.NECRONS;
  if (race.includes("tyranid")) return BREAK_POLICY_IDS.TYRANIDS;
  if (race.includes("chaos")) return BREAK_POLICY_IDS.CHAOS;
  return BREAK_POLICY_IDS.DEFAULT;
}

export function breakPolicyFor(player = {}) {
  return BREAK_POLICIES[breakPolicyIdFor(player)];
}

export function createPsychologyState(player = {}, random = Math.random) {
  const policyId = breakPolicyIdFor(player);
  const resolve = clamp(0.48 + random() * 0.28, 0, 1);
  if (policyId !== BREAK_POLICY_IDS.GUARD) return { resolve, breakPolicyId: policyId };
  return {
    resolve,
    breakPolicyId: policyId,
    combatStress: 0,
    breakThreshold: clamp(72 + resolve * 18, 72, 90),
    breakState: "STEADY",
    breakStartedAt: null
  };
}

export function guardBreakStateFor(combatStress = 0) {
  const stress = clamp(combatStress, 0, 100);
  if (stress >= 90) return "ROUT";
  if (stress >= 75) return "BREAKING";
  if (stress >= 60) return "WAVERING";
  if (stress >= 40) return "SHAKEN";
  return "STEADY";
}

export function updateFactionPressure(unit = {}, player = {}, context = {}, dt = 0.05) {
  const policy = breakPolicyFor(player);
  if (!policy.usesFear) return { resolve: clamp(unit.resolve ?? unit.morale ?? 0.65, 0, 1), breakPolicyId: breakPolicyIdFor(player) };
  const hostilePower = Math.max(0, Number(context.hostilePower) || 0);
  const friendlyPower = Math.max(0.1, Number(context.friendlyPower) || 0.1);
  const powerPressure = clamp((hostilePower - friendlyPower) / friendlyPower, 0, 3);
  const suppression = clamp(context.suppression ?? unit.suppression ?? 0, 0, 1);
  const casualtyPressure = clamp(context.casualtyRatio, 0, 1);
  const isolated = context.isolated ? 1 : 0;
  const commanderSupport = context.commanderPresent ? 1 : 0;
  const standardSupport = context.standardPresent ? 1 : 0;
  const resolve = clamp(unit.resolve ?? unit.morale ?? 0.6, 0, 1);
  const gainPerSecond = powerPressure * 7 + suppression * 10 + casualtyPressure * 13 + isolated * 5
    + (context.massiveThreat ? 8 : 0) + (context.commanderKilled ? 12 : 0);
  const recoveryPerSecond = 3 + resolve * 4 + commanderSupport * 4 + standardSupport * 3 + (context.inCover ? 2 : 0);
  const combatStress = clamp((unit.combatStress || 0) + (gainPerSecond - recoveryPerSecond) * Math.max(0, dt), 0, 100);
  return {
    resolve,
    breakPolicyId: BREAK_POLICY_IDS.GUARD,
    combatStress,
    breakThreshold: clamp(unit.breakThreshold ?? 72 + resolve * 18, 72, 90),
    breakState: guardBreakStateFor(combatStress)
  };
}

export function withdrawalDecisionFor(unit = {}, player = {}, context = {}) {
  const policy = breakPolicyFor(player);
  if (unit.retreatReason === "objective" || unit.retreatReason === "command") return unit.retreatReason.toUpperCase();
  if (context.hasRangedWeapon !== false && (unit.ammo || 0) <= 0 && context.hasReserveAmmo !== true) return "RESUPPLY";
  if (policy.usesMoraleRout && (unit.combatStress || 0) >= (unit.breakThreshold || 80)) return "ROUT";
  if (policy.tacticalWithdrawal && context.commandWithdrawal) return "TACTICAL_WITHDRAWAL";
  const healthRatio = clamp((unit.hp || 0) / Math.max(1, unit.maxHp || 1), 0, 1);
  if (policy.tacticalWithdrawal && healthRatio < policy.casualtyThreshold
    && context.safeWithdrawalAvailable !== false && !context.criticalObjective) return "CASUALTY_PRESERVATION";
  return null;
}

export function isCommissar(unit = {}) {
  return /commissar/i.test(`${unit.name || ""} ${unit.specialty || ""} ${unit.attachment || ""}`);
}

export function commissarInterventionFor({ members = [], commissar = null, now = 0, lastInterventionAt = -Infinity } = {}) {
  if (!commissar?.alive || !isCommissar(commissar) || now - lastInterventionAt < 10) return { action: "NONE" };
  const routing = members.filter(member => member.alive && member.id !== commissar.id && member.breakState === "ROUT");
  if (!routing.length) return { action: "NONE" };
  const candidate = [...routing].sort((a, b) => (b.combatStress || 0) - (a.combatStress || 0) || (a.resolve || 0) - (b.resolve || 0))[0];
  const commandStrength = clamp((commissar.discipline || 0.6) * 0.55 + (commissar.commandRank || 1) * 0.08, 0, 1);
  const averageStress = routing.reduce((sum, member) => sum + (member.combatStress || 0), 0) / routing.length;
  if (averageStress < 95 && commandStrength >= 0.62) return { action: "RALLY", stressReduction: 24, resolveGain: 0.12 };
  return { action: "SUMMARY_EXECUTION", candidateId: candidate.id, stressReduction: 32, resolveGain: 0.18 };
}
