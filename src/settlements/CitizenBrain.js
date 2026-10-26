// Individual utility AI for one citizen: perceive, pick the most valuable
// thing to do, walk there over real terrain, do the work, and write the
// consequences into the shared world (crops, soil, mines, trenches, stores).

import { crater, digTrench, excavate, levelSite } from "../world/Deformation.js";
import { plantCrop } from "../world/Ecosystem.js";
import { VEGETATION } from "../world/WorldLayers.js";
import { groundEffects } from "../world/GroundEffects.js";
import { BUILDING_TYPES, DAY, FOOD_PER_DAY, clamp, distance, operationalBuildings, storageCapacity } from "./Settlement.js";

const PERCEIVE = 130;     // how far a civilian notices armed strangers
const MILITIA_RANGE = 88;
const CARRY_FOOD = 14;
const CARRY_ORE = 10;

export function isNight(now) { const t = (now % DAY) / DAY; return t > 0.78 || t < 0.04; }

// ---- movement -------------------------------------------------------------
function planPath(world, a, tx, ty) {
  if (distance(a, { x: tx, y: ty }) < 22) return [{ x: tx, y: ty }];
  if (world.pathBudget <= 0) return null; // wait for a turn at the planner
  world.pathBudget -= 1;
  const cell = world.pathfinder.cell;
  const key = `${Math.floor(a.x / cell)},${Math.floor(a.y / cell)}>${Math.floor(tx / cell)},${Math.floor(ty / cell)}`;
  const path = world.pathfinder.find(a.x, a.y, tx, ty, { kind: "civilian", cacheKey: key });
  if (!path || !path.length) return [{ x: tx, y: ty }];
  path.push({ x: tx, y: ty });
  return path;
}

/** Walk toward the task point. Returns true on arrival. */
export function walk(world, a, dt, speedMul = 1) {
  const task = a.task;
  if (!task.path) {
    task.path = planPath(world, a, task.x, task.y); task.pi = 0;
    if (!task.path) return false;
  }
  if (a.groundAt === undefined || world.time >= a.groundAt) {
    const info = world.layers.surfaceInfo(a.x, a.y);
    const effect = groundEffects(info, world.field.heightAt(a.x, a.y), "civilian", world.eco?.weather);
    a.ground = effect.speed;
    a.groundAt = world.time + 0.4 + world.random() * 0.2;
    if (effect.hazard > 0.4) a.hp -= effect.hazard * 2 * 0.4;
  }
  const slopeDir = task.path[task.pi] || { x: task.x, y: task.y };
  const dx = slopeDir.x - a.x;
  const dy = slopeDir.y - a.y;
  const d = Math.hypot(dx, dy);
  const slope = d > 0.5 ? world.field.directionalSlope(a.x, a.y, dx, dy) : 0;
  const uphill = slope > 0 ? clamp(1 - slope * 0.85, 0.3, 1) : 1;
  const step = a.speed * (a.ground ?? 1) * uphill * speedMul * dt * (1 - clamp(a.needs.fatigue - 0.7, 0, 0.3));
  if (d <= Math.max(2.5, step)) {
    a.x = slopeDir.x; a.y = slopeDir.y; task.pi += 1;
    if (task.pi >= task.path.length) return true;
    return false;
  }
  const nx = a.x + dx / d * step;
  const ny = a.y + dy / d * step;
  if (world.pathfinder.blockedAt(nx, ny, "civilian") && !world.pathfinder.blockedAt(a.x, a.y, "civilian")) {
    // Something impassable lies ahead (a river the straight line crosses): replan around it.
    task.blocked = (task.blocked || 0) + 1;
    task.path = null;
    if (task.blocked > 5) { const home = world.settlements.get(a.settlementId); if (home) releaseClaim(world, home, a); a.task = null; }
    return false;
  }
  a.x = nx;
  a.y = ny;
  a.facing = Math.atan2(dy, dx);
  return false;
}

function assign(a, type, x, y, extra = {}) {
  a.task = { type, x, y, t: 0, path: null, pi: 0, ...extra };
  a.activity = type;
}

