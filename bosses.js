'use strict';
const BOSSES = {
  ossuary: { role: 'Mummy King (crypt boss)', name: 'The Ossuary King', hp: 1500, r: 34, dmg: 26, spd: 46, col: '#e8dcc0' },
  rootmaw: { role: 'Beast (cave boss)', name: 'Rootmaw, the Deep Hunger', hp: 1700, r: 36, dmg: 30, spd: 0, col: '#7a5a4a' },
  forgemaster: { role: 'Demon lord (lava boss)', name: 'Forgemaster Vael', hp: 1950, r: 38, dmg: 28, spd: 40, col: '#8a3a2a' },
  sovereign: { role: 'Sentient sword (final boss)', name: 'Hollowfang, the Sovereign Blade', hp: 2300, r: 34, dmg: 26, spd: 70, col: '#2a1a40' },
};
if (typeof XBOSS_STATS !== 'undefined') Object.assign(BOSSES, XBOSS_STATS);
function spawnBoss(kind, x, y) {
  const B = BOSSES[kind], coop = 1 + 0.6 * (G.heroes.length - 1);
  const f = { boss: true, kind, type: 'boss', d: { beh: 'boss', style: kind, gold: 0 }, x, y, r: B.r, hp: B.hp * coop * (G.scale.hp || 1), name: B.name,
    phase: 1, act: null, st: 0, actT: 2.5, fa: Math.PI / 2, flash: 0, kx: 0, ky: 0, stag: 0, frz: 0, slowT: 0, slowM: 1, root: 0, burn: 0, burnT: 0, charm: 0,
    heavy: true, dmg: B.dmg * (G.scale.dmg || 1), spd: B.spd, walk: 0, seed: 0, invuln: false, dying: 0, room: roomAt(x, y) };
  f.maxhp = f.hp; G.foes.push(f); G.boss = f;
  G.banner = { s: B.name, sub: 'BOSS', t: 3 }; Snd.play('bossroar'); addTrauma(0.5);
  if (kind === 'sovereign') raisePylons(f, 1);
  if (kind === 'rootmaw') { f.state = 'surface'; f.st = 6; }
  return f;
}
function heroTargets() { return G.heroes.filter(h => !h.dead); }
function nearestHero(x, y) { let b = null, bd = 1e9; for (const h of heroTargets()) { const d = hyp(h.x - x, h.y - y); if (d < bd) { bd = d; b = h; } } return [b, bd]; }
function bossProj(f, a, spd, o = {}) { shoot(Object.assign({ team: 'foe', x: f.x + Math.cos(a) * f.r * 0.8, y: f.y + Math.sin(a) * f.r * 0.8, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, dmg: f.dmg * 0.55, r: 7, life: 3, kind: 'bone', col: '#e8dcc0', owner: f, reflectable: true }, o)); }
function tele(x, y, r, delay, dmg, col, after) { G.hazards.push({ kind: 'tele', x, y, r, delay, t: 0, col: col || '#ff4a3a', onFire: hz => { explode(hz.x, hz.y, r, dmg, { team: 'foe', col: col || '#ff8a4a', sound: 'slam' }); after && after(hz); } }); }
function updateBoss(f, dt) {
  f.flash -= dt;
  if (f.dying > 0) { f.dying -= dt; if (Math.random() < 0.4) { burst(f.x + R(-30, 30), f.y + R(-30, 30), '#ffd27a', 10, 200, 3, 0.6); Snd.play('boom'); addTrauma(0.2); } if (f.dying <= 0) bossFinish(f); return; }
  if (f.burnT > 0) { f.burnT -= dt; f.hp -= f.burn * dt * 0.5; }
  if (f.slowT > 0) { f.slowT -= dt; if (f.slowT <= 0) f.slowM = 1; }
  if (f.hp <= f.maxhp * 0.5 && f.phase === 1) { f.phase = 2; G.banner = { s: BOSSES[f.kind].ai === 'x' ? BOSSES[f.kind].name.split(',')[0] + ' is enraged!' : 'The ' + (f.kind === 'rootmaw' ? 'Maw' : f.kind === 'forgemaster' ? 'Forge' : 'King') + ' is enraged!', sub: 'PHASE II', t: 2 }; Snd.play('bossroar'); addTrauma(0.6); f.actT = 1; }
  if (f.hp <= 0) return killFoe(f);
  (BOSS_AI[f.kind] || BOSS_AI.xboss)(f, dt, f.phase === 2 ? 1.35 : 1);
  if (f.kx || f.ky) { f.kx = f.ky = 0; }
}
const BOSS_AI = {
  xboss(f, dt, rage) {   // Extended Realms bosses: stalk, then cycle slam / volley / rain / summon / charge (config in tuning.js XBOSS_STATS)
    const B = BOSSES[f.kind], [t, d] = nearestHero(f.x, f.y); if (!t) return;
    const ang = Math.atan2(t.y - f.y, t.x - f.x), fx = B.fx || {};
    const hitFx = h => { if (fx.freeze) h.frz = Math.max(h.frz || 0, fx.freeze); if (fx.slow) h.slowT = Math.max(h.slowT || 0, fx.slow); if (fx.pool) G.hazards.push({ kind: 'miasma', x: h.x, y: h.y, r: fx.pool.r, life: fx.pool.time, t: 0, team: 'foe', dps: fx.pool.dps * (G.scale.dmg || 1) }); };
    if (f.act === 'slam') { f.st -= dt; if (f.st <= 0) { f.act = null; Snd.play('slam'); addTrauma(0.4); ring(f.x, f.y, 150, B.slamCol, 0.5, 10); for (const h of heroTargets()) if (hyp(h.x - f.x, h.y - f.y) < 150 + h.r) { if (hurtHero(h, f.dmg * 1.1, { x: f.x, y: f.y, knock: 420, cause: 'area' })) hitFx(h); } } return; }
    if (f.act === 'charge') { f.st -= dt; if (f.st > 0.5) return;   /* wind-up */ const sp = capFoeStep(f, 520 * rage * dt, dt); moveEnt(f, Math.cos(f.fa) * sp, Math.sin(f.fa) * sp); for (const h of heroTargets()) if (!f.hitSet.has(h) && hyp(h.x - f.x, h.y - f.y) < f.r + h.r + 6) { f.hitSet.add(h); hurtHero(h, f.dmg, { x: f.x, y: f.y, knock: 520 }); } if (f.st <= 0) f.act = null; return; }
    if (f.act === 'volley') { f.st -= dt; f.vt = (f.vt || 0) - dt; if (f.vt <= 0 && f.waves > 0) { f.vt = 0.45 / rage; f.waves--; const n = rage > 1 ? 16 : 12, off = R(0, 1); for (let i = 0; i < n; i++) bossProj(f, (i + off) / n * 6.283, 220 * rage, { col: B.projCol, kind: 'orb', freeze: fx.freeze ? fx.freeze * 0.6 : 0, slow: fx.slow || 0 }); Snd.play('bonevolley'); } if (f.waves <= 0 && f.st <= 0) f.act = null; return; }
    f.fa = ang; { const st = capFoeStep(f, f.spd * rage * f.slowM * dt, dt); moveEnt(f, Math.cos(ang) * st, Math.sin(ang) * st); } f.walk += dt * 4;
    f.actT -= dt; if (f.actT > 0) return;
    f.actT = R(2.2, 3.2) / rage; f.ai = ((f.ai ?? -1) + 1) % B.acts.length; let a = B.acts[f.ai];
    if (d < 150 && B.acts.includes('slam') && Math.random() < 0.5) a = 'slam';
    if (a === 'slam') { f.act = 'slam'; f.st = 0.85 / rage; Snd.play('windup'); G.hazards.push({ kind: 'tele', x: f.x, y: f.y, r: 150, delay: f.st, t: 0, col: B.slamCol, follow: f, visualOnly: true, silent: true, onFire: () => { } }); }
    else if (a === 'charge') { f.act = 'charge'; f.st = 0.5 + DEV.ground.bossChargeTime; f.hitSet = new Set(); Snd.play('windup'); G.swings.push({ x: f.x, y: f.y, a: ang, arc: 0.4, r: GROUND_CAP() * DEV.ground.bossChargeTime + f.r, life: 0.6, max: 0.6, col: 'rgba(255,80,60,0.3)', w: 3, tele: true }); }
    else if (a === 'volley') { f.act = 'volley'; f.waves = rage > 1 ? 4 : 3; f.vt = DEV.shooter.bossWindup; f.st = f.vt + (f.waves - 1) * 0.45 / rage + DEV.shooter.bossRecover; ring(f.x, f.y, 80, B.projCol || '#fff', f.vt, 5); Snd.play('windup'); }   // stands still: wind-up, the waves, a short recovery
    else if (a === 'rain') { for (const h of heroTargets()) for (let k = 0; k < (rage > 1 ? 4 : 3); k++) tele(h.x + R(-40, 40) * k, h.y + R(-40, 40) * k, 64, 0.9 + k * 0.35, f.dmg, B.slamCol, hz => { for (const q of heroTargets()) if (hyp(q.x - hz.x, q.y - hz.y) < 64 + q.r) hitFx(q); }); Snd.play('bossroar'); }
    else if (a === 'summon' && G.foes.length < 40) { const n = rage > 1 ? 5 : 3; for (let k = 0; k < n; k++) { const aa = k / n * 6.283, x = f.x + Math.cos(aa) * (f.r + 40), y = f.y + Math.sin(aa) * (f.r + 40); if (!collide(x, y, 12)) G.hazards.push({ kind: 'tele', x, y, r: 22, delay: 0.7, t: 0, col: B.slamCol, silent: true, onFire: hz => { burst(hz.x, hz.y, B.slamCol, 14, 140, 3, 0.5); mkFoe(B.summon, hz.x, hz.y, { spawned: true, awake: true }); } }); } Snd.play('summon'); }
  },
  ossuary(f, dt, rage) {
    const [t, d] = nearestHero(f.x, f.y); if (!t) return;
    const ang = Math.atan2(t.y - f.y, t.x - f.x);
    if (f.act === 'sweep') { f.st -= dt; if (f.st <= 0) { f.act = null; Snd.play('heavyswing'); G.swings.push({ x: f.x, y: f.y, a: f.fa, arc: 3.6, r: 120, life: 0.22, max: 0.22, col: 'rgba(255,90,70,0.9)', w: 12 }); addTrauma(0.3);
        for (const h of heroTargets()) if (hyp(h.x - f.x, h.y - f.y) < 120 + h.r && Math.abs(angDiff(Math.atan2(h.y - f.y, h.x - f.x), f.fa)) < 1.8) hurtHero(h, f.dmg * 1.1, { x: f.x, y: f.y, knock: 480 }); }
      return; }
    if (f.act === 'volley') { f.st -= dt; f.vt = (f.vt || 0) - dt; if (f.vt <= 0 && f.waves > 0) { f.vt = 0.4 / rage; f.waves--; const n = rage > 1 ? 18 : 14, off = R(0, 1); for (let i = 0; i < n; i++) bossProj(f, (i + off) / n * 6.283, 230 * rage); Snd.play('bonevolley'); } if (f.waves <= 0 && f.st <= 0) f.act = null; return; }
    // stalk
    f.fa = ang; { const st = capFoeStep(f, f.spd * rage * f.slowM * dt, dt); moveEnt(f, Math.cos(ang) * st, Math.sin(ang) * st); } f.walk += dt * 4;
    f.actT -= dt; if (f.actT > 0) return;
    f.actT = R(2.2, 3.2) / rage;
    if (d < 140) { f.act = 'sweep'; f.st = 0.75 / rage; Snd.play('windup'); G.swings.push({ x: f.x, y: f.y, a: f.fa, arc: 3.6, r: 120, life: f.st, max: f.st, col: 'rgba(255,60,40,0.25)', w: 3, tele: true }); return; }
    const r = Math.random();
    if (r < 0.35) { f.act = 'volley'; f.waves = rage > 1 ? 4 : 3; f.vt = DEV.shooter.bossWindup; f.st = f.vt + (f.waves - 1) * 0.4 / rage + DEV.shooter.bossRecover; ring(f.x, f.y, 80, '#e8dcc0', f.vt, 5); Snd.play('windup'); }   // stands still: wind-up, the waves, a short recovery
    else if (r < 0.65) { for (const h of heroTargets()) for (let k = 0; k < (rage > 1 ? 4 : 3); k++) tele(h.x + R(-40, 40) * k, h.y + R(-40, 40) * k, 70, 0.9 + k * 0.35, f.dmg, '#e8dcc0'); Snd.play('bossroar'); }
    else { const n = G.foes.length < 40 ? (rage > 1 ? 6 : 4) : 0; G.map.graves.slice(0, n).forEach((g, i) => G.hazards.push({ kind: 'tele', x: g.x, y: g.y, r: 22, delay: 0.8, t: 0, col: '#7aff9a', visualOnly: false, silent: true, onFire: hz => { burst(hz.x, hz.y, '#d8d0b0', 16, 140, 3, 0.6); mkFoe(i % 3 === 2 ? 'bonearcher' : 'bonesoldier', hz.x, hz.y, { tier: rage > 1 ? 2 : 1, spawned: true }); } })); Snd.play('summon'); msg('The dead answer their king!', '#d8d0b0', 2); }
  },
  rootmaw(f, dt, rage) {
    f.st -= dt;
    if (f.state === 'surface') {
      f.invuln = false;
      const [t] = nearestHero(f.x, f.y); if (t) f.fa = Math.atan2(t.y - f.y, t.x - f.x);
      f.actT -= dt;
      if (f.actT <= 0 && t) {
        f.actT = 1.4 / rage;
        if (Math.random() < 0.65) { const n = rage > 1 ? 9 : 7; for (let i = 0; i < n; i++) bossProj(f, f.fa + (i - (n - 1) / 2) * 0.16, 260, { kind: 'acid', col: '#9adf3a', dmg: f.dmg * 0.45, pool: false, onEnd: s => G.hazards.push({ kind: 'fire', x: s.x, y: s.y, r: 26, life: 2.5, t: 0, team: 'foe', dps: 10, acid: true }) }); Snd.play('spit'); }
        else if (G.foes.length < 50) { for (let k = 0; k < (rage > 1 ? 6 : 4); k++) { const a = R(0, 6.28); const x = f.x + Math.cos(a) * 60, y = f.y + Math.sin(a) * 60; if (!collide(x, y, 8)) mkFoe('spiderling', x, y, { spawned: true }); } Snd.play('summon'); }
      }
      if (f.st <= 0) { f.state = 'burrow'; f.st = 2.4 / rage; f.invuln = true; Snd.play('burrow'); burst(f.x, f.y, '#6a5040', 30, 220, 4, 0.8); addTrauma(0.3); }
      return;
    }
    if (f.state === 'burrow') {
      f.invuln = true; const [t] = nearestHero(f.x, f.y);
      if (t) { const a = Math.atan2(t.y - f.y, t.x - f.x); { const st = capFoeStep(f, 190 * dt, dt); moveEnt(f, Math.cos(a) * st, Math.sin(a) * st); } }
      if (Math.random() < 0.5) burst(f.x + R(-20, 20), f.y + R(-20, 20), '#6a5040', 1, 60, 3, 0.4);
      if (rage > 1) { f.extraT = (f.extraT || 0) - dt; if (f.extraT <= 0) { f.extraT = 0.6; const h = pick(heroTargets()); if (h) tele(h.x + R(-60, 60), h.y + R(-60, 60), 50, 0.9, f.dmg * 0.6, '#9a7a5a'); } }
      if (f.st <= 0) { f.state = 'erupt'; f.st = 0.95; G.hazards.push({ kind: 'tele', x: f.x, y: f.y, r: 95, delay: 0.95, t: 0, col: '#ff7a3a', visualOnly: true }); Snd.play('rumble'); }
      return;
    }
    if (f.state === 'erupt') { if (f.st <= 0) { f.state = 'surface'; f.st = 5.5; f.actT = 0.8; f.invuln = false; explode(f.x, f.y, 95, f.dmg, { team: 'foe', col: '#a07a5a', sound: 'erupt' }); addTrauma(0.6); } }
  },
  forgemaster(f, dt, rage) {
    const [t, d] = nearestHero(f.x, f.y); if (!t) return;
    const ang = Math.atan2(t.y - f.y, t.x - f.x);
    if (f.act === 'jets') {
      f.st -= dt; f.jetA += dt * 0.9 * rage; const n = rage > 1 ? 4 : 2;
      for (let i = 0; i < n; i++) { const a = f.jetA + i * 6.283 / n, len = rayWall(f.x, f.y, a, 520);
        G.beams.push({ x1: f.x, y1: f.y, x2: f.x + Math.cos(a) * len, y2: f.y + Math.sin(a) * len, col: '#ff8a2a', life: dt * 1.5, w: 14, glow: true, fire: true });
        for (const h of heroTargets()) { const px = h.x - f.x, py = h.y - f.y, al = px * Math.cos(a) + py * Math.sin(a); if (al < 0 || al > len) continue; if (Math.abs(-px * Math.sin(a) + py * Math.cos(a)) < h.r + 8 && (h.jetT || 0) < G.time) { h.jetT = G.time + 0.35; hurtHero(h, f.dmg * 0.6, {}); } } }
      f.jetSnd = (f.jetSnd || 0) - dt; if (f.jetSnd <= 0) { f.jetSnd = 0.25; Snd.play('flame'); }
      if (f.st <= 0) f.act = null; return;
    }
    if (f.act === 'hammer') { f.st -= dt; if (f.st <= 0) { f.act = null; Snd.play('slam'); addTrauma(0.7); hitstop(0.08); for (let k = 0; k < (rage > 1 ? 3 : 2); k++) G.waves.push({ x: f.x, y: f.y, r: 40, spd: 260, delay: k * 0.45, dmg: f.dmg * 0.8, hit: new Set(), life: 2.4 }); } return; }
    f.fa = ang; { const st = capFoeStep(f, f.spd * f.slowM * dt, dt); moveEnt(f, Math.cos(ang) * st, Math.sin(ang) * st); } f.walk += dt * 3;
    f.actT -= dt; if (f.actT > 0) return; f.actT = R(2.4, 3.4) / rage;
    const r = Math.random();
    if (r < 0.3) { f.act = 'jets'; f.st = 3.6; f.jetA = ang; msg('Flame jets!', '#ff8a2a', 1.2); }
    else if (r < 0.55) { f.act = 'hammer'; f.st = 0.85; Snd.play('windup'); G.swings.push({ x: f.x, y: f.y, a: 0, arc: 6.28, r: 70, life: 0.85, max: 0.85, col: 'rgba(255,60,40,0.3)', w: 3, tele: true }); }
    else if (r < 0.8) { for (let k = 0; k < (rage > 1 ? 12 : 8); k++) { const h = pick(heroTargets()); tele(h.x + R(-140, 140), h.y + R(-140, 140), 48, R(0.8, 1.6), f.dmg * 0.8, '#ff6a2a', hz => G.hazards.push({ kind: 'fire', x: hz.x, y: hz.y, r: 30, life: 2, t: 0, team: 'foe', dps: 12 })); } Snd.play('meteorcall'); }
    else if (G.foes.length < 40) { for (let k = 0; k < 3; k++) { const a = R(0, 6.28); const x = f.x + Math.cos(a) * 80, y = f.y + Math.sin(a) * 80; if (!collide(x, y, 11)) mkFoe(pick(['zealot', 'firebrand', 'imp']), x, y, { spawned: true, tier: rage > 1 ? 2 : 1 }); } Snd.play('summon'); }
  },
  sovereign(f, dt, rage) {
    const shielded = G.spawners.some(s => s.pylon);
    f.invuln = shielded;
    const [t, d] = nearestHero(f.x, f.y); if (!t) return;
    const ang = Math.atan2(t.y - f.y, t.x - f.x);
    if (!shielded && !f.exposed) { f.exposed = 14; G.banner = { s: 'The Sovereign is exposed!', sub: 'STRIKE NOW', t: 2 }; Snd.play('shatter'); addTrauma(0.5); if (f.phase === 2 && !f.reaperCalled) { f.reaperCalled = true; const rp = mkFoe('reaper', f.x, f.y + 60, { awake: true }); msg('The Sovereign calls a Reaper to its side!', '#9ff', 3); } }
    if (f.exposed) { f.exposed -= dt; if (f.exposed <= 0 && f.hp > 0) { f.exposed = 0; f.cycle = (f.cycle || 1) + 1; raisePylons(f, f.cycle); } }
    if (f.cast) {   // volleys: hover still for a wind-up (glow), release, a short recovery, then drift again
      f.fa = ang; f.cast.t -= dt; if (f.cast.t > 0) return;
      if (!f.cast.done) { f.cast.done = true; f.cast.t = DEV.shooter.bossRecover;
        if (f.cast.k === 'ring') { const n = 20, off = R(0, 1); for (let i = 0; i < n; i++) bossProj(f, (i + off) / n * 6.283, 200, { kind: 'void', col: '#b07aff' }); }
        else for (const h of heroTargets()) for (let k = 0; k < 3; k++) bossProj(f, ang + (k - 1) * 0.25, 170, { kind: 'skull', col: '#c080ff', homing: 1.4, r: 9 });
        Snd.play('hex'); return; }
      f.cast = null; return; }
    // drift around the throne room
    f.orbitA = (f.orbitA || 0) + dt * 0.4; const cx = G.map.w * T / 2, cy = G.map.h * T / 2 - 40;
    const tx = cx + Math.cos(f.orbitA) * 160, ty = cy + Math.sin(f.orbitA * 1.3) * 70;
    f.x += (tx - f.x) * dt * 0.8; f.y += (ty - f.y) * dt * 0.8; f.fa = ang; f.walk += dt * 3;
    f.actT -= dt; if (f.actT > 0) return;
    f.actT = (shielded ? 2.6 : 1.4) / rage;
    const r = Math.random();
    if (r < 0.7) { f.cast = { k: r < 0.4 ? 'ring' : 'skulls', t: DEV.shooter.bossWindup, done: false }; ring(f.x, f.y, 70, '#b07aff', DEV.shooter.bossWindup, 5); Snd.play('windup'); }   // telegraphed, then released from a standstill
    else { for (const h of heroTargets()) tele(h.x, h.y, 80, 1.0, f.dmg, '#b07aff'); Snd.play('meteorcall'); }
  },
};
function raisePylons(f, cycle) {
  const pts = G.map.pylons.length ? G.map.pylons : [{ x: f.x - 200, y: f.y }, { x: f.x + 200, y: f.y }, { x: f.x, y: f.y + 200 }];
  for (const p of pts) { const s = mkSpawner(p.x, p.y, 3, ['bonesoldier', 'goblin', 'zealot', 'wraith', 'warden', 'imp'], 'pylon'); s.pylon = true; s.tier = 1; s.hp = (160 + 60 * cycle) * (1 + 0.5 * (G.heroes.length - 1)); s.maxhp = s.hp; s.r = 20; }
  G.banner = { s: 'Crystal pylons shield the Sovereign', sub: 'DESTROY THE PYLONS', t: 2.5 }; Snd.play('pylon');
}
function bossDefeated(f) {
  f.dead = false; f.hp = 0.0001; f.dying = 2.2; f.invuln = true; Snd.play('bossdeath'); hitstop(0.25); addTrauma(1);
  G.flash = 0.5; G.flashCol = '#fff';
  for (const o of G.foes) if (o !== f && !o.boss) { o.hp = 0; o.dead = true; burst(o.x, o.y, '#fff', 8, 100, 2, 0.5); }
  G.spawners = [];
}
function bossFinish(f) {
  f.dead = true; f.dying = 0; G.foes = G.foes.filter(o => o !== f);
  burst(f.x, f.y, '#ffd27a', 80, 400, 5, 1.4); ring(f.x, f.y, 200, '#fff', 0.8, 10); addTrauma(1);
  for (let k = 0; k < 24; k++) dropGold(f.x + R(-90, 90), f.y + R(-90, 90), RI(40, 90));
  G.pickups.push({ kind: 'feast', x: f.x - 40, y: f.y + 30 }, { kind: 'potion', x: f.x + 40, y: f.y + 30 });
  for (const h of G.heroes) { mastery(h, 'bosses', 1); mastery(h, 'boss_' + f.kind, 1); }   // per boss kind (f.type is always 'boss')
  // open the way out where the boss fell
  let tx = Math.floor(f.x / T), ty = Math.floor(f.y / T);
  if (blocksWalk(tileAt(tx, ty))) { tx = Math.floor(G.map.w / 2); ty = Math.floor(G.map.h / 2); }
  G.map.t[ty * G.map.w + tx] = TL.EXIT; G.map.exit = { x: (tx + 0.5) * T, y: (ty + 0.5) * T }; redrawTile(tx, ty); G.exitOpen = true;
  G.boss = null; G.banner = { s: f.name + ' falls!', sub: 'VICTORY', t: 3 }; Snd.play('victory');
}
// expanding shockwave rings (forgemaster hammer)
function updateWaves(dt) {
  for (const w of G.waves) {
    if (w.delay > 0) { w.delay -= dt; continue; }
    const wv = Math.min(w.spd * DEV.proj.mul, PROJ_CAP()); w.life -= dt * wv / w.spd; w.r += wv * dt;   // shockwave rings obey the enemy-missile cap
    for (const h of heroTargets()) { const d = hyp(h.x - w.x, h.y - w.y); if (Math.abs(d - w.r) < 14 && !w.hit.has(h) && h.z < 8) { w.hit.add(h); hurtHero(h, w.dmg, { x: w.x, y: w.y, knock: 260 }); } }
  }
  G.waves = G.waves.filter(w => w.life > 0 && w.r < 900);
}
