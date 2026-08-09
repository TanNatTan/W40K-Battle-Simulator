function bucketKey(x, y, cellSize) {
  return `${Math.floor(x / cellSize)},${Math.floor(y / cellSize)}`;
}

function addToBucket(map, key, value) {
  let bucket = map.get(key);
  if (!bucket) {
    bucket = [];
    map.set(key, bucket);
  }
  bucket.push(value);
}

export class StrategicCellIndex {
  constructor(cellSize = 128) {
    this.cellSize = Math.max(16, Number(cellSize) || 128);
    this.unitsByCell = new Map();
    this.structuresByCell = new Map();
    this.resourcesByCell = new Map();
    this.landmarksByCell = new Map();
    this.unitsById = new Map();
    this.structuresById = new Map();
    this.landmarksById = new Map();
    this.revision = 0;
    this.stats = { unitScans: 0, structureScans: 0, resourceScans: 0, landmarkScans: 0 };
  }

  rebuild({ units = [], structures = [], resources = [], landmarks = [] } = {}) {
    this.unitsByCell.clear();
    this.structuresByCell.clear();
    this.resourcesByCell.clear();
    this.landmarksByCell.clear();
    this.unitsById.clear();
    this.structuresById.clear();
    this.landmarksById.clear();
    for (const unit of units) {
      if (!unit.alive || unit.incapacitated || unit.embarkedInId) continue;
      this.unitsById.set(unit.id, unit);
      addToBucket(this.unitsByCell, bucketKey(unit.x, unit.y, this.cellSize), unit);
    }
    for (const structure of structures) {
      if (structure.alive === false) continue;
      this.structuresById.set(structure.id, structure);
      addToBucket(this.structuresByCell, bucketKey(structure.x, structure.y, this.cellSize), structure);
    }
    for (const resource of resources) addToBucket(this.resourcesByCell, bucketKey(resource.x, resource.y, this.cellSize), resource);
    for (const landmark of landmarks) {
      if (landmark.active === false) continue;
      this.landmarksById.set(landmark.id, landmark);
      addToBucket(this.landmarksByCell, bucketKey(landmark.x, landmark.y, this.cellSize), landmark);
    }
    this.revision += 1;
    this.stats.unitScans += 1;
    this.stats.structureScans += 1;
    this.stats.resourceScans += 1;
    this.stats.landmarkScans += 1;
    return this;
  }

  query(map, point, radius = this.cellSize) {
    const result = [];
    const minX = Math.floor((point.x - radius) / this.cellSize);
    const maxX = Math.floor((point.x + radius) / this.cellSize);
    const minY = Math.floor((point.y - radius) / this.cellSize);
    const maxY = Math.floor((point.y + radius) / this.cellSize);
    const radiusSquared = radius * radius;
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const bucket = map.get(`${x},${y}`);
        if (!bucket) continue;
        for (const item of bucket) {
          const dx = item.x - point.x;
          const dy = item.y - point.y;
          if (dx * dx + dy * dy <= radiusSquared) result.push(item);
        }
      }
    }
    return result;
  }

  unitsNear(point, radius) { return this.query(this.unitsByCell, point, radius); }
  structuresNear(point, radius) { return this.query(this.structuresByCell, point, radius); }
  resourcesNear(point, radius) { return this.query(this.resourcesByCell, point, radius); }
  landmarksNear(point, radius) { return this.query(this.landmarksByCell, point, radius); }
}
