import { RESOURCE_IDS } from "./ResourceCatalog.js";
import { economyProfileFor } from "./FactionEconomyProfiles.js";

const definition = (id, buildingType, outputs, inputs = {}, options = {}) => Object.freeze({
  id,
  buildingType,
  outputs: Object.freeze(outputs),
  inputs: Object.freeze(inputs),
  bufferCapacity: Math.max(16, Number(options.bufferCapacity) || 120),
  supplyRadius: Math.max(40, Number(options.supplyRadius) || 100),
  graceSeconds: Math.max(0, Number(options.graceSeconds) || 4),
  criticality: Math.max(0, Math.min(1, Number(options.criticality) || 0.5))
});

const commonImperial = [
  definition("imperial-command-tithe", "outpost", { requisition: 6, influence: 1 }, { energy: 0.5 }, { criticality: 1, supplyRadius: 145 }),
  definition("imperial-reactor", "generator", { energy: 15 }, { fuel: 1.5 }, { criticality: 0.9 }),
  definition("imperial-agri-complex", "farm", { food: 11, medical: 1 }, { energy: 0.7 }, { criticality: 0.85 }),
  definition("imperial-material-works", "mine", { materials: 11 }, { energy: 1.2 }, { criticality: 0.75 }),
  definition("imperial-promethium-works", "refinery", { fuel: 9 }, { energy: 2, materials: 0.5 }, { criticality: 0.82 }),
  definition("imperial-manufactorum", "workshop", { ammunition: 7, parts: 4, materials: 2 }, { energy: 3, materials: 1 }, { criticality: 0.9 }),
  definition("imperial-medicae", "fieldhospital", { medical: 5 }, { energy: 1.5, food: 0.5 }, { criticality: 0.78 })
];

