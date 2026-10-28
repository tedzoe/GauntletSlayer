// Hurtboxes: every foe type and boss is hit anywhere on its drawn body. For each one: arrows aimed at the head, chest and feet hit
// (normal speed and a very fast shot, no tunnelling), a melee arc from above reaches the head, and a small blast on the head lands.
// Also reports how many of those the old ground-circle hurtbox missed.
// Head aim (David, Oct 2026: "Frost Ray hitting large enemies in the head does zero damage until I lower the aim"): every hero, every
// weapon, every attack button, every one of Zoey's 27 spells and the aimed relics is fired with the mouse at the FEET and then at the
// HEAD of every large foe and every boss, side-on and from a diagonal. Whatever lands when aimed at the feet must land when aimed at the
// head. Also: beams reach a head drawn over the wall behind it, and keyboard auto-aim points at the body centre, not the feet.
const ENV = require('./env');
const puppeteer = require('puppeteer-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await ENV.ready;
  const b = await puppeteer.launch({ executablePath: ENV.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage(); await p.setViewport({ width: 1152, height: 648 });
  const logs = []; p.on('pageerror', e => logs.push('pageerror: ' + e.message));
  await p.goto(ENV.BASE + 'index.html'); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.waitForFunction(() => Object.values(FOE_SPRITE).every(k => !SPR.foes.man.anims[k + '_idle'] || foeSprReady(k)), { timeout: 15000 }); await sleep(300);
  let pass = 0, fail = 0; const chk = (name, got, want) => { const okk = typeof want === 'function' ? want(got) : JSON.stringify(got) === JSON.stringify(want); okk ? pass++ : fail++; console.log((okk ? 'PASS ' : 'FAIL ') + name + '  ' + JSON.stringify(got).slice(0, 600)); };
  const R = await p.evaluate(() => {
    const S = __game.SEL; S.slots = [{ dev: 'kb1', idx: 0, ready: true }]; __game.startParty();
    const room = () => { const rows = []; for (let y = 0; y < 30; y++) rows.push(y === 0 || y === 29 ? '#'.repeat(60) : '#' + '.'.repeat(58) + '#');
      resetLists(); G.mode = 'campaign'; G.scale = { hp: 1, dmg: 1, spd: 1, spawn: 1 }; G.mods = {}; G.goldMul = 1; G.worldTier = 0; G.map = parseMap(rows, WORLDS[0].theme); G.map.arenaSet = new Set(); G.stats = newStats(); computeFlow(); };
    const h = () => G.heroes[0];
    const make = (kind, boss) => { room(); const x = 30 * T, y = 16 * T; let f; if (boss) { f = spawnBoss(kind, x, y); f.invuln = false; f.state = f.kind === 'rootmaw' ? 'surface' : f.state; G.banner = null; } else { f = mkFoe(kind, x, y, { awake: true }); }
      if (!G.foes.includes(f)) G.foes.push(f); f.fa = 0; f.hp = f.maxhp = 1e7; f.barrier = 0; f.armorUp = 0; f.charm = 0; f.sub = false; f.invis = false; if (boss) { G.spawners = G.spawners.filter(s => !s.pylon); } return f; };   // pylons shield the Sovereign by design; drop them for the test
    const hpOf = f => f.hp;
    const fire = (f, y, spd) => { const hp0 = hpOf(f); G.shots = []; shoot({ team: 'hero', x: f.x - 320, y, vx: spd, vy: 0, dmg: 10, tier: 1, r: 4, life: 2, kind: 'arrow', owner: h(), knock: 0 }); for (let i = 0; i < 60 && G.shots.length; i++) updateShots(1 / 60); return hpOf(f) < hp0; };
    const types = Object.keys(FOES).filter(k => FOES[k] && k !== 'reaper'), bosses = Object.keys(BOSSES), out = [];
    // (Death, the reaper, cannot be harmed by design, so it is left out)
    for (const [kind, boss] of [...types.map(t => [t, false]), ...bosses.map(t => [t, true])]) {
      const f = make(kind, boss); const B = hurtBox(f), H = B.b - B.t, heads = B.t + 0.1 * H, chest = B.t + 0.45 * H, feet = f.y + Math.min(4, f.r * 0.5);
      const r = { kind, boss, h: Math.round(H), w: Math.round(B.r - B.l), r: f.r };
      r.head = fire(f, heads, 900); r.chest = fire(f, chest, 900); r.feet = fire(f, feet, 900); r.fastHead = fire(f, heads, 3000); r.fastFeet = fire(f, feet, 3000);
      // melee from above: a hero just over the head swings down (short 40px arc); the old circle math measured from the feet and missed
      { const hp0 = f.hp; areaHit(f.x, B.t - 20, 40, 10, { cone: Math.PI / 2, arc: 1.4, src: h(), team: 'hero' }); r.meleeHead = f.hp < hp0; }
      { const hp0 = f.hp; areaHit(f.x + 2, heads, 6, 10, { src: h(), team: 'hero' }); r.aoeHead = f.hp < hp0; }
      r.oldHeadMiss = hyp(0, f.y - heads) > f.r + 4;   // what the previous ground circle did with the head shot
      out.push(r); }
    return out;
  });
  const bad = R.filter(r => !(r.head && r.chest && r.feet && r.fastHead && r.fastFeet && r.meleeHead && r.aoeHead));
  console.log(`${R.length} foe types + bosses; old circle missed head shots on ${R.filter(r => r.oldHeadMiss).length}`);
  console.log('sample', JSON.stringify(R.slice(0, 4)));
  chk('every foe type and boss: head, chest and feet arrows hit (also at 3000 px/s); melee arc and blast reach the head', bad.map(r => r.kind), []);
  chk('every body box is taller than wide-ish and covers more than the ground circle', R.filter(r => !(r.h >= 2 * r.r)).map(r => [r.kind, r.h, r.r]), []);

  // ---------------------------------------------------------------- head aim, every attack path
  const A = await p.evaluate(() => {
    const saved = Input.read; let ctl = { btn: null, frame: 0, hold: 0, aim: null };
    Input.read = dev => { const r = saved.call(Input, dev); if (dev !== 'kb1') return r; r.aim = 'mouse'; r.mx = 0; r.my = 0; r.down = {}; r.pressed = {};
      if (ctl.aim) { const z = camZ(); Input.mouse.x = (ctl.aim.x - G.cam.x) * z; Input.mouse.y = (ctl.aim.y - G.cam.y) * z; Input.mouse.lastMove = performance.now(); }
      if (ctl.btn) { r.down[ctl.btn] = ctl.frame < ctl.hold; r.pressed[ctl.btn] = ctl.frame === 0; } return r; };
    const room = wallRow => { const rows = []; for (let y = 0; y < 34; y++) rows.push(y === 0 || y === 33 || y === wallRow ? '#'.repeat(64) : '#' + '.'.repeat(62) + '#');
      resetLists(); G.mode = 'campaign'; G.scale = { hp: 1, dmg: 1, spd: 1, spawn: 1 }; G.mods = {}; G.goldMul = 1; G.worldTier = 0; G.map = parseMap(rows, WORLDS[0].theme); G.map.arenaSet = new Set(); G.stats = newStats(); G.exitOpen = false; G.gimmick = null; G.banner = null; computeFlow(); };
    const big = Object.keys(FOES).filter(k => k !== 'reaper' && k !== 'totem' && (FOES[k].heavy || FOES[k].elite || FOES[k].r >= 16)), bosses = Object.keys(BOSSES);
    const pin = (f, x, y) => { f.x = x; f.y = y; f.kx = f.ky = 0; f.spd = 0;   /* no AI drift inside a tick: a hit's knockback nudge or a step toward the hero used to move the body between the trigger check and the next pin, so proximity triggers (Sparks Trap) flaked */ f.atkT = 99; f.invuln = false; f.barrier = 0; f.armorUp = 0; f.sub = false; f.invis = false; f.charm = 0; f.dying = 0; if (f.boss) { if (f.kind === 'rootmaw') f.state = 'surface'; f.st = 9; f.act = null; } else f.state = 'move'; };
    const trial = (id, wid, act, kind, boss, pos, aimAt, gap, wallRow) => {
      SAVE.loadout[id].weapon = wid; const S = __game.SEL; S.slots = [{ dev: 'kb1', idx: HEROES.findIndex(x => x.id === id), ready: true }]; __game.startParty();
      room(wallRow); G.hitstop = 0; const h = G.heroes[0]; h.inv = 1e9; h.hp = h.maxHp = 1e6; h.souls = 999; h.potions = 9; h.shardMeter = 100;
      if (act.spell) h.spell = act.spell.slice(); if (act.relic) h.relic = { id: act.relic, rank: act.rank };
      const x0 = 32 * T, y0 = wallRow ? (wallRow + 1) * T + 18 : 17 * T; let f;
      if (boss) { f = spawnBoss(kind, x0, y0); G.banner = null; G.spawners = []; } else f = mkFoe(kind, x0, y0, { awake: true });
      if (!G.foes.includes(f)) G.foes.push(f); f.hp = f.maxhp = 1e8; f.fa = 0; pin(f, x0, y0); const B = hurtBox(f);
      if (pos === 'side') { h.x = B.l - gap - h.r; h.y = y0; } else { const k = gap + h.r + 12; h.x = B.l - k * 0.75; h.y = B.b + k * 0.75; }
      ctl = { btn: act.btn, frame: 0, hold: act.hold, aim: aimAt === 'head' ? { x: (B.l + B.r) / 2, y: B.t + 0.12 * (B.b - B.t) } : { x: f.x, y: f.y - 2 } }; updateCamera(true);
      const ps = window.potionShock; if (act.relic) window.potionShock = () => {};   // a relic paid with a potion also knocks foes back: keep it out of the measurement
      let dmg = 0, fx = false;
      for (let i = 0; i < act.frames; i++) { menuGuard = 0; const hp0 = f.hp; h.hp = h.maxHp; __game.tick(); ctl.frame++; if (f.hp < hp0) dmg += hp0 - f.hp; if (f.stag > 0 || f.frz > 0 || f.slowT > 0 || f.charm > 0) fx = true;
        if (!ALIVE(f)) { f.dead = false; f.hp = 1e8; if (!G.foes.includes(f)) G.foes.push(f); } pin(f, x0, y0); if (__game.scene !== 'game') __game.scene = 'game'; if ((dmg > 0 || (act.fx && fx)) && i > 20) break; }
      window.potionShock = ps; ctl = { btn: null, frame: 0, hold: 0, aim: null };
      return act.fx ? fx : dmg > 0;
    };
    const acts = (id, wid) => { const L = [];
      if (id === 'mirelle') { for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) L.push({ name: 'spell ' + spellOf(Object.assign({}, { weapon: wid, schools: WEAPONS.mirelle.find(w => w.id === wid).schools, spell: [a, b] })).name, btn: 'primary', hold: 70, frames: 90, spell: [a, b] }); }
      else { L.push({ name: 'primary', btn: 'primary', hold: 40, frames: 80 }, { name: 'secondary', btn: 'secondary', hold: 3, frames: 90 }, { name: 'ability', btn: 'ability', hold: 3, frames: 100 }); if (id === 'sela' || id === 'paladin' || id === 'brannoc') L.push({ name: 'defend', btn: 'defend', hold: 30, frames: 60 }); }
      if (id === 'paladin' && wid === 'base') for (const rid of ['feather', 'hoar', 'squall', 'idol', 'rift', 'lyre']) for (const rank of [1, 3]) L.push({ name: 'relic ' + rid + ' ' + rank, btn: 'relic', hold: 3, frames: rid === 'rift' ? 200 : 110, relic: rid, rank, fx: ['feather', 'hoar', 'lyre'].includes(rid) });
      return L; };
    const out = { fails: [], pairs: 0, actions: 0, unaimed: [] };
    for (const hd of HEROES) for (const w of WEAPONS[hd.id]) for (const act of acts(hd.id, w.id)) { out.actions++;
      for (const pos of ['side', 'diag']) {
        const gaps = [6, 40, 90, 150, 230].filter(g => trial(hd.id, w.id, act, 'hulk', false, pos, 'feet', g)); if (!gaps.length) { out.unaimed.push(hd.id + ' ' + w.id + ' ' + act.name + ' ' + pos); continue; }   // no damage at any range (blocks, buffs, mines)
        const g = gaps[Math.floor((gaps.length - 1) / 2)];
        for (const [kind, boss] of [...big.map(k => [k, false]), ...bosses.map(k => [k, true])]) {
          let feet = false; for (let k = 0; k < 2 && !feet; k++) feet = trial(hd.id, w.id, act, kind, boss, pos, 'feet', g); if (!feet) continue;   // out of this attack's reach for that body
          out.pairs++; let head = false; for (let k = 0; k < 3 && !head; k++) head = trial(hd.id, w.id, act, kind, boss, pos, 'head', g);   // retries absorb random procs
          if (!head) out.fails.push([hd.id, w.id, act.name, pos, g, kind].join(' ')); } } }
    // beams on a foe standing just under a wall, its head drawn over the wall: Frost Ray and Radiant Lance, side-on, aimed at the head
    out.wall = [];
    for (const kind of ['hulk', 'igolem', 'ravager', 'broodmother']) {
      const fr = trial('mirelle', 'base', { btn: 'primary', hold: 70, frames: 90, spell: (() => { const sc = WEAPONS.mirelle.find(w => w.id === 'base').schools; return [sc.indexOf('rime'), 1]; })() }, kind, false, 'side', 'head', 90, 12);
      const ln = trial('paladin', 'lance', { btn: 'ability', hold: 3, frames: 60 }, kind, false, 'side', 'head', 90, 12);
      out.wall.push([kind, fr, ln]); }
    // keyboard auto-aim: a facing that points at the head (well off the feet) still locks onto the foe, and turns the hero to the middle
    // of its body as it stands (the old assist only looked at the feet and ignored a foe aimed at by its head)
    { SAVE.loadout.kestrel.weapon = 'base'; const S = __game.SEL; S.slots = [{ dev: 'kb1', idx: HEROES.findIndex(x => x.id === 'kestrel'), ready: true }]; __game.startParty(); room(); const h = G.heroes[0];
      const f = mkFoe('hulk', h.x + 70, h.y, { awake: true }); f.spd = 0; f.atkT = 99; const B = hurtBox(f), head = Math.atan2(B.t + 0.12 * (B.b - B.t) - h.y, (B.l + B.r) / 2 - h.x);
      out.autoAim = { facing: +head.toFixed(3), offFeet: +Math.abs(head).toFixed(3), got: +autoAim(h, head).toFixed(3), body: +Math.atan2(f.y - h.y, (B.l + B.r) / 2 - h.x).toFixed(3) }; }
    Input.read = saved; return out;
  });
  console.log(`head aim: ${A.actions} attacks, ${A.pairs} foe/boss pairs that land at the feet; no-damage attacks skipped: ${A.unaimed.length}`);
  chk('every attack that lands aimed at the feet of a large foe or boss also lands aimed at its head', A.fails, []);
  chk('Frost Ray and Radiant Lance reach a head drawn over the wall behind it', A.wall.filter(w => !(w[1] && w[2])), []);
  chk('keyboard auto-aim locks onto a foe aimed at by its head and turns to the middle of its body', A.autoAim, a => a.offFeet > 0.6 && Math.abs(a.got - a.body) < 0.02);
  chk('no page errors', logs, []);
  console.log(`\nhitboxtest: ${pass} passed, ${fail} failed`); await b.close(); process.exit(fail ? 1 : 0);
})();
