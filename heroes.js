'use strict';
// ---------------------------------------------------------------- hero creation
function heroMods(id) {
  const m = { dmg: 1, food: 0, gold: 0, spawnerDmg: 0, smashHeal: 0, reviveInvuln: 0, hp: 0, ability: 0, speed: 0, armor: 0, leap: 0, reflect: 0, bubble: 0 };
  const st = SAVE.mastery[id] || {};
  for (const ms of masteriesFor(id)) {
    const v = st[ms.stat] || 0; let tier = -1; ms.tiers.forEach((t, i) => { if (v >= t) tier = i; });
    if (tier < 0) continue;
    const r = ms.reward(tier);
    for (const k in r) { if (k === 'dmg') m.dmg += r[k]; else m[k] += r[k]; }
  }
  // passive mastery bonuses cap at +25% per stat (relic buffs are applied elsewhere and are not clipped)
  // FINAL ruling: the +25% cap applies only to stat multipliers (move speed, damage mitigation).
  // The 50k-kill +25% damage is its own multiplier and relic buffs are separate; neither is capped.
  for (const k of ['speed', 'armor']) m[k] = Math.min(MASTERY_CAP, m[k]);
  return m;
}
function mkHero(pi, id, dev) {
  const def = HERO[id], lo = SAVE.loadout[id], mods = heroMods(id);
  const body = heroBody(def);
  const h = { isHero: true, pi, id, def, dev, body, x: 0, y: 0, r: body.r, maxHp: SPEC.hero[id].hp + mods.hp * HP_SCALE, hp: SPEC.hero[id].hp + mods.hp * HP_SCALE, baseSpeed: heroSpeed(id), stam: SPEC.gela.stamina, calmT: 0, bubble: false, crown: false, armor: SPEC.hero[id].armor || 0, mods,
    potions: 2, keys: 0, fa: 0, ax: 1, ay: 0, kx: 0, ky: 0, vx: 0, vy: 0, inv: 0, ethereal: 0, invisT: 0, invis: false, hurtT: 0, slowT: 0,
    cd: {}, atkT: 0, combo: 0, comboT: 0, charge: 0, charging: null, blocking: false, blockFlash: 0, spin: 0, spinTick: 0, dash: null, lock: 0,
    rushWin: 0, souls: 30, runes: [], runeT: 0, spell: [0, 0], spellCd: {}, channel: null, shieldOut: false, buff: {}, swing: null, walk: 0,
    weapon: lo.weapon, talisman: lo.talisman, relic: lo.relic ? { id: lo.relic, rank: SAVE.owned[id].relics[lo.relic] || 1 } : null,
    dead: false, deadAt: 0, reviveHold: 0, lastHitT: -9, scale: 1, z: 0, explosiveArrow: false };
  if (id === 'mirelle') h.schools = WEAPONS.mirelle.find(w => w.id === h.weapon).schools;
  return h;
}
const cdReady = (h, k) => !(h.cd[k] > 0);
const setCd = (h, k, v) => { h.cd[k] = v * (h.buff.haste > 0 ? 0.75 : 1); };
const hasteMul = h => (h.buff.haste > 0 ? h.hasteV || 1.35 : 1);

// ---------------------------------------------------------------- per-tick hero update
function updateHero(h, inp, dt) {
  for (const k in h.cd) h.cd[k] -= dt;
  for (const k in h.spellCd) h.spellCd[k] -= dt;
  for (const k in h.buff) h.buff[k] -= dt;
  h.inv -= dt; h.ethereal -= dt; h.hurtT -= dt; h.blockFlash -= dt; h.invisT -= dt; h.slowT -= dt; h.atkT -= dt; h.comboT -= dt; h.rushWin -= dt; h.lock -= dt; h.runeT -= dt;
  h.invis = h.invisT > 0;
  h.scale = lerp(h.scale, h.buff.titan > 0 ? 1.6 : 1, dt * 6);
  if (h.dead) {
    if (inp.pressed.confirm || inp.pressed.primary) { if (G.heroes.length > 1 || G.reviveOffer) reviveHero(h); }
    return;
  }
  if (h.frz > 0) { h.frz -= dt; h.vx = h.vy = 0; h.channel = null; h.blocking = false; return; }   // frozen solid by a lich's spell
  // low health: below 25% flash red and get a 0.5s +15% speed burst (once per dip)
  if (h.lowT > 0) h.lowT -= dt; if (h.stunImmune > 0) h.stunImmune -= dt; if (h.crownSlowT > 0) h.crownSlowT -= dt;
  if (h.hp < h.maxHp * LOW_HP.below) { if (!h.lowFlag) { h.lowFlag = true; h.lowT = LOW_HP.time; h.lowFlash = 0.5; text(h.x, h.y - 34, 'LOW HEALTH', '#ff4a3a'); } } else h.lowFlag = false;
  if (h.lowFlash > 0) h.lowFlash -= dt;
  // damage-immunity bubble (damage-taken mastery): 20s without being hit grows a bubble that eats the next hit
  if (h.mods.bubble && G.mode !== 'hub') { h.calmT = (h.calmT || 0) + dt; if (!h.bubble && h.calmT >= SPEC.bubble.after) { h.bubble = true; ring(h.x, h.y, 34, '#bfefff', 0.4, 4); } }
  // Valkyrie shield stamina regen
  if (h.id === 'sela' || h.id === 'paladin') { if (h.blockBroken > 0) h.blockBroken -= dt; if (h.stamT > 0) h.stamT -= dt; else h.stam = Math.min(SPEC.gela.stamina, (h.stam ?? 100) + 40 * dt); }
  if (SAVE.settings.hunger && G.mode !== 'hub') { h.hp -= dt * 0.8 * HP_SCALE; if (h.hp <= 0) { killHero(h); return; } }
  // aim
  if (inp.aim === 'mouse') { const wx = Input.mouse.x + G.cam.x, wy = Input.mouse.y + G.cam.y; h.aimPt = { x: wx, y: wy }; const a = Math.atan2(wy - h.y, wx - h.x); h.ax = Math.cos(a); h.ay = Math.sin(a); }
  else if (inp.aim === 'stick') { h.ax = inp.ax; h.ay = inp.ay; h.aimPt = null; }
  else if (inp.mx || inp.my) { h.ax = inp.mx; h.ay = inp.my; h.aimPt = null; }
  let fa = Math.atan2(h.ay, h.ax);
  if (inp.aim !== 'mouse' && inp.aim !== 'stick') fa = autoAim(h, fa);
  if (!h.dash && !h.channelLock) h.fa = fa;
  h.aimDist = h.aimPt ? hyp(h.aimPt.x - h.x, h.aimPt.y - h.y) : null;
  // knockback
  if (h.kx || h.ky) { moveEnt(h, clamp(h.kx * dt, -12, 12), clamp(h.ky * dt, -12, 12), false, g => tryGate(h, g)); h.kx *= Math.pow(0.002, dt); h.ky *= Math.pow(0.002, dt); if (Math.abs(h.kx) + Math.abs(h.ky) < 8) h.kx = h.ky = 0; }
  // dashes (rush, roll, ghostwalk, serpents, leaps, lunges)
  if (h.dash) { updateDash(h, dt); }
  else {
    let spd = h.baseSpeed * (h.lowT > 0 ? 1 + LOW_HP.speed : 1) * (h.crown || h.crownSlowT > 0 ? 1 - SPEC.crown.slow : 1) * (1 + h.mods.speed) * hasteMul(h) * (h.slowT > 0 ? 0.6 : 1) * (h.buff.ember > 0 ? 1.5 : 1) * (h.buff.titan > 0 ? 1.1 : 1);
    spd *= h.moveMul || 1; h.moveMul = 1;
    if (h.lock > 0) spd *= 0.15;
    if (G.mode !== 'hub' && G.mode !== 'arenaLobby' && G.heroes.length > 1) {} // shared screen clamp below
    const mx = inp.mx * spd * dt, my = inp.my * spd * dt;
    h.vx = inp.mx * spd; h.vy = inp.my * spd;
    if (mx || my) { moveEnt(h, mx, my, false, g => tryGate(h, g)); h.walk += dt * 10; }
  }
  if (G.heroes.length > 1 && G.mode !== 'hub') { h.x = clamp(h.x, G.cam.x + 16, G.cam.x + W - 16); h.y = clamp(h.y, G.cam.y + 70, G.cam.y + H - 16); }
  if (G.mode === 'hub') return hubInteract(h, inp);
  if (inp.pressed.dash && !h.dash && heroDash(h, inp)) { /* dashed this tick */ }
  else KITS[h.id](h, inp, dt);
  if (inp.pressed.potion) usePotion(h);
  if (inp.pressed.relic) useRelic(h);
  // legendary chest / exit
  for (const p of G.props) if (p.kind === 'legend' && p.hp > 0 && hyp(p.x - h.x, p.y - h.y) < p.r + h.r + 6) openLegend(h, p);
}
// David's deviation 1: every hero dashes on the same button (KB1 F / middle mouse, KB2 Numpad6, pad LT / L3).
// Each hero's dash is their existing mobility move (same cooldown key, so both inputs share it); Zoey gets a short Blink.
function heroDash(h, inp) {
  const D = DEV.dash[h.id]; if (!D || h.spin > 0 || h.charging || h.thrust || h.channel || h.frz > 0) return false;
  if (!cdReady(h, D.cdKey)) { if ((h.dashMsg || 0) < G.time) { h.dashMsg = G.time + 0.6; Snd.play('error'); } return false; }
  const moving = inp.mx || inp.my; if (moving) h.fa = Math.atan2(inp.my, inp.mx);   // dash where you are steering, else where you face
  const fake = (pressed, down) => Object.assign({}, inp, { pressed: Object.assign({}, pressed), down: Object.assign({}, down) });
  if (h.id === 'mirelle') {
    setCd(h, D.cdKey, D.cd); Snd.play('blink'); burst(h.x, h.y, '#bfe0ff', 12, 140, 3, 0.4);
    startDash(h, h.fa, D.dist, D.dur, { inv: D.iframes, trail: 'rgba(190,224,255,0.6)', trailSize: 7, stopOnWall: true });
    return true;
  }
  if (h.id === 'sela' || h.id === 'paladin') KITS[h.id](h, fake({ secondary: true }, { defend: true, secondary: true }), 0);
  else KITS[h.id](h, fake({ defend: true }, { defend: true }), 0);
  if (h.id === 'sela' || h.id === 'paladin') h.blocking = false;
  return !cdReady(h, D.cdKey);
}
function autoAim(h, fa) { // soft aim assist for keyboard players
  let best = null, bs = 0.55;
  for (const f of G.foes) {
    if (!ALIVE(f) || f.charm > 0 || f.type === 'reaper') continue;
    const d = hyp(f.x - h.x, f.y - h.y); if (d > 420) continue;
    const a = Math.atan2(f.y - h.y, f.x - h.x), df = Math.abs(angDiff(a, fa));
    if (df < bs && los(h.x, h.y, f.x, f.y)) { bs = df; best = a; }
  }
  for (const s of G.spawners) { const d = hyp(s.x - h.x, s.y - h.y); if (d > 380) continue; const a = Math.atan2(s.y - h.y, s.x - h.x), df = Math.abs(angDiff(a, fa)); if (df < bs) { bs = df; best = a; } }
  return best === null ? fa : best;
}
function tryGate(h, g) {
  if (!g || !g.gate) return;
  if (h.keys > 0) { h.keys--; openGate(g.tx, g.ty, h); text(h.x, h.y - 26, 'UNLOCKED', '#fd5'); return; }
  if (!G.heroes.some(o => o.keys > 0) && !reachableKey(h)) { openGate(g.tx, g.ty, h); msg('The rusted lock gives way.', '#fd5', 2); return; }
  if ((h.gateMsg || 0) < G.time) { h.gateMsg = G.time + 2.5; msg('Locked. Find a key.', '#fd5', 1.6); Snd.play('error'); }
}
function startDash(h, ang, dist, dur, o = {}) {
  h.dash = Object.assign({ ang, dist, dur, t: 0, vx: Math.cos(ang) * dist / dur, vy: Math.sin(ang) * dist / dur, hit: new Set() }, o);
  if (o.inv) h.inv = Math.max(h.inv, typeof o.inv === 'number' ? o.inv : dur + 0.05);   // exact i-frame windows from the spec
  if (o.ethereal) h.ethereal = Math.max(h.ethereal, dur + 0.05);
}
function updateDash(h, dt) {
  const d = h.dash; d.t += dt;
  const blocked = moveEnt(h, d.vx * dt, d.vy * dt, !!d.jump, g => tryGate(h, g));
  h.z = d.jump ? Math.sin(Math.min(1, d.t / d.dur) * Math.PI) * 26 : 0;
  if (d.trail && Math.random() < 0.8) G.parts.push({ x: h.x + R(-6, 6), y: h.y + R(-6, 6), vx: 0, vy: 0, life: 0.35, max: 0.35, col: d.trail, size: d.trailSize || 6, grav: 0 });
  if (d.hitR) for (const f of G.foes) {
    if (!ALIVE(f) || d.hit.has(f) || f.charm > 0) continue;
    if (hyp(f.x - h.x, f.y - h.y) > f.r + h.r + d.hitR) continue;
    d.hit.add(f); d.onHitFoe && d.onHitFoe(f);
  }
  if (d.hitR) for (const s of G.spawners) if (!d.hit.has(s) && hyp(s.x - h.x, s.y - h.y) < s.r + h.r + d.hitR) { d.hit.add(s); if (d.dmg) hitSpawner(s, d.dmg, h); }
  if (d.armor && !d.jump) for (const p of G.props) if (p.hp > 0 && p.kind === 'chest' && hyp(p.x - h.x, p.y - h.y) < p.r + h.r + 2) { h.dash = null; h.z = 0; h.lock = 10 / 60; h.atkT = 10 / 60; Snd.play('clank'); text(h.x, h.y - 30, 'CLANG', '#ccc'); return; }
  if (d.t >= d.dur || (blocked && !d.jump && d.stopOnWall !== false)) { h.dash = null; h.z = 0; d.onEnd && d.onEnd(blocked); }
}
function swingFx(h, ang, arc, r, col, w = 5, dur = 0.13) { G.swings.push({ x: h.x, y: h.y, a: ang, arc, r, life: dur, max: dur, col, w, follow: h }); }
function melee(h, ang, arc, r, dmg, o = {}) {
  const n = areaHit(h.x, h.y, r, heroDmg(h, dmg), Object.assign({ cone: ang, arc, src: h, team: 'hero' }, o));
  if (n && o.hitstop) hitstop(o.hitstop);
  return n;
}
function aimPoint(h, maxD, minD = 40) {
  if (h.aimPt) { const d = clamp(hyp(h.aimPt.x - h.x, h.aimPt.y - h.y), minD, maxD); return { x: h.x + Math.cos(h.fa) * d, y: h.y + Math.sin(h.fa) * d }; }
  // keyboard / stick: nearest foe in the aimed direction, else a fixed distance
  let best = null, bd = maxD;
  for (const f of G.foes) if (ALIVE(f) && f.charm <= 0 && f.type !== 'reaper') { const d = hyp(f.x - h.x, f.y - h.y); if (d < bd && Math.abs(angDiff(Math.atan2(f.y - h.y, f.x - h.x), h.fa)) < 0.5) { bd = d; best = f; } }
  if (best) return { x: best.x, y: best.y };
  const d = Math.min(maxD, Math.max(minD, rayWall(h.x, h.y, h.fa, maxD * 0.8) - 10));
  return { x: h.x + Math.cos(h.fa) * d, y: h.y + Math.sin(h.fa) * d };
}
const abilityCd = (h, base) => base * (1 - h.mods.ability);

