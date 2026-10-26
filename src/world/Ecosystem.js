// Living-world simulation over the surface layers: weather, soil moisture,
// mud, ponding and seepage into dug channels, fire, regrowth, scorch healing
// and crop growth. It runs at a world-time scale and in a rotating per-chunk
// schedule: each chunk is advanced by however much time has elapsed since it
// was last visited, so a distant, unwatched part of the world stays consistent
// without being stepped every frame.

import { CHUNK_SAMPLES } from "../terrain/HeightField.js";
import { EARTHWORK, SURFACE, VEGETATION } from "./WorldLayers.js";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const NO_WATER = -1e9;
const NEIGHBORS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const NEIGHBORS8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

export const WEATHER_STATES = Object.freeze({
  clear: { rain: 0, cloud: 0.1, label: "Clear" },
  overcast: { rain: 0.05, cloud: 0.6, label: "Overcast" },
  rain: { rain: 0.55, cloud: 0.85, label: "Rain" },
  storm: { rain: 1, cloud: 1, label: "Storm" }
});

export const SEASONS = Object.freeze([
  { name: "Spring", growth: 1.0, dry: 0.9, plant: true },
  { name: "Summer", growth: 1.15, dry: 1.3, plant: true },
  { name: "Autumn", growth: 0.55, dry: 1.0, plant: false },
  { name: "Winter", growth: 0.04, dry: 0.5, plant: false }
]);

const TRANSITIONS = {
  clear: [["clear", 5], ["overcast", 3]],
  overcast: [["clear", 3], ["overcast", 2], ["rain", 3]],
  rain: [["overcast", 3], ["rain", 3], ["storm", 1]],
  storm: [["rain", 3], ["overcast", 1]]
};

export class EcosystemSimulator {
  constructor({ layers, field, random = Math.random, timeScale = 14, seasonLength = 600, startSeason = 0 } = {}) {
    this.seasonLength = seasonLength;
    this.seasonOffset = startSeason * seasonLength;
    this.layers = layers;
    this.field = field;
    this.random = random;
    this.timeScale = timeScale; // world seconds per simulated second
    this.time = 0;
    this.weather = { state: "clear", rain: 0, cloud: 0.1, changeAt: 40, wind: { x: 0.6, y: 0.2 } };
    this.fires = new Map();
    this.visited = new Map();
    this.cursor = 0;
    this.fireClock = 0;
    this.chunkBudget = 6;
    this.listeners = new Set();
    this.stats = { burnedCells: 0, flooded: 0, harvests: 0 };
  }

  /** Current season, plus how far through the year we are (0..1). */
  get season() {
    const t = (this.time + this.seasonOffset) / this.seasonLength;
    const index = Math.floor(t) % 4;
    return { ...SEASONS[index], index, progress: (t % 4) / 4, year: Math.floor(t / 4) };
  }

