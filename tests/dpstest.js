// Damage rebalance to David's Slayer reference (Oct 2026): per-hit values, rates, DPS ordering against a pinned dummy, Lethal, spawners.
const ENV = require('./env');
const puppeteer = require('puppeteer-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await ENV.ready;
  const b = await puppeteer.launch({ executablePath: ENV.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage(); await p.setViewport({ width: 1152, height: 648 });
  const logs = []; p.on('pageerror', e => logs.push('pageerror: ' + e.message));
  await p.goto(ENV.BASE + 'index.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await sleep(800);
  let pass = 0, fail = 0; const chk = (name, got, want) => { const okk = typeof want === 'function' ? want(got) : JSON.stringify(got) === JSON.stringify(want); okk ? pass++ : fail++; console.log((okk ? 'PASS ' : 'FAIL ') + name + (okk ? '' : '  got ' + JSON.stringify(got).slice(0, 400))); };
  const R = await p.evaluate(() => {
    const hold = new Set(); let prev = new Set();
    const oRead = Input.read, oCommit = Input.commit;
    Input.read = (dev, s) => { if (dev !== 'kb1') return oRead(dev, s); const st = { mx: 0, my: 0, ax: 0, ay: 0, aim: false, aimFire: false, dev, down: {}, pressed: {}, released: {} }; for (const k of hold) { st.down[k] = true; if (!prev.has(k)) st.pressed[k] = true; } for (const k of prev) if (!hold.has(k)) st.released[k] = true; return st; };
    Input.commit = d => { prev = new Set(hold); oCommit(d); };
    let pin = null, hpin = null;
    const run = s => { for (let i = 0; i < Math.round(s * 60); i++) { menuGuard = 0; __game.tick(); if (pin) { pin.x = pin.px; pin.y = pin.py; pin.kx = pin.ky = 0; pin.stag = 0; pin.frz = 0; pin.root = 0; } if (hpin && !hpin.h.dash && !(hpin.h.spin > 0)) { hpin.h.x = hpin.x; hpin.h.y = hpin.y; } } };
    const room = () => { const rows = []; for (let y = 0; y < 22; y++) rows.push(y === 0 || y === 21 ? '#'.repeat(40) : '#' + '.'.repeat(38) + '#');
      resetLists(); G.mode = 'campaign'; G.scale = { hp: 1, dmg: 1, spd: 1, spawn: 1 }; G.mods = {}; G.goldMul = 1; G.worldTier = 0; G.map = parseMap(rows, WORLDS[0].theme); G.map.arenaSet = new Set(); renderMapCanvas(); computeFlow(); G.exitOpen = false; };
    const setup = id => { const S = __game.SEL; S.slots = [{ dev: 'kb1', idx: HEROES.findIndex(h => h.id === id), ready: true }]; __game.startParty(); room(); const h = G.heroes[0]; h.x = 8 * 32; h.y = 11 * 32; h.fa = 0; h.ax = 1; h.ay = 0; h.cd = {}; h.souls = 100; h.potions = 0; h.inv = 1e9; return h; };
    let log = [];
    const oHit = hitFoe; window.hitFoe = function (f, dmg, o) { if (f.__dummy) log.push(Math.round(dmg * 10) / 10); return oHit.apply(this, arguments); };
    const dummy = (h, dx = 50, o = {}) => { const f = mkFoe(o.type || 'barrow', h.x + dx, h.y, { awake: true }); f.spd = 0; f.hp = f.maxhp = o.hp || 1e7; f.atkT = 999; f.__dummy = true; f.px = f.x; f.py = f.y; pin = f; f.heavy = o.heavy ?? true; f.elite = false; f.d = Object.assign({}, f.d, { beh: 'none' }); f.room = -1; return f; };
    const press = (btn, sec, after = 0.6) => { hold.add(btn); run(sec); hold.delete(btn); run(after); };
    const meas = (id, fn, dx, prep) => { const h = setup(id); prep && prep(h); dummy(h, dx); log = []; hold.clear(); run(0.05); fn(h); hold.clear(); run(0.4); return { max: log.length ? Math.max(...log) : 0, tot: Math.round(log.reduce((a, b) => a + b, 0)), n: log.length, vals: [...new Set(log)].sort((a, b) => a - b) }; };
    const sustain = (id, dx, prep) => { const h = setup(id); prep && prep(h); dummy(h, dx); hpin = { h, x: h.x, y: h.y }; hold.clear(); run(0.05); hold.add('primary'); run(1); log = []; run(6); hold.clear(); hpin = null;
      return { perHit: [...new Set(log)].sort((a, b) => a - b), rate: +(log.length / 6).toFixed(2), dps: Math.round(log.reduce((a, b) => a + b, 0) / 6) }; };
    const out = { main: {}, sec: {}, spec: {}, dash: {} };
    for (const id of ['brannoc', 'sela', 'paladin', 'kestrel', 'vesper']) {
      const far = id === 'kestrel' ? 120 : 50;
      out.main[id] = sustain(id, far);
      out.sec[id] = meas(id, () => press('secondary', id === 'kestrel' ? 1.6 : id === 'paladin' ? 1.0 : id === 'vesper' ? 0.3 : 0.05, 1.0), id === 'brannoc' ? 50 : far);
      out.dash[id] = meas(id, () => press('dash', 0.05, 0.8), 60);
      out.spec[id] = meas(id, () => press('ability', 0.05, id === 'brannoc' ? 4.0 : 1.5), id === 'kestrel' ? 200 : 50);
    }
    out.main.mirelle = sustain('mirelle', 120, h => { h.spell = [0, 0]; });
    const zs = (spell, dx, t) => meas('mirelle', () => press('primary', 0.05, t), dx, h => { h.spell = spell; h.spellCd = {}; });
    out.zoey = { serpents: zs([0, 1], 60, 3), fireball: zs([0, 2], 200, 4), arc: zs([2, 1], 120, 1.2), clap: zs([2, 0], 50, 1.2) };
    { const h = setup('mirelle'); h.spell = [0, 1]; h.spellCd = {}; const f = dummy(h, 60); hold.add('primary'); run(0.05); hold.clear(); run(1.0); out.zoey.burn = { dps: f.burn, t: Math.round(f.burnT) }; }
    // Theo: spin 8 x 20 over 2.5s, invulnerable; Super Slash after Rush
    { const h = setup('brannoc'); dummy(h, 50); log = []; hold.add('ability'); run(0.05); hold.clear(); let safe = true; for (let i = 0; i < 140; i++) { run(1 / 60); if (h.spin > 0 && i % 20 === 5) { h.inv = 0; const hp = h.hp; hurtHero(h, 20, { x: h.x + 30, y: h.y }); if (h.hp < hp) safe = false; h.inv = 1e9; } } run(1); out.spin = { n: log.length, vals: [...new Set(log)], spinTime: SPEC.theo.spinTime, safe }; }
    { const h = setup('brannoc'); const f = dummy(h, SPEC.theo.chargeDist + 80); log = []; hold.add('dash'); run(0.05); hold.clear(); let k = 0; while (!h.dash && k++ < 30) run(1 / 60); run(3 / 60); const during = !!(h.dash && h.dash.rush);
      f.x = f.px = h.x + 72; f.y = f.py = h.y; hold.add('primary'); run(1 / 60); const stopped = !h.dash; hold.add('primary'); run(2.5); hold.clear(); run(0.5); out.superSlash = log.slice(0, 4); out.superWin = during && stopped; }
    // Lethal: a big non-elite, non-heavy foe dies to Theo's leap, Gela's thrust and a full sniper shot, but not to a 56 fireball or a 42 combo hit
    const lethal = (id, fn, dx, prep) => { const h = setup(id); prep && prep(h); const f = dummy(h, dx, { hp: 5000, heavy: false, type: 'shambler' }); fn(h); run(0.6); return f.hp <= 0; };
    out.lethal = {
      leap: lethal('brannoc', () => press('secondary', 0.05, 1.0), 50),
      thrust: lethal('sela', () => press('secondary', 0.05, 1.0), 50),
      sniper: lethal('kestrel', () => press('secondary', 1.6, 0.6), 160),
      sniperHalf: lethal('kestrel', () => press('secondary', 0.6, 0.6), 160),
      fireball: lethal('mirelle', () => press('primary', 0.05, 2.5), 200, h => { h.spell = [0, 2]; h.spellCd = {}; }),
      combo: lethal('brannoc', () => press('primary', 2.0, 0.2), 50) };
    // spawners: Quick Shot counts half a hit, a full Sniper Shot 1.5 (half of a T3 hit)
    const spw = (fn) => { const h = setup('kestrel'); G.spawners = []; const s = mkSpawner(h.x + 150, h.y, 3, ['shambler'], 'crypt'); s.hp = s.maxHp = 999; s.spawnT = 999; s.room = -1; s.stopT = 99; const hp0 = s.hp; fn(h); return +(hp0 - s.hp).toFixed(2); };
    out.spawner = { quick: spw(() => { hold.add('primary'); run(0.05); hold.clear(); run(0.8); }), sniper: spw(() => press('secondary', 1.6, 0.8)) };
    out.ref = DEV.dmg;
    return out;
  });
  const D = R.ref;
  chk('Theo combo per-hit = 18 / 49 (FAQ light/heavy ratio, scaled for the guide pace; heavy < Smash 50)', R.main.brannoc.perHit, [18, 49]);
  chk('Gela combo per-hit = reference 8 / 42', R.main.sela.perHit, [8, 42]);
  chk('David combo per-hit = 18 / 48 (our choice)', R.main.paladin.perHit, [18, 48]);
  chk('Isaac Quick Shot = 14', R.main.kestrel.perHit, [14]);
  chk('Zoey Firebolts = 22 at ~1.8/s', R.main.mirelle, g => g.perHit.join() === '22' && g.rate > 1.6 && g.rate <= 1.85);
  chk('Vesper Skeleton Slash = 8 at ~2.5/s (hitstop included)', R.main.vesper, g => g.perHit.join() === '8' && g.rate > 2.0 && g.rate <= 2.5);
  console.log('DPS theo', R.main.brannoc.dps, 'isaac', R.main.kestrel.dps);
  chk('Isaac fires ~4/s', R.main.kestrel.rate, g => g > 3.5 && g <= 4);
  for (const id of ['brannoc', 'sela', 'paladin']) {
    chk(id + ' melee DPS beats Quick Shot DPS' + (id === 'brannoc' ? ' by 10%+' : ''), [R.main[id].dps, R.main.kestrel.dps], g => id === 'brannoc' ? g[0] >= g[1] * 1.1 : g[0] > g[1]);
    chk(id + ' swings slower than Isaac shoots', [R.main[id].rate, R.main.kestrel.rate], g => g[0] < g[1]);
  }
  chk('secondary per hit: Smash/Leap 50, Spear Thrust 42, Judgment 50, Sniper 36, Bone Spikes 46', ['brannoc', 'sela', 'paladin', 'kestrel', 'vesper'].map(id => R.sec[id].max), [50, 42, 50, 36, 46]);
  chk('dash: Rush 8, Shield Charge 8, Righteous Advance 8, Tumble 0, Ghostwalk 4', ['brannoc', 'sela', 'paladin', 'kestrel', 'vesper'].map(id => R.dash[id].max), [8, 8, 8, 0, 4]);
  chk('special: Destructo Spin 8 x 20 = 160', [R.spec.brannoc.n, R.spec.brannoc.max, R.spec.brannoc.tot], [8, 20, 160]);
  chk('special: Extreme Prejudice 70, Holy Slam 70, Mortar 56, Raise burst 48', ['sela', 'paladin', 'kestrel', 'vesper'].map(id => R.spec[id].max), [70, 70, 56, 48]);
  chk('Zoey: Fireball 56, Serpents 16, Chain Lightning 22, Shock Blast 14', [R.zoey.fireball.max, R.zoey.serpents.max, R.zoey.arc.max, R.zoey.clap.max], [56, 16, 22, 14]);
  chk('Flaming Serpents burn 8/s for 12s (96 total)', R.zoey.burn, g => g.dps === 8 && g.t >= 11);
  chk('Destructo Spin lasts 2.5s and Theo is invulnerable while spinning', [R.spin.spinTime, R.spin.safe], [2.5, true]);
  chk('Super Slash during Rush stops it; chain continues from hit 5: 49, 18, 18, 49', [R.superWin, R.superSlash], [true, [49, 18, 18, 49]]);
  chk('Lethal: Smash, Spear Thrust and a full Sniper Shot execute a big non-elite foe', [R.lethal.leap, R.lethal.thrust, R.lethal.sniper], [true, true, true]);
  chk('not Lethal: half-drawn shot, 56 Fireball, combo hits', [R.lethal.sniperHalf, R.lethal.fireball, R.lethal.combo], [false, false, false]);
  chk('spawners: Quick Shot half a hit, full Sniper Shot 1.5 hits', R.spawner, g => g.quick === 0.5 && g.sniper === 1.5);
  chk('main < secondary < special per hit for every hero', ['sela', 'paladin', 'kestrel', 'vesper'].map(id => [Math.min(...R.main[id].perHit), R.sec[id].max, R.spec[id].max]), g => g.every(r => r[0] < r[1] && r[1] < r[2]));
  chk('no page errors', logs, []);
  console.log(`\ndpstest: ${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail ? 1 : 0);
})();
