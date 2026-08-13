const FALLBACK_WEAPON = Object.freeze({
  id: "rifle",
  label: "Service Rifle",
  damage: 12,
  penetration: 10,
  range: 112,
  rateOfFire: 0.82,
  magazineSize: 8,
  reloadTime: 2.4,
  projectileSpeed: 225,
  accuracy: 1,
  precision: 1,
  suppression: 0.1,
  heatPerShot: 0.08,
  coolRate: 0.22,
  maxHeat: 1,
  splashRadius: 0,
  targetRestrictions: ["unit", "vehicle", "building"],
  tracerColor: "#f5d76e",
  melee: Object.freeze({ reach: 8, damage: 8, penetration: 4, attackSpeed: 1, windUp: 0.28, recovery: 0.62, stagger: 0.16, knockback: 2, cleave: 1, block: 0.08, parry: 0.06, chargeBonus: 0.18 })
});

const UNARMED_PROFILE = Object.freeze({
  ...FALLBACK_WEAPON,
  id: "unarmed",
  label: "Unarmed Logistics Rig",
  damage: 0,
  penetration: 0,
  range: 0,
  magazineSize: 0,
  projectileSpeed: 0,
  accuracy: 0,
  precision: 0,
  suppression: 0,
  heatPerShot: 0,
  targetRestrictions: Object.freeze([]),
  melee: Object.freeze({ reach: 0, damage: 0, penetration: 0, attackSpeed: 1, windUp: 0, recovery: 0, stagger: 0, knockback: 0, cleave: 1, block: 0, parry: 0, chargeBonus: 0 })
});

const WEAPON_ALIASES = Object.freeze({
  rifle: "rifle",
  boltgun: "bolter",
  bolter: "bolter",
  carbine: "carbine",
  "heavy gun": "heavy-gun",
  "heavy-gun": "heavy-gun",
  "engineer tools": "engineer-tools",
  "engineer-tools": "engineer-tools",
  unarmed: "unarmed"
});

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
const angleDifference = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

export const RANGED_AMMO_CAPACITY_MULTIPLIER = 4;

export function baseAmmoCapacityFor(unit, catalog) {
  const profile = weaponProfileFor(unit, catalog);
  if (!profile.magazineSize) return 0;
  if (Number.isFinite(unit?.baselineAmmoCapacity)) return Math.max(profile.magazineSize, Math.floor(unit.baselineAmmoCapacity));
  if (Number.isFinite(unit?.carriedMagazines) || Number.isFinite(profile.carriedMagazines)) {
    return profile.magazineSize * Math.max(1, Math.floor(unit.carriedMagazines || profile.carriedMagazines));
  }
  return unit?.role === "vehicle" ? 18 : 16;
}

export function ammoCapacityFor(unit, catalog) {
  return baseAmmoCapacityFor(unit, catalog) * RANGED_AMMO_CAPACITY_MULTIPLIER;
}

export function synchronizeAmmoState(unit, { refill = false, catalog } = {}) {
  const profile = weaponProfileFor(unit, catalog);
  const maximum = ammoCapacityFor(unit, catalog);
  unit.maxAmmo = maximum;
  unit.ammo = refill ? maximum : clamp(Math.floor(Number(unit.ammo) || 0), 0, maximum);
  unit.weaponState ||= {};
  unit.weaponState.profileId = profile.id;
  unit.weaponState.magazineCapacity = profile.magazineSize;
  unit.weaponState.roundsInMagazine = refill
    ? Math.min(profile.magazineSize, unit.ammo)
    : Math.min(profile.magazineSize, unit.ammo, Math.max(0, Math.floor(unit.weaponState.roundsInMagazine ?? unit.ammo)));
  unit.weaponState.magazine = unit.weaponState.roundsInMagazine;
  unit.weaponState.reserveCapacity = Math.max(0, maximum - profile.magazineSize);
  unit.weaponState.reserveAmmo = Math.max(0, unit.ammo - unit.weaponState.roundsInMagazine);
  return unit.weaponState;
}

export function retreatReasonFor(unit, { tyranid = false, usesFear = false, usesMoraleRout = false, casualtyThreshold = 0.3 } = {}) {
  if (tyranid) return null;
  if ((unit.hp || 0) < (unit.maxHp || 1) * casualtyThreshold) return "health";
  if (usesMoraleRout && (unit.morale ?? 1) < 0.23) return "morale";
  if (usesFear && (unit.combatStress ?? 0) >= (unit.breakThreshold ?? 90)) return "fear";
  if ((unit.ammo || 0) <= 0 && weaponProfileFor(unit).magazineSize > 0) return "ammo";
  return unit.retreatReason === "objective" || unit.retreatReason === "command" ? unit.retreatReason : null;
}