  on(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  emit(event) { for (const listener of this.listeners) listener(event); }

  // ---- weather -----------------------------------------------------------
  setWeather(state) {
    const target = WEATHER_STATES[state] || WEATHER_STATES.clear;
    this.weather.state = state in WEATHER_STATES ? state : "clear";
    this.weather.rain = target.rain;
    this.weather.cloud = target.cloud;
    this.weather.changeAt = this.time + 60 + this.random() * 120;
  }

  stepWeather() {
    if (this.time < this.weather.changeAt) return;
    const options = TRANSITIONS[this.weather.state] || TRANSITIONS.clear;
    let total = 0;
    for (const [, weight] of options) total += weight;
    let roll = this.random() * total;
    let pick = options[0][0];
    for (const [state, weight] of options) { roll -= weight; if (roll <= 0) { pick = state; break; } }
    this.setWeather(pick);
    const angle = this.random() * Math.PI * 2;
    this.weather.wind = { x: Math.cos(angle), y: Math.sin(angle) };
    this.emit({ type: "weather", state: pick });
  }

  // ---- fire --------------------------------------------------------------
  ignite(x, y, intensity = 1) {
    const i = Math.round(x / 16);
    const j = Math.round(y / 16);
    return this._ignite(i, j, intensity);
  }

  _ignite(i, j, intensity = 1) {
    const key = `${i},${j}`;
    if (this.fires.has(key)) return false;
    if (this.layers.get("scorch", i, j) > 215) return false;
    const fuel = this.layers.get("vegetation", i, j) / 255;
    const flammable = fuel > 0.1 || this.layers.get("vegKind", i, j) === VEGETATION.CROP;
    if (!flammable && intensity < 1.5) return false;
    this.fires.set(key, { i, j, life: 10 + this.random() * 14 + fuel * 14, intensity });
    this.layers.set("fire", i, j, 120 + intensity * 100);
    this.emit({ type: "fire-start", i, j });
    return true;
  }

  extinguish(x, y, radius) {
    this.layers.forEachInCircle(x, y, radius, (i, j) => {
      const key = `${i},${j}`;
      if (this.fires.delete(key)) this.layers.set("fire", i, j, 0);
    });
  }

  get burning() { return this.fires.size; }

  _stepFires(dt) {
    const layers = this.layers;
    const wind = this.weather.wind;
    const rain = this.weather.rain;
    const spread = [];
    for (const [key, fire] of this.fires) {
      fire.life -= dt * (1 + rain * 2.4);
      const { i, j } = fire;
      const fuel = layers.get("vegetation", i, j) / 255;
      layers.set("vegetation", i, j, Math.max(0, (fuel - 0.06 * dt) * 255));
      layers.set("scorch", i, j, Math.min(255, layers.get("scorch", i, j) + 40 * dt));
      layers.set("fire", i, j, Math.max(0, layers.get("fire", i, j) * 0.96 + (this.random() - 0.5) * 8));
      layers.set("integrity", i, j, layers.get("integrity", i, j) * (1 - 0.03 * dt));
      this.emit({ type: "burning", i, j, intensity: fire.intensity });
      if (fire.life <= 0 || (rain > 0.5 && this.random() < 0.3 * dt)) {
        this.fires.delete(key);
        layers.set("fire", i, j, 0);
        layers.set("scorch", i, j, Math.max(layers.get("scorch", i, j), 215));
        const kind = layers.get("vegKind", i, j);
        if (kind === VEGETATION.FOREST || kind === VEGETATION.SHRUB) layers.set("vegetation", i, j, Math.min(layers.get("vegetation", i, j), 18));
        if (kind === VEGETATION.CROP) { layers.set("vegKind", i, j, VEGETATION.NONE); layers.set("cropStage", i, j, 0); }
        this.stats.burnedCells += 1;
        this.emit({ type: "fire-out", i, j });
        continue;
      }
      for (const [di, dj] of NEIGHBORS8) {
        const ni = i + di;
        const nj = j + dj;
        const nkey = `${ni},${nj}`;
        if (this.fires.has(nkey) || layers.get("scorch", ni, nj) > 200) continue;
        const kind = layers.get("vegKind", ni, nj);
        const fuelN = layers.get("vegetation", ni, nj) / 255;
        if (fuelN < 0.12 && kind !== VEGETATION.CROP) continue;
        const wet = layers.get("moisture", ni, nj) / 255;
        const waterHere = layers.get("waterSurface", ni, nj) > NO_WATER;
        if (waterHere || wet > 0.82) continue;
        const align = clamp(1 + (di * wind.x + dj * wind.y) * 0.9, 0.2, 2);
        const forestBoost = kind === VEGETATION.FOREST ? 1.35 : kind === VEGETATION.GRASS ? 0.9 : 1;
        const chance = (0.05 + fuelN * 0.22) * (1 - wet) * align * forestBoost * fire.intensity * (1 - rain * 0.7);
        if (this.random() < chance * dt) spread.push([ni, nj]);
      }
    }
    for (const [ni, nj] of spread) this._ignite(ni, nj, 1);
  }

  // ---- per-chunk ecology ---------------------------------------------------
  _stepChunk(chunk, elapsed) {
    const layers = this.layers;
    const field = this.field;
    const rain = this.weather.rain;
    const worldDt = elapsed * this.timeScale;
    // Bytes can't hold fractions, so slow processes round stochastically; otherwise tiny per-visit changes would vanish.
    const season = this.season;
    const growth = season.growth;
    const random = this.random;
    const q = value => Math.floor(clamp(value, 0, 255) + random());
    const baseI = chunk.cx * CHUNK_SAMPLES;
    const baseJ = chunk.cy * CHUNK_SAMPLES;
    for (let lj = 0; lj < CHUNK_SAMPLES; lj += 1) {
      for (let li = 0; li < CHUNK_SAMPLES; li += 1) {
        const i = baseI + li;
        const j = baseJ + lj;
        const n = lj * CHUNK_SAMPLES + li;
        const fertility = chunk.fertility[n] / 255;
        let moisture = chunk.moisture[n] / 255;
        const surfaceWater = chunk.waterSurface[n];
        const ground = field.sample(i, j);
        const wetCell = surfaceWater > NO_WATER && surfaceWater > ground;
        let nearWater = wetCell;
        if (!nearWater) {
          for (const [di, dj] of NEIGHBORS4) { if (layers.get("waterSurface", i + di, j + dj) > NO_WATER) { nearWater = true; break; } }
        }
        // Soil moisture drifts toward a baseline that rain and nearby water raise.
        const baseline = clamp(0.12 * season.dry + fertility * 0.3 + (nearWater ? 0.4 : 0) + rain * 0.55, 0, 1);
        moisture += (baseline - moisture) * clamp(0.0035 * worldDt, 0, 0.5);
        chunk.moisture[n] = q(moisture * 255);

        // Mud forms on wet bare soil and dries back.
        const surface = chunk.surface[n];
        if ((surface === SURFACE.SOIL || surface === SURFACE.SAND) && moisture > 0.74 && chunk.vegetation[n] < 90 && !wetCell) chunk.surface[n] = SURFACE.MUD;
        else if (surface === SURFACE.MUD && moisture < 0.52) chunk.surface[n] = SURFACE.SOIL;

        // Excavations collect rain and seep from adjacent water.
        const earthwork = chunk.earthwork[n];
        if (earthwork === EARTHWORK.PIT || earthwork === EARTHWORK.TRENCH) {
          let rim = Infinity;
          let source = NO_WATER;
          for (const [di, dj] of NEIGHBORS4) {
            const h = field.sample(i + di, j + dj);
            if (h < rim) rim = h;
            const s = layers.get("waterSurface", i + di, j + dj);
            if (s > source) source = s;
          }
          const level = surfaceWater > NO_WATER ? surfaceWater - ground : 0;
          const capacity = Math.max(0, rim - ground - 0.12);
          let next = level;
          if (source > ground + 0.05) next = Math.max(next, source - ground); // seepage fills to the neighbour's level
          if (rain > 0.2) next += rain * 0.00035 * worldDt * 12;
          else next -= 0.00018 * worldDt;
          if (source <= NO_WATER) next = Math.min(next, capacity);
          next = clamp(next, 0, 6);
          if (next > 0.08) {
            if (surfaceWater <= NO_WATER) this.stats.flooded += 1;
            chunk.waterSurface[n] = ground + next;
          } else if (surfaceWater > NO_WATER) chunk.waterSurface[n] = NO_WATER;
        }

        // Scorch heals, fertility recovers, trampling fades.
        if (chunk.scorch[n] > 0 && !this.fires.has(`${i},${j}`)) chunk.scorch[n] = q(chunk.scorch[n] - 0.00004 * worldDt * 255 * (0.4 + moisture));
        if (chunk.trample[n] > 0) chunk.trample[n] = q(chunk.trample[n] - 0.0004 * worldDt * 255);
        if (chunk.scorch[n] < 40 && chunk.fertility[n] < 190) chunk.fertility[n] = Math.min(190, q(chunk.fertility[n] + 0.00003 * worldDt * 255 * moisture));

        const kind = chunk.vegKind[n];
        if (wetCell) continue;
        if (kind === VEGETATION.CROP) {
          const stage = chunk.cropStage[n];
          if (moisture < 0.14 && stage > 0) chunk.cropStage[n] = q(stage - 0.0002 * worldDt * 255);
          else if (stage < 255) chunk.cropStage[n] = q(stage + 0.00035 * worldDt * growth * 255 * (0.3 + moisture) * (0.4 + fertility));
          chunk.vegetation[n] = Math.max(chunk.vegetation[n], 140);
          continue;
        }
        if (chunk.scorch[n] > 120 || chunk.earthwork[n] === EARTHWORK.PIT || chunk.earthwork[n] === EARTHWORK.TRENCH || chunk.fire[n] > 0) continue;
        // Regrowth: grass first, shrubs and forest creep in from neighbours.
        const target = clamp(0.1 + fertility * 0.7, 0.1, 0.85);
        let density = chunk.vegetation[n] / 255;
        if (kind === VEGETATION.NONE) {
          if (fertility > 0.28 && chunk.surface[n] !== SURFACE.STONE && moisture > 0.25 && this.random() < 0.0008 * worldDt) { chunk.vegKind[n] = VEGETATION.GRASS; density = Math.max(density, 0.12); }
        } else if (density < target) density += 0.00006 * worldDt * growth * moisture * (0.4 + fertility);
        chunk.vegetation[n] = q(density * 255);
        if (kind !== VEGETATION.FOREST && fertility > 0.5 && moisture > 0.45 && this.random() < 0.000004 * worldDt) {
          let forestNeighbours = 0;
          for (const [di, dj] of NEIGHBORS4) if (layers.get("vegKind", i + di, j + dj) === VEGETATION.FOREST) forestNeighbours += 1;
          if (forestNeighbours > 0) {
            chunk.vegKind[n] = kind === VEGETATION.SHRUB ? VEGETATION.FOREST : VEGETATION.SHRUB;
            chunk.vegetation[n] = Math.max(chunk.vegetation[n], 70);
          }
        }
      }
    }
    chunk.rev += 1;
  }

  /** Advance the world by `dt` simulated seconds. */
  step(dt) {
    this.time += dt;
    this.stepWeather();
    this.fireClock += dt;
    if (this.fireClock >= 0.5) {
      if (this.fires.size) this._stepFires(this.fireClock * this.timeScale * 0.06);
      this.fireClock = 0;
    }
    if (!this._chunkList || this._chunkCount !== this.layers.chunks.size) { this._chunkList = [...this.layers.chunks.values()]; this._chunkCount = this._chunkList.length; }
    const chunks = this._chunkList;
    if (!chunks.length) return;
    for (let n = 0; n < this.chunkBudget && n < chunks.length; n += 1) {
      const chunk = chunks[this.cursor % chunks.length];
      this.cursor += 1;
      const key = `${chunk.cx},${chunk.cy}`;
      const last = this.visited.get(key) ?? (this.time - dt);
      const elapsed = this.time - last;
      if (elapsed < 0.4) continue;
      this.visited.set(key, this.time);
      this._stepChunk(chunk, Math.min(elapsed, 120));
    }
  }

  /** Harvest a crop cell: returns food units and resets growth. */
  harvest(i, j) {
    const stage = this.layers.get("cropStage", i, j) / 255;
    if (this.layers.get("vegKind", i, j) !== VEGETATION.CROP || stage < 0.6) return 0;
    const yieldFood = Math.round(stage * (4 + this.layers.get("fertility", i, j) / 255 * 8));
    this.layers.set("cropStage", i, j, 0);
    this.stats.harvests += 1;
    return yieldFood;
  }
}

export function plantCrop(layers, i, j) {
  if (layers.get("waterSurface", i, j) > NO_WATER) return false;
  layers.set("vegKind", i, j, VEGETATION.CROP);
  layers.set("vegetation", i, j, 160);
  layers.set("cropStage", i, j, 8);
  layers.set("earthwork", i, j, EARTHWORK.FIELD);
  return true;
}