// ================================================================ KITS
const KITS = {
  // ------------------------------------------------ Sir Theo (id 'brannoc'): melee spinner
  brannoc(h, inp, dt) {
    const S = SPEC.theo;
    // Whirlwind (Destructo-Spin): 3.5s of full i-frames, ~5 ticks/s, large circle that follows Theo, 12s cooldown
    if (h.spin > 0) {
      h.spin -= dt; h.spinTick -= dt; h.moveMul = 0.85; h.fa += dt * 18;
      if (h.spinTick <= 0) {
        h.spinTick = 1 / DEV.dmg.theo.spinTicksPerSec; Snd.play('spin');
        const n = areaHit(h.x, h.y, S.spinR, heroDmg(h, DEV.dmg.theo.spinTick * (1 + h.mods.ability)), { src: h, knock: 200, stagger: 0.2, sigKill: true, tag: 'spin', tier: 2 });
        if (n) { hitstop(0.02); mastery(h, 'signature', n); }
        G.swings.push({ x: h.x, y: h.y, a: h.fa, arc: 6.28, r: S.spinR, life: 0.16, max: 0.16, col: 'rgba(255,220,160,0.55)', w: 6, follow: h });
      }
      if (h.spin <= 0) setCd(h, 'ability', abilityCd(h, S.spinCd));
      return;
    }
    // 4th-swing finisher: 1.5m circle, active for 24 frames
    if (h.finT > 0) { h.finT -= dt; areaHit(h.x, h.y, S.finisherR, heroDmg(h, DMG.medium), { src: h, knock: 260, stagger: 0.45, set: h.finSet, tier: 2 }); }
    // Furious Charge (defend): 5s cooldown, medium damage, narrow line, armor vs T1/T2, kills skeletons outright
    if (inp.pressed.defend && cdReady(h, 'defend')) {
      setCd(h, 'defend', S.chargeCd); Snd.play('rush'); h.rushWin = 0.55;
      const thru = f => { mastery(h, 'chargeThrough', 1); if (SKELETAL(f)) killFoe(f, h, { tag: 'charge' }); else hitFoe(f, heroDmg(h, DMG.medium), { x: h.x, y: h.y, knock: 320, stagger: 0.4, src: h, tag: 'charge', tier: 2 }); };
      if (h.mods.leap) startDash(h, h.fa, S.chargeDist + 20, 0.32, { jump: true, armor: true, inv: 0.12, onHitFoe: thru, hitR: S.chargeWidth, onEnd: () => { Snd.play('slam'); addTrauma(0.3); ring(h.x, h.y, 70, '#ffcf7a', 0.3, 6); areaHit(h.x, h.y, 70, heroDmg(h, DMG.medium), { src: h, knock: 300, stagger: 0.6, tag: 'charge', tier: 2 }); } });   // Bull Rush mastery: leap smash
      else startDash(h, h.fa, S.chargeDist, 0.22, { trail: 'rgba(255,200,140,0.5)', hitR: S.chargeWidth, armor: true, inv: 0.12, onHitFoe: thru });
      return;
    }
    // 4-swing axe combo: swings 1-3 light in a narrow front arc, swing 4 a medium 360 finisher
    if ((inp.down.primary || inp.pressed.primary) && h.atkT <= 0) {
      h.combo = h.comboT > 0 ? (h.combo + 1) % S.combo : 0; h.comboT = 0.75;
      const fin = h.combo === S.combo - 1;
      h.atkT = (fin ? 0.42 : 0.27) / hasteMul(h); h.lock = 0.1;
      moveEnt(h, Math.cos(h.fa) * 8, Math.sin(h.fa) * 8);
      Snd.play(fin ? 'heavyswing' : 'swing');
      if (fin) { swingFx(h, h.fa, 6.28, S.finisherR + 10, 'rgba(255,220,150,0.95)', 8, 0.4); h.finT = S.finisherFrames / 60; h.finSet = new Set(); addTrauma(0.12); hitstop(0.05); return; }
      swingFx(h, h.fa, S.comboArc, S.comboR, 'rgba(255,240,210,0.85)', 5); G.swings[G.swings.length - 1].dir = h.combo === 1 ? -1 : 1;
      melee(h, h.fa, S.comboArc, S.comboR, DMG.light, { knock: 110, stagger: 0.15, hitstop: 0.035, tier: 1 });
      return;
    }
    // Leap Cleave (secondary): 3s cooldown, heavy, medium circle, hard hit-stun. Alternate weapon: straight shockwave with a fire trail.
    if (inp.pressed.secondary && cdReady(h, 'secondary')) {
      setCd(h, 'secondary', S.leapCd);
      const p = aimPoint(h, 190, 60), d = hyp(p.x - h.x, p.y - h.y);
      Snd.play('leap');
      startDash(h, Math.atan2(p.y - h.y, p.x - h.x), d, 0.38, { jump: true, inv: 0.3, onEnd: () => { Snd.play('slam'); addTrauma(0.45); hitstop(0.09); ring(h.x, h.y, S.leapR, '#ffcf7a', 0.4, 8); burst(h.x, h.y, '#a08060', 30, 260, 4, 0.7); areaHit(h.x, h.y, S.leapR, heroDmg(h, DEV.dmg.theo.leap), { src: h, knock: 380, stagger: S.leapStun, walls: true, heavy: true, tier: 3 }); } });
      return;
    }
    // weapon signature (ability button); every weapon swaps it
    if (inp.pressed.ability && cdReady(h, 'ability')) {
      const W = SPEC.wpn, cd = SPEC.weapons.brannoc[h.weapon] ?? SPEC.weapons.brannoc.base;
      if (h.weapon === 'axe') { // Thrown Axe: T2 straight projectile, no AoE
        setCd(h, 'ability', abilityCd(h, cd)); Snd.play('throw'); h.throwT = 0.3;
        shoot({ team: 'hero', x: h.x, y: h.y, vx: Math.cos(h.fa) * W.axeSpeed, vy: Math.sin(h.fa) * W.axeSpeed, dmg: heroDmg(h, DMG.medium * (1 + h.mods.ability)), tier: 2, r: 10, life: W.axeLife, kind: 'hatchet', owner: h, sig: true, knock: 180 });
      } else if (h.weapon === 'turbo') { // Turbo-Slam: T3 + hard stun, 90-degree cone to 3m, resets elite wind-ups
        setCd(h, 'ability', abilityCd(h, cd)); Snd.play('slam'); h.slamT = 0.4; addTrauma(0.45); hitstop(0.08);
        swingFx(h, h.fa, W.turboArc, W.turboR, 'rgba(255,210,140,0.95)', 10, 0.25); burst(h.x + Math.cos(h.fa) * 40, h.y + Math.sin(h.fa) * 40, '#a08060', 24, 260, 4, 0.6);
        for (const f of G.foes) if (ALIVE(f) && hyp(f.x - h.x, f.y - h.y) < W.turboR + f.r && Math.abs(angDiff(Math.atan2(f.y - h.y, f.x - h.x), h.fa)) < W.turboArc / 2) { if (f.state === 'windup') f.state = 'move'; if (f.conjuring > 0) { f.conjuring = 0; f.conjT = SPEC.elites.meteorCdOnCancel; } f.atkT = Math.max(f.atkT, 0.8); }
        h.lastTurbo = areaHit(h.x, h.y, W.turboR, heroDmg(h, DMG.heavy * (1 + h.mods.ability)), { src: h, cone: h.fa, arc: W.turboArc, stagger: W.turboStun, knock: 300, heavy: true, sigKill: true, tier: 3 });
      } else if (h.weapon === 'demonic') { // Demonic Cleave: T2 impact along a 1m x 6m line, 4s fire surface (T1 ticks + burn)
        setCd(h, 'ability', abilityCd(h, cd)); Snd.play('quake'); addTrauma(0.35); h.slamT = 0.35; const a = h.fa, step = W.demonicW;
        for (let k = 1; k * step <= W.demonicLen; k++) { const x = h.x + Math.cos(a) * k * step, y = h.y + Math.sin(a) * k * step; if (shotSolid(x, y)) break;
          G.hazards.push({ kind: 'tele', x, y, r: step / 2, delay: 0.03 * k, t: 0, col: '#ff5a2a', silent: true, onFire: hz => { burst(hz.x, hz.y, '#ff6a2a', 8, 160, 4, 0.5); areaHit(hz.x, hz.y, step / 2 + 4, heroDmg(h, DMG.medium), { src: h, stagger: 0.5, knock: 160, tier: 2, burn: W.demonicBurn });
            G.hazards.push({ kind: 'fire', x: hz.x, y: hz.y, r: step / 2, life: W.demonicFire, t: 0, dps: heroDmg(h, DMG.light) * 2, team: 'hero', owner: h, demonic: true }); } }); }
      } else { h.spin = S.spinTime; h.spinTick = 0; Snd.play('spinstart'); }   // Destructo-Spin (cooldown starts when the spin ends)
    }
  },
  // ------------------------------------------------ Dawnbringer Gela (id 'sela'): shield fighter
  sela(h, inp, dt) {
    const S = SPEC.gela;
    const was = h.blocking;
    h.blocking = inp.down.defend && !h.shieldOut && !h.dash && !h.thrust && !(h.blockBroken > 0);
    if (h.blocking && !was) h.blockStart = G.time;   // perfect-block window starts when the shield goes up
    if (h.blocking) h.moveMul = 0.45;
    // Spear Thrust: 12-frame wind-up, 4-frame lunge hitbox, heavy piercing line; a shield tap cancels the recovery
    if (h.thrust) {
      const t = h.thrust; t.t += dt; h.moveMul = 0.15;
      const wu = S.thrustWindupFrames / 60, lu = S.thrustLungeFrames / 60;
      if (t.t >= wu && t.t < wu + lu + dt) { moveEnt(h, Math.cos(h.fa) * 160 * dt * 3, Math.sin(h.fa) * 160 * dt * 3);
        const n = areaHit(h.x, h.y, 96, heroDmg(h, DEV.dmg.gela.thrust), { src: h, cone: h.fa, arc: 0.45, set: t.set, knock: 260, hitstop: 0.05, heavy: true, tier: 3 });
        if (!t.fx) { t.fx = true; Snd.play('lunge'); swingFx(h, h.fa, 0.45, 100, 'rgba(240,230,160,0.95)', 6, 0.12); } }
      if (t.t >= wu + lu && inp.pressed.defend) { h.thrust = null; text(h.x, h.y - 28, 'CANCEL', '#cfeaff'); return; }
      if (t.t >= wu + lu + S.thrustRecovery) h.thrust = null;
      return;
    }
    // Shield Charge: burst forward behind the raised shield
    if (h.blocking && inp.pressed.secondary && cdReady(h, 'scharge')) {
      setCd(h, 'scharge', S.chargeCd); Snd.play('rush');
      startDash(h, h.fa, 170, 0.22, { trail: 'rgba(200,230,255,0.5)', hitR: 8, armor: true, inv: 0.1, onHitFoe: f => { if (SKELETAL(f)) killFoe(f, h, { tag: 'block' }); else hitFoe(f, heroDmg(h, DMG.medium), { x: h.x, y: h.y, knock: 380, stagger: 0.6, src: h, tier: 2 }); } });
      return;
    }
    if (h.blocking && inp.pressed.primary && cdReady(h, 'bash')) { // shield bash
      setCd(h, 'bash', 0.55); Snd.play('bash'); swingFx(h, h.fa, 1.8, 54, 'rgba(240,240,200,0.9)', 9, 0.12);
      moveEnt(h, Math.cos(h.fa) * 10, Math.sin(h.fa) * 10);
      melee(h, h.fa, 1.9, 56, DMG.light, { knock: 360, stagger: 1.0, hitstop: 0.06, heavy: true, unblockable: true, tier: 2 });
      return;
    }
    // 7-strike slash chain: light front cone; strikes 4 and 7 stun (elites too)
    if (!h.blocking && (inp.down.primary || inp.pressed.primary) && h.atkT <= 0) {
      h.combo = h.comboT > 0 ? (h.combo + 1) % S.combo : 0; h.comboT = 0.6;
      const n = h.combo + 1, stun = S.stunHits.includes(n);
      h.atkT = (stun ? 0.34 : 0.24) / hasteMul(h); h.lock = 0.08; Snd.play(stun ? 'heavyswing' : 'swing');
      swingFx(h, h.fa, S.comboArc, S.comboR + 8, stun ? 'rgba(230,245,255,0.95)' : 'rgba(210,235,255,0.85)', stun ? 6 : 4); G.swings[G.swings.length - 1].dir = h.combo % 2 ? -1 : 1;
      if (h.weapon === 'vanguard') for (const s of G.shots) if (s.team === 'foe' && !s.dead && hyp(s.x - h.x, s.y - h.y) < S.comboR + 20 && Math.abs(angDiff(Math.atan2(s.y - h.y, s.x - h.x), h.fa)) < S.comboArc / 2 + 0.3 && (h.parryLog = (h.parryLog || []).filter(t => G.time - t < 0.5)).length < (RULE('spearCap') ? 6 : Infinity)) { h.parryLog.push(G.time); const a = R(0, 6.28), v = hyp(s.vx, s.vy); s.vx = Math.cos(a) * v; s.vy = Math.sin(a) * v; s.team = 'hero'; s.owner = h; s.dmg *= 0.5; s.hit = new Set(); s.life = Math.min(s.life, 0.6); text(s.x, s.y - 10, 'PARRY', '#cfeaff'); }   // intercept spear: knock missiles away, no stamina
      melee(h, h.fa, S.comboArc, S.comboR, DMG.light, { knock: stun ? 220 : 110, stagger: stun ? S.stun : 0.15, hitstop: stun ? 0.05 : 0.03, tier: 1 });
      if (stun) for (const f of G.foes) if (ALIVE(f) && f.elite && !f.boss && hyp(f.x - h.x, f.y - h.y) < S.comboR + f.r && Math.abs(angDiff(Math.atan2(f.y - h.y, f.x - h.x), h.fa)) < S.comboArc / 2 + 0.2) f.stag = Math.max(f.stag, S.stun);
      return;
    }
    if (h.weapon === 'vanguard' && !h.blocking && (inp.pressed.secondary || inp.pressed.ability)) { deflectThrust(h); return; }   // Deflecting Thrust replaces the lunge (and is her signature)
    if (inp.pressed.secondary && !h.blocking && cdReady(h, 'secondary')) { h.thrust = { t: 0, set: new Set() }; Snd.play('charge'); return; }
    if (inp.pressed.ability && cdReady(h, 'ability') && !h.shieldOut) {
      const W = SPEC.wpn, cd = SPEC.weapons.sela[h.weapon] ?? SPEC.weapons.sela.base;
      if (h.weapon === 'splitter') { // Shield Splitter: 3 piercing T2 shields in a 45-degree fan
        setCd(h, 'ability', abilityCd(h, cd)); Snd.play('throw'); h.throwT = 0.3;
        for (const off of [-W.splitterFan / 2, 0, W.splitterFan / 2]) { const a = h.fa + off;
          shoot({ team: 'hero', x: h.x, y: h.y, vx: Math.cos(a) * W.splitterSpeed, vy: Math.sin(a) * W.splitterSpeed, dmg: heroDmg(h, DMG.medium * (1 + h.mods.ability)), tier: 2, r: 8, life: 0.7, kind: 'shield', owner: h, pierce: 99, sig: true, knock: 160, fx: { stagger: 0.3 } }); }
      } else if (h.weapon === 'ricochet') { // Shield Ricochet: T2 + interrupt, up to 4 targets, 4m hops, then returns
        h.shieldOut = true; Snd.play('throw'); h.throwT = 0.3; setCd(h, 'ability', abilityCd(h, cd));
        shoot({ team: 'hero', x: h.x, y: h.y, vx: Math.cos(h.fa) * 620, vy: Math.sin(h.fa) * 620, dmg: heroDmg(h, DMG.medium * (1 + h.mods.ability)), tier: 2, r: 12, life: 8, kind: 'shield', owner: h, sig: true, fx: { stagger: W.ricochetInterrupt },
          boomer: { phase: 'out', seek: true, hop: W.ricochetHop, spd: 620, dist: 0, range: 520, hits: 0, maxHits: W.ricochetTargets, onReturn: () => { h.shieldOut = false; Snd.play('catch'); } } });
      } else { // Extreme Prejudice (default): 0 damage, 180-degree 2.5m knockback; a foe slammed into a wall takes T4 + 2s stun
        setCd(h, 'ability', abilityCd(h, cd)); Snd.play('heavyswing'); addTrauma(0.35); hitstop(0.08); h.throwT = 0.3;
        swingFx(h, h.fa, W.execArc, W.execR, 'rgba(255,240,190,0.95)', 10, 0.22);
        let n = 0;
        for (const f of G.foes) { if (!ALIVE(f) || f.type === 'reaper') continue; const d = hyp(f.x - h.x, f.y - h.y); if (d > W.execR + f.r || Math.abs(angDiff(Math.atan2(f.y - h.y, f.x - h.x), h.fa)) > W.execArc / 2) continue;
          const a = Math.atan2(f.y - h.y, f.x - h.x), k = f.boss ? 0.25 : f.heavy || f.elite ? 0.6 : 1;
          hitFoe(f, heroDmg(h, DEV.dmg.gela.execHit * (1 + h.mods.ability)), { x: h.x, y: h.y, src: h, tier: 3, sigKill: true });   // David's deviation 6: the special now hits hardest
          if (!ALIVE(f)) { n++; continue; }
          f.kx = Math.cos(a) * W.execKnock * k; f.ky = Math.sin(a) * W.execKnock * k; f.stag = Math.max(f.stag, 0.4); f.crushT = W.crushWindow; f.crushBy = h; n++; }
        for (const it of G.pickups) if (!it.dead && ['ration', 'feast', 'potion'].includes(it.kind) && hyp(it.x - h.x, it.y - h.y) < W.execR && Math.abs(angDiff(Math.atan2(it.y - h.y, it.x - h.x), h.fa)) < W.execArc / 2) smashFood(it, h);
        if (n) mastery(h, 'signature', n);
      }
    }
  },

  // ------------------------------------------------ Highlord David: paladin (light element)
  paladin(h, inp, dt) {
    const S = SPEC.paladin, W = SPEC.weapons.paladin;
    if (h.charging === 'judgment') { // Judgment: hold to charge, release a T3 stunning overhead
      h.charge = Math.min(S.judgmentMaxCharge, h.charge + dt); h.moveMul = 0.3; h.heavyT = 0;
      if (h.charge >= S.judgmentMaxCharge && !h.chargedSnd) { h.chargedSnd = true; Snd.play('ready'); }
      if (!inp.down.secondary) {
        const c = h.charge / S.judgmentMaxCharge; h.charging = null; h.charge = 0; h.chargedSnd = false;
        if (c * S.judgmentMaxCharge < S.judgmentMinCharge) { setCd(h, 'secondary', 0.3); return; }
        setCd(h, 'secondary', S.judgmentCd); h.heavyT = 0.4; Snd.play('heavyswing');
        const x = h.x + Math.cos(h.fa) * 46, y = h.y + Math.sin(h.fa) * 46, r = S.judgmentR * (0.7 + 0.3 * c);
        Snd.play('slam'); addTrauma(0.38); hitstop(0.1); ring(x, y, r, '#ffe08a', 0.3, 7); burst(x, y, '#fff2c0', 22, 220, 4, 0.6); decal(x, y, 32, 'rgba(0,0,0,0.3)', 12);
        G.beams.push({ x1: x, y1: y - 260, x2: x, y2: y, col: '#fff2c0', life: 0.25, w: 12 });
        h.lastJudgment = areaHit(x, y, r, heroDmg(h, DEV.dmg.paladin.judgmentMin + (DEV.dmg.paladin.judgmentMax - DEV.dmg.paladin.judgmentMin) * c), { src: h, knock: 320, stagger: S.judgmentStun * c, heavy: true, tier: 3, light: true });
      }
      return;
    }
    const was = h.blocking;
    h.blocking = inp.down.defend && !h.dash && !(h.slamT > 0) && !(h.blockBroken > 0);
    if (h.blocking && !was) h.blockStart = G.time;
    if (h.blocking) {
      h.moveMul = 0.4;
      // Righteous Advance: block + heavy = short armored charge
      if (inp.pressed.secondary && cdReady(h, 'advance')) { h.blocking = false; setCd(h, 'advance', S.advanceCd); Snd.play('rush'); h.advance = true;
        startDash(h, h.fa, S.advanceDist, 0.26, { trail: 'rgba(255,230,150,0.55)', hitR: S.advanceWidth, armor: true, inv: SPEC.hero.paladin.iframes, onHitFoe: f => hitFoe(f, heroDmg(h, DMG.medium), { x: h.x, y: h.y, knock: 360, stagger: 0.5, src: h, tier: 2, light: true }), onEnd: () => { h.advance = false; } });
        return; }
      // Consecration: block + signature = holy ground (3m, 5s): T1 ticks to foes, heals allies 2 bar HP per tick
      if (inp.pressed.ability && cdReady(h, 'consecrate')) { h.blocking = false; consecrate(h); return; }
      return;
    }
    if (h.slamT > 0) { h.moveMul = 0.1; return; }
    // Crusader combo: 3 greatsword swings, T1, T1, then a T2 radiant arc
    if ((inp.down.primary || inp.pressed.primary) && h.atkT <= 0) {
      h.combo = h.comboT > 0 ? (h.combo + 1) % S.combo : 0; h.comboT = 0.85;
      const fin = h.combo === S.combo - 1, arc = fin ? S.finisherArc : S.comboArc, r = fin ? S.finisherR : S.comboR;
      h.atkT = (fin ? 0.48 : 0.34) / hasteMul(h); h.lock = 0.12;
      moveEnt(h, Math.cos(h.fa) * 6, Math.sin(h.fa) * 6);
      Snd.play(fin ? 'heavyswing' : 'swing');
      swingFx(h, h.fa, arc, r, fin ? 'rgba(255,226,140,0.95)' : 'rgba(255,244,210,0.85)', fin ? 9 : 6);
      G.swings[G.swings.length - 1].dir = h.combo === 1 ? -1 : 1;
      if (fin) { G.swings.push({ x: h.x, y: h.y, a: h.fa, arc, r: r + 18, life: 0.2, max: 0.2, col: 'rgba(255,240,170,0.6)', w: 4, follow: h }); }
      melee(h, h.fa, arc, r, fin ? DMG.medium : DMG.light, { knock: fin ? 300 : 130, stagger: fin ? 0.5 : 0.15, hitstop: fin ? 0.07 : 0.035, shake: fin ? 0.15 : 0, tier: fin ? 2 : 1, light: true });
      return;
    }
    if (inp.pressed.secondary && cdReady(h, 'secondary')) { h.charging = 'judgment'; h.charge = 0; Snd.play('windupHero'); return; }
    if (inp.pressed.ability && cdReady(h, 'ability')) paladinSignature(h);
  },

  // ------------------------------------------------ Kestrel: archer
  kestrel(h, inp, dt) {
    if (inp.pressed.defend && cdReady(h, 'defend')) {
      setCd(h, 'defend', SPEC.isaac.rollCd); Snd.play('roll'); h.atkT = 0;   // a roll cancels Rapid Fire recovery
      const a = (inp.mx || inp.my) ? Math.atan2(inp.my, inp.mx) : h.fa;
      startDash(h, a, 150 * h.body.rollDist, 0.3, { inv: SPEC.isaac.rollIframes, trail: 'rgba(200,240,160,0.4)', roll: true });
      return;
    }
    if (h.charging === 'power') {
      h.charge = Math.min(1, h.charge + dt / SPEC.isaac.sniperDraw * hasteMul(h));   // full draw at 90 frames h.moveMul = 0.5;
      if (h.charge >= 1 && !h.chargedSnd) { h.chargedSnd = true; Snd.play('ready'); }
      if (inp.pressed.ability && cdReady(h, 'ability') && h.weapon === 'base') { h.explosiveArrow = true; setCd(h, 'ability', abilityCd(h, 4)); Snd.play('load'); }
      if (!inp.down.secondary) {
        const c = h.charge; h.charging = null; h.charge = 0; h.chargedSnd = false; setCd(h, 'secondary', 0.25);
        const full = c >= 0.98, expl = h.explosiveArrow; h.explosiveArrow = false;
        Snd.play(full ? 'powershot' : 'bow'); if (full) { addTrauma(0.15); moveEnt(h, -Math.cos(h.fa) * 0.2 * MTR, -Math.sin(h.fa) * 0.2 * MTR); }   // 0.2m recoil
        const shadow = h.weapon === 'dusk' && h.invis ? 2 : 1;
        shoot({ team: 'hero', x: h.x, y: h.y, vx: Math.cos(h.fa) * 980, vy: Math.sin(h.fa) * 980, dmg: heroDmg(h, (DEV.dmg.isaac.powerMin + (DEV.dmg.isaac.powerMax - DEV.dmg.isaac.powerMin) * c) * shadow), tier: full ? 3 : c > 0.5 ? 2 : 1, r: full ? 8 : 6, life: full ? 3 : 0.7, kind: 'power', owner: h, pierce: full ? 9999 : Math.floor(c * 3), knock: 120 + 320 * c, sig: true, big: full, col: '#ffef9a',
          fx: { stagger: 0.2 + 0.6 * c, hitstop: full ? 0.05 : 0 },
          onEnd: expl ? s => explode(s.x, s.y, SPEC.isaac.bombShotR, heroDmg(h, DEV.dmg.isaac.bomb), { src: h, col: '#ffcf5a', tag: 'bomb' }) : null,
          onHit: expl ? (s, f) => { if (!s.boomed) { s.boomed = true; explode(s.x, s.y, SPEC.isaac.bombShotR, heroDmg(h, DEV.dmg.isaac.bomb), { src: h, col: '#ffcf5a', tag: 'bomb' }); s.dead = true; } } : null });
      }
      return;
    }
    if (inp.pressed.secondary && cdReady(h, 'secondary')) { h.charging = 'power'; h.charge = 0; Snd.play('draw'); return; }
    const fireHeld = inp.down.primary || (inp.aim === 'stick' && inp.aimFire);
    if (fireHeld && h.atkT <= 0) {
      h.atkT = SPEC.isaac.rapidRate / hasteMul(h);
      const a = h.fa + R(-0.05, 0.05);
      shoot({ team: 'hero', x: h.x + Math.cos(a) * 10, y: h.y + Math.sin(a) * 10, vx: Math.cos(a) * 780, vy: Math.sin(a) * 780, dmg: heroDmg(h, DMG.light), tier: 1, r: 4, life: 0.5, kind: 'arrow', owner: h, knock: 50, col: '#e8d8b0', noSpawner: !ELF_LIGHT_ARROWS_HIT_SPAWNERS });
      Snd.play('arrow');
    }
    if (inp.pressed.ability && cdReady(h, 'ability')) {
      const W = SPEC.wpn, cd = SPEC.weapons.kestrel[h.weapon] ?? SPEC.weapons.kestrel.base;
      if (h.weapon === 'base' && h.dash && h.dash.roll) { // mid-roll: drop a bomb where you are (shoot it for an explosive arrow)
        setCd(h, 'ability', abilityCd(h, 4)); Snd.play('throw');
        G.hazards.push({ kind: 'bomb', x: h.x, y: h.y, r: SPEC.isaac.bombR, delay: 1.3, t: 0, owner: h, onFire: hz => { const big = hz.boost; if (big) text(hz.x, hz.y - 30, 'EXPLOSIVE SHOT!', '#ffcf5a'); explode(hz.x, hz.y, big ? SPEC.isaac.bombR * 1.3 : SPEC.isaac.bombR, heroDmg(h, (big ? DMG.massive : DEV.dmg.isaac.bomb) * (1 + h.mods.ability)), { src: h, col: big ? '#ffd84a' : '#ff9a4a', sigKill: true, tag: 'bomb' }); } });
      } else if (h.weapon === 'thorn') { // Rooting Shot: T2 long thin piercing line, 2.5s hard root
        setCd(h, 'ability', abilityCd(h, cd)); Snd.play('powershot');
        shoot({ team: 'hero', x: h.x, y: h.y, vx: Math.cos(h.fa) * 1100, vy: Math.sin(h.fa) * 1100, dmg: heroDmg(h, DMG.medium * (1 + h.mods.ability)), tier: 2, r: W.rootWidth / 2, life: W.rootLen / 1100, kind: 'power', owner: h, pierce: 9999, sig: true, col: '#9ad04a', knock: 60, fx: { root: W.rootTime } });
      } else if (h.weapon === 'sparks') { // Sparks trap: hidden 1m-trigger mine, T2, 3s group snare
        setCd(h, 'ability', abilityCd(h, cd)); Snd.play('load');
        G.hazards.push({ kind: 'mine', x: h.x, y: h.y, r: W.sparksTrigger, life: 60, t: 0, owner: h });
      } else if (h.weapon === 'dusk') { // Smoke Bomb: 0 damage, 2m cloud, aggro wipe, 2s full invisibility
        setCd(h, 'ability', abilityCd(h, cd)); Snd.play('smoke'); h.invisT = Math.max(h.invisT, W.smokeInvis); burst(h.x, h.y, '#9a9aa8', 30, 160, 5, 0.8);
        G.hazards.push({ kind: 'smoke', x: h.x, y: h.y, r: W.smokeR, life: W.smokeLife, t: 0, owner: h });
        for (const f of G.foes) if (ALIVE(f) && (f.t3By === h || hyp(f.x - h.x, f.y - h.y) < 12 * MTR)) { f.t3Lock = 0; f.t3By = null; f.state = 'move'; f.lostT = 1.0; }
      } else { // Mortar Shot (default): T3, 3m target circle, x3 hits on spawners
        setCd(h, 'ability', abilityCd(h, cd)); Snd.play('throw'); const p = aimPoint(h, 360, 80);
        lob({ team: 'hero', x: h.x, y: h.y, tx: p.x, ty: p.y, time: 0.7, r: 8, kind: 'magma', col: '#ffcf5a', owner: h, tele: W.mortarR,
          onLand: s => { explode(s.tx, s.ty, W.mortarR, heroDmg(h, DEV.dmg.isaac.mortar * (1 + h.mods.ability)), { src: h, col: '#ffcf5a', tag: 'bomb', tier: 3, spawnerHits: W.mortarSpawnerHits, sigKill: true }); } });
      }
    }
  },

  // ------------------------------------------------ Mirelle: rune caster
  mirelle(h, inp, dt) {
    const pad = inp.dev.startsWith('pad');
    // rune buttons: pad X/Y/B -> rime/ember/storm (like the original's face buttons); keyboard: Shift/Space/RMB
    const runeBtn = pad ? [['secondary', 0], ['primary', 1], ['ability', 2]] : [['ability', 0], ['defend', 1], ['secondary', 2]];
    const tpEnd = h.dash && h.dash.inv !== undefined && h.dash.t >= SPEC.zoeyTeleport.iframes && h.dash.dur >= SPEC.zoeyTeleport.iframes;
    if (tpEnd && runeBtn.some(([b]) => inp.pressed[b])) { h.tpBuf = true; }
    if (!h.dash && h.tpBuf) { h.tpBuf = false; SPELLS.ember[0].cast(h); }   // buffered element fires a basic shot when recovery ends
    for (const [btn, idx] of runeBtn) if (inp.pressed[btn]) {
      if (h.runeT <= 0) h.runes = [];
      h.runes.push(idx); h.runeT = 1.4; Snd.play('rune' + idx);
      burst(h.x, h.y - 30, RUNE_COL[h.schools[idx]], 6, 60, 2, 0.4);
      if (h.runes.length === 2) { h.spell = h.runes.slice(); h.runes = []; const sp = spellOf(h); Snd.play('prime'); text(h.x, h.y - 40, sp.name, RUNE_COL[h.schools[h.spell[0]]]); h.channel = null; }
    }
    const castHeld = pad ? (inp.aim === 'stick' && inp.aimFire) || inp.down.defend : inp.down.primary;
    const castPressed = pad ? (inp.aim === 'stick' && inp.aimFire && !h.wasAimFire) || inp.pressed.defend : inp.pressed.primary;
    h.wasAimFire = inp.aim === 'stick' && inp.aimFire;
    const sp = spellOf(h), key = h.weapon + ':' + h.schools[h.spell[0]] + h.spell[1];
    h.channelLock = false;
    if (sp.channel) {
      if (castHeld) { h.channelLock = sp.lockAim === false ? false : false; h.moveMul = sp.moveMul ?? 0; sp.channel(h, dt); h.channel = sp; return; }
      h.channel = null; return;
    }
    // input buffer: a cast pressed during spell recovery fires as soon as recovery ends
    // spell queue buffer: a combo entered (and cast) during the current spell's recovery fires as soon as recovery ends
    if (castPressed && h.atkT > 0) h.castBuf = SPEC.spellQueue; if (h.castBuf > 0) h.castBuf -= dt;
    if ((sp.hold && !h.castBuf ? castHeld : castPressed || h.castBuf > 0) && !(h.spellCd[key] > 0) && h.atkT <= 0) {
      h.castBuf = 0;
      h.spellCd[key] = spellCdOf(h) * (1 - h.mods.ability * 0.5) / (h.buff.haste > 0 ? 1.35 : 1); h.atkT = (sp.rate || 0.15) / hasteMul(h); h.lastSpell = sp.name;
      h.lastElem = { ember: 'fire', infernal: 'fire', rime: 'ice', storm: 'storm', void: 'storm' }[h.schools[h.spell[0]]]; sp.cast(h); mastery(h, 'signature', 1);
    }
  },

  // ------------------------------------------------ Vesper: summoner
  vesper(h, inp, dt) {   // Vesper Linda: necromancer
    const VC = '#b07aff';
    if (inp.pressed.defend && cdReady(h, 'defend')) { // Ghostwalk / Dark Rift phase-step: harvests souls from foes passed through
      setCd(h, 'defend', SPEC.vesper.ghostCd); Snd.play('ghost'); h.inv = SPEC.vesper.ghostIframes;   // Ghostwalk: 2.0s intangible
      const a = (inp.mx || inp.my) ? Math.atan2(inp.my, inp.mx) : h.fa;
      let gained = 0;
      startDash(h, a, 210, 0.34, { ethereal: true, inv: 0.36, trail: 'rgba(176,122,255,0.45)', trailSize: 10, hitR: 4, stopOnWall: false,
        onHitFoe: f => { f.slowT = 2.5; f.slowM = 0.4; hitFoe(f, heroDmg(h, 3), { quiet: true, src: h }); if (gained < 3) { gained++; addEssence(h, 10); burst(f.x, f.y, VC, 6, 80, 2, 0.4); } } });
      return;
    }
    if (h.charging === 'smash') { // Bone Spikes: hold to aim, release to erupt at the target
      h.moveMul = 0.6; h.charge += dt;
      const p = aimPoint(h, 260, 60); h.reticle = p;
      if (!inp.down.secondary) {
        h.charging = null; h.reticle = null; setCd(h, 'secondary', 1.0); Snd.play('grave'); h.slamT = 0.35;
        G.hazards.push({ kind: 'tele', x: p.x, y: p.y, r: 74, delay: 0.25, t: 0, col: VC, onFire: hz => { Snd.play('slam'); addTrauma(0.3); hitstop(0.06);
          G.hazards.push({ kind: 'spikes', x: hz.x, y: hz.y, r: 74, life: 0.6, t: 0, seed: Math.random() * 99 }); burst(hz.x, hz.y, '#e8e0c8', 24, 220, 3, 0.6); ring(hz.x, hz.y, 74, VC, 0.3, 5);
          areaHit(hz.x, hz.y, 74, heroDmg(h, DEV.dmg.vesper.spikes), { src: h, knock: 260, stagger: 0.9, root: 0.8, heavy: true }); } });
      }
      return;
    }
    if (h.channel === 'drain') { // Life Drain (Hungering Skull): channel a beam into one foe
      h.moveMul = 0.4; h.drainT = (h.drainT || 0) + dt;
      let tgt = h.drainTgt; if (!tgt || !ALIVE(tgt) || hyp(tgt.x - h.x, tgt.y - h.y) > 300) { tgt = null; let bd = 280; for (const f of G.foes) if (ALIVE(f) && f.charm <= 0 && f.type !== 'reaper') { const d = hyp(f.x - h.x, f.y - h.y); if (d < bd && Math.abs(angDiff(Math.atan2(f.y - h.y, f.x - h.x), h.fa)) < 0.8 && los(h.x, h.y, f.x, f.y)) { bd = d; tgt = f; } } h.drainTgt = tgt; }
      if (tgt) { h.fa = Math.atan2(tgt.y - h.y, tgt.x - h.x); G.beams.push({ x1: h.x + Math.cos(h.fa) * 14, y1: h.y - 18, x2: tgt.x, y2: tgt.y - 6, col: VC, life: 0.05, w: 4, zig: true });
        h.drainTick = (h.drainTick || 0) - dt; if (h.drainTick <= 0) { h.drainTick = 0.2; const d = heroDmg(h, 5 * (1 + h.mods.ability)); hitFoe(tgt, d, { quiet: true, src: h, sigKill: true }); healHero(h, d * 0.45); }
        h.drainSoul = (h.drainSoul || 0) + dt; if (h.drainSoul > 1.2) { h.drainSoul = 0; addEssence(h, 10); } }
      if (!inp.down.ability || h.drainT > 4) { h.channel = null; h.drainTgt = null; setCd(h, 'ability', abilityCd(h, 3)); }
      return;
    }
    if (h.charging === 'raise') { // Raise Dead: tap = a minion; hold with 10 souls = Bone Golem
      h.charge += dt; h.moveMul = 0.5;
      if (h.souls >= 100 && h.charge > 0.25 && Math.random() < 0.5) G.parts.push({ x: h.x + R(-24, 24), y: h.y + R(-10, 10), vx: 0, vy: -60, life: 0.4, max: 0.4, col: VC, size: 3, grav: 0 });
      if (!inp.down.ability || (h.charge >= 0.7 && h.souls >= 100)) {
        const golem = h.charge >= 0.7 && h.souls >= 100; h.charging = null; h.charge = 0;
        let kinds, cost;
        if (golem) { kinds = ['golem']; cost = 100; }
        else if (h.weapon === 'lantern') { kinds = ['wraith', 'wraith', 'wraith', 'wraith']; cost = SPEC.wpn.shadesCost; }   // Summon Shades: the full essence bar, T3 phantoms lock onto the highest-HP elite
        else { const rot = h.weapon === 'marrow' ? ['guard', 'mage'] : ['warrior', 'spear', 'archer']; h.raiseIx = ((h.raiseIx ?? -1) + 1) % rot.length; kinds = [rot[h.raiseIx]]; cost = h.weapon === 'marrow' ? 30 : SPEC.vesper.raiseCost; }
        if (h.souls < cost) { text(h.x, h.y - 30, `Need ${cost} essence`, VC); Snd.play('error'); setCd(h, 'ability', 0.4); return; }
        const mine = G.allies.filter(a => a.owner === h && a.kind !== 'golem' && a.hp > 0);
        if (!golem && mine.length + kinds.length > 5) { mine.slice(0, mine.length + kinds.length - 5).forEach(a => a.hp = 0); }
        if (golem) G.allies.filter(a => a.owner === h && a.kind === 'golem').forEach(a => a.hp = 0);
        h.souls -= cost; setCd(h, 'ability', golem ? abilityCd(h, 2) : (SPEC.weapons.vesper[h.weapon] ?? 0));   // Raise Skeletons / Summon Shades: no cooldown, essence-gated Snd.play('raise'); h.slamT = 0.4;
        if (golem) { addTrauma(0.4); ring(h.x, h.y, 90, VC, 0.5, 8); msg('A Bone Golem rises!', VC, 1.5); }
        const burstSet = new Set();   // David's deviation 6: the ground erupts where the dead rise (one hit per foe per cast)
        kinds.forEach((kind, k) => { const a = h.fa + (k - (kinds.length - 1) / 2) * 0.6, x = h.x + Math.cos(a) * 38, y = h.y + Math.sin(a) * 38;
          const al = mkAlly(kind, collide(x, y, 12) ? h.x : x, collide(x, y, 12) ? h.y : y, h); if (h.weapon === 'lantern' && kind === 'wraith') { al.eliteHunter = true; al.dmg = heroDmg(h, DMG.heavy) / 2; al.tier = 3; } al.hp *= 1 + h.mods.ability; al.maxhp = al.hp; al.dmg *= 1 + h.mods.ability; mastery(h, 'signature', 1);
          const VD = DEV.dmg.vesper; ring(al.x, al.y, VD.raiseBurstR, VC, 0.35, 5); burst(al.x, al.y, '#e8e0c8', 14, 180, 3, 0.5); areaHit(al.x, al.y, VD.raiseBurstR, heroDmg(h, VD.raiseBurst * (1 + h.mods.ability)), { src: h, set: burstSet, knock: 220, stagger: 0.5, tier: 3, sigKill: true }); });
      }
      return;
    }
    if ((inp.down.primary || inp.pressed.primary) && h.atkT <= 0) { // Soul Reap: medium, 140-degree front arc; every foe hit feeds the essence bar
      h.atkT = 0.38 / hasteMul(h); h.lock = 0.08; Snd.play('swing');
      swingFx(h, h.fa, SPEC.vesper.reapArc, SPEC.vesper.reapR + 6, 'rgba(190,140,255,0.85)', 6, 0.16);
      const n = melee(h, h.fa, SPEC.vesper.reapArc, SPEC.vesper.reapR, DMG.medium, { knock: 140, stagger: 0.2, hitstop: 0.03, tier: 2 });
      if (n) addEssence(h, n * SPEC.vesper.essencePerHit);
      return;
    }
    if (inp.pressed.secondary && cdReady(h, 'secondary')) { h.charging = 'smash'; h.charge = 0; return; }
    if (inp.pressed.ability && cdReady(h, 'ability')) {
      const W = SPEC.wpn, mine = G.allies.filter(a => a.owner === h && a.hp > 0 && a.kind !== 'golem' && !a.detonate);
      if (h.weapon === 'marrow' && mine.length) { // Sacrificial Detonation: 10 essence, every skeleton rushes forward and blows up (3m, T3) where it stands
        if (h.souls < W.detonateCost) { text(h.x, h.y - 30, `Need ${W.detonateCost} essence`, VC); Snd.play('error'); return; }
        h.souls -= W.detonateCost; Snd.play('raise'); text(h.x, h.y - 30, 'DETONATE!', VC); h.slamT = 0.3;
        for (const a of mine) { a.detonate = { t: 0.45, ang: h.fa }; }
        h.lastDetonate = mine.length; return; }
      h.charging = 'raise'; h.charge = 0;
    }
  },
};


