/**
 * Isometric burrow room. Tile-based floor, two walls with the owner's picture,
 * depth-based biome/props, 4-direction + click-to-move rabbit.
 */
import { getImage, getGallery, floorCount } from "./data.js?v=6";
import { TAU, hash, biome, hsl } from "./world.js?v=6";

const N = 8, TW = 72, TH = 36, WH = 150;
// wall picture frames: 3 per wall, positions along the wall (in tiles) and size
const SLOT_X = [0.5, 3.2, 5.9], SLOT_W = 1.6, SLOT_H = 64, SLOT_Y = -WH + 20;
const slotU0 = (i) => (i < 3 ? SLOT_X[2 - i] : SLOT_X[i - 3]);   // slots count left -> right on screen
const modalOpen = () => !!document.querySelector(".modal:not(.hidden), .lightbox:not(.hidden)");
const PROPS = {
  shallow: ["mushroom", "lamp", "rock", "barrel", "plant"],
  deep: ["crystal", "chest", "bones", "lamp", "rock"]
};

export class RoomRenderer {
  constructor(canvas, { onFrame = () => {} } = {}) {
    this.canvas = canvas; this.ctx = canvas.getContext("2d"); this.onFrame = onFrame;
    this.keys = {}; this.player = null; this.raf = null; this.hole = null; this.time = 0;
    this.hover = -1; this.isOwner = false;
    new ResizeObserver(() => { if (this.player) this.resize(); }).observe(canvas);
    const typing = (e) => /INPUT|TEXTAREA|SELECT/.test(e.target.tagName);
    window.addEventListener("keydown", (e) => {
      if (!this.player || typing(e) || modalOpen()) return;
      if (e.key.startsWith("Arrow") || "wasdWASD".includes(e.key)) e.preventDefault();
      this.keys[e.key.toLowerCase()] = true; this.player.target = null;
    });
    window.addEventListener("keyup", (e) => { this.keys[e.key.toLowerCase()] = false; });
    canvas.addEventListener("pointerdown", (e) => this.clickMove(e));
    canvas.addEventListener("pointermove", (e) => {
      if (!this.player) return;
      const i = this.frameAt(...this.scenePoint(e));
      this.hover = i >= 0 && (this.slotItem(i) || this.isOwner) ? i : -1;
      canvas.style.cursor = this.hover >= 0 ? "pointer" : "default";
    });
    canvas.addEventListener("pointerleave", () => { this.hover = -1; canvas.style.cursor = "default"; });
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2), r = this.canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    this.canvas.width = Math.floor(r.width * dpr); this.canvas.height = Math.floor(r.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = r.width; this.h = r.height;
    this.scale = Math.min(1.25, this.w / (N * TW + 90), this.h / (N * TH + WH + 130));
  }

  enter(hole, isOwner = false, floor = 0) {
    this.leave(); this.hole = hole; this.floor = floor; this.time = 0; this.isOwner = isOwner; this.resize();
    const r = hole.customRabbit || {};
    this.player = {
      gx: N / 2, gy: N / 2, face: 1, walk: 0, target: null, blink: 0,
      color: isOwner ? r.color || "#f59e0b" : "#94a3b8",
      ear: isOwner ? r.earColor || "#d97706" : "#64748b"
    };
    this.fade = 0; this.pending = null; this.cool = 60;
    this.buildProps();
    const loop = () => { this.raf = requestAnimationFrame(loop); this.time += 0.016; this.update(); this.draw(); };
    loop();
  }
  leave() { if (this.raf) cancelAnimationFrame(this.raf); this.raf = null; this.player = null; this.hole = null; this.keys = {}; }

