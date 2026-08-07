self.onmessage = event => {
  const { requestId, units = [], dt = 1 } = event.data || {};
  const factions = {};
  for (const unit of units) {
    if (!unit.alive) continue;
    const summary = factions[unit.faction] ||= { units: 0, combatPower: 0, expectedAttrition: 0 };
    summary.units += 1;
    summary.combatPower += Math.max(0, unit.damage || 0) * Math.max(0.1, unit.accuracy || 0.5) * Math.max(0.1, unit.morale || 0.5);
  }
  const entries = Object.entries(factions);
  for (const [faction, summary] of entries) {
    const hostilePower = entries.filter(([other]) => other !== faction).reduce((sum, [, other]) => sum + other.combatPower, 0);
    summary.expectedAttrition = hostilePower * Math.max(0, Number(dt) || 0) * 0.0005;
  }
  self.postMessage({ requestId, factions, processed: units.length });
};
