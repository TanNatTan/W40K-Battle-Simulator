// Undo / redo for the map workshop.
//
// A brush stroke touches a handful of 16 x 16 cell chunks, so a stroke is recorded as the
// before/after copy of exactly the chunks it modified (copied lazily, the first time the
// stroke reaches a chunk). Whole-world operations (generate, blank, import) are recorded as
// a full serialized snapshot instead. Discrete edits (settlements, bases) carry a small
// JSON blob. Everything is plain data, so entries are cheap to keep and easy to test.

import { CHUNK_SAMPLES, CHUNK_SHIFT, SAMPLE_SPACING } from "../terrain/HeightField.js";

const MAX_ENTRIES = 80;

const cloneArrays = chunk => {
  const copy = {};
  for (const [name, value] of Object.entries(chunk)) {
    if (ArrayBuffer.isView(value)) copy[name] = value.slice();
  }
  return copy;
};

function restoreArrays(target, saved) {
  for (const [name, value] of Object.entries(saved)) target[name].set(value);
}

export class WorkshopHistory {
  constructor({ field, layers }) {
    this.field = field;
    this.layers = layers;
    this.undoStack = [];
    this.redoStack = [];
    this.open = null;
  }

  rebind({ field, layers }) {
    this.field = field;
    this.layers = layers;
  }

  get canUndo() { return this.undoStack.length > 0; }
  get canRedo() { return this.redoStack.length > 0; }
  clear() { this.undoStack.length = 0; this.redoStack.length = 0; this.open = null; }

  // ---- strokes -----------------------------------------------------------------------------
  begin(label, meta = null) {
    this.open = { label, fieldChunks: new Map(), layerChunks: new Map(), metaBefore: meta, metaAfter: null };
  }

  // Copy every chunk a dab of `radius` at (x, y) may modify, once per stroke.
  touch(x, y, radius) {
    if (!this.open) return;
    const reach = radius + SAMPLE_SPACING * 3;
    const c0x = Math.floor((x - reach) / SAMPLE_SPACING) >> CHUNK_SHIFT;
    const c1x = Math.floor((x + reach) / SAMPLE_SPACING) >> CHUNK_SHIFT;
    const c0y = Math.floor((y - reach) / SAMPLE_SPACING) >> CHUNK_SHIFT;
    const c1y = Math.floor((y + reach) / SAMPLE_SPACING) >> CHUNK_SHIFT;
    for (let cy = Math.max(0, c0y); cy <= c1y; cy += 1) {
      for (let cx = Math.max(0, c0x); cx <= c1x; cx += 1) {
        const key = `${cx},${cy}`;
        if (!this.open.fieldChunks.has(key)) {
          const chunk = this.field.chunkAt(cx, cy, false);
          this.open.fieldChunks.set(key, { cx, cy, before: chunk ? chunk.data.slice() : null, after: null });
        }
        if (!this.open.layerChunks.has(key)) {
          const chunk = this.layers.chunkAt(cx, cy, false);
          this.open.layerChunks.set(key, { cx, cy, before: chunk ? cloneArrays(chunk) : null, after: null });
        }
      }
    }
  }

  end(metaAfter = null) {
    const entry = this.open;
    this.open = null;
    if (!entry) return false;
    let changed = false;
    for (const record of entry.fieldChunks.values()) {
      const chunk = this.field.chunkAt(record.cx, record.cy, false);
      record.after = chunk ? chunk.data.slice() : null;
      if (!sameFloat(record.before, record.after)) changed = true;
    }
    for (const record of entry.layerChunks.values()) {
      const chunk = this.layers.chunkAt(record.cx, record.cy, false);
      record.after = chunk ? cloneArrays(chunk) : null;
      if (!sameLayers(record.before, record.after)) changed = true;
    }
    entry.metaAfter = metaAfter;
    if (metaAfter !== null && JSON.stringify(entry.metaBefore) !== JSON.stringify(metaAfter)) changed = true;
    if (!changed) return false;
    // Drop untouched chunks to keep entries small.
    for (const [key, record] of [...entry.fieldChunks]) if (sameFloat(record.before, record.after)) entry.fieldChunks.delete(key);
    for (const [key, record] of [...entry.layerChunks]) if (sameLayers(record.before, record.after)) entry.layerChunks.delete(key);
    this.push({ type: "chunks", ...entry });
    return true;
  }

  // ---- discrete / whole-world entries ------------------------------------------------------
  recordMeta(label, before, after) {
    if (JSON.stringify(before) === JSON.stringify(after)) return false;
    this.push({ type: "meta", label, metaBefore: before, metaAfter: after });
    return true;
  }

  recordSnapshot(label, before, after) {
    this.push({ type: "snapshot", label, before, after });
    return true;
  }

  push(entry) {
    this.undoStack.push(entry);
    if (this.undoStack.length > MAX_ENTRIES) this.undoStack.shift();
    this.redoStack.length = 0;
  }

  // ---- travel --------------------------------------------------------------------------------
  // `apply` receives { type, meta?, snapshot? } for the parts only the workshop can restore
  // (settlements, bases, whole-world payloads); chunk data is restored here.
  undo(apply) {
    const entry = this.undoStack.pop();
    if (!entry) return null;
    this.redoStack.push(entry);
    this.restore(entry, "before", apply);
    return entry.label;
  }

  redo(apply) {
    const entry = this.redoStack.pop();
    if (!entry) return null;
    this.undoStack.push(entry);
    this.restore(entry, "after", apply);
    return entry.label;
  }

  restore(entry, side, apply) {
    const metaKey = side === "before" ? "metaBefore" : "metaAfter";
    if (entry.type === "snapshot") {
      apply({ type: "snapshot", snapshot: entry[side] });
      return;
    }
    if (entry.type === "chunks") {
      let deleted = false;
      for (const record of entry.fieldChunks.values()) {
        const saved = record[side];
        if (saved === null) { this.field.chunks.delete(chunkKey(record.cx, record.cy)); deleted = true; }
        else {
          const chunk = this.field.chunkAt(record.cx, record.cy, true);
          chunk.data.set(saved);
          chunk.shadeVersion = -1;
          chunk.rev += 1;
        }
      }
      for (const record of entry.layerChunks.values()) {
        const saved = record[side];
        if (saved === null) { this.layers.chunks.delete(chunkKey(record.cx, record.cy)); deleted = true; }
        else {
          const chunk = this.layers.chunkAt(record.cx, record.cy, true);
          restoreArrays(chunk, saved);
          chunk.rev += 1;
        }
      }
      this.field.version += 1;
      // Removing a chunk changes the neighbourhood sums renderers use as revisions: bump the counters.
      if (deleted) { this.field.bulk += 1; this.layers.bulk += 1; }
    }
    if (entry[metaKey] !== undefined && entry[metaKey] !== null) apply({ type: "meta", meta: entry[metaKey] });
  }
}

// Both HeightField and WorldLayers key their chunk maps with this packing.
function chunkKey(cx, cy) { return (cx + 1024) * 4096 + (cy + 1024); }

function sameFloat(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  for (let n = 0; n < a.length; n += 1) if (a[n] !== b[n]) return false;
  return true;
}

function sameLayers(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  for (const name of Object.keys(a)) {
    const left = a[name];
    const right = b[name];
    for (let n = 0; n < left.length; n += 1) if (left[n] !== right[n]) return false;
  }
  return true;
}
