const modules = globalThis.AWTModules ||= {};

  // Rendering geometry, colors, weapons, rank marks, and animation curves are
  // ported directly from ork_forge (1).html. Only the simulator adapter below
  // maps live unit/building records onto the reference roster.
  const COLORS = Object.freeze({
    primaryHex: "#416827",
    secondaryHex: "#5f3f1c",
    accentHex: "#ecb913"
  });
  const BODY_SIZES = { small: 9, medium: 12, large: 15, mega: 17, huge: 19 };

  const HUMANOIDS = Object.freeze({
    Builder: { kind: "humanoid", body: "small", weapon: "tools", helmet: true, rank: null },
    Grot: { kind: "humanoid", body: "small", weapon: "none", helmet: true, rank: null },
    Gretchin: { kind: "humanoid", body: "small", weapon: "none", helmet: true, rank: null },
    Mekboy: { kind: "humanoid", body: "medium", weapon: "tools", helmet: true, rank: "Specialist" },
    Boy: { kind: "humanoid", body: "medium", weapon: "choppa", helmet: true, rank: null },
    "Shoota Boy": { kind: "humanoid", body: "medium", weapon: "shoota", helmet: true, rank: null },
    "Slugga Boy": { kind: "humanoid", body: "medium", weapon: "slugga", helmet: true, rank: null },
    "Burna Boy": { kind: "humanoid", body: "medium", weapon: "burna", helmet: true, rank: "Specialist" },
    Tankbusta: { kind: "humanoid", body: "medium", weapon: "rokkit", helmet: true, rank: "Specialist" },
    Loota: { kind: "humanoid", body: "medium", weapon: "deffgun", helmet: true, rank: "Specialist" },
    Kommando: { kind: "humanoid", body: "medium", weapon: "knife", helmet: true, rank: "Specialist" },
    Nob: { kind: "humanoid", body: "large", weapon: "choppa", helmet: true, rank: "Sergeant" },
    "Boss Nob": { kind: "humanoid", body: "large", weapon: "choppa", helmet: true, rank: "Sergeant" },
    "Flash Git": { kind: "humanoid", body: "medium", weapon: "gold_pistol", helmet: true, rank: "Specialist" },
    Meganob: { kind: "humanoid", body: "mega", weapon: "klaw", helmet: true, rank: "Lieutenant" },
    Warboss: { kind: "humanoid", body: "huge", weapon: "big_choppa", helmet: true, rank: "Captain" },
    Weirdboy: { kind: "humanoid", body: "medium", weapon: "staff", helmet: false, rank: "Specialist" },
    Painboy: { kind: "humanoid", body: "medium", weapon: "medtool", helmet: true, rank: "Specialist" },
    "Big Mek": { kind: "humanoid", body: "large", weapon: "mega_klaw", helmet: true, rank: "Captain" },
    "Waaagh! Banner Nob": { kind: "humanoid", body: "large", weapon: "choppa", helmet: true, rank: "Sergeant" }
  });

  const VEHICLES = Object.freeze({
    Trukk: { kind: "vehicle", vshape: "trukk" },
    Battlewagon: { kind: "vehicle", vshape: "battlewagon" },
    "Deff Dread": { kind: "vehicle", vshape: "deff_dread" },
    "Killa Kan": { kind: "vehicle", vshape: "killa_kan" },
    "Looted Wagon": { kind: "vehicle", vshape: "looted_wagon" },
    "Boomdakka Snazzwagon": { kind: "vehicle", vshape: "boomdakka" },
    Scrapjet: { kind: "vehicle", vshape: "scrapjet" },
    "Rukkatrukk Squigbuggy": { kind: "vehicle", vshape: "squigbuggy" },
    Dakkajet: { kind: "vehicle", vshape: "dakkajet" },
    "Burna Bommer": { kind: "vehicle", vshape: "burna_bommer" }
  });

  const BUILDING_SHAPES = Object.freeze({
    outpost: "boss_camp",
    barracks: "boyz_hut",
    workshop: "mek_workshop",
    researchcenter: "mek_workshop",
    fieldhospital: "boyz_hut",
    generator: "generator",
    warehouse: "ammo_dump",
    fueldepot: "generator",
    ammodepot: "ammo_dump",
    mine: "scrap_yard",
    farm: "squig_pen",
    refinery: "scrap_yard",
    dropbay: "big_gunz",
    observationtower: "watch_tower",
    bunker: "waaagh_banner",
    turret: "big_gunz"
  });

  const MELEE_WEAPONS = new Set(["choppa", "big_choppa", "klaw", "mega_klaw"]);
  const WEAPON_MUZZLE = {
    shoota: { x: 1.65, y: 0 }, slugga: { x: 1.1, y: -0.15 }, deffgun: { x: 2.0, y: 0 },
    gold_pistol: { x: 1.3, y: 0 }, burna: { x: 1.9, y: 0 }, rokkit: { x: 2.0, y: -0.67 },
    knife: { x: 1.25, y: -0.15 }, staff: { x: 1.3, y: -0.9 }
  };
  const WEAPON_PROJECTILE_INFO = {
    shoota: { type: "bullet" }, slugga: { type: "bullet" }, deffgun: { type: "heavy_bullet" },
    gold_pistol: { type: "bullet" }, burna: { type: "flame" }, rokkit: { type: "rokkit" },
    knife: { type: "knife" }, staff: { type: "psybolt" }
  };
  const VEHICLE_PROJECTILE_INFO = {
    battlewagon: { type: "heavy_bullet", muzzle: { x: 14, y: 0 }, dir: { x: 1, y: 0 } },
    killa_kan: { type: "bullet", muzzle: { x: 12, y: -4 }, dir: { x: 1, y: 0 } },
    looted_wagon: { type: "bullet", muzzle: { x: 23, y: 0 }, dir: { x: 1, y: 0 } },
    boomdakka: { type: "bullet", muzzle: { x: 4, y: 0 }, dir: { x: 1, y: 0 } },
    scrapjet: { type: "bullet", muzzle: { x: 0, y: -24 }, dir: { x: 0, y: -1 } },
    dakkajet: { type: "heavy_bullet", muzzle: { x: 0, y: -24 }, dir: { x: 0, y: -1 } },
    squigbuggy: { type: "squiglob", muzzle: { x: 18, y: 0 }, dir: { x: 1, y: 0 } },
    burna_bommer: { type: "bomb", muzzle: { x: 0, y: 20 }, dir: { x: 0, y: 1 } }
  };
  const BUILDING_PROJECTILE_INFO = {
    big_gunz: { type: "shell", muzzle: { x: 22, y: 0 }, dir: { x: 1, y: 0 } },
    watch_tower: { type: "bullet", muzzle: { x: 20, y: 0 }, dir: { x: 1, y: 0 } }
  };

  function stripSerial(value) {
    return String(value || "").replace(/\s+\d+$/, "").trim();
  }

  function shade(hex, amt) {
    let c = hex.replace("#", "");
    let r = parseInt(c.substr(0, 2), 16), g = parseInt(c.substr(2, 2), 16), b = parseInt(c.substr(4, 2), 16);
    const f = value => Math.max(0, Math.min(255, Math.round(value + (amt > 0 ? (255 - value) * amt : value * amt))));
    r = f(r); g = f(g); b = f(b);
    return `rgb(${r},${g},${b})`;
  }

  function lerp(a, b, f) { return a + (b - a) * f; }
  function easeOutQuad(x) { return 1 - (1 - x) * (1 - x); }
  function easeInQuad(x) { return x * x; }

  function meleeCycle(t) {
    const T = 0.65;
    const cyc = (((t % T) + T) % T) / T;
    let swing;
    if (cyc < 0.25) swing = lerp(0, -0.9, easeOutQuad(cyc / 0.25));
    else if (cyc < 0.45) swing = lerp(-0.9, 1.3, easeInQuad((cyc - 0.25) / 0.2));
    else swing = lerp(1.3, 0, easeOutQuad((cyc - 0.45) / 0.55));
    const impact = cyc >= 0.42 && cyc < 0.55;
    const impactProgress = impact ? (cyc - 0.42) / 0.13 : 0;
    const forwardPush = cyc < 0.45 ? Math.sin((cyc / 0.45) * Math.PI) * 1.6 : 0;
    return { swing, impact, impactProgress, forwardPush, cyc };
  }

  function drawMeleeFX(ctx, size, colors, m) {
    ctx.save();
    if (m.cyc > 0.22 && m.cyc < 0.48) {
      const fade = 1 - Math.max(0, (m.cyc - 0.38)) / 0.10;
      ctx.strokeStyle = `rgba(255,255,255,${(0.55 * Math.max(0, Math.min(1, fade))).toFixed(3)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(size * 0.3, 0, size * 1.7, -1.1, 0.9, false);
      ctx.stroke();
    }
    if (m.impact) {
      const a = 1 - m.impactProgress;
      const sparkX = size * 1.75, sparkY = 0;
      for (let i = 0; i < 5; i += 1) {
        const ang = (i / 5) * Math.PI * 2 + m.impactProgress * 3;
        const len = size * 0.5 * (1 + m.impactProgress * 1.5);
        ctx.strokeStyle = `rgba(255,244,200,${a.toFixed(3)})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(sparkX, sparkY);
        ctx.lineTo(sparkX + Math.cos(ang) * len, sparkY + Math.sin(ang) * len);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function seededRandom(i) { const x = Math.sin(i * 999.7) * 43758.5453; return x - Math.floor(x); }

  function fireCycle(t, T, flightFrac) {
    const age = ((t % T) + T) % T;
    const flightDur = T * flightFrac;
    if (age < flightDur) return { phase: "flight", frac: age / flightDur };
    if (age < flightDur + 0.35) return { phase: "impact", frac: (age - flightDur) / 0.35 };
    return { phase: "none", frac: 0 };
  }

  function drawProjectiles(ctx, t, info, muzzle, dir, size) {
    if (!info) return;
    ctx.save();
    switch (info.type) {
      case "bullet":
      case "heavy_bullet": {
        const heavy = info.type === "heavy_bullet";
        const maxDist = heavy ? 170 : 150;
        const n = heavy ? 4 : 3;
        const cycles = t * (heavy ? 3.4 : 2.6);
        const flash = (cycles * n) % 1;
        if (flash < 0.15) {
          ctx.fillStyle = "rgba(255,244,200,0.95)";
          ctx.beginPath(); ctx.arc(muzzle.x, muzzle.y, size * (heavy ? 0.4 : 0.3), 0, Math.PI * 2); ctx.fill();
        }
        for (let i = 0; i < n; i += 1) {
          const frac = (cycles + i / n) % 1;
          const dist = frac * maxDist;
          const px = muzzle.x + dir.x * dist, py = muzzle.y + dir.y * dist;
          const alpha = 1 - frac * 0.85;
          ctx.strokeStyle = heavy ? `rgba(255,200,110,${alpha})` : `rgba(255,244,200,${alpha})`;
          ctx.lineWidth = heavy ? 2.2 : 1.4;
          ctx.beginPath(); ctx.moveTo(px - dir.x * 6, py - dir.y * 6); ctx.lineTo(px, py); ctx.stroke();
        }
        break;
      }
      case "flame": {
        const maxDist = size * 3.4;
        for (let i = 0; i < 9; i += 1) {
          const speed = 2.6 + (i % 3) * 0.4;
          const frac = ((t * speed) + i * 0.11) % 1;
          const spread = (seededRandom(i) - 0.5) * 0.9;
          const ang = Math.atan2(dir.y, dir.x) + spread * frac;
          const dist = frac * maxDist;
          const px = muzzle.x + Math.cos(ang) * dist, py = muzzle.y + Math.sin(ang) * dist;
          const alpha = 1 - frac;
          const rad = size * 0.28 * (1 - frac * 0.3);
          const grad = ctx.createRadialGradient(px, py, 0, px, py, Math.max(rad, 0.1));
          grad.addColorStop(0, `rgba(255,240,150,${alpha})`);
          grad.addColorStop(0.5, `rgba(255,120,40,${alpha * 0.8})`);
          grad.addColorStop(1, "rgba(180,30,10,0)");
          ctx.fillStyle = grad;
          ctx.beginPath(); ctx.arc(px, py, Math.max(rad, 0.1), 0, Math.PI * 2); ctx.fill();
        }
        break;
      }
      case "rokkit": case "bomb": case "squiglob": case "knife": case "psybolt": case "shell": {
        const type = info.type;
        const T = type === "bomb" ? 1.3 : type === "knife" ? 0.9 : type === "shell" ? 1.8 : 1.6;
        const maxDist = type === "bomb" ? 50 : type === "shell" ? 190 : 150;
        const fc = fireCycle(t, T, 0.6);
        if (fc.phase === "flight") {
          let px, py;
          if (type === "bomb") {
            const f2 = fc.frac * fc.frac;
            px = muzzle.x + dir.x * maxDist * f2; py = muzzle.y + dir.y * maxDist * f2;
          } else if (type === "squiglob") {
            px = muzzle.x + dir.x * maxDist * fc.frac;
            py = muzzle.y + dir.y * maxDist * fc.frac - Math.sin(fc.frac * Math.PI) * 24;
          } else {
            px = muzzle.x + dir.x * maxDist * fc.frac; py = muzzle.y + dir.y * maxDist * fc.frac;
          }
          if (type === "rokkit" || type === "bomb" || type === "shell") {
            for (let s = 1; s <= 3; s += 1) {
              const bf = Math.max(0, fc.frac - s * 0.06);
              const bx = muzzle.x + dir.x * maxDist * bf, by = muzzle.y + dir.y * maxDist * bf;
              ctx.fillStyle = `rgba(180,180,180,${0.32 - (s * 0.09)})`;
              ctx.beginPath(); ctx.arc(bx, by, size * 0.22, 0, Math.PI * 2); ctx.fill();
            }
          }
          ctx.save(); ctx.translate(px, py);
          if (type === "rokkit") {
            ctx.rotate(Math.atan2(dir.y, dir.x)); ctx.fillStyle = "#8a8a8a"; ctx.fillRect(-6, -2.4, 12, 4.8);
            ctx.fillStyle = "#e8622a"; ctx.beginPath(); ctx.arc(-6, 0, 2.4, 0, Math.PI * 2); ctx.fill();
          } else if (type === "shell") {
            ctx.rotate(Math.atan2(dir.y, dir.x)); ctx.fillStyle = "#4a4a4a"; ctx.beginPath(); ctx.ellipse(0, 0, 7, 3.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#111"; ctx.lineWidth = 0.8; ctx.stroke();
          } else if (type === "bomb") {
            const scale = 0.6 + fc.frac * 0.9; ctx.fillStyle = "#333"; ctx.beginPath(); ctx.ellipse(0, 0, 3.4 * scale, 5 * scale, 0, 0, Math.PI * 2); ctx.fill();
          } else if (type === "squiglob") {
            ctx.fillStyle = "#8fae3c"; ctx.beginPath(); ctx.arc(0, 0, 4 + Math.sin(fc.frac * 20) * 0.8, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#4c5f22"; ctx.lineWidth = 1; ctx.stroke();
          } else if (type === "knife") {
            ctx.rotate(fc.frac * Math.PI * 4); ctx.fillStyle = "#c9c9c9"; ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(6, -2); ctx.lineTo(6, 2); ctx.closePath(); ctx.fill();
          } else if (type === "psybolt") {
            const rad = 4 + Math.sin(t * 20);
            const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, rad * 2.2);
            grad.addColorStop(0, "rgba(200,255,160,0.95)"); grad.addColorStop(1, "rgba(120,220,90,0)");
            ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(0, 0, rad * 2.2, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#c9ffb0"; ctx.beginPath(); ctx.arc(0, 0, rad * 0.5, 0, Math.PI * 2); ctx.fill();
          }
          ctx.restore();
        } else if (fc.phase === "impact") {
          const ix = muzzle.x + dir.x * maxDist, iy = muzzle.y + dir.y * maxDist;
          const bigness = type === "bomb" ? 26 : type === "shell" ? 32 : 18;
          const rad = fc.frac * bigness;
          const alpha = 1 - fc.frac;
          ctx.strokeStyle = `rgba(255,180,80,${alpha})`; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(ix, iy, rad, 0, Math.PI * 2); ctx.stroke();
          ctx.fillStyle = `rgba(255,120,40,${alpha * 0.6})`; ctx.beginPath(); ctx.arc(ix, iy, rad * 0.5, 0, Math.PI * 2); ctx.fill();
        }
        break;
      }
      default: break;
    }
    ctx.restore();
  }

  function animParams(animState, t) {
    let bob = 0, sway = 0, legPhase = 0, fallAngle = 0, opacity = 1, forwardShift = 0;
    if (animState === "idle") {
      bob = Math.sin(t * 2.2) * 1.2;
      sway = Math.sin(t * 1.1) * 0.04;
    } else if (animState === "walk") {
      bob = Math.abs(Math.sin(t * 6)) * 1.8;
      legPhase = t * 6;
      sway = Math.sin(t * 6) * 0.09;
    } else if (animState === "run") {
      bob = Math.abs(Math.sin(t * 10.5)) * 2.6;
      legPhase = t * 10.5;
      sway = Math.sin(t * 10.5) * 0.14;
      forwardShift = Math.sin(t * 10.5) * 1.5;
    } else if (animState === "death") {
      const dt = Math.min(t / 0.9, 1);
      const ease = 1 - Math.pow(1 - dt, 3);
      fallAngle = ease * 95;
      opacity = 1 - ease * 0.35;
      bob = ease * 3;
    } else if (animState === "shoot") {
      bob = Math.sin(t * 20) * 0.35;
      sway = Math.sin(t * 7) * 0.015;
    }
    return { bob, sway, legPhase, fallAngle, opacity, forwardShift };
  }

  function drawWeapon(ctx, weapon, size, colors, t, animState, extraRot = 0) {
    const wobble = ((animState === "walk" || animState === "run") ? Math.sin(t * 8) * 0.05 : 0) + extraRot;
    ctx.save();
    ctx.rotate(wobble);
    ctx.strokeStyle = "#0c0c08";
    ctx.lineWidth = 1.2;
    const gold = "#d4af37";
    switch (weapon) {
      case "choppa":
        ctx.fillStyle = "#8b8b8b";
        ctx.beginPath();
        ctx.moveTo(size * 0.7, size * 0.1);
        ctx.lineTo(size * 1.5, -size * 0.3);
        ctx.lineTo(size * 1.35, size * 0.05);
        ctx.lineTo(size * 1.6, size * 0.35);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        break;
      case "big_choppa":
        ctx.fillStyle = "#9a9a9a";
        ctx.beginPath();
        ctx.moveTo(size * 0.6, size * 0.15);
        ctx.lineTo(size * 1.9, -size * 0.55);
        ctx.lineTo(size * 1.65, size * 0.05);
        ctx.lineTo(size * 2.0, size * 0.55);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        break;
      case "klaw":
      case "mega_klaw":
        ctx.fillStyle = "#6f6f6f";
        ctx.beginPath();
        ctx.ellipse(size * 1.15, 0, size * 0.55, size * 0.32, 0.3, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(size * 1.5, -size * 0.2); ctx.lineTo(size * 1.9, -size * 0.05); ctx.lineTo(size * 1.5, size * 0.1); ctx.fill();
        break;
      case "shoota":
        ctx.fillStyle = "#4a4a4a";
        ctx.fillRect(size * 0.55, -size * 0.14, size * 1.1, size * 0.24);
        ctx.strokeRect(size * 0.55, -size * 0.14, size * 1.1, size * 0.24);
        break;
      case "slugga":
        ctx.fillStyle = "#4a4a4a";
        ctx.fillRect(size * 0.6, -size * 0.1, size * 0.5, size * 0.18);
        ctx.fillStyle = "#8b8b8b";
        ctx.beginPath(); ctx.moveTo(size * 0.5, size * 0.15); ctx.lineTo(size * 1.1, -size * 0.15); ctx.lineTo(size * 1.0, size * 0.05); ctx.lineTo(size * 1.2, size * 0.3); ctx.closePath(); ctx.fill();
        break;
      case "burna":
        ctx.fillStyle = "#4a4a4a";
        ctx.fillRect(size * 0.55, -size * 0.16, size * 0.9, size * 0.28);
        ctx.fillStyle = "#e8622a";
        ctx.beginPath(); ctx.moveTo(size * 1.45, 0); ctx.lineTo(size * 1.75, -size * 0.2); ctx.lineTo(size * 1.9, 0); ctx.lineTo(size * 1.75, size * 0.2); ctx.closePath(); ctx.fill();
        break;
      case "rokkit":
        ctx.fillStyle = "#4a4a4a";
        ctx.fillRect(size * 0.5, -size * 0.85, size * 1.5, size * 0.36);
        ctx.strokeRect(size * 0.5, -size * 0.85, size * 1.5, size * 0.36);
        ctx.fillStyle = "#3a3a3a";
        ctx.beginPath(); ctx.arc(size * 2.0, -size * 0.67, size * 0.18, 0, Math.PI * 2); ctx.fill();
        break;
      case "deffgun":
        ctx.fillStyle = "#3f3f3f";
        ctx.fillRect(size * 0.5, -size * 0.22, size * 1.5, size * 0.4);
        ctx.strokeRect(size * 0.5, -size * 0.22, size * 1.5, size * 0.4);
        break;
      case "knife":
        ctx.fillStyle = "#c9c9c9";
        ctx.beginPath(); ctx.moveTo(size * 0.7, size * 0.1); ctx.lineTo(size * 1.25, -size * 0.15); ctx.lineTo(size * 1.1, size * 0.02); ctx.closePath(); ctx.fill(); ctx.stroke();
        break;
      case "gold_pistol":
        ctx.fillStyle = gold;
        ctx.fillRect(size * 0.6, -size * 0.12, size * 0.7, size * 0.2);
        ctx.strokeRect(size * 0.6, -size * 0.12, size * 0.7, size * 0.2);
        break;
      case "staff":
        ctx.strokeStyle = "#5a4a3a"; ctx.lineWidth = size * 0.14;
        ctx.beginPath(); ctx.moveTo(0, size * 0.3); ctx.lineTo(size * 1.3, -size * 0.9); ctx.stroke();
        ctx.fillStyle = "rgba(120,220,90,0.85)";
        ctx.beginPath(); ctx.arc(size * 1.3, -size * 0.9, size * 0.28 + Math.sin(t * 4) * 1.2, 0, Math.PI * 2); ctx.fill();
        break;
      case "medtool":
        ctx.fillStyle = "#c23b2c";
        ctx.fillRect(size * 0.55, -size * 0.3, size * 0.5, size * 0.5);
        ctx.strokeRect(size * 0.55, -size * 0.3, size * 0.5, size * 0.5);
        ctx.strokeStyle = "#fff"; ctx.lineWidth = size * 0.08;
        ctx.beginPath();
        ctx.moveTo(size * 0.8, -size * 0.22); ctx.lineTo(size * 0.8, size * 0.12);
        ctx.moveTo(size * 0.63, -size * 0.05); ctx.lineTo(size * 0.97, -size * 0.05);
        ctx.stroke();
        break;
      case "tools":
        ctx.strokeStyle = "#8b8b8b"; ctx.lineWidth = size * 0.16; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(size * 0.5, size * 0.2); ctx.lineTo(size * 1.3, -size * 0.4); ctx.stroke();
        ctx.fillStyle = "#8b8b8b";
        ctx.beginPath(); ctx.arc(size * 1.35, -size * 0.45, size * 0.22, 0, Math.PI * 2); ctx.fill();
        break;
      default: break;
    }
    ctx.restore();
  }

  function drawRankMarks(ctx, rank, size, colors) {
    const gold = colors.accentHex;
    ctx.save();
    ctx.fillStyle = "#000";
    ctx.strokeStyle = gold;
    ctx.lineWidth = 1.2;
    const chevY = -size * 1.05;
    function chevron(offsetY) {
      ctx.beginPath();
      ctx.moveTo(-size * 0.22, chevY + offsetY);
      ctx.lineTo(0, chevY + offsetY - size * 0.16);
      ctx.lineTo(size * 0.22, chevY + offsetY);
      ctx.stroke();
    }
    if (rank === "Sergeant") chevron(0);
    else if (rank === "Lieutenant") { chevron(0); chevron(size * 0.18); }
    else if (rank === "Captain") { chevron(0); chevron(size * 0.18); chevron(size * 0.36); }
    else if (rank === "Specialist") {
      ctx.fillStyle = gold;
      const cx = 0, cy = chevY, r1 = size * 0.16, r2 = size * 0.07;
      ctx.beginPath();
      for (let i = 0; i < 10; i += 1) {
        const ang = Math.PI / 5 * i - Math.PI / 2;
        const rr = i % 2 === 0 ? r1 : r2;
        const x = cx + Math.cos(ang) * rr, y = cy + Math.sin(ang) * rr;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  function drawHumanoid(ctx, cx, cy, unit, colors, animState, t) {
    const size = BODY_SIZES[unit.body] || 12;
    const isLeader = !!unit.rank;
    const primary = isLeader ? colors.accentHex : colors.primaryHex;
    const secondary = colors.secondaryHex;
    const p = animParams(animState, t);
    const meleeInfo = animState === "melee" && MELEE_WEAPONS.has(unit.weapon) ? meleeCycle(t) : null;

    ctx.save();
    ctx.translate(cx + (meleeInfo ? meleeInfo.forwardPush : 0), cy + p.bob + p.forwardShift * 0);
    ctx.rotate(p.sway + (p.fallAngle * Math.PI / 180));
    ctx.globalAlpha *= p.opacity;

    ctx.save();
    ctx.globalAlpha *= 0.35;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(1.5, 3, size * 0.95, size * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (animState === "walk" || animState === "run") {
      const legSwing = Math.sin(p.legPhase) * size * 0.5;
      ctx.fillStyle = shade(secondary, -0.3);
      ctx.beginPath(); ctx.ellipse(-size * 0.32, legSwing * 0.5, size * 0.22, size * 0.4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(size * 0.32, -legSwing * 0.5, size * 0.22, size * 0.4, 0, 0, Math.PI * 2); ctx.fill();
    }

    ctx.fillStyle = primary;
    ctx.strokeStyle = "#0c0c08";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(0, 0, size, size * 0.82, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    ctx.fillStyle = secondary;
    const padSize = size * 0.42;
    [-1, 1].forEach(dir => {
      ctx.beginPath();
      ctx.ellipse(dir * size * 0.72, -size * 0.05, padSize, padSize * 0.85, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    });
    if (unit.body === "mega" || unit.body === "huge" || unit.body === "large") {
      ctx.fillStyle = shade(secondary, -0.15);
      ctx.beginPath();
      ctx.ellipse(0, size * 0.05, size * 0.55, size * 0.42, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    }

    const headR = size * 0.46;
    ctx.beginPath();
    ctx.arc(0, -size * 0.02, headR, 0, Math.PI * 2);
    if (unit.helmet) {
      ctx.fillStyle = secondary;
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = shade(primary, -0.2);
      ctx.beginPath();
      ctx.arc(0, -size * 0.02, headR * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#000";
      ctx.beginPath(); ctx.arc(headR * 0.6, -size * 0.3, 1.1, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = shade(secondary, -0.35);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = shade(primary, 0.15);
      ctx.beginPath(); ctx.arc(0, 0, headR * 0.5, 0, Math.PI * 2); ctx.fill();
    }

    drawWeapon(ctx, unit.weapon, size, colors, t, animState, meleeInfo ? meleeInfo.swing : 0);
    if (meleeInfo) drawMeleeFX(ctx, size, colors, meleeInfo);
    if (animState === "shoot") {
      const info = WEAPON_PROJECTILE_INFO[unit.weapon];
      const off = WEAPON_MUZZLE[unit.weapon];
      if (info && off) {
        const wobble = Math.sin(t * 8) * 0.03;
        ctx.save();
        ctx.rotate(wobble);
        drawProjectiles(ctx, t, info, { x: size * off.x, y: size * off.y }, { x: 1, y: 0 }, size);
        ctx.restore();
      }
    }
    if (isLeader) drawRankMarks(ctx, unit.rank, size, colors);
    ctx.restore();
  }

  function drawVehicle(ctx, cx, cy, unit, colors, animState, t) {
    const primary = colors.primaryHex;
    const secondary = colors.secondaryHex;
    const p = animParams(animState, t);
    const isAir = ["scrapjet", "dakkajet", "burna_bommer"].includes(unit.vshape);
    ctx.save();
    ctx.translate(cx, cy + (isAir ? Math.sin(t * 2) * 1.5 : 0));
    ctx.rotate(p.sway * 0.4 + (p.fallAngle * Math.PI / 180 * 0.4));
    ctx.globalAlpha *= p.opacity;
    ctx.save(); ctx.globalAlpha *= 0.35; ctx.fillStyle = "#000";
    ctx.beginPath(); ctx.ellipse(2, 4, 26, 17, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    const trackOffset = (t * (animState === "run" ? 26 : animState === "walk" ? 14 : 2)) % 8;

    function tracks(w, h) {
      ctx.fillStyle = "#222";
      [-1, 1].forEach(side => {
        ctx.fillRect(-w / 2, side * h / 2 - 3, w, 6);
        ctx.save();
        ctx.beginPath(); ctx.rect(-w / 2, side * h / 2 - 3, w, 6); ctx.clip();
        ctx.strokeStyle = "#555"; ctx.lineWidth = 1;
        for (let i = -w; i < w * 2; i += 8) {
          ctx.beginPath(); ctx.moveTo(i + trackOffset, side * h / 2 - 3); ctx.lineTo(i + trackOffset, side * h / 2 + 3); ctx.stroke();
        }
        ctx.restore();
      });
    }
    function wheels(positions) {
      ctx.fillStyle = "#1c1c1c";
      positions.forEach(([x, y]) => {
        ctx.save(); ctx.translate(x, y); ctx.rotate(trackOffset * 0.6);
        ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#555"; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(4, 0); ctx.moveTo(0, -4); ctx.lineTo(0, 4); ctx.stroke();
        ctx.restore();
      });
    }
    function hull(points, fill) {
      ctx.beginPath();
      ctx.fillStyle = fill; ctx.strokeStyle = "#0c0c08"; ctx.lineWidth = 1.4;
      ctx.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i][0], points[i][1]);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }

    switch (unit.vshape) {
      case "trukk":
        tracks(58, 34); wheels([[-20, -15], [0, -15], [20, -15], [-20, 15], [0, 15], [20, 15]]);
        hull([[-30, -15], [24, -18], [32, -6], [32, 6], [24, 18], [-30, 15]], primary);
        hull([[-26, -10], [10, -12], [10, 12], [-26, 10]], secondary);
        break;
      case "battlewagon":
        tracks(64, 38); wheels([[-22, -17], [0, -17], [22, -17], [-22, 17], [0, 17], [22, 17]]);
        hull([[-34, -17], [28, -20], [36, 0], [28, 20], [-34, 17]], primary);
        ctx.fillStyle = secondary; ctx.beginPath(); ctx.arc(-6, 0, 11, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.save(); ctx.translate(-6, 0); ctx.rotate(Math.sin(t * 1.4) * 0.5);
        ctx.fillStyle = "#333"; ctx.fillRect(0, -2.5, 20, 5); ctx.restore();
        break;
      case "deff_dread": {
        const legPh = Math.sin(t * (animState === "run" ? 7 : animState === "walk" ? 4 : 1.4)) * 6;
        ctx.fillStyle = "#333";
        [[-14, -14 + legPh], [14, 14 - legPh], [-14, 14 - legPh], [14, -14 + legPh]].forEach(([x, y]) => {
          ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill();
        });
        hull([[-16, -16], [16, -16], [20, 0], [16, 16], [-16, 16], [-20, 0]], primary);
        ctx.fillStyle = secondary; ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        const dm = animState === "melee" ? meleeCycle(t) : null;
        const armSwing = dm ? dm.swing * 0.6 : 0;
        ctx.fillStyle = "#555";
        ctx.save(); ctx.translate(-14, -16); ctx.rotate(0.4 + armSwing); ctx.beginPath(); ctx.ellipse(0, 0, 7, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        ctx.save(); ctx.translate(14, 16); ctx.rotate(0.4 + Math.PI + armSwing); ctx.beginPath(); ctx.ellipse(0, 0, 7, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        if (dm) drawMeleeFX(ctx, 16, colors, dm);
        break;
      }
      case "killa_kan": {
        const legPh = Math.sin(t * (animState === "run" ? 9 : animState === "walk" ? 5 : 1.6)) * 3;
        ctx.fillStyle = "#333"; ctx.beginPath(); ctx.arc(0, 10 + legPh, 3, 0, Math.PI * 2); ctx.fill();
        hull([[-10, -10], [10, -10], [13, 0], [10, 10], [-10, 10], [-13, 0]], primary);
        ctx.fillStyle = secondary; ctx.beginPath(); ctx.arc(0, -1, 5.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#555"; ctx.beginPath(); ctx.ellipse(9, -4, 5, 3, 0.3, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case "looted_wagon":
        tracks(56, 32); wheels([[-18, -13], [6, -13], [22, -13], [-18, 13], [6, 13], [22, 13]]);
        hull([[-28, -13], [10, -16], [30, -8], [30, 8], [10, 16], [-28, 13]], primary);
        ctx.fillStyle = shade(secondary, 0.2); ctx.beginPath(); ctx.rect(-24, -9, 18, 18); ctx.fill(); ctx.stroke();
        ctx.fillStyle = secondary; ctx.beginPath(); ctx.arc(16, 0, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        break;
      case "boomdakka":
        wheels([[-16, -14], [16, -14], [-16, 14], [16, 14]]);
        hull([[-22, -13], [18, -15], [26, 0], [18, 15], [-22, 13]], primary);
        ctx.fillStyle = "#e8622a";
        for (let i = 0; i < 3; i += 1) {
          ctx.globalAlpha = p.opacity * (0.6 - i * 0.15);
          ctx.beginPath(); ctx.ellipse(-26 - i * 5, 0, 4, 3, 0, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = p.opacity; ctx.fillStyle = secondary; ctx.fillRect(-10, -6, 14, 12); ctx.strokeRect(-10, -6, 14, 12);
        break;
      case "scrapjet":
        hull([[-6, -26], [6, -26], [8, 10], [22, 20], [18, 24], [0, 16], [-18, 24], [-22, 20], [-8, 10]], primary);
        ctx.fillStyle = secondary; ctx.beginPath(); ctx.ellipse(0, -8, 5, 10, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        break;
      case "squigbuggy":
        wheels([[-15, -13], [15, -13], [-15, 13], [15, 13]]);
        hull([[-20, -12], [16, -14], [24, 0], [16, 14], [-20, 12]], primary);
        ctx.fillStyle = "#8fae3c"; ctx.beginPath(); ctx.arc(18, 0, 7 + Math.sin(t * 5) * 1.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = secondary; ctx.fillRect(-10, -6, 12, 12); ctx.strokeRect(-10, -6, 12, 12);
        break;
      case "dakkajet":
        hull([[-5, -28], [5, -28], [7, 8], [26, 18], [26, 24], [6, 16], [-6, 16], [-26, 24], [-26, 18], [-7, 8]], primary);
        ctx.fillStyle = secondary; ctx.beginPath(); ctx.ellipse(0, -10, 4.5, 11, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#333"; ctx.fillRect(2, -24, 2, 10); ctx.fillRect(-4, -24, 2, 10);
        break;
      case "burna_bommer":
        hull([[-7, -30], [7, -30], [9, 14], [30, 22], [30, 28], [8, 20], [-8, 20], [-30, 28], [-30, 22], [-9, 14]], primary);
        ctx.fillStyle = secondary; ctx.beginPath(); ctx.ellipse(0, -6, 6, 16, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#e8622a"; ctx.beginPath(); ctx.ellipse(0, 22, 4, 6, 0, 0, Math.PI * 2); ctx.fill();
        break;
      default: break;
    }
    if (animState === "shoot") {
      const info = VEHICLE_PROJECTILE_INFO[unit.vshape];
      if (info) drawProjectiles(ctx, t, info, info.muzzle, info.dir, 14);
    }
    ctx.restore();
  }

  function drawBuilding(ctx, cx, cy, unit, colors, animState, t) {
    const primary = colors.primaryHex;
    const secondary = colors.secondaryHex;
    const destroyed = animState === "death";
    const dt = destroyed ? Math.min(t / 1.0, 1) : 0;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.globalAlpha *= destroyed ? (1 - dt * 0.15) : 1;
    ctx.save(); ctx.globalAlpha *= 0.3; ctx.fillStyle = "#000";
    ctx.beginPath(); ctx.ellipse(2, 4, 34, 22, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();

    function base(points, fill) {
      ctx.beginPath();
      ctx.fillStyle = destroyed ? shade(fill, -0.35 * dt) : fill;
      ctx.strokeStyle = "#0c0c08"; ctx.lineWidth = 1.6;
      ctx.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i][0], points[i][1]);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    function smoke(x, y, intensity = 1) {
      for (let i = 0; i < 3; i += 1) {
        const life = ((t * 0.6) + i * 0.33) % 1;
        ctx.globalAlpha = (1 - life) * 0.4 * intensity * (destroyed ? 1 : 0.7);
        ctx.fillStyle = destroyed ? "#333" : "#888";
        ctx.beginPath(); ctx.arc(x + Math.sin(t + i) * 2, y - life * 22, 3 + life * 6, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = destroyed ? (1 - dt * 0.15) : 1;
    }

    switch (unit.shape) {
      case "boss_camp":
        base([[-34, -6], [-10, -22], [10, -22], [34, -6], [26, 20], [-26, 20]], primary);
        ctx.fillStyle = secondary; ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(-8, -6); ctx.lineTo(8, -6); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#e8e2c8"; [-24, 24].forEach(x => { ctx.beginPath(); ctx.arc(x, 4, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); });
        break;
      case "mek_workshop":
        base([[-30, -16], [30, -16], [30, 16], [-30, 16]], primary);
        ctx.fillStyle = secondary; ctx.fillRect(-30, -16, 60, 8); ctx.strokeRect(-30, -16, 60, 8);
        ctx.save(); ctx.translate(20, -16); ctx.rotate(Math.sin(t * 1.5) * 0.4 - 0.3);
        ctx.strokeStyle = "#555"; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(22, -4); ctx.stroke();
        ctx.fillStyle = "#333"; ctx.beginPath(); ctx.arc(22, -4, 2.5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        smoke(-18, -16, 0.6);
        break;
      case "boyz_hut":
        base([[-24, -4], [0, -20], [24, -4], [24, 18], [-24, 18]], secondary);
        ctx.fillStyle = primary; ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(-26, -2); ctx.lineTo(26, -2); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = "#0c0c08"; ctx.lineWidth = 1;
        for (let i = 0; i < 4; i += 1) { ctx.beginPath(); ctx.moveTo(-16 + i * 10, 10); ctx.lineTo(-13 + i * 10, 16); ctx.stroke(); }
        break;
      case "scrap_yard":
        for (let i = 0; i < 6; i += 1) {
          const ang = i * 1.05, rr = 14 + ((i % 3) * 6);
          ctx.save(); ctx.translate(Math.cos(ang) * rr * 0.9, Math.sin(ang) * rr * 0.5); ctx.rotate(ang);
          ctx.fillStyle = i % 2 ? secondary : shade(primary, -0.1);
          ctx.fillRect(-6, -6, 12, 12); ctx.strokeStyle = "#0c0c08"; ctx.strokeRect(-6, -6, 12, 12); ctx.restore();
        }
        break;
      case "generator":
        base([[-18, -18], [18, -18], [18, 18], [-18, 18]], secondary);
        ctx.save(); ctx.rotate(t * (destroyed ? 0.4 : 3)); ctx.strokeStyle = primary; ctx.lineWidth = 3;
        for (let i = 0; i < 4; i += 1) { ctx.save(); ctx.rotate(i * Math.PI / 2); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -13); ctx.stroke(); ctx.restore(); }
        ctx.restore(); ctx.fillStyle = primary; ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill(); smoke(16, -18, 0.5);
        break;
      case "squig_pen":
        ctx.strokeStyle = secondary; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, 0, 30, 18, 0, 0, Math.PI * 2); ctx.stroke();
        for (let i = 0; i < 8; i += 1) { const a = i * Math.PI / 4; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 30, Math.sin(a) * 18); ctx.lineTo(Math.cos(a) * 30, Math.sin(a) * 18 - 6); ctx.stroke(); }
        ctx.fillStyle = primary;
        for (let i = 0; i < 3; i += 1) { const bx = Math.sin(t * 3 + i * 2) * 14, by = Math.cos(t * 2 + i) * 7; ctx.beginPath(); ctx.arc(bx, by, 4 + Math.sin(t * 6 + i), 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
        break;
      case "ammo_dump":
        [[-14, -6], [6, -6], [-4, 6], [16, 6]].forEach(([x, y], i) => { ctx.save(); ctx.translate(x, y); ctx.fillStyle = i % 2 ? secondary : shade(secondary, 0.15); ctx.fillRect(-9, -7, 18, 14); ctx.strokeStyle = "#0c0c08"; ctx.strokeRect(-9, -7, 18, 14); ctx.restore(); });
        ctx.fillStyle = primary; ctx.beginPath(); ctx.arc(-4, -6, 3, 0, Math.PI * 2); ctx.fill();
        break;
      case "waaagh_banner": {
        ctx.strokeStyle = secondary; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 20); ctx.lineTo(0, -26); ctx.stroke();
        ctx.save(); ctx.translate(0, -24); const flap = Math.sin(t * 4) * 0.25; ctx.transform(1, 0, flap, 1, 0, 0);
        ctx.fillStyle = primary; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(26, -2); ctx.lineTo(20, 8); ctx.lineTo(0, 10); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
        break;
      }
      case "watch_tower":
        base([[-12, -12], [12, -12], [12, 12], [-12, 12]], secondary);
        ctx.fillStyle = primary; ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.save(); ctx.rotate(t * (destroyed ? 0.2 : 1.2)); ctx.strokeStyle = "rgba(232,185,35,0.5)"; ctx.lineWidth = 6; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(26, 0); ctx.stroke(); ctx.restore();
        break;
      case "big_gunz":
        base([[-16, -16], [16, -16], [16, 16], [-16, 16]], secondary);
        ctx.save(); ctx.rotate(Math.sin(t * 0.8) * 0.5); ctx.fillStyle = primary; ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#333"; ctx.fillRect(0, -3, 26, 6); ctx.strokeRect(0, -3, 26, 6); ctx.restore();
        break;
      default: break;
    }

    if (animState === "shoot") {
      const info = BUILDING_PROJECTILE_INFO[unit.shape];
      if (info) drawProjectiles(ctx, t, info, info.muzzle, info.dir, 14);
    }

    if (destroyed && dt > 0.15) {
      ctx.globalAlpha = Math.min((dt - 0.15) * 1.5, 0.8);
      ctx.fillStyle = "#e8622a";
      for (let i = 0; i < 4; i += 1) {
        const life = ((t * 1.3) + i * 0.27) % 1;
        ctx.globalAlpha = (1 - life) * 0.5;
        ctx.beginPath(); ctx.arc(Math.sin(i * 2) * 10, Math.cos(i * 3) * 6 - life * 18, 2.5 + life * 4, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }

  function animationFor(unit) {
    if (unit.alive === false || unit.incapacitated) return "death";
    const status = `${unit.status || ""} ${unit.combatIntent || ""}`;
    const profile = HUMANOIDS[stripSerial(unit.name)] || VEHICLES[stripSerial(unit.name)];
    if (/melee|charge|closing|pursu/i.test(status) && (profile?.vshape === "deff_dread" || MELEE_WEAPONS.has(profile?.weapon))) return "melee";
    if (/fir|shoot|engag|attack|suppress/i.test(status)) return "shoot";
    if (/run|retreat|flee|withdraw|rush/i.test(status)) return "run";
    if (/mov|advanc|respond|patrol|escort|return|regroup|construct|gather|repair/i.test(status)) return "walk";
    return "idle";
  }

  function animationTime(unit, animState, time) {
    if (animState !== "death") return time;
    const startedAt = unit.deathStartedAt ?? unit.incapacitatedAt ?? time;
    return Math.max(0, time - startedAt);
  }

  export const orkSpriteForge = Object.freeze({
    source: "ork_forge (1).html",
    colors: COLORS,
    drawUnit(ctx, unit, time = 0) {
      const name = stripSerial(unit.name);
      const profile = HUMANOIDS[name] || VEHICLES[name];
      if (!profile) return false;
      const animState = animationFor(unit);
      const localTime = animationTime(unit, animState, time);
      if (profile.kind === "humanoid") drawHumanoid(ctx, 0, 0, profile, COLORS, animState, localTime);
      else drawVehicle(ctx, 0, 0, profile, COLORS, animState, localTime);
      return true;
    },
    drawStructure(ctx, structure, time = 0) {
      const shape = BUILDING_SHAPES[structure.type];
      if (!shape) return false;
      const destroyed = structure.alive === false;
      const localTime = destroyed ? Math.max(0, time - (structure.destroyedAt ?? time)) : time;
      ctx.save();
      if (!destroyed) {
        const progress = Math.max(0.08, Math.min(1, structure.progress ?? 1));
        ctx.scale(progress, progress);
      }
      drawBuilding(ctx, 0, 0, { kind: "building", shape }, COLORS, destroyed ? "death" : "idle", localTime);
      ctx.restore();
      return true;
    },
    hasUnit(name) {
      const clean = stripSerial(name);
      return Boolean(HUMANOIDS[clean] || VEHICLES[clean]);
    }
  });

modules.orkSpriteForge = orkSpriteForge;
export default orkSpriteForge;
