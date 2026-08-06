const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

export const INJURY_STATES = Object.freeze({
  HEALTHY: "Healthy",
  INJURED: "Injured",
  GRAVELY_INJURED: "Gravely Injured",
  KNOCKED_DOWN: "Knocked Down",
  INCAPACITATED: "Incapacitated",
  DEAD: "Dead"
});

const PROFILES = Object.freeze({
  apothecary: Object.freeze({ id: "apothecary", label: "Apothecary", treatmentRate: 1.45, bleedingControl: 1.55, approachRange: 150, evacuationBias: 1.45, limitedDuty: 0.62 }),
  imperial: Object.freeze({ id: "imperial", label: "Imperial medic", treatmentRate: 1, bleedingControl: 1, approachRange: 130, evacuationBias: 1, limitedDuty: 0.5 }),
  painboy: Object.freeze({ id: "painboy", label: "Painboy", treatmentRate: 1.65, bleedingControl: 0.82, approachRange: 120, evacuationBias: 0.45, limitedDuty: 0.68, risk: 0.1 }),
  tau: Object.freeze({ id: "tau", label: "Tau medical drone", treatmentRate: 1.2, bleedingControl: 1.25, approachRange: 165, treatmentRange: 24, evacuationBias: 0.75, limitedDuty: 0.56 }),
  necron: Object.freeze({ id: "necron", label: "Necron reanimation", treatmentRate: 0.55, bleedingControl: 2, approachRange: 110, evacuationBias: 0.1, limitedDuty: 0.72, reanimation: true }),
  tyranid: Object.freeze({ id: "tyranid", label: "Tyranid regeneration", treatmentRate: 0.72, bleedingControl: 0.65, approachRange: 110, evacuationBias: 0.05, limitedDuty: 0.7, regeneration: true }),
  chaos: Object.freeze({ id: "chaos", label: "Chaos ritualist", treatmentRate: 1.15, bleedingControl: 0.9, approachRange: 130, evacuationBias: 0.35, limitedDuty: 0.64, ritual: true })
});

export function medicalProfileFor(player = {}) {
  if (player.faction === "Space Marines") return PROFILES.apothecary;
  if (player.faction === "Imperial Guard" || player.race === "Imperium") return PROFILES.imperial;
  if (player.race === "Orks") return PROFILES.painboy;
  if (player.race === "Tau") return PROFILES.tau;
  if (player.race === "Necrons") return PROFILES.necron;
  if (player.race === "Tyranids") return PROFILES.tyranid;
  if (player.race === "Chaos" || player.faction === "Chaos") return PROFILES.chaos;
  return PROFILES.imperial;
}

export function injuryStateFor(unit) {
  if (!unit?.alive) return INJURY_STATES.DEAD;
  if (unit.incapacitated) return INJURY_STATES.INCAPACITATED;
  if ((unit.knockedDownRemaining || 0) > 0) return INJURY_STATES.KNOCKED_DOWN;
  const ratio = (unit.hp || 0) / Math.max(1, unit.maxHp || 1);
  if (ratio <= 0.16) return INJURY_STATES.INCAPACITATED;
  if (ratio < 0.48) return INJURY_STATES.GRAVELY_INJURED;
  if (ratio < 0.78) return INJURY_STATES.INJURED;
  return INJURY_STATES.HEALTHY;
}

export function forceTreatmentThreshold(units, faction) {
  const force = units.filter(unit => unit.alive && unit.faction === faction);
  const injured = force.filter(unit => injuryStateFor(unit) !== INJURY_STATES.HEALTHY);
  const critical = injured.filter(unit => unit.incapacitated || injuryStateFor(unit) === INJURY_STATES.GRAVELY_INJURED);
  const ratio = force.length ? injured.length / force.length : 0;
  return {
    force: force.length,
    injured: injured.length,
    critical: critical.length,
    ratio,
    active: critical.length > 0 || injured.length >= 3 || ratio >= 0.24
  };
}

export function triageScore(patient, medic, danger = 0, profile = PROFILES.imperial) {
  const ratio = (patient.hp || 0) / Math.max(1, patient.maxHp || 1);
  const critical = patient.incapacitated ? 78 : ratio < 0.48 ? 42 : ratio < 0.78 ? 18 : 0;
  const bleeding = clamp(patient.bleeding || 0, 0, 1) * 55;
  const value = patient.role === "commander" ? 22 : patient.experience > 24 ? 10 : patient.role === "medic" ? 8 : 0;
  const stabilizedPenalty = patient.stabilized ? 14 : 0;
  const distancePenalty = medic ? Math.hypot((patient.x || 0) - (medic.x || 0), (patient.y || 0) - (medic.y || 0)) * 0.08 : 0;
  return critical + bleeding + value * profile.evacuationBias - danger * 35 - stabilizedPenalty - distancePenalty;
}

export function shouldEvacuate(patient, danger, distanceToCare, profile = PROFILES.imperial) {
  if (!patient?.stabilized || danger > 0.35) return false;
  const severe = patient.incapacitated || (patient.hp || 0) < (patient.maxHp || 1) * 0.22;
  const valuable = patient.role === "commander" || patient.experience > 24;
  if (profile.id === "tyranid" || profile.id === "necron") return false;
  return severe && distanceToCare < 220 || valuable && profile.evacuationBias >= 1 && distanceToCare < 300;
}

export function tickFactionRecovery(unit, dt, player, random = Math.random) {
  const profile = medicalProfileFor(player);
  const events = [];
  if (!unit?.alive) return events;
  unit.medicalPolicy = profile.id;
  if (profile.regeneration && !unit.incapacitated && unit.hp < unit.maxHp && (unit.bleeding || 0) < 0.18) {
    unit.hp = clamp(unit.hp + dt * 0.32, 1, unit.maxHp);
    events.push({ type: "regenerated", amount: dt * 0.32 });
  }
  if (profile.reanimation && unit.incapacitated && unit.stabilized) {
    unit.reanimationProgress = (unit.reanimationProgress || 0) + dt * 0.075;
    if (unit.reanimationProgress >= 1) {
      unit.incapacitated = false;
      unit.stabilized = false;
      unit.reanimationProgress = 0;
      unit.bleeding = 0;
      unit.hp = Math.max(unit.hp, unit.maxHp * profile.limitedDuty);
      events.push({ type: "reanimated" });
    }
  }
  if (profile.ritual && unit.incapacitated && unit.stabilized) {
    unit.ritualProgress = (unit.ritualProgress || 0) + dt * 0.045;
    if (unit.ritualProgress >= 1) {
      unit.ritualProgress = 0;
      if (random() < 0.72) {
        unit.incapacitated = false;
        unit.stabilized = false;
        unit.bleeding = 0;
        unit.hp = Math.max(unit.hp, unit.maxHp * profile.limitedDuty);
        unit.morale = clamp(unit.morale + 0.18, 0, 1);
        events.push({ type: "ritual-recovery" });
      } else {
        unit.morale = clamp(unit.morale - 0.2, 0, 1);
        events.push({ type: "ritual-failed" });
      }
    }
  }
  return events;
}

export { PROFILES as MEDICAL_PROFILES };
