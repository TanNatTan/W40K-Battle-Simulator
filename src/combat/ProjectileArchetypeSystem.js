export const PROJECTILE_TYPES = Object.freeze([
  "BALLISTIC", "BOLT", "PELLET", "BEAM", "ENERGY_BOLT", "PLASMA", "MELTA", "FLAME",
  "ROCKET", "HOMING_MISSILE", "GRENADE", "MORTAR", "ARTILLERY", "HEAVY_SHELL", "BIO_PROJECTILE"
]);

export const PROJECTILE_BEHAVIOR_FLAGS = Object.freeze([
  "piercing", "explosive", "guided", "incendiary", "corrosive", "chain", "stun", "suppression",
  "antiArmor", "antiInfantry", "indirect", "persistent", "stealthy", "ricochet", "proximityFuse"
]);

const TYPE_SET = new Set(PROJECTILE_TYPES);
const FLAG_SET = new Set(PROJECTILE_BEHAVIOR_FLAGS);
const freezeFlags = source => Object.freeze(Object.fromEntries(PROJECTILE_BEHAVIOR_FLAGS.map(flag => [flag, Boolean(source?.[flag])])));

export const PROJECTILE_ARCHETYPES = Object.freeze({
  BALLISTIC: Object.freeze({ speed: 245, flags: freezeFlags({ ricochet: true }) }),
  BOLT: Object.freeze({ speed: 285, flags: freezeFlags({ explosive: true, suppression: true, antiInfantry: true }) }),
  PELLET: Object.freeze({ speed: 220, flags: freezeFlags({ antiInfantry: true }) }),
  BEAM: Object.freeze({ speed: 1800, flags: freezeFlags({ piercing: true }) }),
  ENERGY_BOLT: Object.freeze({ speed: 330, flags: freezeFlags({}) }),
  PLASMA: Object.freeze({ speed: 245, flags: freezeFlags({ explosive: true, antiArmor: true }) }),
  MELTA: Object.freeze({ speed: 1800, flags: freezeFlags({ piercing: true, antiArmor: true }) }),
  FLAME: Object.freeze({ speed: 150, flags: freezeFlags({ incendiary: true, persistent: true, antiInfantry: true }) }),
  ROCKET: Object.freeze({ speed: 250, flags: freezeFlags({ explosive: true, antiArmor: true }) }),
  HOMING_MISSILE: Object.freeze({ speed: 270, flags: freezeFlags({ guided: true, explosive: true, proximityFuse: true }) }),
  GRENADE: Object.freeze({ speed: 150, flags: freezeFlags({ explosive: true, indirect: true }) }),
  MORTAR: Object.freeze({ speed: 135, flags: freezeFlags({ explosive: true, indirect: true, suppression: true }) }),
  ARTILLERY: Object.freeze({ speed: 170, flags: freezeFlags({ explosive: true, indirect: true, suppression: true }) }),
  HEAVY_SHELL: Object.freeze({ speed: 390, flags: freezeFlags({ piercing: true, antiArmor: true, ricochet: true }) }),
  BIO_PROJECTILE: Object.freeze({ speed: 190, flags: freezeFlags({ corrosive: true, antiInfantry: true }) })
});

export function inferProjectileType(weapon = {}) {
  if (TYPE_SET.has(weapon.projectileType)) return weapon.projectileType;
  const identity = `${weapon.id || ""} ${weapon.label || ""} ${weapon.ammoType || ""}`.toLowerCase();
  if (/guided|seeker|homing|missile/.test(identity)) return "HOMING_MISSILE";
  if (/artillery|earthshaker|basilisk/.test(identity)) return "ARTILLERY";
  if (/mortar/.test(identity)) return "MORTAR";
  if (/grenade/.test(identity)) return "GRENADE";
  if (/rocket/.test(identity)) return "ROCKET";
  if (/flam|promethium/.test(identity)) return "FLAME";
  if (/melta/.test(identity)) return "MELTA";
  if (/continuous beam|laser|lasgun|lascannon|beam/.test(identity)) return "BEAM";
  if (/plasma/.test(identity)) return "PLASMA";
  if (/bio|acid|spore|venom/.test(identity)) return "BIO_PROJECTILE";
  if (/tank|cannon|shell|rail|gauss|autocannon/.test(identity)) return "HEAVY_SHELL";
  if (/shotgun|scatter|pellet/.test(identity)) return "PELLET";
  if (/bolt/.test(identity)) return "BOLT";
  if (/energy|pulse|tesla|particle|warp|psychic|sonic|haywire/.test(identity)) return "ENERGY_BOLT";
  return "BALLISTIC";
}

export function normalizeProjectileFlags(source = {}, fallback = {}) {
  const provided = Array.isArray(source)
    ? Object.fromEntries(source.filter(flag => FLAG_SET.has(flag)).map(flag => [flag, true]))
    : source;
  return freezeFlags({ ...fallback, ...provided });
}

export function projectileArchetypeForWeapon(weapon = {}) {
  const type = inferProjectileType(weapon);
  const archetype = PROJECTILE_ARCHETYPES[type];
  const catalog = globalThis.AWTData?.projectiles?.classes?.[type] || {};
  const flags = normalizeProjectileFlags(weapon.behaviorFlags || weapon.flags, { ...archetype.flags, ...(catalog.flags || {}) });
  return Object.freeze({ type, speed: Math.max(1, Number(weapon.projectileSpeed) || Number(catalog.speed) || archetype.speed), flags });
}

export function compactProjectileRuntime(weapon = {}) {
  const archetype = projectileArchetypeForWeapon(weapon);
  let mask = 0;
  PROJECTILE_BEHAVIOR_FLAGS.forEach((flag, index) => { if (archetype.flags[flag]) mask |= 1 << index; });
  return Object.freeze({ type: PROJECTILE_TYPES.indexOf(archetype.type), flagMask: mask, speed: archetype.speed });
}

export function projectileHasFlag(projectile = {}, flag) {
  const index = PROJECTILE_BEHAVIOR_FLAGS.indexOf(flag);
  if (index < 0) return false;
  if (Number.isInteger(projectile.flagMask)) return Boolean(projectile.flagMask & (1 << index));
  return Boolean(projectile.flags?.[flag]);
}
