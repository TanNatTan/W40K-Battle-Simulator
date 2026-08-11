// Application composition root. Keep simulation, rendering, and UI behavior out
// of this file as those systems move out of the compatibility runtime.
import { EconomyZoneManager } from "./economy/EconomyZoneManager.js";
import { SpatialPartition, TerritorySystem, OBJECTIVE_TYPES } from "./territory/TerritorySystem.js";
import { ConvoyManager, RoadGraph, RouteAI, RouteHistory, RouteManager } from "./logistics/RouteSystem.js";
import { assessFactionCapability, battleObjectiveVictoryReady, chooseEndgameDirective } from "./victory/VictorySystem.js";
import { ReplayAnalysisSystem, buildAIInspector } from "./replay/ReplayAnalysisSystem.js";
import { SCALE_PRESETS, WorkBudget, scalePresetFor } from "./performance/ScaleSystem.js";
import { FACTION_GAMEPLAY_BRANCHES, createFactionGameplayState } from "./factions/DistinctiveGameplaySystem.js";
import { Profiler } from "./diagnostics/Profiler.js";
import { RuntimeTelemetry } from "./diagnostics/RuntimeTelemetry.js";
import { ConstructionTelemetry } from "./diagnostics/ConstructionTelemetry.js";
import { SnapshotRingBuffer } from "./replay/SnapshotRingBuffer.js";
import { runFixedStepBudget } from "./simulation/FixedStepRunner.js";
import { dayNightDarkness, globalDayNightVisibility } from "./rendering/DayNightSystem.js";
import { canAfford, constructionCostFor, economyProfileFor, formationCostFor } from "./economy/FactionEconomyProfiles.js";
import { allocateForceCaps, commandPresenceFor, createForceState, determineCommitment, updateForceState } from "./ai/ForceCommitmentSystem.js";
import { combineStrategicBias, chaosTargetMultiplier, evaluateChaosStrategy } from "./ai/chaos/ChaosStrategySystem.js";
import { CHAOS_SUBFACTION_PROFILES, chaosProfileFor } from "./ai/chaos/ChaosProfiles.js";
import { createChaosOperationalMemory } from "./ai/chaos/ChaosOperationalState.js";
import { CHAOS_PROFILE_ACTIONS, createChaosStrategicState, selectChaosAction } from "./ai/chaos/ChaosCapabilitySystem.js";
import { createOperationalMemory, evaluateOperationalPhase } from "./ai/OperationalPhaseSystem.js";
import { ACTIVITY_RATE_MULTIPLIER, RateGate, activityRateMultiplier, effectiveObjectiveFocus, objectiveInterpretationMethod, resolveWarfareDoctrine, scoreTacticalOpportunity } from "./ai/WarfareDoctrineSystem.js";
import { StrategicCellIndex } from "./performance/StrategicCellIndex.js";
import { analyzeDistantSnapshot, analyzeDistantUnits, packDistantUnits } from "./performance/DistantSimulation.js";
import { EXTRACTABLE_RESOURCE_IDS, RESOURCE_DEFINITIONS, RESOURCE_IDS } from "./economy/ResourceCatalog.js";
import { allocateArmyRoles, calculateArmyRoleBudget } from "./ai/ArmyRoleAllocator.js";
import { captureTargetsFor, scoreCaptureTarget, selectCaptureTarget } from "./ai/CaptureObjectiveSystem.js";
import { actionCost, calculateCost, canAffordCost, costForManifest, mergeCosts, spendCost, trainingDelayFor, unitCostFor } from "./economy/CostSystem.js";
import { LOADOUT_RULES, scoreWeapon, selectSpaceMarineWargear } from "./combat/WargearSelectionSystem.js";
import { RESOURCE_CARRIER_STATES, assignResourceCarrier, desiredResourceCarriers, ensureResourceCarrierState, setResourceCarrierState } from "./logistics/ResourceCarrierSystem.js";
import { SupplyNetwork } from "./logistics/SupplyNetwork.js";
import { PRODUCTION_BUILDING_DEFINITIONS, productionDefinitionForStructure, productionDefinitionsFor, validateProductionCatalog } from "./economy/ProductionBuildingCatalog.js";
import { updateProductionBuilding } from "./economy/ProductionSystem.js";
import { createStartingHeadquarters, spawnZoneCentroid } from "./economy/BattleBootstrapSystem.js";
import { normalizeConstructionProject, selectConstructionProject } from "./economy/ConstructionPlanningSystem.js";
import { LEGACY_RESOURCE_ZONE_DIAGNOSTIC, migrateLegacyResourceZones } from "./economy/EconomyMigration.js";
import { ECONOMY_SECURITY_TUNING, assessEconomySecurity, assessMacroReadiness, canDispatchEconomicExpedition, criticalProducerClusters, updateEconomySecurityMemory } from "./ai/EconomySecurityPolicy.js";
import { ENEMY_CONDITION_STATES, assessEnemyCondition, estimatedFriendlyDamageAssigned, finishOpportunityFor, overkillPenaltyFor } from "./ai/TargetAssessmentSystem.js";
import { FACTION_OBJECTIVE_METHODS, resolveFactionObjectiveDoctrine } from "./ai/FactionObjectiveDoctrine.js";
import { STRATEGIC_PORTFOLIO_BASES, createStrategicPortfolio, portfolioRoleFloors } from "./ai/StrategicPortfolioSystem.js";
import { chooseRegroupPoint, pointInPolygon, regroupCandidates } from "./ai/RegroupPointSystem.js";
import { BUILDING_CLEARANCE, blocksServiceCorridor, buildingClearanceFor, placementRectsOverlap } from "./construction/BaseLayoutSystem.js";
import { REPAIR_BALANCE, SUSTAINMENT_PROFILES, SUSTAINMENT_SERVICES, buildingRepairRate, buildSustainmentRequests, factionSustainmentCost, fieldServiceLimit, providerCanService, repairInteractionRange, selectSustainmentRequest, sustainmentCostFor, sustainmentProfileFor, sustainmentRequestFor } from "./support/SustainmentSystem.js";
import { createNavigationMonitor, ensureNavigationMonitor, markNavigationRecovery, movementDiagnostic, navigationFingerprint, rememberFailedPath, sampleNavigationProgress } from "./map/MovementProgressSystem.js";
import { chooseRecoveryPoint, clearNavigationState, recoveryRingCandidates } from "./map/StuckRecoverySystem.js";
import { IDEAL_BUILDERS, constructionRefund, constructionSiteKey, createConstructionState, desiredBuildersFor, evaluateConstructionCancellation } from "./construction/ConstructionSystem.js";
import { chooseBuilderAssignment, scoreProjectForBuilder } from "./construction/BuilderAssignmentSystem.js";
import { SUPPLY_TRANSPORT_SPEED, convoyBaseSpeed, convoyEffectiveSpeed, convoyMovementFactor } from "./logistics/ConvoyMovementSystem.js";
import { BUILDER_PRODUCTION, builderProducerFor, builderProductionPriority, builderProductionProfileFor, desiredBuilderCount } from "./construction/BuilderProductionSystem.js";
import { constrainPointToSpawnZone, structureFitsInsideSpawnZone, unitFitsInsideSpawnZone } from "./construction/BuilderContainmentSystem.js";
import { EMERALD_SUNS, applyChapterBattleAdaptation, chapterMedicalModifiersFor, chapterVisualDefaultsFor, isEmeraldSuns } from "./ai/SpaceMarineChapterSystem.js";
import { SUBFACTION_BUILDINGS, SUBFACTION_BUILDING_ORDER, SUBFACTION_BUILDING_SLOTS, subfactionBuildingLabelFor, subfactionBuildingProfileFor, subfactionBuildingTypesFor, validateSubfactionBuildingCatalog } from "./factions/SubfactionBuildingSystem.js";
import { BUILDER_REPAIR_ASSIGNMENT_TTL, BUILDER_REPAIR_CREW_LIMIT, SERVITOR_REPAIR_ASSIGNMENT_TTL, activeRepairCrewCount, builderRepairCrewLimit, builderRepairSlotAvailable, claimRepairAssignment, releaseStaleRepairAssignment, servitorRepairCrewLimit, servitorRepairSlotAvailable } from "./construction/RepairCrewSystem.js";
import { ACTIVE_FORCE_ROLES, PASSIVE_FORCE_ROLES, desiredActiveForceRatio, enforceActiveForceRatio } from "./ai/ActiveForceSystem.js";
import { BUILDING_CAPACITY_CLASSES, TERRITORY_BUILD_CAPS, buildingCapacityClass, constructionCapacityForCell, countBuildingsByCapacityClass, territoryCapacityAvailable } from "./territory/TerritoryConstructionSystem.js";

