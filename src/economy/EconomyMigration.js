import { productionDefinitionForStructure } from "./ProductionBuildingCatalog.js";

export const LEGACY_RESOURCE_ZONE_DIAGNOSTIC = "LEGACY_RESOURCE_ZONE_REQUIRES_AUTHOR_REVIEW";

export function migrateLegacyResourceZones({ resourceZones = [], structures = [], carriers = [], players = [] } = {}) {
  const diagnostics = [];
  const migrated = [];
  const playerById = new Map(players.map(player => [player.id, player]));
  for (const zone of resourceZones) {
    const owner = zone.owner || zone.startingOwner || "";
    const extractor = owner && structures.find(item => item.faction === owner && item.alive !== false && ["mine", "farm", "refinery", "generator", "workshop"].includes(item.type)
      && Math.hypot((item.x || 0) - (zone.x || zone.center?.x || 0), (item.y || 0) - (zone.y || zone.center?.y || 0)) <= 140);
    if (extractor) {
      const definition = productionDefinitionForStructure(playerById.get(owner), extractor);
      if (definition) extractor.productionDefinitionId = definition.id;
      delete extractor.resourceNodeId;
      delete extractor.depositStatus;
      migrated.push({ zoneId: zone.id, structureId: extractor.id, productionDefinitionId: definition?.id || null });
    } else diagnostics.push({ code: LEGACY_RESOURCE_ZONE_DIAGNOSTIC, zoneId: zone.id, owner, message: owner ? "Owned legacy zone has no extractor; no free building was created." : "Neutral legacy zone requires an authored landmark or production building." });
  }
  const zoneIds = new Set(resourceZones.map(zone => zone.id));
  for (const carrier of carriers) {
    const assignment = carrier.logisticsState;
    if (!assignment || assignment.sourceKind !== "resource-zone" || !zoneIds.has(assignment.sourceId)) continue;
    if ((carrier.resourceCargo?.amount || assignment.cargo || 0) > 0) {
      assignment.state = "travelling-to-storage";
      assignment.sourceId = null;
      assignment.sourceKind = null;
    } else {
      assignment.state = "idle";
      assignment.sourceId = null;
      assignment.sourceKind = null;
      carrier.resourceZoneTargetId = null;
    }
  }
  return { migrated, diagnostics, resourceZones: [] };
}