function releaseClaim(world, s, a) {
  if (a.task?.claim) { s._claims.delete(a.task.claim); a.task.claim = null; }
}

export function idle(world, s, a) { releaseClaim(world, s, a); a.task = null; a.activity = "idle"; }

// ---- helpers --------------------------------------------------------------
function nearestOf(list, a, filter = () => true) {
  let best = null; let bestD = Infinity;
  for (const item of list) {
    if (!filter(item)) continue;
    const d = Math.hypot(item.x - a.x, item.y - a.y);
    if (d < bestD) { bestD = d; best = item; }
  }
  return best;
}

function homeOf(world, s, a) { return a.home || { x: s.x, y: s.y }; }

function storePoint(world, s, a) {
  const granary = nearestOf(operationalBuildings(s, "granary"), a);
  return granary ? { x: granary.x, y: granary.y } : { x: s.x, y: s.y };
}

function fieldCell(world, s, a, ripeOnly) {
  const layers = world.layers;
  let best = null; let bestScore = Infinity;
  for (const cell of s.fields) {
    const key = cell[0] * 100003 + cell[1];
    if (s._claims.has(key)) continue;
    const kind = layers.get("vegKind", cell[0], cell[1]);
    const stage = layers.get("cropStage", cell[0], cell[1]) / 255;
    if (ripeOnly) { if (kind !== VEGETATION.CROP || stage < 0.62) continue; }
    else if (kind === VEGETATION.CROP) continue;
    if (!ripeOnly && layers.get("waterSurface", cell[0], cell[1]) > -1e8) continue;
    const d = Math.hypot(cell[0] * 16 - a.x, cell[1] * 16 - a.y) - (ripeOnly ? stage * 40 : 0);
    if (d < bestScore) { bestScore = d; best = { key, i: cell[0], j: cell[1] }; }
  }
  return best;
}

// ---- decision --------------------------------------------------------------
function nearestThreat(s, a, radius) {
  let best = null; let bestD = radius;
  for (const t of s._threats) {
    const d = Math.hypot(t.x - a.x, t.y - a.y);
    if (d < bestD) { bestD = d; best = t; }
  }
  return best;
}

function shelterFor(world, s, a, threat) {
  const home = homeOf(world, s, a);
  const danger = threat || s._threats[0];
  if (!danger) return home;
  // During an attack the whole settlement falls back to the far side from the enemy, outside its reach.
  const center = s._threatCenter || danger;
  const away = Math.atan2(s.y - center.y, s.x - center.x) + (a.shelterJitter ??= (world.random() - 0.5) * 1.3);
  const r = s.radius * 1.35;
  let target = { x: s.x + Math.cos(away) * r, y: s.y + Math.sin(away) * r };
  const homeSafe = Math.hypot(home.x - danger.x, home.y - danger.y) > 220;
  if (homeSafe && !threat) target = home;
  // Anyone already beyond the line stays put rather than running back through it.
  if (Math.hypot(a.x - danger.x, a.y - danger.y) < 110) {
    const run = Math.atan2(a.y - danger.y, a.x - danger.x);
    target = { x: a.x + Math.cos(run) * 140, y: a.y + Math.sin(run) * 140 };
  }
  const open = world.pathfinder.nearestOpen(clamp(target.x, 30, world.width - 30), clamp(target.y, 30, world.height - 30), "civilian", 140);
  return open || home;
}