globalThis.AWTSystems = Object.freeze({
  EconomyZoneManager,
  SpatialPartition,
  TerritorySystem,
  OBJECTIVE_TYPES,
  ConvoyManager,
  RoadGraph,
  RouteAI,
  RouteHistory,
  RouteManager,
  assessFactionCapability,
  battleObjectiveVictoryReady,
  chooseEndgameDirective,
  ReplayAnalysisSystem,
  buildAIInspector,
  SCALE_PRESETS,
  WorkBudget,
  scalePresetFor,
  FACTION_GAMEPLAY_BRANCHES,
  createFactionGameplayState,
  Profiler,
  RuntimeTelemetry,
  ConstructionTelemetry,
  SnapshotRingBuffer,
  runFixedStepBudget,
  dayNightDarkness,
  globalDayNightVisibility,
  economyProfileFor,
  formationCostFor,
  constructionCostFor,
  canAfford,
  allocateForceCaps,
  commandPresenceFor,
  createForceState,
  determineCommitment,
  updateForceState,
  evaluateChaosStrategy,
  combineStrategicBias,
  chaosTargetMultiplier,
  CHAOS_SUBFACTION_PROFILES,
  chaosProfileFor,
  createChaosOperationalMemory,
  CHAOS_PROFILE_ACTIONS,
  createChaosStrategicState,
  selectChaosAction,
  createOperationalMemory,
  evaluateOperationalPhase,
  ACTIVITY_RATE_MULTIPLIER,
  RateGate,
  activityRateMultiplier,
  effectiveObjectiveFocus,
  objectiveInterpretationMethod,
  resolveWarfareDoctrine,
  scoreTacticalOpportunity,
  StrategicCellIndex,
  analyzeDistantUnits,
  analyzeDistantSnapshot,
  packDistantUnits,
  RESOURCE_DEFINITIONS,
  RESOURCE_IDS,
  EXTRACTABLE_RESOURCE_IDS,
  allocateArmyRoles,
  calculateArmyRoleBudget,
  captureTargetsFor,
  scoreCaptureTarget,
  selectCaptureTarget,
  actionCost,
  calculateCost,
  canAffordCost,
  costForManifest,
  mergeCosts,
  spendCost,
  trainingDelayFor,
  unitCostFor,
  LOADOUT_RULES,
  scoreWeapon,
  selectSpaceMarineWargear,
  RESOURCE_CARRIER_STATES,
  assignResourceCarrier,
  desiredResourceCarriers,
  ensureResourceCarrierState,
  setResourceCarrierState,
  SupplyNetwork,
  PRODUCTION_BUILDING_DEFINITIONS,
  productionDefinitionForStructure,
  productionDefinitionsFor,
  validateProductionCatalog,
  updateProductionBuilding,
  createStartingHeadquarters,
  spawnZoneCentroid,
  normalizeConstructionProject,
  selectConstructionProject,
  LEGACY_RESOURCE_ZONE_DIAGNOSTIC,
  migrateLegacyResourceZones,
  ECONOMY_SECURITY_TUNING,
  assessEconomySecurity,
  assessMacroReadiness,
  canDispatchEconomicExpedition,
  criticalProducerClusters,
  updateEconomySecurityMemory,
  ENEMY_CONDITION_STATES,
  assessEnemyCondition,
  estimatedFriendlyDamageAssigned,
  finishOpportunityFor,
  overkillPenaltyFor,
  FACTION_OBJECTIVE_METHODS,
  resolveFactionObjectiveDoctrine,
  STRATEGIC_PORTFOLIO_BASES,
  createStrategicPortfolio,
  portfolioRoleFloors,
  chooseRegroupPoint,
  pointInPolygon,
  regroupCandidates,
  BUILDING_CLEARANCE,
  blocksServiceCorridor,
  buildingClearanceFor,
  placementRectsOverlap,
  SUSTAINMENT_PROFILES,
  SUSTAINMENT_SERVICES,
  REPAIR_BALANCE,
  buildingRepairRate,
  buildSustainmentRequests,
  factionSustainmentCost,
  fieldServiceLimit,
  providerCanService,
  repairInteractionRange,
  selectSustainmentRequest,
  sustainmentCostFor,
  sustainmentProfileFor,
  sustainmentRequestFor,
  createNavigationMonitor,
  ensureNavigationMonitor,
  markNavigationRecovery,
  movementDiagnostic,
  navigationFingerprint,
  rememberFailedPath,
  sampleNavigationProgress,
  chooseRecoveryPoint,
  clearNavigationState,
  recoveryRingCandidates,
  IDEAL_BUILDERS,
  constructionRefund,
  constructionSiteKey,
  createConstructionState,
  desiredBuildersFor,
  evaluateConstructionCancellation,
  chooseBuilderAssignment,
  scoreProjectForBuilder,
  SUPPLY_TRANSPORT_SPEED,
  convoyBaseSpeed,
  convoyEffectiveSpeed,
  convoyMovementFactor,
  BUILDER_PRODUCTION,
  builderProducerFor,
  builderProductionPriority,
  builderProductionProfileFor,
  desiredBuilderCount,
  constrainPointToSpawnZone,
  structureFitsInsideSpawnZone,
  unitFitsInsideSpawnZone,
  EMERALD_SUNS,
  applyChapterBattleAdaptation,
  chapterMedicalModifiersFor,
  chapterVisualDefaultsFor,
  isEmeraldSuns,
  SUBFACTION_BUILDINGS,
  SUBFACTION_BUILDING_ORDER,
  SUBFACTION_BUILDING_SLOTS,
  subfactionBuildingLabelFor,
  subfactionBuildingProfileFor,
  subfactionBuildingTypesFor,
  validateSubfactionBuildingCatalog,
  SERVITOR_REPAIR_ASSIGNMENT_TTL,
  BUILDER_REPAIR_ASSIGNMENT_TTL,
  activeRepairCrewCount,
  BUILDER_REPAIR_CREW_LIMIT,
  builderRepairCrewLimit,
  builderRepairSlotAvailable,
  claimRepairAssignment,
  releaseStaleRepairAssignment,
  servitorRepairCrewLimit,
  servitorRepairSlotAvailable,
  ACTIVE_FORCE_ROLES,
  PASSIVE_FORCE_ROLES,
  desiredActiveForceRatio,
  enforceActiveForceRatio,
  BUILDING_CAPACITY_CLASSES,
  TERRITORY_BUILD_CAPS,
  buildingCapacityClass,
  constructionCapacityForCell,
  countBuildingsByCapacityClass,
  territoryCapacityAvailable
});
globalThis.AWTData ||= {};
try {
  const response = await fetch(new URL("../data/economy/resources.json", import.meta.url));
  if (!response.ok) throw new Error(`Resource catalog returned ${response.status}`);
  globalThis.AWTData.resources = await response.json();
} catch (error) {
  globalThis.AWTData.resources = { version: 2, resources: RESOURCE_DEFINITIONS };
  console.warn("Resource catalog could not be loaded; built-in resource definitions will be used.", error);
}

