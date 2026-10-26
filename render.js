'use strict';
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
function circ(x, y, r, fill, stroke, lw = 2) { ctx.beginPath(); ctx.arc(x, y, Math.max(0.1, r), 0, 6.2832); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.stroke(); } }
function ell(x, y, rx, ry, fill, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, 6.2832); ctx.fillStyle = fill; ctx.fill(); }
function shadow(x, y, r) { ell(x, y + r * 0.75, r * 0.95, r * 0.35, 'rgba(0,0,0,0.32)'); }
function poly(pts, fill, stroke, lw = 2) { ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.closePath(); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); } }
function line(x1, y1, x2, y2, col, w = 2) { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }

// ---------------------------------------------------------------- heroes (original designs)
function drawHeroSprite(def, x, y, fa, s = 1, o = {}) {
  if (hasSprite(def)) return drawHeroArt(def, x, y, fa, s, o);
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const walk = o.walk || 0, bob = Math.sin(walk) * 1.3, z = o.z || 0;
  if (!o.noShadow) shadow(0, 0, 13);
  ctx.translate(0, -z + bob);
  const cs = Math.cos(fa), sn = Math.sin(fa), back = sn < -0.35;
  const weapon = () => { ctx.save(); ctx.rotate(fa + (o.swingOff || 0)); WEAP[def.id](o); ctx.restore(); };
  if (back) weapon();
  // feet
  const st = Math.sin(walk) * 3;
  circ(-5 + st * cs * 0.3, 9, 3.2, def.dark); circ(5 - st * cs * 0.3, 9, 3.2, def.dark);
  BODY[def.id](def, cs, sn, o);
  if (!back) weapon();
  ctx.restore();
}
// sprite-sheet heroes (swappable sets from assets/heroes/<name>/manifest.json) with procedural overlays on top
function drawHeroArt(def, x, y, fa, s, o) {
  const B = heroBody(def), m = (o.sprMul ?? s), k = sprScale(def) * B.scale * m;
  const pose = o.pose || { anim: o.walk && o.moving ? 'run' : 'idle', dir: sprDir(fa), t: o.t ?? G.time };
  const footY = y + 12 * B.scale;
  let lift = o.z || 0, sway = 0;
  if (B.style === 'glide' && pose.anim !== 'death') lift += (B.hover + Math.sin(G.time * 6.283 * B.hoverHz + x * 0.01) * B.hoverBob) * m;   // floats above her shadow
  else if (pose.moving && B.bob) { const ph = pose.t * 8 * Math.PI / 4; lift += Math.abs(Math.sin(ph)) * B.bob * m; if (B.style === 'heavy') sway = Math.sin(ph) * 0.035; }
  if (!o.noShadow) { const shrink = B.style === 'glide' ? 1 - (lift / (40 * m)) : 1; softShadow(x, footY, 18 * B.scale * m * shrink, 7 * B.scale * m * shrink, B.style === 'glide' ? 0.3 : 0.4); }
  if (B.glow && pose.anim !== 'death') { const g = ctx.createRadialGradient(x, footY - lift + 2, 0, x, footY - lift + 2, 22 * B.scale * m); g.addColorStop(0, hexA(B.glow, 0.55)); g.addColorStop(1, hexA(B.glow, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, footY - lift + 2, 22 * B.scale * m, 9 * B.scale * m, 0, 0, 6.283); ctx.fill(); }
  const sq = o.roll ? { sx: 1.18, sy: 0.78 } : {};
  if (sway) sq.rot = sway;
  drawSpriteFrame(def.sprite, pose.anim, pose.dir, pose.t, x, footY - lift, k, sq);
  s = s * B.scale; const z = lift;
  if (pose.anim === 'death') return;
  const cs = Math.cos(fa), sn = Math.sin(fa), hx = x + cs * 16 * s, hy = y - 8 * s + sn * 10 * s - z;
  if (def.id === 'sela' && o.blocking) { // Gela: swirling wind barrier in the aim direction
    const R0 = 30 * s;
    for (let k = 0; k < 4; k++) { const ph = G.time * 9 + k * 1.6, a0 = fa - 1.15 + ((ph % 2.3) - 0.0) * 0.0;
      ctx.strokeStyle = o.blockFlash ? '#fff' : `rgba(200,232,255,${0.65 - k * 0.12})`; ctx.lineWidth = 3 - k * 0.5;
      ctx.beginPath(); ctx.arc(x, y - z - 8 * s, R0 + k * 4 * s + Math.sin(ph) * 2, fa - 1.15 + Math.sin(ph) * 0.15, fa + 1.15 + Math.sin(ph) * 0.15); ctx.stroke(); }
    for (let k = 0; k < 5; k++) { const a = fa + Math.sin(G.time * 5 + k * 1.3) * 1.05, rr = R0 + 6 * s; circ(x + Math.cos(a) * rr, y - z - 8 * s + Math.sin(a) * rr * 0.8, 1.6, 'rgba(235,248,255,0.9)'); }
  }
  if (def.id === 'paladin' && o.blocking) { // Highlord David: golden barrier that throws missiles back
    const R0 = 34 * s, g = 0.55 + 0.2 * Math.sin(G.time * 10);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = o.blockFlash ? '#fff' : `rgba(255,214,110,${g})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(x, y - z - 10 * s, R0, fa - 1.4, fa + 1.4); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,230,150,0.22)'; ctx.lineWidth = 16; ctx.stroke();
    for (let k = -3; k <= 3; k++) { const a = fa + k * 0.4; line(x + Math.cos(a) * (R0 - 6), y - z - 10 * s + Math.sin(a) * (R0 - 6), x + Math.cos(a) * (R0 + 6), y - z - 10 * s + Math.sin(a) * (R0 + 6), 'rgba(255,245,200,0.7)', 2); }
    ctx.restore();
  }
  if (def.id === 'kestrel' && o.charge) { const c = o.charge; line(hx, hy, hx + cs * (14 + c * 10), hy + sn * (14 + c * 10), '#ffef9a', 2); circ(hx + cs * (14 + c * 10), hy + sn * (14 + c * 10), 2 + c * 4, o.explosive ? '#ff8a2a' : 'rgba(255,240,150,0.85)'); if (c >= 1) circ(hx, hy, 14, 'rgba(255,240,150,0.25)'); }
  if (def.id === 'mirelle') { const c = o.runeCol || '#c8b8ff'; circ(hx, hy, 3.5, c); circ(hx, hy, 9 + Math.sin(G.time * 8) * 1.5, hexA(c, 0.3)); }
}
const BODY = {
  brannoc(d, cs, sn) { // hulking quarry-stone giant
    circ(0, 1, 15, d.skin, '#4a4440', 2);
    ctx.fillStyle = '#7a726a'; ctx.beginPath(); ctx.arc(0, 1, 15, 0.2, 2.9); ctx.fill(); // shading
    ctx.fillStyle = d.color; ctx.fillRect(-13, 3, 26, 5); // sash
    circ(-11, -5, 6, '#6a8a4a'); circ(11, -5, 6, '#6a8a4a'); // mossy shoulders
    circ(cs * 3, -8 + sn * 2, 7.5, d.skin, '#4a4440', 1.5);
    ctx.fillStyle = '#ffcf7a'; ctx.fillRect(cs * 5 - 4, -10 + sn * 3, 3, 2); ctx.fillRect(cs * 5 + 1, -10 + sn * 3, 3, 2);
    line(-4, 0, 2, 6, 'rgba(0,0,0,0.25)', 1.5); line(6, -2, 9, 4, 'rgba(0,0,0,0.25)', 1.5);
  },
  sela(d, cs, sn, o) {
    poly([-12, 9, 12, 9, 9, -6, -9, -6], d.dark); // cloak
    circ(0, 0, 11, d.color, d.dark, 2);
    circ(cs * 2, -7 + sn * 2, 6.5, d.skin);
    ctx.fillStyle = '#c9c0a0'; ctx.beginPath(); ctx.arc(cs * 2, -8 + sn * 2, 7, Math.PI, 0); ctx.fill(); // helm
    ctx.fillStyle = '#d04a3a'; ctx.fillRect(cs * 2 - 1.5, -19 + sn * 2, 3, 8); // crest
    if (!o.shieldOut) { // crescent shield
      const a = Math.atan2(sn, cs), sa = o.blocking ? a : a + 1.4, sx = Math.cos(sa) * 12, sy = Math.sin(sa) * 10;
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(sa);
      circ(0, 0, o.blocking ? 11 : 9, '#d8c890', '#8a7a40', 2); circ(-3, 0, o.blocking ? 8 : 6, '#3aa39a'); ctx.restore();
      if (o.blocking) { ctx.strokeStyle = o.blockFlash ? '#fff' : 'rgba(255,240,180,0.6)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 22, a - 1.1, a + 1.1); ctx.stroke(); }
    }
  },
  kestrel(d, cs, sn) {
    poly([-11, 10, 11, 10, 7, -8, -7, -8], d.dark);
    circ(0, 0, 10.5, d.color, d.dark, 2);
    ctx.fillStyle = '#8ad04a'; for (let k = 0; k < 3; k++) ctx.fillRect(-6 + k * 5, 2, 3, 3);
    ctx.fillStyle = '#3a6a2a'; ctx.beginPath(); ctx.moveTo(-8, -3); ctx.quadraticCurveTo(0, -24, 8, -3); ctx.fill(); // pointed leaf hood
    circ(cs * 2.5, -5 + sn * 2, 4.5, d.skin);
    circ(-9, -2, 3, '#a07040'); // quiver
  },
  mirelle(d, cs, sn, o) {
    poly([-12, 11, 12, 11, 7, -6, -7, -6], d.dark);
    circ(0, 0, 10.5, d.color, d.dark, 2);
    ctx.fillStyle = '#e8d8a0'; ctx.fillRect(-1.5, -4, 3, 13);
    circ(cs * 2, -7 + sn * 2, 5.5, d.skin);
    ctx.fillStyle = '#2a3a8a'; ctx.beginPath(); ctx.arc(cs * 2, -8 + sn * 2, 6.5, Math.PI * 1.05, -0.05); ctx.fill();
    ctx.fillStyle = '#8fe3ff'; ctx.fillRect(cs * 2 - 1, -15 + sn * 2, 2, 2);
    // floating spellbook
    const t = G.time * 3; ctx.save(); ctx.translate(-14, -10 + Math.sin(t) * 2); ctx.fillStyle = '#6a3a2a'; ctx.fillRect(-5, -4, 10, 8); ctx.fillStyle = '#f0e8d0'; ctx.fillRect(-4, -3, 8, 6); ctx.restore();
  },
  vesper(d, cs, sn) {
    poly([-13, 11, 13, 11, 8, -6, -8, -6], '#2a1a40');
    circ(0, 0, 10.5, d.color, d.dark, 2);
    ctx.fillStyle = '#2a1a40'; ctx.beginPath(); ctx.arc(0, -6, 8.5, Math.PI, 0); ctx.lineTo(8, 1); ctx.lineTo(-8, 1); ctx.fill();
    circ(cs * 2.5 - 2.5, -6 + sn * 2, 1.5, '#7ff5d0'); circ(cs * 2.5 + 2.5, -6 + sn * 2, 1.5, '#7ff5d0');
    ctx.fillStyle = '#e8e8d8'; for (let k = -2; k <= 2; k++) ctx.fillRect(k * 3 - 1, -16, 2, 4 + (k % 2 ? 0 : 2)); // bone crown
  },
};
const WEAP_PAL = o => { line(4, 4, 36, 4, '#e8e8f0', 4); line(2, 4, 8, 4, '#c8a040', 6); };
const WEAP = {
  brannoc(o) { line(4, 4, 30, 4, '#6a4a2a', 4); ctx.fillStyle = '#8a8a90'; ctx.fillRect(26, -6, 12, 18); ctx.fillStyle = '#6a6a70'; ctx.fillRect(26, -6, 12, 4); if (o.weapon === 'hatchets') { ctx.fillStyle = '#c0c8d0'; ctx.fillRect(28, -4, 8, 14); } },
  sela(o) { line(6, 6, 28, 6, '#d0d0d8', 3); line(4, 6, 8, 6, '#8a6a3a', 5); ctx.fillStyle = '#e8e8f0'; poly([28, 3, 34, 6, 28, 9], '#e8e8f0'); },
  kestrel(o) { ctx.strokeStyle = '#a0703a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(8, 0, 14, -1.25, 1.25); ctx.stroke(); const pull = o.charge ? o.charge * 8 : 0; ctx.strokeStyle = '#eee'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(8 + 14 * Math.cos(-1.25), 14 * Math.sin(-1.25)); ctx.lineTo(8 - pull, 0); ctx.lineTo(8 + 14 * Math.cos(1.25), 14 * Math.sin(1.25)); ctx.stroke(); if (o.charge) { line(8 - pull, 0, 30, 0, '#ffef9a', 2); circ(30, 0, 2 + o.charge * 3, o.explosive ? '#ff8a2a' : 'rgba(255,240,150,0.8)'); } },
  mirelle(o) { line(6, 8, 26, -6, '#8a6a4a', 3); const c = o.runeCol || '#8fe3ff'; circ(27, -7, 4, c); circ(27, -7, 8 + Math.sin(G.time * 8) * 1.5, hexA(c, 0.3)); },
  vesper(o) { line(8, 0, 18, 0, '#555', 1.5); ctx.fillStyle = '#2a2a34'; ctx.fillRect(16, -6, 9, 12); circ(20.5, 0, 3.5, '#b07aff'); circ(20.5, 0, 10 + Math.sin(G.time * 5) * 2, 'rgba(176,122,255,0.18)'); },
};
function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; }

// ---------------------------------------------------------------- foes
function drawFoe(f) {
  const x = f.x, y = f.y, r = f.r;
  if (f.type === 'reaper' && f.gone > 0) return;
  ctx.save(); ctx.translate(x, y);
  const fl = f.flash > 0, wb = Math.sin(f.walk || 0) * 1.5;
  if (f.d.style !== 'wraith' && f.d.style !== 'imp' && !f.sub) shadow(0, 0, r);
  if (f.charm > 0) circ(0, 0, r + 6, 'rgba(255,140,220,0.25)');
  if (f.state === 'windup') { const k = 1 - f.st / (f.d.windup || 0.5); circ(0, 0, r + 4 + k * 6, `rgba(255,60,40,${0.25 + 0.3 * k})`); }
  if (f.state === 'charge') { for (let i = 1; i < 4; i++) circ(-Math.cos(f.fa) * i * 10, -Math.sin(f.fa) * i * 10, r * (1 - i * 0.2), 'rgba(255,200,150,0.15)'); }
  ctx.translate(0, wb * 0.5);
  const sk = FOE_SPRITE[f.boss ? f.kind : f.type];
  if (f.sub) { ctx.strokeStyle = 'rgba(140,220,230,0.55)'; ctx.lineWidth = 2; for (let k = 0; k < 3; k++) { const rr = (G.time * 20 + k * 8) % 24; ctx.beginPath(); ctx.ellipse(0, 2, rr, rr * 0.45, 0, 0, 6.283); ctx.stroke(); } }
  else if (f.boss && f.kind === 'rootmaw' && f.state !== 'surface') (FOE_ART[f.d.style] || FOE_ART.skeleton)(f, r, fl);
  else if (sk && foeSprReady(sk)) drawFoeSprite(f, sk, fl);
  else (FOE_ART[f.d.style] || FOE_ART.skeleton)(f, r, fl);
  if (f.frz > 0) { ctx.globalAlpha = 0.5; circ(0, 0, r + 3, '#cff4ff'); ctx.globalAlpha = 1; }
  if (f.root > 0) { ctx.strokeStyle = '#6a9a3a'; ctx.lineWidth = 2; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(0, r * 0.6, r * 0.8, k * 1.6, k * 1.6 + 0.8); ctx.stroke(); } }
  if (f.stag > 0 && !f.frz) for (let k = 0; k < 3; k++) { const a = G.time * 6 + k * 2.1; circ(Math.cos(a) * 8, -r - 6 + Math.sin(a) * 2, 1.6, '#ffe95a'); }
  if (f.marked > 0) { ctx.strokeStyle = '#c08aff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, r + 8, 0, 6.28); ctx.stroke(); }
  ctx.restore();
  if (f.elite && f.hp < f.maxhp && !f.boss && !f.d.miniboss) { ctx.fillStyle = '#000'; ctx.fillRect(x - 18, y - r - 12, 36, 4); ctx.fillStyle = '#e04a3a'; ctx.fillRect(x - 18, y - r - 12, 36 * f.hp / f.maxhp, 4); }
}
function drawFoeSprite(f, sk, fl) {   // hero-style pixel sprite; single front view, mirrored when facing left
  const A = SPR.foes.man.anims, atk = f.state === 'windup' || f.state === 'strike' || (f.atkFlash > 0);
  const moving = !f.stag && !f.frz && (f.state === 'move' || f.state === 'charge');
  const an = atk && A[sk + '_attack'] ? '_attack' : moving && A[sk + '_walk'] ? '_walk' : '_idle';
  const left = Math.cos(f.fa) < -0.15, fly = f.d.beh === 'wraith' || f.d.fly || (f.boss && f.kind === 'sovereign'), bob = fly ? -8 + Math.sin(G.time * 3 + f.seed) * 3 : 0;
  if (f.d.style === 'robed' || f.type === 'lich' || f.type === 'hexcaller') { ctx.globalCompositeOperation = 'lighter'; circ(0, -f.r, f.r * 1.4, f.type === 'lich' ? 'rgba(120,180,255,0.12)' : 'rgba(140,255,120,0.10)'); ctx.globalCompositeOperation = 'source-over'; }
  if (f.barrier > 0) { ctx.strokeStyle = 'rgba(160,210,255,0.85)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, -f.r * 0.6, f.r + 14, f.fa - 0.9, f.fa + 0.9); ctx.stroke(); }
  if (fly) ctx.globalAlpha = CRYPT.ghostAlpha;
  drawSpriteFrame('foes', sk + an, 'down', an === '_attack' ? Math.max(0, 0.34 - (f.st || 0)) : G.time + (f.seed || 0), 0, 4 + bob + (f.boss ? f.r * 0.5 : 0), SPR.foes.man.scale * (f.d.sprScale || 1), { sx: left ? -1 : 1 });
  ctx.globalAlpha = 1;
  if (fl) { ctx.globalCompositeOperation = 'lighter'; circ(0, -f.r, f.r * 1.1, 'rgba(255,255,255,0.45)'); ctx.globalCompositeOperation = 'source-over'; }
  if (f.d.rally && f.rallyFx > 0) { ctx.strokeStyle = `rgba(255,120,90,${f.rallyFx})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, 2, f.d.rally.aura, f.d.rally.aura * 0.5, 0, 0, 6.283); ctx.stroke(); }
}
const fcol = (f, fl) => fl ? '#fff' : f.d.col;
const FOE_ART = {
  skeleton(f, r, fl) { const c = fcol(f, fl); line(-r * 0.4, r * 0.6, -r * 0.6, r, c, 2); line(r * 0.4, r * 0.6, r * 0.6, r, c, 2); ctx.fillStyle = fl ? '#fff' : '#3a3428'; ctx.fillRect(-r * 0.6, -r * 0.2, r * 1.2, r * 0.9); for (let k = 0; k < 3; k++) line(-r * 0.55, k * 3 - 1, r * 0.55, k * 3 - 1, c, 1.5); circ(Math.cos(f.fa) * 2, -r * 0.55, r * 0.55, c); circ(Math.cos(f.fa) * 3 - 2, -r * 0.6, 1.6, '#ff5a3a'); circ(Math.cos(f.fa) * 3 + 2, -r * 0.6, 1.6, '#ff5a3a'); ctx.save(); ctx.rotate(f.fa); line(4, 3, r + 8, 3, '#9a9aa0', 2.5); ctx.restore(); },
  skelarcher(f, r, fl) { FOE_ART.skeleton(f, r, fl); ctx.save(); ctx.rotate(f.fa); ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(6, 0, 10, -1.2, 1.2); ctx.stroke(); ctx.restore(); },
  shambler(f, r, fl) { const c = fcol(f, fl); circ(0, 0, r, c, '#3a4030', 2); ctx.fillStyle = '#4a3a2a'; ctx.fillRect(-r * 0.7, 0, r * 1.4, r * 0.6); circ(Math.cos(f.fa) * 3, -r * 0.5, r * 0.5, fl ? '#fff' : '#9aa080'); circ(Math.cos(f.fa) * 4 - 2, -r * 0.55, 1.5, '#ff0'); circ(Math.cos(f.fa) * 4 + 2, -r * 0.5, 1.2, '#ff0'); ctx.save(); ctx.rotate(f.fa); line(4, -6, r + 8, -4, c, 3); line(4, 6, r + 8, 4, c, 3); ctx.restore(); },
  bloater(f, r, fl) { const p = 1 + Math.sin(G.time * 5 + f.seed) * 0.05; circ(0, 0, r * p, fl ? '#fff' : '#8fa05a', '#4a5a2a', 2); circ(-r * 0.3, -r * 0.2, r * 0.3, 'rgba(200,230,120,0.5)'); circ(r * 0.35, r * 0.2, r * 0.22, 'rgba(200,230,120,0.5)'); circ(Math.cos(f.fa) * 4, -r * 0.6, r * 0.35, '#7a8a5a'); circ(Math.cos(f.fa) * 5, -r * 0.65, 1.6, '#000'); },
  robed(f, r, fl) { const c = fcol(f, fl); poly([-r, r, r, r, r * 0.5, -r * 0.5, -r * 0.5, -r * 0.5], c, '#2a1040'); circ(0, -r * 0.55, r * 0.55, '#1a0a2a'); circ(-2, -r * 0.6, 1.8, '#c080ff'); circ(2, -r * 0.6, 1.8, '#c080ff'); const t = G.time * 4 + f.seed; for (let k = 0; k < 3; k++) circ(Math.cos(t + k * 2.1) * (r + 6), Math.sin(t + k * 2.1) * (r + 6) - 4, 2.5, '#c080ff'); ctx.save(); ctx.rotate(f.fa); line(2, 8, r + 10, -6, '#5a4a3a', 2.5); circ(r + 10, -7, 3.5, '#d8d0b0'); ctx.restore(); },
  wraith(f, r, fl) { ctx.globalAlpha = 0.78; const w = Math.sin(G.time * 9 + f.seed) * 2; ctx.fillStyle = fl ? '#fff' : f.d.col; ctx.beginPath(); ctx.arc(0, -2, r, Math.PI, 0); for (let k = 0; k <= 4; k++) ctx.lineTo(r - k * r / 2, r + (k % 2 ? -4 : 2) + w * (k % 2 ? 1 : -1)); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1; circ(-3.5 + Math.cos(f.fa) * 2, -3, 2.4, '#123'); circ(3.5 + Math.cos(f.fa) * 2, -3, 2.4, '#123'); ell(Math.cos(f.fa) * 2, 4, 2.2, 3.4, '#123'); },
  goblin(f, r, fl) { const c = fcol(f, fl); circ(0, 0, r, c, '#2a3a10', 2); poly([-r * 0.6, -r * 0.5, -r * 1.5, -r * 0.9, -r * 0.4, -r * 0.1], c); poly([r * 0.6, -r * 0.5, r * 1.5, -r * 0.9, r * 0.4, -r * 0.1], c); circ(Math.cos(f.fa) * 3 - 3, -2, 1.8, '#ff0'); circ(Math.cos(f.fa) * 3 + 3, -2, 1.8, '#ff0'); ctx.fillStyle = '#5a3a1a'; ctx.fillRect(-r * 0.7, r * 0.2, r * 1.4, r * 0.5); ctx.save(); ctx.rotate(f.fa); line(4, 4, r + 7, 4, '#7a5a3a', 3); ctx.restore(); },
  spider(f, r, fl) { const c = fl ? '#fff' : '#2a2222'; const t = G.time * 20 + f.seed; for (let k = 0; k < 4; k++) { const a = k * 0.5 - 0.75, l = Math.sin(t + k) * 2; line(0, 0, Math.cos(a) * (r + 5) + l, Math.sin(a) * (r + 5), c, 1.5); line(0, 0, -Math.cos(a) * (r + 5) - l, Math.sin(a) * (r + 5), c, 1.5); } circ(0, 0, r, c); circ(Math.cos(f.fa) * r * 0.6, Math.sin(f.fa) * r * 0.6, r * 0.55, '#3a2a2a'); circ(Math.cos(f.fa) * r * 0.9 - 1.5, Math.sin(f.fa) * r * 0.9, 1.2, '#f33'); circ(Math.cos(f.fa) * r * 0.9 + 1.5, Math.sin(f.fa) * r * 0.9, 1.2, '#f33'); },
  bigspider(f, r, fl) { FOE_ART.spider(f, r, fl); circ(0, r * 0.2, r * 0.6, fl ? '#fff' : '#6a2a4a'); ctx.strokeStyle = '#d0a0c0'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, r * 0.2, r * 0.35, 0, 6.28); ctx.stroke(); },
  hulk(f, r, fl) { const c = fcol(f, fl); circ(-r * 0.75, -r * 0.2, r * 0.45, c, '#3a2a1a', 2); circ(r * 0.75, -r * 0.2, r * 0.45, c, '#3a2a1a', 2); circ(0, 0, r, c, '#3a2a1a', 3); circ(Math.cos(f.fa) * 6, -r * 0.35 + Math.sin(f.fa) * 3, r * 0.4, '#6a4a3a'); ctx.fillStyle = '#ddd'; ctx.fillRect(Math.cos(f.fa) * 6 - 5, -r * 0.2, 3, 4); ctx.fillRect(Math.cos(f.fa) * 6 + 2, -r * 0.2, 3, 4); circ(Math.cos(f.fa) * 7 - 3, -r * 0.45, 1.8, '#ff3a1a'); circ(Math.cos(f.fa) * 7 + 3, -r * 0.45, 1.8, '#ff3a1a'); },
  shieldbrute(f, r, fl) { const c = fcol(f, fl); circ(0, 0, r, c, '#2a3020', 2); circ(Math.cos(f.fa) * 2, -r * 0.5, r * 0.45, '#5a6a4a'); circ(Math.cos(f.fa) * 3 - 2, -r * 0.55, 1.5, '#fa0'); circ(Math.cos(f.fa) * 3 + 2, -r * 0.55, 1.5, '#fa0'); ctx.save(); ctx.rotate(f.fa); ctx.fillStyle = fl ? '#fff' : '#8a7a5a'; ctx.fillRect(r * 0.6, -r * 1.0, 7, r * 2); ctx.fillStyle = '#5a4a3a'; ctx.fillRect(r * 0.6, -2, 7, 4); ctx.restore(); },
  troll(f, r, fl) { const c = fcol(f, fl); circ(0, 0, r, c, '#2a3a3a', 2); circ(0, -r * 0.6, r * 0.5, c); circ(-3, -r * 0.65, 1.6, '#ff0'); circ(3, -r * 0.65, 1.6, '#ff0'); ctx.save(); ctx.rotate(f.fa); circ(r + 2, 0, 7, '#8a8a7a', '#5a5a4a', 1.5); ctx.restore(); },
  cultist(f, r, fl) { const c = fcol(f, fl); poly([-r, r, r, r, r * 0.6, -r * 0.4, -r * 0.6, -r * 0.4], c, '#3a0a0a'); circ(0, -r * 0.45, r * 0.55, '#3a0a0a'); poly([-r * 0.55, -r * 0.6, 0, -r * 1.5, r * 0.55, -r * 0.6], '#3a0a0a'); circ(-2, -r * 0.45, 1.5, '#ffb030'); circ(2, -r * 0.45, 1.5, '#ffb030'); ctx.save(); ctx.rotate(f.fa); line(2, 4, r + 8, 4, '#aaa', 2); poly([r + 6, 1, r + 12, 4, r + 6, 7], '#ddd'); ctx.restore(); },
  pyro(f, r, fl) { FOE_ART.cultist(f, r, fl); const t = G.time * 9 + f.seed; circ(Math.cos(f.fa) * (r + 4), Math.sin(f.fa) * (r + 4) - 4, 4 + Math.sin(t), '#ffb030'); circ(Math.cos(f.fa) * (r + 4), Math.sin(f.fa) * (r + 4) - 4, 8, 'rgba(255,140,40,0.3)'); },
  firebrand(f, r, fl) { FOE_ART.cultist(f, r, fl); const pulse = f.state === 'windup' ? (Math.floor(G.time * 16) % 2 ? '#fff' : '#ff3a1a') : '#ff7a2a'; circ(0, 2, 5, pulse); },
  imp(f, r, fl) { const flap = Math.sin(G.time * 22 + f.seed) * 5; shadow(0, 8, r * 0.7); ctx.translate(0, -6); poly([-2, 0, -r - 8, -6 - flap, -r - 2, 6], '#5a1a10'); poly([2, 0, r + 8, -6 - flap, r + 2, 6], '#5a1a10'); circ(0, 0, r, fl ? '#fff' : f.d.col, '#5a1a10', 2); poly([-r * 0.6, -r * 0.6, -r * 0.3, -r * 1.4, 0, -r * 0.7], '#3a0a0a'); poly([r * 0.6, -r * 0.6, r * 0.3, -r * 1.4, 0, -r * 0.7], '#3a0a0a'); circ(-2.5, -1, 1.6, '#ff0'); circ(2.5, -1, 1.6, '#ff0'); },
  demon(f, r, fl) { const c = fcol(f, fl); poly([-r * 0.7, -r * 0.6, -r * 1.2, -r * 1.6, -r * 0.2, -r * 0.9], '#e0d0b0'); poly([r * 0.7, -r * 0.6, r * 1.2, -r * 1.6, r * 0.2, -r * 0.9], '#e0d0b0'); circ(0, 0, r, c, '#2a0408', 3); ctx.fillStyle = '#ffde5a'; ctx.fillRect(Math.cos(f.fa) * 4 - 8, -r * 0.35, 5, 3); ctx.fillRect(Math.cos(f.fa) * 4 + 3, -r * 0.35, 5, 3); ctx.save(); ctx.rotate(f.fa); line(r * 0.5, 0, r + 22, 0, '#4a3a3a', 4); poly([r + 14, -10, r + 26, 0, r + 14, 10], '#9a9aa0'); ctx.restore(); },
  reaper(f, r, fl) { const flick = f.awake ? 0.9 + Math.sin(G.time * 20) * 0.08 : 0.55; ctx.globalAlpha = flick * (f.repel > 0 ? 0.5 : 1); circ(0, 0, r + 12, 'rgba(120,255,255,0.08)'); ctx.fillStyle = f.frz > 0 ? '#335' : '#0b0b12'; ctx.beginPath(); ctx.moveTo(0, -r - 10); ctx.quadraticCurveTo(r + 6, -r, r + 2, r + 4); for (let k = 0; k <= 4; k++) ctx.lineTo(r + 2 - k * (r + 1) / 2, r + 4 + (k % 2 ? -6 : 0) + Math.sin(G.time * 6 + k) * 2); ctx.quadraticCurveTo(-r - 6, -r, 0, -r - 10); ctx.fill(); ctx.strokeStyle = '#2a2a3a'; ctx.lineWidth = 1.5; ctx.stroke(); circ(-3.5, -7, 2.2, '#7ff'); circ(3.5, -7, 2.2, '#7ff'); line(r + 2, r, r + 6, -r - 12, '#9aa', 2.5); ctx.strokeStyle = '#cdd'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(r - 6, -r - 10, 13, -0.3, 1.2); ctx.stroke(); ctx.globalAlpha = 1; },
  // bosses
  ossuary(f, r, fl) { const c = fl ? '#fff' : '#e8dcc0'; circ(0, 4, r, '#3a3020', '#1a1408', 3); for (let k = -3; k <= 3; k++) line(-r * 0.8, k * 6 + 4, r * 0.8, k * 6 + 4, c, 2.5); circ(Math.cos(f.fa) * 4, -r * 0.55, r * 0.5, c, '#8a7a5a', 2); circ(Math.cos(f.fa) * 6 - 6, -r * 0.6, 4, '#200'); circ(Math.cos(f.fa) * 6 + 6, -r * 0.6, 4, '#200'); circ(Math.cos(f.fa) * 6 - 6, -r * 0.6, 1.8, '#ff4a2a'); circ(Math.cos(f.fa) * 6 + 6, -r * 0.6, 1.8, '#ff4a2a'); ctx.fillStyle = '#d8b040'; for (let k = -2; k <= 2; k++) poly([k * 7 - 3, -r * 0.95, k * 7, -r * 1.35, k * 7 + 3, -r * 0.95], '#d8b040'); ctx.save(); ctx.rotate(f.fa); line(r * 0.4, 10, r + 30, 10, '#8a7a5a', 6); circ(r + 30, 10, 9, c); ctx.restore(); },
  rootmaw(f, r, fl) { if (f.state === 'burrow' || f.state === 'erupt') { ell(0, 6, r * 0.9, r * 0.45, '#4a3a2a'); for (let k = 0; k < 6; k++) circ(Math.cos(k + G.time * 4) * r * 0.6, 6 + Math.sin(k * 2 + G.time * 4) * r * 0.25, 5, '#6a5040'); return; } const c = fl ? '#fff' : '#7a5a4a'; ell(0, r * 0.4, r * 1.2, r * 0.6, '#3a2a1a'); for (let k = 3; k >= 0; k--) circ(-Math.cos(f.fa) * k * 12, -Math.sin(f.fa) * k * 6 + 4, r * (1 - k * 0.12), k ? '#6a4a3a' : c, '#2a1a10', 2); ctx.save(); ctx.rotate(f.fa); circ(r * 0.5, 0, r * 0.6, '#2a0a0a'); for (let k = 0; k < 10; k++) { const a = k / 10 * 6.28; poly([r * 0.5 + Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6, r * 0.5 + Math.cos(a) * r * 0.25, Math.sin(a) * r * 0.25, r * 0.5 + Math.cos(a + 0.3) * r * 0.6, Math.sin(a + 0.3) * r * 0.6], '#e8e0c8'); } ctx.restore(); },
  forgemaster(f, r, fl) { const c = fl ? '#fff' : '#5a3a30'; circ(0, 0, r, c, '#1a0a08', 3); ctx.fillStyle = '#8a8a90'; ctx.fillRect(-r * 0.8, -r * 0.3, r * 1.6, r * 0.5); ctx.fillStyle = '#ff7a2a'; ctx.fillRect(-r * 0.6, -r * 0.15, r * 1.2, r * 0.18); circ(0, r * 0.35, 7, '#ffb030'); circ(0, r * 0.35, 13, 'rgba(255,160,40,0.35)'); circ(Math.cos(f.fa) * 4, -r * 0.6, r * 0.38, '#3a3a40', '#111', 2); ctx.fillStyle = '#ff8a2a'; ctx.fillRect(Math.cos(f.fa) * 4 - 8, -r * 0.65, 16, 3); ctx.save(); ctx.rotate(f.fa); line(r * 0.5, 12, r + 26, 12, '#4a3a2a', 6); ctx.fillStyle = '#6a6a70'; ctx.fillRect(r + 18, -2, 18, 28); ctx.restore(); },
  sovereign(f, r, fl) { const sh = f.invuln && !f.dying; if (sh) { circ(0, 0, r + 14 + Math.sin(G.time * 4) * 2, 'rgba(180,120,255,0.18)', 'rgba(200,160,255,0.7)', 2); } ctx.fillStyle = fl ? '#fff' : '#1a1028'; ctx.beginPath(); ctx.moveTo(0, -r - 16); ctx.quadraticCurveTo(r + 10, -r * 0.4, r, r + 6); for (let k = 0; k <= 6; k++) ctx.lineTo(r - k * r / 3, r + 6 + (k % 2 ? -8 : 0) + Math.sin(G.time * 5 + k) * 3); ctx.quadraticCurveTo(-r - 10, -r * 0.4, 0, -r - 16); ctx.fill(); circ(0, -r * 0.45, r * 0.42, '#0a0612'); circ(-6, -r * 0.5, 3, '#d8b0ff'); circ(6, -r * 0.5, 3, '#d8b0ff'); for (let k = 0; k < 5; k++) { const a = G.time * 1.5 + k * 1.256; circ(Math.cos(a) * (r + 22), Math.sin(a) * (r + 10) - 10, 4, '#b07aff'); } },
};