// ---------------------------------------------------------------- shared weapon / paladin helpers
function deflectThrust(h) {   // Deflecting Thrust: T1 narrow poke, no cooldown, breaks at most 6 missiles per 30 frames, no stamina
  const W = SPEC.wpn; if (h.atkT > 0) return; h.atkT = 0.22 / hasteMul(h); h.lock = 0.08; Snd.play('swing');
  swingFx(h, h.fa, 0.35, W.deflectR + 8, 'rgba(210,235,255,0.95)', 5, 0.12);
  melee(h, h.fa, 0.35, W.deflectR, DMG.light, { knock: 140, stagger: 0.2, tier: 1 });
  h.parryLog = (h.parryLog || []).filter(t => G.time - t < W.deflectWindow); let n = 0;
  for (const s of G.shots) { if (s.team !== 'foe' || s.dead) continue; if (RULE('spearCap') && h.parryLog.length >= W.deflectMax) break;
    const px = s.x - h.x, py = s.y - h.y, al = px * Math.cos(h.fa) + py * Math.sin(h.fa); if (al < 0 || al > W.deflectR + 20 || Math.abs(-px * Math.sin(h.fa) + py * Math.cos(h.fa)) > W.deflectWidth + s.r) continue;
    h.parryLog.push(G.time); n++; s.dead = true; burst(s.x, s.y, '#cfeaff', 8, 120, 2, 0.3); text(s.x, s.y - 10, 'BROKEN', '#cfeaff'); }
  h.lastDeflect = n; return n;
}
function consecrate(h) {
  const S = SPEC.paladin; setCd(h, 'consecrate', S.consCd); h.slamT = 0.45; Snd.play('holyslam'); addTrauma(0.2);
  G.hazards.push({ kind: 'consecrate', x: h.x, y: h.y, r: S.consR, life: S.consTime, t: 0, owner: h, tick: 0 });
  ring(h.x, h.y, S.consR, '#ffe9a0', 0.5, 6); burst(h.x, h.y, '#fff2c0', 26, 200, 3, 0.7);
}
function paladinSignature(h) {
  const S = SPEC.paladin, cd = SPEC.weapons.paladin[h.weapon] ?? SPEC.weapons.paladin.base;
  setCd(h, 'ability', abilityCd(h, cd));
  if (h.weapon === 'hammer') { // Hammer of Light: T2 thrown hammer, pierces, comes back
    Snd.play('throw'); h.throwT = 0.3;
    shoot({ team: 'hero', x: h.x, y: h.y, vx: Math.cos(h.fa) * S.hammerSpeed, vy: Math.sin(h.fa) * S.hammerSpeed, dmg: heroDmg(h, DMG.medium * (1 + h.mods.ability)), tier: 2, r: 12, life: 6, kind: 'hatchet', col: '#ffe08a', owner: h, sig: true, light: true,
      boomer: { phase: 'out', spd: S.hammerSpeed, dist: 0, range: S.hammerRange, hits: 0, maxHits: 99, resetOnReturn: true } });
  } else if (h.weapon === 'lance') { // Radiant Lance: T3 straight piercing beam, x2 vs shadow and undead
    Snd.play('holyslam'); h.throwT = 0.3; addTrauma(0.25); const len = rayWall(h.x, h.y, h.fa, S.lanceLen);
    G.beams.push({ x1: h.x, y1: h.y - 10, x2: h.x + Math.cos(h.fa) * len, y2: h.y - 10 + Math.sin(h.fa) * len, col: '#fff2c0', life: 0.35, w: 14, glow: true });
    let n = 0; for (const f of G.foes) { if (!ALIVE(f) || f.charm > 0) continue; const px = f.x - h.x, py = f.y - h.y, al = px * Math.cos(h.fa) + py * Math.sin(h.fa); if (al < 0 || al > len) continue; if (Math.abs(-px * Math.sin(h.fa) + py * Math.cos(h.fa)) > S.lanceWidth + f.r) continue;
      const undead = SKELETAL(f) || FOE_FAMILY[f.type] === 'shrouds' || f.type === 'wraith';
      if (hitFoe(f, heroDmg(h, DMG.heavy * (1 + h.mods.ability)) * (undead ? S.lanceUndeadMul : 1), { x: h.x, y: h.y, src: h, knock: 220, stagger: 0.6, tier: 3, light: true, sigKill: true })) n++; }
    for (const s of G.spawners) { const px = s.x - h.x, py = s.y - h.y, al = px * Math.cos(h.fa) + py * Math.sin(h.fa); if (al > 0 && al < len && Math.abs(-px * Math.sin(h.fa) + py * Math.cos(h.fa)) < s.r + S.lanceWidth) hitSpawner(s, heroDmg(h, DMG.heavy), h, { tier: 3 }); }
    h.lastLance = n;
  } else if (h.weapon === 'sanctuary') { // Sanctuary Pulse: T1 4m ring, knockback; allies inside get a 3s shield absorbing 30 HP
    Snd.play('holy'); h.slamT = 0.35; ring(h.x, h.y, S.pulseR, '#fff2a0', 0.5, 8);
    areaHit(h.x, h.y, S.pulseR, heroDmg(h, DMG.light), { src: h, knock: 520, stagger: 0.5, tier: 1, light: true });
    for (const o of G.heroes) if (!o.dead && hyp(o.x - h.x, o.y - h.y) < S.pulseR) { o.absorb = S.pulseShield; o.absorbT = S.pulseShieldTime; ring(o.x, o.y, 30, '#fff2a0', 0.5, 4); }
  } else { // Holy Slam (default): T3 pillar of light, medium radius
    h.slamT = 0.55; Snd.play('windupHero');
    G.hazards.push({ kind: 'tele', x: h.x, y: h.y, r: S.slamR, delay: 0.28, t: 0, col: '#ffe9a0', follow: h,
      onFire: () => { Snd.play('holyslam'); addTrauma(0.55); hitstop(0.1); G.flash = 0.18; G.flashCol = '#fff2c0';
        G.beams.push({ x1: h.x, y1: h.y - 520, x2: h.x, y2: h.y, col: '#ffe9a0', life: 0.6, w: 34, pillar: true });
        ring(h.x, h.y, S.slamR, '#ffe08a', 0.45, 10); burst(h.x, h.y, '#ffe9a0', 36, 300, 4, 0.8);
        const n = areaHit(h.x, h.y, S.slamR, heroDmg(h, DEV.dmg.paladin.slam * (1 + h.mods.ability)), { src: h, knock: 400, stagger: 1.0, walls: true, heavy: true, sigKill: true, tier: 3, light: true });
        h.lastSlam = n; if (n) mastery(h, 'signature', n); } });
  }
}
function devotionMul(h) {   // Devotion Aura: allies within 4m of a living paladin take 10% less damage (aura, not capped)
  for (const p of G.heroes) if (p.id === 'paladin' && !p.dead && hyp(p.x - h.x, p.y - h.y) <= SPEC.paladin.auraR) return 1 - SPEC.paladin.auraMit;
  return 1;
}

