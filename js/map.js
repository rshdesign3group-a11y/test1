/**
 * Endless side-view map. Procedural in every direction, drag/arrow-key/wheel
 * navigation, animated creatures, per-player fog on deep layers.
 */
import { getImage } from "./data.js?v=6";
import { TAU, hash, biome, hsl, regionAt } from "./world.js?v=6";

export const LH = 130;       // layer height
export const SURF = 230;     // world-y of the ground surface
const HW = 170;              // distance between holes
const holeX = (h) => 120 + h.x * HW;

/* ---------- surface animals ---------- */
const SA = {
  rabbit:   { c: "#f1f5f9", d: "#cbd5e1", w: 11, h: 8, s: 1 },
  fox:      { c: "#ea580c", d: "#fff7ed", w: 15, h: 7, s: 1.1 },
  deer:     { c: "#a16207", d: "#fde68a", w: 17, h: 9, s: 1.3 },
  squirrel: { c: "#b45309", d: "#fed7aa", w: 8,  h: 6, s: 1 },
  hedgehog: { c: "#57534e", d: "#d6b98c", w: 11, h: 8, s: 1 },
  polar:    { c: "#f8fafc", d: "#e2e8f0", w: 20, h: 11, s: 1.2 },
  wolf:     { c: "#64748b", d: "#e2e8f0", w: 15, h: 7, s: 1.2 },
  fennec:   { c: "#fcd34d", d: "#fff7ed", w: 11, h: 6, s: 1 },
  camel:    { c: "#d6a756", d: "#fde68a", w: 19, h: 9, s: 1.2 },
  unicorn:  { c: "#fdf2f8", d: "#f9a8d4", w: 16, h: 8, s: 1.2 }
};
const SA_KEYS = Object.keys(SA);

/* ---------- sprite-sheet animals (sheep + 2 beetles) ---------- */
const sheet = (file, frames) => { const im = new Image(); im.src = `assets/${file}.png?v=6`; return { im, frames }; };
const SPR = {
  sheep: sheet("sheep", 12),            // frames 0-9 walk cycle, 10-11 grazing
  beetleBlue: sheet("beetle-blue", 8),  // 8-frame walk cycle
  beetlePurple: sheet("beetle-purple", 8)
};
// draw frame n of a sheet, centred on x=0 with its bottom on y=0, `w` px wide
function drawFrame(ctx, sp, n, w, dir, rot = 0, lift = 0) {
  const im = sp.im; if (!(im.complete && im.naturalWidth)) return;
  const fw = im.naturalWidth / sp.frames, h = w * im.naturalHeight / fw;
  ctx.save(); ctx.scale(dir, 1); ctx.translate(0, -lift); ctx.rotate(rot);
  ctx.drawImage(im, n * fw, 0, fw, im.naturalHeight, -w / 2, -h, w, h);
  ctx.restore();
}
// Distance walked along a back-and-forth path x = A*sin(m)  ->  frame index follows real movement
const walked = (A, m) => { const k = Math.floor((m + Math.PI / 2) / Math.PI); return A * (2 * k + Math.sin(m - k * Math.PI) + 1); };

function sheep(ctx, t, dir, d, slow) {
  ctx.fillStyle = "rgba(0,0,0,.16)"; ctx.beginPath(); ctx.ellipse(0, 1, 22, 3.5, 0, 0, TAU); ctx.fill();
  if (slow) drawFrame(ctx, SPR.sheep, 10 + (Math.floor(t * 1.6) % 2), 64, dir);        // pauses and grazes
  else drawFrame(ctx, SPR.sheep, Math.floor(d / 6) % 10, 64, dir);
}

