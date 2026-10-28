'use strict';
// ---------------------------------------------------------------- constants & helpers
const W = 1152, H = 648, T = 32;
const TL = { FLOOR: 0, WALL: 1, GATE: 2, EXIT: 3, PIT: 4, CRACK: 5, SPIKE: 6, AGATE: 7, VOID: 9 };
const R = (a, b) => a + Math.random() * (b - a);
const RI = (a, b) => Math.floor(R(a, b + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const hyp = Math.hypot;
const lerp = (a, b, t) => a + (b - a) * t;
const angDiff = (a, b) => { let d = (a - b) % 6.2832; if (d > 3.1416) d -= 6.2832; if (d < -3.1416) d += 6.2832; return d; };
const hash = (x, y) => { let h = x * 374761393 + y * 668265263; h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) >>> 0) / 4294967296; };
function seeded(seed) { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// ---------------------------------------------------------------- global game state
const G = {
  mode: 'hub', map: null, heroes: [], foes: [], allies: [], shots: [], hazards: [], spawners: [], pickups: [], props: [],
  parts: [], corpses: [], texts: [], rings: [], beams: [], decals: [],
  gold: 0, floorGold: 0, time: 0, hitstop: 0, trauma: 0, flash: 0, flashCol: '#fff',
  cam: { x: 0, y: 0 }, boss: null, exitT: -1, exitOpen: true, arena: null, worldIdx: 0, floorIdx: 0, endless: 0,
  stats: null, banner: null, msgs: [], deathsRun: 0, darkness: false, gimmick: null, gimmickT: 0, reaperT: 0,
};
let flowDist = null, flowQ = null, flowT = 0;

// ---------------------------------------------------------------- map building
function parseMap(rows, theme, opts = {}) {
  const h = rows.length, w = Math.max(...rows.map(r => r.length));
  const m = { w, h, t: new Uint8Array(w * h), theme, starts: [], exit: null, torches: [], graves: [], pylons: [], bossAt: null, reapers: [], arenaTiles: [], agates: [], spawns: [], dark: !!opts.dark, items: [] };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = rows[y][x] || ' ', i = y * w + x, px = (x + 0.5) * T, py = (y + 0.5) * T;
    let t = TL.FLOOR;
    switch (c) {
      case '#': t = TL.WALL; break; case ' ': t = TL.VOID; break;
      case 't': t = TL.WALL; m.torches.push({ x: px, y: y * T + 26 }); break;
      case '=': t = TL.GATE; (m.gateTiles || (m.gateTiles = new Set())).add(i); break; case '%': t = TL.CRACK; break; case '~': t = TL.PIT; break; case '^': t = TL.SPIKE; break;
      case '_': t = TL.FLOOR; m.agates.push(i); break;
      case 'X': t = TL.EXIT; m.exit = { x: px, y: py, i }; break;
      case 'S': m.starts.push({ x: px, y: py }); break;
      case 'a': m.arenaTiles.push(i); break;
      case 'g': m.graves.push({ x: px, y: py }); break;
      case 'P': m.pylons.push({ x: px, y: py }); break;
      case 'B': m.bossAt = { x: px, y: py }; break;
      case 'R': m.reapers.push({ x: px, y: py }); break;
      case '1': case '2': case '3': m.spawns.push({ kind: 'spawner', tier: +c, x: px, y: py }); break;
      case '.': break;
      default: m.items.push({ c, x: px, y: py });
    }
    m.t[i] = t;
  }
  // rooms (Slayer-style stages): per-tile room id, -1 = corridor / no room. Arena rooms start awake (the arena runs its own waves).
  m.rooms = rows.rooms || []; m.roomOf = new Int16Array(w * h).fill(-1); m.awake = new Uint8Array(m.rooms.length);
  m.rooms.forEach((r, k) => { for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) m.roomOf[y * w + x] = k; if (r.arena) m.awake[k] = 1; });
  return m;
}
const roomAt = (x, y) => { const m = G.map; if (!m || !m.roomOf) return -1; const tx = Math.floor(x / T), ty = Math.floor(y / T); return tx < 0 || ty < 0 || tx >= m.w || ty >= m.h ? -1 : m.roomOf[ty * m.w + tx]; };
const roomAsleep = r => r >= 0 && G.map && G.map.awake && !G.map.awake[r];
const tileAt = (tx, ty) => (tx < 0 || ty < 0 || tx >= G.map.w || ty >= G.map.h) ? TL.VOID : G.map.t[ty * G.map.w + tx];
const blocksWalk = (t, fly) => t === TL.WALL || t === TL.GATE || t === TL.CRACK || t === TL.VOID || t === TL.AGATE || (!fly && t === TL.PIT);
const blocksShot = t => t === TL.WALL || t === TL.GATE || t === TL.CRACK || t === TL.VOID || t === TL.AGATE;
const solidAt = (x, y, fly) => blocksWalk(tileAt(Math.floor(x / T), Math.floor(y / T)), fly);
const shotSolid = (x, y) => blocksShot(tileAt(Math.floor(x / T), Math.floor(y / T)));
function collide(x, y, r, fly) {
  const x0 = Math.floor((x - r) / T), x1 = Math.floor((x + r - 0.01) / T), y0 = Math.floor((y - r) / T), y1 = Math.floor((y + r - 0.01) / T);
  let hit = null;
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    const t = tileAt(tx, ty);
    if (blocksWalk(t, fly)) { if (t === TL.GATE) return { tx, ty, gate: true }; hit = { tx, ty }; }
  }
  return hit;
}
function moveEnt(e, dx, dy, fly, onBlock) {
  let blocked = false;
  const steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 8) || 1;
  for (let s = 0; s < steps; s++) {
    const sx = dx / steps, sy = dy / steps;
    if (sx) { const h = collide(e.x + sx, e.y, e.r, fly); if (!h) e.x += sx; else { blocked = true; onBlock && onBlock(h); if (e.isHero && !sy) slideAssist(e, sx, 0, fly); } }
    if (sy) { const h = collide(e.x, e.y + sy, e.r, fly); if (!h) e.y += sy; else { blocked = true; onBlock && onBlock(h); if (e.isHero && !sx) slideAssist(e, 0, sy, fly); } }
  }
  return blocked;
}
// heroes pushing straight into a wall corner get nudged toward a nearby opening (doorway forgiveness, matters for big heroes)
function slideAssist(e, sx, sy, fly) {
  const step = Math.max(Math.abs(sx), Math.abs(sy)) * 1.2, vert = !!sy, c = vert ? e.x : e.y;
  let best = null, bd = T * 0.7;
  for (const k of [0, -1, 1]) { const cc = (Math.floor(c / T) + k + 0.5) * T, d = Math.abs(cc - c); if (d >= bd) continue;
    const fx = vert ? cc : e.x + Math.sign(sx) * 6, fy = vert ? e.y + Math.sign(sy) * 6 : cc;
    if (!collide(fx, fy, e.r, fly)) { best = cc; bd = d; } }
  if (best === null || bd < 0.01) return;
  const mv = Math.sign(best - c) * Math.min(step, bd);
  if (!collide(vert ? e.x + mv : e.x, vert ? e.y : e.y + mv, e.r, fly)) { if (vert) e.x += mv; else e.y += mv; }
}
function los(ax, ay, bx, by) {
  const d = hyp(bx - ax, by - ay), n = Math.ceil(d / 14);
  for (let i = 1; i < n; i++) if (shotSolid(ax + (bx - ax) * i / n, ay + (by - ay) * i / n)) return false;
  return true;
}
function rayWall(x, y, a, maxD) { // distance until a wall along direction
  const cx = Math.cos(a), cy = Math.sin(a);
  for (let d = 0; d < maxD; d += 6) if (shotSolid(x + cx * d, y + cy * d)) return d;
  return maxD;
}
function openGate(tx, ty, by) {
  const st = [[tx, ty]], m = G.map;
  while (st.length) {
    const [x, y] = st.pop(); if (tileAt(x, y) !== TL.GATE) continue;
    m.t[y * m.w + x] = TL.FLOOR; redrawTile(x, y);
    burst((x + 0.5) * T, (y + 0.5) * T, '#a0703a', 10, 140, 3, 0.6);
    st.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  Snd.play('gate'); addTrauma(0.25); flowT = 0;
  if (typeof bankAtGate === 'function') bankAtGate(by, 'open');   // opening a gate banks the party's carried gold, like the exit
}
function breakWall(tx, ty) {
  if (tileAt(tx, ty) !== TL.CRACK) return;
  G.map.t[ty * G.map.w + tx] = TL.FLOOR; redrawTile(tx, ty);
  burst((tx + 0.5) * T, (ty + 0.5) * T, G.map.theme.top, 24, 220, 4, 0.9); Snd.play('crumble'); addTrauma(0.35);
  text((tx + 0.5) * T, ty * T, 'Secret!', '#ffd27a');
  flowT = 0;
}
function setArenaGates(closed) {
  for (const i of G.map.agates) { G.map.t[i] = closed ? TL.AGATE : TL.FLOOR; redrawTile(i % G.map.w, (i / G.map.w) | 0); }
  flowT = 0;
  if (closed && G.map.arenaSet) sealInside(G.map.arenaSet);
}
// ---- anti-stuck (David, Oct 2026): nothing may ever end up inside geometry
// nearest spot (tile centre, then small offsets) where a body of radius r fits; ok(i) optionally restricts the tile (e.g. "inside this room")
function freeSpot(x, y, r, fly, ok, maxR = 14) {
  const m = G.map, tx0 = Math.floor(x / T), ty0 = Math.floor(y / T), cand = [];
  for (let dy = -maxR; dy <= maxR; dy++) for (let dx = -maxR; dx <= maxR; dx++) { const tx = tx0 + dx, ty = ty0 + dy; if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) continue; const i = ty * m.w + tx; if (blocksWalk(m.t[i], fly) || (ok && !ok(i))) continue; const cx = (tx + 0.5) * T, cy = (ty + 0.5) * T; cand.push([hyp(cx - x, cy - y), cx, cy]); }
  cand.sort((a, b) => a[0] - b[0]);
  for (const [, cx, cy] of cand) { if (!collide(cx, cy, r, fly)) return { x: cx, y: cy }; for (const [ox, oy] of [[8, 0], [-8, 0], [0, 8], [0, -8]]) if (!collide(cx + ox, cy + oy, r, fly)) return { x: cx + ox, y: cy + oy }; }
  return null;
}
function unstick(e, ok) {
  if (!collide(e.x, e.y, e.r, false) && (!ok || ok(Math.floor(e.y / T) * G.map.w + Math.floor(e.x / T)))) return false;
  const p = freeSpot(e.x, e.y, e.r, false, ok) || (ok ? freeSpot(e.x, e.y, e.r, false) : null); if (!p) return false;
  e.x = p.x; e.y = p.y; e.kx = e.ky = 0; if (e.isHero) { e.dash = null; e.z = 0; G.unstuck = (G.unstuck || 0) + 1; G.lastUnstuck = { id: e.id, x: p.x, y: p.y, t: G.time }; }
  return true;
}
// a room's gates just shut: everyone (heroes, their pets, revived heroes later) is pulled fully inside; foes caught in a gateway are pushed out of it
function sealInside(set) {
  const inRoom = i => set.has(i), anchor = G.heroes.find(h => !h.dead && inRoom(Math.floor(h.y / T) * G.map.w + Math.floor(h.x / T))) || G.heroes[0];
  for (const h of G.heroes) { const i = Math.floor(h.y / T) * G.map.w + Math.floor(h.x / T);
    if (!inRoom(i) || collide(h.x, h.y, h.r, false)) { const p = freeSpot(inRoom(i) ? h.x : anchor.x, inRoom(i) ? h.y : anchor.y, h.r, false, inRoom); if (p) { if (!inRoom(i)) burst(h.x, h.y, '#fff6c0', 14, 120, 3, 0.5); h.x = p.x; h.y = p.y; h.kx = h.ky = 0; h.dash = null; if (!inRoom(i)) { ring(p.x, p.y, 40, '#fff6c0', 0.4, 3); h.pulledIn = (h.pulledIn || 0) + 1; } } } }
  for (const a of G.allies || []) if (a.hp > 0 && a.owner && collide(a.x, a.y, a.r || 10, false)) unstick(a, inRoom);
  for (const f of G.foes) if (ALIVE(f) && !f.fly && collide(f.x, f.y, f.r, false)) unstick(f);
}

