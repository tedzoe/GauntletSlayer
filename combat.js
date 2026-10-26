'use strict';
// ---------------------------------------------------------------- foes
function mkFoe(type, x, y, o = {}) {
  const d = FOES[type], sc = G.scale || { hp: 1, dmg: 1, spd: 1 };
  const tier = o.tier || 1, tierM = 1 + 0.4 * (tier - 1), coop = G.heroes.length <= 1 && (d.elite || d.heavy) ? ENDLESS.soloEliteHp : 1;
  const f = { type, d, x, y, r: d.r * (1 + (tier - 1) * 0.06), hp: d.hp * sc.hp * tierM * coop, spd: d.spd * sc.spd * R(0.92, 1.08) * (G.mods.frenzy ? 1.3 : 1),
    dmg: d.dmg * sc.dmg * (1 + (tier - 1) * 0.2), state: 'move', st: 0, atkT: R(0.6, 1.6), kx: 0, ky: 0, stag: 0, frz: 0, slowT: 0, slowM: 1, root: 0,
    burn: 0, burnT: 0, charm: 0, flash: 0, fa: R(0, 6.28), seed: R(0, 100), tier, heavy: !!d.heavy, elite: !!d.elite, summonT: R(3, 6), blinkT: 0,
    awake: type !== 'reaper' || !!o.awake, drained: 0, gone: 0, repel: 0, walk: 0, fly: !!d.fly || d.beh === 'wraith', spawned: !!o.spawned, room: type === 'reaper' ? -1 : roomAt(x, y) };
  f.maxhp = f.hp; G.foes.push(f); return f;
}
const ALIVE = e => !e.dead && e.hp > 0;
function heroDmg(h, base) { return base * h.mods.dmg * (h.buff.titan > 0 ? DEV.dmg.theo.titanMul : 1) * (h.buff.valk > 0 ? 1.3 : 1) * (G.mods.glass ? 1.5 : 1); }
function hitFoe(f, dmg, o = {}) {
  if (!ALIVE(f)) return false;
  if (roomAsleep(f.room)) wakeRoom(f.room, 'hit');
  if (f.sub) return false;   // Mire Lurker under water
  const tier = o.tier || dmgTier(dmg, o.src);
  // Lich barrier: immune to status, T1 projectiles bounce back; the power shot and fire bombs go through
  if (f.barrier > 0) {
    const pierce = o.shot === 'power' || o.shot === 'magma' || o.tag === 'bomb';
    if (!pierce) {
      if (o.shot && tier <= 1) { text(f.x, f.y - 24, 'REFLECTED', '#c8a0ff'); return false; }
      dmg *= 0.3; o = Object.assign({}, o, { freeze: 0, slow: 0, root: 0, burn: 0, stagger: 0 });
    }
  }
  if (f.d.armored) o = Object.assign({}, o, { freeze: 0, slow: 0, root: 0, burn: 0 });   // armored: immune to elemental effects
  if (f.type === 'wraith' && o.src && (o.src.id === 'paladin' || (o.src.owner && o.src.owner.id === 'paladin'))) dmg *= 3;   // shadow wraiths are weak to light (Highlord David)
  if (tier >= 3) { if (f.conjuring > 0) { f.conjuring = 0; f.conjT = SPEC.elites.meteorCdOnCancel; text(f.x, f.y - 30, 'INTERRUPTED', '#ffd27a'); } if (f.state === 'windup' && f.elite) f.state = 'move';
    const hh = o.src && o.src.isHero ? o.src : null; if (hh) { f.t3Lock = 4; f.t3By = hh; } }
  const shatter = f.frz > 0 && tier >= 3 && !f.boss; if (shatter) dmg *= SHATTER.mul;   // frozen + T3/T4 = x2
  if ((o.tier >= 4 || o.lethal) && !f.boss && (!f.elite || (o.lethal && f.d.beh === 'caster')) && !f.heavy && f.type !== 'reaper') { f.hp = 0; text(f.x, f.y - 22, 'EXECUTE', '#ffcf5a'); killFoe(f, o.src, o); return true; }   // Lethal kills small foes and casters
  if (!f.boss) { const st = TIER_STAGGER[tier] * (f.heavy || f.elite ? (tier >= 3 ? 0.6 : 0.2) : 1); if (st > (o.stagger || 0)) o = Object.assign({}, o, { stagger: st }); if (tier >= 4) o = Object.assign({}, o, { knock: Math.max(o.knock || 0, 600) }); }
  if (o.src && o.src.isHero && f.charm > 0) { if (o.tag === 'bomb') return false; dmg *= 2; }   // charmed foes don't defend: x2 (Neoseeker FAQ); mortars and bombs spare them
  if (f.type === 'reaper' || f.invuln) {
    if (o.repel && f.type === 'reaper') repelReaper(f);
    if (!o.silent) { Snd.play('tink'); sparkDir(f.x, f.y, R(0, 6.28), '#9ff', 3, 120); }
    if (f.boss && !o.silent) text(f.x, f.y - f.r - 10, 'IMMUNE', '#9ab');
    return false;
  }
  if (f.d.beh === 'shield' && f.stag <= 0 && o.x !== undefined && !o.unblockable) {
    const a = Math.atan2(o.y - f.y, o.x - f.x);
    if (Math.abs(angDiff(a, f.fa)) < 0.95) {
      dmg *= 0.15; Snd.play('clank'); sparkDir(f.x + Math.cos(f.fa) * f.r, f.y + Math.sin(f.fa) * f.r, f.fa, '#ffe9a0', 6);
      if (o.stagger >= 0.8 || o.heavy) { f.stag = 0.9; text(f.x, f.y - 22, 'GUARD BREAK', '#ffd27a'); } else { text(f.x, f.y - 22, 'BLOCKED', '#ccc'); o = Object.assign({}, o, { kx: (o.kx || 0) * 0.3, ky: (o.ky || 0) * 0.3, stagger: 0 }); }
    }
  }
  if (o.src && o.src.isHero && o.src.mods.vsSpawner && f.spawner) dmg *= 1 + o.src.mods.vsSpawner;
  f.hp -= dmg; f.flash = 0.09; if (DEBUG.on) DEBUG.hit(f, dmg, o);
  const kr = f.boss ? 0 : f.heavy ? 0.35 : 1;
  if (o.kx || o.ky) { f.kx += o.kx * kr; f.ky += o.ky * kr; }
  else if (o.knock && o.x !== undefined) { const a = Math.atan2(f.y - o.y, f.x - o.x); f.kx += Math.cos(a) * o.knock * kr; f.ky += Math.sin(a) * o.knock * kr; }
  if (o.stagger && !f.boss) { f.stag = Math.max(f.stag, o.stagger * (f.heavy ? 0.5 : 1)); if (f.state === 'windup' && (!f.heavy || o.stagger > 0.7)) f.state = 'move'; }
  if (o.freeze && !f.boss) f.frz = Math.max(f.frz, o.freeze * (f.heavy ? 0.6 : 1));
  if (o.slow) { f.slowT = Math.max(f.slowT, o.slow); f.slowM = Math.min(f.slowT > 0 ? f.slowM : 1, o.slowM || 0.5); }
  if (o.root && !f.boss) f.root = Math.max(f.root, o.root);
  if (o.burn) { f.burn = Math.max(f.burn, o.burn); f.burnT = Math.max(f.burnT || 0, o.burnT || 3); }
  if (o.hitstop) hitstop(o.hitstop);
  if (o.shake) addTrauma(o.shake);
  if (dmg >= 0.5 && !o.quiet) text(f.x + R(-6, 6), f.y - f.r - 4, Math.round(dmg), dmg >= 25 ? '#ffcf5a' : '#fff');
  if (!o.quiet) { burst(f.x, f.y, f.d.blood || bloodOf(f), Math.min(10, 3 + dmg / 4), 140, 3, 0.4); Snd.play(o.heavy ? 'thud' : 'hit'); }
  if (o.src && o.src.isHero) o.src.lastHitT = G.time;
  if (f.hp <= 0) { if (shatter) { text(f.x, f.y - 26, 'SHATTER', '#dff8ff'); burst(f.x, f.y, '#dff8ff', 22, 220, 3, 0.5); for (const o2 of G.foes) if (o2 !== f && ALIVE(o2) && !o2.elite && !o2.heavy && !o2.boss && hyp(o2.x - f.x, o2.y - f.y) < SHATTER.r + o2.r) o2.stag = Math.max(o2.stag, SHATTER.stagger); } killFoe(f, o.src, o); }
  return true;
}
function bloodOf(f) { return { undead: '#d8d0b0', beast: '#7a2a1a', cult: '#a01818' }[foeKind(f)] || '#aa3333'; }
function foeKind(f) { const s = f.d.style; return ['skeleton', 'skelarcher', 'shambler', 'bloater', 'robed', 'wraith'].includes(s) ? 'undead' : ['goblin', 'spider', 'hulk', 'shieldbrute', 'troll', 'bigspider'].includes(s) ? 'beast' : 'cult'; }
function killFoe(f, src, o = {}) {
  if (f.dead) return; f.dead = true; f.hp = 0;
  if (f.boss) return bossDefeated(f);
  G.stats.kills++;
  burst(f.x, f.y, bloodOf(f), f.heavy ? 26 : 14, 200, 4, 0.7, 200);
  if (f.heavy) { addTrauma(0.25); hitstop(0.05); }
  Snd.play(f.heavy ? 'bigdeath' : 'death');
  decal(f.x, f.y, f.r * 0.9, 'rgba(0,0,0,0.25)', 25);
  const hero = src && (src.isHero ? src : src.owner);
  if (hero && hero.isHero) {
    mastery(hero, 'kills', 1); if (o.sigKill) mastery(hero, 'signature', 1);
    const fam = FOE_FAMILY[f.type]; if (fam) mastery(hero, 'fam_' + fam, 1);
    const tag = o.tag || o.shot;
    if (hero.id === 'brannoc' && (tag === 'spin' || hero.spin > 0)) mastery(hero, 'spinKills', 1);
    if (hero.id === 'sela' && tag === 'shield') mastery(hero, 'throwKills', 1);
    if (hero.id === 'kestrel' && (tag === 'bomb' || tag === 'power')) { mastery(hero, 'precisionKills', 1); if (tag === 'bomb') mastery(hero, 'bombKills', 1); }
    if (hero.id === 'mirelle' && hero.lastElem) mastery(hero, 'elem_' + hero.lastElem, 1);
    if (hero.id === 'vesper' && src !== hero) mastery(hero, 'minionKills', 1);
  }
  for (const h of G.heroes) if (h.id === 'vesper' && !h.dead && hero === h) addEssence(h, f.elite ? SPEC.vesper.essenceElite : SPEC.vesper.essenceGrunt);
  if (Math.random() < (f.elite ? 1 : 0.18)) dropGold(f.x, f.y, Math.round(f.d.gold * (f.elite ? 3 : 1) * R(0.8, 1.3)));
  if (f.elite && Math.random() < 0.4) G.pickups.push({ kind: 'shard', x: f.x - 8, y: f.y });
  if (f.elite && Math.random() < 0.35) G.pickups.push({ kind: Math.random() < 0.6 ? 'ration' : 'potion', x: f.x + 8, y: f.y });
  if (f.d.deathFreeze) { const Z = f.d.deathFreeze; ring(f.x, f.y, Z.r, '#dff8ff', 0.5, 8); Snd.play('freeze'); for (const h of G.heroes) if (!h.dead && hyp(h.x - f.x, h.y - f.y) < Z.r + h.r && !(h.inv > 0)) h.frz = Math.max(h.frz || 0, Z.t); }
  if (f.d.deathPool) { const P = f.d.deathPool; G.hazards.push({ kind: 'miasma', x: f.x, y: f.y, r: P.r, life: P.time, t: 0, dps: P.dps * (G.scale.dmg || 1), team: 'foe' }); }
  if (f.d.deathBlast) explode(f.x, f.y, 75, f.d.deathBlast * (G.scale.dmg || 1), { team: 'all', col: '#9ab04a', src: null, sound: 'squelch' });
  if (f.d.beh === 'exploder') explode(f.x, f.y, 60, 12, { team: 'all', col: '#ff7a2a', src: null });
  if (G.mods.volatile) G.hazards.push({ kind: 'tele', x: f.x, y: f.y, r: 55, delay: 0.9, t: 0, col: '#ff6a3a', onFire: hz => explode(hz.x, hz.y, 55, 14, { team: 'hero', col: '#ff6a3a' }) });
}
function dropGold(x, y, v, src = 'mob') { if (v > 0) G.pickups.push({ kind: 'gold', x: x + R(-8, 8), y: y + R(-8, 8), val: v, src, lockT: src === 'chest' ? 15 / 60 : 0 }); }   // chest/jar gold: 15-frame pickup lock
function repelReaper(f) { f.repel = 5; f.drained = 0; text(f.x, f.y - 30, 'REPELLED', '#9ff'); burst(f.x, f.y, '#9ff', 20, 220, 3, 0.8); }