  // Every 3 depth levels add one floor. Floor f has its own look; stairs link neighbours.
  buildProps() {
    const d = this.hole.depth, f = this.floor, seed = this.hole.id * 31 + f * 7;
    this.floors = floorCount(d);
    this.floor = Math.min(f, this.floors - 1);
    this.biome = biome(this.floor * 2);
    this.stairs = [];
    if (this.floor < this.floors - 1) this.stairs.push({ type: "down", gx: N - 1.4, gy: 1.4 });
    if (this.floor > 0) this.stairs.push({ type: "up", gx: 1.4, gy: N - 1.4 });
    const P = (type, gx, gy) => ({ type, gx, gy, ph: hash(seed, gx, gy) * TAU });
    if (this.floor === 0) {       // the cosy burrow home
      this.props = [P("rug", 4, 4), P("bed", 1.3, 2.4), P("barrel", 1.2, 4.6), P("table", 5.4, 5.2),
        P("plant", 5.8, 6.6), P("lamp", 3.2, 6.6), P("mushroom", 6.4, 3.4)];
    } else {
      const set = this.floor > 2 ? PROPS.deep : PROPS.shallow;
      this.props = [P("rug", 4, 4)];
      for (let k = 0; k < 7; k++) {
        const o = P(set[Math.floor(hash(seed, k) * set.length)], 1 + hash(seed, k, 1) * (N - 2), 1 + hash(seed, k, 2) * (N - 2));
        if (Math.hypot(o.gx - N / 2, o.gy - N / 2) > 1.4 && this.stairs.every((t) => Math.hypot(o.gx - t.gx, o.gy - t.gy) > 1.6)) this.props.push(o);
      }
    }
  }

  switchFloor() {
    const p = this.player, going = this.dir;
    this.floor = this.pending; this.pending = null; this.cool = 60; this.buildProps();
    const s = this.stairs.find((q) => q.type === (going === "down" ? "up" : "down")), k = s.type === "up" ? 1 : -1;
    p.gx = s.gx + 1.3 * k; p.gy = s.gy - 1.3 * k; p.target = null;
  }

  iso(gx, gy) { return { x: (gx - gy) * TW / 2, y: (gx + gy) * TH / 2 - N * TH / 2 }; }

  // pointer position in scene units (the same space the room is drawn in)
  scenePoint(e) {
    const r = this.canvas.getBoundingClientRect(), s = this.scale;
    return [(e.clientX - r.left - this.w / 2) / s, (e.clientY - r.top - this.h / 2 - 30) / s];
  }

  // which wall frame (0-5) is under a scene point, or -1
  frameAt(sx, sy) {
    const top = this.iso(0, 0);
    for (let i = 0; i < 6; i++) {
      const left = i < 3, u0 = slotU0(i);
      const u = (sx - top.x) / (left ? -TW / 2 : TW / 2);
      const v = sy - top.y - u * TH / 2;
      if (u >= u0 - .08 && u <= u0 + SLOT_W + .08 && v >= SLOT_Y - 6 && v <= SLOT_Y + SLOT_H + 6) return i;
    }
    return -1;
  }

  // picture hanging in a slot. The centre frame of the right wall falls back to the profile picture.
  slotItem(i) {
    const it = getGallery(this.hole, this.floor)[i];
    if (it?.url) return it;
    if (i === 4 && this.hole.image) return { url: this.hole.image, title: this.hole.username, fallback: true };
    return null;
  }

  clickMove(e) {
    if (!this.player) return;
    const [x, y] = this.scenePoint(e), s = this.scale;
    const fi = this.frameAt(x, y);
    if (fi >= 0) {
      const item = this.slotItem(fi);
      if (item) { this.onFrame({ floor: this.floor, slot: fi, item, hole: this.hole }); return; }
      if (this.isOwner) { this.onFrame({ floor: this.floor, slot: fi, item: null, hole: this.hole }); return; }
    }
    const A = 2 * x / TW, B = 2 * (y + N * TH / 2) / TH;
    this.player.target = { gx: Math.max(.4, Math.min(N - .4, (A + B) / 2)), gy: Math.max(.4, Math.min(N - .4, (B - A) / 2)) };
  }

