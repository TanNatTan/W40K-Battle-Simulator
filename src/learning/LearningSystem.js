import { enforceFactionIdentity } from "../ai/FactionAISystem.js";

export const MEMORY_TYPES = Object.freeze([
  "enemy-pattern", "failed-assault", "successful-formation", "route-safety", "resource-shortage",
  "unit-effectiveness", "map-danger", "preferred-target"
]);

const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));

export class FactionLearningMemory {
  constructor(profile, saved = null) {
    this.profile = profile;
    this.observations = [];
    this.learnedWeights = {};
    this.formationResults = {};
    this.routeSafety = {};
    this.resourceShortages = {};
    this.unitEffectiveness = {};
    this.preferredTargets = {};
    this.mapDanger = {};
    if (saved) this.restore(saved);
  }

  observe(type, payload = {}, { visible = true, observedAt = 0 } = {}) {
    if (!MEMORY_TYPES.includes(type)) return false;
    if ((type === "enemy-pattern" || type === "preferred-target" || type === "map-danger") && !visible) return false;
    const observation = { type, payload: { ...payload }, observedAt };
    this.observations.push(observation);
    this.observations = this.observations.slice(-128);
    this.updateAggregate(observation);
    this.recalculateWeights();
    return true;
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

  recalculateWeights() {
    const failedAssaults = this.observations.filter(item => item.type === "failed-assault").length;
    const shortages = this.observations.filter(item => item.type === "resource-shortage").length;
    const successfulFormations = this.observations.filter(item => item.type === "successful-formation" && item.payload.success !== false).length;
    const unsafeRoutes = Object.values(this.routeSafety).reduce((sum, row) => sum + row.dangerous, 0);
    const raw = {
      attack: this.profile.weights.attack * (1 - Math.min(0.18, failedAssaults * 0.015)),
      defend: this.profile.weights.defend * (1 + Math.min(0.16, failedAssaults * 0.012)),
      logistics: this.profile.weights.logistics * (1 + Math.min(0.2, shortages * 0.012 + unsafeRoutes * 0.008)),
      expand: this.profile.weights.expand * (1 - Math.min(0.12, unsafeRoutes * 0.006)),
      ranged: this.profile.weights.ranged * (1 + Math.min(0.08, successfulFormations * 0.003)),
      melee: this.profile.weights.melee,
      vehicles: this.profile.weights.vehicles,
      research: this.profile.weights.research,
      swarm: this.profile.weights.swarm
    };
    this.learnedWeights = enforceFactionIdentity(this.profile, raw);
  }

  bestFormation(fallback = "line") {
    return Object.entries(this.formationResults).sort((a, b) => (b[1].successes - b[1].failures) - (a[1].successes - a[1].failures))[0]?.[0] || fallback;
  }

  routePreference(routeId) {
    const row = this.routeSafety[routeId];
    return row ? clamp((row.safe - row.dangerous) / Math.max(1, row.safe + row.dangerous), -1, 1) : 0;
  }

  toJSON() {
    return { version: 1, profileId: this.profile.id, observations: this.observations, learnedWeights: this.learnedWeights, formationResults: this.formationResults, routeSafety: this.routeSafety, resourceShortages: this.resourceShortages, unitEffectiveness: this.unitEffectiveness, preferredTargets: this.preferredTargets, mapDanger: this.mapDanger };
  }

  restore(saved) {
    this.observations = Array.isArray(saved.observations) ? saved.observations.slice(-128) : [];
    this.formationResults = { ...(saved.formationResults || {}) };
    this.routeSafety = { ...(saved.routeSafety || {}) };
    this.resourceShortages = { ...(saved.resourceShortages || {}) };
    this.unitEffectiveness = { ...(saved.unitEffectiveness || {}) };
    this.preferredTargets = { ...(saved.preferredTargets || {}) };
    this.mapDanger = { ...(saved.mapDanger || {}) };
    this.recalculateWeights();
  }
}

export function createFactionLearningMemory(profile, saved = null) {
  return new FactionLearningMemory(profile, saved);
}