// ---------------------------------------------------------------- map pre-render (procedural tiles)
const TILE_DETAIL = {   // Extended Realms floor dressing
  grass(c, px, py, hv, x, y) { c.fillStyle = 'rgba(120,170,60,0.35)'; for (let k = 0; k < 5; k++) { const gx = px + hash(x + k, y) * 28 + 2, gy = py + hash(x, y + k) * 26 + 4; c.fillRect(gx, gy, 1, 3); c.fillRect(gx + 2, gy - 1, 1, 4); } },
  puddle(c, px, py, hv, x, y) { if (hv > 0.3 && hv < 0.55) { c.fillStyle = 'rgba(60,90,40,0.45)'; c.beginPath(); c.ellipse(px + 16, py + 18, 10 + hv * 8, 5 + hv * 4, 0, 0, 6.283); c.fill(); c.fillStyle = 'rgba(200,255,150,0.12)'; c.fillRect(px + 10, py + 15, 6, 1); } },
  sand(c, px, py, hv, x, y) { c.strokeStyle = 'rgba(255,230,180,0.14)'; c.lineWidth = 1; for (let k = 0; k < 2; k++) { c.beginPath(); const yy = py + 9 + k * 12 + hv * 4; c.moveTo(px + 2, yy); c.quadraticCurveTo(px + 16, yy - 4, px + 30, yy); c.stroke(); } },
  snow(c, px, py, hv, x, y) { c.fillStyle = 'rgba(240,250,255,0.35)'; for (let k = 0; k < 6; k++) c.fillRect(px + hash(x + k, y + 3) * 30, py + hash(x + 5, y + k) * 30, 2, 2); if (hv < 0.2) { c.fillStyle = 'rgba(200,235,255,0.18)'; c.fillRect(px + 2, py + 2, 28, 28); } },
  rune(c, px, py, hv, x, y) { if (hv > 0.82 && hv < 0.9) { c.strokeStyle = 'rgba(190,80,255,0.4)'; c.lineWidth = 1; c.beginPath(); c.arc(px + 16, py + 16, 8, 0, 6.283); c.moveTo(px + 16, py + 8); c.lineTo(px + 16, py + 24); c.moveTo(px + 8, py + 16); c.lineTo(px + 24, py + 16); c.stroke(); } },
};
function renderMapCanvas() {
  const m = G.map; const c = document.createElement('canvas'); c.width = m.w * T; c.height = m.h * T;
  m.canvas = c; m.cx = c.getContext('2d');
  m.cx.fillStyle = '#000'; m.cx.fillRect(0, 0, c.width, c.height);
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) redrawTile(x, y, true);
}
function redrawTile(tx, ty, initial) {
  const m = G.map, x2 = m.cx; if (!x2) return;
  if (!initial) { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (tileAt(tx + dx, ty + dy) !== TL.VOID || (!dx && !dy)) paintTile(x2, tx + dx, ty + dy); }
  else paintTile(x2, tx, ty);
}
function paintTile(x2, x, y) {
  const m = G.map, th = m.theme; if (x < 0 || y < 0 || x >= m.w || y >= m.h) return;
  const t = tileAt(x, y), px = x * T, py = y * T, hv = hash(x, y);
  const wallish = k => k === TL.WALL || k === TL.CRACK || k === TL.VOID;
  if (t === TL.VOID) { // void: draw only if it borders something
    x2.fillStyle = '#000'; x2.fillRect(px, py, T, T);
    let border = false; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const k = tileAt(x + dx, y + dy); if (k !== TL.VOID && k !== TL.WALL) border = true; }
    if (!border) return;
  }
  if (t === TL.WALL || t === TL.CRACK || t === TL.VOID) {
    let border = false; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (!wallish(tileAt(x + dx, y + dy))) border = true;
    x2.fillStyle = '#000'; x2.fillRect(px, py, T, T);
    if (!border) return;
    x2.fillStyle = th.top; x2.fillRect(px, py, T, T);
    x2.fillStyle = 'rgba(0,0,0,0.22)';
    for (let r = 0; r < 4; r++) { x2.fillRect(px, py + r * 8, T, 1); const off = ((r + x) % 2) * 10 + 3; x2.fillRect(px + off, py + r * 8, 1, 8); x2.fillRect(px + off + 15, py + r * 8, 1, 8); }
    x2.fillStyle = 'rgba(255,255,255,0.06)'; x2.fillRect(px, py, T, 2);
    if (!wallish(tileAt(x, y + 1))) { // front face for depth
      x2.fillStyle = th.wall; x2.fillRect(px, py + 16, T, 16);
      x2.fillStyle = 'rgba(0,0,0,0.25)'; x2.fillRect(px + (hv * 20 | 0) + 4, py + 16, 2, 13); x2.fillRect(px, py + 23, T, 1);
      x2.fillStyle = th.dark; x2.fillRect(px, py + 29, T, 3);
    }
    if (t === TL.CRACK) { x2.strokeStyle = 'rgba(0,0,0,0.75)'; x2.lineWidth = 2; x2.beginPath(); x2.moveTo(px + 6, py + 4); x2.lineTo(px + 14, py + 14); x2.lineTo(px + 10, py + 22); x2.lineTo(px + 20, py + 30); x2.moveTo(px + 14, py + 14); x2.lineTo(px + 26, py + 10); x2.stroke(); x2.lineWidth = 1; }
    return;
  }
  // floor-like
  const [fr, fg, fb] = th.floor, s = (hv - 0.5) * 16;
  x2.fillStyle = `rgb(${fr + s | 0},${fg + s | 0},${fb + s | 0})`; x2.fillRect(px, py, T, T);
  x2.fillStyle = 'rgba(0,0,0,0.22)'; x2.fillRect(px, py, T, 1); x2.fillRect(px, py, 1, T);
  if ((x + y) % 2) x2.fillRect(px + 16, py, 1, 16); else x2.fillRect(px, py + 16, 16, 1);
  if (hv < 0.12) { x2.strokeStyle = 'rgba(0,0,0,0.3)'; x2.beginPath(); x2.moveTo(px + 4 + hv * 100, py + 6); x2.lineTo(px + 16, py + 18); x2.lineTo(px + 26, py + 22); x2.stroke(); }
  if (th.detail) TILE_DETAIL[th.detail](x2, px, py, hv, x, y, th);
  if (hv > 0.9) { x2.fillStyle = th.moss; for (let k = 0; k < 7; k++) x2.fillRect(px + hash(x + k, y) * 28 + 2, py + hash(x, y + k) * 28 + 2, 2, 2); }
  if (wallish(tileAt(x, y - 1))) { x2.fillStyle = 'rgba(0,0,0,0.38)'; x2.fillRect(px, py, T, 8); }
  if (wallish(tileAt(x - 1, y))) { x2.fillStyle = 'rgba(0,0,0,0.18)'; x2.fillRect(px, py, 5, T); }
  if (t === TL.PIT) {
    x2.fillStyle = th.pit; x2.fillRect(px, py, T, T);
    if (tileAt(x, y - 1) !== TL.PIT) { x2.fillStyle = th.dark; x2.fillRect(px, py, T, 6); }
    if (th.pitGlow) { x2.fillStyle = th.pitGlow; x2.globalAlpha = 0.35; for (let k = 0; k < 3; k++) x2.fillRect(px + hash(x, y + k) * 26, py + 8 + hash(x + k, y) * 20, 6, 2); x2.globalAlpha = 1; }
  }
  if (t === TL.SPIKE) { x2.fillStyle = 'rgba(0,0,0,0.35)'; for (let k = 0; k < 4; k++) for (let j = 0; j < 4; j++) x2.fillRect(px + 4 + k * 7, py + 4 + j * 7, 3, 3); }
  if (m.arenaSet && m.arenaSet.has(y * m.w + x) && hv > 0.6) { x2.fillStyle = 'rgba(160,30,20,0.12)'; x2.fillRect(px + 6, py + 6, 20, 20); }
}

