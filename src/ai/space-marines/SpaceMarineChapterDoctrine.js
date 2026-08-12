const DEFAULT_DOCTRINE = Object.freeze({ defense: 1, production: 1, resources: 1, capture: 1 });

export const SPACE_MARINE_CHAPTER_DOCTRINES = Object.freeze({
  Ultramarines: Object.freeze({ defense: 1.05, production: 1.1, resources: 1.05, capture: 1.05 }),
  "Blood Angels": Object.freeze({ defense: 0.8, production: 1.2, resources: 0.85, capture: 1.2 }),
  "Imperial Fists": Object.freeze({ defense: 1.55, production: 1, resources: 0.95, capture: 0.9 }),
  Salamanders: Object.freeze({ defense: 1.3, production: 1, resources: 1.1, capture: 0.95 }),
  "Emerald Suns": Object.freeze({ defense: 1.2, production: 1.08, resources: 1.08, capture: 1.02 }),
  "White Scars": Object.freeze({ defense: 0.65, production: 1.15, resources: 0.9, capture: 1.45 }),
  "Raven Guard": Object.freeze({ defense: 0.8, production: 1.05, resources: 0.9, capture: 1.4 }),
  "Iron Hands": Object.freeze({ defense: 1.1, production: 1.25, resources: 1.2, capture: 0.95 }),
  "Space Wolves": Object.freeze({ defense: 0.82, production: 1.12, resources: 0.92, capture: 1.24 }),
  "Black Templars": Object.freeze({ defense: 0.88, production: 1.18, resources: 0.86, capture: 1.2 })
});

export function isSpaceMarinePlayer(player = {}) {
  return String(player.faction || "").trim().toLowerCase() === "space marines";
}

export function spaceMarineChapterDoctrineFor(playerOrChapter = {}) {
  const chapter = typeof playerOrChapter === "string" ? playerOrChapter : playerOrChapter.subfaction;
  return Object.freeze({ ...DEFAULT_DOCTRINE, ...(SPACE_MARINE_CHAPTER_DOCTRINES[chapter] || {}) });
}