// generic AoE helpers ----------------------------------------------------------
// team: 'hero' = hits foes/props/spawners; 'foe' = hits heroes & allies; 'all' = both
function areaHit(x, y, r, dmg, o = {}) {
  const team = o.team || 'hero', set = o.set; let n = 0;
  if (team !== 'foe') {
    for (const f of G.foes) {
      if (!ALIVE(f) || (set && set.has(f))) continue;
      const d = hyp(f.x - x, f.y - y); if (d > r + f.r) continue;
      if (o.cone !== undefined && d > 4 && Math.abs(angDiff(Math.atan2(f.y - y, f.x - x), o.cone)) > o.arc / 2 + Math.atan2(f.r, d)) continue;
      if (o.needLos && !los(x, y, f.x, f.y)) continue;
      set && set.add(f);
      const a = Math.atan2(f.y - y, f.x - x);
      if (hitFoe(f, dmg, Object.assign({ x, y, kx: Math.cos(a) * (o.knock || 0), ky: Math.sin(a) * (o.knock || 0) }, o))) n++;
    }
    for (const s of G.spawners) {
      if (s.hp <= 0 || (set && set.has(s))) continue;
      const d = hyp(s.x - x, s.y - y); if (d > r + s.r) continue;
      if (o.cone !== undefined && d > 4 && Math.abs(angDiff(Math.atan2(s.y - y, s.x - x), o.cone)) > o.arc / 2 + 0.3) continue;
      set && set.add(s); hitSpawner(s, dmg, o.src, o); n++;
    }
    for (const p of G.props) {
      if (p.hp <= 0 || (set && set.has(p))) continue;
      if (hyp(p.x - x, p.y - y) > r + p.r) continue;
      if (o.cone !== undefined && Math.abs(angDiff(Math.atan2(p.y - y, p.x - x), o.cone)) > o.arc / 2 + 0.4) continue;
      set && set.add(p); hitProp(p, dmg, o);
    }
    if (!o.noFood) for (const it of G.pickups) {
      if (it.dead || !(it.kind === 'ration' || it.kind === 'feast' || it.kind === 'potion')) continue;
      if (hyp(it.x - x, it.y - y) > r + 6) continue;
      if (o.cone !== undefined && Math.abs(angDiff(Math.atan2(it.y - y, it.x - x), o.cone)) > o.arc / 2) continue;
      smashFood(it, o.src);
    }
    if (o.walls) for (let ty = Math.floor((y - r) / T); ty <= Math.floor((y + r) / T); ty++) for (let tx = Math.floor((x - r) / T); tx <= Math.floor((x + r) / T); tx++) if (tileAt(tx, ty) === TL.CRACK) breakWall(tx, ty);
  }
  if (team !== 'hero') {
    for (const h of G.heroes) { if (h.dead) continue; if (hyp(h.x - x, h.y - y) > r + h.r) continue; hurtHero(h, dmg * (team === 'all' ? 0.6 : 1), { x, y, knock: o.knock || 120, cause: o.cause || 'area' }); }
    for (const a of G.allies) { if (a.hp <= 0 || a.orbit) continue; if (hyp(a.x - x, a.y - y) > r + a.r) continue; hurtAlly(a, dmg); }
  }
  return n;
}
function explode(x, y, r, dmg, o = {}) {
  ring(x, y, r, o.col || '#ffb050', 0.35, 6); burst(x, y, o.col || '#ffb050', 26, r * 3, 4, 0.6); burst(x, y, '#555', 10, r * 2, 5, 0.9);
  G.flash = Math.max(G.flash, 0.12); G.flashCol = '#ffd8a0';
  Snd.play(o.sound || 'boom'); addTrauma(Math.min(0.6, r / 220)); hitstop(0.05);
  decal(x, y, r * 0.6, 'rgba(0,0,0,0.3)', 30);
  areaHit(x, y, r, dmg, Object.assign({ knock: 340, stagger: 0.6, walls: true, heavy: true }, o));
}

// ---------------------------------------------------------------- heroes taking damage
function hurtHero(h, dmg, o = {}) {
  if (h.dead || dmg <= 0) return false;
  if (h.inv > 0 || h.spin > 0 || h.buff.titan > 0 || h.buff.aegis > 0 || h.buff.wings > 0 || h.ethereal > 0) return false;   // spinning = invulnerable
  const SH = h.id === 'sela' ? SPEC.gela : h.id === 'paladin' ? SPEC.paladin : null;
  const blockedFront = h.blocking && o.x !== undefined && Math.abs(angDiff(Math.atan2(o.y - h.y, o.x - h.x), h.fa)) < (SH ? SH.blockArc / 2 : 1.15);
  if (h.crown && !blockedFront) dropCrown(h);   // any landed hit knocks the crown loose, even into the bubble
  h.calmT = 0;
  if (h.bubble && !blockedFront) { h.bubble = false; text(h.x, h.y - 30, 'BUBBLE POPPED', '#bfefff'); ring(h.x, h.y, 34, '#bfefff', 0.3, 4); Snd.play('tink'); return false; }
  if (!o.raw) dmg *= HP_SCALE;   // internal HP is 2x the spec, so enemy hits scale with it
  if (h.dash && h.dash.armor && dmg <= 24 * HP_SCALE) o = Object.assign({}, o, { knock: 0 });   // Furious Charge armor shrugs off T1/T2 hits
  if (h.thrust && !h.thrust.fx && h.id === 'sela') { h.thrust = null; text(h.x, h.y - 30, 'KNOCKED OUT', '#cfeaff'); }   // hit in the thrust start-up pause
  if (h.blocking && o.x !== undefined) {
    const a = Math.atan2(o.y - h.y, o.x - h.x);
    let guard = Math.abs(angDiff(a, h.fa)) < (SH ? SH.blockArc / 2 : 1.15);
    const perfect = guard && SH && G.time - (h.blockStart || -9) <= SH.perfectWindow;
    if (guard && SH && !perfect && o.breakBlock) guard = false;   // David's rule (Slayer Valkyrie): the shield has no stamina, cooldown or break timer; only an unblockable charge passes this one hit
    if (perfect) { text(h.x, h.y - 34, 'PERFECT', '#fff2b0'); if (h.mods.reflect) areaHit(h.x + Math.cos(h.fa) * 30, h.y + Math.sin(h.fa) * 30, 48, heroDmg(h, DMG.light), { src: h, knock: 260, tier: 1 }); }
    if (guard) {
      h.blockFlash = 0.15; Snd.play(h.id === 'sela' ? 'windblock' : 'clank'); sparkDir(h.x + Math.cos(h.fa) * 16, h.y + Math.sin(h.fa) * 16, h.fa, h.id === 'sela' ? '#cfeaff' : '#fff2b0', 8);
      mastery(h, 'signature', 1);
      if (h.id === 'sela' && o.foe && SMALL_FOE(o.foe) && ALIVE(o.foe)) killFoe(o.foe, h, { tag: 'block' });   // small foes shatter on the raised shield
      if (o.slow) h.slowT = Math.max(h.slowT, o.slow);   // the shield does not stop slows
      if (h.id === 'sela') gelaShieldBash(h);   // struck: bash and push back everything in front
      if (o.proj) { if (h.id === 'sela') { mastery(h, 'blockedShots', 1); return 'reflect'; } return 'reflect'; }   // the Valkyrie deflects missiles back; Holy Bulwark too
      if (SH) { if (o.foe && ALIVE(o.foe) && !o.foe.boss) { o.foe.kx += Math.cos(h.fa) * 260; o.foe.ky += Math.sin(h.fa) * 260; } return false; }   // front block: invulnerable, shoves the attacker back
      dmg *= 0.1; o = Object.assign({}, o, { knock: (o.knock || 0) * 0.3 });
    }
  }
  if (!o.raw) dmg *= (1 - Math.min(0.8, h.armor + h.mods.armor)) * (G.dmgTaken || 1) * (G.mods.glass ? 1.5 : 1) * devotionMul(h);
  if (h.absorb > 0) { const take = Math.min(h.absorb, dmg); h.absorb -= take; dmg -= take; ring(h.x, h.y, 26, '#fff2a0', 0.2, 3); if (dmg <= 0) { text(h.x, h.y - 30, 'ABSORBED', '#fff2a0'); return false; } }
  if (h.stunImmune > 0) o = Object.assign({}, o, { knock: 0, freeze: 0, slow: 0 });
  else if (dmg <= 24 * HP_SCALE && !o.raw) { h.hitLog = (h.hitLog || []).filter(t => G.time - t < STUN_BREAK.window); h.hitLog.push(G.time);
    if (h.hitLog.length >= STUN_BREAK.hits) { h.hitLog = []; h.stunImmune = STUN_BREAK.immune; o = Object.assign({}, o, { knock: 0 }); ring(h.x, h.y, STUN_BREAK.pulseR, '#ffffff', 0.25, 4); text(h.x, h.y - 36, 'BREAK FREE', '#fff');
      for (const f of G.foes) if (ALIVE(f) && !f.boss && hyp(f.x - h.x, f.y - h.y) < STUN_BREAK.pulseR + f.r + h.r) { const a = Math.atan2(f.y - h.y, f.x - h.x); f.kx += Math.cos(a) * 360; f.ky += Math.sin(a) * 360; } } }
  h.hp -= dmg; h.hurtT = 0.22; mastery(h, 'dmgTaken', dmg); h.lastCause = o.cause || null;
  if (o.freeze) h.frz = Math.max(h.frz || 0, o.freeze);
  if (o.knock && o.x !== undefined) { const a = Math.atan2(h.y - o.y, h.x - o.x); h.kx += Math.cos(a) * o.knock; h.ky += Math.sin(a) * o.knock; }
  if (o.slow) h.slowT = Math.max(h.slowT, o.slow);
  text(h.x, h.y - 24, '-' + Math.round(dmg), '#ff6a5a'); Snd.play('hurt'); addTrauma(0.12 + Math.min(0.4, dmg / 60));
  burst(h.x, h.y, '#c02020', 6, 120, 3, 0.4);
  if (h.hp <= 0) { if (h.frz > 0) mastery(h, 'death_frozen', 1); if (h.lastCause) mastery(h, 'death_' + h.lastCause, 1); killHero(h); }
  return true;
}
// ---- crown: one per floor, x2 gold for the holder, knocked out by any hit, floats 5s then vanishes
function dropCrown(h) { h.crown = false; h.crownSlowT = RULE('crownLinger') ? 45 / 60 : 0; mastery(h, 'crownDrops', 1); text(h.x, h.y - 40, 'CROWN LOST!', '#ffd84a'); Snd.play('coin');
  G.pickups.push({ kind: 'crown', x: h.x + R(-30, 30), y: h.y + R(-30, 30), t: 0, floatT: SPEC.crown.floatTime, noGrab: 0.6 }); }