// ---------------------------------------------------------------- pathing (flow fields toward heroes & allies)
// Two shared flow fields, rebuilt every 0.2s (and at once when a gate or wall changes): one over tile centres for foes that fit a
// one-tile gap, one over tile corners for big foes (a corner is open when the four tiles around it are), so big bodies are routed
// only through gaps they fit. Foes steer with navDir: straight at the target when their whole body has a clear line to it, otherwise
// toward the farthest point down the field they can reach in a straight line (smooth paths around pillars, blocks, pits and gates).
let flowBig = null, flowBigQ = null;
const NAV = { look: 9, repath: 0.25, lineEvery: 0.1, stuckWin: 1.0, stuckMove: 8, sideT: 0.55 };
function computeFlow() {
  const m = G.map, N = m.w * m.h, w = m.w;
  if (!flowDist || flowDist.length !== N) { flowDist = new Int16Array(N); flowQ = new Int32Array(N); }
  flowDist.fill(-1); let h = 0, tl = 0;
  const targets = []; for (const e of G.heroes) if (!e.dead && !e.invis) targets.push(e); for (const a of G.allies) if (a.hp > 0 && !a.orbit) targets.push(a);
  const seed = e => { const i = Math.floor(e.y / T) * w + Math.floor(e.x / T); if (i >= 0 && i < N && flowDist[i] < 0) { flowDist[i] = 0; flowQ[tl++] = i; } };
  for (const e of targets) seed(e);
  while (h < tl) {
    const i = flowQ[h++], d = flowDist[i]; if (d > 400) continue;
    const x = i % w, y = (i / w) | 0;
    if (x + 1 < w && !blocksWalk(m.t[i + 1], false) && flowDist[i + 1] < 0) { flowDist[i + 1] = d + 1; flowQ[tl++] = i + 1; }
    if (x > 0 && !blocksWalk(m.t[i - 1], false) && flowDist[i - 1] < 0) { flowDist[i - 1] = d + 1; flowQ[tl++] = i - 1; }
    if (y + 1 < m.h && !blocksWalk(m.t[i + w], false) && flowDist[i + w] < 0) { flowDist[i + w] = d + 1; flowQ[tl++] = i + w; }
    if (y > 0 && !blocksWalk(m.t[i - w], false) && flowDist[i - w] < 0) { flowDist[i - w] = d + 1; flowQ[tl++] = i - w; }
  }
  // corner field for big bodies
  const vw = w + 1, VN = vw * (m.h + 1);
  if (!flowBig || flowBig.length !== VN) { flowBig = new Int16Array(VN); flowBigQ = new Int32Array(VN); }
  flowBig.fill(-1); h = 0; tl = 0;
  for (const e of targets) { const cx = Math.round(e.x / T), cy = Math.round(e.y / T);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const vx = cx + dx, vy = cy + dy; if (!cornerOpen(vx, vy)) continue; const j = vy * vw + vx; if (flowBig[j] < 0 && hyp(vx * T - e.x, vy * T - e.y) < T * 1.6) { flowBig[j] = 0; flowBigQ[tl++] = j; } } }
  while (h < tl) {
    const j = flowBigQ[h++], d = flowBig[j]; if (d > 400) continue;
    const vx = j % vw, vy = (j / vw) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = vx + dx, ny = vy + dy, k = ny * vw + nx; if (nx < 0 || ny < 0 || nx > w || ny > m.h || flowBig[k] >= 0 || !cornerOpen(nx, ny)) continue; flowBig[k] = d + 1; flowBigQ[tl++] = k; }
  }
}
function cornerOpen(vx, vy) { return !blocksWalk(tileAt(vx - 1, vy - 1), false) && !blocksWalk(tileAt(vx, vy - 1), false) && !blocksWalk(tileAt(vx - 1, vy), false) && !blocksWalk(tileAt(vx, vy), false); }
const isBig = e => e.r > T / 2 - 1;
// field value at a node, and the node grid an entity uses: tiles (centre at (x+0.5)T) or corners (at xT)
function navNode(e) {
  const m = G.map;
  if (!isBig(e)) { const tx = Math.floor(e.x / T), ty = Math.floor(e.y / T), v = flowDist ? flowDist[ty * m.w + tx] : -1; if (v >= 0) return { x: tx, y: ty, v, big: false };
    let best = null; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const x = tx + dx, y = ty + dy, u = x >= 0 && y >= 0 && x < m.w && y < m.h ? flowDist[y * m.w + x] : -1; if (u >= 0 && (!best || u < best.v)) best = { x, y, v: u, big: false }; } return best; }
  const vw = m.w + 1, cx = Math.round(e.x / T), cy = Math.round(e.y / T); let best = null;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x > m.w || y > m.h) continue; const u = flowBig ? flowBig[y * vw + x] : -1; if (u < 0) continue; const dd = hyp(x * T - e.x, y * T - e.y); if (!best || u + dd / T * 0.5 < best.s) best = { x, y, v: u, big: true, s: u + dd / T * 0.5 }; }
  return best;
}
const nodePt = n => n.big ? { x: n.x * T, y: n.y * T } : { x: (n.x + 0.5) * T, y: (n.y + 0.5) * T };
function nodeNext(n) {   // one step downhill (8 directions, no corner cutting)
  const m = G.map, F = n.big ? flowBig : flowDist, W2 = n.big ? m.w + 1 : m.w, H2 = n.big ? m.h + 1 : m.h, ok = (x, y) => x >= 0 && y >= 0 && x < W2 && y < H2 && F[y * W2 + x] >= 0;
  let best = null;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const x = n.x + dx, y = n.y + dy; if (!ok(x, y)) continue;
    if (dx && dy && (!ok(n.x + dx, n.y) || !ok(n.x, n.y + dy))) continue;
    const v = F[y * W2 + x]; if (v < n.v && (!best || v < best.v || (v === best.v && !(dx && dy)))) best = { x, y, v, big: n.big }; }
  return best;
}
// does a body of radius r fit along the whole straight line from (x1, y1) to (x2, y2)?
function sweepClear(x1, y1, x2, y2, r, fly) {
  const d = hyp(x2 - x1, y2 - y1), n = Math.ceil(d / 8), rr = Math.max(2, r - 1);
  for (let i = 1; i <= n; i++) { const k = i / n; if (collide(x1 + (x2 - x1) * k, y1 + (y2 - y1) * k, rr, fly)) return false; }
  return true;
}
// the steering direction for a foe chasing t: [dx, dy] unit vector, or null when it has nowhere to go
function navDir(f, t) {
  const now = G.time, seeded = t.isHero || G.allies.includes(t);
  if (f.side && f.side.until > now) return f.side.dir;   // sidestepping after getting stuck
  if ((f.lineT || 0) <= now) { f.lineT = now + NAV.lineEvery * R(0.8, 1.2); f.lineOk = sweepClear(f.x, f.y, t.x, t.y, f.r, f.fly); }
  if (f.lineOk || !seeded) { const a = Math.atan2(t.y - f.y, t.x - f.x); f.wp = null; return [Math.cos(a), Math.sin(a)]; }
  if (!f.wp || (f.navT || 0) <= now || hyp(f.wp.x - f.x, f.wp.y - f.y) < 6) {
    f.navT = now + NAV.repath * R(0.8, 1.2); f.wp = null;
    let n = navNode(f), far = null; const path = [];
    for (let k = 0; n && k < NAV.look; k++) { path.push(nodePt(n)); if (n.v === 0) break; n = nodeNext(n); }
    for (let k = path.length - 1; k >= 0; k--) if (sweepClear(f.x, f.y, path[k].x, path[k].y, f.r, f.fly)) { far = path[k]; break; }
    f.wp = far || path[1] || path[0] || null;
  }
  if (!f.wp) { const a = Math.atan2(t.y - f.y, t.x - f.x); return [Math.cos(a), Math.sin(a)]; }
  const dx = f.wp.x - f.x, dy = f.wp.y - f.y, d = hyp(dx, dy) || 1; return [dx / d, dy / d];
}
// stuck watch: a foe that wanted to move for a whole second but barely moved repaths and sidesteps (the side that is free)
function navStuck(f, dir, dt) {
  const now = G.time, gap = now - (f.navSeen ?? -9); f.navSeen = now;
  if (!dir) { f.stuckRef = null; f.stuckFor = 0; return; }
  if (!f.stuckRef || gap > 0.1) { f.stuckRef = { x: f.x, y: f.y, t: now }; f.stuckFor = 0; return; }   // only an unbroken stretch of trying to walk counts
  const moved = hyp(f.x - f.stuckRef.x, f.y - f.stuckRef.y);
  if (moved >= NAV.stuckMove) { f.stuckRef = { x: f.x, y: f.y, t: now }; f.stuckFor = 0; f.stuckN = 0; return; }
  f.stuckFor = now - f.stuckRef.t;
  if (f.stuckFor < NAV.stuckWin) return;
  f.stuckRef = { x: f.x, y: f.y, t: now }; f.stuckN = (f.stuckN || 0) + 1; f.wp = null; f.navT = 0; f.lineT = 0; G.navUnstuck = (G.navUnstuck || 0) + 1;
  if (collide(f.x, f.y, f.r, f.fly)) { unstick(f); return; }
  const a = Math.atan2(dir[1], dir[0]), opts = [a + Math.PI / 2, a - Math.PI / 2, a + Math.PI * 0.75, a - Math.PI * 0.75, a + Math.PI];
  if (f.stuckN % 2 === 0) opts.reverse();
  for (const b of opts) { const c = Math.cos(b), s = Math.sin(b); if (!collide(f.x + c * 14, f.y + s * 14, f.r, f.fly)) { f.side = { dir: [c, s], until: now + NAV.sideT }; return; } }
}
function flowDir(e) {   // legacy helper (the Reaper and allies): one step down the field
  const n = navNode(e); if (!n) return null; const nx = n.v === 0 ? n : nodeNext(n); if (!nx) return null;
  const p = nodePt(nx), vx = p.x - e.x, vy = p.y - e.y, d = hyp(vx, vy) || 1; return d < 1 ? null : [vx / d, vy / d];
}

