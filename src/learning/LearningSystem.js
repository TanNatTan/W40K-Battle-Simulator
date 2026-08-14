import { enforceFactionIdentity } from "../ai/FactionAISystem.js";

export const MEMORY_TYPES = Object.freeze([
  "enemy-pattern", "failed-assault", "successful-formation", "route-safety", "resource-shortage",
  "unit-effectiveness", "map-danger", "preferred-target", "drop-pod-result", "territory-result",
  "defense-result", "specialist-effectiveness", "enemy-specialist-threat", "vehicle-matchup",
  "squad-performance", "ambush-result", "flank-result", "capture-unit-effectiveness",
  "building-loss", "enemy-composition", "battle-result"
]);

const VISION_GATED_MEMORY = new Set([
  "enemy-pattern", "preferred-target", "map-danger", "enemy-specialist-threat", "enemy-composition", "vehicle-matchup"
]);
const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
const safePart = value => String(value || "unknown").trim().replace(/:/g, "-");

export function factionMatchupMemoryKey({ race, subfaction, opponentRace, opponentSubfaction, scenarioId } = {}) {
  return [race, subfaction, opponentRace, opponentSubfaction, scenarioId].map(safePart).join(":");
}

export function learningConfidence(samples = 0) {
  const count = Math.max(0, Number(samples) || 0);
  return count / (count + 4);
}

function subjectFor(type, payload = {}) {
  const preferred = {
    "successful-formation": payload.formation,
    "route-safety": payload.routeId,
    "resource-shortage": payload.resource,
    "unit-effectiveness": payload.unitType,
    "preferred-target": payload.targetType,
    "map-danger": payload.cell,
    "drop-pod-result": payload.zone || payload.targetType,
    "territory-result": payload.resource || payload.cell,
    "defense-result": payload.defenseType || payload.territory,
    "specialist-effectiveness": payload.specialist,
    "enemy-specialist-threat": payload.specialist,
    "vehicle-matchup": `${payload.vehicleType || "vehicle"}->${payload.enemyType || "enemy"}`,
    "squad-performance": payload.squadType || payload.role,
    "ambush-result": payload.terrain || payload.targetType,
    "flank-result": payload.formation || payload.targetType,
    "capture-unit-effectiveness": payload.unitType,
    "building-loss": payload.buildingType,
    "enemy-composition": payload.composition || payload.dominantRole,
    "battle-result": payload.objective || payload.result
  }[type];
  return safePart(preferred || "general");
}

function successfulObservation(type, payload = {}) {
  if (payload.success != null) return payload.success !== false;
  if (type === "failed-assault" || type === "building-loss") return false;
  if (type === "battle-result") return /win|victory|success/i.test(String(payload.result || ""));
  if (type === "route-safety") return payload.safe !== false;
  return true;
}

export class FactionLearningMemory {
  constructor(profile, saved = null, context = {}) {
    this.profile = profile;
    this.context = { ...context };
    this.matchupKey = context.matchupKey || saved?.matchupKey || null;
    this.observations = [];
    this.evidence = {};
    this.learnedWeights = {};
    this.formationResults = {};
    this.routeSafety = {};
    this.resourceShortages = {};
    this.unitEffectiveness = {};
    this.preferredTargets = {};
    this.mapDanger = {};
    this.completedBattles = 0;
    if (saved) this.restore(saved);
    else this.recalculateWeights();
  }

  observe(type, payload = {}, { visible = true, observedAt = 0 } = {}) {
    if (!MEMORY_TYPES.includes(type)) return false;
    if (VISION_GATED_MEMORY.has(type) && !visible) return false;
    const observation = { type, payload: { ...payload }, observedAt, visible: Boolean(visible) };
    this.observations.push(observation);
    this.observations = this.observations.slice(-512);
    this.updateEvidence(observation);
    this.updateAggregate(observation);
    this.recalculateWeights();
    return true;
  }

  updateEvidence({ type, payload }) {
    const key = `${type}:${subjectFor(type, payload)}`;
    const row = this.evidence[key] ||= { type, subject: subjectFor(type, payload), samples: 0, successes: 0, failures: 0, weight: 0 };
    const magnitude = clamp(payload.magnitude ?? payload.effectiveness ?? 1, 0.05, 4);
    const success = successfulObservation(type, payload);
    row.samples += 1;
    success ? row.successes += 1 : row.failures += 1;
    row.weight += (success ? 1 : -1) * magnitude;
    row.confidence = learningConfidence(row.samples);
  }

  updateAggregate({ type, payload }) {
    if (type === "successful-formation") {
      const row = this.formationResults[payload.formation] ||= { successes: 0, failures: 0 };
      payload.success === false ? row.failures += 1 : row.successes += 1;
    } else if (type === "route-safety") {
      const row = this.routeSafety[payload.routeId] ||= { safe: 0, dangerous: 0 };
      payload.safe === false ? row.dangerous += 1 : row.safe += 1;
    } else if (type === "resource-shortage") {
      this.resourceShortages[payload.resource] = (this.resourceShortages[payload.resource] || 0) + 1;
    } else if (type === "unit-effectiveness") {
      const row = this.unitEffectiveness[payload.unitType] ||= { wins: 0, losses: 0 };
      payload.success === false ? row.losses += 1 : row.wins += 1;
    } else if (type === "preferred-target") {
      this.preferredTargets[payload.targetType] = (this.preferredTargets[payload.targetType] || 0) + (payload.success === false ? -1 : 1);
    } else if (type === "map-danger") {
      this.mapDanger[payload.cell] = clamp((this.mapDanger[payload.cell] || 0) + (payload.danger || 0.1), 0, 1);
    }
  }

