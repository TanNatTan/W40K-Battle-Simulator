const clamp = (value, minimum = 0, maximum = 100) => Math.max(minimum, Math.min(maximum, Number(value) || 0));

export const EMERALD_SUNS = Object.freeze({
  name: "Emerald Suns",
  founding: "22nd Founding",
  lineage: "Salamanders",
  colors: Object.freeze({ primary: "#0B6B53", secondary: "#D4AF37", accent: "#F5F2E8", pattern: "border" }),
  doctrine: "controlled_escalation_suppress_isolate_finish",
  medical: Object.freeze({ apothecaryPriority: 1.2, geneSeedPriority: 1.35, evacuationPriority: 1.15 })
});

export function isEmeraldSuns(player = {}) {
  return player.faction === "Space Marines" && String(player.subfaction || "").trim().toLowerCase() === "emerald suns";
}

export function chapterVisualDefaultsFor(player = {}) {
  return isEmeraldSuns(player) ? { ...EMERALD_SUNS.colors } : null;
}

export function applyChapterBattleAdaptation(player, behavior = {}, context = {}) {
  if (!isEmeraldSuns(player)) return { ...behavior };
  const enemyCondition = Math.max(0, Math.min(1, Number(context.enemyAverageCondition ?? 1) || 0));
  const degradedEnemy = Math.max(0, Math.min(1, (0.58 - enemyCondition) / 0.43));
  const supplyExposure = context.enemySupplyCritical ? 1 : 0;
  const finishPressure = Math.max(degradedEnemy, supplyExposure * 0.85);
  return {
    ...behavior,
    aggression: clamp((behavior.aggression ?? 54) + finishPressure * 18),
    caution: clamp((behavior.caution ?? 72) - finishPressure * 12),
    expansion: clamp((behavior.expansion ?? 51) + supplyExposure * 5),
    economy: clamp(behavior.economy ?? 61)
  };
}

export function chapterMedicalModifiersFor(player = {}) {
  return isEmeraldSuns(player) ? { ...EMERALD_SUNS.medical } : { apothecaryPriority: 1, geneSeedPriority: 1, evacuationPriority: 1 };
}