try {
  const response = await fetch(new URL("../data/weapons.json", import.meta.url));
  if (!response.ok) throw new Error(`Weapon data returned ${response.status}`);
  globalThis.AWTData.weapons = await response.json();
} catch (error) {
  globalThis.AWTData.weapons = {};
  console.warn("Weapon data could not be loaded; the combat fallback profile will be used.", error);
}

try {
  const response = await fetch(new URL("../data/ai/faction-branches.json", import.meta.url));
  if (!response.ok) throw new Error(`Faction AI data returned ${response.status}`);
  globalThis.AWTData.factionAI = await response.json();
} catch (error) {
  globalThis.AWTData.factionAI = null;
  console.warn("Faction AI data could not be loaded; built-in race profiles will be used.", error);
}

try {
  const response = await fetch(new URL("../data/ai/battle-objectives.json", import.meta.url));
  if (!response.ok) throw new Error(`Battle objective data returned ${response.status}`);
  globalThis.AWTData.battleObjectives = await response.json();
} catch (error) {
  globalThis.AWTData.battleObjectives = { version: 1, defaultObjective: "annihilation", objectives: {} };
  console.warn("Battle objective data could not be loaded; annihilation will be used as the fallback.", error);
}

try {
  const response = await fetch(new URL("../data/ai/warfare-doctrines.json", import.meta.url));
  if (!response.ok) throw new Error(`Warfare doctrine data returned ${response.status}`);
  globalThis.AWTData.warfareDoctrines = await response.json();
} catch (error) {
  globalThis.AWTData.warfareDoctrines = { schemaVersion: 1, objectiveInterpretation: {}, tickProfiles: {}, subfactions: {} };
  console.warn("Warfare doctrine data could not be loaded; race-profile fallbacks will be used.", error);
}