  update() {
    const p = this.player; if (!p) return;
    if (this.pending !== null) { this.fade += .08; if (this.fade >= 1) this.switchFloor(); return; }
    if (this.fade > 0) this.fade = Math.max(0, this.fade - .06);
    if (this.cool > 0) this.cool--;
    const k = this.keys; let sx = (k.arrowright || k.d ? 1 : 0) - (k.arrowleft || k.a ? 1 : 0), sy = (k.arrowdown || k.s ? 1 : 0) - (k.arrowup || k.w ? 1 : 0);
    if (!sx && !sy && p.target) {
      const dx = p.target.gx - p.gx, dy = p.target.gy - p.gy, d = Math.hypot(dx, dy);
      if (d < .08) p.target = null;
      else { const gx = dx / d, gy = dy / d; sx = gx - gy; sy = (gx + gy); }
    }
    // screen direction -> grid direction (right = +gx -gy, down = +gx +gy)
    const mx = sx + sy, my = sy - sx, len = Math.hypot(mx, my);
    if (len) {
      const sp = .055;
      p.gx += (mx / len) * sp; p.gy += (my / len) * sp;
      if (sx) p.face = sx > 0 ? 1 : -1;
      p.walk += .3;
    } else p.walk *= .8;
    p.gx = Math.max(.4, Math.min(N - .4, p.gx)); p.gy = Math.max(.4, Math.min(N - .4, p.gy));
    this.props.forEach((o) => { // solid props push the rabbit out
      if (["mushroom", "bones", "rug"].includes(o.type)) return;
      const dx = p.gx - o.gx, dy = p.gy - o.gy, d = Math.hypot(dx, dy);
      if (d < .5 && d > 0) { p.gx = o.gx + dx / d * .5; p.gy = o.gy + dy / d * .5; }
    });
    if (!this.cool) for (const st of this.stairs) if (Math.hypot(p.gx - st.gx, p.gy - st.gy) < .6) {
      this.pending = st.type === "down" ? this.floor + 1 : this.floor - 1; this.dir = st.type; break;
    }
    p.blink = (this.time % 3.4) < .12 ? 1 : 0;
  }

