// Draws woodland, shrubs and crop fields for a terrain chunk. Plants are
// placed from a per-cell hash, so a cell always grows the same trees; as a
// cell's vegetation density falls (felling, fire, shelling) trees disappear
// one by one instead of the whole forest popping out.

import { CHUNK_SAMPLES, CHUNK_SPAN, SAMPLE_SPACING } from "../terrain/HeightField.js";
import { VEGETATION } from "../world/WorldLayers.js";

export const VEGETATION_PIXELS_PER_UNIT = 1.5;

function hash(i, j, k) {
  let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(k + 1, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Plant list for one lattice cell (pure; used by the renderer and by tests/AI
// that want to know whether ground is wooded).
export function plantsForCell(i, j, vegKind, density, scorch = 0) {
  const plants = [];
  if (vegKind === VEGETATION.FOREST) {
    const slots = 3;
    for (let k = 0; k < slots; k += 1) {
      if (hash(i, j, k) > density * 1.05) continue;
      const kind = scorch > 0.5 ? "dead" : (hash(i, j, k + 20) < 0.42 ? "pine" : "oak");
      plants.push({
        kind,
        x: (i + (hash(i, j, k + 40) - 0.5) * 1.5) * SAMPLE_SPACING,
        y: (j + (hash(i, j, k + 60) - 0.5) * 1.5) * SAMPLE_SPACING,
        size: 0.7 + hash(i, j, k + 80) * 0.65
      });
    }
  } else if (vegKind === VEGETATION.SHRUB) {
    if (hash(i, j, 3) < density * 0.9) plants.push({ kind: scorch > 0.5 ? "dead" : "shrub", x: (i + (hash(i, j, 43) - 0.5)) * SAMPLE_SPACING, y: (j + (hash(i, j, 63) - 0.5)) * SAMPLE_SPACING, size: 0.5 + hash(i, j, 83) * 0.4 });
  }
  return plants;
}

let spriteSheet = null;
function makeSprite(size, draw) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  draw(canvas.getContext("2d"), size);
  return canvas;
}

function sprites() {
  if (spriteSheet) return spriteSheet;
  const S = 64;
  const shadow = (g, cx, cy, rx, ry) => {
    g.save();
    g.translate(cx, cy);
    g.scale(1, ry / rx);
    const gradient = g.createRadialGradient(0, 0, 0, 0, 0, rx);
    gradient.addColorStop(0, "rgba(10,14,6,0.55)");
    gradient.addColorStop(1, "rgba(10,14,6,0)");
    g.fillStyle = gradient;
    g.beginPath(); g.arc(0, 0, rx, 0, Math.PI * 2); g.fill();
    g.restore();
  };
  const blob = (g, cx, cy, r, light, mid, dark) => {
    const gradient = g.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
    gradient.addColorStop(0, light);
    gradient.addColorStop(0.55, mid);
    gradient.addColorStop(1, dark);
    g.fillStyle = gradient;
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
  };
  spriteSheet = {
    oak: makeSprite(S, (g, s) => {
      shadow(g, s * 0.58, s * 0.6, s * 0.38, s * 0.3);
      blob(g, s * 0.5, s * 0.5, s * 0.3, "#8fb454", "#4f7a2c", "#243f17");
      blob(g, s * 0.4, s * 0.58, s * 0.2, "#7ca648", "#456c26", "#244018");
      blob(g, s * 0.6, s * 0.42, s * 0.18, "#94b85a", "#52802f", "#27441a");
    }),
    pine: makeSprite(S, (g, s) => {
      shadow(g, s * 0.58, s * 0.62, s * 0.34, s * 0.26);
      g.translate(s * 0.5, s * 0.5);
      for (let ring = 0; ring < 3; ring += 1) {
        const radius = s * (0.3 - ring * 0.07);
        g.fillStyle = ["#1f3d22", "#2a5230", "#386a3c"][ring];
        g.beginPath();
        for (let point = 0; point < 12; point += 1) {
          const angle = point / 12 * Math.PI * 2;
          const r = point % 2 ? radius * 0.55 : radius;
          g.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
        }
        g.closePath(); g.fill();
      }
      g.fillStyle = "rgba(210,235,180,0.25)";
      g.beginPath(); g.arc(-s * 0.05, -s * 0.05, s * 0.05, 0, Math.PI * 2); g.fill();
    }),
    shrub: makeSprite(S, (g, s) => {
      shadow(g, s * 0.55, s * 0.58, s * 0.26, s * 0.2);
      blob(g, s * 0.5, s * 0.5, s * 0.18, "#a2b45a", "#6a8438", "#3d5421");
      blob(g, s * 0.58, s * 0.46, s * 0.1, "#b6c46a", "#7a923f", "#47602a");
    }),
    dead: makeSprite(S, (g, s) => {
      shadow(g, s * 0.56, s * 0.58, s * 0.2, s * 0.14);
      g.strokeStyle = "#2a2622"; g.lineWidth = s * 0.03; g.lineCap = "round";
      for (let branch = 0; branch < 7; branch += 1) {
        const angle = branch / 7 * Math.PI * 2 + 0.3;
        g.beginPath(); g.moveTo(s * 0.5, s * 0.5);
        g.lineTo(s * 0.5 + Math.cos(angle) * s * 0.22, s * 0.5 + Math.sin(angle) * s * 0.22);
        g.stroke();
      }
    })
  };
  return spriteSheet;
}

// Bake trees, shrubs and crop rows for one chunk into a transparent canvas.
export function bakeVegetationChunk(layers, field, chunkX, chunkY, canvas = null, ppu = VEGETATION_PIXELS_PER_UNIT) {
  const size = Math.max(8, Math.round(CHUNK_SPAN * ppu));
  const target = canvas || document.createElement("canvas");
  target.width = target.height = size;
  const g = target.getContext("2d");
  g.clearRect(0, 0, size, size);
  const scale = ppu;
  const originX = chunkX * CHUNK_SPAN;
  const originY = chunkY * CHUNK_SPAN;
  const sheet = sprites();
  const items = [];
  const baseI = chunkX * CHUNK_SAMPLES;
  const baseJ = chunkY * CHUNK_SAMPLES;
  for (let lj = -1; lj <= CHUNK_SAMPLES; lj += 1) {
    for (let li = -1; li <= CHUNK_SAMPLES; li += 1) {
      const i = baseI + li;
      const j = baseJ + lj;
      if (i < 0 || j < 0) continue;
      const kind = layers.get("vegKind", i, j);
      if (kind === VEGETATION.NONE || kind === VEGETATION.GRASS) continue;
      const density = layers.get("vegetation", i, j) / 255;
      const scorch = layers.get("scorch", i, j) / 255;
      if (kind === VEGETATION.CROP) {
        const stage = layers.get("cropStage", i, j) / 255;
        const x = (i - 0.5) * SAMPLE_SPACING - originX;
        const y = (j - 0.5) * SAMPLE_SPACING - originY;
        const grown = [Math.round(88 + stage * 70), Math.round(104 + stage * 40 - stage * stage * 30), Math.round(46 + stage * 8)];
        const ripe = stage > 0.85 ? [196, 170, 76] : grown;
        g.fillStyle = `rgba(${ripe[0]},${ripe[1]},${ripe[2]},${0.55 + stage * 0.35})`;
        for (let row = 0; row < 4; row += 1) g.fillRect(x * scale, (y + row * 4 + 1) * scale, SAMPLE_SPACING * scale, 2.2 * scale);
        continue;
      }
      for (const plant of plantsForCell(i, j, kind, density, scorch)) {
        const px = plant.x - originX;
        const py = plant.y - originY;
        if (px < -40 || py < -40 || px > CHUNK_SPAN + 40 || py > CHUNK_SPAN + 40) continue;
        items.push({ plant, px, py });
      }
    }
  }
  items.sort((a, b) => a.py - b.py);
  for (const { plant, px, py } of items) {
    const sprite = sheet[plant.kind];
    const base = plant.kind === "shrub" ? 22 : plant.kind === "dead" ? 26 : 30;
    const drawSize = base * plant.size * scale;
    g.drawImage(sprite, px * scale - drawSize / 2, py * scale - drawSize / 2, drawSize, drawSize);
  }
  return target;
}
