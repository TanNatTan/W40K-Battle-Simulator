import { RESOURCE_IDS } from "./ResourceCatalog.js";
import { economyProfileFor } from "./FactionEconomyProfiles.js";

const freezeRates = rates => Object.freeze(Object.fromEntries(Object.entries(rates || {}).map(([resource, rate]) => [resource, Number(rate) || 0])));

const definition = (id, buildingType, baseOutputs, inputs = {}, options = {}) => {
  const synergyRules = Object.freeze((options.synergyRules || []).map(rule => Object.freeze({
    requiresTags: Object.freeze([...(rule.requiresTags || [])]),
    minPartners: Math.max(1, Number(rule.minPartners) || 1),
    addOutputs: freezeRates(rule.addOutputs)
  })));
  const outputs = { ...baseOutputs };
  for (const rule of synergyRules) Object.assign(outputs, rule.addOutputs);
  const requestedBuffer = options.bufferCapacity ?? 120;
  const bufferCapacity = typeof requestedBuffer === "object"
    ? Object.freeze(Object.fromEntries(Object.entries(requestedBuffer).map(([resource, amount]) => [resource, Math.max(1, Number(amount) || 1)])))
    : Math.max(16, Number(requestedBuffer) || 120);
  return Object.freeze({
    id,
    buildingType,
    role: options.role || (buildingType === "outpost" ? "headquarters" : "producer"),
    tags: Object.freeze([...new Set([buildingType, ...(options.tags || [])])]),
    baseOutputs: freezeRates(baseOutputs),
    // Compatibility union used by economy capability and UI code. Runtime output
    // selection is resolved from baseOutputs + component synergyRules.
    outputs: freezeRates(outputs),
    inputs: freezeRates(inputs),
    bufferCapacity,
    bootstrapInventory: freezeRates(options.bootstrapInventory),
    synergyRules,
    supplyRadius: Math.max(40, Number(options.supplyRadius) || 100),
    graceSeconds: Math.max(0, Number(options.graceSeconds) || 4),
    criticality: Math.max(0, Math.min(1, Number(options.criticality) || 0.5))
  });
};

const manufacturingSynergies = (parts = 2, materials = 2) => ({
  tags: ["manufacturing"],
  synergyRules: [
    { requiresTags: ["power"], addOutputs: { parts } },
    { requiresTags: ["power", "materials"], addOutputs: { materials } }
  ],
  bufferCapacity: { ammunition: 80, parts: 50, materials: 50 }
});

const commonImperial = [
  definition("imperial-command-tithe", "outpost", { requisition: 6, influence: 1 }, {}, { role: "headquarters", tags: ["headquarters", "command", "power-root"], criticality: 1, supplyRadius: 145, bootstrapInventory: { requisition: 30, influence: 10 } }),
  definition("imperial-reactor", "generator", { energy: 15 }, { fuel: 1.5 }, { tags: ["power"], criticality: 0.9 }),
  definition("imperial-agri-complex", "farm", { food: 11, medical: 1 }, { energy: 0.7 }, { tags: ["food", "medical"], criticality: 0.85 }),
  definition("imperial-material-works", "mine", { materials: 11 }, { energy: 1.2 }, { tags: ["materials"], criticality: 0.75 }),
  definition("imperial-promethium-works", "refinery", { fuel: 9 }, { energy: 2, materials: 0.5 }, { tags: ["fuel"], criticality: 0.82 }),
  definition("imperial-manufactorum", "workshop", { ammunition: 7 }, { energy: 3, materials: 1 }, { ...manufacturingSynergies(4, 2), criticality: 0.9 }),
  definition("imperial-medicae", "fieldhospital", { medical: 5 }, { energy: 1.5, food: 0.5 }, { tags: ["medical"], criticality: 0.78 })
];