function killHero(h) {
  if (h.crown) dropCrown(h);
  h.dead = true; h.hp = 0; h.deadAt = G.time; h.blocking = false; h.spin = 0; h.channel = null;
  resetHeroTimers(h);   // David's rule: dying resets every cooldown, so a revived hero has everything ready
  Snd.play('herodeath'); burst(h.x, h.y, h.def.color, 40, 260, 4, 1); burst(h.x, h.y, '#fff', 15, 160, 2, 0.8); addTrauma(0.6); hitstop(0.12);
  const lost = Math.floor(Math.max(0, G.gold - (G.bankedRun || 0)) * 0.2); if (lost > 0) { G.gold -= lost; dropGold(h.x, h.y, lost, 'hero'); text(h.x, h.y - 30, `-${lost} gold dropped`, '#ffd27a', true); }   // only unbanked gold can drop (gate/exit banking keeps the rest safe)
  for (let k = 0; k < h.keys; k++) G.pickups.push({ kind: 'key', x: h.x + R(-16, 16), y: h.y + R(-16, 16) });
  h.keys = 0; G.deathsRun++; h.deathsRun = (h.deathsRun || 0) + 1; mastery(h, 'deaths', 1);
  G.deathsFloor = (G.deathsFloor || 0) + 1; if (G.deathsFloor === 8) mastery(h, 'deaths8', 1);
  msg(`${h.def.name} has fallen! ${G.heroes.length > 1 ? 'Press CONFIRM to spend a rez coin' + (isFinite(G.rez) ? ` (${G.rez} left)` : '') + '.' : ''}`, '#ff6a5a', 4);
}
function resetHeroTimers(h) {
  h.cd = {}; h.spellCd = {}; h._cdm = {}; h._rdy = {};
  for (const k of ['atkT', 'slamT', 'throwT', 'comboT', 'heavyT', 'hbT', 'gT', 'runeT', 'rayT', 'finT', 'drainT', 'absorbT', 'spikeT', 'lock', 'blockBroken', 'stamT', 'dashMsg', 'gateMsg']) if (h[k]) h[k] = 0;
  h.dash = null; h.charging = null; h.thrust = null; h.superSlash = null; h.rushWin = 0; h.rushPrep = 0; h.smash = null; h.cleaveT = 0; h.titanRoot = 0; h.spinVx = h.spinVy = 0; h.advance = false; h.shieldOut = false; h.z = 0; h.kx = h.ky = 0;
  if (h.relicState) h.relicState = null;
}
function reviveCost() { return 0; }   // revives cost rez coins, not gold
function reviveHero(h, free) {
  if (!h.dead) return false;
  const cost = reviveCost();
  if (!free) { if (!(G.rez > 0)) { msg('No rez coins left', '#ffd27a', 2); Snd.play('error'); return false; } if (isFinite(G.rez)) G.rez--; }
  const ally = G.heroes.find(o => !o.dead && o !== h);
  if (ally) { h.x = ally.x; h.y = ally.y; } unstick(h);
  if (!free && G.heroes.length === 1 && RULE('reviveShock')) { ring(h.x, h.y, W, '#fff6c0', 0.7, 10); addTrauma(0.5);   // solo coin revive: map-wide shockwave
    for (const f of G.foes) { if (!ALIVE(f) || f.boss || f.type === 'reaper') continue; const a = Math.atan2(f.y - h.y, f.x - h.x);
      if (f.elite || f.heavy) { f.kx += Math.cos(a) * 700; f.ky += Math.sin(a) * 700; } else { f.stag = Math.max(f.stag, 1.5); f.kx += Math.cos(a) * 250; f.ky += Math.sin(a) * 250; } } }
  h.dead = false; h.hp = h.maxHp * 0.6; h.inv = 2 + (h.mods.reviveInvuln || 0); h.ethereal = h.mods.reviveInvuln || 0;
  Snd.play('revive'); ring(h.x, h.y, 80, '#fff6c0', 0.6); burst(h.x, h.y, '#fff6c0', 30, 200, 3, 0.8);
  msg(`${h.def.name} returns to the fight!`, '#fff6c0', 2.5); return true;
}