// ---------------------------------------------------------------- Mirelle's spellbook (3 schools x 3 spells; first rune picks the school)
const RUNE_COL = { ember: '#ff7a2a', rime: '#8fe3ff', storm: '#ffe95a', void: '#b07aff', infernal: '#ff3a5a' };
const RUNE_NAME = { ember: 'Ember', rime: 'Rime', storm: 'Storm', void: 'Void', infernal: 'Infernal' };
function spellOf(h) {
  const key = h.schools[h.spell[0]] + '+' + h.schools[h.spell[1]];
  if (h.weapon === 'hollow') return VOID_SPELLS[key];
  if (h.weapon === 'ashen') return PYRO_SPELLS[key];
  return SPELLS[h.schools[h.spell[0]]][h.spell[1]];
}
function spellCdOf(h) {   // per-weapon cooldown rule: Spellweaver = spec matrix, Hollow = even, Firebound = +20%
  const key = h.schools[h.spell[0]] + '+' + h.schools[h.spell[1]], base = (SPEC.zoey.spells[key] || {}).cd ?? spellOf(h).cd ?? 0;
  if (h.weapon === 'hollow') return SPEC.voidCd;
  if (h.weapon === 'ashen') return base * SPEC.pyroCdMul;
  return base;
}
const SPELLS = {
  ember: [
    { name: 'Cinder Bolt', hold: true, rate: 0.2, cd: 0, cast: h => { Snd.play('firebolt'); shoot({ team: 'hero', x: h.x, y: h.y, vx: Math.cos(h.fa) * 620, vy: Math.sin(h.fa) * 620, dmg: heroDmg(h, DMG.medium), noFood: true, r: 7, life: 0.7, kind: 'fire', owner: h, col: '#ff8a2a', fx: { burn: 2 }, knock: 70 }); } },
    { name: 'Twin Serpents', cd: 6, cast: h => { Snd.play('serpent'); explode(h.x, h.y, MTR, heroDmg(h, DEV.dmg.zoey.serpentBurst), { src: h, col: '#ff7a2a', tier: 2 }); h.tpBuf = false; startDash(h, h.fa, 300, SPEC.zoeyTeleport.iframes + SPEC.zoeyTeleport.vulnerable, { inv: SPEC.zoeyTeleport.iframes, trail: 'rgba(255,120,30,0.7)', trailSize: 9, hitR: 16, stopOnWall: false, onHitFoe: f => hitFoe(f, heroDmg(h, DEV.dmg.zoey.serpentPass), { x: h.x, y: h.y, burn: 6, stagger: 0.5, slow: 2, src: h }) }); } },
    { name: 'Magma Mortar', cd: 1.1, cast: h => { Snd.play('throw'); const p = aimPoint(h, 340, 80); lob({ team: 'hero', x: h.x, y: h.y, tx: p.x, ty: p.y, time: 0.6, r: 11, kind: 'magma', col: '#ff6a1a', owner: h, arc: 110, tele: 85, onLand: s => explode(s.tx, s.ty, 85, heroDmg(h, DEV.dmg.zoey.mortar), { src: h, col: '#ff7a2a', burn: 4 }) }); } },
  ],
  rime: [
    { name: 'Flash Freeze', cd: 5, cast: h => { Snd.play('freeze'); for (let i = 0; i < 18; i++) { const a = h.fa + R(-0.6, 0.6), s = R(200, 420); G.parts.push({ x: h.x, y: h.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.4, max: 0.4, col: '#dff8ff', size: 4, grav: 0 }); } areaHit(h.x, h.y, 150, heroDmg(h, 6), { cone: h.fa, arc: 1.3, src: h, freeze: 2.6 }); } },
    { name: 'Frost Ray', channel: (h, dt) => {
        h.rayT = (h.rayT || 0) + dt; const len = rayWall(h.x, h.y, h.fa, 380); const ramp = Math.min(1, h.rayT / 1.5);
        G.beams.push({ x1: h.x, y1: h.y, x2: h.x + Math.cos(h.fa) * len, y2: h.y + Math.sin(h.fa) * len, col: '#bff4ff', life: dt * 1.5, w: 6 + ramp * 6, glow: true });
        h.rayTick = (h.rayTick || 0) - dt; if (h.rayTick > 0) return; h.rayTick = 0.1; Snd.play('ray');
        for (const f of G.foes) { if (!ALIVE(f) || f.charm > 0) continue; const px = f.x - h.x, py = f.y - h.y, along = px * Math.cos(h.fa) + py * Math.sin(h.fa); if (along < 0 || along > len) continue; const perp = Math.abs(-px * Math.sin(h.fa) + py * Math.cos(h.fa)); if (perp > f.r + 8) continue; hitFoe(f, heroDmg(h, (3 + 4 * ramp)), { quiet: ramp < 0.5, slow: 1, slowM: 0.4, src: h }); }
        for (const s of G.spawners) { const px = s.x - h.x, py = s.y - h.y, along = px * Math.cos(h.fa) + py * Math.sin(h.fa); if (along > 0 && along < len && Math.abs(-px * Math.sin(h.fa) + py * Math.cos(h.fa)) < s.r + 8) hitSpawner(s, heroDmg(h, 3 + 4 * ramp), h); }
      }, moveMul: 0 },
    { name: 'Winter Orb', cd: 8, cast: h => { Snd.play('orb'); shoot({ team: 'hero', x: h.x, y: h.y, vx: Math.cos(h.fa) * 140, vy: Math.sin(h.fa) * 140, dmg: heroDmg(h, 3), r: 12, life: 1.4, kind: 'iceorb', col: '#bff4ff', owner: h, pierce: 99, fx: { slow: 2, slowM: 0.4 }, onEnd: s => { Snd.play('freeze'); G.hazards.push({ kind: 'frost', x: s.x, y: s.y, r: 115, life: 6, t: 0, cap: RULE('orbCap') ? 30 : 0, caught: new Set(), dps: heroDmg(h, 4), owner: h }); }, onWall: s => G.hazards.push({ kind: 'frost', x: s.x - s.vx * 0.05, y: s.y - s.vy * 0.05, r: 115, life: 6, t: 0, dps: heroDmg(h, 4), owner: h }) }); } },
  ],
  storm: [
    { name: 'Thunderclap', cd: 1.6, cast: h => { Snd.play('thunder'); ring(h.x, h.y, 95, '#ffe95a', 0.3, 7); burst(h.x, h.y, '#fff6a0', 20, 260, 2, 0.4); addTrauma(0.2); areaHit(h.x, h.y, 95, heroDmg(h, DEV.dmg.zoey.thunderclap), { src: h, knock: 460, stagger: 0.8, hitstop: 0.05 }); } },
    { name: 'Arc Chain', cd: 0.8, cast: h => { Snd.play('zap'); let from = { x: h.x, y: h.y }, used = new Set(), aimA = h.fa;
        for (let j = 0; j < 7; j++) { let best = null, bd = j ? 170 : 280; for (const f of G.foes) { if (!ALIVE(f) || used.has(f) || f.charm > 0 || f.type === 'reaper') continue; const d = hyp(f.x - from.x, f.y - from.y); const pen = j ? 0 : Math.abs(angDiff(Math.atan2(f.y - h.y, f.x - h.x), aimA)) * 120; if (d + pen < bd && los(from.x, from.y, f.x, f.y)) { bd = d + pen; best = f; } }
          if (!best) { if (!j) G.beams.push({ x1: h.x, y1: h.y, x2: h.x + Math.cos(aimA) * 120, y2: h.y + Math.sin(aimA) * 120, col: '#ffe95a', life: 0.12, w: 2, zig: true }); break; }
          used.add(best); G.beams.push({ x1: from.x, y1: from.y, x2: best.x, y2: best.y, col: '#fff6a0', life: 0.18, w: 3, zig: true }); hitFoe(best, heroDmg(h, DEV.dmg.zoey.arcChain), { x: from.x, y: from.y, knock: 60, stagger: 0.2, src: h }); from = best; } } },
    { name: 'Static Ward', cd: 10, cast: h => { Snd.play('ward'); G.hazards.push({ kind: 'ward', x: h.x, y: h.y, r: 72, life: 6, t: 0, owner: h }); } },
  ],
  void: [
    { name: 'Undertow', cd: 7, cast: h => { Snd.play('vacuum'); ring(h.x, h.y, 200, '#b07aff', 0.5, 6); for (const f of G.foes) { if (!ALIVE(f) || f.boss || f.charm > 0) continue; const d = hyp(f.x - h.x, f.y - h.y); if (d > 210) continue; const a = Math.atan2(h.y - f.y, h.x - f.x); f.kx += Math.cos(a) * Math.min(600, d * 4); f.ky += Math.sin(a) * Math.min(600, d * 4); f.stag = Math.max(f.stag, 1.4); hitFoe(f, heroDmg(h, 5), { quiet: true, src: h }); } } },
    { name: 'Gloom Torrent', channel: (h, dt) => { h.gT = (h.gT || 0) - dt; for (let i = 0; i < 3; i++) { const a = h.fa + R(-0.5, 0.5), s = R(220, 340); G.parts.push({ x: h.x, y: h.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.45, max: 0.45, col: '#7a4aff', size: 5, grav: 0 }); } if (h.gT > 0) return; h.gT = 0.12; Snd.play('gloom'); areaHit(h.x, h.y, 170, heroDmg(h, 4), { cone: h.fa, arc: 1.0, src: h, slow: 1, slowM: 0.4, quiet: true, needLos: true }); }, moveMul: 0.4 },
    { name: 'Veil', cd: 12, cast: h => { Snd.play('smoke'); h.invisT = 5; burst(h.x, h.y, '#b07aff', 26, 160, 4, 0.8); } },
  ],
  infernal: [
    { name: 'Scorch', cd: 2.2, cast: h => { Snd.play('scorch'); const x = h.x + Math.cos(h.fa) * 50, y = h.y + Math.sin(h.fa) * 50; ring(x, y, 55, '#ff3a5a', 0.3, 7); burst(x, y, '#ff5a3a', 26, 240, 4, 0.5); addTrauma(0.15); areaHit(x, y, 55, heroDmg(h, 34), { src: h, burn: 8, knock: 200, hitstop: 0.05 }); } },
    { name: 'Hellbreath', channel: (h, dt) => { h.hbT = (h.hbT || 0) - dt; for (let i = 0; i < 3; i++) { const a = h.fa + R(-0.4, 0.4), s = R(160, 260); G.parts.push({ x: h.x + Math.cos(h.fa) * 12, y: h.y + Math.sin(h.fa) * 12, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.4, max: 0.4, col: pick(['#ff5a1a', '#ffb02a', '#ff2a3a']), size: 6, grav: 0 }); } if (h.hbT > 0) return; h.hbT = 0.12; Snd.play('flame'); areaHit(h.x, h.y, 120, heroDmg(h, 5), { cone: h.fa, arc: 0.9, src: h, burn: 5, quiet: true, needLos: true }); }, moveMul: 0 },
    { name: 'Pyre Orb', cd: 8, cast: h => { Snd.play('orb'); shoot({ team: 'hero', x: h.x, y: h.y, vx: Math.cos(h.fa) * 140, vy: Math.sin(h.fa) * 140, dmg: heroDmg(h, 3), r: 12, life: 1.4, kind: 'fireorb', col: '#ff5a2a', owner: h, pierce: 99, fx: { burn: 4 }, onEnd: s => G.hazards.push({ kind: 'fire', x: s.x, y: s.y, r: 105, life: 6, t: 0, dps: heroDmg(h, 9), owner: h }) }); } },
  ],
};

