// Extra battlefield formations (box/rectangle, mixed, encircle), their combat
// values, encirclement detection and squad pacing helpers.
//
// Local slot space matches FormationSystem: +x is the squad's right, +y is
// forward (the facing direction), negative y is behind the anchor.

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const TAU = Math.PI * 2;

export const DOCTRINE_FORMATIONS = Object.freeze(["box", "mixed", "encircle"]);

const PROTECTED_GROUPS = new Set(["support", "protected", "medical", "repair", "logistics", "command"]);

// damageTaken: multiplier on incoming damage by attack sector relative to the
// squad's heading. accuracy/speed scale output. morale is a flat bonus that
// resists breaking. coreShield further reduces damage on protected members
// who stand inside the formation.
export const FORMATION_VALUES = Object.freeze({
  line:             { front: 0.90, flank: 1.10, rear: 1.15, accuracy: 1.06, speed: 0.95, morale: 0.00, coreShield: 1.00 },
  column:           { front: 1.06, flank: 1.00, rear: 1.04, accuracy: 0.88, speed: 1.12, morale: -0.02, coreShield: 1.00 },
  wedge:            { front: 0.92, flank: 1.00, rear: 1.12, accuracy: 1.00, speed: 1.00, morale: 0.02, coreShield: 1.00 },
  triangle:         { front: 0.94, flank: 1.00, rear: 1.08, accuracy: 1.00, speed: 1.00, morale: 0.01, coreShield: 0.96 },
  staggered:        { front: 0.95, flank: 0.95, rear: 0.97, accuracy: 1.00, speed: 1.04, morale: 0.00, coreShield: 1.00 },
  flanking:         { front: 1.00, flank: 0.96, rear: 1.04, accuracy: 1.05, speed: 1.02, morale: 0.01, coreShield: 0.94 },
  escort:           { front: 0.90, flank: 0.90, rear: 0.92, accuracy: 0.98, speed: 0.92, morale: 0.03, coreShield: 0.80 },
  circle:           { front: 0.88, flank: 0.88, rear: 0.88, accuracy: 0.96, speed: 0.80, morale: 0.06, coreShield: 0.78 },
  "defensive-ring": { front: 0.82, flank: 0.82, rear: 0.82, accuracy: 0.98, speed: 0.70, morale: 0.10, coreShield: 0.70 },
  box:              { front: 0.84, flank: 0.84, rear: 0.86, accuracy: 1.03, speed: 0.78, morale: 0.08, coreShield: 0.62 },
  mixed:            { front: 0.88, flank: 0.90, rear: 0.93, accuracy: 1.04, speed: 0.90, morale: 0.05, coreShield: 0.76 },
  encircle:         { front: 0.97, flank: 0.97, rear: 0.97, accuracy: 1.08, speed: 0.96, morale: 0.03, coreShield: 0.90 }
});

export function formationValuesFor(formation) {
  return FORMATION_VALUES[formation] || FORMATION_VALUES.line;
}

// Which side of the squad an attack came from: front, flank or rear.
export function attackSector(squadHeading, attackerBearing) {
  let delta = Math.abs(((attackerBearing - squadHeading + Math.PI) % TAU + TAU) % TAU - Math.PI);
  if (delta <= Math.PI / 3) return "front";
  if (delta <= (Math.PI * 2) / 3) return "flank";
  return "rear";
}

// Damage multiplier a member receives. Bonuses scale with how tightly the
// squad actually holds its shape (cohesion 0..1); a shattered formation
// protects nobody.
export function formationDamageMultiplier(formation, { cohesion = 1, sector = "front", core = false } = {}) {
  const values = formationValuesFor(formation);
  const strength = clamp(cohesion, 0, 1) ** 1.2;
  let multiplier = 1 + (values[sector] - 1) * strength;
  if (core) multiplier *= 1 + (values.coreShield - 1) * strength;
  return clamp(multiplier, 0.4, 1.3);
}

export function formationAccuracyMultiplier(formation, cohesion = 1) {
  return 1 + (formationValuesFor(formation).accuracy - 1) * clamp(cohesion, 0, 1);
}

export function formationSpeedMultiplier(formation, cohesion = 1) {
  return 1 + (formationValuesFor(formation).speed - 1) * clamp(cohesion, 0, 1);
}

export function formationMoraleBonus(formation, cohesion = 1) {
  return formationValuesFor(formation).morale * clamp(cohesion, 0, 1);
}

export function isProtectedGroup(group) {
  return PROTECTED_GROUPS.has(group);
}

// ---- Slot geometry ---------------------------------------------------------

