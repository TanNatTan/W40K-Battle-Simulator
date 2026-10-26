// Canvas view for the region workshop: textured, lit terrain (the same shader the battle uses),
// vegetation, overlays for settlements / bases / resources / checks, the brush cursor and a
// minimap. It owns the camera; the panel owns everything else.

import { SAMPLE_SPACING, CHUNK_SPAN } from "../terrain/HeightField.js";
import { buildProceduralTextures } from "../terrain/ProceduralTextures.js";
import { SHADER_PIXELS, TERRAIN_PALETTES, gatherTerrainChunkInput, shadeTerrainChunkFromInput } from "../terrain/TerrainShader.js";
import { TerrainBakeClient } from "../terrain/TerrainBakeClient.js";
import { bakeVegetationChunk } from "../rendering/VegetationRenderer.js";
import { DEPOSIT } from "../world/WorldLayers.js";
import { BASE_RADIUS } from "./RegionWorkshop.js";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const BASE_COLORS = ["#6fa8dc", "#d9822b"];
const DEPOSIT_COLORS = { [DEPOSIT.IRON]: "#c7ced6", [DEPOSIT.PROMETHIUM]: "#e0a23a", [DEPOSIT.STONE]: "#9a8f80" };
const PALETTE_BG = { temperate: "#34402a", forest: "#26382a", desert: "#6e5d3c", frozen: "#7d8d99", volcanic: "#2a2420" };

export class WorkshopView {
  constructor({ canvas, shop, createWorker = null }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.shop = shop;
    this.camera = { x: shop.world.width / 2, y: shop.world.height / 2, zoom: 0.5 };
    this.terrain = new Map();
    this.vegetation = new Map();
    this.textures = null;
    this.client = createWorker ? new TerrainBakeClient({ createWorker, poolSize: 2, perWorker: 2 }) : null;
    this.overlays = { grid: false, resources: true, radius: true, checks: true };
    this.cursor = null; // { x, y, radius, tool }
    this.hover = null;
    this.selection = null;
    this.notes = [];
    this.dirty = true;
    this.width = 1;
    this.height = 1;
    this.painting = false;
    this.minimap = null;
    this.frame = 0;
    this.stats = { bakesSync: 0, bakesAsync: 0, lastDrawMs: 0 };
  }