// Hollow Chapters: every combo becomes a persistent T2 shadow / gravity zone (even cooldowns)
const VOID_SHAPES = { 'ember+ember': [0.8, 0], 'ember+rime': [1.0, 0.3], 'ember+storm': [1.2, 0], 'rime+rime': [0.9, 0.6], 'rime+ember': [1.0, 0], 'rime+storm': [1.4, 0.5], 'storm+storm': [1.1, 1], 'storm+rime': [0.9, 0.8], 'storm+ember': [1.0, 0.4] };
const VOID_NAMES = { 'ember+ember': 'Umbral Bolt', 'ember+rime': 'Grasping Dark', 'ember+storm': 'Nightfall', 'rime+rime': 'Still Void', 'rime+ember': 'Hollow Bloom', 'rime+storm': 'Event Horizon', 'storm+storm': 'Undertow', 'storm+rime': 'Gravity Well', 'storm+ember': 'Shade Lash' };
const VOID_SPELLS = {}; for (const k in VOID_SHAPES) { const [rm, pull] = VOID_SHAPES[k];
  VOID_SPELLS[k] = { name: VOID_NAMES[k], cast: h => { Snd.play('gloom'); const p = aimPoint(h, 260, 60), r = SPEC.voidR * rm;
    G.hazards.push({ kind: 'gloom', x: p.x, y: p.y, r, life: SPEC.voidTime, t: 0, dps: heroDmg(h, DMG.medium) * 1.2, owner: h, pull, tier: 2 }); ring(p.x, p.y, r, '#b07aff', 0.4, 5); } }; }