function decide(world, s, a, now) {
  const toStore = Math.hypot(a.x - s.x, a.y - s.y);
  const needsFood = a.needs.hunger > 0.6 - clamp(toStore / 600, 0, 0.25);
  const threat = nearestThreat(s, a, a.role === "militia" ? 230 : PERCEIVE + (s.posture === "alert" ? 40 : 0));
  const alarmed = s.posture === "siege" || s.posture === "evacuate";

  if (a.role === "captive") { if (!a.task || a.task.type !== "held") assign(a, "held", s.x + (world.random() - 0.5) * 24, s.y + (world.random() - 0.5) * 24); return; }

  if (a.role === "militia") { decideMilitia(world, s, a, now, threat); return; }

  if (threat && a.role !== "enslaved") {
    a.needs.fear = Math.min(1, a.needs.fear + 0.6);
  }
  if ((a.needs.fear > 0.45 || (alarmed && a.role !== "enslaved")) && a.role !== "refugee") {
    releaseClaim(world, s, a);
    const shelter = s.posture === "evacuate" ? evacuationPoint(world, s) : shelterFor(world, s, a, threat);
    if (a.activity !== "flee" || !a.task) assign(a, "flee", shelter.x, shelter.y, { evac: s.posture === "evacuate" });
    return;
  }
  if (a.role === "refugee") { decideRefugee(world, s, a, now); return; }

  if (needsFood && (s.storage.food + s.hidden.food) > 0.5) {
    releaseClaim(world, s, a);
    const p = storePoint(world, s, a);
    assign(a, "eat", p.x, p.y);
    return;
  }
  if ((a.needs.fatigue > 0.92 || (isNight(now) && s.posture === "calm")) && a.role !== "enslaved") {
    releaseClaim(world, s, a);
    const h = homeOf(world, s, a);
    assign(a, "rest", h.x, h.y);
    return;
  }
  if (a.role === "child") { if (!a.task) { const h = homeOf(world, s, a); assign(a, "wander", h.x + (world.random() - 0.5) * 70, h.y + (world.random() - 0.5) * 70); } return; }
  if (a.role === "elder") { if (!a.task) assign(a, "wander", s.x + (world.random() - 0.5) * 40, s.y + (world.random() - 0.5) * 40); return; }

  const role = a.role === "enslaved" ? a.workRole || "farmer" : a.role;
  const mineOk = s.mine && !s.mine.flooded && (s.mine.collapsedUntil || 0) <= now;
  if (role === "miner" && mineOk) { if (decideMiner(world, s, a)) return; }
  if (role === "builder" || role === "miner") { if (decideBuilder(world, s, a, now)) return; }
  decideFarmer(world, s, a, now);
}

function decideFarmer(world, s, a, now) {
  if (a.carrying.food >= CARRY_FOOD) { const p = storePoint(world, s, a); assign(a, "deliver", p.x, p.y); return; }
  const ripe = fieldCell(world, s, a, true);
  if (ripe) { s._claims.set(ripe.key, a.id); assign(a, "harvest", ripe.i * 16, ripe.j * 16, { claim: ripe.key, i: ripe.i, j: ripe.j }); return; }
  if (a.carrying.food > 0) { const p = storePoint(world, s, a); assign(a, "deliver", p.x, p.y); return; }
  if (world.eco.season.plant && (s.storage.seed + s.storage.food) > 1) {
    const empty = fieldCell(world, s, a, false);
    if (empty) { s._claims.set(empty.key, a.id); assign(a, "sow", empty.i * 16, empty.j * 16, { claim: empty.key, i: empty.i, j: empty.j }); return; }
  }
  if (!s.fields.length) { assign(a, "wander", s.x + (world.random() - 0.5) * 60, s.y + (world.random() - 0.5) * 60); return; }
  const cell = s.fields[Math.floor(world.random() * s.fields.length)];
  assign(a, "tend", cell[0] * 16, cell[1] * 16);
}

function decideMiner(world, s, a) {
  if (a.carrying.materials >= CARRY_ORE) { const p = storePoint(world, s, a); assign(a, "deliverOre", p.x, p.y); return true; }
  const m = s.mine;
  if (!m || m.flooded) return false;
  const angle = world.random() * Math.PI * 2;
  const r = Math.sqrt(world.random()) * m.radius * 0.8;
  assign(a, "mine", m.x + Math.cos(angle) * r, m.y + Math.sin(angle) * r);
  return true;
}