// Evenly spaced points along a rectangle perimeter, starting at front-left.
export function rectanglePerimeterSlot(index, count, width, depth) {
  const perimeter = 2 * (width + depth);
  const distanceAlong = (index / Math.max(1, count)) * perimeter;
  const halfW = width / 2;
  const halfD = depth / 2;
  if (distanceAlong < width) return { x: -halfW + distanceAlong, y: halfD };                // front edge
  if (distanceAlong < width + depth) return { x: halfW, y: halfD - (distanceAlong - width) }; // right edge
  if (distanceAlong < 2 * width + depth) return { x: halfW - (distanceAlong - width - depth), y: -halfD }; // rear edge
  return { x: -halfW, y: -halfD + (distanceAlong - 2 * width - depth) };                      // left edge
}

// Rectangle ("box") formation: fighters hold the perimeter, protected members
// (medics, command, wounded, logistics) stand inside it.
export function boxSlot(index, count, member = {}, groupRank = 0, perimeterCount = null, perimeterIndex = null) {
  const group = member.formationGroup;
  const protectedMember = PROTECTED_GROUPS.has(group);
  const outer = Math.max(4, perimeterCount ?? count);
  const width = Math.max(30, Math.ceil(outer / 2) * 9);
  const depth = Math.max(22, Math.ceil(outer / 2) * 6.5);
  if (protectedMember) {
    const col = groupRank % 3;
    const row = Math.floor(groupRank / 3);
    return { x: (col - 1) * 9, y: -row * 8 + 2 };
  }
  return rectanglePerimeterSlot(perimeterIndex ?? index, outer, width, depth);
}

// Mixed formation: heavy/ranged front line, angled flank wings, a protected
// core and a rear guard. `role` sorts members into those bands.
export function mixedSlot(member = {}, bandIndex = 0, bandCount = 1, band = "front") {
  const spread = (bandIndex - (bandCount - 1) / 2);
  if (band === "front") return { x: spread * 13, y: 16 - Math.abs(spread) * 1.2 };
  if (band === "wing") {
    const side = bandIndex % 2 ? -1 : 1;
    const rank = Math.floor(bandIndex / 2);
    return { x: side * (30 + rank * 11), y: 4 - rank * 7 };
  }
  if (band === "core") return { x: spread * 9, y: -6 };
  return { x: spread * 12, y: -24 };
}

export function mixedBandFor(member = {}) {
  const group = member.formationGroup;
  if (PROTECTED_GROUPS.has(group)) return "core";
  const identity = `${member.role || ""} ${member.specialty || ""} ${member.weapon || ""}`.toLowerCase();
  if (member.role === "vehicle" || /heavy|shield|terminator|bullgryn|meltagun|flamer|melee|chainsword|choppa/.test(identity)) return "front";
  if (member.role === "scout" || group === "left" || group === "right") return "wing";
  if (/sniper|marksman|launcher|mortar|plasma|las|cannon/.test(identity)) return "rear";
  return "front";
}

// Encirclement slot on a ring around the enemy. `targetDistance` is how far
// ahead of the anchor the enemy centre is; `radius` closes as the squad
// gets into position. With fewer than eight members a horseshoe is formed
// instead of a full ring so the squad is not spread impossibly thin.
export function encircleSlot(index, count, { targetDistance = 90, radius = 70, member = {} } = {}) {
  if (PROTECTED_GROUPS.has(member.formationGroup)) return { x: 0, y: Math.max(0, targetDistance - radius - 18) };
  const full = count >= 8;
  const arc = full ? TAU : TAU * 0.66;
  const slots = Math.max(1, full ? count : count - 1);
  // Centre the horseshoe on the squad's side so it hugs the enemy rather than
  // sending members through them.
  const start = full ? -Math.PI / 2 : -Math.PI / 2 - arc / 2;
  const angle = start + (index / slots) * arc;
  return { x: Math.cos(angle) * radius, y: targetDistance + Math.sin(angle) * radius };
}

export function encircleRadiusFor(cohesion = 0.5, minRadius = 46, maxRadius = 118) {
  return maxRadius - (maxRadius - minRadius) * clamp(cohesion, 0, 1);
}

// ---- Encirclement detection ------------------------------------------------

