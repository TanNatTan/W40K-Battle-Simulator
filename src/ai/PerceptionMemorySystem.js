const clamp01 = value => Math.max(0, Math.min(1, Number(value) || 0));

export const CONTACT_SOURCES = Object.freeze(["self", "squad", "commander", "shared"]);

export function classifyEnemy(enemy = {}) {
  if (enemy.type && enemy.maxHp) return "structure";
  if (enemy.role === "vehicle") return "armor";
  if (enemy.role === "commander") return "commander";
  if (enemy.role === "builder") return "builder";
  if (enemy.role === "supply") return "logistics";
  if (enemy.role === "medic") return "medic";
  if (enemy.range >= 180 || enemy.damage >= 28) return "heavy-weapon";
  return "infantry";
}

export function refreshContactMemory(memory = {}, visibleContacts = [], now = 0, { source = "self", decayRate = 0.22, expirationConfidence = 0.08, uncertaintyPerSecond = 18 } = {}) {
  const contacts = new Map(Object.entries(memory.contacts || {}));
  const visibleIds = new Set();
  for (const entry of visibleContacts) {
    const enemy = entry.unit || entry;
    if (!enemy?.id) continue;
    visibleIds.add(enemy.id);
    const previous = contacts.get(enemy.id);
    const elapsed = Math.max(0.001, now - (previous?.lastSeenAt ?? now));
    const velocity = previous
      ? { x: (enemy.x - previous.lastSeenPosition.x) / elapsed, y: (enemy.y - previous.lastSeenPosition.y) / elapsed }
      : { x: Number(enemy.vx) || 0, y: Number(enemy.vy) || 0 };
    contacts.set(enemy.id, {
      enemyId: enemy.id,
      lastSeenPosition: { x: Number(enemy.x) || 0, y: Number(enemy.y) || 0 },
      lastSeenVelocity: velocity,
      lastSeenAt: now,
      confidence: 1,
      classification: classifyEnemy(enemy),
      estimatedThreat: Math.max(0, Number(enemy.damage) || 0) + Math.max(0, Number(enemy.range) || 0) * 0.08,
      source: CONTACT_SOURCES.includes(source) ? source : "self",
      confirmedVisible: true,
      uncertaintyRadius: 0
    });
  }
  for (const [enemyId, contact] of contacts) {
    if (visibleIds.has(enemyId)) continue;
    const elapsed = Math.max(0, now - contact.lastSeenAt);
    const confidence = clamp01(Math.exp(-Math.max(0.001, decayRate) * elapsed));
    if (confidence < expirationConfidence) {
      contacts.delete(enemyId);
      continue;
    }
    // Prediction uses only last observed position/velocity. No live enemy object is
    // consumed while the contact is outside sensors or fog visibility.
    contacts.set(enemyId, {
      ...contact,
      confidence,
      confirmedVisible: false,
      predictedPosition: {
        x: contact.lastSeenPosition.x + contact.lastSeenVelocity.x * elapsed,
        y: contact.lastSeenPosition.y + contact.lastSeenVelocity.y * elapsed
      },
      uncertaintyRadius: elapsed * uncertaintyPerSecond
    });
  }
  memory.contacts = Object.fromEntries(contacts);
  memory.updatedAt = now;
  return memory;
}

export function mergeSquadContactBoard(board = {}, memberMemories = [], now = 0, { maxContacts = 24 } = {}) {
  const contacts = new Map();
  for (const memory of memberMemories) for (const contact of Object.values(memory?.contacts || {})) {
    const current = contacts.get(contact.enemyId);
    if (!current || contact.confidence > current.confidence || contact.lastSeenAt > current.lastSeenAt) contacts.set(contact.enemyId, { ...contact, source: contact.source === "self" ? "squad" : contact.source });
  }
  const ranked = [...contacts.values()].sort((a, b) => b.confidence * b.estimatedThreat - a.confidence * a.estimatedThreat).slice(0, maxContacts);
  board.contacts = Object.fromEntries(ranked.map(contact => [contact.enemyId, contact]));
  board.primaryThreatId = ranked[0]?.enemyId || null;
  board.secondaryThreatIds = ranked.slice(1, 4).map(contact => contact.enemyId);
  board.updatedAt = now;
  return board;
}