function decideBuilder(world, s, a, now) {
  // A project that still needs hands.
  const project = s.projects.find(p => !p.done && p.workers.length < (p.kind === "trench" ? 5 : 3) || p.workers.includes(a.id) && !p.done);
  if (project) {
    if (!project.workers.includes(a.id)) project.workers.push(a.id);
    if (project.kind === "trench") {
      const slice = project.slices.find(sl => !sl.done && (!sl.owner || sl.owner === a.id || !world.agents.get(sl.owner)?.alive));
      if (slice) { slice.owner = a.id; assign(a, "dig", slice.x, slice.y, { projectId: project.id, slice: slice.index }); return true; }
    } else {
      assign(a, "build", project.x, project.y, { projectId: project.id });
      return true;
    }
  }
  // Repairs.
  const damaged = s.buildings.find(b => b.operational && b.hp > 0 && b.hp < b.maxHp * 0.8 && !b.repairing);
  if (damaged && s.storage.materials >= 1) { damaged.repairing = a.id; assign(a, "repair", damaged.x, damaged.y, { buildingId: damaged.id }); return true; }
  // Short of building stone and no mine: fell timber.
  if (!s.mine && s.storage.materials < 18 && world.random() < 0.5) {
    const tree = findTimber(world, s, a);
    if (tree) { assign(a, "chop", tree.i * 16, tree.j * 16, { i: tree.i, j: tree.j }); return true; }
  }
  return false;
}

function findTimber(world, s, a) {
  let best = null; let bestD = Infinity;
  const L = world.layers;
  L.forEachInCircle(s.x, s.y, s.radius * 1.5, (i, j, d) => {
    if (L.get("vegKind", i, j) !== VEGETATION.FOREST || L.get("vegetation", i, j) < 70) return;
    if (d < bestD && d > 28) { bestD = d; best = { i, j }; }
  });
  return best;
}

function decideRefugee(world, s, a, now) {
  if (!a.task || a.task.type !== "travel") {
    const dest = a.destination || { x: s.x, y: s.y };
    assign(a, "travel", dest.x, dest.y);
  }
}

function evacuationPoint(world, s) {
  const threat = s._threats[0];
  const angle = threat ? Math.atan2(s.y - threat.y, s.x - threat.x) : world.random() * Math.PI * 2;
  const p = { x: clamp(s.x + Math.cos(angle) * s.radius * 2.3, 40, world.width - 40), y: clamp(s.y + Math.sin(angle) * s.radius * 2.3, 40, world.height - 40) };
  return world.pathfinder.nearestOpen(p.x, p.y, "civilian", 160) || p;
}

function decideMilitia(world, s, a, now, threat) {
  const enemies = s._threats.length;
  const militiaCount = s._militiaAlive || 1;
  // Morale: courage, tempered by odds and losses.
  const odds = enemies / Math.max(1, militiaCount);
  a.morale = clamp(a.traits.courage * 0.8 + 0.3 - odds * 0.07 - s.memory.lost * 0.002 + (s.posture === "siege" ? 0.04 : 0) + (s.buildings.some(b => b.type === "watchtower" && b.operational) ? 0.05 : 0), 0, 1);
  if (threat && a.morale < 0.32 && odds > 2.2) {
    const shelter = shelterFor(world, s, a, threat);
    if (a.activity !== "flee") assign(a, "flee", shelter.x, shelter.y, { rout: true });
    a.needs.fear = 1;
    return;
  }
  if (threat) {
    // Close to firing distance and open fire.
    const d = Math.hypot(threat.x - a.x, threat.y - a.y);
    if (d > MILITIA_RANGE * 0.85) assign(a, "advance", threat.x, threat.y, { targetId: threat.id, hold: MILITIA_RANGE * 0.7 });
    else if (!a.task || a.task.type !== "fire") assign(a, "fire", threat.x, threat.y, { targetId: threat.id });
    else { a.task.targetId = threat.id; a.task.x = threat.x; a.task.y = threat.y; }
    return;
  }
  if (a.needs.hunger > 0.7 && (s.storage.food + s.hidden.food) > 0.5) { const p = storePoint(world, s, a); assign(a, "eat", p.x, p.y); return; }
  if (isNight(now) && s.posture === "calm" && a.needs.fatigue > 0.6) { const h = homeOf(world, s, a); assign(a, "rest", h.x, h.y); return; }
  // Guard a post or patrol the perimeter.
  if (!a.task || a.task.type === "wander" || a.task.type === "flee") {
    const posts = s.buildings.filter(b => (b.type === "watchtower" || b.type === "barricade" || b.type === "palisade") && b.operational && b.hp > 0);
    if (posts.length && world.random() < 0.7) {
      const post = posts[Math.floor(world.random() * posts.length)];
      assign(a, "guard", post.x + (world.random() - 0.5) * 10, post.y + (world.random() - 0.5) * 10);
    } else {
      const angle = world.random() * Math.PI * 2;
      assign(a, "patrol", s.x + Math.cos(angle) * s.radius * 0.8, s.y + Math.sin(angle) * s.radius * 0.8);
    }
  }
}