// How completely `enemies` surround `center`. Sectors are weighted by how
// close their nearest enemy is, so a distant enemy on the far side does not
// count as a pincer.
export function encirclementState(center, enemies = [], { radius = 160, sectors = 12 } = {}) {
  const filled = new Array(sectors).fill(0);
  let count = 0;
  for (const enemy of enemies) {
    const dx = (enemy.x || 0) - center.x;
    const dy = (enemy.y || 0) - center.y;
    const d = Math.hypot(dx, dy);
    if (d > radius || d < 0.001) continue;
    const sector = Math.floor((((Math.atan2(dy, dx) + TAU) % TAU) / TAU) * sectors) % sectors;
    filled[sector] = Math.max(filled[sector], 1 - d / (radius * 1.15));
    count += 1;
  }
  if (!count) return { coverage: 0, maxGap: TAU, closure: 0, surrounded: false, pressure: 0, enemyCount: 0 };
  const occupied = filled.map(value => value > 0.05);
  const coverage = occupied.filter(Boolean).length / sectors;
  let maxGap = 0;
  let run = 0;
  for (let n = 0; n < sectors * 2; n += 1) {
    if (occupied[n % sectors]) run = 0;
    else { run += 1; if (run > maxGap) maxGap = run; }
  }
  maxGap = Math.min(maxGap, sectors) * (TAU / sectors);
  const closure = filled.reduce((sum, value) => sum + value, 0) / sectors;
  const surrounded = coverage >= 0.5 && maxGap <= Math.PI * 0.9 && count >= 3;
  const pressure = clamp(coverage * 0.7 + closure * 0.6, 0, 1);
  return { coverage, maxGap, closure, surrounded, pressure, enemyCount: count };
}

// Morale drained per second while encircled. Box and ring formations hold the
// line better; breakout leaders can reduce it further.
export function encirclementMoraleDrain(state, formation, courage = 0.5) {
  if (!state?.surrounded) return 0;
  const resilience = 1 - clamp(formationValuesFor(formation).morale * 2.2, -0.2, 0.5);
  return clamp(0.012 + state.pressure * 0.03, 0, 0.05) * resilience * (1.12 - clamp(courage, 0, 1) * 0.5);
}

// ---- Scoring ---------------------------------------------------------------

export function scoreDoctrineFormations({
  members = [], enemies = [], center = { x: 0, y: 0 }, orderType = "Advance", aggression = 50, caution = 50,
  strengthRatio = 1, surrounded = false, directions = 0, protectedCount = 0, rangedRatio = 0
} = {}) {
  const count = members.length;
  const enemyCount = enemies.length;
  const holdOrder = ["Hold Route", "Block Route", "Delay Enemy", "Keep Route Open", "Defend Base", "Defend Territory"].includes(orderType);
  const distinctRoles = new Set(members.map(member => member.formationGroup || member.role)).size;
  const exposure = Math.min(3, directions);
  const box = 6 + exposure * 17 + protectedCount * 7 + rangedRatio * 14 + (count >= 6 ? 10 : -60) + (enemyCount ? 10 : 0)
    + (holdOrder ? 14 : 0) + caution * 0.1 - (surrounded ? 28 : 0);
  const mixed = 16 + (count >= 8 ? 30 : count >= 6 ? 20 : -34) + distinctRoles * 6
    + (enemyCount && !surrounded ? 14 : 0) + (orderType === "Advance" || orderType === "Capture" ? 10 : 0);
  const superiority = clamp(strengthRatio - 1.15, 0, 1.8);
  const encircle = -24 + (count >= 8 ? 22 : count >= 6 ? 4 : -70) + superiority * 52
    + (enemyCount >= 1 && enemyCount <= Math.max(2, count * 0.6) ? 16 : -30) + aggression * 0.14 - caution * 0.1 - (surrounded ? 160 : 0);
  return { box, mixed, encircle };
}

// ---- Squad pacing ----------------------------------------------------------

// Leaders wait for stragglers when not in contact, so a squad arrives as a
// unit instead of strung out in a line.
export function squadPaceFactor({ cohesion = 1, inContact = false, formation = "wedge" } = {}) {
  if (inContact) return 1;
  const patience = formation === "column" ? 0.65 : 0.52;
  return cohesion >= 0.85 ? 1 : clamp(patience + cohesion * (1 - patience) / 0.85, patience, 1);
}

// Slows turning to stop formations flipping when target and objective trade
// places. Returns the new heading.
export function smoothHeading(current, desired, elapsed, turnRate = 2.4) {
  const maxStep = Math.max(0.02, turnRate * Math.max(0, elapsed));
  let delta = ((desired - current + Math.PI) % TAU + TAU) % TAU - Math.PI;
  delta = clamp(delta, -maxStep, maxStep);
  return current + delta;
}

// Assign each member a perimeter index so fighters spread evenly around a box
// while protected members take interior slots.
export function planBoxPerimeter(members = []) {
  const fighters = members.filter(member => !PROTECTED_GROUPS.has(member.formationGroup));
  const order = new Map();
  fighters.forEach((member, n) => order.set(member.id ?? member, n));
  return { perimeterCount: fighters.length, order };
}