// Firebound Tomes: every combo becomes a T3 explosive circle splash at the target point; boosted spawner damage; +20% cooldowns
const PYRO_NAMES = { 'ember+ember': 'Flare', 'ember+rime': 'Cinder Leap', 'ember+storm': 'Great Pyre', 'rime+rime': 'Ash Burst', 'rime+ember': 'Fire Ring', 'rime+storm': 'Smoulder Field', 'storm+storm': 'Sunburst', 'storm+rime': 'Blast Chain', 'storm+ember': 'Ember Fist' };
const PYRO_SPELLS = {}; for (const k in PYRO_NAMES) PYRO_SPELLS[k] = { name: PYRO_NAMES[k], rate: k === 'ember+ember' ? 0.35 : 0.2, cast: h => { const p = aimPoint(h, 300, 60), big = (SPEC.zoey.spells[k] || {}).cd >= 5 ? 1.35 : 1;
  lob({ team: 'hero', x: h.x, y: h.y, tx: p.x, ty: p.y, time: 0.4, r: 8, kind: 'magma', col: '#ff6a1a', owner: h, tele: SPEC.pyroR * big, onLand: s => explode(s.tx, s.ty, SPEC.pyroR * big, heroDmg(h, DMG.heavy), { src: h, col: '#ff7a2a', burn: 3, tier: 3, spawnerHits: SPEC.pyroSpawnerHits * 3 }) }); } };