// ---- task execution --------------------------------------------------------
function work(world, s, a, dt, now, seconds, onDone, speedFactor = 1) {
  const task = a.task;
  task.t += dt * speedFactor * (0.55 + (a.skills[task.skill || "farming"] || 0.5));
  a.needs.fatigue = Math.min(1.2, a.needs.fatigue + dt / (DAY * 1.1));
  if (task.t >= seconds) { onDone(); }
}

function perform(world, s, a, dt, now) {
  const task = a.task;
  const L = world.layers;
  switch (task.type) {
    case "harvest": {
      const arrived = walk(world, a, dt);
      if (!arrived) return;
      task.skill = "farming";
      work(world, s, a, dt, now, 2.4, () => {
        const food = world.eco.harvest(task.i, task.j);
        a.carrying.food += food;
        s.stats.harvested += food;
        a.skills.farming = Math.min(1, a.skills.farming + 0.002);
        s.storage.seed = Math.min(60, s.storage.seed + food * 0.08);
        releaseClaim(world, s, a);
        a.task = null;
      });
      return;
    }
    case "sow": {
      if (!walk(world, a, dt)) return;
      task.skill = "farming";
      work(world, s, a, dt, now, 2.0, () => {
        const seedCost = 0.25;
        if (s.storage.seed >= seedCost) s.storage.seed -= seedCost; else s.storage.food = Math.max(0, s.storage.food - seedCost);
        // Sowing clears whatever grass was there and tills the soil.
        plantCrop(L, task.i, task.j);
        L.set("trample", task.i, task.j, Math.max(L.get("trample", task.i, task.j), 90));
        releaseClaim(world, s, a);
        a.task = null;
      });
      return;
    }
    case "tend": {
      if (!walk(world, a, dt)) return;
      task.skill = "farming";
      work(world, s, a, dt, now, 3.5, () => { a.task = null; }, 0.7);
      return;
    }
    case "deliver": {
      if (!walk(world, a, dt)) return;
      const cap = storageCapacity(s);
      const room = Math.max(0, cap - s.storage.food);
      const put = Math.min(room, a.carrying.food);
      s.storage.food += put;
      // What does not fit rots in the open.
      a.carrying.food = 0;
      a.task = null;
      return;
    }
    case "deliverOre": {
      if (!walk(world, a, dt)) return;
      s.storage.materials += a.carrying.materials;
      s.stats.mined += a.carrying.materials;
      a.carrying.materials = 0;
      a.task = null;
      return;
    }
    case "mine": {
      if (!walk(world, a, dt)) return;
      task.skill = "mining";
      const m = s.mine;
      if (!m || m.flooded) { a.task = null; return; }
      work(world, s, a, dt, now, 3.2, () => {
        const result = excavate(world.field, L, task.x, task.y, 11, 0.42 * (0.6 + a.skills.mining), { floor: m.floor });
        const ore = (result.ore.materials || 0) + (result.ore.fuel || 0) * 0.4;
        a.carrying.materials += ore;
        if (result.ore.fuel) s.storage.fuel += result.ore.fuel;
        m.dug += result.removed;
        a.skills.mining = Math.min(1, a.skills.mining + 0.003);
        world.noteTerrainChange(task.x, task.y, 40);
        a.task = null;
      });
      return;
    }
    case "chop": {
      if (!walk(world, a, dt)) return;
      task.skill = "building";
      work(world, s, a, dt, now, 5, () => {
        const v = L.get("vegetation", task.i, task.j);
        L.set("vegetation", task.i, task.j, Math.max(0, v - 120));
        if (L.get("vegetation", task.i, task.j) < 30) { L.set("vegKind", task.i, task.j, VEGETATION.NONE); L.set("vegetation", task.i, task.j, 0); }
        s.storage.materials += 3.5;
        a.task = null;
      });
      return;
    }
    case "build": {
      if (!walk(world, a, dt)) return;
      const project = s.projects.find(p => p.id === task.projectId);
      if (!project || project.done) { a.task = null; return; }
      task.skill = "building";
      if (!project.leveled) {
        project.leveled = true;
        levelSite(world.field, L, project.x, project.y, project.size * 0.8);
        world.noteTerrainChange(project.x, project.y, project.size * 2);
      }
      a.needs.fatigue = Math.min(1.2, a.needs.fatigue + dt / (DAY * 1.2));
      project.progress += dt * (0.5 + a.skills.building) / project.work;
      a.skills.building = Math.min(1, a.skills.building + dt * 0.00008);
      const building = s.buildings.find(b => b.id === project.buildingId);
      if (building) building.progress = Math.min(1, project.progress);
      if (project.progress >= 1) world.completeProject(s, project);
      return;
    }
    case "dig": {
      if (!walk(world, a, dt)) return;
      const project = s.projects.find(p => p.id === task.projectId);
      if (!project || project.done) { a.task = null; return; }
      task.skill = "building";
      const slice = project.slices[task.slice];
      work(world, s, a, dt, now, 1.6, () => {
        const out = digTrench(world.field, L, slice.ax, slice.ay, slice.bx, slice.by, { width: project.width, depth: project.depth, amount: 0.55 });
        s.stats.trenchMeters += 0.55;
        task.t = 0;
        if (out.complete) {
          slice.done = true; slice.owner = null;
          world.noteTerrainChange((slice.ax + slice.bx) / 2, (slice.ay + slice.by) / 2, 50);
          if (project.slices.every(sl => sl.done)) world.completeProject(s, project);
          a.task = null;
        }
      });
      return;
    }
    case "repair": {
      if (!walk(world, a, dt)) return;
      const b = s.buildings.find(item => item.id === task.buildingId);
      if (!b || b.hp <= 0) { a.task = null; return; }
      task.skill = "building";
      if (s.storage.materials >= 0.02 * dt * 6) {
        b.hp = Math.min(b.maxHp, b.hp + dt * 5 * (0.5 + a.skills.building));
        s.storage.materials -= 0.02 * dt * 6;
      }
      if (b.hp >= b.maxHp) { b.repairing = null; a.task = null; }
      return;
    }
    case "eat": {
      if (!walk(world, a, dt)) return;
      const meal = 0.9 * FOOD_PER_DAY;
      let taken = Math.min(meal, s.storage.food);
      s.storage.food -= taken;
      if (taken < meal) { const more = Math.min(meal - taken, s.hidden.food); s.hidden.food -= more; taken += more; }
      if (taken >= meal * 0.5) { a.needs.hunger = Math.max(0, a.needs.hunger - taken / meal * 0.6); s.stats.fed = (s.stats.fed || 0) + taken; }
      a.task = null;
      return;
    }
    case "rest": {
      if (!walk(world, a, dt)) return;
      a.needs.fatigue = Math.max(0, a.needs.fatigue - dt / (DAY * 0.12));
      a.hp = Math.min(a.maxHp, a.hp + dt * 0.4);
      task.t += dt;
      if ((!isNight(now) && a.needs.fatigue < 0.15) || task.t > DAY * 0.4) a.task = null;
      return;
    }
    case "wander": {
      if (walk(world, a, dt, 0.6)) { task.t += dt; if (task.t > 0.01) a.task = null; }
      return;
    }
    case "held": {
      walk(world, a, dt, 0.3);
      return;
    }
    case "flee": {
      const arrived = walk(world, a, dt, 1.3);
      a.needs.fear = Math.max(0, a.needs.fear - dt * 0.03);
      if (task.evac && distance(a, s) > s.radius * 1.7 && a.role !== "refugee") {
        world.becomeRefugee(s, a, "fled the fighting");
        return;
      }
      if (arrived) {
        const threat = nearestThreat(s, a, PERCEIVE);
        if (!threat && a.needs.fear < 0.3) a.task = null;
        else task.path = null;
      }
      return;
    }
    case "travel": {
      if (walk(world, a, dt, 0.9)) world.refugeeArrived(s, a);
      return;
    }
    case "advance": {
      const threat = s._threats.find(t => t.id === task.targetId);
      if (!threat) { a.task = null; return; }
      // Re-aim only when the target has moved a fair way, so we aren't re-planning every frame.
      if (!task.path || Math.hypot(threat.x - task.x, threat.y - task.y) > 30) { task.x = threat.x; task.y = threat.y; task.path = null; }
      if (distance(a, threat) <= task.hold) { assign(a, "fire", threat.x, threat.y, { targetId: threat.id }); return; }
      walk(world, a, dt, 1.1);
      return;
    }
    case "fire": {
      const threat = s._threats.find(t => t.id === task.targetId);
      if (!threat || distance(a, threat) > MILITIA_RANGE * 1.1) { a.task = null; return; }
      a.facing = Math.atan2(threat.y - a.y, threat.x - a.x);
      task.t += dt;
      if (task.t >= 1.3) {
        task.t = 0;
        const hit = clamp(0.42 + a.skills.fighting * 0.35 - a.needs.fear * 0.2, 0.12, 0.85);
        if (world.random() < hit) world.hit(s, a, threat, 6 + a.skills.fighting * 6);
        a.skills.fighting = Math.min(1, a.skills.fighting + 0.002);
      }
      return;
    }
    case "guard":
    case "patrol": {
      if (walk(world, a, dt, 0.8)) { task.t += dt; if (task.t > 6 + world.random() * 6) a.task = null; else task.path = [{ x: task.x, y: task.y }], task.pi = 0; }
      return;
    }
    default:
      a.task = null;
  }
}

