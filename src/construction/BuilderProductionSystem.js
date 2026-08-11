import { builderWorkforceBranchFor, builderWorkforceDemand } from "./BuilderWorkforceSystem.js";

export const BUILDER_PRODUCTION = Object.freeze({
  space_marines: Object.freeze({ producerTypes: Object.freeze(["outpost", "workshop"]), producerLabel: "Fortress Monastery or Armourium" }),
  imperial_guard: Object.freeze({ producerTypes: Object.freeze(["outpost", "barracks"]), producerLabel: "Command Headquarters or Barracks" }),
  adeptus_mechanicus: Object.freeze({ producerTypes: Object.freeze(["outpost", "workshop", "researchcenter"]), producerLabel: "Forge Temple, Machine Forge, or Data-Loom" }),
  chaos: Object.freeze({ producerTypes: Object.freeze(["outpost", "barracks"]), producerLabel: "Dark Citadel or Muster Hall" }),
  orks: Object.freeze({ producerTypes: Object.freeze(["barracks", "workshop"]), producerLabel: "Boyz Hut or Mek Shop" }),
  necrons: Object.freeze({ producerTypes: Object.freeze(["outpost", "workshop", "fieldhospital"]), producerLabel: "Tomb Core, Canoptek Forge, or Reanimation Node" }),
  tau: Object.freeze({ producerTypes: Object.freeze(["outpost", "workshop"]), producerLabel: "Command Dome or Earth Caste Workshop" }),
  tyranids: Object.freeze({ producerTypes: Object.freeze(["barracks", "fieldhospital", "refinery"]), producerLabel: "Brood Nest, Reclamation Pool, or Digestion Organ" })
});

export function builderProductionBranchFor(player = {}) {
  return builderWorkforceBranchFor(player);
}

export function builderProductionProfileFor(player = {}) {
  return BUILDER_PRODUCTION[builderProductionBranchFor(player)] || BUILDER_PRODUCTION.imperial_guard;
}

export function builderProducerFor(player, structures = []) {
  return builderProducersFor(player, structures)[0] || null;
}

export function builderProducersFor(player, structures = []) {
  const profile = builderProductionProfileFor(player);
  return structures
    .filter(structure => structure?.faction === player?.id
      && structure.alive !== false
      && Number(structure.progress) >= 1
      && Number(structure.condition ?? 1) >= 0.35
      && profile.producerTypes.includes(structure.type))
    .sort((a, b) => profile.producerTypes.indexOf(a.type) - profile.producerTypes.indexOf(b.type)
      || Number(b.condition ?? 1) - Number(a.condition ?? 1));
}

export function desiredBuilderCount(player = {}, structures = [], configuredTarget = null, workload = {}) {
  return builderWorkforceDemand({ player, structures, configuredTarget, ...workload }).desired;
}

export function builderProductionPriority(livingBuilders, desiredBuilders) {
  const living = Math.max(0, Number(livingBuilders) || 0);
  const desired = Math.max(0, Number(desiredBuilders) || 0);
  if (living >= desired) return 0;
  if (living === 0) return 100;
  return Math.min(98, 84 + Math.round((desired - living - 1) / Math.max(1, desired) * 14));
}
