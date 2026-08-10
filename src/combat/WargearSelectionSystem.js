const normalized = value => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const clamp01 = value => Math.max(0, Math.min(1, Number(value) || 0));

export const LOADOUT_RULES = Object.freeze({ standardWeaponMinimum: 0.5, specialistMaximum: 0.4, heavyMaximum: 0.25, duplicateHeavyMaximum: 2 });

function profileFor(player, doctrines) {
  const key = normalized(player?.subfaction || "ultramarines");
  return doctrines?.chapters?.[key] || doctrines?.chapters?.ultramarines || {};
}

export function scoreWeapon({ weapon, chapter = {}, squadRole = "offensive", enemyIntel = {}, economy = {}, duplicateCount = 0 } = {}) {
  const tags = new Set(weapon.tags || []);
  const chapterPreference = Number(chapter.preferences?.[weapon.id]) || 0;
  const rolePreference = Number(weapon.roles?.[squadRole]) || 0;
  const counter = (tags.has("anti-armor") ? clamp01(enemyIntel.armor) : 0)
    + (tags.has("anti-horde") ? clamp01(enemyIntel.horde) : 0)
    + (tags.has("precision") ? clamp01(enemyIntel.commanders) : 0);
  const ammoRatio = clamp01((economy.inventory?.ammunition || 0) / Math.max(1, economy.capacity?.ammunition || 1));
  return chapterPreference * 1.2 + rolePreference + counter * 1.4 + ammoRatio * 0.65
    - duplicateCount * 0.4 - (Number(weapon.costPressure) || 0) * (1.2 - ammoRatio) * 0.55;
}

export function selectSpaceMarineWargear({ player, manifest = [], squadRole = "offensive", enemyIntel = {}, economy = {}, doctrines = globalThis.AWTData?.wargearDoctrines } = {}) {
  if (player?.faction !== "Space Marines" || !manifest.length) return manifest.map(member => ({ ...member }));
  const weapons = Object.values(doctrines?.weapons || {});
  if (!weapons.length) return manifest.map(member => ({ ...member, weaponId: "bolter", weapon: "Boltgun" }));
  const chapter = profileFor(player, doctrines);
  const standard = weapons.find(weapon => weapon.category === "standard") || weapons[0];
  const standardCount = Math.ceil(manifest.length * LOADOUT_RULES.standardWeaponMinimum);
  const specialistLimit = Math.floor(manifest.length * LOADOUT_RULES.specialistMaximum);
  const heavyLimit = Math.floor(manifest.length * LOADOUT_RULES.heavyMaximum);
  const selectedCounts = {};
  let specialists = 0;
  let heavies = 0;
  return manifest.map((member, index) => {
    let selected = standard;
    if (index >= standardCount && specialists < specialistLimit) {
      const candidates = weapons.filter(weapon => weapon.category !== "standard"
        && (weapon.category !== "heavy" || heavies < heavyLimit)
        && (weapon.category !== "heavy" || (selectedCounts[weapon.id] || 0) < LOADOUT_RULES.duplicateHeavyMaximum));
      selected = candidates.sort((a, b) => scoreWeapon({ weapon: b, chapter, squadRole, enemyIntel, economy, duplicateCount: selectedCounts[b.id] || 0 })
        - scoreWeapon({ weapon: a, chapter, squadRole, enemyIntel, economy, duplicateCount: selectedCounts[a.id] || 0 }) || a.id.localeCompare(b.id))[0] || standard;
      if (selected.category !== "standard") specialists += 1;
      if (selected.category === "heavy") heavies += 1;
    }
    selectedCounts[selected.id] = (selectedCounts[selected.id] || 0) + 1;
    return {
      ...member,
      weaponId: selected.id,
      weapon: selected.label,
      ammoType: selected.ammoType,
      carriedMagazines: selected.carriedMagazines || 6,
      equipmentCost: { ...(globalThis.AWTData?.weapons?.[selected.id]?.cost || {}) }
    };
  });
}
