const clamp01 = value => Math.max(0, Math.min(1, Number(value) || 0));

export const FORTIFICATION_TYPES = Object.freeze({
  FORWARD_OUTPOST: Object.freeze({ id: "forward-outpost", buildingType: "outpost", roles: ["supply", "observation", "recovery"] }),
  BUNKER: Object.freeze({ id: "bunker", buildingType: "bunker", roles: ["garrison", "choke-defense"] }),
  PILLBOX: Object.freeze({ id: "pillbox", buildingType: "bunker", roles: ["compact-fire-position"] }),
  FORT: Object.freeze({ id: "fort", buildingType: "bunker", roles: ["strongpoint", "territory-anchor"] }),
  WALL: Object.freeze({ id: "wall", buildingType: "bunker", roles: ["channel", "delay"] }),
  GATE: Object.freeze({ id: "gate", buildingType: "bunker", roles: ["controlled-access"] }),
  OBSERVATION_POST: Object.freeze({ id: "observation-post", buildingType: "observationtower", roles: ["intel", "auspex-relay"] }),
  TURRET: Object.freeze({ id: "turret", buildingType: "turret", roles: ["fire-support", "anti-armor"] })
});

export function scoreFortificationSite(site = {}, context = {}) {
  return clamp01(
    clamp01(site.chokePointValue) * 0.24
    + clamp01(site.highGroundValue) * 0.14
    + clamp01(site.roadControl) * 0.12
    + clamp01(site.objectiveValue) * 0.18
    + clamp01(site.recentAttackPressure) * 0.2
    + clamp01(site.supplyConnection ?? 0.5) * 0.12
    - clamp01(site.overlapRisk) * 0.28
    - clamp01(site.isolation) * 0.16
    + (context.subfaction === "Imperial Fists" ? 0.12 : 0)
  );
}

export function chooseFortification(context = {}) {
  const threat = clamp01(context.threat);
  const choke = clamp01(context.chokePointValue);
  const highGround = clamp01(context.highGroundValue);
  const intelNeed = clamp01(context.intelNeed);
  const objective = clamp01(context.objectiveValue);
  const forward = Boolean(context.forwardTerritory);
  let type = FORTIFICATION_TYPES.BUNKER;
  if (intelNeed + highGround >= 1.05) type = FORTIFICATION_TYPES.OBSERVATION_POST;
  else if (forward && objective >= 0.62 && context.supplyConnection) type = FORTIFICATION_TYPES.FORWARD_OUTPOST;
  else if (threat >= 0.72 && choke >= 0.5) type = FORTIFICATION_TYPES.FORT;
  else if (threat >= 0.62) type = FORTIFICATION_TYPES.TURRET;
  else if (choke >= 0.66) type = FORTIFICATION_TYPES.PILLBOX;
  return Object.freeze({ type, score: scoreFortificationSite(context, context), reason: `${type.id} selected for threat ${Math.round(threat * 100)}%, choke ${Math.round(choke * 100)}%, objective ${Math.round(objective * 100)}%` });
}