// ---------------------------------------------------------------- foe AI
function pickTarget(f) {
  let best = null, bd = 1e9;
  if (f.charm > 0) { for (const o of G.foes) if (o !== f && ALIVE(o) && o.charm <= 0 && o.type !== 'reaper' && !o.invuln) { const d = hyp(o.x - f.x, o.y - f.y); if (d < bd) { bd = d; best = o; } } return [best, bd]; }
  { const k = G.heroes.find(h => h.crown && !h.dead && !h.invis); if (k && f.charm <= 0 && hyp(k.x - f.x, k.y - f.y) < SPEC.crown.aggroR) return [k, hyp(k.x - f.x, k.y - f.y)]; }
  if (f.t3Lock > 0 && f.t3By && !f.t3By.dead && !f.t3By.invis) return [f.t3By, hyp(f.t3By.x - f.x, f.t3By.y - f.y)];
  for (const h of G.heroes) if (!h.dead && !h.invis && !(f.type === 'reaper' && f.avoid === h && f.avoidT > G.time && G.heroes.some(o => o !== h && !o.dead))) { const d = hyp(h.x - f.x, h.y - f.y); if (d < bd) { bd = d; best = h; } }
  if (f.type !== 'reaper') for (const a of G.allies) if (a.hp > 0 && !a.orbit && !a.invis) { const d0 = hyp(a.x - f.x, a.y - f.y), d = d0 * ((a.d.taunt && d0 < 230) || (a.owner && a.owner.id === 'vesper' && d0 < 300) ? 0.3 : 1.1); if (d < bd) { bd = d; best = a; } }
  for (const o of G.foes) if (o.charm > 0 && ALIVE(o) && o !== f) { const d = hyp(o.x - f.x, o.y - f.y); if (d < bd) { bd = d; best = o; } }
  return [best, bd];
}
function damageTarget(f, t, dmg, o = {}) {
  if (t.isHero) return hurtHero(t, dmg, Object.assign({ x: f.x, y: f.y, foe: f, breakBlock: f.type === 'ravager' }, o));
  if (t.d) return hitFoe(t, dmg, { x: f.x, y: f.y, knock: 120, quiet: false });
  return hurtAlly(t, dmg);
}
function foeShoot(f, ang, o = {}) {
  const spd = o.spd || f.d.pspd || 300;
  shoot(Object.assign({ team: f.charm > 0 ? 'hero' : 'foe', x: f.x + Math.cos(ang) * f.r, y: f.y + Math.sin(ang) * f.r, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, dmg: f.dmg, r: 6, life: 2.2, kind: o.kind || 'orb', col: o.col || '#ff7af0', owner: f, reflectable: true }, o));
}
// ---------------------------------------------------------------- room activation (David, Oct 2026; numbers in DEV.rooms)
// A room's foes and spawners stay dormant (no moving, spawning or shooting) until a hero steps into the room, one of its foes
// gets line of sight to a hero (walls and pillars block it), or anything in it is hit. Then the whole room's encounter wakes.
function wakeRoom(r, by) {
  const m = G.map; if (!roomAsleep(r)) return; m.awake[r] = 1; G.lastWake = { room: r, by, t: G.time }; G.wakes = (G.wakes || 0) + 1;
  const [a, b] = DEV.rooms.wakeDelay;
  for (const f of G.foes) if (f.room === r && ALIVE(f)) { f.atkT = Math.max(f.atkT, R(a, b)); f.alertT = 0.9; }
  for (const s of G.spawners) if (s.room === r) s.spawnT = Math.min(s.spawnT, R(0.4, 1.2));
  const rr = m.rooms[r]; if (rr && onScreen((rr.x + rr.w / 2) * T, (rr.y + rr.h / 2) * T, 200)) Snd.play('windup');
}
function dormantLook(f, dt) {   // a sleeping foe glances around a few times a second; a hero in sight range with clear LOS wakes its room
  f.lookT = (f.lookT ?? R(0, DEV.rooms.sightEvery)) - dt; if (f.lookT > 0) return; f.lookT = DEV.rooms.sightEvery;
  for (const h of G.heroes) { if (h.dead || h.invis) continue; const d = hyp(h.x - f.x, h.y - f.y); if (d < DEV.rooms.sightR && los(f.x, f.y, h.x, h.y)) { f.sawHero = h; wakeRoom(f.room, 'sight'); return; } }
}
function updateFoes(dt) {
  const capMove = G.foes.length;
  if (G.map.rooms && G.map.rooms.length) for (const h of G.heroes) if (!h.dead) { const r = roomAt(h.x, h.y); if (roomAsleep(r)) wakeRoom(r, 'enter'); }
  for (const f of G.foes) {
    if (!ALIVE(f)) continue;
    if (f.alertT > 0) f.alertT -= dt;
    if (roomAsleep(f.room)) { dormantLook(f, dt); continue; }
    if (f.boss) { updateBoss(f, dt); continue; }
    const hm = f.hasteT > 0 ? 1 + SPEC.elites.totemHaste : 1; if (f.hasteT > 0) f.hasteT -= dt;
    f.flash -= dt; f.atkT -= dt * hm; f.summonT -= dt; f.blinkT -= dt; if (f.t3Lock > 0) f.t3Lock -= dt;
    if (f.aiFreeze > 0) { f.aiFreeze -= dt; continue; }   // potion shockwave: standard AI frozen
    if (f.d.beh === 'totem') { f.life = (f.life ?? 12) - dt; if (f.life <= 0) { f.dead = true; f.hp = 0; continue; } for (const o of G.foes) if (o !== f && ALIVE(o) && hyp(o.x - f.x, o.y - f.y) < 170) o.hasteT = 0.3; continue; }
    if (f.d.barrier) { f.barrierCd = (f.barrierCd ?? SPEC.elites.lichShieldEvery) - dt; if (f.barrier > 0) f.barrier -= dt; if (f.barrierCd <= 0) { f.barrierCd = SPEC.elites.lichShieldEvery; f.barrier = SPEC.elites.lichShieldTime; ring(f.x, f.y, 30, '#c8a0ff', 0.4, 4); } }
    if (f.d.rally && ALIVE(f)) { const Rl = f.d.rally; if (f.rallyFx > 0) f.rallyFx -= dt;   // Bone Marshal: nearby skeletons fight faster; periodically calls two more
      if (Rl.aura) for (const o of G.foes) if (o !== f && ALIVE(o) && FOE_FAMILY[o.type] === 'bones' && hyp(o.x - f.x, o.y - f.y) < Rl.aura) o.hasteT = Math.max(o.hasteT || 0, 0.3);
      f.rallyT = (f.rallyT ?? Rl.every * 0.5) - dt; if (f.rallyT <= 0 && G.foes.length < 120) { f.rallyT = Rl.every; f.rallyFx = 1; Snd.play(Rl.type ? 'summon' : 'horn'); text(f.x, f.y - 34, Rl.type ? 'SUMMON!' : 'RALLY!', '#ff9a7a');
        for (let k = 0; k < Rl.count; k++) { let a = R(0, 6.28), x = 0, y = 0, ok = false; for (let tr = 0; tr < 8 && !ok; tr++, a += 0.785) { x = f.x + Math.cos(a) * 40; y = f.y + Math.sin(a) * 40; ok = !collide(x, y, 11); } if (ok) { mkFoe(Rl.type || 'bonesoldier', x, y, { tier: f.tier, spawned: true }); burst(x, y, Rl.type ? '#ff7a3a' : '#c9b08a', 10, 100, 3, 0.5); } } } }
    if (f.d.regen && ALIVE(f) && f.hp < f.maxhp && !(f.burnT > 0)) f.hp = Math.min(f.maxhp, f.hp + f.d.regen * dt * (f.maxhp / f.d.hp));   // Mossback Troll
    if (f.d.nova && ALIVE(f)) { const N = f.d.nova; f.novaT = (f.novaT ?? N.every) - dt;   // Lich: telegraphed frost nova that freezes heroes caught inside
      if (f.novaT <= 0) { f.novaT = N.every; Snd.play('windup'); G.hazards.push({ kind: 'tele', x: f.x, y: f.y, r: N.r, delay: N.windup, t: 0, col: N.col || '#9fd8ff', follow: f, onFire: hz => { if (!ALIVE(f)) return; Snd.play(N.freeze ? 'freeze' : 'boom'); ring(hz.x, hz.y, N.r, N.col || '#dff8ff', 0.5, 8); for (const h of G.heroes) if (!h.dead && hyp(h.x - hz.x, h.y - hz.y) < N.r + h.r) { if (hurtHero(h, f.dmg, { x: hz.x, y: hz.y, knock: 200, cause: 'area' })) { if (N.freeze) h.frz = Math.max(h.frz || 0, N.freeze); if (N.pool) G.hazards.push({ kind: 'miasma', x: h.x, y: h.y, r: N.pool.r, life: N.pool.time, t: 0, team: 'foe', dps: N.pool.dps * (G.scale.dmg || 1) }); if (N.burn) G.hazards.push({ kind: 'fire', x: h.x, y: h.y, r: 40, life: N.burn, t: 0, team: 'foe', dps: f.dmg * 0.4 }); if (N.slow) { h.slowT = Math.max(h.slowT || 0, N.slow); h.slowM = 0.5; } } } } }); } }
    if (f.d.totem) { f.totemT = (f.totemT ?? 4) - dt; if (f.totemT <= 0) { f.totemT = 10; mkFoe('totem', f.x + R(-20, 20), f.y + R(-20, 20), { spawned: true }); Snd.play('hex'); } }
    if (f.d.conjure) { if (f.conjuring > 0) { f.conjuring -= dt; const tg = f.conjTgt;
        if (f.conjuring <= 0 && tg && !tg.dead) { Snd.play('raise'); for (let k = 0; k < 6; k++) { const a = k * 1.047, x = tg.x + Math.cos(a) * 60, y = tg.y + Math.sin(a) * 60; if (!collide(x, y, 11)) { const s = mkFoe('bonesoldier', x, y, { spawned: true }); s.d = Object.assign({}, s.d, { beh: 'shield' }); s.hp *= 1.5; } }
          G.hazards.push({ kind: 'tele', x: tg.x, y: tg.y, r: 60, delay: 1.0, t: 0, col: '#ff5a3a', follow: tg, onFire: hz => explode(hz.x, hz.y, 60, f.dmg * 1.5, { team: 'foe', col: '#ff5a3a' }) }); } }
      else { f.conjT = (f.conjT ?? 8) - dt; if (f.conjT <= 0) { f.conjT = 20; f.conjuring = SPEC.elites.meteorWindup; f.conjTgt = pick(G.heroes.filter(h => !h.dead)) || null; text(f.x, f.y - 30, 'CONJURING', '#ff5a8a'); } } }
    if (f.burnT > 0) { f.burnT -= dt; if (Math.random() < dt * 10) burst(f.x, f.y - 6, '#ff8a2a', 1, 40, 3, 0.4); f.hp -= f.burn * dt; if (f.hp <= 0) { killFoe(f, null); continue; } }
    if (f.slowT > 0) { f.slowT -= dt; if (f.slowT <= 0) f.slowM = 1; }
    if (f.charm > 0) f.charm -= dt;
    // knockback motion
    if (f.kx || f.ky) { const ex = clamp(f.kx * dt, -14, 14), ey = clamp(f.ky * dt, -14, 14), x0 = f.x, y0 = f.y; moveEnt(f, ex, ey, f.fly);
      if (f.crushT > 0) { f.crushT -= dt; const bx = Math.abs(ex) > 3 && Math.abs(f.x - x0) < Math.abs(ex) * 0.4, by_ = Math.abs(ey) > 3 && Math.abs(f.y - y0) < Math.abs(ey) * 0.4; if (bx || by_) { const by = f.crushBy;   /* blocked on either axis = slammed into a wall */ f.crushT = 0; f.kx = f.ky = 0; f.crushed = (f.crushed || 0) + 1;   // Extreme Prejudice wall crush: T4 + 2s hard stun
          text(f.x, f.y - 30, 'CRUSHED', '#ffcf5a'); burst(f.x, f.y, '#c9b08a', 18, 200, 4, 0.5); addTrauma(0.2); f.stag = Math.max(f.stag, SPEC.wpn.crushStun);
          hitFoe(f, by ? heroDmg(by, DMG.massive) : DMG.massive, { src: by, tier: 4, heavy: true, tag: 'crush' }); if (ALIVE(f)) f.stag = Math.max(f.stag, SPEC.wpn.crushStun); if (!ALIVE(f)) continue; } }
      f.kx *= Math.pow(0.0015, dt); f.ky *= Math.pow(0.0015, dt); if (Math.abs(f.kx) + Math.abs(f.ky) < 8) f.kx = f.ky = 0; }
    if (f.frz > 0) { f.frz -= dt; continue; }
    if (f.stag > 0) { f.stag -= dt; continue; }
    if (f.root > 0) f.root -= dt;
    if (f.type === 'reaper') { updateReaper(f, dt); continue; }
    if (f.lostT > 0) { f.lostT -= dt; continue; }   // Smoke Bomb: lost track of their target
    if (f.fearT > 0) { f.fearT -= dt; const a = Math.atan2(f.y - f.fearY, f.x - f.fearX) + Math.sin(G.time * 3 + f.x) * 0.6; { const st = capFoeStep(f, f.spd * 0.8 * dt, dt); moveEnt(f, Math.cos(a) * st, Math.sin(a) * st, f.fly); } f.fa = a; f.walk += dt * 6; f.state = 'move'; continue; }   // Dread Mist: flee
    const [t, d] = pickTarget(f);
    if (!t) { f.state = 'move'; continue; }
    if (d > 900 && !f.spawned) continue; // dormant far away
    const ang = Math.atan2(t.y - f.y, t.x - f.x);
    const sees = d < 520 && (f.fly || los(f.x, f.y, t.x, t.y));
    const beh = f.d.beh;
    let spd = f.spd * f.slowM * hm * (f.root > 0 ? 0 : 1) * dt, dir = null;
    if (f.state === 'windup') {
      f.st -= dt;
      if (beh === 'charger') { if (f.st <= 0) { f.state = 'charge'; f.st = DEV.ground.chargeTime; Snd.play('roar'); } continue; }
      if (beh === 'exploder') { if (f.st <= 0) { f.dead = true; f.hp = 0; G.stats.kills++; explode(f.x, f.y, 70, f.dmg, { team: 'all', col: '#ff7a2a' }); } continue; }
      if (f.st <= 0) foeStrike(f, t);
      continue;
    }
    if (f.state === 'charge') {
      f.st -= dt; const cs = capFoeStep(f, 400 * dt, dt);   // charge capped to the ground cap (DEV.ground), so it stays dodgeable
      const hit = moveEnt(f, Math.cos(f.fa) * cs, Math.sin(f.fa) * cs, false);
      for (const h of [...G.heroes, ...G.allies]) if (!(h.dead || h.hp <= 0) && hyp(h.x - f.x, h.y - f.y) < f.r + h.r + 4 && !f.hitSet?.has(h)) { (f.hitSet = f.hitSet || new Set()).add(h); damageTarget(f, h, f.dmg, { knock: 420, breakBlock: true }); }
      for (const o of G.foes) if (o !== f && ALIVE(o) && !o.boss && hyp(o.x - f.x, o.y - f.y) < f.r + o.r + 4) { const a = Math.atan2(o.y - f.y, o.x - f.x); o.kx += Math.cos(a) * 380; o.ky += Math.sin(a) * 380; o.stag = Math.max(o.stag, 0.4); }   // bowls over its own side
      if (hit) { f.state = 'move'; f.stag = 1.4; addTrauma(0.3); Snd.play('thud'); burst(f.x + Math.cos(f.fa) * f.r, f.y + Math.sin(f.fa) * f.r, '#aaa', 14, 160, 3, 0.5); text(f.x, f.y - 30, 'STUNNED', '#ffd27a'); f.hitSet = null; }
      else if (f.st <= 0) { f.state = 'move'; f.atkT = 2.5; f.hitSet = null; }
      continue;
    }
    if (f.state === 'recover') { f.st -= dt; if (f.st <= 0) f.state = 'move'; spd *= 0.3; }
    switch (beh) {
      case 'melee': case 'shield': case 'swarm': {
        const reach = f.d.reach + f.r + t.r;
        f.fa = beh === 'shield' ? f.fa + clamp(angDiff(ang, f.fa), -3 * dt, 3 * dt) : ang;
        if (d < reach && f.atkT <= 0 && f.state === 'move') { f.state = 'windup'; f.st = f.d.windup; f.fa = ang; Snd.play('windup'); }
        else if (d > reach * 0.8) dir = sees ? [Math.cos(ang), Math.sin(ang)] : flowDir(f);
        if (beh === 'shield') spd *= 0.85;
        break;
      }
      case 'charger': {
        f.fa = ang;
        if (sees && d < 300 && d > 60 && f.atkT <= 0) { f.state = 'windup'; f.st = f.d.windup; f.atkT = 3; Snd.play('windup'); continue; }
        if (d < f.r + t.r + f.d.reach && f.atkT <= 0) { f.state = 'windup'; f.st = 0.5; f.melee = true; }
        dir = sees ? [Math.cos(ang), Math.sin(ang)] : flowDir(f);
        break;
      }
      case 'exploder': {
        f.fa = ang;
        if (d < f.r + t.r + 18) { f.state = 'windup'; f.st = 0.45; Snd.play('fuse'); continue; }
        dir = sees ? [Math.cos(ang), Math.sin(ang)] : flowDir(f);
        break;
      }
      case 'ranged': case 'lobber': case 'caster': case 'brood': {
        f.fa = ang;
        if (sees && d < f.d.keep * 0.7) dir = [-Math.cos(ang), -Math.sin(ang)];
        else if (!sees || d > f.d.range) dir = sees ? [Math.cos(ang), Math.sin(ang)] : flowDir(f);
        else { const s = Math.sin(G.time * 0.7 + f.seed) > 0 ? 1 : -1; dir = [-Math.sin(ang) * s, Math.cos(ang) * s]; spd *= 0.45; }
        if (sees && d < f.d.range + 40 && f.atkT <= 0) {
          f.atkT = f.d.rate * R(0.85, 1.2);
          if (beh === 'lobber') {
            const tx = t.x + (t.vx || 0) * 0.3, ty = t.y + (t.vy || 0) * 0.3;
            lob({ team: 'foe', x: f.x, y: f.y, tx, ty, time: 1.0, r: 10, kind: 'rock', col: '#8a8a7a', onLand: s => { explode(s.tx, s.ty, 42, f.dmg, { team: 'foe', col: f.d.lobPool ? '#9ab04a' : '#a09080', sound: 'thud' }); if (f.d.lobPool) G.hazards.push({ kind: 'miasma', x: s.tx, y: s.ty, r: f.d.lobPool.r, life: f.d.lobPool.time, t: 0, team: 'foe', dps: f.d.lobPool.dps * (G.scale.dmg || 1) }); }, tele: 42 });
            Snd.play('throw');
          } else if (beh === 'brood') { foeShoot(f, ang, { kind: 'web', col: '#e8e8f0', dmg: f.dmg * 0.5, slow: 2, r: 8, spd: 260 }); Snd.play('spit'); }
          else if (beh === 'caster') { foeShoot(f, ang, { kind: 'skull', col: f.d.shotCol || '#9fd8ff', homing: 1.6, spd: 220, r: 8, life: 3, freeze: f.d.freezeShot ?? 1.2 }); Snd.play('hex'); }
          else if (f.d.shot) { foeShoot(f, ang, Object.assign({}, f.d.shot)); Snd.play('spit'); }
          else { foeShoot(f, ang + R(-0.05, 0.05), { kind: f.d.style === 'skelarcher' ? 'arrow' : f.d.style === 'pyro' || f.d.style === 'imp' ? 'fire' : 'orb', col: f.d.style === 'skelarcher' ? '#e0d8c0' : '#ff8a3a', pool: !!f.d.firePool }); Snd.play(f.d.style === 'skelarcher' ? 'bow' : 'fireshot'); }
        }
        if ((beh === 'caster' || beh === 'brood') && f.d.summon && FOES[f.d.summon] && f.summonT <= 0 && G.foes.length < 120) {
          f.summonT = beh === 'brood' ? 5 : 7.5;
          const n = beh === 'brood' ? 4 : 2;
          for (let k = 0; k < n; k++) { const a = R(0, 6.28), x = f.x + Math.cos(a) * 36, y = f.y + Math.sin(a) * 36; if (!collide(x, y, 10)) { mkFoe(f.d.summon, x, y, { tier: f.tier, spawned: true }); burst(x, y, '#7a4aa0', 10, 100, 3, 0.5); } }
          Snd.play('summon');
        }
        if (beh === 'caster' && d < 110 && f.blinkT <= 0) { // blink away
          for (let k = 0; k < 12; k++) { const a = R(0, 6.28), dd = R(160, 260), x = f.x + Math.cos(a) * dd, y = f.y + Math.sin(a) * dd; if (!collide(x, y, f.r) && los(f.x, f.y, x, y)) { burst(f.x, f.y, '#a060ff', 14, 160, 3, 0.5); f.x = x; f.y = y; burst(x, y, '#a060ff', 14, 160, 3, 0.5); Snd.play('blink'); break; } }
          f.blinkT = 4;
        }
        break;
      }
      case 'lurker': {   // submerged: untouchable and fast; surfaces near a hero, spits a 3-shot fan, then dives again
        const L = f.d.lurk; f.subT = (f.subT ?? R(L.under[0], L.under[1])) - dt; if (f.sub === undefined) f.sub = true;
        if (f.sub) { dir = !sees ? flowDir(f) : d > L.keep ? [Math.cos(ang), Math.sin(ang)] : [-Math.sin(ang), Math.cos(ang)]; spd *= 1.25; if (f.subT <= 0 && d < L.rise) { f.sub = false; f.subT = L.up; f.atkT = 0.45; burst(f.x, f.y, '#7ad0e0', 14, 140, 3, 0.5); Snd.play('splash'); } }
        else { dir = [0, 0]; f.fa = ang; if (sees && f.atkT <= 0) { f.atkT = L.rate; for (let k = -1; k <= 1; k++) foeShoot(f, ang + k * L.spread, { kind: 'orb', col: '#6ad0c0', slow: 1.2, r: 6 }); Snd.play('spit'); } if (f.subT <= 0) { f.sub = true; f.subT = R(L.under[0], L.under[1]); burst(f.x, f.y, '#7ad0e0', 10, 100, 3, 0.4); } }
        break;
      }
      case 'wraith': {
        dir = [Math.cos(ang), Math.sin(ang)]; f.fa = ang;
        if (d < f.r + t.r + 2) { damageTarget(f, t, f.dmg, { knock: 160, freeze: f.d.touchFreeze || 0 }); f.dead = true; f.hp = 0; burst(f.x, f.y, '#cfe8ff', 16, 160, 3, 0.5); Snd.play('wraith'); }
        f.x += dir[0] * spd; f.y += dir[1] * spd; dir = null; // phases through walls
        break;
      }
    }
    if (dir) { spd = capFoeStep(f, spd, dt); moveEnt(f, dir[0] * spd, dir[1] * spd, f.fly); f.walk += dt * 8; }
    // spikes hurt foes too
  }
  // separation
  const n = G.foes.length;
  for (let i = 0; i < n; i++) {
    const a = G.foes[i]; if (!ALIVE(a) || a.boss) continue;
    for (let j = i + 1; j < n; j++) {
      const b = G.foes[j]; if (!ALIVE(b) || b.boss) continue;
      const dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r; if (dx > rr || dx < -rr || dy > rr || dy < -rr) continue;
      const d = hyp(dx, dy) || 0.01; if (d >= rr) continue;
      const p = (rr - d) * 0.3, ux = dx / d * p, uy = dy / d * p, wa = a.heavy ? 0.3 : 1, wb = b.heavy ? 0.3 : 1;
      if (!a.fly || a.d.beh !== 'wraith') moveEnt(a, -ux * wa, -uy * wa, a.fly); if (!b.fly || b.d.beh !== 'wraith') moveEnt(b, ux * wb, uy * wb, b.fly);
    }
    for (const h of G.heroes) if (!h.dead && !h.ethereal) { const dx = a.x - h.x, dy = a.y - h.y, d = hyp(dx, dy) || 0.01, rr = a.r + h.r; if (d < rr) moveEnt(a, dx / d * (rr - d) * 0.6, dy / d * (rr - d) * 0.6, a.fly); }
  }
  G.foes = G.foes.filter(f => !f.dead || f.boss && f.dying);
}
function foeStrike(f, t) {
  f.state = 'recover'; f.st = 0.35; f.atkT = f.d.beh === 'swarm' ? 0.6 : 1.1;
  const reach = f.d.reach + f.r + 10;
  G.swings.push({ x: f.x, y: f.y, a: f.fa, arc: f.d.cleave ? 2.2 : 1.4, r: reach, life: 0.14, max: 0.14, col: 'rgba(255,90,70,0.8)', w: f.heavy ? 8 : 4 });
  Snd.play(f.heavy ? 'heavyswing' : 'swing');
  const tgts = [...G.heroes.filter(h => !h.dead), ...G.allies.filter(a => a.hp > 0 && !a.orbit), ...G.foes.filter(o => o.charm > 0 && ALIVE(o) && o !== f)];
  if (f.charm > 0) { tgts.length = 0; tgts.push(...G.foes.filter(o => o.charm <= 0 && ALIVE(o) && o !== f && !o.invuln)); }
  for (const o of tgts) {
    const d = hyp(o.x - f.x, o.y - f.y); if (d > reach + o.r) continue;
    if (Math.abs(angDiff(Math.atan2(o.y - f.y, o.x - f.x), f.fa)) > (f.d.cleave ? 1.2 : 0.9)) continue;
    damageTarget(f, o, f.dmg, { knock: f.heavy ? 380 : 160 });
    if (!f.d.cleave) break;
  }
  if (f.melee) { f.melee = false; }
}
function updateReaper(f, dt) {
  if (!f.awake) { const [t, d] = pickTarget(f); if (t && d < 300) { f.awake = true; Snd.play('reaper'); msg('The Pale Collector has found you. Run! A potion will drive it back.', '#9ff', 3); } return; }
  if (f.gone > 0) { f.gone -= dt; if (f.gone <= 0) reaperReturn(f); return; }
  const [t, d] = pickTarget(f);
  f.ambient = (f.ambient || 0) - dt; if (f.ambient <= 0) { f.ambient = 2.2; if (onScreen(f.x, f.y)) Snd.play('reaperhum'); }
  if (!t) return;
  let ang = Math.atan2(t.y - f.y, t.x - f.x);
  if (f.repel > 0) { f.repel -= dt; ang += Math.PI; }
  const spd = capFoeStep(f, f.spd * dt * (f.slowM || 1) * (G.heroes.length > 1 ? 1 : 0.95), dt);
  const sees = los(f.x, f.y, t.x, t.y);
  const dir = (f.repel > 0 || sees) ? [Math.cos(ang), Math.sin(ang)] : (flowDir(f) || [Math.cos(ang), Math.sin(ang)]);
  moveEnt(f, dir[0] * spd, dir[1] * spd, false); f.fa = ang; f.walk += dt * 6;
  if (f.repel <= 0) for (const h of G.heroes) {
    if (h.dead || h.inv > 0 || h.invis) continue;
    if (hyp(h.x - f.x, h.y - f.y) < f.r + h.r + 4) {
      // Death's touch is lethal: drains a full health bar in ~0.9s, ignoring armor, mitigation and the bubble
      const amt = h.maxHp / DEATH_CONTACT_TIME * dt; h.hp -= amt; f.drained += amt; h.hurtT = 0.1;
      if (Math.random() < dt * 20) burst(h.x, h.y, '#7ff', 2, 80, 2, 0.4);
      Snd.play('drain');
      if (h.hp <= 0) { killHero(h); f.tookLife = true; }
      if (f.tookLife) { f.tookLife = false; f.drained = 0; f.gone = 9; f.drained = 0; burst(f.x, f.y, '#223', 30, 200, 4, 0.9); msg('The Pale Collector takes its due and fades into the dark.', '#9ff', 2.5); }
    }
  }
}
function reaperReturn(f) {
  const alive = G.heroes.filter(h => !h.dead); if (!alive.length) return;
  const h = pick(alive);
  for (let k = 0; k < 40; k++) { const a = R(0, 6.28), d = R(380, 520), x = h.x + Math.cos(a) * d, y = h.y + Math.sin(a) * d; if (!collide(x, y, f.r)) { f.x = x; f.y = y; break; } }
  burst(f.x, f.y, '#223', 20, 120, 4, 0.8); Snd.play('reaper');
}

