const distanceBetween = (a, b) => Math.hypot((a?.x || 0) - (b?.x || 0), (a?.y || 0) - (b?.y || 0));

export function captureHoldDuration(targetId = "target") {
  const hash = [...String(targetId)].reduce((value, character) => (value * 33 + character.charCodeAt(0)) >>> 0, 19);
  return 12 + hash % 9;
}

export function captureTargetsFor({ player, resourceZones = [], economicNodes = [], areAllies = (a, b) => a === b, resourceCenter = zone => zone, economy = {} } = {}) {
  const usable = new Set(economy.zoneResources || []);
  const resourceTargets = resourceZones
    .filter(zone => Number(zone.remaining) > 0 && usable.has(zone.resourceType) && (!zone.owner || !areAllies(zone.owner, player.id)))
    .map(zone => {
      const center = resourceCenter(zone);
      return {
        kind: "resource-zone",
        id: zone.id,
        name: zone.name || zone.id,
        x: center.x,
        y: center.y,
        owner: zone.owner || "",
        strategicValue: zone.strategicObjective ? 80 : 40,
        resourceType: zone.resourceType,
        exports: { [zone.resourceType]: Math.max(1, Number(zone.gatherRate) || 1) },
        source: zone
      };
    });
  const landmarkTargets = economicNodes
    .filter(node => node.active !== false && (!node.owner || !areAllies(node.owner, player.id)))
    .map(node => ({
      kind: "landmark",
      id: node.id,
      name: node.name || node.id,
      x: node.x,
      y: node.y,
      owner: node.owner || "",
      strategicValue: Math.max(30, Number(node.strategicValue) || 50),
      exports: { ...(node.exports || {}) },
      source: node
    }));
  return [...resourceTargets, ...landmarkTargets];
}

export function scoreCaptureTarget({ player, target, squadCenter, shortages = [], resourceNeed = () => 0, enemyThreat = () => 0, alreadyAssigned = false } = {}) {
  let score = Number(target?.strategicValue) || 0;
  for (const resource of Object.keys(target?.exports || {})) {
    score += Math.max(0, Number(resourceNeed(player, resource)) || 0) * 0.55;
    if (shortages.includes(resource)) score += 55;
  }
  score -= Math.max(0, Number(enemyThreat(target, player?.id)) || 0) * 22;
  score -= distanceBetween(squadCenter, target) / 15;
  if (alreadyAssigned) score -= 75;
  return score;
}

export function selectCaptureTarget({ player, squadCenter, targets = [], shortages = [], resourceNeed, enemyThreat, assignedTargetIds = new Set() } = {}) {
  return targets.reduce((best, target) => {
    const score = scoreCaptureTarget({
      player,
      target,
      squadCenter,
      shortages,
      resourceNeed,
      enemyThreat,
      alreadyAssigned: assignedTargetIds.has(target.id)
    });
    return !best || score > best.score ? { target, score } : best;
  }, null)?.target || null;
}