export const PRODUCTION_BUILDING_DEFINITIONS = Object.freeze({
  "space-marines": Object.freeze(commonImperial),
  "imperial-guard": Object.freeze(commonImperial.map(item => item.id === "imperial-command-tithe"
    ? definition("guard-command-tithe", "outpost", { requisition: 8 }, {}, { role: "headquarters", tags: ["headquarters", "command", "power-root"], criticality: 1, supplyRadius: 150, bootstrapInventory: { requisition: 36, food: 12 } })
    : item)),
  orks: Object.freeze([
    definition("ork-boss-tithe", "outpost", { scrap: 7 }, {}, { role: "headquarters", tags: ["headquarters", "command", "power-root"], criticality: 1, supplyRadius: 140, bootstrapInventory: { scrap: 36, food: 14 } }),
    definition("ork-kustom-generator", "generator", { fuel: 4, ammunition: 2 }, { scrap: 1.2 }, { tags: ["power"], criticality: 0.8 }),
    definition("ork-squig-pen", "farm", { food: 12 }, {}, { tags: ["food"], criticality: 0.82 }),
    definition("ork-lootin-yard", "mine", { scrap: 13 }, { fuel: 0.5 }, { tags: ["materials", "scrap"], criticality: 0.9 }),
    definition("ork-mek-shop", "workshop", { ammunition: 9 }, { scrap: 1.5, fuel: 0.7 }, { tags: ["manufacturing"], synergyRules: [{ requiresTags: ["power"], addOutputs: { scrap: 3 } }], bufferCapacity: { ammunition: 90, scrap: 70 }, criticality: 0.88 })
  ]),
  tyranids: Object.freeze([
    definition("tyranid-synaptic-core", "outpost", { biomass: 8 }, {}, { role: "headquarters", tags: ["headquarters", "command", "power-root", "synapse"], criticality: 1, supplyRadius: 155, bootstrapInventory: { biomass: 42, food: 12 } }),
    definition("tyranid-digestion-pool", "farm", { biomass: 12, food: 5 }, {}, { tags: ["food", "materials"], criticality: 0.95 }),
    definition("tyranid-capillary-tower", "generator", { biomass: 5 }, { food: 0.5 }, { tags: ["power", "synapse"], criticality: 0.82 }),
    definition("tyranid-spore-forge", "workshop", { biomass: 7 }, { biomass: 1 }, { tags: ["manufacturing"], criticality: 0.72 })
  ]),
  necrons: Object.freeze([
    definition("necron-tomb-core", "outpost", { energy: 8 }, {}, { role: "headquarters", tags: ["headquarters", "command", "power-root"], criticality: 1, supplyRadius: 160, bootstrapInventory: { energy: 40, materials: 12 } }),
    definition("necron-energy-conduit", "generator", { energy: 16 }, {}, { tags: ["power"], criticality: 0.92 }),
    definition("necron-material-vault", "mine", { materials: 10 }, { energy: 1 }, { tags: ["materials"], criticality: 0.76 }),
    definition("necron-reclamation-node", "farm", { food: 5, materials: 3 }, { energy: 0.6 }, { criticality: 0.65 }),
    definition("necron-canoptek-forge", "workshop", { materials: 6 }, { energy: 2 }, { tags: ["manufacturing"], criticality: 0.84 })
  ]),
  tau: Object.freeze([
    definition("tau-command-allocation", "outpost", { requisition: 6, influence: 2 }, {}, { role: "headquarters", tags: ["headquarters", "command", "power-root"], criticality: 1, supplyRadius: 150, bootstrapInventory: { requisition: 30, influence: 12 } }),
    definition("tau-power-core", "generator", { energy: 17 }, { fuel: 1 }, { tags: ["power"], criticality: 0.93 }),
    definition("tau-agri-dome", "farm", { food: 12, medical: 1 }, { energy: 0.8 }, { criticality: 0.82 }),
    definition("tau-fabrication-mine", "mine", { materials: 10 }, { energy: 1 }, { tags: ["materials"], criticality: 0.78 }),
    definition("tau-fuel-processor", "refinery", { fuel: 9 }, { energy: 2 }, { tags: ["fuel"], criticality: 0.8 }),
    definition("tau-earth-caste-workshop", "workshop", { ammunition: 6 }, { energy: 3, materials: 1 }, { ...manufacturingSynergies(6, 2), criticality: 0.9 }),
    definition("tau-medical-bay", "fieldhospital", { medical: 5 }, { energy: 1.5, food: 0.4 }, { criticality: 0.76 })
  ]),
  chaos: Object.freeze([
    definition("chaos-dark-tithe", "outpost", { requisition: 6, energy: 2 }, {}, { role: "headquarters", tags: ["headquarters", "command", "power-root", "warp"], criticality: 1, supplyRadius: 145, bootstrapInventory: { requisition: 30, energy: 16 } }),
    definition("chaos-warp-nexus", "generator", { energy: 15 }, { fuel: 1 }, { tags: ["power", "warp"], criticality: 0.94 }),
    definition("chaos-thrall-pens", "farm", { food: 10, requisition: 2 }, { energy: 0.5 }, { criticality: 0.8 }),
    definition("chaos-slave-mine", "mine", { materials: 11 }, { energy: 1 }, { tags: ["materials"], criticality: 0.8 }),
    definition("chaos-dark-refinery", "refinery", { fuel: 9 }, { energy: 2, materials: 0.5 }, { tags: ["fuel"], criticality: 0.82 }),
    definition("chaos-forge", "workshop", { ammunition: 8 }, { energy: 3, materials: 1 }, { ...manufacturingSynergies(4, 2), tags: ["manufacturing", "warp"], criticality: 0.94 })
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
      if (!item.tags.length) errors.push(`${item.id}: missing topology tags`);
      const outputIds = Object.keys(item.outputs);
      if (!outputIds.length || outputIds.length > 4) errors.push(`${item.id}: outputs must contain 1-4 resources`);
      for (const resource of [...outputIds, ...Object.keys(item.inputs), ...Object.keys(item.bootstrapInventory)]) if (!known.has(resource)) errors.push(`${item.id}: unknown resource ${resource}`);
      for (const rate of [...Object.values(item.outputs), ...Object.values(item.inputs), ...Object.values(item.bootstrapInventory)]) if (!(Number(rate) >= 0)) errors.push(`${item.id}: invalid rate`);
      for (const rule of item.synergyRules) if (!rule.requiresTags.length) errors.push(`${item.id}: synergy rule has no required tags`);
    }
  }
  return errors;
}