try {
  const response = await fetch(new URL("../data/ai/wargear-doctrines.json", import.meta.url));
  if (!response.ok) throw new Error(`Wargear doctrine data returned ${response.status}`);
  globalThis.AWTData.wargearDoctrines = await response.json();
} catch (error) {
  globalThis.AWTData.wargearDoctrines = { version: 1, weapons: {}, chapters: {} };
  console.warn("Wargear doctrine data could not be loaded; standard weapons will be used.", error);
}

try {
  const response = await fetch(new URL("../data/economy/costs.json", import.meta.url));
  if (!response.ok) throw new Error(`Cost data returned ${response.status}`);
  globalThis.AWTData.costs = await response.json();
} catch (error) {
  globalThis.AWTData.costs = { version: 1, defaults: {}, units: {}, actions: {} };
  console.warn("Cost data could not be loaded; faction fallback costs will be used.", error);
}

try {
  const response = await fetch(new URL("../data/maps/economic-presets.json", import.meta.url));
  if (!response.ok) throw new Error(`Economic map data returned ${response.status}`);
  globalThis.AWTData.economicMaps = await response.json();
} catch (error) {
  globalThis.AWTData.economicMaps = { version: 1, presets: {} };
  console.warn("Authored economic map data could not be loaded; maps will begin without economic assets.", error);
}

await import("../js/app.js");