export function weaponIdFor(unitOrName) {
  if (typeof unitOrName === "string") return WEAPON_ALIASES[unitOrName.trim().toLowerCase()] || unitOrName.trim().toLowerCase().replaceAll(" ", "-");
  if (unitOrName?.weaponId) return unitOrName.weaponId;
  if (unitOrName?.role === "vehicle") return "heavy-gun";
  if (unitOrName?.role === "builder") return "engineer-tools";
  if (unitOrName?.role === "supply") return "unarmed";
  if (unitOrName?.role === "scout") return "carbine";
  if (unitOrName?.faction === "Space Marines") return "bolter";
  return WEAPON_ALIASES[String(unitOrName?.weapon || "rifle").toLowerCase()] || "rifle";
}

export function weaponProfileFor(unitOrName, catalog = globalThis.AWTData?.weapons) {
  const id = weaponIdFor(unitOrName);
  return catalog?.[id] || (id === "unarmed" ? UNARMED_PROFILE : catalog?.rifle || FALLBACK_WEAPON);
}

export function ensureWeaponState(unit, catalog) {
  const profile = weaponProfileFor(unit, catalog);
  unit.weaponId = profile.id;
  unit.weaponState ||= {};
  const state = unit.weaponState;
  state.profileId = profile.id;
  state.roundsInMagazine ??= Math.min(profile.magazineSize, Math.max(0, Math.floor(unit.ammo || 0)));
  state.magazineCapacity = profile.magazineSize;
  state.magazine = state.roundsInMagazine;
  state.carriedMagazines ??= unit.carriedMagazines || profile.carriedMagazines || 6;
  state.reserveCapacity ??= Math.max(0, (unit.maxAmmo || profile.magazineSize * state.carriedMagazines) - profile.magazineSize);
  state.reserveAmmo = Math.max(0, Math.floor(unit.ammo || 0) - state.roundsInMagazine);
  state.reloadRemaining ??= 0;
  state.heat ??= 0;
  state.overheated ??= false;
  state.shotsFired ??= 0;
  unit.meleeState ||= { phase: "idle", remaining: 0, targetId: null, charged: false };
  return { profile, state };
}

export function updateCombatState(unit, dt, catalog) {
  const { profile, state } = ensureWeaponState(unit, catalog);
  const events = [];
  state.heat = clamp(state.heat - profile.coolRate * dt, 0, profile.maxHeat);
  if (state.overheated && state.heat <= profile.maxHeat * 0.35) state.overheated = false;
  if (state.reloadRemaining > 0) {
    state.reloadRemaining = Math.max(0, state.reloadRemaining - dt);
    if (state.reloadRemaining === 0) {
      state.roundsInMagazine = Math.min(profile.magazineSize, Math.max(0, Math.floor(unit.ammo || 0)));
      state.magazine = state.roundsInMagazine;
      state.reserveAmmo = Math.max(0, Math.floor(unit.ammo || 0) - state.roundsInMagazine);
      events.push({ type: "reloaded", rounds: state.roundsInMagazine });
    }
  }

  const melee = unit.meleeState;
  if (melee.phase !== "idle") {
    melee.remaining = Math.max(0, melee.remaining - dt);
    if (melee.remaining === 0 && melee.phase === "windup") {
      events.push({ type: "melee-strike", targetId: melee.targetId, charged: melee.charged });
      melee.phase = "recovery";
      melee.remaining = profile.melee.recovery / Math.max(0.2, profile.melee.attackSpeed * (unit.meleeAttackSpeedMultiplier || 1));
    } else if (melee.remaining === 0 && melee.phase === "recovery") {
      melee.phase = "idle";
      melee.targetId = null;
      melee.charged = false;
    }
  }
  return events;
}

export function requestRangedShot(unit, catalog) {
  const { profile, state } = ensureWeaponState(unit, catalog);
  if (!profile.magazineSize || unit.ammo <= 0) return { allowed: false, reason: "empty", profile };
  if (state.reloadRemaining > 0) return { allowed: false, reason: "reloading", profile };
  if (state.overheated || state.heat >= profile.maxHeat) {
    state.overheated = true;
    return { allowed: false, reason: "overheated", profile };
  }
  if (state.roundsInMagazine <= 0) {
    state.reloadRemaining = profile.reloadTime;
    return { allowed: false, reason: "reload-started", profile };
  }
  state.roundsInMagazine -= 1;
  state.magazine = state.roundsInMagazine;
  unit.ammo = Math.max(0, Math.floor(unit.ammo || 0) - 1);
  state.reserveAmmo = Math.max(0, unit.ammo - state.roundsInMagazine);
  state.heat = clamp(state.heat + profile.heatPerShot, 0, profile.maxHeat);
  state.shotsFired += 1;
  if (state.roundsInMagazine === 0 && unit.ammo > 0) state.reloadRemaining = profile.reloadTime;
  if (state.heat >= profile.maxHeat) state.overheated = true;
  return { allowed: true, profile, state };
}