// ---------------------------------------------------------------- spawners, props, pickups, allies, shots
function drawSpawner(s) {
  ctx.save(); ctx.translate(s.x, s.y);
  const fl = s.flash > 0, glow = 0.3 + 0.2 * Math.sin(G.time * 4 + s.x);
  if (s.pylon) { const k = s.hp / s.maxhp; circ(0, 0, 30, `rgba(176,122,255,${glow * 0.5})`); poly([0, -30, 14, 0, 0, 22, -14, 0], fl ? '#fff' : '#9a6aff', '#e0c8ff', 2); poly([0, -22, 7, 0, 0, 14, -7, 0], '#e8d8ff'); line(0, 0, 0, -400, `rgba(190,140,255,${0.25 + glow * 0.3})`, 3); ctx.fillStyle = '#000'; ctx.fillRect(-20, 28, 40, 4); ctx.fillStyle = '#b07aff'; ctx.fillRect(-20, 28, 40 * k, 4); ctx.restore(); return; }
  circ(0, 0, 16 + s.tier * 3, `rgba(${s.style === 'w1' ? '170,220,255' : s.style === 'w2' ? '150,220,90' : s.style === 'w3' ? '255,110,50' : '200,140,255'},${glow * 0.45})`);
  if (s.style === 'w1') { ctx.strokeStyle = fl ? '#fff' : '#e8dcc0'; ctx.lineWidth = 4; ctx.lineCap = 'round'; for (let k = 0; k < 3 + s.tier * 2; k++) { const a = k * 2.1, l = 10; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 7 - Math.cos(a + 1) * l / 2, Math.sin(a) * 5 - Math.sin(a + 1) * l / 2 + 4); ctx.lineTo(Math.cos(a) * 7 + Math.cos(a + 1) * l / 2, Math.sin(a) * 5 + Math.sin(a + 1) * l / 2 + 4); ctx.stroke(); } ctx.lineCap = 'butt'; circ(0, -4, 7, fl ? '#fff' : '#efe6d0'); circ(-2.5, -5, 1.8, '#222'); circ(2.5, -5, 1.8, '#222'); }
  else if (s.style === 'w2') { const p = 1 + Math.sin(G.time * 3 + s.x) * 0.06; ell(0, 2, 15 * p, 12 * p, fl ? '#fff' : '#d8d0b0'); ctx.strokeStyle = '#8a7a5a'; ctx.lineWidth = 1.5; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(0, 2, 6 + k * 2.5, k, k + 2); ctx.stroke(); } for (let k = 0; k < s.tier + 2; k++) circ(Math.cos(k * 2) * 7, 2 + Math.sin(k * 2) * 5, 2.5, 'rgba(120,200,80,0.7)'); }
  else { ctx.fillStyle = fl ? '#fff' : '#3a3036'; poly([-15, 14, 15, 14, 11, -6, -11, -6], fl ? '#fff' : '#4a3a3a', '#1a1010', 2); const c = s.style === 'w3' ? '#ff7a2a' : '#b07aff'; for (let k = 0; k < 4; k++) { const t = G.time * 8 + k; circ(Math.sin(t) * 6, -8 - k * 4 - (t % 1) * 4, 5 - k, c); } }
  for (let k = 0; k < s.tier; k++) circ(-8 + k * 8, 22, 2.6, '#ffd27a');
  ctx.restore();
}
function drawProp(p) {
  ctx.save(); ctx.translate(p.x, p.y); shadow(0, 0, p.r);
  if (p.kind === 'urn') { ell(0, 0, 9, 11, '#a08060'); ctx.fillStyle = '#7a5a40'; ctx.fillRect(-5, -13, 10, 4); line(-8, -2, 8, -2, '#6a4a30', 1.5); }
  else if (p.kind === 'barrel') { ctx.fillStyle = '#8a4a2a'; ctx.fillRect(-10, -13, 20, 24); ctx.fillStyle = '#5a5a5a'; ctx.fillRect(-10, -9, 20, 3); ctx.fillRect(-10, 4, 20, 3); circ(0, -1, 4, '#ff5a2a'); ctx.fillStyle = '#fff'; ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center'; ctx.fillText('!', 0, 2); }
  else if (p.kind === 'chest') { ctx.fillStyle = '#7a4a20'; ctx.fillRect(-13, -9, 26, 18); ctx.fillStyle = '#a06a30'; ctx.fillRect(-13, -12, 26, 6); ctx.fillStyle = '#ffd84a'; ctx.fillRect(-13, -3, 26, 2); ctx.fillRect(-2, -4, 4, 6); }
  else if (p.kind === 'legend') { const g = 0.5 + 0.3 * Math.sin(G.time * 3); circ(0, 0, 26, `rgba(255,216,74,${g * 0.3})`); ctx.fillStyle = '#3a2a5a'; ctx.fillRect(-15, -11, 30, 22); ctx.fillStyle = '#ffd84a'; ctx.fillRect(-15, -14, 30, 6); ctx.fillRect(-15, -1, 30, 2); circ(0, 2, 4, '#ffd84a'); ctx.fillStyle = '#222'; ctx.fillRect(-1, 2, 2, 5); }
  ctx.restore();
}
function drawPickup(it) {
  const bob = Math.sin(G.time * 3 + it.x) * 1.5;
  ctx.save(); ctx.translate(it.x, it.y + bob); shadow(0, -bob, 8);
  switch (it.kind) {
    case 'ration': ell(-2, 0, 9, 6, '#d0a060'); for (let k = -1; k <= 1; k++) line(-2 + k * 4, -5, k * 4, 0, '#8a6030', 1); poly([4, 7, 12, 7, 12, 1], '#f5d040'); break;
    case 'feast': ell(0, 3, 14, 6, '#b8b8c0'); ell(-1, -1, 10, 7, '#9a4a20', -0.2); ell(-3, -3, 4, 2, '#c8682a', -0.2); ctx.fillStyle = '#f2ead8'; ctx.fillRect(8, -6, 6, 3); circ(14, -5, 2.2, '#f2ead8'); break;
    case 'potion': circ(0, 0, 14, `rgba(120,180,255,${0.2 + 0.15 * Math.sin(G.time * 5)})`); ctx.fillStyle = '#ddd'; ctx.fillRect(-2.5, -11, 5, 6); ctx.fillStyle = '#8a5a2a'; ctx.fillRect(-3, -13, 6, 3); circ(0, 1, 7, '#4a8cff', '#cfe0ff', 1.5); circ(-2, -1, 2, '#cfe8ff'); break;
    case 'crown': { const a = it.floatT !== undefined ? Math.min(1, it.floatT) : 1; ctx.globalAlpha = a; ctx.translate(0, -6 - Math.sin(G.time * 4) * 3); ctx.fillStyle = '#ffd84a'; ctx.strokeStyle = '#7a5a10'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-10, 6); ctx.lineTo(-10, -4); ctx.lineTo(-5, 1); ctx.lineTo(0, -7); ctx.lineTo(5, 1); ctx.lineTo(10, -4); ctx.lineTo(10, 6); ctx.closePath(); ctx.fill(); ctx.stroke(); break; }
    case 'coin': circ(0, -2, 8, '#e8e0c8'); circ(-3, -4, 1.8, '#222'); circ(3, -4, 1.8, '#222'); ctx.fillStyle = '#222'; ctx.fillRect(-3, 1, 6, 1.5); break;
    case 'cache': ctx.fillStyle = '#5ac8ff'; for (const [dx, dy] of [[-5, 2], [5, 2], [0, -4]]) { ctx.beginPath(); ctx.moveTo(dx, dy - 8); ctx.lineTo(dx + 4, dy); ctx.lineTo(dx, dy + 6); ctx.lineTo(dx - 4, dy); ctx.closePath(); ctx.fill(); } break;
    case 'shard': ctx.fillStyle = '#9fe8ff'; ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(5, 0); ctx.lineTo(0, 8); ctx.lineTo(-5, 0); ctx.closePath(); ctx.fill(); break;
    case 'key': ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(-6, 0, 4, 0, 6.28); ctx.moveTo(-2, 0); ctx.lineTo(9, 0); ctx.moveTo(6, 0); ctx.lineTo(6, 4); ctx.moveTo(9, 0); ctx.lineTo(9, 4); ctx.stroke(); circ(0, 0, 14, 'rgba(255,216,74,0.12)'); break;
    case 'gold': { const n = it.val > 60 ? 5 : it.val > 25 ? 3 : 1; const pts = [[-4, 2], [3, 3], [0, -1], [5, -3], [-5, -3]]; for (let k = 0; k < n; k++) circ(pts[k][0], pts[k][1], 3.5, '#ffd84a', '#a07a10', 1); break; }
  }
  ctx.restore();
}
const MINION_SPR = { warrior: 'warrior', archer: 'archer', spear: 'spear', guard: 'guard', mage: 'mage', wraith: 'wraith', golem: 'golem' };
function drawAlly(a) {
  ctx.save(); ctx.translate(a.x, a.y);
  const mk = a.owner && a.owner.id === 'vesper' && MINION_SPR[a.kind];
  if (mk && typeof minionReady === 'function' && minionReady(mk)) {
    const fly = a.d.fly, bob = fly ? -10 + Math.sin(G.time * 3 + a.x * 0.01) * 3 : 0;
    shadow(0, 2, a.r * (fly ? 0.7 : 1));
    if (a.kind === 'golem' || a.kind === 'wraith' || a.kind === 'mage') { ctx.globalCompositeOperation = 'lighter'; circ(0, -a.r + bob, a.r * 1.3, `rgba(150,90,255,${0.10 + 0.05 * Math.sin(G.time * 4)})`); ctx.globalCompositeOperation = 'source-over'; }
    if (a.kind === 'wraith') ctx.globalAlpha = 0.85;
    const left = Math.cos(a.fa) < -0.2, step = Math.abs(Math.sin(a.walk * 0.9)) * (fly ? 0 : 2);
    drawSpriteFrame('minions', mk, 'down', G.time + (a.seedT || (a.seedT = Math.random() * 3)), 0, 4 + bob - step, SPR.minions.man.scale, { sx: left ? -1 : 1 });
    if (a.flash > 0) { ctx.globalCompositeOperation = 'lighter'; circ(0, -a.r + bob, a.r, 'rgba(255,255,255,0.35)'); ctx.globalCompositeOperation = 'source-over'; }
    if (a.d.taunt) { ctx.globalAlpha = 0.5 + 0.3 * Math.sin(G.time * 6); ctx.strokeStyle = '#b07aff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 2, a.r + 10, (a.r + 10) * 0.5, 0, 0, 6.283); ctx.stroke(); }
    ctx.restore();
    if (a.maxhp > 1 && a.hp < a.maxhp) { ctx.fillStyle = '#000'; ctx.fillRect(a.x - 12, a.y - a.r * 2.4 - 10, 24, 3); ctx.fillStyle = '#b07aff'; ctx.fillRect(a.x - 12, a.y - a.r * 2.4 - 10, 24 * a.hp / a.maxhp, 3); }
    return;
  }
  if (['warrior', 'archer', 'spear', 'guard', 'mage', 'golem', 'wraith'].includes(a.kind)) { if (a.kind === 'golem') ctx.scale(1.6, 1.6); const f = { fa: a.fa, d: { col: '#cfe8d8' }, seed: 0, walk: a.walk }; ctx.globalAlpha = 0.95; shadow(0, 0, a.r); FOE_ART[a.kind === 'archer' ? 'skelarcher' : 'skeleton'](f, a.r, a.flash > 0); circ(0, -a.r - 4, 2, '#7ff5d0'); }
  else if (a.kind === 'shade') { ctx.globalAlpha = 0.8; circ(0, 0, a.r + 4, 'rgba(127,245,208,0.25)'); circ(0, 0, a.r, '#7ff5d0'); circ(-2, -2, 1.6, '#033'); circ(2, -2, 1.6, '#033'); }
  else if (a.kind === 'gargoyle') { const flap = Math.sin(G.time * 12) * 4; shadow(0, 10, 10); ctx.translate(0, -10); poly([-3, 0, -24, -8 - flap, -18, 8], '#6a6a7a'); poly([3, 0, 24, -8 - flap, 18, 8], '#6a6a7a'); circ(0, 0, a.r, '#8a8a9a', '#4a4a5a', 2); circ(-4, -3, 2, '#ff8a2a'); circ(4, -3, 2, '#ff8a2a'); }
  else if (a.kind === 'illusion') { ctx.globalAlpha = 0.55 + 0.15 * Math.sin(G.time * 6); const h = a.owner; drawHeroSprite(h.def, 0, 0, a.fa, 0.9, { walk: a.walk, weapon: h.weapon }); }
  else if (a.kind === 'sprite') { circ(0, 0, 12, 'rgba(216,255,138,0.25)'); circ(0, 0, 6, '#eaffb0'); for (let k = 0; k < 2; k++) ell(k ? 6 : -6, -3, 5, 2.5, 'rgba(255,255,255,0.6)', k ? 0.5 : -0.5); }
  ctx.restore();
  if (a.maxhp > 1 && a.hp < a.maxhp && !a.orbit) { ctx.fillStyle = '#000'; ctx.fillRect(a.x - 12, a.y - a.r - 10, 24, 3); ctx.fillStyle = '#7ff5d0'; ctx.fillRect(a.x - 12, a.y - a.r - 10, 24 * a.hp / a.maxhp, 3); }
}
function drawShot(s) {
  const a = Math.atan2(s.vy, s.vx);
  ctx.save(); ctx.translate(s.x, s.y - (s.z || 0));
  if (s.lob) { ctx.restore(); ell(s.x, s.y, s.r, s.r * 0.4, 'rgba(0,0,0,0.3)'); ctx.save(); ctx.translate(s.x, s.y - (s.z || 0)); circ(0, 0, s.r + 3, hexA(s.col.length === 7 ? s.col : '#ffffff', 0.3)); circ(0, 0, s.r, s.col); ctx.restore(); return; }
  switch (s.kind) {
    case 'arrow': case 'power': ctx.rotate(a); line(-12, 0, 6, 0, s.kind === 'power' ? '#fff6c0' : '#e8d8b0', s.kind === 'power' ? 3 : 2); poly([10, 0, 4, -3, 4, 3], '#ccc'); if (s.kind === 'power') { line(-30, 0, -12, 0, 'rgba(255,240,150,0.4)', 6); } break;
    case 'heart': ctx.rotate(a); line(-60, 0, 10, 0, 'rgba(255,100,140,0.4)', 14); line(-30, 0, 14, 0, '#ffd0e0', 5); poly([20, 0, 8, -7, 8, 7], '#fff'); break;
    case 'fire': circ(0, 0, s.r + 4, 'rgba(255,120,30,0.35)'); circ(0, 0, s.r, '#ff8a2a'); circ(0, 0, s.r * 0.45, '#fff2a0'); break;
    case 'shield': ctx.rotate(s.t * 20); circ(0, 0, 11, '#d8c890', '#8a7a40', 2); circ(-3, 0, 7, '#3aa39a'); break;
    case 'soulbolt': { ctx.rotate(a); ctx.globalCompositeOperation = 'lighter'; for (let k = 1; k <= 4; k++) circ(-k * 7, Math.sin(G.time * 30 + k) * 2, 6 - k, `rgba(150,90,255,${0.5 - k * 0.1})`); circ(0, 0, 11, 'rgba(160,100,255,0.35)'); ctx.globalCompositeOperation = 'source-over'; circ(0, 0, 6, '#e8d8ff'); circ(-2, -1.5, 1.3, '#3a1a5a'); circ(2, -1.5, 1.3, '#3a1a5a'); line(-2, 2.5, 2, 2.5, '#3a1a5a', 1); break; }
    case 'stormspear': ctx.rotate(a); line(-34, 0, -6, 0, 'rgba(191,230,255,0.35)', 10); line(-26, 0, 8, 0, '#8a6a44', 3); poly([18, 0, 6, -5, 6, 5], '#e8f6ff'); for (let k = 0; k < 3; k++) line(-20 + k * 10, R(-6, 6), -14 + k * 10, R(-6, 6), '#dff2ff', 1.5); break;
    case 'hatchet': ctx.rotate(s.t * 22); line(-8, 0, 8, 0, '#6a4a2a', 3); poly([4, -7, 12, -2, 12, 4, 4, 2], '#c0c8d0'); break;
    case 'iceorb': circ(0, 0, s.r + 5, 'rgba(190,240,255,0.3)'); circ(0, 0, s.r, '#dff8ff', '#8fd8ff', 2); break;
    case 'fireorb': circ(0, 0, s.r + 5, 'rgba(255,90,40,0.3)'); circ(0, 0, s.r, '#ff7a3a', '#ffb03a', 2); break;
    case 'web': circ(0, 0, s.r, 'rgba(240,240,250,0.8)'); for (let k = 0; k < 4; k++) line(-s.r, 0, s.r, 0, '#aaa', 1), ctx.rotate(0.785); break;
    case 'skull': circ(0, 0, s.r + 4, 'rgba(192,128,255,0.3)'); circ(0, 0, s.r, '#d8b0ff'); circ(-2.5, -1, 1.6, '#204'); circ(2.5, -1, 1.6, '#204'); break;
    case 'bone': ctx.rotate(a); line(-8, 0, 8, 0, s.col, 3); circ(8, 0, 3, s.col); circ(-8, 0, 3, s.col); break;
    case 'acid': circ(0, 0, s.r + 3, 'rgba(150,230,60,0.3)'); circ(0, 0, s.r, '#9adf3a'); break;
    case 'void': circ(0, 0, s.r + 3, 'rgba(176,122,255,0.3)'); circ(0, 0, s.r, '#c8a0ff'); break;
    case 'bolt': circ(0, 0, 6, 'rgba(190,230,255,0.4)'); circ(0, 0, 3.5, '#eaf6ff'); break;
    default: circ(0, 0, s.r + 3, hexA(s.col && s.col.length === 7 ? s.col : '#ff7af0', 0.3)); circ(0, 0, s.r, s.col || '#ff7af0');
  }
  ctx.restore();
}
function drawHazard(hz) {
  switch (hz.kind) {
    case 'spikes': { const k = Math.min(1, hz.t / 0.12), fade = Math.max(0, 1 - Math.max(0, hz.t - 0.35) / 0.25); ctx.save(); ctx.globalAlpha = fade;
      ell(hz.x, hz.y, hz.r, hz.r * 0.5, 'rgba(90,40,140,0.35)'); let sd = hz.seed;
      for (let i = 0; i < 14; i++) { sd = (sd * 9301 + 49297) % 233280; const ra = sd / 233280; const an = i / 14 * 6.283 + ra, d = (0.25 + 0.7 * ((i * 7) % 5) / 5) * hz.r, x = hz.x + Math.cos(an) * d, y = hz.y + Math.sin(an) * d * 0.5, h = (18 + ra * 22) * k;
        poly([x - 5, y, x + 5, y, x + (ra - 0.5) * 6, y - h], '#e8e0c8', '#5a4a3a', 1); line(x - 1, y - 2, x + (ra - 0.5) * 5, y - h + 4, 'rgba(255,255,255,0.5)', 1); }
      ctx.globalCompositeOperation = 'lighter'; circ(hz.x, hz.y, hz.r * 0.6, 'rgba(176,122,255,0.18)'); ctx.restore(); return; }
    case 'tele': { if (!hz.r) return; const k = Math.min(1, hz.t / hz.delay); ctx.strokeStyle = hz.col || '#f44'; ctx.globalAlpha = 0.5 + 0.4 * k; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(hz.x, hz.y, hz.r, 0, 6.28); ctx.stroke(); circ(hz.x, hz.y, hz.r * k, hexA(hz.col && hz.col.length === 7 ? hz.col : '#ff4444', 0.25)); ctx.globalAlpha = 1; break; }
    case 'mine': if (hz.owner && !hz.done) { ctx.globalAlpha = 0.35; circ(hz.x, hz.y, 5, '#ffe95a'); ctx.globalAlpha = 1; } break;
    case 'bomb': { const k = hz.t / hz.delay; shadow(hz.x, hz.y, 8); circ(hz.x, hz.y - 4, 8, '#2a2a3a', '#ffcf5a', 2); circ(hz.x + 4, hz.y - 12, 2 + Math.random() * 2, Math.floor(G.time * (6 + k * 20)) % 2 ? '#fff' : '#ff8a2a'); ctx.strokeStyle = 'rgba(255,200,90,0.4)'; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(hz.x, hz.y, hz.r, 0, 6.28); ctx.stroke(); ctx.setLineDash([]); break; }
    case 'fire': { const k = 1 - hz.t / hz.life; for (let i = 0; i < 3; i++) circ(hz.x + Math.sin(G.time * 7 + i * 2) * hz.r * 0.3, hz.y + Math.cos(G.time * 5 + i) * hz.r * 0.2, hz.r * (0.6 + 0.2 * i) * Math.min(1, k * 3), hz.acid ? `rgba(150,220,60,${0.25 * k})` : `rgba(255,${100 + i * 50},30,${0.28 * k})`); break; }
    case 'frost': circ(hz.x, hz.y, hz.r, 'rgba(190,240,255,0.16)', 'rgba(220,250,255,0.5)', 2); for (let i = 0; i < 6; i++) { const a = G.time + i; circ(hz.x + Math.cos(a) * hz.r * 0.7, hz.y + Math.sin(a) * hz.r * 0.7, 2, '#fff'); } break;
    case 'root': circ(hz.x, hz.y, hz.r, 'rgba(90,150,50,0.18)', 'rgba(120,200,70,0.5)', 2); for (let i = 0; i < 8; i++) { const a = i * 0.785; line(hz.x + Math.cos(a) * 20, hz.y + Math.sin(a) * 20, hz.x + Math.cos(a + 0.3) * hz.r * 0.9, hz.y + Math.sin(a + 0.3) * hz.r * 0.9, '#5a8a2a', 2); } break;
    case 'smoke': for (let i = 0; i < 7; i++) circ(hz.x + Math.cos(i * 0.9 + G.time * 0.5) * hz.r * 0.5, hz.y + Math.sin(i * 1.3 + G.time * 0.4) * hz.r * 0.4, hz.r * 0.55, 'rgba(90,90,100,0.22)'); break;
    case 'ward': circ(hz.x, hz.y, hz.r, 'rgba(255,240,120,0.1)', `rgba(255,240,120,${0.5 + 0.3 * Math.sin(G.time * 20)})`, 3); for (let i = 0; i < 5; i++) { const a = Math.random() * 6.28; line(hz.x + Math.cos(a) * hz.r, hz.y + Math.sin(a) * hz.r, hz.x + Math.cos(a + 0.3) * hz.r * 0.8, hz.y + Math.sin(a + 0.3) * hz.r * 0.8, '#fff6a0', 1.5); } break;
    case 'bubble': circ(hz.x, hz.y, hz.r, 'rgba(160,210,255,0.12)', 'rgba(200,230,255,0.7)', 3); break;
    case 'whirl': for (let i = 0; i < 3; i++) { ctx.strokeStyle = 'rgba(220,240,255,0.5)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(hz.x, hz.y, hz.r * (0.4 + i * 0.25), G.time * 8 + i, G.time * 8 + i + 3.5); ctx.stroke(); } break;
    case 'consecrate': { const k = Math.min(1, hz.t / 0.25) * Math.min(1, (hz.life - hz.t) / 0.5); ctx.save(); ctx.globalAlpha = k; ctx.globalCompositeOperation = 'lighter';
      circ(hz.x, hz.y, hz.r, 'rgba(255,220,120,0.14)', 'rgba(255,236,160,0.75)', 3); circ(hz.x, hz.y, hz.r * 0.62, null, 'rgba(255,246,200,0.35)', 2);
      for (let i = 0; i < 8; i++) { const a = i * 0.785 + G.time * 0.6; line(hz.x + Math.cos(a) * hz.r * 0.3, hz.y + Math.sin(a) * hz.r * 0.3, hz.x + Math.cos(a) * hz.r * 0.92, hz.y + Math.sin(a) * hz.r * 0.92, 'rgba(255,240,170,0.35)', 2); }
      for (let i = 0; i < 3; i++) { const a = Math.random() * 6.28, d = Math.random() * hz.r; G.parts.push({ x: hz.x + Math.cos(a) * d, y: hz.y + Math.sin(a) * d, vx: 0, vy: -40, life: 0.5, max: 0.5, col: '#fff2b0', size: 2, grav: 0 }); }
      ctx.restore(); break; }
    case 'aegis': circ(hz.x, hz.y, hz.r, 'rgba(255,240,160,0.12)', `rgba(255,240,160,${0.55 + 0.25 * Math.sin(G.time * 8)})`, 4); circ(hz.x, hz.y, hz.r - 8, null, 'rgba(220,240,255,0.35)', 2); break;
    case 'dread': for (let i = 0; i < 8; i++) circ(hz.x + Math.cos(i * 0.8 + G.time * 0.4) * hz.r * 0.55, hz.y + Math.sin(i * 1.1 + G.time * 0.3) * hz.r * 0.45, hz.r * 0.45, 'rgba(90,40,140,0.16)'); circ(hz.x, hz.y, hz.r, null, 'rgba(176,122,255,0.4)', 2); break;
    case 'miasma': circ(hz.x, hz.y, hz.r, 'rgba(120,170,40,0.22)', 'rgba(150,210,60,0.5)', 2); for (let i = 0; i < 4; i++) circ(hz.x + Math.cos(G.time + i * 1.6) * hz.r * 0.5, hz.y + Math.sin(G.time * 1.3 + i) * hz.r * 0.35, hz.r * 0.35, 'rgba(140,200,60,0.15)'); break;
    case 'hunger': circ(hz.x, hz.y, hz.r, 'rgba(60,200,160,0.1)', 'rgba(127,245,208,0.5)', 2); break;
  }
}

// ---------------------------------------------------------------- world layer
const darkCv = document.createElement('canvas'); darkCv.width = W; darkCv.height = H; const dctx = darkCv.getContext('2d');
function drawDynamicTiles() {
  const m = G.map, th = m.theme, x0 = Math.max(0, Math.floor(G.cam.x / T) - 1), y0 = Math.max(0, Math.floor(G.cam.y / T) - 1),
    x1 = Math.min(m.w - 1, Math.ceil((G.cam.x + W) / T) + 1), y1 = Math.min(m.h - 1, Math.ceil((G.cam.y + H) / T) + 1);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const t = m.t[y * m.w + x], px = x * T, py = y * T;
    if (t === TL.GATE) { ctx.fillStyle = '#3a2410'; ctx.fillRect(px, py + 2, T, T - 2); ctx.fillStyle = '#7a5020'; for (let k = 0; k < 4; k++) ctx.fillRect(px + 2 + k * 8, py + 3, 5, T - 4); ctx.fillStyle = '#c8a040'; ctx.fillRect(px, py + 8, T, 3); ctx.fillRect(px, py + 22, T, 3); circ(px + 16, py + 16, 4, '#ffd84a', '#7a5a10', 1.5); ctx.fillStyle = '#222'; ctx.fillRect(px + 15, py + 15, 2, 4); }
    else if (t === TL.AGATE) { ctx.fillStyle = '#2a2a30'; ctx.fillRect(px, py, T, T); ctx.fillStyle = '#6a6a74'; for (let k = 0; k < 4; k++) ctx.fillRect(px + 3 + k * 8, py, 3, T); ctx.fillStyle = 'rgba(255,60,40,' + (0.3 + 0.2 * Math.sin(G.time * 5)) + ')'; ctx.fillRect(px, py + T - 4, T, 4); }
    else if (t === TL.EXIT) { const open = G.exitOpen, cx = px + 16, cy = py + 16; circ(cx, cy, 15, '#05030a', open ? '#9fffe0' : '#555', 3); if (open) { for (let k = 0; k < 3; k++) { ctx.strokeStyle = `rgba(150,255,220,${0.6 - k * 0.15})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, 4 + k * 4, G.time * (3 + k) , G.time * (3 + k) + 4); ctx.stroke(); } circ(cx, cy, 26 + Math.sin(G.time * 4) * 3, 'rgba(120,255,210,0.12)'); } else { line(cx - 8, cy - 8, cx + 8, cy + 8, '#555', 3); line(cx + 8, cy - 8, cx - 8, cy + 8, '#555', 3); } }
    else if (t === TL.SPIKE) { if (G.spikesUp) { ctx.fillStyle = '#c8c8d0'; for (let k = 0; k < 4; k++) for (let j = 0; j < 4; j++) poly([px + 4 + k * 7, py + 8 + j * 7, px + 5.5 + k * 7, py + 1 + j * 7, px + 7 + k * 7, py + 8 + j * 7], '#c8c8d0'); } else { ctx.fillStyle = 'rgba(200,200,210,0.25)'; for (let k = 0; k < 4; k++) for (let j = 0; j < 4; j++) ctx.fillRect(px + 5 + k * 7, py + 5 + j * 7, 1, 1); } }
    else if (t === TL.PIT && th.pitGlow && hash(x, y) > 0.7) { ctx.fillStyle = th.pitGlow; ctx.globalAlpha = 0.25 + 0.2 * Math.sin(G.time * 2 + x + y); ctx.fillRect(px + 4, py + 10, 24, 14); ctx.globalAlpha = 1; }
  }
}
function drawTorches() {
  for (const t of G.map.torches) { if (!onScreen(t.x, t.y)) continue; const fl = Math.sin(G.time * 12 + t.x) * 1.5; ctx.fillStyle = '#4a3a2a'; ctx.fillRect(t.x - 2, t.y - 4, 4, 10); circ(t.x, t.y - 8 + fl * 0.3, 5 + fl * 0.4, '#ff9a2a'); circ(t.x, t.y - 9, 2.5, '#fff2a0'); circ(t.x, t.y - 6, 26 + fl, 'rgba(255,160,60,0.10)'); }
  for (const g of G.map.graves || []) { if (!onScreen(g.x, g.y)) continue; ctx.fillStyle = '#5a5a60'; ctx.fillRect(g.x - 8, g.y - 12, 16, 18); ctx.beginPath(); ctx.arc(g.x, g.y - 12, 8, Math.PI, 0); ctx.fill(); line(g.x, g.y - 14, g.x, g.y - 2, '#3a3a40', 2); line(g.x - 4, g.y - 10, g.x + 4, g.y - 10, '#3a3a40', 2); }
}
function drawDecor() { for (const d of G.decor || []) { if (!onScreen(d.x, d.y)) continue; if (d.kind === 'web') { ctx.strokeStyle = 'rgba(220,220,230,0.25)'; ctx.lineWidth = 1; for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + Math.cos(k) * 18 * d.s, d.y + Math.sin(k) * 18 * d.s); ctx.stroke(); } for (let r = 6; r < 18; r += 5) { ctx.beginPath(); ctx.arc(d.x, d.y, r * d.s, 0, 6.28); ctx.stroke(); } } else if (DECOR_ART[d.kind]) DECOR_ART[d.kind](d); else { for (let k = 0; k < 4; k++) circ(d.x + Math.cos(k * 1.7) * 7 * d.s, d.y + Math.sin(k * 2.3) * 5 * d.s, 3 * d.s, 'rgba(60,50,45,0.6)'); } } }
const DECOR_ART = {
  shrub(d) { for (let k = 0; k < 5; k++) circ(d.x + Math.cos(k * 1.3) * 8 * d.s, d.y + Math.sin(k * 1.9) * 5 * d.s - 3, 6 * d.s, k % 2 ? 'rgba(60,110,40,0.85)' : 'rgba(40,85,30,0.85)'); circ(d.x + 3, d.y - 6, 1.6, 'rgba(220,80,80,0.8)'); },
  reeds(d) { for (let k = 0; k < 6; k++) { const x = d.x + (k - 2.5) * 4 * d.s; line(x, d.y + 6, x + Math.sin(G.time * 1.5 + k) * 2, d.y - 10 * d.s - (k % 3) * 3, 'rgba(110,130,60,0.9)', 1.5); } },
  bones(d) { line(d.x - 8 * d.s, d.y, d.x + 8 * d.s, d.y + 3, 'rgba(230,220,190,0.8)', 2.5); circ(d.x + 10 * d.s, d.y - 4, 4 * d.s, 'rgba(230,220,190,0.85)'); circ(d.x + 9 * d.s, d.y - 4, 1, '#000'); },
  icicle(d) { for (let k = 0; k < 4; k++) { const x = d.x + (k - 1.5) * 7 * d.s; poly([x - 3, d.y + 4, x + 3, d.y + 4, x, d.y - 10 * d.s - k * 2], 'rgba(200,235,255,0.85)', 'rgba(120,180,230,0.9)'); } },
  chains(d) { ctx.strokeStyle = 'rgba(120,110,130,0.8)'; ctx.lineWidth = 1.5; for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.ellipse(d.x + (k - 2) * 5 * d.s, d.y + Math.sin(k) * 2, 3, 2, k % 2 ? 1.2 : 0, 0, 6.283); ctx.stroke(); } circ(d.x, d.y + 6, 3, 'rgba(120,30,40,0.6)'); },
};

function drawSwing(s) {
  const x = s.follow ? s.follow.x : s.x, y = s.follow ? s.follow.y : s.y, k = s.life / s.max;
  if (s.tele) { ctx.fillStyle = s.col; ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, s.r, s.a - s.arc / 2, s.a + s.arc / 2); ctx.closePath(); ctx.fill(); ctx.strokeStyle = 'rgba(255,80,60,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, s.r * (1 - k), s.a - s.arc / 2, s.a + s.arc / 2); ctx.stroke(); return; }
  ctx.globalAlpha = Math.min(1, k * 1.6); ctx.strokeStyle = s.col; ctx.lineCap = 'round';
  const prog = 1 - k, a0 = s.a - s.arc / 2, a1 = s.arc >= 6 ? a0 + 6.28 : a0 + s.arc * Math.min(1, prog * 2.2 + 0.25);
  for (let i = 0; i < 3; i++) { ctx.lineWidth = s.w * (1 - i * 0.3); ctx.beginPath(); ctx.arc(x, y, s.r * (0.72 + i * 0.13), a0, a1); ctx.stroke(); }
  ctx.lineCap = 'butt'; ctx.globalAlpha = 1;
}
function drawBeam(b) {
  ctx.globalAlpha = Math.min(1, b.life * 10);
  if (b.pillar) { // soft additive light column: the hero stays visible inside it
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, b.life * 4) * 0.7;
    const g = ctx.createLinearGradient(b.x2 - b.w, 0, b.x2 + b.w, 0); g.addColorStop(0, hexA(b.col, 0)); g.addColorStop(0.5, hexA(b.col, 0.55)); g.addColorStop(1, hexA(b.col, 0));
    ctx.fillStyle = g; ctx.fillRect(b.x2 - b.w, b.y1, b.w * 2, b.y2 - b.y1 + 6); line(b.x2, b.y1, b.x2, b.y2, 'rgba(255,255,240,0.35)', Math.max(2, b.w * 0.18));
    ctx.restore(); ctx.globalAlpha = 1; return; }
  if (b.zig) { ctx.strokeStyle = b.col; ctx.lineWidth = b.w; ctx.beginPath(); ctx.moveTo(b.x1, b.y1); const n = 7; for (let i = 1; i < n; i++) { const k = i / n; ctx.lineTo(lerp(b.x1, b.x2, k) + R(-9, 9), lerp(b.y1, b.y2, k) + R(-9, 9)); } ctx.lineTo(b.x2, b.y2); ctx.stroke(); }
  else { if (b.glow) line(b.x1, b.y1, b.x2, b.y2, hexA(b.col, 0.25), b.w * 2.4); line(b.x1, b.y1, b.x2, b.y2, b.col, b.w); line(b.x1, b.y1, b.x2, b.y2, 'rgba(255,255,255,0.7)', Math.max(1, b.w * 0.3)); }
  ctx.globalAlpha = 1;
}
function drawHero(h) {
  if (h.dead && hasSprite(h.def)) { drawHeroArt(h.def, h.x, h.y, h.fa, 1, { pose: heroPose(h) }); if (h.reviveHold > 0) { ctx.strokeStyle = '#9fffe0'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(h.x, h.y - 4, 26, -1.57, -1.57 + 6.28 * h.reviveHold); ctx.stroke(); } return; }
  if (h.dead) { // tombstone + revive ring
    ctx.fillStyle = '#6a6a74'; ctx.fillRect(h.x - 9, h.y - 12, 18, 20); ctx.beginPath(); ctx.arc(h.x, h.y - 12, 9, Math.PI, 0); ctx.fill();
    ctx.fillStyle = h.def.color; ctx.fillRect(h.x - 9, h.y + 2, 18, 4);
    if (h.reviveHold > 0) { ctx.strokeStyle = '#9fffe0'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(h.x, h.y - 4, 22, -1.57, -1.57 + 6.28 * h.reviveHold); ctx.stroke(); }
    return;
  }
  ctx.save();
  if (h.ethereal > 0) ctx.globalAlpha = 0.45; else if (h.invis) ctx.globalAlpha = 0.35; else if (h.inv > 0 && h.inv < 2 && Math.floor(G.time * 20) % 2) ctx.globalAlpha = 0.6;
  // ground ring: player colour
  ctx.strokeStyle = PCOL[h.pi]; ctx.lineWidth = 2; ctx.globalAlpha *= 0.8; ctx.beginPath(); ctx.ellipse(h.x, h.y + 10 * h.body.scale, 16 * h.body.scale, 6 * h.body.scale, 0, 0, 6.28); ctx.stroke(); ctx.globalAlpha /= 0.8;
  if (h.buff.titan > 0) circ(h.x, h.y, 26, 'rgba(255,190,90,0.18)');
  if (h.buff.aegis > 0) circ(h.x, h.y, 24, 'rgba(255,240,150,0.18)', 'rgba(255,240,150,0.6)', 2);
  if (h.buff.wings > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(h.x, h.y - 20, 4, h.x, h.y - 20, 90); g.addColorStop(0, 'rgba(255,226,140,0.45)'); g.addColorStop(1, 'rgba(255,226,140,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(h.x, h.y - 20, 90, 0, 6.283); ctx.fill(); ctx.restore(); circ(h.x, h.y, 120, null, `rgba(255,226,140,${0.25 + 0.15 * Math.sin(G.time * 8)})`, 2); }
  if (h.buff.valk > 0) { ctx.strokeStyle = 'rgba(191,230,255,0.55)'; ctx.lineWidth = 2; for (let k = 0; k < 2; k++) { ctx.beginPath(); ctx.arc(h.x, h.y - 6, 22 + k * 6, G.time * 4 + k * 3, G.time * 4 + k * 3 + 1.8); ctx.stroke(); } }
  if (h.buff.ravens > 0) { const t = 1.4 - h.buff.ravens; ctx.save(); ctx.globalAlpha = Math.min(1, h.buff.ravens * 2) * 0.85; // spectral raven-feather wings
    for (const sd of [-1, 1]) for (let k = 0; k < 7; k++) { const a = -1.57 + sd * (0.35 + k * 0.2) * Math.min(1, t * 4), L = 50 + k * 4; ctx.strokeStyle = k % 2 ? 'rgba(42,48,64,0.95)' : 'rgba(191,230,255,0.9)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(h.x, h.y - 40); ctx.lineTo(h.x + Math.cos(a) * L, h.y - 40 + Math.sin(a) * L * 0.6); ctx.stroke(); }
    ctx.restore(); }
  if (h.spin > 0) { for (let k = 0; k < 3; k++) { ctx.strokeStyle = `rgba(255,230,180,${0.5 - k * 0.12})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(h.x, h.y, 34 + k * 8, G.time * 18 + k, G.time * 18 + k + 2.4); ctx.stroke(); } }
  const runeCol = h.spell && h.spell.length === 2 && h.id === 'mirelle' ? RUNE_COL[h.schools[h.spell[0]]] : null;
  const spinA = h.spin > 0 ? G.time * 18 : h.fa;
  const art = hasSprite(h.def), pose = art ? heroPose(h) : null;
  drawHeroSprite(h.def, h.x, h.y, art ? h.fa : spinA, h.scale || 1, { pose, roll: !!(h.dash && h.dash.roll), walk: h.walk, z: h.z, blocking: h.blocking, blockFlash: h.blockFlash > 0, shieldOut: h.shieldOut, weapon: h.weapon, charge: h.charging === 'power' ? h.charge : 0, explosive: h.explosiveArrow, runeCol });
  if (h.lowFlash > 0 && Math.sin(G.time * 40) > 0) { ctx.fillStyle = 'rgba(255,40,30,0.35)'; ctx.beginPath(); ctx.ellipse(h.x, h.y - 16, 18, 26, 0, 0, 6.28); ctx.fill(); }   // low-health red flash
  if (h.bubble) { ctx.strokeStyle = 'rgba(190,240,255,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(h.x, h.y - 14, 26, 0, 6.28); ctx.stroke(); }
  if (h.crown) { const cy = h.y - 58 - (h.z || 0); ctx.fillStyle = '#ffd84a'; ctx.strokeStyle = '#7a5a10'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(h.x - 9, cy + 6); ctx.lineTo(h.x - 9, cy - 3); ctx.lineTo(h.x - 4.5, cy + 1); ctx.lineTo(h.x, cy - 6); ctx.lineTo(h.x + 4.5, cy + 1); ctx.lineTo(h.x + 9, cy - 3); ctx.lineTo(h.x + 9, cy + 6); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  if (h.hurtT > 0.15 && !art) { ctx.globalAlpha = 0.5; circ(h.x, h.y - h.z, 15, '#ff2a2a'); ctx.globalAlpha = 1; }
  ctx.restore();
  // charge bar
  if (h.charging && h.charge > 0) { const full = h.charge >= 1; ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(h.x - 18, h.y + 18, 36, 5); ctx.fillStyle = full ? (Math.floor(G.time * 12) % 2 ? '#fff' : '#ffd84a') : '#ffb84a'; ctx.fillRect(h.x - 18, h.y + 18, 36 * Math.min(1, h.charge), 5); }
  // runes overhead
  if (h.id === 'mirelle') { const rs = h.runes || []; rs.forEach((r, i) => { const x = h.x - 9 + i * 18, y = h.y - (art ? 66 * h.body.scale + 8 : 40); const c = RUNE_COL[h.schools[r]]; circ(x, y, 7, '#111', c, 2); circ(x, y, 3.5, c); }); if (h.spell && h.spell.length === 2 && !rs.length) { const sp = spellOf(h); if (sp) { ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = RUNE_COL[h.schools[h.spell[0]]]; ctx.fillText(sp.name, h.x, h.y - (art ? 60 * h.body.scale + 8 : 34)); } } }
  if (h.reticle) { const p = h.reticle; ctx.strokeStyle = 'rgba(127,245,208,0.8)'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.arc(p.x, p.y, 74, G.time, G.time + 6.28); ctx.stroke(); ctx.setLineDash([]); }
  // aim reticle when aiming by mouse/stick
  if (h.aimPt && h.pi < 4 && !h.reticle) { ctx.strokeStyle = hexA(PCOL[h.pi], 0.6); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(h.aimPt.x, h.aimPt.y, 7, 0, 6.28); ctx.moveTo(h.aimPt.x - 11, h.aimPt.y); ctx.lineTo(h.aimPt.x - 4, h.aimPt.y); ctx.moveTo(h.aimPt.x + 4, h.aimPt.y); ctx.lineTo(h.aimPt.x + 11, h.aimPt.y); ctx.stroke(); }
  else { ctx.fillStyle = hexA(PCOL[h.pi], 0.7); const ax = h.x + Math.cos(h.fa) * 30, ay = h.y + Math.sin(h.fa) * 30; poly([ax + Math.cos(h.fa) * 6, ay + Math.sin(h.fa) * 6, ax + Math.cos(h.fa + 2.4) * 5, ay + Math.sin(h.fa + 2.4) * 5, ax + Math.cos(h.fa - 2.4) * 5, ay + Math.sin(h.fa - 2.4) * 5], hexA(PCOL[h.pi], 0.7)); }
  if (G.heroes.length > 1) { ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = PCOL[h.pi]; ctx.fillText('P' + (h.pi + 1), h.x, h.y - (art ? 58 * h.body.scale + (h.body.hover || 0) : 26) - h.z); }
}
const PCOL = ['#ffd84a', '#5ac8ff', '#ff6aa0', '#8aff6a'];

function drawWorld() {
  const sh = G.trauma * G.trauma * 14, ox = R(-sh, sh), oy = R(-sh, sh);
  const th = G.map.theme;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.translate(-Math.round(G.cam.x + ox), -Math.round(G.cam.y + oy));
  ctx.drawImage(G.map.canvas, 0, 0);
  drawDynamicTiles();
  for (const d of G.decals) { ctx.globalAlpha = Math.min(1, d.life / d.max * 2) * 0.55; circ(d.x, d.y, d.r, d.col); } ctx.globalAlpha = 1;
  drawDecor(); drawTorches();
  for (const hz of G.hazards) if (hz.kind !== 'tele' || hz.r) drawHazard(hz);
  for (const s of G.swings) if (s.tele) drawSwing(s);
  for (const w of G.waves) { if (w.delay > 0) continue; ctx.strokeStyle = `rgba(255,140,60,${Math.min(1, w.life)})`; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(w.x, w.y, w.r, 0, 6.28); ctx.stroke(); ctx.strokeStyle = 'rgba(255,240,180,0.7)'; ctx.lineWidth = 2; ctx.stroke(); }
  for (const p of G.pickups) if (onScreen(p.x, p.y)) drawPickup(p);
  for (const s of G.spawners) if (s.hp > 0 && onScreen(s.x, s.y, 80)) drawSpawner(s);
  // y-sorted actors
  const actors = [];
  for (const p of G.props) if (p.hp > 0 && onScreen(p.x, p.y)) actors.push([p.y, 0, p]);
  for (const f of G.foes) if (ALIVE(f) && onScreen(f.x, f.y, 120)) actors.push([f.y, 1, f]);
  for (const a of G.allies) if (a.hp > 0 && onScreen(a.x, a.y)) actors.push([a.y, 2, a]);
  for (const h of G.heroes) actors.push([h.y, 3, h]);
  actors.sort((a, b) => a[0] - b[0]);
  for (const [, k, e] of actors) { if (k === 0) drawProp(e); else if (k === 1) drawFoe(e); else if (k === 2) drawAlly(e); else drawHero(e); }
  for (const c of G.claws) { const k = c.life / c.max; ctx.globalAlpha = k; for (let i = -1; i <= 1; i++) { const a = c.a + i * 0.35; line(c.x - Math.cos(a) * 16, c.y - Math.sin(a) * 16 + 10 * (1 - k), c.x + Math.cos(a) * 16, c.y + Math.sin(a) * 16 - 14 * (1 - k), '#7ff5d0', 3); } ctx.globalAlpha = 1; }
  for (const hd of G.hands) { const k = hd.life / hd.max; ctx.globalAlpha = Math.min(1, k * 2); ctx.fillStyle = '#3a2a5a'; const y = hd.y - 40 * k; ctx.beginPath(); ctx.ellipse(hd.x, y, 30, 22, 0, 0, 6.28); ctx.fill(); for (let i = 0; i < 4; i++) { ctx.fillRect(hd.x - 26 + i * 15, y - 36, 9, 22); } ctx.strokeStyle = '#7ff5d0'; ctx.lineWidth = 2; ctx.stroke(); ctx.globalAlpha = 1; }
  for (const s of G.swings) if (!s.tele) drawSwing(s);
  for (const s of G.shots) if (!s.dead && onScreen(s.x, s.y)) drawShot(s);
  for (const b of G.beams) drawBeam(b);
  for (const p of G.parts) { const k = p.life / p.max; ctx.globalAlpha = Math.min(1, k * 1.5); ctx.fillStyle = p.col; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); } ctx.globalAlpha = 1;
  for (const r of G.rings) { const k = 1 - r.life / r.max; ctx.globalAlpha = 1 - k; ctx.strokeStyle = r.col; ctx.lineWidth = r.w * (1 - k) + 1; ctx.beginPath(); ctx.arc(r.x, r.y, Math.max(1, r.r * (0.3 + 0.7 * k)), 0, 6.28); ctx.stroke(); } ctx.globalAlpha = 1;
  for (const hz of G.hazards) if (hz.kind === 'tele' && !hz.r) {} // invisible delay timers
  ctx.textAlign = 'center';
  for (const t of G.texts) { ctx.globalAlpha = Math.min(1, t.life / t.max * 2); ctx.font = t.big ? 'bold 18px sans-serif' : 'bold 12px sans-serif'; ctx.fillStyle = '#000'; ctx.fillText(t.s, t.x + 1, t.y + 1); ctx.fillStyle = t.col; ctx.fillText(t.s, t.x, t.y); } ctx.globalAlpha = 1;
  ctx.restore();
  // darkness (lightless floor): heroes, torches, fire and allies carry light
  if (G.map.dark) {
    dctx.globalCompositeOperation = 'source-over'; dctx.fillStyle = 'rgba(0,0,0,0.93)'; dctx.fillRect(0, 0, W, H);
    dctx.globalCompositeOperation = 'destination-out';
    const light = (x, y, r) => { const sx = x - G.cam.x, sy = y - G.cam.y; if (sx < -r || sy < -r || sx > W + r || sy > H + r) return; const g = dctx.createRadialGradient(sx, sy, r * 0.25, sx, sy, r); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)'); dctx.fillStyle = g; dctx.beginPath(); dctx.arc(sx, sy, r, 0, 6.28); dctx.fill(); };
    for (const h of G.heroes) if (!h.dead) light(h.x, h.y, 170 + (h.id === 'mirelle' ? 40 : 0));
    for (const t of G.map.torches) light(t.x, t.y, 120);
    for (const s of G.shots) if (!s.dead && s.team === 'hero') light(s.x, s.y, 50);
    for (const hz of G.hazards) if (hz.kind === 'fire' || hz.kind === 'bomb') light(hz.x, hz.y, 90);
    for (const sp of G.spawners) if (sp.hp > 0) light(sp.x, sp.y, 45);
    if (G.map.exit) light(G.map.exit.x, G.map.exit.y, 70);
    dctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(darkCv, 0, 0);
  }
  // vignette & fog tint
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H); if (th.fog) { ctx.fillStyle = th.fog; ctx.fillRect(0, 0, W, H); }
  // low-health red edge
  const solo = G.heroes.filter(h => !h.dead); if (solo.some(h => h.hp < h.maxHp * 0.25)) { ctx.fillStyle = `rgba(200,0,0,${0.12 + 0.08 * Math.sin(G.time * 8)})`; ctx.fillRect(0, 0, W, 8); ctx.fillRect(0, H - 8, W, 8); ctx.fillRect(0, 0, 8, H); ctx.fillRect(W - 8, 0, 8, H); }
  if (G.flash > 0) { ctx.globalAlpha = Math.min(0.6, G.flash); ctx.fillStyle = G.flashCol; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
}
BODY.paladin = BODY.sela; WEAP.paladin = WEAP_PAL;
