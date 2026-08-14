const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, Number(value) || 0));
const distance = (a = {}, b = {}) => Math.hypot((a.x || 0) - (b.x || 0), (a.y || 0) - (b.y || 0));

export const WAAAGH_RULES = Object.freeze({
  bannerDestroyedMomentum: 15,
  confusionSeconds: 4,
  mobileRadius: 95,
  builtRadius: 165,
  maximumMomentum: 100
});

export function createWaaaghFieldState(now = 0) {
  return {
    momentum: 18,
    previousKills: 0,
    previousTerritories: 0,
    previousCasualties: 0,
    lastCombatAt: Number(now) || 0,
    lastTickAt: Number(now) || 0,
    bannerIds: [],
    events: []
  };
}

export function isMobileWaaaghBanner(unit = {}) {
  return unit.alive !== false && (unit.role === "standard" || /waa+gh.*banner|banner.*nob/i.test(`${unit.name || ""} ${unit.specialty || ""}`));
}

export function isBuiltWaaaghBanner(structure = {}, player = {}) {
  return structure.alive !== false && structure.progress >= 1 && structure.faction === player.id
    && (structure.type === "waaaghbanner" || /waa+gh.*banner/i.test(structure.displayName || ""));
}

export function waaaghBannerAnchors(player = {}, units = [], structures = []) {
  return [
    ...units.filter(unit => unit.faction === player.id && isMobileWaaaghBanner(unit)).map(unit => ({ ...unit, source: "mobile", radius: WAAAGH_RULES.mobileRadius })),
    ...structures.filter(structure => isBuiltWaaaghBanner(structure, player)).map(structure => ({ ...structure, source: "built", radius: WAAAGH_RULES.builtRadius }))
  ];
}

function localBannerStrength(unit, anchors) {
  let remaining = 1;
  for (const anchor of anchors) {
    const range = anchor.radius || WAAAGH_RULES.mobileRadius;
    const contribution = clamp(1 - distance(unit, anchor) / range, 0, 1) * (anchor.source === "built" ? 0.72 : 0.48);
    remaining *= 1 - contribution;
  }
  return clamp(1 - remaining, 0, 0.88);
}

export function updateWaaaghField(state, { now = 0, dt = 1, player = {}, units = [], structures = [], territoryCount = 0, casualties = 0 } = {}) {
  const fighters = units.filter(unit => unit.alive && !unit.incapacitated && unit.faction === player.id && !["builder", "supply"].includes(unit.role));
  const anchors = waaaghBannerAnchors(player, units, structures);
  const kills = fighters.reduce((sum, unit) => sum + (Number(unit.kills) || 0), 0);
  const engaged = fighters.filter(unit => unit.targetId || /firing|melee|closing|advancing/i.test(unit.status || "")).length;
  const clustered = fighters.filter(unit => fighters.some(other => other.id !== unit.id && distance(unit, other) <= 70)).length;
  const killDelta = Math.max(0, kills - (state.previousKills || 0));
  const territoryDelta = Number(territoryCount) - (state.previousTerritories || 0);
  const casualtyDelta = Math.max(0, Number(casualties) - (state.previousCasualties || 0));
  if (engaged || killDelta) state.lastCombatAt = now;
  const activity = engaged * 0.018 + clustered * 0.004 + killDelta * 2.4 + Math.max(0, territoryDelta) * 3.2
    + (fighters.some(unit => unit.orkRank === "Warboss") ? 0.12 : 0) + anchors.length * 0.08;
  const decline = casualtyDelta * 0.8 + Math.max(0, -territoryDelta) * 2.5 + (now - (state.lastCombatAt || now) > 12 ? 0.5 : 0.04);
  state.momentum = clamp((state.momentum || 0) + (activity - decline) * Math.max(0.1, Number(dt) || 1), 0, WAAAGH_RULES.maximumMomentum);
  state.previousKills = kills;
  state.previousTerritories = Number(territoryCount) || 0;
  state.previousCasualties = Number(casualties) || 0;
  state.lastTickAt = now;
  state.bannerIds = anchors.map(anchor => anchor.id);
  const momentum = state.momentum / 100;
  const badMoon = /bad moon/i.test(player.subfaction || "");
  const ironjaw = /ironjaw/i.test(player.subfaction || "");
  for (const unit of units.filter(candidate => candidate.alive && candidate.faction === player.id)) {
    const banner = localBannerStrength(unit, anchors);
    const confused = (unit.waaaghConfusedUntil || 0) > now;
    unit.waaaghFieldStrength = banner;
    unit.waaaghAttackSpeedMultiplier = confused ? 0.72 : 1 + banner * 0.1 + momentum * (badMoon ? 0.08 : 0.05);
    unit.waaaghMeleeMultiplier = confused ? 0.7 : 1 + banner * (ironjaw ? 0.25 : 0.16) + momentum * (ironjaw ? 0.3 : 0.18);
    unit.waaaghMoveMultiplier = confused ? 0.7 : 1 + momentum * (ironjaw ? 0.09 : 0.04);
    unit.waaaghSuppressionResistance = confused ? -0.25 : banner * 0.34 + momentum * 0.18;
    unit.waaaghCourageBonus = confused ? -0.3 : banner * 0.28 + momentum * 0.22;
    unit.waaaghVehicleReliability = confused ? 0.8 : 1 + momentum * (badMoon ? 0.16 : 0.1);
    unit.waaaghMekEfficiency = 1 + momentum * (badMoon ? 0.22 : 0.12);
  }
  return { momentum: state.momentum, anchors: anchors.length, engaged, clustered };
}

export function registerWaaaghBannerDestruction(state, { banner = {}, now = 0, units = [], player = {} } = {}) {
  if (!state || !banner?.id) return null;
  state.momentum = clamp((state.momentum || 0) - WAAAGH_RULES.bannerDestroyedMomentum, 0, WAAAGH_RULES.maximumMomentum);
  const affected = [];
  for (const unit of units) {
    if (!unit.alive || unit.faction !== player.id || distance(unit, banner) > WAAAGH_RULES.builtRadius) continue;
    const mitigation = unit.orkRank === "Warboss" ? 0.65 : /nob/i.test(`${unit.orkRank || ""} ${unit.name || ""}`) ? 0.4 : unit.role === "builder" ? -0.25 : 0;
    unit.waaaghConfusedUntil = Math.max(unit.waaaghConfusedUntil || 0, now + WAAAGH_RULES.confusionSeconds * (1 - mitigation * 0.35));
    unit.morale = clamp((unit.morale ?? 0.7) - 0.22 * (1 - mitigation), 0, 1);
    unit.suppression = clamp((unit.suppression || 0) + 0.3 * (1 - mitigation), 0, 1);
    affected.push(unit.id);
  }
  const event = Object.freeze({ type: "banner-destroyed", bannerId: banner.id, at: now, momentum: state.momentum, affected });
  state.events.push(event);
  if (state.events.length > 32) state.events.splice(0, state.events.length - 32);
  return event;
}
