const normalize = value => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

export const BUILDER_PRODUCTION = Object.freeze({
  space_marines: Object.freeze({ producerTypes: Object.freeze(["outpost"]), producerLabel: "Fortress Monastery" }),
  imperial_guard: Object.freeze({ producerTypes: Object.freeze(["outpost", "barracks"]), producerLabel: "Command Headquarters or Barracks" }),
  adeptus_mechanicus: Object.freeze({ producerTypes: Object.freeze(["outpost", "workshop"]), producerLabel: "Forge Temple or Cybernetica Workshop" }),
  chaos: Object.freeze({ producerTypes: Object.freeze(["outpost"]), producerLabel: "Dark Citadel" }),
  orks: Object.freeze({ producerTypes: Object.freeze(["barracks"]), producerLabel: "Boyz Hut" }),
  necrons: Object.freeze({ producerTypes: Object.freeze(["outpost"]), producerLabel: "Tomb Core" }),
  tau: Object.freeze({ producerTypes: Object.freeze(["workshop"]), producerLabel: "Earth Caste Workshop" }),
  tyranids: Object.freeze({ producerTypes: Object.freeze(["barracks"]), producerLabel: "Brood Nest" })
});

export function builderProductionBranchFor(player = {}) {
  const race = normalize(player.race);
  const faction = normalize(player.faction);
  if (faction.includes("space_marines")) return "space_marines";
  if (faction.includes("machine_cult") || faction.includes("mechanicus")) return "adeptus_mechanicus";
  if (faction.includes("imperial_guard")) return "imperial_guard";
  if (race.includes("chaos")) return "chaos";
  if (race.includes("ork")) return "orks";
  if (race.includes("necron")) return "necrons";
  if (race.includes("tau") || race.includes("t_au")) return "tau";
  if (race.includes("tyranid")) return "tyranids";
  return "imperial_guard";
}

export function builderProductionProfileFor(player = {}) {
  return BUILDER_PRODUCTION[builderProductionBranchFor(player)] || BUILDER_PRODUCTION.imperial_guard;
}

export function builderProducerFor(player, structures = []) {
  const profile = builderProductionProfileFor(player);
  return structures
    .filter(structure => structure?.faction === player?.id
      && structure.alive !== false
      && Number(structure.progress) >= 1
      && Number(structure.condition ?? 1) >= 0.35
      && profile.producerTypes.includes(structure.type))
    .sort((a, b) => profile.producerTypes.indexOf(a.type) - profile.producerTypes.indexOf(b.type)
      || Number(b.condition ?? 1) - Number(a.condition ?? 1))[0] || null;
}

export function desiredBuilderCount(player = {}, structures = [], configuredTarget = null) {
  const heavyBuilderFaction = ["orks", "necrons"].includes(builderProductionBranchFor(player));
  const minimum = heavyBuilderFaction ? 6 : 2;
  const maximum = heavyBuilderFaction ? 8 : 4;
  const completedStructures = structures.filter(structure => structure?.faction === player.id && structure.alive !== false && Number(structure.progress) >= 1).length;
  const growthTarget = minimum + Math.floor(completedStructures / (heavyBuilderFaction ? 7 : 6));
  const requested = Number.isFinite(Number(configuredTarget)) ? Number(configuredTarget) : minimum;
  return Math.max(minimum, Math.min(maximum, Math.max(requested, growthTarget)));
}

export function builderProductionPriority(livingBuilders, desiredBuilders) {
  const living = Math.max(0, Number(livingBuilders) || 0);
  const desired = Math.max(0, Number(desiredBuilders) || 0);
  if (living >= desired) return 0;
  if (living === 0) return 100;
  return Math.min(98, 84 + Math.round((desired - living - 1) / Math.max(1, desired) * 14));
}