export const PRODUCTION_BUILDING_DEFINITIONS = Object.freeze({
  "space-marines": Object.freeze(commonImperial),
  "imperial-guard": Object.freeze(commonImperial.map(item => item.id === "imperial-command-tithe"
    ? definition("guard-command-tithe", "outpost", { requisition: 8 }, { food: 0.6, energy: 0.4 }, { criticality: 1, supplyRadius: 150 })
    : item)),
  orks: Object.freeze([
    definition("ork-boss-tithe", "outpost", { scrap: 7 }, { food: 0.5 }, { criticality: 1, supplyRadius: 140 }),
    definition("ork-kustom-generator", "generator", { fuel: 4, ammunition: 2 }, { scrap: 1.2 }, { criticality: 0.8 }),
    definition("ork-squig-pen", "farm", { food: 12 }, {}, { criticality: 0.82 }),
    definition("ork-lootin-yard", "mine", { scrap: 13 }, { fuel: 0.5 }, { criticality: 0.9 }),
    definition("ork-mek-shop", "workshop", { ammunition: 9, scrap: 3 }, { scrap: 1.5, fuel: 0.7 }, { criticality: 0.88 })
  ]),
  tyranids: Object.freeze([
    definition("tyranid-synaptic-core", "outpost", { biomass: 8 }, { food: 0.4 }, { criticality: 1, supplyRadius: 155 }),
    definition("tyranid-digestion-pool", "farm", { biomass: 12, food: 5 }, {}, { criticality: 0.95 }),
    definition("tyranid-capillary-tower", "generator", { biomass: 5 }, { food: 0.5 }, { criticality: 0.82 }),
    definition("tyranid-spore-forge", "workshop", { biomass: 7 }, { biomass: 1 }, { criticality: 0.72 })
  ]),
  necrons: Object.freeze([
    definition("necron-tomb-core", "outpost", { energy: 8 }, { materials: 0.5 }, { criticality: 1, supplyRadius: 160 }),
    definition("necron-energy-conduit", "generator", { energy: 16 }, {}, { criticality: 0.92 }),
    definition("necron-material-vault", "mine", { materials: 10 }, { energy: 1 }, { criticality: 0.76 }),
    definition("necron-reclamation-node", "farm", { food: 5, materials: 3 }, { energy: 0.6 }, { criticality: 0.65 }),
    definition("necron-canoptek-forge", "workshop", { materials: 6 }, { energy: 2 }, { criticality: 0.84 })
  ]),
  tau: Object.freeze([
    definition("tau-command-allocation", "outpost", { requisition: 6, influence: 2 }, { energy: 0.5 }, { criticality: 1, supplyRadius: 150 }),
    definition("tau-power-core", "generator", { energy: 17 }, { fuel: 1 }, { criticality: 0.93 }),
    definition("tau-agri-dome", "farm", { food: 12, medical: 1 }, { energy: 0.8 }, { criticality: 0.82 }),
    definition("tau-fabrication-mine", "mine", { materials: 10 }, { energy: 1 }, { criticality: 0.78 }),
    definition("tau-fuel-processor", "refinery", { fuel: 9 }, { energy: 2 }, { criticality: 0.8 }),
    definition("tau-earth-caste-workshop", "workshop", { parts: 6, ammunition: 6, materials: 2 }, { energy: 3, materials: 1 }, { criticality: 0.9 }),
    definition("tau-medical-bay", "fieldhospital", { medical: 5 }, { energy: 1.5, food: 0.4 }, { criticality: 0.76 })
  ]),
  chaos: Object.freeze([
    definition("chaos-dark-tithe", "outpost", { requisition: 6, energy: 2 }, { food: 0.5 }, { criticality: 1, supplyRadius: 145 }),
    definition("chaos-warp-nexus", "generator", { energy: 15 }, { fuel: 1 }, { criticality: 0.94 }),
    definition("chaos-thrall-pens", "farm", { food: 10, requisition: 2 }, { energy: 0.5 }, { criticality: 0.8 }),
    definition("chaos-slave-mine", "mine", { materials: 11 }, { energy: 1 }, { criticality: 0.8 }),
    definition("chaos-dark-refinery", "refinery", { fuel: 9 }, { energy: 2, materials: 0.5 }, { criticality: 0.82 }),
    definition("chaos-forge", "workshop", { ammunition: 8, parts: 4, materials: 2 }, { energy: 3, materials: 1 }, { criticality: 0.94 })
  ])
});

export function productionDefinitionsFor(player) {
  return PRODUCTION_BUILDING_DEFINITIONS[economyProfileFor(player).id] || PRODUCTION_BUILDING_DEFINITIONS["space-marines"];
}

export function productionDefinitionForStructure(player, structure = {}) {
  if (structure.productionDefinitionId) {
    const explicit = productionDefinitionsFor(player).find(item => item.id === structure.productionDefinitionId);
    if (explicit) return explicit;
  }
  return productionDefinitionsFor(player).find(item => item.buildingType === structure.type) || null;
}

export function validateProductionCatalog() {
  const errors = [];
  const known = new Set(RESOURCE_IDS);
  for (const [profileId, definitions] of Object.entries(PRODUCTION_BUILDING_DEFINITIONS)) {
    const ids = new Set();
    for (const item of definitions) {
      if (ids.has(item.id)) errors.push(`${profileId}: duplicate ${item.id}`);
      ids.add(item.id);
      if (!item.buildingType) errors.push(`${item.id}: missing buildingType`);
      const outputIds = Object.keys(item.outputs);
      if (!outputIds.length || outputIds.length > 4) errors.push(`${item.id}: outputs must contain 1-4 resources`);
      for (const resource of [...outputIds, ...Object.keys(item.inputs)]) if (!known.has(resource)) errors.push(`${item.id}: unknown resource ${resource}`);
      for (const rate of [...Object.values(item.outputs), ...Object.values(item.inputs)]) if (!(Number(rate) >= 0)) errors.push(`${item.id}: invalid rate`);
    }
  }
  return errors;
}