// ---------------------------------------------------------------- effects
function addTrauma(v) { G.trauma = Math.min(1, G.trauma + v * (SAVE.settings.shake ? 1 : 0)); }
function hitstop(t) { G.hitstop = Math.max(G.hitstop, t); }
function burst(x, y, col, n = 10, spd = 140, size = 3, life = 0.5, grav = 0) {
  if (G.parts.length > 1100) return; if (G.parts.length > 600) n = Math.min(n, 3);   // big crowds: cap the particles
  for (let i = 0; i < n; i++) { const a = R(0, 6.283), s = R(spd * 0.25, spd); G.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: R(life * 0.5, life), max: life, col, size: R(size * 0.6, size), grav }); }
}
function sparkDir(x, y, a, col, n = 8, spd = 260) { for (let i = 0; i < n; i++) { const b = a + R(-0.6, 0.6), s = R(spd * 0.4, spd); G.parts.push({ x, y, vx: Math.cos(b) * s, vy: Math.sin(b) * s, life: R(0.15, 0.35), max: 0.35, col, size: R(1.5, 3), grav: 0 }); } }
function ring(x, y, r, col, life = 0.4, w = 4) { G.rings.push({ x, y, r, col, life, max: life, w }); }
// floating text. Words (spell, relic and status pops) are deduped (the same word near the same spot refreshes instead of stacking)
// and nudged up a line when another word is already there; damage and gold numbers keep their own spot.
function text(x, y, s, col = '#fff', big) {
  s = String(s); const label = !/^[-+]?\d/.test(s), y0 = y;
  if (label) {
    const same = G.texts.find(t => t.label && t.s === s && Math.abs(t.x - x) < 48 && Math.abs(t.y0 - y0) < 48 && t.life > t.max * 0.3);
    if (same) { same.life = same.max; same.x = x; same.col = col; return same; }
    for (let k = 0; k < 4 && G.texts.some(t => t.label && Math.abs(t.x - x) < 70 && Math.abs(t.y - y) < 13); k++) y -= 14;
  }
  const t = { x, y, y0, s, col, life: big ? 1.4 : 0.9, max: big ? 1.4 : 0.9, big, label }; G.texts.push(t); return t;
}
function msg(s, col = '#fff', dur = 3) { G.msgs.push({ s, col, t: dur, max: dur }); if (G.msgs.length > 4) G.msgs.shift(); }
function decal(x, y, r, col, life = 20) { if (G.decals.length > 120) G.decals.shift(); G.decals.push({ x, y, r, col, life, max: life }); }
function updateFx(dt) {
  for (const p of G.parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.9; p.vy = p.vy * 0.9 + p.grav * dt; }
  G.parts = G.parts.filter(p => p.life > 0);
  if (G.corpses && G.corpses.length) { for (const c of G.corpses) c.t -= dt; G.corpses = G.corpses.filter(c => c.t > 0); }
  for (const r of G.rings) r.life -= dt; G.rings = G.rings.filter(r => r.life > 0);
  for (const t of G.texts) { t.life -= dt; t.y -= (t.big ? 20 : 34) * dt; } G.texts = G.texts.filter(t => t.life > 0);
  for (const b of G.beams) b.life -= dt; G.beams = G.beams.filter(b => b.life > 0);
  for (const d of G.decals) d.life -= dt; G.decals = G.decals.filter(d => d.life > 0);
  for (const m of G.msgs) m.t -= dt; G.msgs = G.msgs.filter(m => m.t > 0);
  G.trauma = Math.max(0, G.trauma - dt * 1.6); G.flash = Math.max(0, G.flash - dt * 2);
}