// ---- per-step ----------------------------------------------------------------
export function stepCitizen(world, s, a, dt, now) {
  // Needs.
  a.needs.hunger += dt / (DAY * 1.6);
  a.needs.fear = Math.max(0, a.needs.fear - dt * 0.02);
  if (a.activity !== "rest" && a.activity !== "held") a.needs.fatigue = Math.min(1.2, a.needs.fatigue + dt / (DAY * 2.2));
  if (a.needs.hunger > 1.15) {
    a.hp -= dt * 0.9 * (a.needs.hunger - 1.0);
    if (!a.starving) { a.starving = true; }
    if (a.hp <= 0) { s.stats.starved += 1; world.killAgent(a, "starved"); return; }
  } else a.starving = false;
  if (a.hp <= 0) { world.killAgent(a, "wounds"); return; }

  if (!a.task || now >= (a.thinkAt || 0)) {
    // Urgent reactions bypass the think timer.
    const urgent = a.needs.fear > 0.45 || s.posture === "siege" || s.posture === "evacuate";
    if (!a.task || urgent || a.activity === "tend" || a.activity === "wander" || a.activity === "patrol" || a.activity === "guard") {
      decide(world, s, a, now);
    }
    a.thinkAt = now + 1.1 + world.random() * 0.9;
  }
  if (a.task) perform(world, s, a, dt, now);
}

export { PERCEIVE, MILITIA_RANGE };