// ---------------------------------------------------------------- spawners
function mkSpawner(x, y, tier, types, style) {
  const hp = Math.round(SPAWNER_HITS[tier - 1] * (G.mode === 'endless' ? ENDLESS.spawnerHpMul(G.endless) : 1));
  const s = { x, y, r: 16, tier, hp, maxHp: hp, hitBy: new Map(), type: pick(types), spawnT: R(0.5, 2.5), flash: 0, style, spawner: true, room: roomAt(x, y) };
  G.spawners.push(s); return s;
}
function hitSpawner(s, dmg, src, o = {}) {
  if (s.hp <= 0) return;
  if (roomAsleep(s.room)) wakeRoom(s.room, 'hit');
  if (RULE('bombSiege') && !s.pylon && !(o.heavy || o.tag === 'bomb') && dmgTier(dmg, src && (src.isHero ? src : src.owner)) < 3) { text(s.x, s.y - 20, 'no effect', '#aaa'); return; }   // Bomb Siege: explosives and heavy hits only
  // spawners count HITS, not damage: tier 1/2/3 take 3/6/12 standard hits; T3/T4 attacks count as 3
  const hero = src && (src.isHero ? src : src.owner);
  if (hero && s.hitBy) { const last = s.hitBy.get(hero) ?? -9; if (G.time - last < 0.12) return; s.hitBy.set(hero, G.time); }   // one hit per attacker per 0.12s (channels/ticks)
  let hits = s.pylon ? dmg : o.spawnerHits || ((o.tier || dmgTier(dmg, hero)) >= 3 ? 3 : 1);   // boss pylons still take raw damage
  if (hero && hero.isHero && hero.mods.spawnerDmg) hits *= 1 + hero.mods.spawnerDmg;
  s.hp -= hits; s.flash = 0.1; Snd.play('stonehit'); burst(s.x, s.y, '#c9b08a', 5, 120, 3, 0.4);
  const per = s.maxHp / SPAWNER_HITS[Math.max(0, (s.baseTier || s.tier) - 1)], nt = s.hp <= 3 * per ? 1 : s.hp <= 6 * per ? 2 : 3;
  if (!s.pylon && nt < s.tier && s.hp > 0) { s.tier = nt; ring(s.x, s.y, 40, '#ffd27a', 0.3); text(s.x, s.y - 24, 'Tier ' + nt, '#ffd27a'); }
  if (s.hp <= 0) {
    Snd.play('spawnerdie'); addTrauma(0.35); hitstop(0.06);
    burst(s.x, s.y, '#e0d0b0', 30, 240, 4, 0.9); ring(s.x, s.y, 70, '#ffd27a', 0.45);
    dropGold(s.x, s.y, RI(30, 60), 'chest'); G.stats.spawners++;
    const hero = src && (src.isHero ? src : src.owner); if (hero && hero.isHero) mastery(hero, 'spawners', 1);
  }
}
function updateSpawners(dt) {
  const cap = 70 + 25 * G.heroes.length;
  for (const s of G.spawners) {
    if (s.hp <= 0) continue; s.flash -= dt;
    if (roomAsleep(s.room)) continue;   // dormant room: no spawning
    let near = 1e9; for (const h of G.heroes) if (!h.dead) near = Math.min(near, hyp(h.x - s.x, h.y - s.y));
    if (near > 560 || G.foes.length >= cap) continue;
    if (RULE('spawnerCleanup') && G.mode === 'endless' && G.endless >= 70 && !s.pylon && !onScreen(s.x, s.y, 0) && !G.heroes.some(h => !h.dead && los(h.x, h.y, s.x, s.y))) {   // stale blocked spawners erode
      s.decayT = (s.decayT || 0) + dt; if (s.decayT >= 60) { s.decayT = 0; s.hp -= 0.25 * (s.maxHp || s.hp); if (s.hp <= 0) { s.hp = 0.001; hitSpawner(s, 1e6, null); } } }
    if (s.stopT > 0) { s.stopT -= dt; continue; }
    s.spawnT -= dt;
    if (s.spawnT <= 0) {
      s.spawnT = R(2.4, 3.8) / (0.6 + s.tier * 0.4) * (G.scale.spawn || 1) / ENDLESS.coopCount(Math.max(1, G.heroes.length));
      const a = R(0, 6.28), x = s.x + Math.cos(a) * 28, y = s.y + Math.sin(a) * 28;
      if (!collide(x, y, 11)) { mkFoe(s.type, x, y, { tier: s.tier, spawned: true }); burst(x, y, '#3a3040', 8, 70, 4, 0.5); if (onScreen(x, y)) Snd.play('spawn'); }
    }
  }
  G.spawners = G.spawners.filter(s => s.hp > 0);
}

