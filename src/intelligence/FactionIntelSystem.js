const clamp01 = value => Math.max(0, Math.min(1, Number(value) || 0));

function classificationFor(subject = {}) {
  if (subject.type) return subject.type === "outpost" ? "headquarters" : "structure";
  if (subject.role === "vehicle") return "armor";
  if (subject.role === "commander") return "commander";
  if (subject.role === "builder" || subject.role === "supply") return "logistics";
  if (subject.role === "sniper") return "sniper";
  return "infantry";
}

function immutableSnapshot(subject = {}, report = {}, now = 0) {
  return Object.freeze({
    id: subject.id || report.contactId,
    faction: subject.faction || report.hostileFaction || null,
    classification: report.classification || classificationFor(subject),
    position: Object.freeze({ x: Number(report.x ?? subject.x) || 0, y: Number(report.y ?? subject.y) || 0 }),
    lastSeenAt: now,
    source: report.source || "visual",
    confidence: clamp01(report.confidence ?? 1),
    uncertaintyRadius: Math.max(0, Number(report.uncertaintyRadius) || 0),
    isHeadquarters: Boolean(report.isHeadquarters || subject.type === "outpost"),
    structureType: subject.type || report.structureType || null
  });
}

export class FactionIntelSystem {
  constructor({ contactTtl = 90, structureTtl = 900 } = {}) {
    this.contactTtl = contactTtl;
    this.structureTtl = structureTtl;
    this.boards = new Map();
    this.lastExpiredAt = null;
  }

  ensureFaction(factionId) {
    if (!this.boards.has(factionId)) this.boards.set(factionId, {
      contacts: new Map(), structures: new Map(), events: [], sniperOrigins: [],
      revision: 0, cachedAt: null, cachedRevision: -1, cachedIntel: null
    });
    return this.boards.get(factionId);
  }

  observeUnit(factionId, subject, now = 0, report = {}) {
    if (!subject?.id || subject.faction === factionId) return null;
    const snapshot = immutableSnapshot(subject, report, now);
    const board = this.ensureFaction(factionId);
    board.contacts.set(snapshot.id, snapshot);
    board.revision += 1;
    return snapshot;
  }

  observeStructure(factionId, subject, now = 0, report = {}) {
    if (!subject?.id || subject.faction === factionId) return null;
    const snapshot = immutableSnapshot(subject, report, now);
    const board = this.ensureFaction(factionId);
    board.structures.set(snapshot.id, snapshot);
    board.revision += 1;
    return snapshot;
  }

  rememberSniperOrigin(factionId, position, now = 0, { confidence = 0.64, uncertaintyRadius = 55 } = {}) {
    const marker = Object.freeze({ position: Object.freeze({ x: Number(position?.x) || 0, y: Number(position?.y) || 0 }), confidence: clamp01(confidence), uncertaintyRadius, createdAt: now, expiresAt: now + 24 });
    const board = this.ensureFaction(factionId);
    board.sniperOrigins.push(marker);
    board.sniperOrigins = board.sniperOrigins.filter(item => item.expiresAt > now).slice(-12);
    board.revision += 1;
    return marker;
  }

  reportEvent(factionId, event = {}, now = 0) {
    const snapshot = Object.freeze({ ...event, position: event.position ? Object.freeze({ x: event.position.x, y: event.position.y }) : null, at: now });
    const board = this.ensureFaction(factionId);
    board.events.push(snapshot);
    board.events = board.events.filter(item => now - item.at <= 120).slice(-96);
    board.revision += 1;
    return snapshot;
  }

  expire(now = 0) {
    if (this.lastExpiredAt === now) return;
    this.lastExpiredAt = now;
    for (const board of this.boards.values()) {
      let changed = false;
      for (const [id, contact] of board.contacts) if (now - contact.lastSeenAt > this.contactTtl) { board.contacts.delete(id); changed = true; }
      for (const [id, contact] of board.structures) if (now - contact.lastSeenAt > this.structureTtl) { board.structures.delete(id); changed = true; }
      const sniperOrigins = board.sniperOrigins.filter(item => item.expiresAt > now);
      const events = board.events.filter(item => now - item.at <= 120);
      if (sniperOrigins.length !== board.sniperOrigins.length || events.length !== board.events.length) changed = true;
      board.sniperOrigins = sniperOrigins;
      board.events = events;
      if (changed) board.revision += 1;
    }
  }

  getFactionIntel(factionId, now = 0) {
    this.expire(now);
    const board = this.ensureFaction(factionId);
    // A simulation tick asks for the same intelligence board from targeting,
    // strategy, fog and the minimap. Reuse that immutable view until either the
    // clock or a report changes; rebuilding and freezing hundreds of contacts at
    // every call created long garbage-collection pauses in sustained battles.
    if (board.cachedIntel && board.cachedAt === now && board.cachedRevision === board.revision) return board.cachedIntel;
    const ageContact = contact => {
      const age = Math.max(0, now - contact.lastSeenAt);
      return Object.freeze({ ...contact, confidence: clamp01(contact.confidence * Math.exp(-age / (contact.structureType ? 700 : 55))), uncertaintyRadius: contact.uncertaintyRadius + age * (contact.structureType ? 1.5 : 12), live: false });
    };
    board.cachedIntel = Object.freeze({
      contacts: Object.freeze([...board.contacts.values()].map(ageContact)),
      structures: Object.freeze([...board.structures.values()].map(ageContact)),
      events: Object.freeze([...board.events]),
      sniperOrigins: Object.freeze([...board.sniperOrigins])
    });
    board.cachedAt = now;
    board.cachedRevision = board.revision;
    return board.cachedIntel;
  }

  knownHeadquarters(factionId, hostileFaction, now = 0) {
    return this.getFactionIntel(factionId, now).structures.find(item => item.faction === hostileFaction && item.isHeadquarters && item.confidence >= 0.12) || null;
  }

  clear() {
    this.boards.clear();
    this.lastExpiredAt = null;
  }
}
