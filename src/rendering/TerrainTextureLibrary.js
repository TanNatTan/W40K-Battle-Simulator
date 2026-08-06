export const TERRAIN_TEXTURE_MANIFEST = Object.freeze({
  ash: textureSeries("AshCoveredGround", "AshCoveredGround"),
  darksoil: textureSeries("DarkBattlefieldSoil-1", "DarkBattlefieldSoil"),
  dirt: textureSeries("Dirt", "Dirt"),
  drydirt: textureSeries("DryDirt", "DryDirt"),
  drygrass: textureSeries("DryGrass", "DryGrass"),
  grass: textureSeries("Grass", "Grass"),
  gravel: textureSeries("Gravel", "Gravel"),
  mud: textureSeries("Mud", "Mud"),
  rockysoil: textureSeries("RockySoil", "RockySoil"),
  sand: textureSeries("Sand", "Sand")
});

const TERRAIN_TEXTURE_ALIASES = Object.freeze({
  darkgrass: "darksoil",
  rock: "rockysoil"
});

function textureSeries(folder, fileStem) {
  return Object.freeze(Array.from(
    { length: 4 },
    (_, index) => `assets/terrain/${folder}/${fileStem}-${index + 1}.png`
  ));
}

export function terrainTextureType(type) {
  const canonical = TERRAIN_TEXTURE_ALIASES[type] || type;
  return TERRAIN_TEXTURE_MANIFEST[canonical] ? canonical : null;
}

export function terrainTexturePaths(type) {
  return TERRAIN_TEXTURE_MANIFEST[terrainTextureType(type)] || Object.freeze([]);
}

export function terrainTextureVariant(type, tileX, tileY) {
  const paths = terrainTexturePaths(type);
  if (!paths.length) return null;
  let hash = Math.imul(Math.trunc(tileX), 73856093) ^ Math.imul(Math.trunc(tileY), 19349663);
  hash = (hash ^ hash >>> 13) >>> 0;
  return paths[hash % paths.length];
}

/** Loads terrain art once and builds a varied 2x2 repeat pattern per terrain. */
export class TerrainTextureLibrary {
  constructor({ onReady = () => {}, onError = () => {} } = {}) {
    this.onReady = onReady;
    this.onError = onError;
    this.images = new Map();
    this.composites = new Map();
    this.patterns = new WeakMap();
    this.loadPromise = null;
  }

  load() {
    if (this.loadPromise) return this.loadPromise;
    if (typeof Image === "undefined") return Promise.resolve(this);
    const paths = [...new Set(Object.values(TERRAIN_TEXTURE_MANIFEST).flat())];
    this.loadPromise = Promise.allSettled(paths.map(path => this.loadImage(path))).then(() => {
      this.onReady(this);
      return this;
    });
    return this.loadPromise;
  }

  loadImage(path) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = "async";
      image.addEventListener("load", () => {
        this.images.set(path, image);
        resolve(image);
      }, { once: true });
      image.addEventListener("error", () => {
        this.onError(path);
        reject(new Error(`Unable to load terrain texture: ${path}`));
      }, { once: true });
      image.src = path;
    });
  }

  pattern(context, type, tileSize = 64) {
    const canonical = terrainTextureType(type);
    if (!canonical) return null;
    let contextPatterns = this.patterns.get(context);
    if (!contextPatterns) {
      contextPatterns = new Map();
      this.patterns.set(context, contextPatterns);
    }
    const cacheKey = `${canonical}:${tileSize}`;
    if (contextPatterns.has(cacheKey)) return contextPatterns.get(cacheKey);
    const composite = this.composite(canonical);
    if (!composite) return null;
    const pattern = context.createPattern(composite, "repeat");
    if (pattern?.setTransform && typeof DOMMatrix !== "undefined") {
      const scale = tileSize / 120;
      pattern.setTransform(new DOMMatrix().scale(scale, scale));
    }
    contextPatterns.set(cacheKey, pattern);
    return pattern;
  }

  composite(type) {
    if (this.composites.has(type)) return this.composites.get(type);
    if (typeof document === "undefined") return null;
    const images = terrainTexturePaths(type).map(path => this.images.get(path)).filter(Boolean);
    if (!images.length) return null;
    const cellWidth = Math.max(...images.map(image => image.naturalWidth || image.width));
    const cellHeight = Math.max(...images.map(image => image.naturalHeight || image.height));
    const composite = document.createElement("canvas");
    composite.width = cellWidth * 2;
    composite.height = cellHeight * 2;
    const compositeContext = composite.getContext("2d");
    compositeContext.imageSmoothingEnabled = true;
    for (let index = 0; index < 4; index += 1) {
      const image = images[index % images.length];
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = column * cellWidth + (cellWidth - image.naturalWidth) / 2;
      const y = row * cellHeight + (cellHeight - image.naturalHeight) / 2;
      compositeContext.drawImage(image, x, y);
    }
    this.composites.set(type, composite);
    return composite;
  }
}
