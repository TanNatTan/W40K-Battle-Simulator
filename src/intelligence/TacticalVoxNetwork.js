export const VOX_SCOPES = Object.freeze({
  HELMET_LINK: "HELMET_LINK",
  SQUAD_COMMAND_VOX: "SQUAD_COMMAND_VOX",
  ASTARTES_BATTLE_NET: "ASTARTES_BATTLE_NET"
});

export const VOX_EVENT_TYPES = Object.freeze([
  "ENEMY_CONTACT", "ENEMY_ASSAULT_APPROACH", "BROTHER_KILLED", "SQUAD_HELP_REQUEST",
  "BASE_ATTACKED", "BUILDING_DESTROYED", "TERRITORY_CAPTURED", "TERRITORY_LOST",
  "VEHICLE_SPOTTED", "SNIPER_DETECTED", "COMMANDER_SPOTTED", "ENEMY_BASE_DETECTED", "GENE_SEED_EXPOSED"
]);

const clamp01 = value => Math.max(0, Math.min(1, Number(value) || 0));

function unitDistance(unit = {}, point = {}) {
  return Math.hypot((Number(unit.x) || 0) - (Number(point.x) || 0), (Number(unit.y) || 0) - (Number(point.y) || 0));
}

export class TacticalVoxNetwork {
  constructor({ intelSystem = null, reportTtl = 45, dedupeSeconds = 2.5 } = {}) {
    this.intelSystem = intelSystem;
    this.reportTtl = reportTtl;
    this.dedupeSeconds = dedupeSeconds;
    this.reports = new Map();
    this.lastPublished = new Map();
    this.nextId = 1;
  }

  publish(report = {}, now = 0) {
    if (!report.factionId || !VOX_EVENT_TYPES.includes(report.type)) return null;
    const sourceText = `${report.sourceName || ""} ${report.sourceRole || ""}`.toLowerCase();
    const forwardElement = /scout|infiltrator|vanguard/.test(sourceText);
    const key = `${report.factionId}:${report.type}:${report.contactId || report.targetId || "area"}:${Math.round((report.position?.x || 0) / 18)}:${Math.round((report.position?.y || 0) / 18)}`;
    if (now - (this.lastPublished.get(key) ?? -Infinity) < this.dedupeSeconds) return null;
    this.lastPublished.set(key, now);
    const snapshot = Object.freeze({
      id: `vox-${this.nextId++}`,
      factionId: report.factionId,
      squadId: report.squadId || null,
      sourceId: report.sourceId || null,
      sourceRole: report.sourceRole || "trooper",
      type: report.type,
      scope: report.scope || (report.squadId ? VOX_SCOPES.SQUAD_COMMAND_VOX : VOX_SCOPES.ASTARTES_BATTLE_NET),
      position: report.position ? Object.freeze({ x: Number(report.position.x) || 0, y: Number(report.position.y) || 0 }) : null,
      contactId: report.contactId || null,
      hostileFaction: report.hostileFaction || null,
      urgency: clamp01((report.urgency ?? 0.55) + (forwardElement ? 0.08 : 0)),
      confidence: clamp01((report.confidence ?? 0.72) + (forwardElement ? 0.16 : 0)),
      requestedResponders: Math.max(1, Math.min(3, Number(report.requestedResponders) || 1)),
      createdAt: now,
      expiresAt: now + (Number(report.ttl) || this.reportTtl)
    });
    if (!this.reports.has(snapshot.factionId)) this.reports.set(snapshot.factionId, []);
    this.reports.get(snapshot.factionId).push(snapshot);
    if (this.intelSystem) this.intelSystem.reportEvent(snapshot.factionId, snapshot, now);
    return snapshot;
  }

  activeReports(factionId, now = 0) {
    const active = (this.reports.get(factionId) || []).filter(report => report.expiresAt > now);
    this.reports.set(factionId, active);
    return active;
  }

  distributeContact(factionId, contact, now = 0) {
    if (!contact) return null;
    return this.publish({
      factionId,
      squadId: contact.squadId,
      sourceId: contact.sourceId,
      sourceRole: contact.sourceRole,
      type: contact.isHeadquarters ? "ENEMY_BASE_DETECTED" : contact.classification === "armor" ? "VEHICLE_SPOTTED" : contact.classification === "commander" ? "COMMANDER_SPOTTED" : "ENEMY_CONTACT",
      position: contact.position,
      contactId: contact.contactId,
      hostileFaction: contact.hostileFaction,
      confidence: contact.confidence,
      urgency: contact.urgency
    }, now);
  }

  selectSupportResponders(report, squads = [], context = {}) {
    if (!report?.position) return [];
    const maxResponders = Math.max(1, Math.min(report.requestedResponders || 1, context.maxResponders || 2));
    return squads
      .filter(squad => squad && squad.faction === report.factionId && squad.id !== report.squadId && !squad.eliminated)
      .map(squad => {
        const center = context.centerFor?.(squad) || squad.center || squad.objective || {};
        const distance = unitDistance(center, report.position);
        const readiness = clamp01(context.readinessFor?.(squad) ?? squad.readiness ?? 0.7);
        const objectiveImportance = clamp01(context.objectiveImportanceFor?.(squad) ?? squad.objectiveImportance ?? 0.35);
        const alreadyResponding = squad.voxResponse?.reportId === report.id;
        const roleBias = /reserve|recon|escort|offensive/i.test(squad.primaryRole || squad.orderType || "") ? 0.16 : 0;
        const score = report.urgency * 1.5 + readiness + roleBias - Math.min(1.5, distance / 320) - objectiveImportance * 0.9 - (alreadyResponding ? 2 : 0);
        return { squad, score, distance };
      })
      .filter(item => item.score > 0.2)
      .sort((a, b) => b.score - a.score || a.distance - b.distance)
      .slice(0, maxResponders)
      .map(item => item.squad);
  }

  clear() {
    this.reports.clear();
    this.lastPublished.clear();
  }
}
