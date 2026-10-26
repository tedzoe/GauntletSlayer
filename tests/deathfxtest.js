// Enemy death effects (David, Oct 2026: "the death effects go off too soon, and it should not destroy food or potions it drops").
// A Bloated Mummy's burst, a Glacier Golem's freezing shatter and a Blightwrapped's poison pool wait DEATH_FX.delay (0.6-1.0 s) with a
// swelling, flashing corpse and a ring showing the reach before they go off; an Ember Thrall's fuse is as long and shows its ring.
// Nothing destroys dropped loot: food, potions, keys, gold and shards that dropped from foes, pots, chests or a boss survive death
// blasts, explosions, barrels, melee swings, arrows, thrown shields and Extreme Prejudice. Placed pots still break, and food placed in
// the level can still be shot (the old rule).
const ENV = require('./env');
const puppeteer = require('puppeteer-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await ENV.ready;
  const b = await puppeteer.launch({ executablePath: ENV.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage(); await p.setViewport({ width: 1152, height: 648 });
  const logs = []; p.on('pageerror', e => logs.push('pageerror: ' + e.message));
  await p.goto(ENV.BASE + 'index.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await sleep(800);
  let pass = 0, fail = 0; const chk = (name, got, want) => { const okk = typeof want === 'function' ? want(got) : JSON.stringify(got) === JSON.stringify(want); okk ? pass++ : fail++; console.log((okk ? 'PASS ' : 'FAIL ') + name + '  ' + JSON.stringify(got).slice(0, 700)); };
  const R = await p.evaluate(() => {
    const saved = Input.read; let hold = null, frame = 0;
    Input.read = dev => { const r = saved.call(Input, dev); if (dev !== 'kb1') return r; r.mx = 0; r.my = 0; r.aim = false; r.down = {}; r.pressed = {}; if (hold) { r.down[hold] = true; r.pressed[hold] = frame % 12 === 0; } return r; };
    const setup = id => { const S = __game.SEL; S.slots = [{ dev: 'kb1', idx: HEROES.findIndex(h => h.id === id), ready: true }]; __game.startParty();
      const rows = []; for (let y = 0; y < 24; y++) rows.push(y === 0 || y === 23 ? '#'.repeat(44) : '#' + '.'.repeat(42) + '#');
      resetLists(); G.mode = 'campaign'; G.scale = { hp: 1, dmg: 1, spd: 1, spawn: 1 }; G.mods = {}; G.goldMul = 1; G.worldTier = 0; G.map = parseMap(rows, WORLDS[0].theme); G.map.arenaSet = new Set(); renderMapCanvas(); computeFlow(); G.exitOpen = false; G.stats = newStats();
      const h = G.heroes[0]; h.x = 10 * T; h.y = 12 * T; h.fa = 0; h.cd = {}; h.inv = 0; h.hp = h.maxHp = 1e5; updateCamera(true); return h; };
    const run = s => { for (let i = 0; i < Math.round(s * 60); i++) { menuGuard = 0; frame++; __game.tick(); if (__game.scene !== 'game') __game.scene = 'game'; } };
    const loot = (x, y) => { const L = [{ kind: 'ration', x: x + 10, y }, { kind: 'potion', x: x - 10, y }, { kind: 'feast', x, y: y + 10 }, { kind: 'key', x, y: y - 10 }, { kind: 'shard', x: x + 14, y: y + 14 }]; for (const it of L) { it.dropped = true; G.pickups.push(it); } dropGold(x, y, 30); return G.pickups.slice(-6); };
    const smashed = new Set(); const sf = window.smashFood; window.smashFood = function (it) { const r = sf.apply(this, arguments); if (it.dead) smashed.add(it); return r; };
    const alive = L => L.filter(it => !smashed.has(it)).map(it => it.kind);   // destroyed, not picked up
    const out = {};
    // 1. Bloated Mummy: killed next to the hero, the burst waits, swells, then goes off and still hurts whoever stayed
    { const h = setup('kestrel'); const f = mkFoe('bloater', h.x + 40, h.y, { awake: true }); f.atkT = 99; const hp0 = h.hp; killFoe(f, h);
      const hz = G.hazards.find(z => z.deathFx); const L = loot(f.x, f.y);
      run(0.5); const early = hp0 - h.hp; run(0.5); out.bloater = { telegraph: !!hz, delay: hz && hz.delay, swell: !!(hz && hz.swell), ring: hz && hz.r, hurtBy05: early, hurtBy10: hp0 - h.hp, lootLeft: alive(L) }; }
    // 2. Glacier Golem: no freeze on the death frame, freezes after the swell if the hero stays inside
    { const h = setup('kestrel'); const f = mkFoe('igolem', h.x + 50, h.y, { awake: true }); killFoe(f, h); run(0.3); const early = h.frz || 0; run(0.7); out.golem = { frozenEarly: early > 0, frozenLate: (h.frz || 0) > 0 }; }
    // 3. Blightwrapped: the pool appears after the swell
    { const h = setup('kestrel'); const f = mkFoe('blight', h.x + 60, h.y, { awake: true }); killFoe(f, h); const at0 = G.hazards.some(z => z.kind === 'miasma'); run(1.0); out.blight = { poolAtDeath: at0, poolLater: G.hazards.some(z => z.kind === 'miasma') }; }
    // 4. Ember Thrall fuse: long enough to read, with its ring
    { const h = setup('kestrel'); h.inv = 1e9; const f = mkFoe('firebrand', h.x + 60, h.y, { awake: true }); f.atkT = 0; let t = 0, lit = -1, ring = false; for (; t < 4 && !f.dead; t += 1 / 60) { run(1 / 60); if (f.state === 'windup' && lit < 0) { lit = t; ring = G.hazards.some(z => z.follow === f && z.swell); } }
      out.fuse = { fuse: lit >= 0 ? +(t - lit).toFixed(2) : -1, ring }; }
    // 5. a Bloated Mummy bursting on an elite's dropped food and potion: everything stays
    { const h = setup('kestrel'); const rnd = Math.random; Math.random = () => 0.01; const e = mkFoe('hulk', h.x + 90, h.y, { awake: true }); killFoe(e, h); Math.random = rnd;
      const drops = G.pickups.filter(it => it.kind === 'ration' || it.kind === 'potion' || it.kind === 'shard'); const f = mkFoe('bloater', e.x + 6, e.y, { awake: true }); killFoe(f, h); run(1.2);
      out.eliteDrops = { dropped: drops.map(it => it.kind + (it.dropped ? '' : '(unflagged)')), left: alive(drops) }; }
    // 6. hero attacks over dropped loot: Theo's swings, Isaac's arrows, Gela's thrown shield, a barrel blast, Extreme Prejudice
    const attack = (id, btn, secs, potAt = 75) => { const h = setup(id); h.inv = 1e9; const L = loot(h.x + 45, h.y); const P = mkProp('urn', h.x + potAt, h.y); hold = btn; frame = 0; run(secs); hold = null; return { left: alive(L).length, of: L.length, pot: P.hp <= 0 }; };
    out.theo = attack('brannoc', 'primary', 1.5, 50); out.isaac = attack('kestrel', 'primary', 1.5);
    SAVE.loadout.sela.weapon = 'splitter'; out.gelaThrow = attack('sela', 'ability', 1.5); SAVE.loadout.sela.weapon = 'base'; out.prejudice = attack('sela', 'ability', 0.8); out.prejudice.pot = true;   // the sweep has no damage: nothing for a pot
    { const h = setup('kestrel'); const L = loot(h.x + 120, h.y); const bar = mkProp('barrel', h.x + 120, h.y + 20); hitProp(bar, 99, { src: h }); run(0.6); out.barrel = { left: alive(L).length, of: L.length }; }
    { const h = setup('kestrel'); const L = loot(h.x + 120, h.y); explode(h.x + 120, h.y, 90, 50, { team: 'all', src: h }); out.explosion = { left: alive(L).length, of: L.length }; }
    // 7. food placed in the level (not dropped) can still be shot, as before
    { const h = setup('kestrel'); const it = { kind: 'ration', x: h.x + 80, y: h.y }; G.pickups.push(it); hold = 'primary'; frame = 0; run(1.0); hold = null; out.placedFood = { destroyed: !!it.dead }; }
    Input.read = saved; return out;
  });
  const D = await p.evaluate(() => DEATH_FX);
  chk('Bloated Mummy: the burst is telegraphed (swelling corpse + reach ring) and waits 0.6-1.0 s', R.bloater, r => r.telegraph && r.swell && r.ring >= 60 && r.delay >= 0.6 && r.delay <= 1.0);
  chk('Bloated Mummy: nothing hits the hero in the first half second; the burst still lands after the swell', [R.bloater.hurtBy05, R.bloater.hurtBy10 > 0], [0, true]);
  chk('Bloated Mummy: its burst leaves dropped food, potions, keys, gold and shards alone', R.bloater.lootLeft.sort(), ['feast', 'gold', 'key', 'potion', 'ration', 'shard']);
  chk('Glacier Golem: no freeze on the death frame, the shatter freezes after the swell', R.golem, { frozenEarly: false, frozenLate: true });
  chk('Blightwrapped: the poison pool rises after the swell', R.blight, { poolAtDeath: false, poolLater: true });
  chk('Ember Thrall: its fuse burns about as long, with its reach ring', R.fuse, f => f.ring && f.fuse >= D.fuse - 0.05 && f.fuse <= 1.0);
  chk("an elite's food, potion and shard drops are flagged as loot and survive a burst on top of them", R.eliteDrops, e => e.dropped.length > 0 && e.dropped.every(k => !k.includes('unflagged')) && e.left.length === e.dropped.length);
  for (const k of ['theo', 'isaac', 'gelaThrow', 'prejudice']) chk(`${k}: attacking over dropped loot destroys none of it (a placed pot still breaks)`, R[k], r => r.left === r.of && r.pot);
  chk('a barrel blast and a hero explosion destroy no dropped loot', [R.barrel, R.explosion], x => x.every(r => r.left === r.of));
  chk('food placed in the level can still be shot (old rule kept)', R.placedFood, { destroyed: true });
  chk('no page errors', logs, []);
  console.log(`\ndeathfxtest: ${pass} passed, ${fail} failed`); await b.close(); process.exit(fail ? 1 : 0);
})();
