export const FORMATION_TYPES = Object.freeze([
  "line", "column", "circle", "wedge", "triangle", "staggered", "escort", "defensive-ring", "flanking"
]);

export const COMBINED_ARMS_ROLES = Object.freeze([
  "recon", "infantry", "heavy-infantry", "vehicles", "artillery", "anti-air",
  "medical", "repair", "logistics", "reserve"
]);

export const ASTARTES_COHESION_MODES = Object.freeze({
  DISTRIBUTED: "DISTRIBUTED",
  BATTLE_FORMATION: "BATTLE_FORMATION",
  REGROUPING: "REGROUPING"
});

export function updateAstartesCohesionMode(squad, { now = 0, seriousContact = false, armyFormation = false, regrouping = false, quietSeconds = 12 } = {}) {
  if (!squad) return ASTARTES_COHESION_MODES.DISTRIBUTED;
  if (seriousContact) squad.lastSeriousContactAt = now;
  const recentlyEngaged = now - (squad.lastSeriousContactAt ?? -Infinity) < quietSeconds;
  squad.cohesionMode = regrouping ? ASTARTES_COHESION_MODES.REGROUPING
    : armyFormation || seriousContact || recentlyEngaged ? ASTARTES_COHESION_MODES.BATTLE_FORMATION
      : ASTARTES_COHESION_MODES.DISTRIBUTED;
  squad.formationActive = squad.cohesionMode !== ASTARTES_COHESION_MODES.DISTRIBUTED;
  return squad.cohesionMode;
}

const weaponText = unit => `${unit.weapon || ""} ${unit.weaponId || ""} ${unit.specialty || ""}`.toLowerCase();
const identityText = unit => `${unit.name || ""} ${unit.role || ""} ${unit.type || ""}`.toLowerCase();

export function combinedArmsRoleFor(unit) {
  const identity = identityText(unit);
  const weapon = weaponText(unit);
  if (unit.reserve || unit.status === "Reserve") return "reserve";
  if (unit.role === "medic" || /medic|apothecary|painboy|medical drone|technomancer/.test(identity)) return "medical";
  if (["engineer", "builder"].includes(unit.role) || /repair|techmarine|mek|warpsmith|cryptek/.test(identity)) return "repair";
  if (/supply|cargo|logistic|ammo carrier|fuel/.test(identity) || unit.resourceCargo) return "logistics";
  if (/anti.?air|skyray|hunter|stalker|flak|hydra/.test(identity + weapon)) return "anti-air";
  if (/artillery|mortar|howitzer|whirlwind|basilisk|exocrine|doomsday/.test(identity + weapon)) return "artillery";
  if (unit.role === "vehicle" || /tank|rhino|chimera|trukk|walker|dreadnought|devilfish|hammerhead|monolith|carnifex/.test(identity)) return "vehicles";
  if (unit.role === "scout" || /scout|recon|pathfinder|ratling|kommando|deathmark|gargoyle/.test(identity)) return "recon";
  if (/heavy|terminator|aggressor|bullgryn|broadside|immortal|warrior/.test(identity + weapon)) return "heavy-infantry";
  return "infantry";
}

export function buildCombinedArmsGroups(units) {
  const groups = Object.fromEntries(COMBINED_ARMS_ROLES.map(role => [role, []]));
  for (const unit of units.filter(candidate => candidate.alive !== false && !candidate.incapacitated)) {
    groups[combinedArmsRoleFor(unit)].push(unit);
  }
  return groups;
}

function nearest(origin, candidates) {
  return candidates.reduce((best, candidate) => {
    const range = Math.hypot((candidate.x || 0) - (origin.x || 0), (candidate.y || 0) - (origin.y || 0));
    return !best || range < best.range ? { candidate, range } : best;
  }, null)?.candidate || null;
}

export function vehicleBattlefieldPurpose(unit = {}) {
  const type = String(unit.vehicleState?.type || "").toLowerCase();
  const identity = `${identityText(unit)} ${type}`;
  if (unit.vehicleState?.passengerCapacity > 0 || type === "transport") return "squad transport and protected deployment";
  if (type === "artillery" || /artillery|whirlwind|basilisk|doomsday|exocrine/.test(identity)) return "protected standoff fire support";
  if (type === "anti-air" || /anti.?air|hunter|stalker|hydra|skyray/.test(identity)) return "mobile anti-air screen";
  if (type === "walker" || /walker|dreadnought|defiler|carnifex/.test(identity)) return "close infantry assault support";
  if (type === "repair" || type === "supply") return "armored sustainment support";
  return "armored fire support behind infantry";
}

