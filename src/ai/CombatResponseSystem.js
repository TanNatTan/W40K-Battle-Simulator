const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, Number(value) || 0));
const distanceBetween = (a = {}, b = {}) => Math.hypot((Number(a.x) || 0) - (Number(b.x) || 0), (Number(a.y) || 0) - (Number(b.y) || 0));

export const COMBAT_RESPONSES = Object.freeze({
  NO_CONTACT: "NO_CONTACT",
  ENGAGE: "ENGAGE",
  CLOSE_DISTANCE: "CLOSE_DISTANCE",
  KEEP_RANGE: "KEEP_RANGE",
  TAKE_COVER: "TAKE_COVER",
  FLANK: "FLANK",
  FINISH: "FINISH",
  HOLD_FIRE: "HOLD_FIRE",
  TACTICAL_WITHDRAW: "TACTICAL_WITHDRAW",
  CALL_SUPPORT: "CALL_SUPPORT",
  CONTAIN: "CONTAIN"
});

function targetValue(target = {}) {
  if (target.role === "commander") return 22;
  if (target.role === "vehicle") return 18;
  if (["medic", "engineer"].includes(target.role)) return 12;
  if (target.type === "outpost") return 20;
  return 0;
}

export function chooseImmediateThreat(unit = {}, visibleEnemies = [], { distanceTo = distanceBetween } = {}) {
  return visibleEnemies
    .filter(target => target && target.alive !== false)
    .map(target => {
      const range = Math.max(1, Number(target.range) || 0);
      const distance = distanceTo(unit, target);
      const directThreat = target.targetId === unit.id || unit.squadId && target.targetId === unit.squadId ? 45 : 0;
      const proximity = clamp(1 - distance / Math.max(48, range * 1.25), 0, 1) * 40;
      const weakness = clamp(1 - (target.hp || 0) / Math.max(1, target.maxHp || 1), 0, 1) * 12;
      return { target, score: directThreat + proximity + targetValue(target) + weakness };
    })
    .sort((a, b) => b.score - a.score || distanceTo(unit, a.target) - distanceTo(unit, b.target))[0]?.target || null;
}

export function chooseSquadTarget(squad = {}, visibleEnemies = []) {
  const ids = [squad.combatContact?.targetId, squad.targetId].filter(Boolean);
  for (const id of ids) {
    const target = visibleEnemies.find(candidate => candidate?.id === id && candidate.alive !== false);
    if (target) return target;
  }
  return null;
}

export function evaluateCombatResponse({ unit = {}, squad = {}, visibleEnemies = [], context = {} } = {}) {
  if (!visibleEnemies.length) return { action: COMBAT_RESPONSES.NO_CONTACT, target: null, reason: "no-visible-contact" };
  const immediateThreat = chooseImmediateThreat(unit, visibleEnemies, context);
  const squadTarget = chooseSquadTarget(squad, visibleEnemies);
  const target = immediateThreat || squadTarget;
  if (!target) return { action: COMBAT_RESPONSES.NO_CONTACT, target: null, reason: "no-valid-contact" };
  if (context.explicitHoldFire) return { action: COMBAT_RESPONSES.HOLD_FIRE, target, reason: "explicit-concealment-order" };

  const distance = (context.distanceTo || distanceBetween)(unit, target);
  const range = Math.max(1, Number(context.effectiveRange ?? unit.range) || 1);
  const meleeReach = Math.max(0, Number(context.meleeReach) || 0);
  const confidence = clamp(context.confidence ?? 50, 0, 100);
  const hasWeapon = context.hasWeapon !== false && ((unit.damage || 0) > 0 || context.hasWeapon === true);
  const hasAmmo = context.hasAmmo ?? (unit.ammo || 0) > 0;
  const finishRecommended = typeof context.finishRecommended === "function"
    ? context.finishRecommended(target) : Boolean(context.finishRecommended);

  if (finishRecommended && hasWeapon) return { action: COMBAT_RESPONSES.FINISH, target, reason: "low-condition-hostile" };
  if (!hasWeapon) return { action: COMBAT_RESPONSES.CALL_SUPPORT, target, reason: "unarmed-contact" };
  if (!hasAmmo && distance > meleeReach) return { action: COMBAT_RESPONSES.CALL_SUPPORT, target, reason: "requires-resupply-or-support" };
  if (context.commandWithdrawal) return { action: COMBAT_RESPONSES.TACTICAL_WITHDRAW, target, reason: "ordered-disengagement" };
  if (distance <= meleeReach) return { action: COMBAT_RESPONSES.ENGAGE, target, reason: "close-combat-contact" };
  if (confidence < 25) return { action: context.inCover ? COMBAT_RESPONSES.CONTAIN : COMBAT_RESPONSES.TAKE_COVER, target, reason: "defensive-contact" };
  if (confidence < 45) return { action: distance < range * 0.42 ? COMBAT_RESPONSES.KEEP_RANGE : COMBAT_RESPONSES.CONTAIN, target, reason: "controlled-contact" };
  if (distance > range * 0.92) return { action: confidence >= 70 ? COMBAT_RESPONSES.CLOSE_DISTANCE : COMBAT_RESPONSES.FLANK, target, reason: "outside-effective-range" };
  return { action: COMBAT_RESPONSES.ENGAGE, target, reason: "visible-hostile" };
}

export function refreshSquadCombatContact(previous = null, target = null, now = 0, details = {}) {
  if (!target?.id) return previous;
  return {
    targetId: target.id,
    acquiredAt: previous?.targetId === target.id ? previous.acquiredAt : now,
    lastSeenAt: now,
    lastKnownX: Number(target.x) || 0,
    lastKnownY: Number(target.y) || 0,
    confidence: clamp(details.confidence ?? 1, 0, 1),
    reason: details.reason || "confirmed visual contact"
  };
}

export function combatContactPhase(contact = null, now = 0) {
  if (!contact?.targetId || !Number.isFinite(contact.lastSeenAt)) return "EXPIRED";
  const age = Math.max(0, now - contact.lastSeenAt);
  if (age <= 4) return "PURSUE_LAST_KNOWN";
  if (age <= 10) return "SEARCH_LAST_KNOWN";
  return "EXPIRED";
}

export function combatContactPoint(contact = null, now = 0) {
  const phase = combatContactPhase(contact, now);
  if (phase === "EXPIRED") return null;
  return { x: contact.lastKnownX, y: contact.lastKnownY, phase, targetId: contact.targetId };
}
