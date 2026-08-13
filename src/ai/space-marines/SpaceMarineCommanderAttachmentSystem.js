import { isSpaceMarineCharacter, spaceMarineProfileFor } from "./SpaceMarineForceComposition.js";

const preferredRoles = Object.freeze({
  chaplain: ["offensive", "siege", "reinforcement"],
  apothecary: ["medical-support", "reinforcement", "reserve"],
  techmarine: ["siege", "reinforcement", "economy-defense"],
  librarian: ["offensive", "siege", "base-defense"],
  judiciar: ["offensive", "base-defense", "reinforcement"],
  captain: ["offensive", "reinforcement", "base-defense"],
  "chapter-master": ["offensive", "reinforcement", "base-defense"],
  lieutenant: ["offensive", "capture", "reinforcement"],
  ancient: ["offensive", "base-defense", "reinforcement"],
  "company-champion": ["base-defense", "offensive", "escort"],
  sergeant: ["offensive", "capture", "base-defense"]
});

export function attachmentScore(character, squad, members = []) {
  const specialty = spaceMarineProfileFor(character).specialty;
  const preferences = preferredRoles[specialty] || ["offensive", "reinforcement", "base-defense"];
  const roleScore = Math.max(0, 65 - Math.max(0, preferences.indexOf(squad.primaryRole)) * 18);
  const injured = members.filter(unit => (unit.hp || 0) < (unit.maxHp || 1) * 0.7).length;
  const vehicles = members.filter(unit => unit.role === "vehicle").length;
  const readiness = Number(squad.readiness) || 0.5;
  return roleScore + readiness * 24 + members.length * 2 - (squad.attachedCharacterIds?.length || 0) * 18
    + (specialty === "apothecary" ? injured * 14 : 0)
    + (specialty === "techmarine" ? vehicles * 18 : 0);
}

export function updateSpaceMarineCharacterAttachments({ characters = [], squads = [], membersForSquad = () => [], now = 0, commitmentSeconds = 24 } = {}) {
  const changes = [];
  for (const squad of squads) squad.attachedCharacterIds = (squad.attachedCharacterIds || []).filter(id => characters.some(character => character.id === id && character.alive !== false));
  for (const character of characters.filter(unit => unit.alive !== false && isSpaceMarineCharacter(unit))) {
    const current = squads.find(squad => squad.id === character.attachedSquadId);
    if (current && (character.attachmentCommitUntil || 0) > now) continue;
    const ranked = squads.map(squad => ({ squad, score: attachmentScore(character, squad, membersForSquad(squad.id)) }))
      .sort((left, right) => right.score - left.score || String(left.squad.id).localeCompare(String(right.squad.id)));
    const destination = ranked[0]?.squad || null;
    if (current?.id === destination?.id) {
      character.attachmentCommitUntil = now + commitmentSeconds;
      continue;
    }
    if (current) current.attachedCharacterIds = (current.attachedCharacterIds || []).filter(id => id !== character.id);
    character.attachedSquadId = destination?.id || null;
    character.attachmentCommitUntil = now + commitmentSeconds;
    if (destination) destination.attachedCharacterIds = [...new Set([...(destination.attachedCharacterIds || []), character.id])];
    changes.push({ characterId: character.id, fromSquadId: current?.id || null, toSquadId: destination?.id || null });
  }
  return changes;
}