  evidenceFor(type, subject = "general") {
    return this.evidence[`${type}:${safePart(subject)}`] || null;
  }

  confidenceFor(type, subject = "general") {
    return learningConfidence(this.evidenceFor(type, subject)?.samples || 0);
  }

  learnedAdjustment(type, subject = "general", maximum = 0.2) {
    const row = this.evidenceFor(type, subject);
    if (!row) return 0;
    const outcome = clamp(row.weight / Math.max(1, row.samples), -1, 1);
    return outcome * learningConfidence(row.samples) * Math.abs(Number(maximum) || 0);
  }

  recalculateWeights() {
    const failedRows = Object.values(this.evidence).filter(row => row.type === "failed-assault" || row.type === "building-loss");
    const shortageRows = Object.values(this.evidence).filter(row => row.type === "resource-shortage");
    const formationRows = Object.values(this.evidence).filter(row => row.type === "successful-formation");
    const routeRows = Object.values(this.evidence).filter(row => row.type === "route-safety");
    const effective = rows => rows.reduce((sum, row) => sum + Math.abs(row.weight) * learningConfidence(row.samples), 0);
    const failedAssaults = effective(failedRows);
    const shortages = effective(shortageRows);
    const successfulFormations = formationRows.reduce((sum, row) => sum + Math.max(0, row.weight) * learningConfidence(row.samples), 0);
    const unsafeRoutes = routeRows.reduce((sum, row) => sum + Math.max(0, row.failures - row.successes) * learningConfidence(row.samples), 0);
    const base = this.profile.weights;
    const raw = {
      attack: base.attack * (1 - Math.min(0.18, failedAssaults * 0.015)),
      defend: base.defend * (1 + Math.min(0.16, failedAssaults * 0.012)),
      logistics: base.logistics * (1 + Math.min(0.2, shortages * 0.012 + unsafeRoutes * 0.008)),
      expand: base.expand * (1 - Math.min(0.12, unsafeRoutes * 0.006)),
      ranged: base.ranged * (1 + Math.min(0.08, successfulFormations * 0.003)),
      melee: base.melee,
      vehicles: base.vehicles * (1 + this.learnedAdjustment("vehicle-matchup", "general", 0.12)),
      research: base.research,
      swarm: base.swarm
    };
    this.learnedWeights = enforceFactionIdentity(this.profile, raw);
  }

  bestFormation(fallback = "line") {
    return Object.entries(this.formationResults).sort((a, b) => {
      const left = (b[1].successes - b[1].failures) * learningConfidence(b[1].successes + b[1].failures);
      const right = (a[1].successes - a[1].failures) * learningConfidence(a[1].successes + a[1].failures);
      return left - right;
    })[0]?.[0] || fallback;
  }

  routePreference(routeId) {
    const row = this.routeSafety[routeId];
    if (!row) return 0;
    const samples = row.safe + row.dangerous;
    return clamp((row.safe - row.dangerous) / Math.max(1, samples), -1, 1) * learningConfidence(samples);
  }

  decayBetweenBattles(factor = 0.97) {
    const decay = clamp(factor, 0, 1);
    for (const row of Object.values(this.evidence)) row.weight *= decay;
    for (const key of Object.keys(this.preferredTargets)) this.preferredTargets[key] *= decay;
    for (const key of Object.keys(this.mapDanger)) this.mapDanger[key] *= decay;
    this.completedBattles += 1;
    this.recalculateWeights();
    return this;
  }

  completeBattle(payload = {}, observedAt = 0) {
    this.decayBetweenBattles(0.97);
    this.observe("battle-result", payload, { visible: true, observedAt });
    return this;
  }

  toJSON() {
    return {
      version: 2,
      profileId: this.profile.id,
      matchupKey: this.matchupKey,
      context: this.context,
      completedBattles: this.completedBattles,
      observations: this.observations,
      evidence: this.evidence,
      learnedWeights: this.learnedWeights,
      formationResults: this.formationResults,
      routeSafety: this.routeSafety,
      resourceShortages: this.resourceShortages,
      unitEffectiveness: this.unitEffectiveness,
      preferredTargets: this.preferredTargets,
      mapDanger: this.mapDanger
    };
  }

  restore(saved) {
    this.matchupKey = this.context.matchupKey || saved.matchupKey || this.matchupKey;
    this.context = { ...(saved.context || {}), ...this.context };
    this.completedBattles = Math.max(0, Number(saved.completedBattles) || 0);
    this.observations = Array.isArray(saved.observations) ? saved.observations.slice(-512) : [];
    this.evidence = structuredClone(saved.evidence || {});
    this.formationResults = structuredClone(saved.formationResults || {});
    this.routeSafety = structuredClone(saved.routeSafety || {});
    this.resourceShortages = { ...(saved.resourceShortages || {}) };
    this.unitEffectiveness = structuredClone(saved.unitEffectiveness || {});
    this.preferredTargets = { ...(saved.preferredTargets || {}) };
    this.mapDanger = { ...(saved.mapDanger || {}) };
    if (!Object.keys(this.evidence).length) {
      const previous = [...this.observations];
      this.observations = [];
      for (const observation of previous) {
        this.observations.push(observation);
        this.updateEvidence(observation);
      }
    }
    this.recalculateWeights();
  }
}

export function createFactionLearningMemory(profile, saved = null, context = {}) {
  return new FactionLearningMemory(profile, saved, context);
}