  // ---- camera ---------------------------------------------------------------------------------
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const ratio = Math.min(2, globalThis.devicePixelRatio || 1);
    this.width = Math.max(1, Math.round(rect.width));
    this.height = Math.max(1, Math.round(rect.height));
    this.canvas.width = Math.round(this.width * ratio);
    this.canvas.height = Math.round(this.height * ratio);
    this.ratio = ratio;
    this.invalidate();
  }

  fit() {
    const { width, height } = this.shop.world;
    this.camera.zoom = Math.min(this.width / (width + 80), this.height / (height + 80));
    this.camera.x = width / 2;
    this.camera.y = height / 2;
    this.invalidate();
  }

  toWorld(sx, sy) {
    return { x: (sx - this.width / 2) / this.camera.zoom + this.camera.x, y: (sy - this.height / 2) / this.camera.zoom + this.camera.y };
  }

  toScreen(x, y) {
    return { x: (x - this.camera.x) * this.camera.zoom + this.width / 2, y: (y - this.camera.y) * this.camera.zoom + this.height / 2 };
  }

  pan(dx, dy) {
    this.camera.x -= dx / this.camera.zoom;
    this.camera.y -= dy / this.camera.zoom;
    this.clampCamera();
    this.invalidate();
  }

  zoomAt(sx, sy, factor) {
    const before = this.toWorld(sx, sy);
    const minZoom = Math.min(this.width / (this.shop.world.width + 80), this.height / (this.shop.world.height + 80)) * 0.8;
    this.camera.zoom = clamp(this.camera.zoom * factor, minZoom, 4);
    const after = this.toWorld(sx, sy);
    this.camera.x += before.x - after.x;
    this.camera.y += before.y - after.y;
    this.clampCamera();
    this.invalidate();
  }

  clampCamera() {
    const { width, height } = this.shop.world;
    this.camera.x = clamp(this.camera.x, 0, width);
    this.camera.y = clamp(this.camera.y, 0, height);
  }

  invalidate() { this.dirty = true; }

  // ---- terrain baking -------------------------------------------------------------------------
  revision(cx, cy) {
    const { field, layers } = this.shop;
    return field.revisionAround(cx, cy) + layers.revisionAround(cx, cy) * 7;
  }

  paletteKey() { return TERRAIN_PALETTES[this.shop.palette] ? this.shop.palette : "temperate"; }

  input(cx, cy) {
    const { field, layers } = this.shop;
    return gatherTerrainChunkInput({ field, layers, chunkX: cx, chunkY: cy, size: SHADER_PIXELS, palette: this.paletteKey(), seed: (field.seed || 1) >>> 0 });
  }

  tile(key) {
    let entry = this.terrain.get(key);
    if (!entry) {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = SHADER_PIXELS;
      entry = { canvas, rev: -1 };
      this.terrain.set(key, entry);
    }
    return entry;
  }

  put(key, rev, pixels) {
    const entry = this.tile(key);
    entry.canvas.getContext("2d").putImageData(new ImageData(pixels, SHADER_PIXELS, SHADER_PIXELS), 0, 0);
    entry.rev = rev;
    this.invalidate();
  }

  bakeSync(cx, cy) {
    this.textures ||= buildProceduralTextures(256);
    const input = this.input(cx, cy);
    const result = shadeTerrainChunkFromInput(input, this.textures, TERRAIN_PALETTES[input.palette]);
    this.put(`${cx},${cy}`, this.revision(cx, cy), result.pixels);
    this.stats.bakesSync += 1;
  }

  bakeAsync(cx, cy) {
    const key = `${cx},${cy}`;
    const rev = this.revision(cx, cy);
    if (this.client.isPending(key, rev)) return "pending";
    const sent = this.client.request(key, rev, this.input(cx, cy), result => { this.put(result.key, result.rev, result.pixels); this.stats.bakesAsync += 1; });
    return sent ? "sent" : "busy";
  }

  resetBakes() {
    this.terrain.clear();
    this.vegetation.clear();
    this.client?.reset();
    this.invalidate();
  }

  vegetationFor(cx, cy) {
    const key = `${cx},${cy}`;
    const rev = this.shop.layers.revisionAround(cx, cy) + this.shop.field.revisionAround(cx, cy);
    let entry = this.vegetation.get(key);
    if (entry && entry.rev === rev) return entry;
    if (!entry) { entry = { canvas: document.createElement("canvas"), rev: -1 }; this.vegetation.set(key, entry); }
    try { bakeVegetationChunk(this.shop.layers, this.shop.field, cx, cy, entry.canvas); } catch { entry.canvas.width = entry.canvas.height = 1; }
    entry.rev = rev;
    return entry;
  }

  // ---- drawing --------------------------------------------------------------------------------
  draw() {
    const started = performance.now();
    this.dirty = false;
    this.frame += 1;
    const { ctx, camera, shop } = this;
    const ratio = this.ratio || 1;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = "#0b100e";
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.save();
    ctx.translate(this.width / 2, this.height / 2);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);
    const world = shop.world;
    ctx.fillStyle = PALETTE_BG[shop.palette] || "#34402a";
    ctx.fillRect(0, 0, world.width, world.height);

    const view = { left: this.toWorld(0, 0).x, top: this.toWorld(0, 0).y, right: this.toWorld(this.width, this.height).x, bottom: this.toWorld(this.width, this.height).y };
    const minX = Math.max(0, Math.floor(view.left / CHUNK_SPAN));
    const maxX = Math.min(Math.ceil(world.width / CHUNK_SPAN) - 1, Math.floor(view.right / CHUNK_SPAN));
    const minY = Math.max(0, Math.floor(view.top / CHUNK_SPAN));
    const maxY = Math.min(Math.ceil(world.height / CHUNK_SPAN) - 1, Math.floor(view.bottom / CHUNK_SPAN));
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, world.width, world.height);
    ctx.clip();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "medium";
    const stale = [];
    const centerX = camera.x / CHUNK_SPAN;
    const centerY = camera.y / CHUNK_SPAN;
    for (let cy = minY; cy <= maxY; cy += 1) {
      for (let cx = minX; cx <= maxX; cx += 1) {
        const entry = this.terrain.get(`${cx},${cy}`);
        if (entry && entry.rev >= 0) ctx.drawImage(entry.canvas, cx * CHUNK_SPAN, cy * CHUNK_SPAN, CHUNK_SPAN + 0.6, CHUNK_SPAN + 0.6);
        if (!entry || entry.rev !== this.revision(cx, cy)) stale.push({ cx, cy, d: Math.hypot(cx - centerX, cy - centerY), missing: !entry || entry.rev < 0 });
      }
    }
    for (let cy = minY; cy <= maxY; cy += 1) {
      for (let cx = minX; cx <= maxX; cx += 1) {
        const baked = this.terrain.get(`${cx},${cy}`);
        if (!baked || baked.rev < 0) continue;
        const veg = this.vegetationFor(cx, cy);
        if (veg.canvas.width > 1) ctx.drawImage(veg.canvas, cx * CHUNK_SPAN, cy * CHUNK_SPAN, CHUNK_SPAN, CHUNK_SPAN);
      }
    }
    ctx.restore();
    this.scheduleBakes(stale);

    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 2 / camera.zoom;
    ctx.strokeRect(0, 0, world.width, world.height);
    if (this.overlays.grid) this.drawGrid(view);
    if (this.overlays.resources) this.drawResources(view);
    this.drawPlaces();
    if (this.overlays.checks) this.drawNotes();
    this.drawCursor();
    ctx.restore();
    this.drawMinimap();
    this.stats.lastDrawMs = performance.now() - started;
  }

  scheduleBakes(stale) {
    if (!stale.length) return;
    stale.sort((a, b) => (b.missing - a.missing) || a.d - b.d);
    const useWorkers = this.client && !this.painting && this.client.available;
    const started = performance.now();
    let handled = 0;
    let waiting = false;
    for (const item of stale) {
      if (useWorkers) {
        const outcome = this.bakeAsync(item.cx, item.cy);
        if (outcome === "busy") { waiting = true; break; }
        if (outcome === "pending") waiting = true;
      } else if (handled < 4 && (handled === 0 || performance.now() - started < 12)) {
        this.bakeSync(item.cx, item.cy);
        handled += 1;
      } else waiting = true;
    }
    if (!useWorkers && handled < stale.length) this.invalidate();
    else if (waiting && this.client && !this.client.inFlight) this.invalidate();
  }

  drawGrid(view) {
    const { ctx, camera } = this;
    const step = camera.zoom > 0.9 ? 64 : camera.zoom > 0.4 ? 128 : 256;
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.lineWidth = 1 / camera.zoom;
    ctx.beginPath();
    for (let x = Math.max(0, Math.floor(view.left / step) * step); x <= Math.min(this.shop.world.width, view.right); x += step) { ctx.moveTo(x, Math.max(0, view.top)); ctx.lineTo(x, Math.min(this.shop.world.height, view.bottom)); }
    for (let y = Math.max(0, Math.floor(view.top / step) * step); y <= Math.min(this.shop.world.height, view.bottom); y += step) { ctx.moveTo(Math.max(0, view.left), y); ctx.lineTo(Math.min(this.shop.world.width, view.right), y); }
    ctx.stroke();
  }

  drawResources(view) {
    const { ctx, camera, shop } = this;
    const r = Math.max(3, SAMPLE_SPACING * 0.42);
    const i0 = Math.max(0, Math.floor(view.left / SAMPLE_SPACING));
    const i1 = Math.ceil(view.right / SAMPLE_SPACING);
    const j0 = Math.max(0, Math.floor(view.top / SAMPLE_SPACING));
    const j1 = Math.ceil(view.bottom / SAMPLE_SPACING);
    if ((i1 - i0) * (j1 - j0) > 9000) return;
    ctx.lineWidth = 1 / camera.zoom;
    for (let j = j0; j <= j1; j += 1) {
      for (let i = i0; i <= i1; i += 1) {
        const kind = shop.layers.get("deposit", i, j);
        if (!kind) continue;
        ctx.fillStyle = DEPOSIT_COLORS[kind] || "#fff";
        ctx.globalAlpha = 0.75;
        ctx.beginPath();
        ctx.arc(i * SAMPLE_SPACING, j * SAMPLE_SPACING, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.5)";
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  drawPlaces() {
    const { ctx, camera, shop } = this;
    const inv = 1 / camera.zoom;
    ctx.textAlign = "center";
    shop.bases.forEach((base, index) => {
      const color = BASE_COLORS[index % BASE_COLORS.length];
      const selected = this.selection?.type === "base" && this.selection.index === index;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.18;
      ctx.beginPath(); ctx.arc(base.x, base.y, BASE_RADIUS, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.9;
      ctx.setLineDash([8 * inv, 6 * inv]);
      ctx.lineWidth = 2 * inv;
      ctx.stroke();
      ctx.setLineDash([]);
      // banner
      ctx.lineWidth = (selected ? 4 : 3) * inv;
      ctx.beginPath(); ctx.moveTo(base.x, base.y + 20 * inv); ctx.lineTo(base.x, base.y - 26 * inv); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(base.x, base.y - 26 * inv); ctx.lineTo(base.x + 22 * inv, base.y - 19 * inv); ctx.lineTo(base.x, base.y - 12 * inv); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.font = `600 ${12 * inv}px system-ui, sans-serif`;
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "rgba(0,0,0,.7)";
      ctx.lineWidth = 3 * inv;
      const label = index === 0 ? "ARMY A" : "ARMY B";
      ctx.strokeText(label, base.x, base.y + 38 * inv);
      ctx.fillText(label, base.x, base.y + 38 * inv);
    });
    for (const item of shop.settlements) {
      const selected = this.selection?.type === "settlement" && this.selection.id === item.id;
      if (this.overlays.radius) {
        ctx.strokeStyle = "rgba(255,230,160,0.45)";
        ctx.lineWidth = 1.5 * inv;
        ctx.setLineDash([5 * inv, 5 * inv]);
        ctx.beginPath(); ctx.arc(item.x, item.y, 120, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
      }
      // a little house marker
      const s = 15 * inv;
      ctx.fillStyle = "#e9d8a6";
      ctx.strokeStyle = selected ? "#ffffff" : "#2a2418";
      ctx.lineWidth = (selected ? 3 : 2) * inv;
      ctx.beginPath();
      ctx.moveTo(item.x - s, item.y + s * 0.7); ctx.lineTo(item.x - s, item.y - s * 0.1); ctx.lineTo(item.x, item.y - s); ctx.lineTo(item.x + s, item.y - s * 0.1); ctx.lineTo(item.x + s, item.y + s * 0.7); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.font = `600 ${12 * inv}px system-ui, sans-serif`;
      const label = `${item.name || item.id.toUpperCase()} · ${item.population}`;
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "rgba(0,0,0,.75)";
      ctx.lineWidth = 3 * inv;
      ctx.strokeText(label, item.x, item.y + 30 * inv);
      ctx.fillText(label, item.x, item.y + 30 * inv);
    }
  }

  drawNotes() {
    const { ctx, camera } = this;
    const inv = 1 / camera.zoom;
    for (const note of this.notes) {
      if (!note.at) continue;
      const color = note.level === "error" ? "#ff5a5a" : note.level === "warn" ? "#ffb347" : "#7fb2ff";
      ctx.fillStyle = color;
      ctx.strokeStyle = "rgba(0,0,0,.7)";
      ctx.lineWidth = 2 * inv;
      ctx.beginPath(); ctx.arc(note.at.x + 24 * inv, note.at.y - 24 * inv, 8 * inv, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#111";
      ctx.font = `700 ${11 * inv}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(note.level === "info" ? "i" : "!", note.at.x + 24 * inv, note.at.y - 20 * inv);
    }
  }

  drawCursor() {
    const cursor = this.cursor;
    if (!cursor) return;
    const { ctx, camera } = this;
    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    ctx.lineWidth = 1.5 / camera.zoom;
    ctx.beginPath(); ctx.arc(cursor.x, cursor.y, cursor.radius, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath(); ctx.arc(cursor.x, cursor.y, cursor.radius * 0.5, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath(); ctx.arc(cursor.x, cursor.y, 2.5 / camera.zoom, 0, Math.PI * 2); ctx.fill();
  }

  // ---- minimap --------------------------------------------------------------------------------
  attachMinimap(canvas) { this.minimap = canvas; }

  drawMinimap() {
    const canvas = this.minimap;
    if (!canvas) return;
    if (this.frame % 3 && !this.dirty) return;
    const g = canvas.getContext("2d");
    const { width, height } = this.shop.world;
    const scale = Math.min(canvas.width / width, canvas.height / height);
    const ox = (canvas.width - width * scale) / 2;
    const oy = (canvas.height - height * scale) / 2;
    g.fillStyle = "#0b100e";
    g.fillRect(0, 0, canvas.width, canvas.height);
    for (const [key, entry] of this.terrain) {
      if (entry.rev < 0) continue;
      const [cx, cy] = key.split(",").map(Number);
      g.drawImage(entry.canvas, ox + cx * CHUNK_SPAN * scale, oy + cy * CHUNK_SPAN * scale, CHUNK_SPAN * scale + 0.6, CHUNK_SPAN * scale + 0.6);
    }
    this.shop.bases.forEach((base, index) => { g.fillStyle = BASE_COLORS[index % BASE_COLORS.length]; g.fillRect(ox + base.x * scale - 3, oy + base.y * scale - 3, 6, 6); });
    g.fillStyle = "#fff";
    for (const item of this.shop.settlements) g.fillRect(ox + item.x * scale - 2, oy + item.y * scale - 2, 4, 4);
    const a = this.toWorld(0, 0);
    const b = this.toWorld(this.width, this.height);
    g.strokeStyle = "#fff";
    g.lineWidth = 1.5;
    g.strokeRect(ox + clamp(a.x, 0, width) * scale, oy + clamp(a.y, 0, height) * scale, (clamp(b.x, 0, width) - clamp(a.x, 0, width)) * scale, (clamp(b.y, 0, height) - clamp(a.y, 0, height)) * scale);
    this.minimapMap = { scale, ox, oy };
  }

  minimapToWorld(px, py) {
    const m = this.minimapMap;
    if (!m) return null;
    return { x: clamp((px - m.ox) / m.scale, 0, this.shop.world.width), y: clamp((py - m.oy) / m.scale, 0, this.shop.world.height) };
  }
}