// ---------------------------------------------------------------- potion abilities (talismans)
// every potion: 12m stagger + aggro-reset shockwave, freezes standard AI on screen for 1.5s,
// stops spawners in the blast for 4s and gives floor food 0.5s of invulnerability
function potionShock(h) {
  const P = SPEC.potion; ring(h.x, h.y, P.shockR, 'rgba(200,230,255,0.7)', 0.45, 5);
  for (const f of G.foes) { if (!ALIVE(f) || f.boss || f.type === 'reaper') continue;
    const d = hyp(f.x - h.x, f.y - h.y);
    if (d < P.shockR) { f.stag = Math.max(f.stag, P.shockStagger); f.t3Lock = 0; f.t3By = null; f.state = 'move'; }
    if (!f.elite && !f.heavy && onScreen(f.x, f.y, 0)) f.aiFreeze = Math.max(f.aiFreeze || 0, P.aiFreeze); }
  for (const s of G.spawners) if (s.hp > 0 && hyp(s.x - h.x, s.y - h.y) < P.shockR) s.stopT = P.spawnerStop;
  if (RULE('potionFoodInv')) for (const it of G.pickups) if (it.kind === 'ration' || it.kind === 'feast' || it.kind === 'potion') it.invT = P.foodInv;
  for (const f of G.foes) if (f.type === 'reaper' && hyp(f.x - h.x, f.y - h.y) < P.shockR) { f.repel = 3; f.avoid = h; f.avoidT = G.time + 8; text(f.x, f.y - 30, 'RECOILS', '#9ff'); }   // Death recovers 3s and picks a new target
}
function usePotion(h) {
  if (h.potions <= 0) { text(h.x, h.y - 30, 'No potions', '#8cf'); Snd.play('error'); return; }
  const tal = h.talisman, id = h.id;
  if (!tal || tal === 'none') { if (h.relic) { useRelic(h, true); } else { text(h.x, h.y - 30, 'No talisman or relic', '#ccc'); Snd.play('error'); } return; }   // no talisman: the potion powers the relic
  h.potions--; Snd.play('potionuse'); potionShock(h);
  const repelAll = (x, y, r) => { for (const f of G.foes) if (f.type === 'reaper' && hyp(f.x - x, f.y - y) < r) repelReaper(f); };
  const TS = SPEC.talisman;
  if (id === 'brannoc' && tal === 'base') { // Quartermaster's Horn: 0 damage, food appears around every hero (works past the floor-37 cutoff)
    Snd.play('horn'); ring(h.x, h.y, 90, '#ffcf7a', 0.5, 6); let n = 0;
    for (const o of G.heroes) if (!o.dead) for (let k = 0; k < TS.feastFood + TS.feastFeast; k++) { const a = R(0, 6.28), d = R(30, 60); let x = o.x + Math.cos(a) * d, y = o.y + Math.sin(a) * d; if (collide(x, y, 6)) { x = o.x; y = o.y + 20; }
      G.pickups.push({ kind: k < TS.feastFood ? 'ration' : 'feast', x, y, talisman: true, invT: 0.5 }); n++; burst(x, y, '#ffcf7a', 6, 80, 2, 0.4); }
    h.lastFeast = n; msg('A feast for the party!', '#ffcf7a', 1.5); repelAll(h.x, h.y, 200); }
  else if (id === 'brannoc') { h.buff.titan = 7; msg('TITAN!', '#ffcf7a', 1.5); Snd.play('titan'); ring(h.x, h.y, 120, '#ffcf7a', 0.5, 8); repelAll(h.x, h.y, 260); }
  else if (id === 'sela' && tal === 'base') { // Valkyrie's Call: summon spectral valkyries; raven wings also lift the fallen and heal
    Snd.play('horn'); h.buff.ravens = 1.4; addTrauma(0.3); ring(h.x, h.y, 200, '#bfe6ff', 0.6, 6);
    for (let k = 0; k < 26; k++) { const a = R(0, 6.28); G.parts.push({ x: h.x + Math.cos(a) * R(10, 60), y: h.y + Math.sin(a) * R(10, 40) - 20, vx: Math.cos(a) * R(40, 140), vy: R(-140, -40), life: 1.1, max: 1.1, col: k % 3 ? '#2a3040' : '#bfe6ff', size: 4, grav: -20 }); }
    for (let k = 0; k < TS.valkCount; k++) { const a = h.fa + (k - 1) * 0.9, x = h.x + Math.cos(a) * 40, y = h.y + Math.sin(a) * 40; const v = mkAlly('illusion', collide(x, y, 12) ? h.x : x, collide(x, y, 12) ? h.y : y, h, { tint: '#bfe6ff', valkyrie: true }); v.life = TS.valkTime; }
    for (const o of G.heroes) { if (o.dead) reviveHero(o, true); else healHero(o, 45); }
    msg("Valkyrie's Call! Shieldmaidens answer.", '#bfe6ff', 2); repelAll(h.x, h.y, 240); }
  else if (id === 'sela') { // Shieldwall Oath (aegis): 0 damage, a stationary field that stops missiles and melee and heals allies inside
    Snd.play('holy'); G.hazards.push({ kind: 'aegis', x: h.x, y: h.y, r: TS.aegisR, life: TS.aegisTime, t: 0, owner: h, tick: 0 }); ring(h.x, h.y, TS.aegisR, '#fff2a0', 0.6, 6); msg('Shieldwall Oath!', '#fff2a0', 2); repelAll(h.x, h.y, 260); }
  else if (id === 'paladin' && tal === 'base') { // Golden Wings: 4s flight + invulnerability, radiant T4 burst on landing
    Snd.play('wings'); h.buff.wings = SPEC.paladin.wingsTime; h.wingsLand = true; G.flash = 0.2; G.flashCol = '#fff2c0'; ring(h.x, h.y, 150, '#ffe08a', 0.6, 8); msg('Golden Wings!', '#ffe9a0', 1.5); repelAll(h.x, h.y, 260); }
  else if (id === 'paladin') { // Lay on Hands: full heal for self and allies within 6m; downed allies in range rise at once (no skull coin)
    Snd.play('holy'); let revived = 0;
    for (const o of G.heroes) { if (hyp(o.x - h.x, o.y - h.y) > SPEC.paladin.layR && o !== h) continue; if (o.dead) { if (reviveHero(o, true)) { o.hp = o.maxHp; revived++; } } else { healHero(o, o.maxHp); } ring(o.x, o.y, 40, '#fff2a0', 0.6, 5); }
    h.lastLay = revived; msg('Lay on Hands!', '#fff2a0', 2); repelAll(h.x, h.y, 240); }
  else if (id === 'kestrel' && tal === 'base') { Snd.play('powershot'); addTrauma(0.3); shoot({ team: 'hero', x: h.x, y: h.y, vx: Math.cos(h.fa) * 1300, vy: Math.sin(h.fa) * 1300, dmg: heroDmg(h, 160), tier: 4, r: 16, life: 1.2, kind: 'heart', owner: h, pierce: 999, ghost: true, big: true, knock: 500, fx: { stagger: 1, hitstop: 0.03 }, col: '#ff6a8a' }); for (const f of G.foes) if (f.type === 'reaper') repelReaper(f); }
  else if (id === 'kestrel') { for (let k = 0; k < 3; k++) { const a = mkAlly('sprite', h.x, h.y, h); a.ang = k * 2.094; } Snd.play('sprites'); repelAll(h.x, h.y, 200); }
  else if (id === 'mirelle' && tal === 'base') { // Arcane Nova: wizard screen blast, T4 damage to everything on screen
    Snd.play('nova'); ring(h.x, h.y, W / 2, '#bfe0ff', 0.5, 10); G.flash = 0.35; G.flashCol = '#cfe8ff'; addTrauma(0.5); hitstop(0.08);
    h.lastNova = areaHit(h.x, h.y, W, heroDmg(h, DMG.massive), { src: h, knock: 500, stagger: 1, heavy: true, tier: 4 }); repelAll(h.x, h.y, 300); }
  else if (id === 'mirelle') { Snd.play('ward'); G.hazards.push({ kind: 'bubble', x: h.x, y: h.y, r: 130, life: 7, t: 0, owner: h }); repelAll(h.x, h.y, 260); }
  else if (id === 'vesper' && tal === 'base') { // Dread Mist: 0 burst damage; a mist that makes foes flee and deals low damage over time
    Snd.play('nova'); ring(h.x, h.y, TS.dreadR, '#b07aff', 0.55, 8); G.flash = 0.15; G.flashCol = '#c8a0ff';
    G.hazards.push({ kind: 'dread', x: h.x, y: h.y, r: TS.dreadR, life: TS.dreadTime, t: 0, owner: h, tick: 0 }); repelAll(h.x, h.y, 280); }
  else if (id === 'vesper') {
    const dead = G.heroes.filter(o => o.dead).sort((a, b) => a.deadAt - b.deadAt)[0];
    if (dead) reviveHero(dead, true); else { healHero(h, 60); h.inv = 4; ring(h.x, h.y, 60, '#7ff5d0', 0.6, 6); Snd.play('revive'); }
  }
}