export function combinedArmsSupportDistance(unit = {}) {
  const purpose = vehicleBattlefieldPurpose(unit);
  if (purpose.includes("transport")) return 38;
  if (purpose.includes("standoff")) return 145;
  if (purpose.includes("anti-air")) return 105;
  if (purpose.includes("assault")) return 52;
  if (purpose.includes("sustainment")) return 90;
  return 68;
}

export function assignCombinedArmsSupport(units) {
  const groups = buildCombinedArmsGroups(units);
  const assignments = new Map();
  const lineUnits = [...groups.infantry, ...groups["heavy-infantry"]];
  for (const vehicle of groups.vehicles) {
    const screen = nearest(vehicle, lineUnits);
    if (screen) assignments.set(vehicle.id, { targetId: screen.id, purpose: vehicleBattlefieldPurpose(vehicle) });
  }
  for (const infantry of lineUnits) {
    const armor = nearest(infantry, groups.vehicles);
    if (armor) assignments.set(infantry.id, { targetId: armor.id, purpose: "armor support" });
  }
  for (const medic of groups.medical) {
    const casualty = nearest(medic, lineUnits.filter(unit => (unit.hp ?? 1) < (unit.maxHp ?? 1)));
    if (casualty) assignments.set(medic.id, { targetId: casualty.id, purpose: "medical support" });
  }
  for (const repair of groups.repair) {
    const damaged = nearest(repair, groups.vehicles.filter(unit => (unit.hp ?? 1) < (unit.maxHp ?? 1)));
    if (damaged) assignments.set(repair.id, { targetId: damaged.id, purpose: "vehicle repair" });
  }
  for (const support of [...groups.artillery, ...groups["anti-air"], ...groups.logistics]) {
    const protection = nearest(support, [...lineUnits, ...groups.vehicles]);
    if (protection) assignments.set(support.id, { targetId: protection.id, purpose: vehicleBattlefieldPurpose(support) });
  }
  return { groups, assignments };
}

export function formationLocalPosition(formation, index, count, member = {}, groupRank = 0) {
  if (index === 0 && formation === "escort") return { x: 0, y: Math.max(20, count * 3.5) };
  if (index === 0) return { x: 0, y: 0 };
  const centered = index - (count - 1) / 2;
  const group = member.formationGroup || combinedArmsRoleFor(member);
  if (formation === "line") return { x: centered * 14, y: Math.abs(centered) * 1.5 };
  if (formation === "column") return { x: (index % 2 ? -1 : 1) * 5, y: -Math.floor((index + 1) / 2) * 14 };
  if (["wedge", "triangle"].includes(formation)) {
    if (["support", "protected", "medical", "repair", "logistics"].includes(group)) return { x: (groupRank % 2 ? -1 : 1) * (7 + groupRank * 3), y: -16 - groupRank * 9 };
    const depth = Math.ceil(index / 2);
    return { x: (index % 2 ? -1 : 1) * depth * 13, y: -depth * 12 };
  }
  if (["circle", "defensive-ring", "escort"].includes(formation)) {
    const protectedMember = ["support", "protected", "medical", "repair", "logistics"].includes(group);
    const radius = protectedMember ? 11 + groupRank * 3 : Math.max(20, count * 3.5);
    const angle = index / Math.max(1, count) * Math.PI * 2 - Math.PI / 2;
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
  }
  if (formation === "staggered") return { x: centered * 11, y: (index % 2 ? -10 : 6) - Math.abs(centered) * 2 };
  if (formation === "flanking") {
    if (["command", "support", "protected", "medical", "repair", "logistics"].includes(group)) return { x: groupRank % 2 ? -9 : 9, y: -18 - groupRank * 10 };
    const side = member.formationGroup === "left" ? -1 : 1;
    return { x: side * (42 + groupRank * 12), y: 22 - groupRank * 9 };
  }
  return { x: centered * 12, y: 0 };
}

