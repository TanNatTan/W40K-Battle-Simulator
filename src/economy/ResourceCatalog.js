export const RESOURCE_DEFINITIONS = Object.freeze({
  materials: Object.freeze({ name: "Materials", kind: "stockpile", transportable: true, extractable: true }),
  fuel: Object.freeze({ name: "Fuel", kind: "stockpile", transportable: true, extractable: true }),
  energy: Object.freeze({ name: "Energy", kind: "utility", transportable: false, extractable: true }),
  food: Object.freeze({ name: "Food", kind: "stockpile", transportable: true, extractable: true }),
  scrap: Object.freeze({ name: "Scrap", kind: "stockpile", transportable: true, extractable: true }),
  biomass: Object.freeze({ name: "Biomass", kind: "biological", transportable: true, extractable: true }),
  requisition: Object.freeze({ name: "Requisition", kind: "strategic", transportable: false, extractable: false }),
  influence: Object.freeze({ name: "Influence", kind: "strategic", transportable: false, extractable: false }),
  medical: Object.freeze({ name: "Medical Supplies", kind: "stockpile", transportable: true, extractable: false }),
  parts: Object.freeze({ name: "Vehicle Parts", kind: "stockpile", transportable: true, extractable: false }),
  ammunition: Object.freeze({ name: "Ammunition", kind: "stockpile", transportable: true, extractable: false }),
  security: Object.freeze({ name: "Security", kind: "service", transportable: false, extractable: false })
});

export const RESOURCE_IDS = Object.freeze(Object.keys(RESOURCE_DEFINITIONS));
export const EXTRACTABLE_RESOURCE_IDS = Object.freeze(RESOURCE_IDS.filter(id => RESOURCE_DEFINITIONS[id].extractable));

export function resourceDefinition(resourceId) {
  return RESOURCE_DEFINITIONS[String(resourceId || "").trim().toLowerCase()] || null;
}

export function isKnownResource(resourceId) {
  return Boolean(resourceDefinition(resourceId));
}

export function normalizeResourceId(resourceId, fallback = null) {
  const normalized = String(resourceId || "").trim().toLowerCase();
  return isKnownResource(normalized) ? normalized : fallback;
}
