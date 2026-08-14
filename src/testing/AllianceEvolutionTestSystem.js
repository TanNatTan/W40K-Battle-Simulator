export const ALLIANCE_EVOLUTION_PLAYERS = Object.freeze([
  Object.freeze({ slot: 0, race: "Imperium", faction: "Space Marines", subfaction: "Imperial Fists", team: "1" }),
  Object.freeze({ slot: 1, race: "Imperium", faction: "Space Marines", subfaction: "Blood Angels", team: "1" }),
  Object.freeze({ slot: 2, race: "Orks", faction: "Redfang Horde", subfaction: "Ironjaw Mob", team: "2" }),
  Object.freeze({ slot: 3, race: "Orks", faction: "Scrap Legion", subfaction: "Bad Moon Mob", team: "2" })
]);

export const ALLIANCE_EVOLUTION_RULES = Object.freeze({
  runDurationMs: 10 * 60 * 1000,
  consecutivePasses: 3,
  targetFps: 50,
  minimumFps: 30,
  maximumFrameMs: 250,
  maximumP95FrameMs: 33.3
});

const ratio = (value, total) => total > 0 ? value / total : 0;
const check = (name, passed, actual, required) => Object.freeze({ name, passed: Boolean(passed), actual, required });

function sharedChecks(metrics = {}) {
  return [
    check("battle objective active", metrics.objectiveActive, metrics.objectiveActive, true),
    check("economy remains operational", metrics.economyOperational, metrics.economyOperational, true),
    check("builder replacement available", metrics.builderReplacement, metrics.builderReplacement, true),
    check("infantry and vehicles both fielded", metrics.infantry > 0 && metrics.vehicles > 0, `${metrics.infantry}/${metrics.vehicles}`, ">0 / >0"),
    check("continued production", metrics.producedUnits > 0 && metrics.newBuildings > 0, `${metrics.producedUnits}/${metrics.newBuildings}`, ">0 / >0"),
    check("useful forward logistics", !metrics.frontlineDistant || metrics.forwardLogistics >= 1, metrics.forwardLogistics, metrics.frontlineDistant ? 1 : 0),
    check("army has map presence", metrics.mapPresence >= 0.55, metrics.mapPresence, 0.55)
  ];
}

function factionChecks(metrics = {}) {
  const shared = sharedChecks(metrics);
  if (metrics.subfaction === "Imperial Fists") return [...shared,
    check("100 infantry", metrics.infantry >= 100, metrics.infantry, 100),
    check("10 viable squads", metrics.viableSquads >= 10, metrics.viableSquads, 10),
    check("20% heavy/ranged", ratio(metrics.heavyRanged, metrics.infantry) >= 0.2, ratio(metrics.heavyRanged, metrics.infantry), 0.2),
    check("two defensive forward positions", metrics.defensiveForwardPositions >= 2, metrics.defensiveForwardPositions, 2),
    check("important forward areas supported", metrics.coveredForwardAreas >= metrics.importantForwardAreas, metrics.coveredForwardAreas, metrics.importantForwardAreas),
    check("four vehicles or Dreadnoughts", metrics.vehicles >= 4, metrics.vehicles, 4),
    check("counterattack behavior", metrics.counterattacks >= 1, metrics.counterattacks, 1),
    check("offensive contribution", metrics.offensiveContribution > 0, metrics.offensiveContribution, ">0"),
    check("supports Blood Angels", metrics.allySupport > 0, metrics.allySupport, ">0")
  ];
  if (metrics.subfaction === "Blood Angels") return [...shared,
    check("100 infantry", metrics.infantry >= 100, metrics.infantry, 100),
    check("10 viable squads", metrics.viableSquads >= 10, metrics.viableSquads, 10),
    check("25% assault/mobile melee", ratio(metrics.assaultStrength, metrics.infantry) >= 0.25, ratio(metrics.assaultStrength, metrics.infantry), 0.25),
    check("jump engagement and withdrawal", metrics.jumpMissions >= 1 && metrics.regroups >= 1, `${metrics.jumpMissions}/${metrics.regroups}`, ">=1 / >=1"),
    check("three fast vehicles/transports", metrics.fastVehicles >= 3, metrics.fastVehicles, 3),
    check("no repeated failed attacks", metrics.repeatedFailedAttacks === 0, metrics.repeatedFailedAttacks, 0),
    check("holds objectives", metrics.objectivePresence > 0, metrics.objectivePresence, ">0"),
    check("supports Imperial Fists", metrics.allySupport > 0, metrics.allySupport, ">0")
  ];
  if (metrics.subfaction === "Ironjaw Mob") return [...shared,
    check("120 combat infantry", metrics.infantry >= 120, metrics.infantry, 120),
    check("12 mobs", metrics.viableSquads >= 12, metrics.viableSquads, 12),
    check("55% melee strength", ratio(metrics.meleeStrength, metrics.infantry) >= 0.55, ratio(metrics.meleeStrength, metrics.infantry), 0.55),
    check("Slugga/Nob/Tankbusta core", metrics.coreDoctrineUnits >= 3, metrics.coreDoctrineUnits, 3),
    check("four walkers/transports", metrics.vehicles >= 4, metrics.vehicles, 4),
    check("two Waaagh banner anchors", metrics.waaaghBannerAnchors >= 2, metrics.waaaghBannerAnchors, 2),
    check("multiple mob concentrations", metrics.mobConcentrations >= 2, metrics.mobConcentrations, 2),
    check("vehicles support mobs", metrics.vehicleSupport > 0, metrics.vehicleSupport, ">0")
  ];
  if (metrics.subfaction === "Bad Moon Mob") return [...shared,
    check("120 combat infantry", metrics.infantry >= 120, metrics.infantry, 120),
    check("12 mobs", metrics.viableSquads >= 12, metrics.viableSquads, 12),
    check("45% ranged strength", ratio(metrics.rangedStrength, metrics.infantry) >= 0.45, ratio(metrics.rangedStrength, metrics.infantry), 0.45),
    check("Shoota/Tankbusta/Nob/Big Mek core", metrics.coreDoctrineUnits >= 4, metrics.coreDoctrineUnits, 4),
    check("four machinery assets", metrics.vehicles >= 4, metrics.vehicles, 4),
    check("scrap and ammunition sustained", metrics.scrap > 0 && metrics.ammunition > 0, `${metrics.scrap}/${metrics.ammunition}`, ">0 / >0"),
    check("two Waaagh banner anchors", metrics.waaaghBannerAnchors >= 2, metrics.waaaghBannerAnchors, 2),
    check("protects Mek infrastructure", metrics.mekInfrastructureAlive, metrics.mekInfrastructureAlive, true)
  ];
  return [...shared, check("recognized test subfaction", false, metrics.subfaction, "configured alliance")];
}