export function resolveFormationSlot(desired = {}, { unit = {}, isWalkable = () => true, searchRings = 10, step = 8 } = {}) {
  if (isWalkable(desired, unit)) return Object.freeze({ position: { x: desired.x, y: desired.y }, available: true, displaced: 0 });
  for (let ring = 1; ring <= searchRings; ring += 1) {
    const samples = Math.max(8, ring * 8);
    for (let index = 0; index < samples; index += 1) {
      const angle = index / samples * Math.PI * 2;
      const candidate = { x: desired.x + Math.cos(angle) * ring * step, y: desired.y + Math.sin(angle) * ring * step };
      if (isWalkable(candidate, unit)) return Object.freeze({ position: candidate, available: true, displaced: ring * step });
    }
  }
  return Object.freeze({ position: { x: unit.x ?? desired.x, y: unit.y ?? desired.y }, available: false, displaced: Infinity });
}

export function degradedFormationFor(formation, unavailableSlots = 0, totalSlots = 1) {
  if (Math.max(0, unavailableSlots) / Math.max(1, totalSlots) < 0.3) return formation;
  if (["line", "wedge", "triangle", "flanking"].includes(formation)) return "staggered";
  if (["staggered", "circle", "defensive-ring", "escort"].includes(formation)) return "column";
  return formation;
}

export function scoreFormationOptions({ members = [], terrain = {}, threat = {}, objective = {}, doctrine = "Balanced", nearbyRoad = false, regrouping = false, protectedAsset = false } = {}) {
  const count = Math.max(1, members.length);
  const rangedRatio = members.filter(member => member.role === "vehicle" || /rifle|bolter|plasma|melta|launcher|mortar|cannon|gun/.test(weaponText(member))).length / count;
  const woundedRatio = members.filter(member => (member.hp ?? 1) / Math.max(1, member.maxHp ?? 1) < 0.58).length / count;
  const enemyCount = threat.enemyCount ?? threat.enemies?.length ?? 0;
  const surrounded = threat.surrounded || (threat.directions ?? 0) >= 3 || enemyCount >= Math.max(3, count * 0.7);
  const openGround = Math.max(0, Math.min(1, 1 - (terrain.cover || 0)));
  const concealed = Math.max(0, Math.min(1, (terrain.cover || 0) + (1 - (terrain.detection ?? 1)) * 0.45));
  const narrowTerrain = ["trees", "denseforest", "jungle", "ruins", "trenches", "bridge"].includes(terrain.type) ? 1 : 0;
  const moving = objective.moving ?? true;
  const order = objective.type || "Advance";
  const holdOrder = ["Hold Route", "Block Route", "Delay Enemy", "Destroy Route if Overrun", "Keep Route Open"].includes(order);
  const scores = {
    line: 24 + rangedRatio * 24 + openGround * 18 + (holdOrder ? 30 : 0),
    column: 20 + (nearbyRoad ? 42 : 0) + narrowTerrain * 18 + (moving ? 10 : 0) + (["Patrol Route", "Regroup"].includes(order) ? 32 : 0),
    wedge: 22 + (moving ? 18 : 0) + (doctrine === "Aggressive" ? 24 : 0) + openGround * 14,
    triangle: 24 + (moving ? 14 : 0) + count * 0.8 + (doctrine === "Balanced" ? 16 : 0),
    circle: 10 + (surrounded ? 52 : 0) + woundedRatio * 18,
    "defensive-ring": 12 + (surrounded ? 110 : 0) + woundedRatio * 24 + (holdOrder ? 14 : 0),
    staggered: 20 + concealed * 25 + (["Observe Route", "Ambush Route"].includes(order) ? 35 : 0),
    flanking: 8 + concealed * 22 + (count >= 6 ? 24 : -55) + (enemyCount ? 15 : -12) + (order === "Ambush Route" ? 44 : 0) + (doctrine === "Aggressive" ? 12 : 0),
    escort: (protectedAsset ? 72 : -35) + (order === "Escort Route" ? 42 : 0) + woundedRatio * 10
  };
  if (regrouping) scores.column += 80;
  return scores;
}

export function selectFormation({ current = "wedge", elapsed = Infinity, hysteresis = 15, ...context } = {}) {
  const scores = scoreFormationOptions(context);
  const [formation, score] = Object.entries(scores).sort((a, b) => b[1] - a[1] || FORMATION_TYPES.indexOf(a[0]) - FORMATION_TYPES.indexOf(b[0]))[0];
  const currentScore = scores[current] ?? -Infinity;
  const emergency = ["circle", "defensive-ring", "escort", "column"].includes(formation);
  return { formation: emergency || elapsed > 4 && score >= currentScore + hysteresis ? formation : current, score, scores, changed: formation !== current && (emergency || elapsed > 4 && score >= currentScore + hysteresis) };
}
