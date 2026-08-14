export const SPACE_MARINE_TERRITORY_REQUISITION_PER_SECOND = 5;
export const SPACE_MARINE_CAPTURE_REQUISITION_BONUS = 5;
export const SPACE_MARINE_LISTENING_POST_REQUISITION_PER_SECOND = 5;

export function isSpaceMarineEconomy(player = {}) {
  return String(player.faction || "").toLowerCase() === "space marines";
}

export function uniqueOperationalListeningPosts(structures = [], playerId = "", cellKeyFor = structure => structure.cellKey) {
  const cells = new Set();
  const posts = [];
  for (const structure of structures) {
    if (structure.faction !== playerId || structure.type !== "observationtower" || structure.alive === false || structure.progress < 1) continue;
    const key = cellKeyFor(structure);
    if (cells.has(key)) continue;
    cells.add(key);
    posts.push(structure);
  }
  return posts;
}

export function spaceMarineTerritoryIncome({ player = {}, claimedTerritories = 0, structures = [], cellKeyFor, seconds = 1 } = {}) {
  if (!isSpaceMarineEconomy(player)) return Object.freeze({ requisition: 0, territory: 0, listeningPosts: 0 });
  const elapsed = Math.max(0, Number(seconds) || 0);
  const territory = Math.max(0, Math.floor(Number(claimedTerritories) || 0));
  const listeningPosts = uniqueOperationalListeningPosts(structures, player.id, cellKeyFor).length;
  return Object.freeze({
    requisition: (territory * SPACE_MARINE_TERRITORY_REQUISITION_PER_SECOND
      + listeningPosts * SPACE_MARINE_LISTENING_POST_REQUISITION_PER_SECOND) * elapsed,
    territory,
    listeningPosts
  });
}

export function listeningPostNeeded({ requisition = 0, capacity = 1, projectedDemandPerSecond = 0, baseIncomePerSecond = 0, recentlyCapturedSafeTerritory = false } = {}) {
  const ratio = Math.max(0, Number(requisition) || 0) / Math.max(1, Number(capacity) || 1);
  return ratio < 0.5 || Number(projectedDemandPerSecond) > Number(baseIncomePerSecond) || Boolean(recentlyCapturedSafeTerritory);
}