// ---------------------------------------------------------------- relics
const RELIC_SHARD_COST = { mirror: 50, hoar: 50, haste: 35, feather: 35 };
function relicCd(id, rk) { return RELIC_SPEC[id] ? RELIC_SPEC[id].cd[rk - 1] : RELIC[id].cd * RELIC_CD_MUL[rk - 1]; }
// Relics run on potions; a Rank III relic runs on its 100-unit shard meter instead (a potion refills it completely)
function useRelic(h, viaPotion) {
  if (!h.relic) { if ((h.relicMsg || 0) < G.time) { h.relicMsg = G.time + 3; text(h.x, h.y - 30, 'No relic equipped', '#ccc'); } return; }
  if (!cdReady(h, 'relic')) { Snd.play('error'); return; }
  const id = h.relic.id, rk = h.relic.rank, P = RELIC_SPEC[id];
  if (rk >= 3) {
    const cost = RELIC_SHARD_COST[id] || 40;
    if ((h.shardMeter || 0) < cost) { if (h.potions <= 0) { text(h.x, h.y - 30, `Needs ${cost} shard power or a potion`, '#9fe8ff'); Snd.play('error'); return; } h.potions--; h.shardMeter = 100; potionShock(h); }
    h.shardMeter -= cost;
  } else { if (h.potions <= 0) { text(h.x, h.y - 30, 'Relics need a potion', '#8cf'); Snd.play('error'); return; } h.potions--; potionShock(h); }
  const base = relicCd(id, rk);
  setCd(h, 'relic', base); h.relicMax = base; Snd.play('relic');
  const i = rk - 1;
  switch (id) {
    case 'mirror': { const n = P.clones[i]; for (let k = 0; k < n; k++) { const a = k * 6.28 / n, sp = P.spread[i] / 2; const al = mkAlly('illusion', h.x + Math.cos(a) * sp, h.y + Math.sin(a) * sp, h, { tint: h.def.color }); al.life = P.time[i]; if (P.taunt[i]) al.d = Object.assign({}, al.d, { taunt: true }); } Snd.play('mirror'); break; }
    case 'haste': h.buff.haste = P.time[i]; h.hasteV = 1 + P.speed[i]; ring(h.x, h.y, 50, '#ffe95a', 0.4);
      if (P.burstR[i]) { ring(h.x, h.y, P.burstR[i], '#ffe95a', 0.35, 6); for (const f of G.foes) if (ALIVE(f) && !f.boss && hyp(f.x - h.x, f.y - h.y) < P.burstR[i] + f.r) { const a = Math.atan2(f.y - h.y, f.x - h.x); f.kx += Math.cos(a) * 420; f.ky += Math.sin(a) * 420; f.stag = Math.max(f.stag, 1.0); } } break;
    case 'feather': { Snd.play('wind'); const all = !P.cone[i];
      ring(h.x, h.y, all ? W / 2 : P.range[i], '#fff6c0', 0.45, 6);
      for (const f of G.foes) { if (!ALIVE(f) || f.boss || f.type === 'reaper') continue; const d = hyp(f.x - h.x, f.y - h.y), a = Math.atan2(f.y - h.y, f.x - h.x);
        if (all ? !onScreen(f.x, f.y, 0) : (d > P.range[i] || Math.abs(angDiff(a, h.fa)) > 0.6)) continue;
        if (!all && (f.elite || f.heavy)) { f.slowT = P.slow[i]; f.slowM = 0.5; continue; }
        f.kx += Math.cos(a) * 420; f.ky += Math.sin(a) * 420; f.slowT = P.slow[i]; f.slowM = 0.5; if (P.stun[i]) f.stag = Math.max(f.stag, P.stun[i]); } break; }
    case 'hoar': { Snd.play('freeze'); const r = P.range[i];
      if (P.shape[i] === 'circle') { ring(h.x, h.y, r, '#dff8ff', 0.5, 8); for (const f of G.foes) if (ALIVE(f) && !f.boss && hyp(f.x - h.x, f.y - h.y) < r + f.r) f.frz = P.freeze[i]; }
      else { G.beams.push({ x1: h.x, y1: h.y, x2: h.x + Math.cos(h.fa) * r, y2: h.y + Math.sin(h.fa) * r, col: '#dff8ff', life: 0.3, w: 10 });
        for (const f of G.foes) { if (!ALIVE(f) || f.boss) continue; const px = f.x - h.x, py = f.y - h.y, al = px * Math.cos(h.fa) + py * Math.sin(h.fa); if (al < 0 || al > r) continue; if (Math.abs(-px * Math.sin(h.fa) + py * Math.cos(h.fa)) < 24 + f.r) f.frz = P.freeze[i]; } } break; }
    case 'squall': { const p = aimPoint(h, 220, 60); G.hazards.push({ kind: 'whirl', x: p.x, y: p.y, r: rk >= 2 ? 110 : 80, life: rk >= 3 ? 6 : 4, t: 0, owner: h }); Snd.play('wind'); break; }
    case 'quill': { let n = 0; for (const it of G.pickups) if (!it.dead && ['ration', 'feast', 'potion'].includes(it.kind) && hyp(it.x - h.x, it.y - h.y) < 220) { it.val = it.kind === 'feast' ? 150 : 90; it.kind = 'gold'; n++; burst(it.x, it.y, '#ffd84a', 10, 80, 2, 0.4); } Snd.play('coin'); break; }
    case 'ember': h.buff.ember = rk >= 2 ? 4.5 : 3; h.emberTrail = 0; break;
    case 'idol': { const g = mkAlly('gargoyle', h.x + 20, h.y, h); if (rk >= 2) g.d = Object.assign({}, g.d, { rate: 0.6 }); break; }
    case 'rift': { const vis = G.foes.filter(f => ALIVE(f) && f.charm <= 0 && f.type !== 'reaper' && !f.boss && onScreen(f.x, f.y, -40)); const tgt = vis.length ? pick(vis) : null;
      if (!tgt) { text(h.x, h.y - 30, 'No target', '#ccc'); h.cd.relic = 1; break; }
      tgt.marked = 0.8; if (rk >= 2) h.inv = 0.9;
      G.hazards.push({ kind: 'tele', x: tgt.x, y: tgt.y, r: 80, delay: 0.8, t: 0, col: '#c08aff', follow: tgt, onFire: hz => { if (h.dead) return; h.x = hz.x; h.y = hz.y; if (collide(h.x, h.y, h.r)) { h.x = hz.x; } explode(h.x, h.y, 80, heroDmg(h, DMG.heavy), { src: h, col: '#c08aff' }); } }); break; }
    case 'shade': for (const o of G.heroes) if (!o.dead && hyp(o.x - h.x, o.y - h.y) < 160) { o.invisT = rk >= 2 ? 8 : 5; burst(o.x, o.y, '#9aa', 20, 120, 4, 0.7); } Snd.play('smoke'); break;
    case 'lyre': { Snd.play('lyre'); ring(h.x, h.y, 190, '#ff9ae0', 0.5, 5); for (const f of G.foes) if (ALIVE(f) && !f.boss && f.type !== 'reaper' && hyp(f.x - h.x, f.y - h.y) < 190) { f.charm = rk >= 2 ? 12 : 8; f.state = 'move'; } break; }
  }
}
function updateHeroBuffs(h, dt) {
  if (h.body.stepDust && !h.dead && !h.dash && hyp(h.vx || 0, h.vy || 0) > 5) { // heavy footfalls
    const ph = Math.floor(h.walk / 10 * h.body.animRate * 8 / 4); if (ph !== h.stepPh) { h.stepPh = ph; for (let i = 0; i < 4; i++) G.parts.push({ x: h.x + R(-10, 10), y: h.y + 12 * h.body.scale, vx: R(-40, 40), vy: R(-25, -5), life: 0.35, max: 0.35, col: 'rgba(170,150,120,0.6)', size: R(2, 4), grav: 30 }); } }
  if (h.slamT > 0) h.slamT -= dt; if (h.heavyT > 0) h.heavyT -= dt; if (h.throwT > 0) h.throwT -= dt;
  if (h.buff.wings > 0 && !h.dead) { h.z = 10; if (Math.random() < 0.6) G.parts.push({ x: h.x + R(-30, 30), y: h.y + R(-40, 0), vx: 0, vy: -50, life: 0.6, max: 0.6, col: '#ffe9a0', size: 2.5, grav: 0 }); }
  else if (h.wingsLand) { h.wingsLand = false; h.z = 0; if (!h.dead) { const r = SPEC.paladin.wingsBurstR; Snd.play('holyslam'); addTrauma(0.5); G.flash = 0.25; G.flashCol = '#fff2c0'; ring(h.x, h.y, r, '#ffe08a', 0.5, 10);
    h.lastWingsBurst = areaHit(h.x, h.y, r, heroDmg(h, DMG.massive), { src: h, knock: 520, stagger: 1, heavy: true, tier: 4, light: true }); } }
  if (h.absorbT > 0) { h.absorbT -= dt; if (h.absorbT <= 0) h.absorb = 0; }
  if (h.buff.ember > 0) { h.emberTrail = (h.emberTrail || 0) - dt; if (h.emberTrail <= 0) { h.emberTrail = 0.12; G.hazards.push({ kind: 'fire', x: h.x, y: h.y, r: 26, life: 2.5, t: 0, dps: heroDmg(h, 12), owner: h }); } }
}

function reachableKey(h) { // BFS with gates closed: is any key pickup reachable? (soft-lock guard)
  const m = G.map, seen = new Uint8Array(m.w * m.h), q = [Math.floor(h.y / T) * m.w + Math.floor(h.x / T)]; seen[q[0]] = 1;
  const keyTiles = new Set(G.pickups.filter(i => i.kind === 'key').map(i => Math.floor(i.y / T) * m.w + Math.floor(i.x / T)));
  if (!keyTiles.size) return false;
  for (let k = 0; k < q.length; k++) { const i = q[k]; if (keyTiles.has(i)) return true; const x = i % m.w, y = (i / m.w) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const j = (y + dy) * m.w + x + dx; if (seen[j] || blocksWalk(tileAt(x + dx, y + dy))) continue; seen[j] = 1; q.push(j); } }
  return false;
}
