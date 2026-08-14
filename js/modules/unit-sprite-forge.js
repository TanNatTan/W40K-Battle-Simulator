import { orkSpriteForge } from "./ork-sprite-forge.js";
import { drawMarineInfantry, hasMarineInfantryModel } from "../../src/rendering/MarineInfantryRenderer.js";

const modules = globalThis.AWTModules ||= {};

  const stripSerial = value => String(value || "").replace(/\s+\d+$/, "").trim();
  const marineProfiles = {
    Servitor: ["builder", "tool"], "Scout Marine": ["light", "bolter"], "Tactical Marine": ["marine", "bolter"],
    Intercessor: ["marine", "bolter"], "Assault Intercessor": ["marine", "blade"], "Assault Marine": ["jump", "blade"],
    Devastator: ["heavy", "heavy"], Hellblaster: ["marine", "plasma"], Inceptor: ["jump", "plasma"], Aggressor: ["heavy", "flamer"],
    Reiver: ["light", "blade"], Incursor: ["light", "bolter"], Infiltrator: ["light", "bolter"], Eliminator: ["light", "sniper"],
    Sternguard: ["veteran", "bolter"], "Vanguard Veteran": ["jump", "blade"], "Bladeguard Veteran": ["veteran", "shield"],
    Terminator: ["terminator", "heavy"], "Assault Terminator": ["terminator", "hammer"], Sergeant: ["veteran", "blade"],
    Lieutenant: ["officer", "bolter"], Captain: ["officer", "blade"], "Chapter Master": ["officer", "hammer"], Chaplain: ["officer", "staff"],
    Librarian: ["officer", "staff"], Apothecary: ["medic", "bolter"], Techmarine: ["tech", "tool"], Judiciar: ["officer", "hammer"],
    Ancient: ["standard", "bolter"], "Company Champion": ["officer", "blade"], Rhino: ["transport", "cannon"], Razorback: ["transport", "cannon"],
    Impulsor: ["skimmer", "cannon"], Repulsor: ["tank", "cannon"], "Land Raider": ["heavyTank", "cannon"], Predator: ["tank", "cannon"],
    Gladiator: ["tank", "cannon"], Vindicator: ["tank", "siege"], Whirlwind: ["artillery", "rocket"], Hunter: ["tank", "missile"],
    Stalker: ["tank", "aa"], "Storm Speeder": ["skimmer", "cannon"], "Invader ATV": ["buggy", "cannon"], Dreadnought: ["walker", "cannon"],
    "Redemptor Dreadnought": ["heavyWalker", "cannon"], "Ballistus Dreadnought": ["walker", "missile"], "Brutalis Dreadnought": ["heavyWalker", "claw"],
    Thunderhawk: ["aircraft", "heavy"], Stormraven: ["aircraft", "cannon"], Stormtalon: ["fighter", "cannon"], Stormhawk: ["fighter", "missile"]
  };
  const guardProfiles = {
    Guardsman: ["guard", "rifle"], "Shock Trooper": ["guard", "rifle"], "Heavy Weapons Team": ["heavyGuard", "heavy"],
    Ratling: ["smallGuard", "sniper"], Kasrkin: ["eliteGuard", "rifle"], "Tempestus Scion": ["eliteGuard", "rifle"],
    Ogryn: ["ogryn", "club"], Bullgryn: ["ogryn", "shield"], Commissar: ["guardOfficer", "blade"], Priest: ["guardPriest", "staff"],
    Officer: ["guardOfficer", "rifle"]
  };

  function colorMix(a, b, amount) {
    const parse = value => String(value || "#777").replace("#", "").match(/.{1,2}/g).map(pair => parseInt(pair.length === 1 ? pair + pair : pair, 16));
    try {
      const left = parse(a), right = parse(b);
      return `rgb(${left.map((value, index) => Math.round(value + (right[index] - value) * amount)).join(",")})`;
    } catch { return a; }
  }

  function roundRect(ctx, x, y, w, h, r, fill, stroke) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
  }

  function weapon(ctx, type, palette, scale = 1) {
    const dark = palette.dark;
    ctx.save();
    ctx.translate(4.2 * scale, -1.5 * scale);
    ctx.fillStyle = dark;
    ctx.strokeStyle = palette.trim;
    ctx.lineWidth = 0.65;
    if (type === "blade" || type === "hammer" || type === "staff" || type === "club" || type === "claw") {
      ctx.fillRect(-0.7 * scale, -7 * scale, 1.4 * scale, 13 * scale);
      if (type === "blade") {
        ctx.fillStyle = palette.metal; ctx.beginPath(); ctx.moveTo(-1.2 * scale, -7 * scale); ctx.lineTo(0, -11 * scale); ctx.lineTo(1.2 * scale, -7 * scale); ctx.fill();
      } else if (type === "hammer") ctx.fillRect(-3.2 * scale, -9 * scale, 6.4 * scale, 3 * scale);
      else if (type === "staff") { ctx.fillStyle = palette.accent; ctx.beginPath(); ctx.arc(0, -8 * scale, 2.2 * scale, 0, Math.PI * 2); ctx.fill(); }
      else if (type === "claw") for (let i = -1; i <= 1; i += 1) ctx.fillRect(i * 1.8 * scale, -10 * scale, 0.8 * scale, 6 * scale);
    } else if (type === "shield") {
      ctx.fillStyle = palette.secondary; ctx.beginPath(); ctx.moveTo(-4 * scale, -6 * scale); ctx.lineTo(4 * scale, -6 * scale); ctx.lineTo(3 * scale, 5 * scale); ctx.lineTo(0, 8 * scale); ctx.lineTo(-3 * scale, 5 * scale); ctx.closePath(); ctx.fill();
      ctx.stroke();
    } else if (type === "tool") {
      ctx.fillRect(-1 * scale, -7 * scale, 2 * scale, 13 * scale); ctx.fillRect(-3 * scale, -8 * scale, 6 * scale, 2 * scale);
    } else {
      const long = type === "sniper" || type === "heavy";
      ctx.fillStyle = type === "plasma" ? palette.accent : dark;
      roundRect(ctx, -2.2 * scale, -8.5 * scale, 4.4 * scale, (long ? 16 : 13) * scale, 1.1 * scale, ctx.fillStyle, palette.trim);
      ctx.fillStyle = palette.metal; ctx.fillRect(-0.8 * scale, (-11.5 - (long ? 2 : 0)) * scale, 1.6 * scale, 4 * scale);
      if (["heavy", "flamer", "rocket", "missile", "aa", "siege"].includes(type)) ctx.fillRect(-3.2 * scale, -5 * scale, 6.4 * scale, 5 * scale);
      if (type === "plasma") { ctx.fillStyle = palette.accent; ctx.fillRect(-1.3 * scale, -7.7 * scale, 2.6 * scale, 7 * scale); }
    }
    ctx.restore();
  }

  function drawMarine(ctx, profile, palette, unit, time) {
    const [kind, armament] = profile;
    if (["transport", "skimmer", "tank", "heavyTank", "artillery", "buggy"].includes(kind)) return drawVehicle(ctx, kind, armament, palette, unit);
    if (["walker", "heavyWalker"].includes(kind)) return drawWalker(ctx, kind, armament, palette);
    if (["aircraft", "fighter"].includes(kind)) return drawAircraft(ctx, kind, armament, palette);
    const heavy = ["heavy", "terminator"].includes(kind);
    const scale = heavy ? 1.25 : kind === "light" ? 0.88 : kind === "builder" ? 0.78 : 1;
    const bob = unit.status && /Advancing|Closing|Responding|Moving/.test(unit.status) ? Math.sin(time * 8 + unit.index) * 0.55 : 0;
    ctx.save(); ctx.translate(0, bob); ctx.scale(scale, scale); ctx.lineWidth = 0.7;
    ctx.fillStyle = palette.dark; ctx.fillRect(-5, 4, 3.4, 6); ctx.fillRect(1.6, 4, 3.4, 6);
    if (["jump", "terminator", "heavy", "tech"].includes(kind)) {
      ctx.fillStyle = palette.dark; roundRect(ctx, -6.8, -3, 13.6, 9, 2, palette.dark);
      if (kind === "jump") { ctx.fillStyle = palette.metal; ctx.fillRect(-8.2, 0, 2.4, 7); ctx.fillRect(5.8, 0, 2.4, 7); }
    }
    roundRect(ctx, -5.5, -5, 11, 11, 2, palette.primary, palette.trim);
    ctx.fillStyle = palette.secondary; ctx.beginPath(); ctx.arc(-5.5, -3, 3.1, 0, Math.PI * 2); ctx.arc(5.5, -3, 3.1, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = palette.trim; ctx.stroke();
    ctx.fillStyle = kind === "builder" ? palette.metal : palette.primary; ctx.beginPath(); ctx.arc(0, -7.4, 3.1, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = kind === "medic" ? "#f0eee7" : palette.accent; ctx.fillRect(-2.2, -8, 4.4, 1.15);
    if (kind === "medic") { ctx.fillStyle = "#bd2b2b"; ctx.fillRect(-1.2, -4, 2.4, 6); ctx.fillRect(-3, -2.2, 6, 2.4); }
    if (kind === "standard") { ctx.strokeStyle = palette.metal; ctx.beginPath(); ctx.moveTo(-6, 5); ctx.lineTo(-6, -15); ctx.stroke(); ctx.fillStyle = palette.secondary; ctx.fillRect(-5.7, -14.5, 8, 6); }
    if (kind === "tech") { ctx.strokeStyle = palette.accent; ctx.beginPath(); ctx.moveTo(-4, 2); ctx.quadraticCurveTo(-12, -4, -8, -12); ctx.stroke(); ctx.beginPath(); ctx.arc(-8, -12, 1.5, 0, Math.PI * 2); ctx.fillStyle = palette.accent; ctx.fill(); }
    weapon(ctx, armament, palette, heavy ? 1.08 : 1);
    ctx.restore(); return true;
  }

  function drawVehicle(ctx, kind, armament, palette) {
    const heavy = kind === "heavyTank" ? 1.35 : kind === "buggy" ? 0.8 : 1;
    const length = kind === "transport" ? 27 : kind === "artillery" ? 25 : 23;
    ctx.save(); ctx.scale(heavy, heavy); ctx.lineWidth = 0.8;
    if (kind === "skimmer") { ctx.fillStyle = palette.accent; ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.ellipse(0, 4, 14, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
    else { ctx.fillStyle = palette.dark; ctx.fillRect(-length / 2 - 2, -8, 4, 16); ctx.fillRect(length / 2 - 2, -8, 4, 16); }
    roundRect(ctx, -length / 2, -7, length, 14, 2, palette.primary, palette.trim);
    ctx.fillStyle = palette.secondary; ctx.fillRect(-length / 2 + 3, -5, length * 0.35, 10);
    if (kind === "buggy") { ctx.fillStyle = palette.dark; for (const x of [-8, 8]) for (const y of [-7, 7]) { ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill(); } }
    roundRect(ctx, -5, -5, 10, 10, 2, palette.secondary, palette.trim);
    ctx.fillStyle = palette.metal; ctx.fillRect(-1.2, -15, 2.4, 13);
    if (["rocket", "missile", "aa"].includes(armament)) { ctx.fillStyle = palette.dark; for (const x of [-3, 0, 3]) ctx.fillRect(x - 1, -13, 2, 7); }
    ctx.restore(); return true;
  }

  function drawWalker(ctx, kind, armament, palette) {
    const scale = kind === "heavyWalker" ? 1.25 : 1;
    ctx.save(); ctx.scale(scale, scale); ctx.lineWidth = 0.8;
    ctx.fillStyle = palette.dark; ctx.fillRect(-6, 4, 4, 9); ctx.fillRect(2, 4, 4, 9);
    roundRect(ctx, -7, -7, 14, 13, 2, palette.primary, palette.trim);
    ctx.fillStyle = palette.secondary; ctx.fillRect(-4.5, -5, 9, 5); ctx.fillStyle = palette.accent; ctx.fillRect(-2, -4, 4, 1.2);
    weapon(ctx, armament, palette, 1.15);
    ctx.save(); ctx.scale(-1, 1); weapon(ctx, armament === "claw" ? "claw" : "heavy", palette, 1.15); ctx.restore();
    ctx.restore(); return true;
  }

  function drawAircraft(ctx, kind, armament, palette) {
    const scale = kind === "aircraft" ? 1.3 : 1;
    ctx.save(); ctx.scale(scale, scale); ctx.lineWidth = 0.8; ctx.fillStyle = palette.primary; ctx.strokeStyle = palette.trim;
    ctx.beginPath(); ctx.moveTo(0, -15); ctx.lineTo(5, -4); ctx.lineTo(14, 5); ctx.lineTo(5, 5); ctx.lineTo(3, 13); ctx.lineTo(-3, 13); ctx.lineTo(-5, 5); ctx.lineTo(-14, 5); ctx.lineTo(-5, -4); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = palette.secondary; ctx.fillRect(-2.5, -8, 5, 13); ctx.fillStyle = palette.accent; ctx.fillRect(-1.4, -9, 2.8, 5);
    ctx.restore(); return true;
  }

  function drawGuard(ctx, profile, palette, unit, time) {
    const [kind, armament] = profile;
    const scale = kind === "ogryn" ? 1.35 : kind === "smallGuard" ? 0.72 : kind === "heavyGuard" ? 1.12 : 0.9;
    const bob = /Advancing|Closing|Responding|Moving/.test(unit.status || "") ? Math.sin(time * 8 + unit.index) * 0.45 : 0;
    ctx.save(); ctx.translate(0, bob); ctx.scale(scale, scale); ctx.lineWidth = 0.7;
    ctx.fillStyle = palette.dark; ctx.fillRect(-3.8, 3, 2.8, 7); ctx.fillRect(1, 3, 2.8, 7);
    roundRect(ctx, -4.6, -4, 9.2, 9, 1.6, palette.primary, palette.trim);
    ctx.fillStyle = kind === "guardOfficer" ? palette.secondary : palette.primary; ctx.beginPath(); ctx.arc(0, -6.3, 2.8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = kind === "guardPriest" ? palette.dark : palette.secondary; ctx.fillRect(-3.3, -8.3, 6.6, 1.7);
    if (kind === "ogryn") { ctx.fillStyle = palette.secondary; ctx.beginPath(); ctx.arc(-4.5, -2.5, 2.8, 0, Math.PI * 2); ctx.arc(4.5, -2.5, 2.8, 0, Math.PI * 2); ctx.fill(); }
    weapon(ctx, armament, palette, kind === "ogryn" ? 1.15 : 0.9);
    ctx.restore(); return true;
  }

  function drawOrk(ctx, unit, palette, time) {
    const name = stripSerial(unit.name);
    const grot = /Gretchin|Grot/.test(name), huge = /Warboss|Meganob|Deff Dread|Battlewagon/.test(name);
    if (unit.role === "vehicle") return drawVehicle(ctx, /Trukk|Scrapjet|Squigbuggy/.test(name) ? "buggy" : "tank", /Dakkajet/.test(name) ? "aa" : "cannon", { ...palette, primary: colorMix(palette.primary, "#6b5333", 0.4) });
    const scale = huge ? 1.35 : grot ? 0.66 : /Nob|Ogryn/.test(name) ? 1.18 : 1;
    ctx.save(); ctx.translate(0, /Advancing|Closing/.test(unit.status || "") ? Math.sin(time * 9 + unit.index) * 0.6 : 0); ctx.scale(scale, scale); ctx.rotate(-0.08); ctx.lineWidth = 0.8;
    ctx.fillStyle = palette.dark; ctx.fillRect(-5, 3, 3.5, 7); ctx.fillRect(1, 4, 3.5, 7);
    roundRect(ctx, -6, -4, 12, 10, 2, colorMix(palette.primary, "#5b3d24", 0.35), palette.trim);
    ctx.fillStyle = "#5c9b45"; ctx.beginPath(); ctx.arc(0, -7, grot ? 2.8 : 3.7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-3, -7); ctx.lineTo(-7, -8.5); ctx.lineTo(-3, -5.5); ctx.moveTo(3, -7); ctx.lineTo(7, -8.5); ctx.lineTo(3, -5.5); ctx.fill();
    ctx.fillStyle = "#eee2b0"; for (const x of [-1.5, 0, 1.5]) ctx.fillRect(x - 0.35, -5.1, 0.7, 1.6);
    weapon(ctx, /Shoota|Loota|Tankbusta|Flash|Kommando/.test(name) ? "heavy" : /Weirdboy|Painboy|Mek/.test(name) ? "staff" : "blade", palette, huge ? 1.18 : 1);
    ctx.restore(); return true;
  }

export const unitSpriteForge = Object.freeze({
    sourceMappings: Object.freeze({ marine: marineProfiles, guard: guardProfiles }),
    draw(ctx, unit, colors, time = 0) {
      const name = stripSerial(unit.name);
      if (orkSpriteForge.hasUnit(name)) return orkSpriteForge.drawUnit(ctx, unit, time);
      const palette = {
        primary: colors.primary, secondary: colors.secondary, tertiary: colors.tertiary || colors.accent || "#7ee5ff",
        body: colors.body || colors.primary, accent: colors.tertiary || colors.accent || "#7ee5ff",
        trim: colorMix(colors.primary, "#ffffff", 0.42), dark: colorMix(colors.primary, "#101218", 0.72), metal: "#abb4bc"
      };
      ctx.save();
      if (unit.alive === false || unit.incapacitated) { ctx.rotate(Math.PI / 2); ctx.globalAlpha *= unit.alive === false ? 0.45 : 0.72; }
      let drawn = false;
      if (hasMarineInfantryModel(unit)) drawn = drawMarineInfantry(ctx, unit, palette, time);
      else if (marineProfiles[name]) drawn = drawMarine(ctx, marineProfiles[name], palette, unit, time);
      else if (guardProfiles[name]) drawn = drawGuard(ctx, guardProfiles[name], palette, unit, time);
      else if (/Ork|Boy|Nob|Gretchin|Grot|Mek|Warboss|Runtherd|Kommando|Painboy|Trukk|Battlewagon|Dread|Kan|Wagon|Scrapjet|Squigbuggy|Dakkajet/.test(name)) drawn = drawOrk(ctx, unit, palette, time);
      ctx.restore();
      return drawn;
    }
});

modules.unitSpriteForge = unitSpriteForge;
export default unitSpriteForge;