// ---------------------------------------------------------------- props & pickups
function mkProp(kind, x, y) { const p = { kind, x, y, r: kind === 'barrel' ? 11 : kind === 'chest' ? 13 : kind === 'legend' ? 15 : 10, hp: kind === 'chest' ? 3 : 1 }; G.props.push(p); return p; }
function hitProp(p, dmg, o = {}) {
  if (p.hp <= 0 || p.kind === 'legend') return;
  if (p.kind === 'chest' && (o.tier || dmgTier(dmg, o.src && (o.src.isHero ? o.src : o.src.owner))) < 3 && !o.heavy) { p.flash = 0.1; Snd.play('clank'); return; }   // T2 object: iron chests need a T3 hit
  p.hp = p.kind === 'chest' ? 1 : p.hp; p.hp -= 1; p.flash = 0.1; Snd.play('wood');
  if (p.hp > 0) return;
  { const hh = o.src && (o.src.isHero ? o.src : o.src.owner); if (hh && hh.isHero) mastery(hh, 'props', 1); }
  burst(p.x, p.y, p.kind === 'barrel' ? '#a05a2a' : p.kind === 'chest' ? '#8a5a2a' : '#b09070', 14, 160, 3, 0.6);
  if (p.kind === 'urn') { const r = Math.random(); if (r < 0.55) dropGold(p.x, p.y, RI(8, 22), 'chest'); else if (r < 0.63) G.pickups.push({ kind: 'ration', x: p.x, y: p.y }); Snd.play('pot'); }
  if (p.kind === 'urn' && Math.random() < 0.12) G.pickups.push({ kind: 'shard', x: p.x + 6, y: p.y });
  if (p.kind === 'chest') { G.pickups.push({ kind: Math.random() < 0.4 ? 'cache' : 'shard', x: p.x, y: p.y + 10 }); for (let k = 0; k < RI(4, 6); k++) dropGold(p.x + R(-16, 16), p.y + R(-16, 16), RI(25, 50), 'chest'); Snd.play('chest'); }
  if (p.kind === 'barrel') G.hazards.push({ kind: 'tele', x: p.x, y: p.y, r: 95, delay: 0.12, t: 0, col: '#ff8a2a', silent: true, onFire: hz => explode(hz.x, hz.y, 95, 40, { team: 'all', col: '#ff9a3a', src: o.src }) });
}
function smashFood(it, src) {
  if (it.invT > 0) return;   // potion shockwave briefly protects floor food
  it.dead = true; Snd.play('smash'); burst(it.x, it.y, it.kind === 'potion' ? '#6aa0ff' : '#c08040', 12, 140, 3, 0.5);
  text(it.x, it.y - 10, it.kind === 'potion' ? 'Potion smashed!' : 'Food destroyed!', '#f88');
  G.stats.foodSmashed++;
  const hero = src && (src.isHero ? src : src.owner);
  if (hero && hero.isHero) { mastery(hero, 'foodSmashed', 1); if (hero.mods.smashHeal && it.kind !== 'potion') { const v = foodValue(it) * hero.mods.smashHeal; healHero(hero, v); } }
}
const foodValue = it => it.kind === 'feast' ? 45 : 20;
function healHero(h, v) { if (h.dead) return 0; v *= HP_SCALE; const before = h.hp; h.hp = Math.min(h.maxHp, h.hp + v); const got = h.hp - before; if (got >= 1) text(h.x, h.y - 26, '+' + Math.round(got), '#7f7'); return got; }
function trapBand() { return G.mode === 'endless' ? G.endless : G.mode === 'campaign' ? [1, 20, 37, 37][G.worldIdx] || 1 : 20; }
// co-op underdog: more than 40% behind the leader's gold -> +15% on mob gold until within 20%
function underdog(h) {
  if (G.heroes.length < 2 || !RULE('underdogGold')) return false;
  const lead = Math.max(...G.heroes.map(o => o.goldRun || 0)), mine = h.goldRun || 0;
  if (lead <= 0) { h.underdog = false; return false; }
  if (!h.underdog && mine < lead * (1 - UNDERDOG.enter)) h.underdog = true;
  else if (h.underdog && mine >= lead * (1 - UNDERDOG.exit)) h.underdog = false;
  return !!h.underdog;
}
function coinCap() { return isFinite(G.rez) ? SPEC.coins.capPerPlayer * Math.max(1, G.heroes.length) : Infinity; }
function updatePickups(dt) {
  // Unfair has no food; Endless from floor 37 turns food into gold
  const noFood = G.mode !== 'hub' && (!diff().food || (G.mode === 'endless' && G.endless >= ENDLESS.foodCutoff));
  if (noFood) for (const it of G.pickups) if ((it.kind === 'ration' || it.kind === 'feast') && !it.talisman) { if (!diff().food) it.dead = true; else { it.kind = 'gold'; it.val = it.val || (it.kind === 'feast' ? 60 : 30); } }
  for (const it of G.pickups) {
    if (it.dead) continue;
    it.t = (it.t || 0) + dt; if (it.invT > 0) it.invT -= dt; if (it.noGrab > 0) it.noGrab -= dt;
    if (it.kind === 'crown' && it.floatT !== undefined) { it.floatT -= dt; if (it.floatT <= 0) { it.dead = true; burst(it.x, it.y, '#ffd84a', 10, 80, 2, 0.4); continue; } }
    for (const h of G.heroes) {
      if (h.dead) continue;
      const d = hyp(h.x - it.x, h.y - it.y);
      if (it.kind === 'gold' && d < GOLD_MAGNET + h.r && it.t >= (it.lockT || 0)) { it.x += (h.x - it.x) * Math.min(1, dt * 10); it.y += (h.y - it.y) * Math.min(1, dt * 10); }
      if (d > h.r + 10) continue;
      if (it.kind === 'potion' && h.potions >= POTION_CAP) continue;   // extras stay on the floor   // max 5 potions, max 5 keys
      if (it.kind === 'key' && h.keys >= 5) continue;
      if (it.kind === 'gold' && it.t < (it.lockT || 0)) continue;
      if (it.kind === 'crown' && (it.noGrab > 0 || G.heroes.some(o => o.crown))) continue;
      if (it.kind === 'coin' && G.rez >= coinCap()) continue;
      it.dead = true;
      switch (it.kind) {
        case 'ration': case 'feast': { const v = foodValue(it) * (1 + h.mods.food); const got = healHero(h, v); mastery(h, 'eaten', v); if (got < 1) text(it.x, it.y - 14, 'wasted', '#aaa'); Snd.play('eat'); burst(it.x, it.y, '#e0a050', 8, 80, 2, 0.4); break; }
        case 'potion': h.potions++; Snd.play('potion'); text(it.x, it.y, 'POTION', '#8cf'); break;
        case 'key': h.keys++; Snd.play('key'); text(it.x, it.y, 'KEY', '#fd5'); break;
        case 'crown': h.crown = true; Snd.play('mastery'); text(it.x, it.y - 10, 'THE CROWN! x2 GOLD', '#ffd84a'); break;
        case 'shard': case 'cache': h.shardMeter = Math.min(100, (h.shardMeter || 0) + (it.kind === 'cache' ? 25 : 10)); Snd.play('tink'); text(it.x, it.y - 10, it.kind === 'cache' ? '+25 SHARDS' : '+10 SHARDS', '#9fe8ff'); break;
        case 'coin': G.rez = Math.min(coinCap(), (G.rez || 0) + 1); Snd.play('coin'); text(it.x, it.y - 10, 'SKULL COIN', '#e8e0c8'); break;
        case 'gold': { let v = Math.round(it.val * (1 + h.mods.gold) * (G.mods.gilded ? 2 : 1) * (G.goldMul || 1) * RULE('goldMul')); if (h.crown) v *= SPEC.crown.goldMul; if (it.src === 'mob' && underdog(h)) v = Math.round(v * (1 + UNDERDOG.bonus)); G.gold += v; G.stats.gold += v; h.goldRun = (h.goldRun || 0) + v; mastery(h, 'gold', v); Snd.play('coin'); text(it.x, it.y - 8, '+' + v, '#ffd84a'); break; }
      }
      break;
    }
  }
  G.pickups = G.pickups.filter(i => !i.dead);
}

// ---------------------------------------------------------------- projectiles
function shoot(o) { const s = Object.assign({ life: 1, r: 5, pierce: 0, dmg: 5, team: 'hero', hit: new Set(), t: 0 }, o);
  if (s.team === 'foe') slowFoeShot(s);
  G.shots.push(s); return s; }