// ---------------------------------------------------------------- camera
// ---- camera (Slayer style): follows the party at 1x; in a big battle room it smoothly zooms out to frame the whole room and every player
const camZ = () => G.cam.z || 1, viewW = () => W / camZ(), viewH = () => H / camZ();
function battleRoomOf(list) {   // the big room the party is in (any living hero inside), else -1
  const m = G.map; if (!m || !m.rooms || !m.rooms.length) return -1;
  for (const h of list) { const r = roomAt(h.x, h.y); if (r >= 0 && SPEC.cam.battleKinds.includes(m.rooms[r].kind) || (r >= 0 && m.rooms[r].arena)) return r; }
  return -1;
}
function camTarget() {
  const C = SPEC.cam, alive = G.heroes.filter(h => !h.dead), list = alive.length ? alive : G.heroes;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const h of list) { x0 = Math.min(x0, h.x); y0 = Math.min(y0, h.y); x1 = Math.max(x1, h.x); y1 = Math.max(y1, h.y); }
  let z = 1, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, room = G.mode === 'hub' ? -1 : battleRoomOf(list);
  if (list.length === 1 && room < 0) { cx += Math.cos(list[0].fa) * 40; cy += Math.sin(list[0].fa) * 30; }   // look-ahead toward aim, solo
  if (room >= 0) { const r = G.map.rooms[room]; x0 = Math.min(x0, r.x * T - T); y0 = Math.min(y0, r.y * T - T); x1 = Math.max(x1, (r.x + r.w + 1) * T); y1 = Math.max(y1, (r.y + r.h + 1) * T);
    cx = (x0 + x1) / 2; cy = (y0 + y1) / 2; z = Math.min(1, W / (x1 - x0 + 2 * C.margin), (H - C.hud) / (y1 - y0 + 2 * C.margin)); }
  else if (list.length > 1 && G.mode !== 'hub') z = Math.min(1, W / (x1 - x0 + 2 * C.coopPad), (H - C.hud) / (y1 - y0 + 2 * C.coopPad));   // co-op: keep every player on screen
  return { z: Math.max(C.min, z), cx, cy: cy + C.hud / 2 / Math.max(C.min, z) * 0.5, room };
}
function updateCamera(snap, dt = 1 / 60) {
  const alive = G.heroes.filter(h => !h.dead); const list = alive.length ? alive : G.heroes;
  if (!list.length) return;
  const C = SPEC.cam;
  if (G.mode === 'hub') { const f = hubFit(); G.cam.z = f.z; G.cam.x = f.x; G.cam.y = f.y; G.cam.room = -1; return; }   // the whole camp is always in view
  const tg = camTarget();
  if (snap || !G.cam.z) G.cam.z = tg.z; else G.cam.z += (tg.z - G.cam.z) * Math.min(1, dt * C.rate);
  G.cam.room = tg.room;
  const vw = viewW(), vh = viewH(), mw = G.map.w * T, mh = G.map.h * T;
  const tx = mw <= vw ? (mw - vw) / 2 : clamp(tg.cx - vw / 2, 0, mw - vw);
  const ty = mh <= vh - 60 / camZ() ? (mh - vh) / 2 - 30 / camZ() : clamp(tg.cy - vh / 2 - 20, -64, mh - vh + C.hud / camZ());
  if (snap) { G.cam.x = tx; G.cam.y = ty; } else { G.cam.x += (tx - G.cam.x) * C.follow; G.cam.y += (ty - G.cam.y) * C.follow; }
}
// camp framing: the whole hub fits between the top bar and the player panels, centred, at every window size (the game draws in
// a fixed W x H logical space, so this holds at 1280x720, 1920x1080 and smaller windows alike)
function hubFit() { const top = 44, bot = H - DEV.hud.panelH - 14, mw = G.map.w * T, mh = G.map.h * T, z = Math.min(1, (bot - top) / mh, (W - 16) / mw);
  return { z, x: -((W - mw * z) / 2) / z, y: -(top + (bot - top - mh * z) / 2) / z, top, bot }; }
const onScreen = (x, y, m = 40) => x > G.cam.x - m && x < G.cam.x + viewW() + m && y > G.cam.y - m && y < G.cam.y + viewH() + m;
const toScreen = (x, y) => ({ x: (x - G.cam.x) * camZ(), y: (y - G.cam.y) * camZ() });
