// Application composition root. Keep simulation, rendering, and UI behavior out
// of this file as those systems move out of the compatibility runtime.
import { EconomyZoneManager } from "./economy/EconomyZoneManager.js";
import { SpatialPartition, TerritorySystem, OBJECTIVE_TYPES } from "./territory/TerritorySystem.js";
import { ConvoyManager, RoadGraph, RouteAI, RouteHistory, RouteManager } from "./logistics/RouteSystem.js";
import { assessFactionCapability, chooseEndgameDirective } from "./victory/VictorySystem.js";
import { ReplayAnalysisSystem, buildAIInspector } from "./replay/ReplayAnalysisSystem.js";
import { SCALE_PRESETS, scalePresetFor } from "./performance/ScaleSystem.js";
import { FACTION_GAMEPLAY_BRANCHES, createFactionGameplayState } from "./factions/DistinctiveGameplaySystem.js";
import { Profiler } from "./diagnostics/Profiler.js";
import { RuntimeTelemetry } from "./diagnostics/RuntimeTelemetry.js";
import { SnapshotRingBuffer } from "./replay/SnapshotRingBuffer.js";
import { runFixedStepBudget } from "./simulation/FixedStepRunner.js";
import { dayNightDarkness, globalDayNightVisibility } from "./rendering/DayNightSystem.js";
import { canAfford, constructionCostFor, economyProfileFor, formationCostFor } from "./economy/FactionEconomyProfiles.js";
import { allocateForceCaps, commandPresenceFor, createForceState, determineCommitment, updateForceState } from "./ai/ForceCommitmentSystem.js";
import { combineStrategicBias, chaosTargetMultiplier, evaluateChaosStrategy } from "./ai/chaos/ChaosStrategySystem.js";
import { CHAOS_SUBFACTION_PROFILES, chaosProfileFor } from "./ai/chaos/ChaosProfiles.js";
import { createChaosOperationalMemory } from "./ai/chaos/ChaosOperationalState.js";
import { StrategicCellIndex } from "./performance/StrategicCellIndex.js";
import { EXTRACTABLE_RESOURCE_IDS, RESOURCE_DEFINITIONS, RESOURCE_IDS } from "./economy/ResourceCatalog.js";

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
  chooseEndgameDirective,
  ReplayAnalysisSystem,
  buildAIInspector,
  SCALE_PRESETS,
  scalePresetFor,
  FACTION_GAMEPLAY_BRANCHES,
  createFactionGameplayState,
  Profiler,
  RuntimeTelemetry,
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
  StrategicCellIndex,
  RESOURCE_DEFINITIONS,
  RESOURCE_IDS,
  EXTRACTABLE_RESOURCE_IDS
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
  const response = await fetch(new URL("../data/maps/economic-presets.json", import.meta.url));
  if (!response.ok) throw new Error(`Economic map data returned ${response.status}`);
  globalThis.AWTData.economicMaps = await response.json();
} catch (error) {
  globalThis.AWTData.economicMaps = { version: 1, presets: {} };
  console.warn("Authored economic map data could not be loaded; maps will begin without economic assets.", error);
}

await import("../js/app.js");
