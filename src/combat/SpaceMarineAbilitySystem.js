import { spaceMarineProfileFor } from "../ai/space-marines/SpaceMarineForceComposition.js";

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
const range = (a, b) => Math.hypot((a.x || 0) - (b.x || 0), (a.y || 0) - (b.y || 0));

export function ensureSpaceMarineAbilityState(unit, now = 0) {
  unit.abilityState ||= { nextThinkAt: now, cooldowns: {}, ironHalo: null };
  if ((unit.abilities || []).includes("iron-halo")) unit.abilityState.ironHalo ||= { current: 70, maximum: 70, rechargeDelay: 8, rechargeRate: 7, lastHitAt: -Infinity };
  return unit.abilityState;
}

export function updateSpaceMarinePassiveAbilities(unit, dt, now) {
  const state = ensureSpaceMarineAbilityState(unit, now);
  const halo = state.ironHalo;
  if (halo && now - halo.lastHitAt >= halo.rechargeDelay) halo.current = clamp(halo.current + halo.rechargeRate * dt, 0, halo.maximum);
  unit.ironHalo = halo ? { current: halo.current, maximum: halo.maximum } : null;
  unit.meleeAttackSpeedMultiplier = (unit.litanyUntil || 0) > now ? 1.15 : 1;
  return state;
}

export function absorbSpaceMarineDamage(unit, damage, now, { frontal = false } = {}) {
  let remaining = Math.max(0, damage);
  if (frontal && unit.frontalDamageReduction) remaining *= 1 - unit.frontalDamageReduction;
  const halo = ensureSpaceMarineAbilityState(unit, now).ironHalo;
  if (!halo?.current) return { damage: remaining, absorbed: 0 };
  const absorbed = Math.min(halo.current, remaining);
  halo.current -= absorbed;
  halo.lastHitAt = now;
  unit.ironHalo = { current: halo.current, maximum: halo.maximum };
  return { damage: remaining - absorbed, absorbed };
}

export function spaceMarineAttackDelayMultiplier(unit, target, now = 0) {
  let multiplier = 1 / Math.max(0.25, Number(unit.attackRateMultiplier) || 1);
  if ((unit.litanyUntil || 0) > now) multiplier *= 0.85;
  if ((unit.tempormortisUntil || 0) > now) multiplier *= 1.25;
  if ((unit.machineBlessingUntil || 0) > now) multiplier *= 0.9;
  if (spaceMarineProfileFor(unit).specialty === "hellblaster" && (target?.role === "vehicle" || target?.role === "commander" || (target?.armorProtection || 0) >= 12)) multiplier *= 1.08;
  return multiplier;
}

export function spaceMarineDamageMultiplier(unit, target, now = 0) {
  const specialty = spaceMarineProfileFor(unit).specialty;
  let multiplier = (unit.litanyUntil || 0) > now ? 1.08 : 1;
  if (specialty === "hellblaster" && (target?.role === "vehicle" || target?.role === "commander" || (target?.armorProtection || 0) >= 12)) multiplier *= 1.35;
  if (specialty === "eliminator" && (target?.role === "commander" || target?.role === "medic" || target?.role === "engineer" || /artillery/i.test(target?.name || ""))) multiplier *= 1.45;
  if (specialty === "sternguard") multiplier *= target?.role === "vehicle" ? 1.18 : (target?.hp || 1) > (target?.maxHp || 1) * 0.8 ? 1.12 : 1.2;
  return multiplier;
}

export function evaluateSpaceMarineAbility(unit, { allies = [], enemies = [], vehicles = [], now = 0, dt = 0, formationActive = false } = {}) {
  const state = updateSpaceMarinePassiveAbilities(unit, dt, now);
  if (!unit.abilities?.length || state.nextThinkAt > now) return [];
  state.nextThinkAt = now + 0.25 + (Number(unit.index) || 0) % 6 * 0.035;
  const events = [];
  const specialty = spaceMarineProfileFor(unit).specialty;
  const nearbyAllies = allies.filter(ally => ally.alive !== false && range(unit, ally) <= 110);
  const availableEnemies = enemies.filter(enemy => enemy.alive !== false && range(unit, enemy) <= 300);
  const nearbyEnemies = availableEnemies.filter(enemy => range(unit, enemy) <= 115);
  if (specialty === "chaplain" && nearbyAllies.length >= 3 && (state.cooldowns.litany || 0) <= now) {
    for (const ally of nearbyAllies) {
      ally.litanyUntil = now + 11;
      ally.morale = clamp((ally.morale || 0.7) + 0.16, 0, 1);
      ally.litanySuppressionResistance = 0.2;
    }
    state.cooldowns.litany = now + 32;
    events.push({ type: "LITANY", affected: nearbyAllies.length });
  }
  if (specialty === "judiciar" && nearbyEnemies.length >= 2 && (state.cooldowns.tempormortis || 0) <= now) {
    for (const enemy of nearbyEnemies.filter(enemy => range(unit, enemy) <= 62)) enemy.tempormortisUntil = now + 7;
    state.cooldowns.tempormortis = now + 28;
    events.push({ type: "TEMPORMORTIS" });
  }
  if (specialty === "librarian" && nearbyEnemies.length && (state.cooldowns.smite || 0) <= now) {
    state.cooldowns.smite = now + 12;
    events.push({ type: "SMITE", target: nearbyEnemies.sort((a, b) => range(unit, a) - range(unit, b))[0], damage: 22 });
  } else if (specialty === "librarian" && nearbyAllies.length >= 3 && (state.cooldowns.barrier || 0) <= now) {
    for (const ally of nearbyAllies) ally.psychicBarrierUntil = now + 8;
    state.cooldowns.barrier = now + 24;
    events.push({ type: "PSYCHIC_BARRIER" });
  }
  if (specialty === "techmarine") {
    const damaged = vehicles.filter(vehicle => vehicle.alive !== false && range(unit, vehicle) <= 24 && vehicle.hp < vehicle.maxHp)
      .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    if (damaged) {
      damaged.hp = clamp(damaged.hp + dt * 9, 1, damaged.maxHp);
      damaged.machineBlessingUntil = now + 5;
      events.push({ type: "BATTLEFIELD_REPAIR", target: damaged });
    }
  }
  if (specialty === "ancient") for (const ally of nearbyAllies) ally.bannerAuraUntil = now + 1;
  if (specialty === "bladeguard" && formationActive) unit.shieldWallActive = true;
  else unit.shieldWallActive = false;
  if (["jump-assault", "vanguard"].includes(specialty) && availableEnemies.length && (state.cooldowns.jump || 0) <= now) {
    const target = availableEnemies.sort((a, b) => range(unit, a) - range(unit, b))[0];
    if (range(unit, target) >= 55 && range(unit, target) <= (specialty === "vanguard" ? 250 : 220)) {
      state.cooldowns.jump = now + (specialty === "vanguard" ? 11 : 14);
      events.push({ type: "JUMP", target, airborneSeconds: 0.65 });
    }
  }
  if (specialty === "terminator" || specialty === "assault-terminator") {
    const target = availableEnemies.sort((a, b) => range(unit, a) - range(unit, b))[0];
    if (target && range(unit, target) >= 120 && (state.cooldowns.teleport || 0) <= now) {
      state.cooldowns.teleport = now + 70;
      events.push({ type: "TELEPORT", target });
    }
  }
  return events;
}
