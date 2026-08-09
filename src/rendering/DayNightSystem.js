const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

export const PERIOD_DARKNESS = Object.freeze({
  Dawn: 0.26,
  Morning: 0.08,
  Noon: 0,
  Afternoon: 0.04,
  Sunset: 0.18,
  Dusk: 0.34,
  Night: 0.55
});

export const PERIOD_VISIBILITY = Object.freeze({
  Dawn: 0.78,
  Morning: 0.96,
  Noon: 1,
  Afternoon: 0.98,
  Sunset: 0.82,
  Dusk: 0.67,
  Night: 0.52
});

const WEATHER_DARKNESS = Object.freeze({ clear: 0, fog: 0.06, rain: 0.08, snow: -0.03, dust: 0.12 });
const WEATHER_VISIBILITY = Object.freeze({ clear: 1, fog: 0.72, rain: 0.86, snow: 0.94, dust: 0.68 });

export function dayNightDarkness(period, weather = "clear") {
  return clamp((PERIOD_DARKNESS[period] ?? 0) + (WEATHER_DARKNESS[weather] ?? 0), 0, 0.68);
}

export function globalDayNightVisibility({ period = "Noon", weather = "clear", nightVision = 0, affectsDetection = true } = {}) {
  if (!affectsDetection) return 1;
  const base = PERIOD_VISIBILITY[period] ?? 1;
  const restored = (1 - base) * clamp(Number(nightVision) || 0, 0, 1) * 0.75;
  return clamp((base + restored) * (WEATHER_VISIBILITY[weather] ?? 1), 0.35, 1.1);
}