export function beginMeleeAttack(unit, targetId, charged = false, catalog) {
  const { profile } = ensureWeaponState(unit, catalog);
  if (unit.meleeState.phase !== "idle") return false;
  unit.meleeState.phase = "windup";
  unit.meleeState.remaining = profile.melee.windUp / Math.max(0.2, profile.melee.attackSpeed * (unit.meleeAttackSpeedMultiplier || 1));
  unit.meleeState.targetId = targetId;
  unit.meleeState.charged = Boolean(charged);
  return true;
}

export function armorFacingFor(target, projectile) {
  if (target?.role !== "vehicle") return "body";
  const facing = Number.isFinite(target.facing) ? target.facing : 0;
  const incoming = Math.atan2(-(projectile?.vy || 0), -(projectile?.vx || 1));
  const difference = Math.abs(angleDifference(incoming, facing));
  if (difference <= Math.PI / 4) return "front";
  if (difference >= Math.PI * 3 / 4) return "rear";
  return "side";
}

export function resolveArmorHit(target, projectile, random = Math.random) {
  const facing = armorFacingFor(target, projectile);
  const base = Math.max(0, Number(target?.armorProtection) || 0);
  const armor = facing === "front" ? base * 1.28 : facing === "side" ? base : facing === "rear" ? base * 0.62 : base;
  const penetration = Math.max(0, Number(projectile?.penetration) || 0);
  const obliquity = facing === "front" ? 0.12 : facing === "side" ? 0.22 : 0.06;
  const ricochetChance = clamp(obliquity + (armor - penetration) / Math.max(20, armor * 2.5), 0.02, 0.72);
  const penetrationChance = clamp(0.42 + (penetration - armor) / Math.max(16, armor * 1.65), 0.04, 0.97);
  const roll = random();
  if (roll < ricochetChance) return { facing, armor, result: "ricochet", multiplier: 0.03, critical: false };
  if (roll < ricochetChance + penetrationChance * (1 - ricochetChance)) {
    const criticalChance = clamp((penetration - armor) / 40 + 0.08, 0.04, 0.48);
    return { facing, armor, result: "penetrated", multiplier: 0.78 + random() * 0.42, critical: random() < criticalChance };
  }
  return { facing, armor, result: "reduced", multiplier: 0.12, critical: false };
}

export function resolveMeleeStrike(attacker, defender, random = Math.random, catalog) {
  const profile = weaponProfileFor(attacker, catalog).melee;
  const defenseProfile = weaponProfileFor(defender, catalog).melee;
  const parried = random() < clamp((defender.reflexes || 0.5) * defenseProfile.parry, 0, 0.65);
  if (parried) return { result: "parried", damage: 0, stagger: 0, knockback: 0, cleave: profile.cleave };
  const blocked = random() < clamp((defender.discipline || 0.5) * defenseProfile.block, 0, 0.72);
  const chargeMultiplier = attacker.meleeState?.charged ? 1 + profile.chargeBonus : 1;
  const armorReduction = clamp(1 - Math.max(0, (defender.armorProtection || 0) - profile.penetration) / 32, 0.18, 1);
  const damage = profile.damage * chargeMultiplier * armorReduction * (blocked ? 0.35 : 0.82 + random() * 0.36);
  return {
    result: blocked ? "blocked" : "hit",
    damage,
    stagger: profile.stagger * (blocked ? 0.4 : 1),
    knockback: profile.knockback * (blocked ? 0.25 : 1),
    cleave: profile.cleave
  };
}

export function moraleAuraFor(unit, allies) {
  let recovery = 0;
  for (const ally of allies) {
    if (!ally?.alive || ally.id === unit.id) continue;
    if (ally.role === "commander") recovery += 0.0024;
    if (ally.role === "standard" || /standard|banner/i.test(`${ally.attachment || ""} ${ally.specialty || ""}`)) recovery += 0.0032;
    if (/chaplain|apostle/i.test(`${ally.name || ""} ${ally.specialty || ""}`)) recovery += 0.004;
  }
  return clamp(recovery, 0, 0.012);
}

export { FALLBACK_WEAPON };