export function evaluateAllianceEvolutionRun(metricsByPlayer = [], performance = {}) {
  const factionResults = metricsByPlayer.map(metrics => {
    const checks = factionChecks(metrics);
    return Object.freeze({ subfaction: metrics.subfaction, checks: Object.freeze(checks), passed: checks.every(item => item.passed), failed: Object.freeze(checks.filter(item => !item.passed)) });
  });
  const performanceChecks = Object.freeze([
    check("average FPS target", performance.averageFps >= ALLIANCE_EVOLUTION_RULES.targetFps, performance.averageFps, ALLIANCE_EVOLUTION_RULES.targetFps),
    // performance.now() is quantized to 0.1 ms in Chromium: a nominal 30 Hz
    // interval may be reported as 33.4 ms (29.94 FPS). A 0.1 FPS tolerance
    // accepts that representation without admitting a genuine sub-30 result.
    check("one-percent-low FPS floor", performance.onePercentLowFps + 0.1 >= ALLIANCE_EVOLUTION_RULES.minimumFps, performance.onePercentLowFps, ALLIANCE_EVOLUTION_RULES.minimumFps),
    check("no five-second window below floor", performance.minimumFiveSecondFps >= ALLIANCE_EVOLUTION_RULES.minimumFps, performance.minimumFiveSecondFps, ALLIANCE_EVOLUTION_RULES.minimumFps),
    check("no frame above 250ms", performance.maximumFrameMs <= ALLIANCE_EVOLUTION_RULES.maximumFrameMs, performance.maximumFrameMs, ALLIANCE_EVOLUTION_RULES.maximumFrameMs),
    check("p95 frame time", performance.p95FrameMs <= ALLIANCE_EVOLUTION_RULES.maximumP95FrameMs, performance.p95FrameMs, ALLIANCE_EVOLUTION_RULES.maximumP95FrameMs),
    check("no progressive FPS decline", performance.progressiveDecline !== true, performance.progressiveDecline, false)
  ]);
  return Object.freeze({
    factions: Object.freeze(factionResults),
    performanceChecks,
    passed: factionResults.length === ALLIANCE_EVOLUTION_PLAYERS.length && factionResults.every(result => result.passed) && performanceChecks.every(item => item.passed),
    failed: Object.freeze([
      ...factionResults.flatMap(result => result.failed.map(item => `${result.subfaction}: ${item.name}`)),
      ...performanceChecks.filter(item => !item.passed).map(item => `performance: ${item.name}`)
    ])
  });
}

export function nextEvolutionSeed(baseSeed = "alliance-evolution", iteration = 0) {
  return `${baseSeed}:iteration-${Math.max(1, Math.floor(Number(iteration) || 1))}`;
}