// David's deviation 4: every enemy missile (bosses too) is slowed by DEV.proj.mul and capped at PROJ_CAP(); range and homing turn radius are kept
function slowFoeShot(s) {
  const v = hyp(s.vx || 0, s.vy || 0); if (!v) return s;
  const nv = Math.min(v * DEV.proj.mul, PROJ_CAP()), k = nv / v;
  s.vx *= k; s.vy *= k; s.life /= k; if (s.homing) s.homing *= k; s.slowed = k; return s;
}
function lob(o) { // arcing missile to a point; passes over walls & pits
  // enemy lobs: flight time is never shorter than reaction + the time to walk out of the target circle at the slowest hero's speed
  if (o.team === 'foe') o = Object.assign({}, o, { time: Math.max(o.time || 0.7, DEV.proj.react + ((o.tele || 42) + DEV.proj.sidestepPx) / SLOWEST_HERO_SPEED()) });
  const s = shoot(Object.assign({ lob: true, sx: o.x, sy: o.y, T: o.time || 0.7, life: 99 }, o));
  if (o.tele) G.hazards.push({ kind: 'tele', x: o.tx, y: o.ty, r: o.tele, delay: s.T, t: 0, col: o.team === 'foe' ? '#ff5040' : '#80d0ff', visualOnly: true });
  return s;
}
function updateShots(dt) {
  for (const s of G.shots) {
    if (s.dead) continue;
    s.t += dt; s.life -= dt;
    if (s.lob) {
      const k = Math.min(1, s.t / s.T); s.x = lerp(s.sx, s.tx, k); s.y = lerp(s.sy, s.ty, k); s.z = Math.sin(k * Math.PI) * (s.arc || 70);
      if (k >= 1) { s.dead = true; s.onLand && s.onLand(s); }
      continue;
    }
    if (s.life <= 0) { s.dead = true; s.onEnd && s.onEnd(s); continue; }
    if (s.boomer) { updateBoomer(s, dt); continue; }
    if (s.homing) {
      let tgt = null, bd = 400;
      if (s.team === 'foe') { for (const h of G.heroes) if (!h.dead && !h.invis) { const d = hyp(h.x - s.x, h.y - s.y); if (d < bd) { bd = d; tgt = h; } } }
      else for (const f of G.foes) if (ALIVE(f) && f.charm <= 0) { const d = hyp(f.x - s.x, f.y - s.y); if (d < bd) { bd = d; tgt = f; } }
      if (tgt) { const a = Math.atan2(s.vy, s.vx), b = Math.atan2(tgt.y - s.y, tgt.x - s.x), sp = hyp(s.vx, s.vy), na = a + clamp(angDiff(b, a), -s.homing * dt, s.homing * dt); s.vx = Math.cos(na) * sp; s.vy = Math.sin(na) * sp; }
    }
    const steps = Math.ceil(hyp(s.vx, s.vy) * dt / 10) || 1;
    for (let k = 0; k < steps && !s.dead; k++) {
      s.x += s.vx * dt / steps; s.y += s.vy * dt / steps;
      if (!s.ghost && shotSolid(s.x, s.y)) {
        s.dead = true; burst(s.x - s.vx * 0.01, s.y - s.vy * 0.01, s.col || '#aaa', 4, 80, 2, 0.25);
        if (s.onWall) s.onWall(s); else if (s.onEnd) s.onEnd(s);
        if (s.pool) G.hazards.push({ kind: 'fire', x: s.x - s.vx * 0.02, y: s.y - s.vy * 0.02, r: 34, life: 3, t: 0, team: 'foe', dps: 8 });
        break;
      }
      shotCollide(s);
    }
  }
  G.shots = G.shots.filter(s => !s.dead);
}
function shotCollide(s) {
  if (s.team === 'hero') {
    for (const f of G.foes) {
      if (!ALIVE(f) || s.hit.has(f) || f.charm > 0) continue;
      if (Math.abs(f.x - s.x) > f.r + s.r || Math.abs(f.y - s.y) > f.r + s.r || hyp(f.x - s.x, f.y - s.y) > f.r + s.r) continue;
      s.hit.add(f);
      const a = Math.atan2(s.vy, s.vx);
      hitFoe(f, s.dmg, Object.assign({ x: s.x - Math.cos(a) * 20, y: s.y - Math.sin(a) * 20, kx: Math.cos(a) * (s.knock || 60), ky: Math.sin(a) * (s.knock || 60), src: s.owner, sigKill: s.sig, shot: s.kind, tier: s.tier, lethal: s.lethal }, s.fx || {}));
      if (s.dmgAfter !== undefined) s.dmg = s.dmgAfter;   // Root Shot: first foe takes the full hit, the rest less
      s.onHit && s.onHit(s, f);
      if (s.pierce-- <= 0) { s.dead = true; s.onEnd && s.onEnd(s); return; }
    }
    for (const sp of G.spawners) if (sp.hp > 0 && !s.hit.has(sp) && hyp(sp.x - s.x, sp.y - s.y) < sp.r + s.r) { s.hit.add(sp); hitSpawner(sp, s.dmg, s.owner, { tier: s.tier, spawnerHits: s.spawnerHits }); if (s.pierce-- <= 0) { s.dead = true; s.onEnd && s.onEnd(s); return; } }
    for (const p of G.props) if (p.hp > 0 && p.kind !== 'legend' && hyp(p.x - s.x, p.y - s.y) < p.r + s.r) { hitProp(p, s.dmg, { src: s.owner }); s.dead = true; s.onEnd && s.onEnd(s); return; }
    if (!s.noFood) for (const it of G.pickups) if (!it.dead && (it.kind === 'ration' || it.kind === 'feast' || it.kind === 'potion') && hyp(it.x - s.x, it.y - s.y) < 10 + s.r) { smashFood(it, s.owner); if (!s.big) { s.dead = true; return; } }
    for (const hz of G.hazards) if (hz.kind === 'bomb' && !hz.done && s.owner && s.owner.id === 'kestrel' && hyp(hz.x - s.x, hz.y - s.y) < 16) { hz.boost = true; hz.t = hz.delay; s.dead = true; return; }
  } else {
    for (const hz of G.hazards) if ((hz.kind === 'ward' || hz.kind === 'bubble') && hyp(hz.x - s.x, hz.y - s.y) < hz.r) { s.dead = true; burst(s.x, s.y, '#bfefff', 6, 100, 2, 0.3); Snd.play('tink'); return; }
    for (const h of G.heroes) {
      if (h.dead || hyp(h.x - s.x, h.y - s.y) > h.r + s.r) continue;
      const res = hurtHero(h, s.dmg, { x: s.x - s.vx * 0.05, y: s.y - s.vy * 0.05, proj: true, knock: 80, slow: s.slow, freeze: s.freeze });
      if (res === 'reflect' && s.reflectable !== false) { s.team = 'hero'; s.vx *= -1.2; s.vy *= -1.2; s.dmg *= h.id === 'sela' ? SPEC.gela.reflectMul : 1.5; s.owner = h; s.hit = new Set(); s.life = 1.5; s.homing = 0; text(h.x, h.y - 30, 'REFLECT', '#fff2b0'); return; }
      if (res === false && (h.inv > 0 || h.ethereal > 0)) continue;
      s.dead = true; burst(s.x, s.y, s.col || '#f8a', 6, 100, 2, 0.3); return;
    }
    for (const a of G.allies) if (a.hp > 0 && !a.orbit && hyp(a.x - s.x, a.y - s.y) < a.r + s.r) { hurtAlly(a, s.dmg); s.dead = true; return; }
  }
}
function updateBoomer(s, dt) { // returning missiles (shield throw, hatchets)
  const b = s.boomer, owner = s.owner;
  if (b.phase === 'out') {
    if (b.seek) { // ricochet to next target
      if (!b.tgt || !ALIVE(b.tgt)) { b.tgt = null; let bd = b.hop || 260; for (const f of G.foes) if (ALIVE(f) && !s.hit.has(f) && f.charm <= 0 && f.type !== 'reaper') { const d = hyp(f.x - s.x, f.y - s.y); if (d < bd && los(s.x, s.y, f.x, f.y)) { bd = d; b.tgt = f; } } }
      if (b.tgt) { const a = Math.atan2(b.tgt.y - s.y, b.tgt.x - s.x); s.vx = Math.cos(a) * b.spd; s.vy = Math.sin(a) * b.spd; }
      else if (b.hits > 0) b.phase = 'back';
    }
    s.x += s.vx * dt; s.y += s.vy * dt; b.dist += b.spd * dt;
    if (shotSolid(s.x, s.y)) { s.x -= s.vx * dt; s.y -= s.vy * dt; b.phase = 'back'; Snd.play('clank'); }
    if (b.dist > b.range || b.hits >= b.maxHits) b.phase = 'back';
  } else {
    const a = Math.atan2(owner.y - s.y, owner.x - s.x); s.vx = Math.cos(a) * b.spd * 1.15; s.vy = Math.sin(a) * b.spd * 1.15;
    s.x += s.vx * dt; s.y += s.vy * dt;
    if (hyp(owner.x - s.x, owner.y - s.y) < 20 || s.t > 6) { s.dead = true; b.onReturn && b.onReturn(); return; }
    if (b.resetOnReturn && !b.reset) { b.reset = true; s.hit = new Set(); }
  }
  for (const f of G.foes) {
    if (!ALIVE(f) || s.hit.has(f) || f.charm > 0 || hyp(f.x - s.x, f.y - s.y) > f.r + s.r) continue;
    s.hit.add(f); b.hits++;
    const a = Math.atan2(s.vy, s.vx);
    hitFoe(f, s.dmg, { x: s.x, y: s.y, kx: Math.cos(a) * 180, ky: Math.sin(a) * 180, stagger: Math.max(0.35, (s.fx && s.fx.stagger) || 0), tier: s.tier, lethal: s.lethal, src: owner, hitstop: 0.03, sigKill: s.sig, shot: s.kind });
    if (b.seek) b.tgt = null;
  }
  for (const sp of G.spawners) if (sp.hp > 0 && !s.hit.has(sp) && hyp(sp.x - s.x, sp.y - s.y) < sp.r + s.r) { s.hit.add(sp); if (!s.noSpawner) hitSpawner(sp, s.dmg, owner, { tier: s.tier, spawnerHits: s.spawnerHits }); else { s.dead = true; text(sp.x, sp.y - 20, 'no effect', '#aaa'); } b.hits++; }   // Isaac's rapid shots glance off spawners
  for (const it of G.pickups) if (!it.dead && (it.kind === 'ration' || it.kind === 'feast' || it.kind === 'potion') && hyp(it.x - s.x, it.y - s.y) < 10 + s.r) smashFood(it, owner);   // the bouncing shield wrecks food too
  for (const p of G.props) if (p.hp > 0 && p.kind !== 'legend' && hyp(p.x - s.x, p.y - s.y) < p.r + s.r) hitProp(p, 1, { src: owner });
}

// ---------------------------------------------------------------- hazards / zones
function updateHazards(dt) {
  for (const hz of G.hazards) {
    hz.t += dt;
    switch (hz.kind) {
      case 'mine': {
        if (hz.done) break;
        if (G.foes.some(f => ALIVE(f) && !f.fly && f.charm <= 0 && hyp(f.x - hz.x, f.y - hz.y) < MTR + f.r)) { hz.done = true; hz.life = 0;
          explode(hz.x, hz.y, MTR * 1.5, heroDmg(hz.owner, DMG.medium), { src: hz.owner, col: '#ffe95a', tier: 2, sound: 'zap' });
          G.hazards.push({ kind: 'root', x: hz.x, y: hz.y, r: 80, life: 3, t: 0, dps: 0, owner: hz.owner }); }
        break;
      }
      case 'tele': case 'bomb':
        if (hz.follow) { hz.x = hz.follow.x; hz.y = hz.follow.y; }
        if (hz.t >= hz.delay && !hz.done) { hz.done = true; if (!hz.visualOnly && hz.onFire) hz.onFire(hz); }
        break;
      case 'consecrate': case 'aegis': case 'dread': {   // paladin ground, Shieldwall field, Dread Mist
        hz.tick -= dt; const tick = hz.tick <= 0; if (tick) hz.tick = hz.kind === 'consecrate' ? SPEC.paladin.consTick : 0.5; const own = hz.owner;
        if (hz.kind === 'aegis') { for (const s of G.shots) if (s.team === 'foe' && !s.dead && hyp(s.x - hz.x, s.y - hz.y) < hz.r) { s.dead = true; hz.blocked = (hz.blocked || 0) + 1; burst(s.x, s.y, '#fff2a0', 4, 80, 2, 0.3); }
          for (const f of G.foes) { if (!ALIVE(f) || f.boss || f.type === 'reaper') continue; const d = hyp(f.x - hz.x, f.y - hz.y), push = hz.r + f.r + 2 - d; if (push > 0) { const a = Math.atan2(f.y - hz.y, f.x - hz.x); moveEnt(f, Math.cos(a) * push, Math.sin(a) * push, f.fly); hz.pushed = (hz.pushed || 0) + 1; } } }
        if (!tick) break; hz.ticks = (hz.ticks || 0) + 1;
        if (hz.kind !== 'dread') for (const o of G.heroes) if (!o.dead && hyp(o.x - hz.x, o.y - hz.y) < hz.r) healHero(o, (hz.kind === 'consecrate' ? SPEC.paladin.consHeal : SPEC.talisman.aegisHeal) / HP_SCALE);
        if (hz.kind === 'consecrate') { hz.hits = (hz.hits || 0) + areaHit(hz.x, hz.y, hz.r, heroDmg(own, DMG.light), { src: own, tier: 1, quiet: true, light: true, knock: 0, stagger: 0.05 }); }
        if (hz.kind === 'dread') for (const f of G.foes) { if (!ALIVE(f) || f.boss || f.type === 'reaper' || hyp(f.x - hz.x, f.y - hz.y) > hz.r + f.r) continue; f.fearT = Math.max(f.fearT || 0, SPEC.talisman.dreadFear); f.aiFreeze = 0; f.fearX = hz.x; f.fearY = hz.y; if (hitFoe(f, heroDmg(own, SPEC.talisman.dreadDps * 0.5), { quiet: true, src: own, tier: 1, knock: 0, stagger: 0 })) hz.dotHits = (hz.dotHits || 0) + 1; }
        break;
      }
      case 'fire': case 'frost': case 'root': case 'smoke': case 'ward': case 'bubble': case 'whirl': case 'hunger': case 'gloom': case 'miasma': {
        if (hz.follow) { if (hz.follow.dead) hz.t = hz.life; hz.x = hz.follow.x; hz.y = hz.follow.y; }
        hz.tick = (hz.tick || 0) - dt;
        const tick = hz.tick <= 0; if (tick) hz.tick = 0.25;
        if (hz.team === 'foe') { if (tick) for (const h of G.heroes) if (!h.dead && hyp(h.x - hz.x, h.y - hz.y) < hz.r + h.r * 0.5) hurtHero(h, hz.dps * 0.25, {}); break; }
        for (const f of G.foes) {
          if (!ALIVE(f) || f.charm > 0) continue;
          const d = hyp(f.x - hz.x, f.y - hz.y); if (d > hz.r + f.r) continue;
          if (hz.cap) { if (!hz.caught.has(f)) { if (hz.caught.size >= hz.cap) continue; hz.caught.add(f); } }   // slow orb: first 30 foes in, the rest move freely
          if (hz.kind === 'frost' || hz.kind === 'smoke' || hz.kind === 'gloom') { f.slowT = Math.max(f.slowT, 0.3); f.slowM = Math.min(f.slowM, hz.kind === 'frost' ? 0.35 : 0.6); }
          if (hz.kind === 'root' && !f.boss) f.root = Math.max(f.root, 0.3);
          if (hz.kind === 'ward' && SKELETAL(f) && hz.owner) { killFoe(f, hz.owner, { tag: 'storm' }); continue; }   // Storm Barrier shatters skeletons on contact
          if (hz.kind === 'ward' || hz.kind === 'bubble') { if (f.boss || f.type === 'reaper') continue; const a = Math.atan2(f.y - hz.y, f.x - hz.x); const push = hz.r + f.r + 2 - d; if (push > 0) { moveEnt(f, Math.cos(a) * push, Math.sin(a) * push, f.fly); if (hz.kind === 'ward' && tick) hitFoe(f, 5, { x: hz.x, y: hz.y, knock: 260, stagger: 0.5, src: hz.owner }); } }
          if (hz.kind === 'gloom' && hz.pull && !f.boss && d > 12) { const a = Math.atan2(hz.y - f.y, hz.x - f.x); moveEnt(f, Math.cos(a) * 60 * hz.pull * dt, Math.sin(a) * 60 * hz.pull * dt, f.fly); }
          if (hz.kind === 'whirl' && !f.boss) { f.stag = Math.max(f.stag, 0.4); const a = Math.atan2(f.y - hz.y, f.x - hz.x) + 1.4; f.kx += Math.cos(a) * 30; f.ky += Math.sin(a) * 30; }
          if (hz.kind === 'hunger' && tick) { const got = hz.dps * 0.25; f.slowT = Math.max(f.slowT, 0.4); f.slowM = 0.5; if (hitFoe(f, got, { quiet: true, src: hz.owner })) { for (const h of G.heroes) if (!h.dead) healHero(h, got * 0.35 / G.heroes.length); G.beams.push({ x1: f.x, y1: f.y, x2: hz.x, y2: hz.y, col: '#7ff5d0', life: 0.2, w: 2 }); } }
          if (hz.dps && tick && hz.kind !== 'hunger') hitFoe(f, hz.dps * 0.25, { quiet: true, src: hz.owner, burn: hz.kind === 'fire' ? 4 : 0 });
        }
        if (hz.kind === 'smoke') for (const h of G.heroes) if (!h.dead && hyp(h.x - hz.x, h.y - hz.y) < hz.r) h.invisT = Math.max(h.invisT, 0.3);
        if (hz.kind === 'bubble') for (const s of G.shots) if (s.team === 'foe' && hyp(s.x - hz.x, s.y - hz.y) < hz.r) s.dead = true;
        break;
      }
    }
  }
  G.hazards = G.hazards.filter(hz => hz.kind === 'tele' || hz.kind === 'bomb' ? !hz.done : hz.t < hz.life);
  // spike traps cycle every 2.4s
  const up = (G.time % 2.4) > 1.7;
  if (up !== G.spikesUp) { G.spikesUp = up; if (up && G.heroes.some(h => !h.dead && nearSpikes(h))) Snd.play('spikes'); }
  if (up) {
    for (const h of G.heroes) if (!h.dead && tileAt(Math.floor(h.x / T), Math.floor(h.y / T)) === TL.SPIKE && (h.spikeT || 0) <= G.time) { h.spikeT = G.time + 0.7; hurtHero(h, TRAP_DMG(trapBand()), { cause: 'spike', raw: true }); }
    for (const f of G.foes) if (ALIVE(f) && !f.fly && !f.boss && tileAt(Math.floor(f.x / T), Math.floor(f.y / T)) === TL.SPIKE && (f.spikeT || 0) <= G.time) { f.spikeT = G.time + 0.7; hitFoe(f, 14, { quiet: false }); }
  }
}
function nearSpikes(h) { for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (tileAt(Math.floor(h.x / T) + dx, Math.floor(h.y / T) + dy) === TL.SPIKE) return true; return false; }