  draw() {
    const ctx = this.ctx, w = this.w, h = this.h, b = this.biome, depth = this.hole.depth;
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, hsl(b, 2)); bg.addColorStop(1, hsl(b, -9));
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);

    ctx.save(); ctx.translate(w / 2, h / 2 + 30); ctx.scale(this.scale, this.scale);
    this.drawWalls(ctx, b, depth);
    this.drawFloor(ctx, b);
    this.props.forEach((o) => o.type === "rug" && this.drawRug(ctx, o));
    // y-sort props + rabbit
    const list = [...this.stairs.map((t) => ({ z: t.gx + t.gy - .3, f: () => this.drawStairs(ctx, t) })),
      ...this.props.filter((o) => o.type !== "rug").map((o) => ({ o, z: o.gx + o.gy, f: () => this.drawProp(ctx, o) })),
      { z: this.player.gx + this.player.gy, f: () => this.drawRabbit(ctx, this.player) }].sort((a, c) => a.z - c.z);
    list.forEach((it) => it.f());
    ctx.restore();

    if (this.fade > 0) { ctx.fillStyle = `rgba(0,0,0,${Math.min(1, this.fade)})`; ctx.fillRect(0, 0, w, h); }
    ctx.fillStyle = "rgba(0,0,0,.5)"; ctx.beginPath(); ctx.roundRect(14, 14, 210, 30, 8); ctx.fill();
    ctx.fillStyle = "#f1f5f9"; ctx.font = "600 13px system-ui"; ctx.textAlign = "left";
    ctx.fillText(`Floor ${this.floor + 1} of ${this.floors} · ${b.name}`, 26, 34);
    ctx.fillStyle = "rgba(255,255,255,.5)"; ctx.font = "13px system-ui"; ctx.textAlign = "center";
    ctx.fillText(this.floors > 1 ? "Arrows / WASD or click the floor to move • click a picture to view it • stairs change floor" : "Arrows / WASD or click the floor to move • click a picture to view it", w / 2, h - 16);
  }

  drawRug(ctx, o) {
    const q = (dx, dy) => this.iso(o.gx + dx, o.gy + dy);
    [[1.7, 1.1, "#9f1239"], [1.45, .86, "#fda4af"], [1.2, .62, "#9f1239"]].forEach(([rx, ry, c]) => {
      const A = q(-rx, -ry), B = q(rx, -ry), C = q(rx, ry), D = q(-rx, ry);
      ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(A.x, A.y + TH / 2); ctx.lineTo(B.x, B.y + TH / 2); ctx.lineTo(C.x, C.y + TH / 2); ctx.lineTo(D.x, D.y + TH / 2); ctx.fill();
    });
  }

  drawStairs(ctx, st) {
    const p = this.iso(st.gx, st.gy), up = st.type === "up", bob = Math.sin(this.time * 3) * 3;
    ctx.save(); ctx.translate(p.x, p.y + TH / 2);
    ctx.fillStyle = "rgba(0,0,0,.45)"; ctx.beginPath(); ctx.ellipse(0, 0, 34, 16, 0, 0, TAU); ctx.fill();
    for (let k = 0; k < 4; k++) {
      const y = up ? -k * 9 : k * 3, w = 30 - k * (up ? 4 : 5);
      ctx.fillStyle = `hsl(30,25%,${up ? 46 - k * 3 : 24 - k * 4}%)`; ctx.beginPath(); ctx.roundRect(-w, y - 9, w * 2, 9, 2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.12)"; ctx.fillRect(-w, y - 9, w * 2, 2);
    }
    ctx.fillStyle = up ? "#4ade80" : "#fbbf24"; ctx.beginPath();
    const ay = (up ? -52 : -34) + bob; ctx.moveTo(-9, ay + (up ? 8 : 0)); ctx.lineTo(9, ay + (up ? 8 : 0)); ctx.lineTo(0, ay + (up ? -4 : 12)); ctx.fill();
    ctx.restore();
  }

  drawFloor(ctx, b) {
    for (let gx = 0; gx < N; gx++) for (let gy = 0; gy < N; gy++) {
      const a = this.iso(gx, gy), r = hash(this.hole.id, gx, gy);
      ctx.fillStyle = hsl(b, 4 + ((gx + gy) & 1) * 3 + r * 3);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(a.x + TW / 2, a.y + TH / 2); ctx.lineTo(a.x, a.y + TH); ctx.lineTo(a.x - TW / 2, a.y + TH / 2); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,.25)"; ctx.lineWidth = 1; ctx.stroke();
      if (r > .7) { ctx.fillStyle = "rgba(255,255,255,.08)"; ctx.beginPath(); ctx.ellipse(a.x + (r - .85) * 30, a.y + TH / 2, 4, 2, 0, 0, TAU); ctx.fill(); }
    }
    // front edge thickness
    const L = this.iso(0, N), B = this.iso(N, N), R = this.iso(N, 0);
    ctx.fillStyle = hsl(b, -10);
    ctx.beginPath(); ctx.moveTo(L.x - TW / 2, L.y + TH / 2); ctx.lineTo(B.x, B.y + TH); ctx.lineTo(B.x, B.y + TH + 14); ctx.lineTo(L.x - TW / 2, L.y + TH / 2 + 14); ctx.fill();
    ctx.fillStyle = hsl(b, -14);
    ctx.beginPath(); ctx.moveTo(R.x + TW / 2, R.y + TH / 2); ctx.lineTo(B.x, B.y + TH); ctx.lineTo(B.x, B.y + TH + 14); ctx.lineTo(R.x + TW / 2, R.y + TH / 2 + 14); ctx.fill();
  }

  drawWalls(ctx, b, depth) {
    const T = this.iso(0, 0), Lc = this.iso(0, N), Rc = this.iso(N, 0), top = { x: T.x, y: T.y };
    // left wall (gx = 0 edge) and right wall (gy = 0 edge)
    [[Lc, -8, 0], [Rc, -14, 1]].forEach(([c, dl, side]) => {
      const g = ctx.createLinearGradient(0, top.y - WH, 0, top.y);
      g.addColorStop(0, hsl(b, dl - 6)); g.addColorStop(1, hsl(b, dl + 3));
      ctx.fillStyle = g; ctx.beginPath();
      const ox = 0, oy = 0;
      ctx.moveTo(top.x, top.y); ctx.lineTo(c.x, c.y); ctx.lineTo(c.x, c.y - WH); ctx.lineTo(top.x, top.y - WH); ctx.closePath(); ctx.fill();
      // strata + speckles along the wall
      for (let k = 0; k < N; k++) {
        const t0 = k / N, ex = top.x + (c.x - top.x) * t0, ey = top.y + (c.y - top.y) * t0;
        for (let j = 0; j < 4; j++) {
          const r = hash(this.hole.id, k * 4 + j, side);
          ctx.fillStyle = r > .5 ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.14)";
          ctx.fillRect(ex + (side ? 1 : -1) * r * 8, ey - 14 - j * 36 - r * 8, side ? 24 : -24, 4 + r * 6);
        }
      }
    });
    this.drawFrames(ctx);
    if (this.floor === 0) {   // low bookcase under the pictures
      ctx.save(); ctx.translate(top.x, top.y); ctx.transform(-TW / 2, TH / 2, 0, 1, 0, 0);
      ctx.fillStyle = "#5b3a1a"; ctx.fillRect(.4, -58, 3.2, 58);
      ctx.fillStyle = "#2b1a0b"; ctx.fillRect(.5, -55, 3, 52);
      ctx.fillStyle = "#5b3a1a"; ctx.fillRect(.4, -31, 3.2, 3);
      for (let r = 0; r < 2; r++) {
        const yb = r ? -31 : -3;
        for (let k = 0; k < 8; k++) {
          const bh = 15 + ((k * 7 + r * 3) % 5) * 2;
          ctx.fillStyle = `hsl(${(r * 70 + k * 53) % 360},55%,${40 + (k % 2) * 8}%)`;
          ctx.fillRect(.6 + k * .36, yb - bh, .3, bh);
        }
      }
      ctx.restore();
    }
    // wall torch on the left wall (between two frames)
    const tp = this.iso(0, 5.35), fl = Math.sin(this.time * 12) * 1.5;
    ctx.fillStyle = "#44403c"; ctx.fillRect(tp.x - 8, tp.y - 70, 4, 22);
    const gl = ctx.createRadialGradient(tp.x - 6, tp.y - 76, 2, tp.x - 6, tp.y - 76, 70);
    gl.addColorStop(0, "rgba(251,191,36,.45)"); gl.addColorStop(1, "rgba(251,191,36,0)");
    ctx.fillStyle = gl; ctx.fillRect(tp.x - 80, tp.y - 150, 150, 150);
    ctx.fillStyle = "#fb923c"; ctx.beginPath(); ctx.ellipse(tp.x - 6, tp.y - 78, 5, 8 + fl, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#fde047"; ctx.beginPath(); ctx.ellipse(tp.x - 6, tp.y - 76, 2.5, 5 + fl, 0, 0, TAU); ctx.fill();
  }

  // six picture frames per floor, three on each wall
  drawFrames(ctx) {
    const top = this.iso(0, 0), W = SLOT_W, H = SLOT_H, y0 = SLOT_Y, ppt = TW / 2;
    for (let i = 0; i < 6; i++) {
      const item = this.slotItem(i);
      if (!item && !this.isOwner) continue;              // visitors only see hung pictures
      const left = i < 3, u0 = slotU0(i), hov = this.hover === i;
      ctx.save(); ctx.translate(top.x, top.y); ctx.transform(left ? -TW / 2 : TW / 2, TH / 2, 0, 1, 0, 0);
      ctx.translate(left ? u0 + W : u0, 0); ctx.scale(left ? -1 : 1, 1);   // keep pictures un-mirrored on the left wall
      if (hov) { ctx.fillStyle = "rgba(253,224,71,.35)"; ctx.fillRect(-.2, y0 - 12, W + .4, H + 24); }
      ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.fillRect(.05, y0 - 3, W + .18, H + 14);          // soft shadow
      ctx.fillStyle = "#6b4423"; ctx.fillRect(-.09, y0 - 6, W + .18, H + 12);                  // wood frame
      ctx.fillStyle = "#8a5a2b"; ctx.fillRect(-.09, y0 - 6, W + .18, 2);
      ctx.fillStyle = "#1c1917"; ctx.fillRect(0, y0, W, H);
      const img = item ? getImage(item.url) : null;
      if (img?.complete && img.naturalWidth) {
        const sc = Math.max(W * ppt / img.naturalWidth, H / img.naturalHeight);
        const dw = img.naturalWidth * sc / ppt, dh = img.naturalHeight * sc;
        ctx.save(); ctx.beginPath(); ctx.rect(0, y0, W, H); ctx.clip();
        ctx.drawImage(img, (W - dw) / 2, y0 + (H - dh) / 2, dw, dh);
        ctx.fillStyle = "rgba(255,255,255,.10)"; ctx.beginPath();        // glass shine
        ctx.moveTo(0, y0); ctx.lineTo(W * .55, y0); ctx.lineTo(0, y0 + H * .5); ctx.fill();
        ctx.restore();
      } else if (item) { ctx.fillStyle = "#334155"; ctx.fillRect(0, y0, W, H); }
      else {                                                                  // owner sees empty frames with a +
        ctx.fillStyle = "rgba(255,255,255,.07)"; ctx.fillRect(0, y0, W, H);
        ctx.fillStyle = "rgba(255,255,255,.4)";
        ctx.fillRect(W / 2 - .05, y0 + H / 2 - 10, .1, 20); ctx.fillRect(W / 2 - .28, y0 + H / 2 - 1.5, .56, 3);
      }
      ctx.restore();
    }
  }

  drawProp(ctx, o) {
    const p = this.iso(o.gx, o.gy), t = this.time;
    ctx.save(); ctx.translate(p.x, p.y + TH / 2);
    ctx.fillStyle = "rgba(0,0,0,.3)"; ctx.beginPath(); ctx.ellipse(0, 0, 14, 6, 0, 0, TAU); ctx.fill();
    switch (o.type) {
      case "mushroom":
        ctx.fillStyle = "#e7e5e4"; ctx.fillRect(-3, -12, 6, 12);
        ctx.fillStyle = "#ef4444"; ctx.beginPath(); ctx.ellipse(0, -13, 11, 8, 0, Math.PI, TAU); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(-4, -16, 1.8, 0, TAU); ctx.arc(3, -18, 1.5, 0, TAU); ctx.fill(); break;
      case "lamp": {
        const g = ctx.createRadialGradient(0, -26, 2, 0, -26, 60); g.addColorStop(0, "rgba(253,224,71,.4)"); g.addColorStop(1, "rgba(253,224,71,0)");
        ctx.fillStyle = g; ctx.fillRect(-60, -90, 120, 120);
        ctx.fillStyle = "#78350f"; ctx.fillRect(-2.5, -24, 5, 24);
        ctx.fillStyle = "#fbbf24"; ctx.beginPath(); ctx.arc(0, -28, 7 + Math.sin(t * 9 + o.ph), 0, TAU); ctx.fill(); break; }
      case "rock":
        ctx.fillStyle = "#78716c"; ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(-9, -14); ctx.lineTo(4, -17); ctx.lineTo(14, -5); ctx.lineTo(12, 0); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,.18)"; ctx.beginPath(); ctx.moveTo(-9, -14); ctx.lineTo(4, -17); ctx.lineTo(0, -8); ctx.fill(); break;
      case "crystal": {
        const pu = .6 + .4 * Math.sin(t * 2 + o.ph);
        ctx.shadowColor = "#22d3ee"; ctx.shadowBlur = 14 * pu;
        [[-8, 22], [0, 34], [8, 18]].forEach(([x, hh], k) => {
          ctx.fillStyle = `hsl(${185 + k * 20},85%,${55 + pu * 10}%)`;
          ctx.beginPath(); ctx.moveTo(x, -hh); ctx.lineTo(x + 6, -hh * .3); ctx.lineTo(x + 4, 0); ctx.lineTo(x - 4, 0); ctx.lineTo(x - 6, -hh * .3); ctx.fill();
        });
        ctx.shadowBlur = 0; break; }
      case "chest":
        ctx.fillStyle = "#92400e"; ctx.fillRect(-15, -16, 30, 16);
        ctx.fillStyle = "#b45309"; ctx.beginPath(); ctx.ellipse(0, -16, 15, 7, 0, Math.PI, TAU); ctx.fill();
        ctx.fillStyle = "#fbbf24"; ctx.fillRect(-15, -10, 30, 2.5); ctx.fillRect(-2.5, -13, 5, 7);
        ctx.fillStyle = "#fffbeb"; ctx.globalAlpha = .5 + .5 * Math.sin(t * 4 + o.ph); ctx.beginPath(); ctx.arc(8, -20, 1.8, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; break;
      case "bed":
        ctx.fillStyle = "#78350f"; ctx.fillRect(-27, -10, 54, 12); ctx.fillRect(-27, -26, 5, 20);
        ctx.fillStyle = "#3b82f6"; ctx.beginPath(); ctx.roundRect(-25, -22, 50, 15, 6); ctx.fill();
        ctx.fillStyle = "#93c5fd"; ctx.fillRect(-5, -22, 6, 15);
        ctx.fillStyle = "#f8fafc"; ctx.beginPath(); ctx.roundRect(-23, -25, 16, 9, 4); ctx.fill(); break;
      case "table":
        ctx.fillStyle = "#78350f"; ctx.fillRect(-15, -18, 4, 18); ctx.fillRect(11, -18, 4, 18);
        ctx.fillStyle = "#a16207"; ctx.beginPath(); ctx.ellipse(0, -20, 24, 10, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = "#f97316"; ctx.beginPath(); ctx.moveTo(-8, -26); ctx.lineTo(8, -24); ctx.lineTo(-3, -18); ctx.fill();
        ctx.fillStyle = "#4ade80"; ctx.fillRect(-9, -28, 3, 4); break;
      case "barrel":
        ctx.fillStyle = "#92400e"; ctx.beginPath(); ctx.roundRect(-11, -26, 22, 26, 5); ctx.fill();
        ctx.fillStyle = "#b45309"; ctx.beginPath(); ctx.ellipse(0, -26, 11, 4.5, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = "#44403c"; ctx.fillRect(-11, -19, 22, 2.5); ctx.fillRect(-11, -8, 22, 2.5); break;
      case "plant": {
        const sw = Math.sin(t * 1.5 + o.ph) * 3;
        ctx.fillStyle = "#c2410c"; ctx.beginPath(); ctx.moveTo(-8, -12); ctx.lineTo(8, -12); ctx.lineTo(5, 0); ctx.lineTo(-5, 0); ctx.fill();
        ctx.fillStyle = "#22c55e";
        [[-14, -30], [0, -38], [14, -30]].forEach(([x, y]) => { ctx.beginPath(); ctx.moveTo(0, -12); ctx.quadraticCurveTo(x * .8 + sw, y + 14, x + sw, y); ctx.quadraticCurveTo(x * .4, y + 16, 0, -12); ctx.fill(); });
        break; }
      default: // bones
        ctx.strokeStyle = "#e7e5e4"; ctx.lineWidth = 3; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(-12, -2); ctx.lineTo(10, -6); ctx.moveTo(-8, -8); ctx.lineTo(8, 1); ctx.stroke();
        ctx.fillStyle = "#e7e5e4"; ctx.beginPath(); ctx.arc(2, -8, 5, 0, TAU); ctx.fill();
        ctx.fillStyle = "#0f172a"; ctx.fillRect(0, -9, 1.6, 2); ctx.fillRect(3.5, -9, 1.6, 2);
    }
    ctx.restore();
  }

  drawRabbit(ctx, p) {
    const pos = this.iso(p.gx, p.gy), moving = Math.abs(p.walk) > .05;
    const hop = moving ? Math.abs(Math.sin(p.walk)) * 7 : Math.sin(this.time * 2) * .8;
    ctx.save(); ctx.translate(pos.x, pos.y + TH / 2);
    ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.beginPath(); ctx.ellipse(0, 1, 19 - hop * .6, 7 - hop * .2, 0, 0, TAU); ctx.fill();
    ctx.translate(0, -hop); ctx.scale(p.face, 1);
    const dark = p.ear, c = p.color;
    // tail
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(-19, -14, 6, 0, TAU); ctx.fill();
    // hind & front feet
    const ft = Math.sin(p.walk) * 5;
    ctx.fillStyle = dark; ctx.beginPath(); ctx.ellipse(-8 + ft, -2, 9, 5, 0, 0, TAU); ctx.ellipse(10 - ft, -1, 6, 4, 0, 0, TAU); ctx.fill();
    // body
    const bg = ctx.createLinearGradient(0, -40, 0, 0); bg.addColorStop(0, c); bg.addColorStop(1, dark);
    ctx.fillStyle = bg; ctx.beginPath(); ctx.ellipse(-2, -18, 19, 17 + Math.sin(this.time * 2.4) * .6, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.beginPath(); ctx.ellipse(3, -13, 10, 10, 0, 0, TAU); ctx.fill();
    // ears (sway/flop)
    const sw = Math.sin(this.time * 3) * .06 + (moving ? Math.sin(p.walk) * .12 : 0);
    [[1, -.18], [-5, .1]].forEach(([x, r], k) => {
      ctx.save(); ctx.translate(x + 7, -50); ctx.rotate(r - sw * (k ? -1 : 1) - .1);
      ctx.fillStyle = k ? dark : c; ctx.beginPath(); ctx.ellipse(0, -14, 5.5, 17, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = "#fda4af"; ctx.beginPath(); ctx.ellipse(0, -13, 2.6, 12, 0, 0, TAU); ctx.fill(); ctx.restore();
    });
    // head
    ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(8, -40, 15, 13, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.4)"; ctx.beginPath(); ctx.ellipse(14, -35, 8, 6, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#fda4af"; ctx.beginPath(); ctx.arc(12, -34, 3, 0, TAU); ctx.fill();    // cheek
    // eye (blinks)
    if (p.blink) { ctx.strokeStyle = "#0f172a"; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(10, -42); ctx.lineTo(16, -42); ctx.stroke(); }
    else { ctx.fillStyle = "#0f172a"; ctx.beginPath(); ctx.ellipse(14, -43, 3.2, 4, 0, 0, TAU); ctx.fill(); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(15, -44.5, 1.3, 0, TAU); ctx.fill(); }
    // nose + whiskers
    ctx.fillStyle = "#f43f5e"; ctx.beginPath(); ctx.arc(21, -39, 2.2, 0, TAU); ctx.fill();
    ctx.strokeStyle = "rgba(15,23,42,.5)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(19, -37); ctx.lineTo(30, -39); ctx.moveTo(19, -36); ctx.lineTo(30, -34); ctx.stroke();
    ctx.restore();
  }
}