function critter(ctx, type, t, dir) {
  const a = SA[type], tall = type === "deer" || type === "camel" || type === "unicorn";
  const ll = tall ? 14 : 6, st = t * 9;
  ctx.save();
  ctx.scale(dir * a.s * 1.5, a.s * 1.5);   // large enough to recognise
  ctx.translate(0, -ll - a.h + (type === "rabbit" ? -Math.abs(Math.sin(st)) * 4 : 0));
  ctx.strokeStyle = a.c; ctx.lineWidth = tall ? 2 : 3; ctx.lineCap = "round";
  [[-0.6, 0], [-0.3, Math.PI], [0.4, Math.PI], [0.65, 0]].forEach(([k, p]) => {
    ctx.beginPath(); ctx.moveTo(a.w * k, a.h * .5);
    ctx.lineTo(a.w * k + Math.sin(st + p) * 4, a.h + ll); ctx.stroke();
  });
  // tail
  ctx.fillStyle = type === "rabbit" ? "#fff" : type === "unicorn" ? "#f472b6" : a.c;
  ctx.beginPath();
  if (type === "fox" || type === "wolf" || type === "fennec") ctx.ellipse(-a.w - 6, 0, 10, 4, -0.3 + Math.sin(st * .5) * .15, 0, TAU);
  else if (type === "squirrel") ctx.ellipse(-a.w + 1, -8, 5, 11, 0.5 + Math.sin(st * .5) * .2, 0, TAU);
  else ctx.arc(-a.w, -1, type === "rabbit" ? 3.5 : 3, 0, TAU);
  ctx.fill();
  // body
  ctx.fillStyle = a.c; ctx.beginPath(); ctx.ellipse(0, 0, a.w, a.h, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = a.d; ctx.beginPath(); ctx.ellipse(2, a.h * .4, a.w * .6, a.h * .45, 0, 0, TAU); ctx.fill();
  if (type === "hedgehog") {
    ctx.strokeStyle = "#292524"; ctx.lineWidth = 1.3;
    for (let i = 0; i < 14; i++) {
      const q = Math.PI * 1.05 + (i / 13) * Math.PI * .9;
      ctx.beginPath(); ctx.moveTo(Math.cos(q) * a.w * .8, Math.sin(q) * a.h * .8);
      ctx.lineTo(Math.cos(q) * (a.w + 5), Math.sin(q) * (a.h + 5)); ctx.stroke();
    }
  }
  // head
  const hx = a.w * .95, hy = -a.h * .55;
  ctx.fillStyle = a.c; ctx.beginPath();
  ctx.ellipse(hx + (tall ? 3 : 0), hy - (tall ? 7 : 0), tall ? 5 : 6, tall ? 4 : 5, 0, 0, TAU); ctx.fill();
  if (tall) { ctx.strokeStyle = a.c; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(a.w * .6, -3); ctx.lineTo(hx + 1, hy - 7); ctx.stroke(); }
  const ey = tall ? hy - 8 : hy;
  ctx.fillStyle = "#0f172a"; ctx.beginPath(); ctx.arc(hx + (tall ? 5 : 3), ey - 1, 1.2, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(hx + (tall ? 8 : 6), ey + 1.5, 1.1, 0, TAU); ctx.fill();
  // ears / antlers
  ctx.fillStyle = a.c; ctx.strokeStyle = "#78350f"; ctx.lineWidth = 1.5;
  if (type === "rabbit") {
    ctx.beginPath(); ctx.ellipse(hx - 2, hy - 12, 2.6, 8, 0.25, 0, TAU); ctx.ellipse(hx + 3, hy - 12, 2.6, 8, -0.1, 0, TAU); ctx.fill();
    ctx.fillStyle = "#fda4af"; ctx.beginPath(); ctx.ellipse(hx - 2, hy - 11, 1, 5, 0.25, 0, TAU); ctx.fill();
  } else if (type === "fox" || type === "wolf" || type === "fennec") {
    ctx.beginPath(); ctx.moveTo(hx - 3, hy - 3); ctx.lineTo(hx - 1, hy - (type === "fennec" ? 17 : 11)); ctx.lineTo(hx + 3, hy - 4); ctx.fill();
  } else if (type === "polar") {
    ctx.beginPath(); ctx.arc(hx - 1, hy - 5, 2.6, 0, TAU); ctx.fill();
  } else if (type === "camel") {
    ctx.beginPath(); ctx.ellipse(-2, -a.h - 3, 6, 7, 0, 0, TAU); ctx.fill();
  } else if (type === "unicorn") {
    ctx.fillStyle = "#fde68a"; ctx.beginPath(); ctx.moveTo(hx + 1, hy - 12); ctx.lineTo(hx + 6, hy - 24); ctx.lineTo(hx + 5, hy - 10); ctx.fill();
  } else if (type === "deer") {
    ctx.beginPath(); ctx.moveTo(hx + 1, hy - 11); ctx.lineTo(hx - 3, hy - 21); ctx.moveTo(hx - 1, hy - 16); ctx.lineTo(hx + 4, hy - 19);
    ctx.moveTo(hx + 3, hy - 11); ctx.lineTo(hx + 6, hy - 21); ctx.stroke();
  } else if (type === "squirrel") {
    ctx.beginPath(); ctx.arc(hx - 1, hy - 5, 2, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

function snake(ctx, t) {
  ctx.save(); ctx.scale(1.3, 1.3);
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  const pts = []; for (let k = 0; k <= 12; k++) pts.push([-30 + k * 5, -6 + Math.sin(t * 5 + k * .7) * 4]);
  const path = () => { ctx.beginPath(); pts.forEach(([x, y], k) => k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); };
  ctx.strokeStyle = "#65a30d"; ctx.lineWidth = 6; path(); ctx.stroke();
  ctx.strokeStyle = "#facc15"; ctx.lineWidth = 2; ctx.setLineDash([3, 7]); path(); ctx.stroke(); ctx.setLineDash([]);
  const [hx, hy] = pts[12];
  ctx.fillStyle = "#65a30d"; ctx.beginPath(); ctx.ellipse(hx + 2, hy, 6, 4.5, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = "#0f172a"; ctx.fillRect(hx + 2, hy - 3, 2, 2);
  ctx.strokeStyle = "#ef4444"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(hx + 8, hy); ctx.lineTo(hx + 13, hy + Math.sin(t * 20) * 2); ctx.stroke();
  ctx.restore();
}
function penguin(ctx, t) {
  ctx.save(); ctx.scale(1.4, 1.4); ctx.translate(0, -19); ctx.rotate(Math.sin(t * 8) * .1);
  const f = Math.sin(t * 8) * 3;
  ctx.fillStyle = "#f97316"; ctx.beginPath(); ctx.ellipse(-4 + f, 17, 5, 2.5, 0, 0, TAU); ctx.ellipse(5 - f, 17, 5, 2.5, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = "#1e293b"; ctx.beginPath(); ctx.ellipse(0, 0, 11, 17, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-9, 3, 3, 9, .4 + f * .05, 0, TAU); ctx.fill();
  ctx.fillStyle = "#f8fafc"; ctx.beginPath(); ctx.ellipse(2, 3, 7, 12, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = "#f97316"; ctx.beginPath(); ctx.moveTo(8, -10); ctx.lineTo(16, -8); ctx.lineTo(8, -6); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(5, -12, 2.4, 0, TAU); ctx.fill();
  ctx.fillStyle = "#0f172a"; ctx.beginPath(); ctx.arc(5.8, -12, 1.2, 0, TAU); ctx.fill();
  ctx.restore();
}
const drawAnimal = (ctx, type, t, dir, d = 0, slow = false) => {
  if (type === "sheep") return sheep(ctx, t, dir, d, slow);
  if (type === "snake" || type === "penguin") { ctx.save(); ctx.scale(dir, 1); (type === "snake" ? snake : penguin)(ctx, t); ctx.restore(); }
  else critter(ctx, type, t, dir);
};

// Four tree species (round oak/sakura, pine, cactus, palm), `sw` = wind sway
function tree(ctx, kind, sc, r, sw) {
  ctx.save(); ctx.scale(sc, sc);
  if (kind === "pine") {
    ctx.fillStyle = r.trunk; ctx.fillRect(-6, -30, 12, 30);
    for (let k = 0; k < 4; k++) {
      const y = -22 - k * 28, wd = 46 - k * 9, o = sw * k / 3;
      ctx.fillStyle = r.leaf[k % 3]; ctx.beginPath(); ctx.moveTo(-wd + o, y); ctx.lineTo(o * 1.4, y - 42); ctx.lineTo(wd + o, y); ctx.fill();
    }
  } else if (kind === "cactus") {
    ctx.fillStyle = "#15803d"; ctx.strokeStyle = "#166534"; ctx.lineWidth = 2;
    [[-9, -92, 18, 92], [-30, -62, 10, 36], [20, -74, 10, 40]].forEach(([x, y, w, h], i) => {
      ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.fill(); ctx.stroke();
      if (i) { ctx.fillRect(i === 1 ? -22 : 10, y + h - 8, 14, 9); }
    });
    ctx.fillStyle = "#fde68a"; for (let k = 0; k < 6; k++) ctx.fillRect(-4 + (k % 2) * 6, -84 + k * 13, 2, 2);
  } else if (kind === "palm") {
    ctx.strokeStyle = r.trunk; ctx.lineWidth = 9; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(16 + sw, -50, 6 + sw * 2, -100); ctx.stroke();
    ctx.strokeStyle = r.leaf[1]; ctx.lineWidth = 5;
    for (let k = 0; k < 7; k++) {
      const a = -Math.PI + k * (Math.PI / 6) + sw * .02;
      ctx.beginPath(); ctx.moveTo(6 + sw * 2, -100); ctx.quadraticCurveTo(6 + Math.cos(a) * 24, -100 + Math.sin(a) * 30 - 14, 6 + Math.cos(a) * 50 + sw * 2, -100 + Math.sin(a) * 18 + 22); ctx.stroke();
    }
  } else {
    ctx.fillStyle = r.trunk; ctx.fillRect(-7, -80, 14, 80);
    [[0, -100, 34], [-20, -80, 26], [20, -80, 26], [0, -118, 22]].forEach(([dx, dy, rr], k) => {
      ctx.fillStyle = r.leaf[k % 3]; ctx.beginPath(); ctx.arc(dx + sw, dy, rr, 0, TAU); ctx.fill();
    });
  }
  ctx.restore();
}

/* ---------- underground creatures ---------- */
// y = where inside the layer the creature lives (0 top … 1 bottom)
const U = {
  worm(ctx, t, ph, o) {
    const gold = o.gold;
    for (let k = 7; k >= 0; k--) {
      const x = -18 + k * 5, y = Math.sin(t * 3 + ph + k * .8) * 3.2;
      ctx.fillStyle = gold ? `hsl(${44 - k * 1.5},95%,${58 - k}%)` : `hsl(335,70%,${66 - k * 2}%)`;
      ctx.beginPath(); ctx.arc(x, y, k === 7 ? 3.6 : 2.8, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = "#1c1917"; ctx.beginPath(); ctx.arc(19, -1.5 + Math.sin(t * 3 + ph + 5.6) * 3.2, .9, 0, TAU); ctx.fill();
    if (gold) {
      ctx.fillStyle = "#fffbeb"; ctx.globalAlpha = .5 + .5 * Math.sin(t * 5 + ph);
      ctx.beginPath(); ctx.arc(-6 + Math.sin(t + ph) * 10, -3, 1.4, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    }
  },
  skeleton(ctx, t, ph, o) {
    const dia = o.diamond, c = dia ? "#a5f3fc" : "#e7e5e4", st = t * 4 + ph;
    if (dia) { ctx.shadowColor = "#22d3ee"; ctx.shadowBlur = 10; }
    ctx.strokeStyle = c; ctx.fillStyle = c; ctx.lineWidth = 2.2; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-16, -8); ctx.quadraticCurveTo(0, -12, 12, -9); ctx.stroke();       // spine
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(-6 + i * 5, -8, 5, .2, Math.PI - .2); ctx.stroke(); } // ribs
    [[-12, 0], [-8, Math.PI], [8, Math.PI], [12, 0]].forEach(([x, p]) => {
      ctx.beginPath(); ctx.moveTo(x, -8); ctx.lineTo(x + Math.sin(st + p) * 4, 4); ctx.stroke();
    });
    ctx.beginPath(); ctx.arc(15, -12, 6, 0, TAU); ctx.fill();                                     // skull
    ctx.fillStyle = "#0f172a"; ctx.beginPath(); ctx.arc(17, -13, 1.6, 0, TAU); ctx.fill();
    ctx.fillRect(16, -9, 6, 1.6 + Math.abs(Math.sin(st * .5)) * 2);                              // jaw
    if (dia) {
      ctx.shadowBlur = 0; ctx.fillStyle = "#fff"; ctx.globalAlpha = .5 + .5 * Math.sin(t * 6 + ph);
      ctx.beginPath(); ctx.moveTo(-4, -22); ctx.lineTo(-2, -18); ctx.lineTo(2, -16); ctx.lineTo(-2, -15); ctx.lineTo(-4, -10); ctx.lineTo(-6, -15); ctx.lineTo(-10, -16); ctx.lineTo(-6, -18); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.shadowBlur = 0;
  },
  root(ctx, t, ph) {
    ctx.strokeStyle = "#5b3a1a"; ctx.lineCap = "round";
    for (let k = 0; k < 3; k++) {
      ctx.lineWidth = 3 - k * .7; const len = 40 + hash(ph, k) * 40, sw = Math.sin(t * 1.2 + ph + k) * 6;
      ctx.beginPath(); ctx.moveTo(k * 8 - 8, 0);
      ctx.bezierCurveTo(k * 8 - 8 + sw, len * .4, k * 8 - 8 - sw, len * .7, k * 8 - 8 + sw * 1.4, len); ctx.stroke();
      ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(k * 8 - 8 + sw * .5, len * .4); ctx.lineTo(k * 8 + 2 + sw, len * .55); ctx.stroke();
    }
  },
  beetle(ctx, t, ph) {
    const h = 90 + hash(ph) * 140, s = t * 10 + ph;
    ctx.strokeStyle = "#1c1917"; ctx.lineWidth = 1.2;
    for (let k = -1; k <= 1; k++) for (const sd of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(k * 4, 0); ctx.lineTo(k * 4 + Math.sin(s + k * 2) * 3, sd * 7); ctx.stroke();
    }
    ctx.fillStyle = `hsl(${h},60%,35%)`; ctx.beginPath(); ctx.ellipse(0, 0, 9, 6, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = `hsl(${h},70%,55%)`; ctx.beginPath(); ctx.ellipse(-1, -2, 6, 2.5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#1c1917"; ctx.beginPath(); ctx.arc(9, 0, 3.2, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(11, -1); ctx.lineTo(15, -4 + Math.sin(s) * 1.5); ctx.moveTo(11, 1); ctx.lineTo(15, 4 - Math.sin(s) * 1.5); ctx.stroke();
  },
  mole(ctx, t, ph) {
    const s = t * 8 + ph;
    ctx.fillStyle = "#44403c"; ctx.beginPath(); ctx.ellipse(0, 0, 13, 8, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(13, 1, 6, 5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#fda4af"; ctx.beginPath(); ctx.arc(19, 2, 2.3, 0, TAU); ctx.fill();
    ctx.fillStyle = "#fcd9b6"; for (const k of [0, 1]) { ctx.beginPath(); ctx.ellipse(8 + k * 3 + Math.sin(s + k) * 2, 8, 4, 2, 0, 0, TAU); ctx.fill(); }
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(15, -1, 1, 0, TAU); ctx.fill();
  },
  bat(ctx, t, ph) {
    const f = Math.sin(t * 12 + ph);
    ctx.fillStyle = "#312e81";
    for (const sd of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(sd * 3, 0); ctx.quadraticCurveTo(sd * 14, -10 - f * 8, sd * 22, -2 + f * 6);
      ctx.quadraticCurveTo(sd * 15, 2, sd * 11, 0); ctx.quadraticCurveTo(sd * 7, 4, sd * 3, 3); ctx.fill();
    }
    ctx.fillStyle = "#1e1b4b"; ctx.beginPath(); ctx.ellipse(0, 1, 4, 6, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-3, -4); ctx.lineTo(-2, -9); ctx.lineTo(0, -5); ctx.lineTo(2, -9); ctx.lineTo(3, -4); ctx.fill();
    ctx.fillStyle = "#fb7185"; ctx.fillRect(-2.5, -2, 1.4, 1.4); ctx.fillRect(1.2, -2, 1.4, 1.4);
  },
  crystal(ctx, t, ph, o) {
    const p = .6 + .4 * Math.sin(t * 2 + ph), h = o.hue;
    ctx.shadowColor = `hsl(${h},90%,60%)`; ctx.shadowBlur = 12 * p;
    [[-9, 14, 5], [0, 22, 6], [9, 12, 5]].forEach(([x, hh, w], k) => {
      ctx.fillStyle = `hsl(${h + k * 15},80%,${55 + p * 10}%)`;
      ctx.beginPath(); ctx.moveTo(x, -hh); ctx.lineTo(x + w, -hh * .25); ctx.lineTo(x + w * .6, 0); ctx.lineTo(x - w * .6, 0); ctx.lineTo(x - w, -hh * .25); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.beginPath(); ctx.moveTo(x, -hh); ctx.lineTo(x - w, -hh * .25); ctx.lineTo(x - w * .3, 0); ctx.lineTo(x, -hh * .3); ctx.fill();
    });
    ctx.shadowBlur = 0;
  },
  nugget(ctx, t, ph) {
    ctx.fillStyle = "#b45309"; ctx.beginPath(); ctx.ellipse(0, -5, 11, 7, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#fbbf24"; ctx.beginPath(); ctx.ellipse(-2, -7, 8, 5, -.2, 0, TAU); ctx.fill();
    ctx.fillStyle = "#fffbeb"; ctx.globalAlpha = .5 + .5 * Math.sin(t * 4 + ph);
    ctx.beginPath(); ctx.arc(2, -9, 1.8, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
  },
  bone(ctx, t, ph) {
    ctx.strokeStyle = "#e7e5e4"; ctx.lineCap = "round"; ctx.lineWidth = 3;
    for (const r of [-.5, .5]) {
      ctx.beginPath(); ctx.moveTo(-10 * Math.cos(r), -6 - 10 * Math.sin(r)); ctx.lineTo(10 * Math.cos(r), -6 + 10 * Math.sin(r)); ctx.stroke();
    }
    ctx.fillStyle = "#e7e5e4"; ctx.beginPath(); ctx.arc(0, -14, 5, 0, TAU); ctx.fill();
  },
  salamander(ctx, t, ph) {
    ctx.shadowColor = "#f97316"; ctx.shadowBlur = 10;
    ctx.strokeStyle = "#ea580c"; ctx.lineCap = "round"; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(14, 0);
    for (let k = 1; k <= 8; k++) ctx.lineTo(14 - k * 4.5, Math.sin(t * 5 + ph + k * .7) * 4);
    ctx.stroke(); ctx.shadowBlur = 0;
    ctx.fillStyle = "#fbbf24"; ctx.beginPath(); ctx.arc(15, 0, 4.5, 0, TAU); ctx.fill();
    ctx.fillStyle = "#1c1917"; ctx.beginPath(); ctx.arc(16.5, -1.5, 1, 0, TAU); ctx.fill();
  }
};
const KIND = {   // type -> factory options, vertical position, motion range, speed
  worm: { y: .55, r: 50, v: .5 }, goldworm: { y: .6, r: 50, v: .45, base: "worm", gold: true },
  skeleton: { y: .85, r: 40, v: .3 }, diamond: { y: .85, r: 40, v: .3, base: "skeleton", diamond: true },
  root: { y: 0, r: 0, v: 0 }, beetle: { y: .8, r: 60, v: .6 }, mole: { y: .8, r: 45, v: .35 },
  bat: { y: .4, r: 70, v: .8, fly: true }, crystal: { y: .95, r: 0, v: 0 }, nugget: { y: .95, r: 0, v: 0 },
  bone: { y: .95, r: 0, v: 0 }, salamander: { y: .85, r: 50, v: .5 }
};

/* ---------- renderer ---------- */
export class MapRenderer {
  constructor(canvas, holes, onHoleClick, getMaxDepth = () => 0) {
    Object.assign(this, { canvas, holes, onHoleClick, getMaxDepth });
    this.ctx = canvas.getContext("2d");
    this.camX = this.tx = 0; this.camY = this.ty = 0;
    this.time = 0; this.active = true; this.keys = {};
    this.drag = null; this.moved = 0;
    this.resize();
    // The canvas has no size while its screen is hidden, so always re-measure when it becomes visible again
    new ResizeObserver(() => this.resize()).observe(canvas);

    canvas.addEventListener("pointerdown", (e) => {
      canvas.setPointerCapture(e.pointerId);
      this.drag = { x: e.clientX, y: e.clientY, tx: this.tx, ty: this.ty }; this.moved = 0;
      canvas.style.cursor = "grabbing";
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!this.drag) return;
      const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
      this.moved = Math.max(this.moved, Math.abs(dx) + Math.abs(dy));
      this.tx = this.drag.tx - dx; this.ty = this.drag.ty - dy; this.clamp();
    });
    canvas.addEventListener("pointerup", (e) => {
      const wasClick = this.drag && this.moved < 6;
      this.drag = null; canvas.style.cursor = "grab";
      if (wasClick) this.handleClick(e);
    });
    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) this.tx += (e.deltaX || e.deltaY);
      else this.ty += e.deltaY;
      this.clamp();
    }, { passive: false });

    const typing = (e) => /INPUT|TEXTAREA|SELECT/.test(e.target.tagName);
    window.addEventListener("keydown", (e) => {
      if (!this.active || typing(e) || !e.key.startsWith("Arrow")) return;
      e.preventDefault(); this.keys[e.key] = true;
    });
    window.addEventListener("keyup", (e) => { this.keys[e.key] = false; });

    const loop = () => {
      requestAnimationFrame(loop);
      if (!this.active) return;
      this.time += 0.016;
      const k = this.keys, sp = 16;
      if (k.ArrowLeft) this.tx -= sp; if (k.ArrowRight) this.tx += sp;
      if (k.ArrowUp) this.ty -= sp; if (k.ArrowDown) this.ty += sp;
      this.clamp();
      this.camX += (this.tx - this.camX) * 0.14;
      this.camY += (this.ty - this.camY) * 0.14;
      this.draw();
    };
    loop();
  }

  setActive(on) { this.active = on; if (on) this.resize(); }
  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;                       // hidden screen: keep the last good size
    const dpr = window.devicePixelRatio || 1;
    this.w = w; this.h = h;
    this.canvas.width = w * dpr; this.canvas.height = h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.clamp();
  }
  // number of underground layers this player may see (layer index < unlocked)
  unlocked() { return Math.max(0, this.getMaxDepth()); }   // exactly the player's own depth, nothing below
  clamp() {
    // horizontal: the world starts at the first hole and only continues to the right.
    // vertical: from sky down to just past the lock line
    const maxY = Math.max(0, SURF + this.unlocked() * LH + 120 - this.h * 0.5);
    this.ty = Math.max(0, Math.min(maxY, this.ty));
    this.tx = Math.max(0, this.tx);
  }
  setHoles(holes) { this.holes = holes; }
  // glide to a hole (surface view)
  focusHole(hole) { this.tx = holeX(hole) - this.w / 2; this.ty = 0; this.clamp(); }
  // jump (no animation) so a hole is centred horizontally; vertical view is kept
  centerOn(hole) {
    this.tx = holeX(hole) - this.w / 2; this.clamp();
    this.camX = this.tx; this.camY = this.ty;
  }

  draw() {
    const ctx = this.ctx, w = this.w, h = this.h, cx = this.camX, cy = this.camY;
    const reg = regionAt(cx + w / 2);
    ctx.clearRect(0, 0, w, h);
    this.drawSky(ctx, w, reg, cx, cy);
    this.drawSurface(ctx, w, reg, cx, cy);

    const U_ = this.unlocked(), lockY = SURF + U_ * LH - cy;
    const first = Math.max(0, Math.floor((cy - SURF) / LH));
    for (let i = first; i < U_ && SURF + i * LH - cy < h; i++) this.drawLayer(ctx, w, i, SURF + i * LH - cy, cx);
    this.holes.forEach((hole) => this.drawHole(ctx, hole, cx, cy));

    // Fog: layers below the player's deepest hole stay hidden until reached
    if (lockY < h) {
      const g = ctx.createLinearGradient(0, lockY, 0, lockY + 18);
      g.addColorStop(0, "rgba(5,5,10,.55)"); g.addColorStop(1, "#05050a");
      ctx.fillStyle = g; ctx.fillRect(0, lockY, w, 18);
      ctx.fillStyle = "#05050a"; ctx.fillRect(0, lockY + 18, w, h);
      ctx.fillStyle = "rgba(148,163,184,.8)"; ctx.font = "600 15px system-ui"; ctx.textAlign = "center";
      ctx.fillText(`🔒 Layer ${U_ + 1} and deeper stay hidden until you dig there`, w / 2, lockY + 70);
    }
    this.holes.forEach((h) => { if (h._tag) { this.nameTag(ctx, h, ...h._tag); h._tag = null; } });
    // depth gauge
    const lay = Math.max(0, Math.min(U_ - 1, Math.floor((cy + h / 2 - SURF) / LH)));
    if (cy + h / 2 > SURF && U_ > 0) {
      const b = biome(lay);
      ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.beginPath(); ctx.roundRect(12, 12, 160, 30, 8); ctx.fill();
      ctx.fillStyle = "#f1f5f9"; ctx.font = "600 13px system-ui"; ctx.textAlign = "left";
      ctx.fillText(`Layer ${lay + 1} · ${b.name}`, 22, 32);
    }
  }

  drawSky(ctx, w, reg, cx, cy) {
    const sh = SURF - cy; if (sh <= 0) return;
    const g = ctx.createLinearGradient(0, 0, 0, sh);
    g.addColorStop(0, reg.sky[0]); g.addColorStop(.55, reg.sky[1]); g.addColorStop(1, reg.sky[2]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, sh);
    const sx = w - 110, sy = 70 - cy * .6;
    const gl = ctx.createRadialGradient(sx, sy, 5, sx, sy, 70);
    gl.addColorStop(0, "rgba(253,224,71,.85)"); gl.addColorStop(1, "rgba(253,224,71,0)");
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(sx, sy, 70, 0, TAU); ctx.fill();
    ctx.fillStyle = "#fde047"; ctx.beginPath(); ctx.arc(sx, sy, 26, 0, TAU); ctx.fill();
    // far hills (parallax)
    ctx.fillStyle = "rgba(15,23,42,.18)"; ctx.beginPath(); ctx.moveTo(0, sh);
    for (let x = 0; x <= w; x += 20) {
      const wx = x + cx * .3; ctx.lineTo(x, sh - 40 - Math.sin(wx / 160) * 22 - Math.sin(wx / 57) * 7);
    }
    ctx.lineTo(w, sh); ctx.fill();
    // clouds & birds (endless, parallax)
    for (let i = Math.floor((cx * .25) / 340) - 1; i < (cx * .25 + w) / 340 + 1; i++) {
      const x = i * 340 + hash(i, 1) * 200 - cx * .25 + this.time * 8, y = (20 + hash(i, 2) * 80) - cy * .7, s = .7 + hash(i, 3) * .6;
      ctx.fillStyle = "rgba(255,255,255,.55)"; ctx.beginPath();
      ctx.arc(x, y, 20 * s, 0, TAU); ctx.arc(x + 24 * s, y - 7 * s, 26 * s, 0, TAU); ctx.arc(x + 50 * s, y, 18 * s, 0, TAU); ctx.fill();
      if (hash(i, 4) > .55) {
        const bx = x + 120 + Math.sin(this.time + i) * 30, by = y + 40 + Math.sin(this.time * 2 + i) * 6, f = Math.sin(this.time * 9 + i) * 5;
        ctx.strokeStyle = "#1e293b"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(bx - 9, by + f); ctx.quadraticCurveTo(bx, by - 5, bx + 9, by + f); ctx.stroke();
      }
    }
  }

  drawSurface(ctx, w, reg, cx, cy) {
    const gy = SURF - cy; if (gy > this.h + 160 || gy < -160) return;
    // trees: every 150px cell may hold a tree whose species depends on its own region
    for (let i = Math.max(0, Math.floor((cx - 100) / 150)); i < (cx + w + 100) / 150; i++) {
      if (hash(i, 5) < .25) continue;
      const r = regionAt(i * 150), kind = r.trees[Math.floor(hash(i, 13) * r.trees.length)];
      const x = i * 150 + hash(i, 6) * 80 - cx, sc = .8 + hash(i, 7) * .6;
      ctx.save(); ctx.translate(x, gy + 2); tree(ctx, kind, sc, r, Math.sin(this.time * 1.4 + i) * 2.5); ctx.restore();
    }
    // ground
    ctx.fillStyle = reg.grass; ctx.fillRect(0, gy - 12, w, 20);
    ctx.strokeStyle = reg.blade; ctx.lineWidth = 1.5;
    for (let x = -((cx % 7) + 7); x < w; x += 7) {
      const sway = Math.sin(this.time * 2.2 + (x + cx) * .12) * 2.5;
      ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + sway, gy - 9 - hash(Math.floor((x + cx) / 7), 8) * 4); ctx.stroke();
    }
    // animals: species come from the region they are walking in
    for (let i = Math.max(0, Math.floor((cx - 300) / 400)); i < (cx + w + 300) / 400; i++) {
      if (hash(i, 9) < .2) continue;
      const fa = regionAt(i * 400).fauna, type = fa[Math.floor(hash(i, 10) * fa.length)];
      const sp = .15 + hash(i, 11) * .25, ph = hash(i, 12) * TAU, m = this.time * sp + ph;
      ctx.save(); ctx.translate(i * 400 + 200 + Math.sin(m) * 150 - cx, gy + 2);
      drawAnimal(ctx, type, this.time + ph, Math.cos(m) >= 0 ? 1 : -1, walked(150, m), Math.abs(Math.cos(m)) < .22); ctx.restore();
    }
  }

  drawLayer(ctx, w, i, y, cx) {
    const b = biome(i), g = ctx.createLinearGradient(0, y, 0, y + LH);
    g.addColorStop(0, hsl(b, 5)); g.addColorStop(1, hsl(b, -4));
    ctx.fillStyle = g; ctx.fillRect(0, y, w, LH + 1);

    const c0 = Math.max(0, Math.floor(cx / 70) - 1), c1 = Math.ceil((cx + w) / 70) + 1;
    ctx.save(); ctx.beginPath(); ctx.rect(0, y, w, LH); ctx.clip();
    for (let c = c0; c < c1; c++) {
      const r1 = hash(i, c, 1), r2 = hash(i, c, 2), r3 = hash(i, c, 3);
      const x = c * 70 + r1 * 60 - cx, py = y + 14 + r2 * (LH - 28);
      switch (b.tx) {
        case "roots": ctx.strokeStyle = "rgba(60,30,10,.45)"; ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 14 * (r3 - .5) * 2, y + 30, x + 10 * (r2 - .5), y + 30 + r3 * 50); ctx.stroke(); break;
        case "pebble": ctx.fillStyle = `hsla(${b.h},10%,${50 + r3 * 20}%,.35)`;
          ctx.beginPath(); ctx.ellipse(x, py, 2 + r3 * 4, 1.5 + r3 * 3, r2, 0, TAU); ctx.fill(); break;
        case "brick": ctx.strokeStyle = "rgba(255,255,255,.07)"; ctx.lineWidth = 1;
          ctx.strokeRect(x, y + Math.floor(r2 * 4) * 32 + 4, 40 + r3 * 30, 28); break;
        case "bone": ctx.strokeStyle = "rgba(231,229,228,.28)"; ctx.lineWidth = 2.2; ctx.lineCap = "round";
          ctx.beginPath(); ctx.moveTo(x, py); ctx.lineTo(x + 18, py + 6 * (r3 - .5) * 2); ctx.stroke(); break;
        case "ore": if (r3 > .35) { ctx.fillStyle = `rgba(251,191,36,${.35 + .4 * Math.abs(Math.sin(this.time * 2 + c + i))})`;
          ctx.beginPath(); ctx.moveTo(x, py - 4); ctx.lineTo(x + 4, py); ctx.lineTo(x, py + 4); ctx.lineTo(x - 4, py); ctx.fill(); } break;
        case "crys": ctx.fillStyle = `hsla(${190 + r3 * 120},80%,65%,${.2 + .25 * Math.abs(Math.sin(this.time + c * 1.7))})`;
          ctx.beginPath(); ctx.moveTo(x, py - 7); ctx.lineTo(x + 4, py); ctx.lineTo(x - 4, py); ctx.fill(); break;
        case "lava": ctx.strokeStyle = `rgba(251,113,22,${.25 + .35 * Math.abs(Math.sin(this.time * 1.5 + c))})`; ctx.lineWidth = 1.8;
          ctx.beginPath(); ctx.moveTo(x, py); ctx.lineTo(x + 12, py + 8 * (r3 - .5)); ctx.lineTo(x + 20, py + 14 * (r2 - .5)); ctx.stroke(); break;
      }
    }
    // creatures: up to 2 per 210px cell
    for (let c = Math.max(0, Math.floor((cx - 40) / 210)); c < (cx + w + 40) / 210; c++) {
      const n = Math.floor(hash(i, c, 20) * 2.4);
      for (let k = 0; k < n; k++) {
        const type = b.c[Math.floor(hash(i, c, 30 + k) * b.c.length)], kd = KIND[type], ph = hash(i, c, 40 + k) * TAU;
        const m = this.time * kd.v + ph, bx = c * 210 + hash(i, c, 50 + k) * 210;
        let x = bx + Math.sin(m) * kd.r - cx, yy = y + kd.y * LH;
        if (kd.fly) yy += Math.sin(m * 2.3) * 22;
        ctx.save(); ctx.translate(x, yy);
        ctx.scale(kd.v && Math.cos(m) < 0 ? -1.5 : 1.5, 1.5);
        U[kd.base || type](ctx, this.time, ph, { ...kd, hue: 170 + hash(i, c, 60) * 160 });
        ctx.restore();
      }
    }
    // layer 1: the two sprite beetles crawl around
    if (i === 0) {
      for (let c = Math.max(0, Math.floor((cx - 60) / 230)); c < (cx + w + 60) / 230; c++) {
        for (let k = 0; k < 2; k++) {
          if (hash(0, c, 70 + k) < .3) continue;
          const which = hash(0, c, 80 + k) < .5 ? "beetleBlue" : "beetlePurple";
          const ph = hash(0, c, 90 + k) * TAU, sp = .35 + hash(0, c, 95 + k) * .35;
          const m = this.time * sp + ph, bx = c * 230 + 40 + k * 110 + hash(0, c, 100 + k) * 60;
          ctx.save(); ctx.translate(bx + Math.sin(m) * 55 - cx, y + LH - 10 - k * 22);
          drawFrame(ctx, SPR[which], Math.floor(walked(55, m) / 2.6) % 8, 38, Math.cos(m) >= 0 ? 1 : -1, 0, 0);
          ctx.restore();
        }
      }
    }
    ctx.restore();
    // layer divider
    ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.fillRect(0, y, w, 2);
  }

  drawHole(ctx, hole, cx, cy) {
    const x = holeX(hole) - cx, top = SURF - cy, dep = hole.depth * LH;
    if (x < -90 || x > this.w + 90 || top > this.h) return;
    const lockBottom = SURF + this.unlocked() * LH;
    const shaftH = Math.min(dep, lockBottom - SURF);       // never draw into fog
    const own = hole.owner === this.owner;
    // shaft
    const g = ctx.createLinearGradient(x - 38, 0, x + 38, 0);
    g.addColorStop(0, "#1c1917"); g.addColorStop(.5, "#050403"); g.addColorStop(1, "#1c1917");
    ctx.fillStyle = g; ctx.fillRect(x - 38, top, 76, shaftH);
    ctx.strokeStyle = own ? "#fbbf24" : "#57534e"; ctx.lineWidth = 2; ctx.strokeRect(x - 38, top, 76, shaftH);
    // rungs
    ctx.strokeStyle = "rgba(255,255,255,.06)"; ctx.lineWidth = 1;
    for (let y = LH; y < shaftH; y += LH) { ctx.beginPath(); ctx.moveTo(x - 38, top + y); ctx.lineTo(x + 38, top + y); ctx.stroke(); }
    // mound + opening
    ctx.fillStyle = "#6b4423"; ctx.beginPath(); ctx.ellipse(x, top + 2, 56, 15, 0, Math.PI, TAU); ctx.fill();
    ctx.fillStyle = "#050403"; ctx.beginPath(); ctx.ellipse(x, top, 44, 14, 0, 0, TAU); ctx.fill();
    // profile sign on the surface so every hole is recognisable at a glance
    ctx.strokeStyle = "#78350f"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, top - 14); ctx.lineTo(x, top - 34); ctx.stroke();
    this.avatar(ctx, hole, x, top - 56, 40, own);
    this.nameTag(ctx, hole, x, top - 78);
    // burrow chamber at the bottom of the shaft: bigger picture + name, sinks as the hole deepens
    if (dep <= lockBottom - SURF) {
      const by = top + dep;
      ctx.fillStyle = "#0c0a09"; ctx.beginPath(); ctx.ellipse(x, by - 24, 58, 42, 0, 0, TAU); ctx.fill();
      this.avatar(ctx, hole, x, by - 30, 60, own);
      hole._tag = [x, by + 20];   // drawn after the fog so it stays readable
    }
    hole._hit = { x: x + cx - 52, y: SURF - 90, w: 104, h: Math.max(100, shaftH + 96) };
  }

  // round profile picture (falls back to a rabbit face in the owner's colours)
  avatar(ctx, hole, x, y, size, own) {
    const r = size / 2, img = getImage(hole.image);
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
    if (img?.complete && img.naturalWidth) {
      const sc = Math.max(size / img.naturalWidth, size / img.naturalHeight), dw = img.naturalWidth * sc, dh = img.naturalHeight * sc;
      ctx.drawImage(img, x - dw / 2, y - dh / 2, dw, dh);
    } else {
      const c = hole.customRabbit?.color || "#94a3b8", e = hole.customRabbit?.earColor || "#64748b";
      ctx.fillStyle = "#1e293b"; ctx.fillRect(x - r, y - r, size, size);
      ctx.fillStyle = e; ctx.beginPath(); ctx.ellipse(x - r * .35, y - r * .55, r * .17, r * .5, -.15, 0, TAU); ctx.ellipse(x + r * .35, y - r * .55, r * .17, r * .5, .15, 0, TAU); ctx.fill();
      ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y + r * .15, r * .55, r * .5, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = "#0f172a"; ctx.beginPath(); ctx.arc(x - r * .2, y + r * .05, r * .07, 0, TAU); ctx.arc(x + r * .2, y + r * .05, r * .07, 0, TAU); ctx.fill();
      ctx.fillStyle = "#f43f5e"; ctx.beginPath(); ctx.arc(x, y + r * .22, r * .07, 0, TAU); ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = own ? "#fbbf24" : "#f8fafc"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
  }

  nameTag(ctx, hole, x, y) {
    let n = hole.username || `Rabbit #${hole.id}`; if (n.length > 14) n = n.slice(0, 13) + "…";
    ctx.font = "bold 12px system-ui"; ctx.textAlign = "center";
    const w = ctx.measureText(n).width + 14;
    ctx.fillStyle = "rgba(2,6,23,.78)"; ctx.beginPath(); ctx.roundRect(x - w / 2, y - 12, w, 20, 10); ctx.fill();
    ctx.fillStyle = "#f1f5f9"; ctx.fillText(n, x, y + 2);
  }

  handleClick(e) {
    const r = this.canvas.getBoundingClientRect();
    const mx = e.clientX - r.left + this.camX, my = e.clientY - r.top + this.camY;
    for (const hole of this.holes) {
      const b = hole._hit;
      if (b && mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) { this.onHoleClick(hole); return; }
    }
  }
}