// ---------------------------------------------------------------- allies (skeletons, gargoyle, illusions, sprites, shades)
const ALLY = {
  warrior: { hp: 70, spd: 125, r: 11, dmg: 8, reach: 22, rate: 0.8, col: '#e8e0c8' },
  archer: { hp: 45, spd: 115, r: 11, dmg: 14, ranged: true, rate: 0.9, col: '#d8d0b8' },
  shade: { hp: 1, spd: 260, r: 9, dmg: 24, explode: true, life: 6, col: '#7ff5d0' },
  gargoyle: { hp: 140, spd: 130, r: 14, dmg: 12, ranged: true, rate: 1.0, fly: true, life: 20, col: '#8a8a9a' },
  illusion: { hp: 60, spd: 150, r: 12, dmg: 12, ranged: true, rate: 0.5, life: 12, col: '#bfe8ff' },
  sprite: { hp: 1, spd: 0, r: 8, dmg: 14, orbit: true, life: 12, col: '#d8ff8a' },
  // Vesper Linda's minions
  spear: { hp: 60, spd: 125, r: 11, dmg: 8, reach: 34, rate: 0.85, col: '#e8e0c8' },
  guard: { hp: 190, spd: 100, r: 13, dmg: 6, reach: 20, rate: 1.0, col: '#c8c0b0', taunt: true, armor: 0.4 },
  mage: { hp: 45, spd: 110, r: 11, dmg: 10, ranged: true, rate: 1.1, col: '#b07aff', shot: 'soulbolt' },
  wraith: { hp: 40, spd: 210, r: 10, dmg: 8, reach: 16, rate: 0.5, fly: true, life: 16, col: '#9a7aff', slow: true },
  golem: { hp: 460, spd: 92, r: 20, dmg: 26, reach: 30, rate: 1.4, col: '#e8d8c0', slam: 70, life: 45, armor: 0.3 },
};
function mkAlly(kind, x, y, owner, o = {}) {
  const d = ALLY[kind]; const a = Object.assign({ kind, d, x, y, r: d.r, hp: d.hp, maxhp: d.hp, life: d.life || 1e9, spd: d.spd, dmg: d.dmg, atkT: R(0.2, 0.6), owner, orbit: d.orbit, fa: 0, flash: 0, walk: 0, hitCd: new Map() }, o);
  G.allies.push(a); burst(x, y, d.col, 14, 120, 3, 0.6); return a;
}
function hurtAlly(a, dmg) { if (a.orbit || a.hp <= 0) return; a.hp -= dmg * (1 - (a.d.armor || 0)); a.flash = 0.1; if (a.hp <= 0) { burst(a.x, a.y, a.d.col, 16, 160, 3, 0.6); Snd.play('bones'); } }
function updateAllies(dt) {
  for (const a of G.allies) {
    if (a.hp <= 0) continue;
    a.life -= dt; a.atkT -= dt; a.flash -= dt;
    if (a.life <= 0 || (a.owner && a.owner.dead && !['warrior', 'archer', 'spear', 'guard', 'mage', 'golem'].includes(a.kind))) { a.hp = 0; burst(a.x, a.y, a.d.col, 10, 100, 2, 0.5); continue; }
    if (a.orbit) {
      a.ang = (a.ang || 0) + dt * 3.2; a.x = a.owner.x + Math.cos(a.ang) * 52; a.y = a.owner.y + Math.sin(a.ang) * 52;
      for (const f of G.foes) if (ALIVE(f) && f.charm <= 0 && hyp(f.x - a.x, f.y - a.y) < f.r + a.r && (a.hitCd.get(f) || 0) < G.time) { a.hitCd.set(f, G.time + 0.4); hitFoe(f, a.dmg, { x: a.x, y: a.y, knock: 120, src: a.owner }); }
      for (const s of G.spawners) if (s.hp > 0 && hyp(s.x - a.x, s.y - a.y) < s.r + a.r + 4 && (a.hitCd.get(s) || 0) < G.time) { a.hitCd.set(s, G.time + 0.4); hitSpawner(s, a.dmg, a); }   // orbiting sprites grind generators too
      continue;
    }
    if (a.detonate) { const dd = a.detonate; dd.t -= dt; moveEnt(a, Math.cos(dd.ang) * 260 * dt, Math.sin(dd.ang) * 260 * dt, false); a.fa = dd.ang;   // Sacrificial Detonation: rush forward, then blow up where it stands
      if (dd.t <= 0) { a.hp = 0; const own = a.owner; explode(a.x, a.y, SPEC.wpn.detonateR, own ? heroDmg(own, DMG.heavy) : DMG.heavy, { src: own, col: '#b07aff', tier: 3, sound: 'shade' }); G.lastDetonations = (G.lastDetonations || []).concat([{ x: a.x, y: a.y }]); }
      continue; }
    let tgt = null, bd = a.kind === 'shade' ? 500 : 420;
    if (a.eliteHunter) { let hp = 0; for (const f of G.foes) if (ALIVE(f) && (f.elite || f.heavy) && !f.boss && f.type !== 'reaper' && f.hp > hp) { hp = f.hp; tgt = f; } if (tgt) bd = hyp(tgt.x - a.x, tgt.y - a.y); }   // Summon Shades: ignore trash, lock onto the highest-HP elite
    if (!tgt) for (const f of G.foes) if (ALIVE(f) && f.charm <= 0 && f.type !== 'reaper' && !f.invuln) { const d = hyp(f.x - a.x, f.y - a.y); if (d < bd && (a.d.fly || los(a.x, a.y, f.x, f.y))) { bd = d; tgt = f; } }
    // David's deviation 3: pets, clones and summons attack ANY hostile in reach, spawners and generators included (nearest wins)
    if (!a.eliteHunter || !tgt) for (const s of G.spawners) if (s.hp > 0) { const d = hyp(s.x - a.x, s.y - a.y); if (d < bd && (a.d.fly || los(a.x, a.y, s.x, s.y))) { bd = d; tgt = s; } }
    const own = a.owner && !a.owner.dead ? a.owner : null;
    let dir = null, spd = a.spd * dt;
    if (tgt) {
      const ang = Math.atan2(tgt.y - a.y, tgt.x - a.x); a.fa = ang;
      if (a.d.explode) { dir = [Math.cos(ang), Math.sin(ang)]; if (bd < tgt.r + a.r + 4) { a.hp = 0; explode(a.x, a.y, 50, a.dmg * (a.owner ? a.owner.mods.dmg : 1), { team: 'hero', col: '#7ff5d0', src: a, sound: 'shade' }); continue; } }
      else if (a.d.ranged) {
        if (bd > 260) dir = [Math.cos(ang), Math.sin(ang)]; else if (bd < 120) dir = [-Math.cos(ang), -Math.sin(ang)];
        if (a.atkT <= 0 && bd < 320) { a.atkT = a.d.rate; shoot({ team: 'hero', x: a.x, y: a.y, vx: Math.cos(ang) * 520, vy: Math.sin(ang) * 520, dmg: a.dmg * (a.owner ? a.owner.mods.dmg : 1), r: 5, life: 0.8, kind: a.d.shot || (a.kind === 'gargoyle' ? 'fire' : a.kind === 'illusion' ? 'bolt' : 'arrow'), col: a.d.col, owner: a }); Snd.play('allyshot'); }
      } else {
        if (bd > a.r + tgt.r + a.d.reach * 0.7) dir = [Math.cos(ang), Math.sin(ang)];
        else if (a.atkT <= 0) { a.atkT = a.d.rate; const dm = a.dmg * (a.owner ? a.owner.mods.dmg : 1);
          if (a.d.slam) { Snd.play('slam'); addTrauma(0.15); ring(a.x + Math.cos(ang) * 20, a.y + Math.sin(ang) * 20, a.d.slam, '#b07aff', 0.3, 5); areaHit(a.x + Math.cos(ang) * 20, a.y + Math.sin(ang) * 20, a.d.slam, dm, { src: a.owner || a, team: 'hero', knock: 260, stagger: 0.6 }); }
          else { G.swings.push({ x: a.x, y: a.y, a: ang, arc: 1.4, r: a.r + a.d.reach + 8, life: 0.12, max: 0.12, col: a.kind === 'wraith' ? 'rgba(176,122,255,0.8)' : 'rgba(230,230,210,0.8)', w: 3 }); if (tgt.spawner) hitSpawner(tgt, dm, a); else { hitFoe(tgt, dm, { x: a.x, y: a.y, knock: 140, src: a }); if (a.d.slow) { tgt.slowT = 1.5; tgt.slowM = 0.5; } } Snd.play('swing'); } }
      }
    } else if (own) {
      const d = hyp(own.x - a.x, own.y - a.y); if (d > 70) { const ang = Math.atan2(own.y - a.y, own.x - a.x); dir = [Math.cos(ang), Math.sin(ang)]; a.fa = ang; }
      if (d > 700) { a.x = own.x + R(-20, 20); a.y = own.y + R(-20, 20); }
    }
    if (dir) { moveEnt(a, dir[0] * spd, dir[1] * spd, a.d.fly); a.walk += dt * 9; }
  }
  G.allies = G.allies.filter(a => a.hp > 0);
}
