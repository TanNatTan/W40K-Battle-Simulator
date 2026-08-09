import { SnapshotRingBuffer } from "./SnapshotRingBuffer.js";

const clampIndex = (value, length) => Math.max(0, Math.min(Math.max(0, length - 1), Number(value) || 0));

export class ReplayAnalysisSystem {
  constructor({ maxSnapshots = 360, maxEvents = 2000 } = {}) {
    this.maxSnapshots = maxSnapshots;
    this.maxEvents = maxEvents;
    this.snapshots = new SnapshotRingBuffer(maxSnapshots);
    this.events = [];
    this.index = 0;
    this.playing = false;
    this.rate = 1;
  }

  recordSnapshot(snapshot) {
    this.snapshots.push(structuredClone(snapshot));
    this.index = this.snapshots.length - 1;
    return this.index;
  }

  recordEvent(event) {
    const entry = { id: event.id || `event-${this.events.length + 1}`, severity: "info", ...structuredClone(event) };
    this.events.push(entry);
    if (this.events.length > this.maxEvents) this.events.splice(0, this.events.length - this.maxEvents);
    return entry;
  }

  seek(index) {
    this.index = clampIndex(index, this.snapshots.length);
    return this.current();
  }

  rewind(steps = 1) { return this.seek(this.index - Math.max(1, steps)); }
  fastForward(steps = 1) { return this.seek(this.index + Math.max(1, steps)); }
  play(rate = 1) { this.playing = true; this.rate = Math.max(0.25, Number(rate) || 1); }
  pause() { this.playing = false; }
  current() { return this.snapshots[this.index] || null; }

  jumpToEvent(eventId) {
    const event = this.events.find(entry => entry.id === eventId);
    if (!event || !this.snapshots.length) return null;
    let bestIndex = 0;
    let bestDelta = Infinity;
    this.snapshots.forEach((snapshot, index) => {
      const delta = Math.abs((snapshot.t || 0) - (event.t || 0));
      if (delta < bestDelta) { bestIndex = index; bestDelta = delta; }
    });
    return this.seek(bestIndex);
  }

  markers() {
    return this.events.map(event => ({ id: event.id, t: event.t || 0, type: event.type || "event", severity: event.severity }));
  }
}

export function buildAIInspector({ player = {}, plan = {}, decision = {}, context = {}, alternatives = [] } = {}) {
  const scores = decision.scores || player.factionAIScores || {};
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const choice = decision.choice || player.factionAIChoice || ranked[0]?.[0] || "evaluating";
  return {
    currentGoal: player.endgameDirective?.goal || plan.goal || plan.name || choice,
    choice,
    utilityScores: Object.fromEntries(ranked),
    threatEstimate: Math.max(0, Math.min(1, Number(context.enemyPressure ?? context.threatEstimate) || 0)),
    confidence: ranked.length > 1 ? Math.max(0, Math.min(1, (ranked[0][1] - ranked[1][1]) / Math.max(1, Math.abs(ranked[0][1])))) : 1,
    alternatives: alternatives.length ? alternatives : ranked.slice(1, 4).map(([name, score]) => ({ name, score })),
    doctrineInfluence: plan.method || player.battleObjectiveMethod || "shared-core",
    explanation: `${choice} leads because its utility is ${Math.round(scores[choice] || 0)} under the currently observed threat and supply state.`
  };
}
