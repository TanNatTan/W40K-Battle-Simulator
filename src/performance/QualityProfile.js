// Quality profiles for low-end hardware. A profile is plain data: the canvas
// back-buffer scale, the frame-rate cap, how much vegetation detail is baked,
// and how hard the per-frame simulation slice may push the main thread.

export const QUALITY_PROFILES = Object.freeze({
  low: Object.freeze({
    id: "low", label: "Low (old PC)", renderScale: 0.5, maxFps: 20, vegetationPpu: 0.75,
    simBudgetMs: 5, uiInterval: 0.5, rigZoom: 1.6
  }),
  balanced: Object.freeze({
    id: "balanced", label: "Balanced", renderScale: 0.75, maxFps: 30, vegetationPpu: 1,
    simBudgetMs: 8, uiInterval: 0.25, rigZoom: 1.1
  }),
  high: Object.freeze({
    id: "high", label: "High", renderScale: 1, maxFps: 60, vegetationPpu: 1.5,
    simBudgetMs: 10, uiInterval: 0.25, rigZoom: 0.9
  })
});

export const QUALITY_IDS = Object.freeze(Object.keys(QUALITY_PROFILES));
export const QUALITY_STORAGE_KEY = "awt.quality";

export function qualityProfile(id) {
  return QUALITY_PROFILES[id] || QUALITY_PROFILES.balanced;
}

/**
 * Pick a starting profile from what the browser reveals about the machine.
 * Weak CPUs, little memory, data-saver mode or a software renderer all point
 * at "low"; a strong machine gets "high"; everything else is "balanced".
 */
export function detectQuality({ cores, memoryGb, saveData = false, softwareRenderer = false } = {}) {
  if (softwareRenderer || saveData) return "low";
  if ((cores && cores <= 2) || (memoryGb && memoryGb <= 2)) return "low";
  if ((cores && cores <= 4) || (memoryGb && memoryGb <= 4)) return "balanced";
  return cores && cores >= 8 && (!memoryGb || memoryGb >= 8) ? "high" : "balanced";
}

/** Vegetation bake resolution (pixels per world unit) for a camera zoom, capped by the profile. */
export function vegetationPpuFor(zoom, profile) {
  const cap = profile?.vegetationPpu ?? 1.5;
  const wanted = zoom <= 0.35 ? 0.5 : zoom <= 0.7 ? 0.75 : zoom <= 1.1 ? 1 : 1.5;
  return Math.min(cap, wanted);
}

/** The shortest time between two drawn frames under a profile, given the load-based interval. */
export function qualityRenderInterval(baseInterval, profile) {
  return Math.max(baseInterval, 1 / (profile?.maxFps || 60));
}
