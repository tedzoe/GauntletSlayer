const ENV = require('./env');
const puppeteer = require('puppeteer-core');
const SHOT = ENV.SHOT;
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await ENV.ready;
  const b = await puppeteer.launch({ executablePath: ENV.CHROME, headless: 'new', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage(); await p.setViewport({ width: 1152, height: 648 });
  const logs = []; p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); }); p.on('pageerror', e => logs.push('pageerror: ' + e.message));
  await p.evaluateOnNewDocument(() => {
    const mk = i => ({ index: i, id: 'Fake Pad', connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) });
    window.__pads = [];
    window.__addPad = () => { const pd = mk(window.__pads.length); window.__pads.push(pd); return pd.index; };
    window.__btn = (i, b, v) => { window.__pads[i].buttons[b] = { pressed: v, value: v ? 1 : 0 }; };
    window.__ax = (i, a) => { window.__pads[i].axes = a; };
    navigator.getGamepads = () => window.__pads;
  });
  await p.goto(ENV.BASE + 'index.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForFunction(() => ['brannoc', 'sela', 'mirelle', 'kestrel', 'paladin'].every(id => hasSprite(HERO[id])), { timeout: 5000 }); await sleep(600);
  const R = {}; const ok = (k, v) => { R[k] = v; console.log(k.padEnd(34), JSON.stringify(v)); };
  // helpers inside page
  await p.evaluate(() => {
    window.TT = {
      run(sec) { const n = Math.round(sec * 60); for (let i = 0; i < n; i++) __game.tick(); },
      setup(ids, devs) { const S = __game.SEL; S.slots = ids.map((id, i) => ({ dev: devs ? devs[i] : (i ? 'pad' + (i - 1) : 'kb1'), idx: HEROES.findIndex(h => h.id === id), ready: true })); __game.startParty(); },
      testRoom() { // flat open room for ability tests
        const rows = []; for (let y = 0; y < 22; y++) rows.push(y === 0 || y === 21 ? '#'.repeat(40) : '#' + '.'.repeat(38) + '#');
        resetLists(); G.mode = 'campaign'; G.scale = { hp: 1, dmg: 1, spd: 1, spawn: 1 }; G.mods = {}; G.goldMul = 1; G.worldTier = 0; G.map = parseMap(rows, WORLDS[0].theme); G.map.arenaSet = new Set();
        G.floorName = 'Test'; G.worldName = 'Test'; renderMapCanvas(); for (const h of G.heroes) { h.x = 8 * 32; h.y = 11 * 32; h.fa = 0; h.ax = 1; h.ay = 0; h.inv = 0; h.cd = {}; h.hp = h.maxHp; } G.stats = newStats(); updateCamera(true); computeFlow(); G.exitOpen = false;
      },
      dummies(n = 3, type = 'shambler', dx = 90) { const h = G.heroes[0]; const out = []; for (let i = 0; i < n; i++) { const f = mkFoe(type, h.x + dx + i * 14, h.y + (i - (n - 1) / 2) * 34, { awake: true }); f.spd = 0; f.hp = f.maxhp = 5000; f.atkT = 999; out.push(f); } return out; },
      seen: new Set(), dmg() { G.foes.forEach(f => { if (f.type !== 'reaper') TT.seen.add(f); }); let s = 0; for (const f of TT.seen) s += f.maxhp - Math.max(0, f.hp); return Math.round(s); },   // counts foes killed and removed since they were first seen
      heal() { for (const h of G.heroes) { h.hp = h.maxHp; } },
    };
  });

  const ev = (f, ...a) => p.evaluate(f, ...a);
  let pass = 0, fail = 0; const chk = (name, got, want) => { const okk = typeof want === 'function' ? want(got) : JSON.stringify(got) === JSON.stringify(want); okk ? pass++ : fail++; console.log((okk ? 'PASS ' : 'FAIL ') + name.padEnd(60), JSON.stringify(got), okk ? '' : ' want ' + (typeof want === 'function' ? want.toString() : JSON.stringify(want))); };
  await new Promise(r => setTimeout(r, 800));

  const X = ['fscout', 'wolf', 'ftroll', 'wisp', 'strangler', 'ghoul', 'leech', 'bogtroll', 'croaker', 'spitter', 'dmummy', 'scarab', 'sentinel', 'suncult', 'jackal', 'fskel', 'sprite', 'yeti', 'rimemage', 'igolem', 'thrall', 'assassin', 'bulwark', 'chanter', 'abyssal', 'alpha', 'hag', 'pharaohq', 'boneknight', 'succubus'];
  // ---- toggle OFF: the faithful loop is untouched
  const off = await ev(() => { SAVE.settings.extendedRealms = undefined; const r = { def: RULE('extendedRealms'), loop: ENDLESS.loop(), b19: ENDLESS.biome(19), b37: ENDLESS.biome(37), cp: [1, 19, 37, 49].map(n => ENDLESS.checkpoint(n)), w21: ENDLESS.worldFor(21).id };
    TT.setup(['paladin']); beginRun(); const seen = new Set(); let boss = false; for (const n of [1, 4, 7, 13, 19, 21, 25, 31, 43]) { startEndlessFloor(n); G.foes.forEach(f => seen.add(f.type)); if (G.boss) boss = true; }
    r.xTypes = [...seen].filter(t => XFOE_STATS[t]); r.boss = boss; return r; });
  chk('Extended Realms OFF by default; loop 18, checkpoints 1/19/37', off, { def: false, loop: 18, b19: 'crypt', b37: 'crypt', cp: [true, true, true, false], w21: 'w1', xTypes: [], boss: false });
  // ---- toggle ON
  const on = await ev(() => { SAVE.settings.extendedRealms = true; const r = { loop: ENDLESS.loop(), areas: [1, 7, 13, 19, 25, 31, 37, 43, 49].map(n => ENDLESS.biome(n)), cp: [1, 19, 37, 49, 97, 145].map(n => ENDLESS.checkpoint(n)), hunter: [24, 48].map(n => ENDLESS.hunter(n)) };
    TT.setup(['paladin']); beginRun(); r.floors = {};
    for (const n of [19, 21, 23, 27, 33, 39, 45, 47, 3, 5]) { startEndlessFloor(n); r.floors[n] = { area: ENDLESS.worldFor(n).key || ENDLESS.worldFor(n).id, boss: G.boss ? G.boss.kind : null, sealed: !G.exitOpen, mini: (G.foes.find(f => f.d.miniboss) || {}).type || null }; }
    const seen = new Set(); for (const n of [19, 20, 25, 26, 31, 32, 37, 38, 43, 44]) { startEndlessFloor(n); G.foes.forEach(f => seen.add(f.type)); G.spawners.forEach(s => s.list && s.list.forEach(t => seen.add(t))); } r.seen = [...seen].filter(t => XFOE_STATS[t]).sort(); return r; });
  chk('Extended Realms ON: 48-floor loop of 8 areas', { loop: on.loop, areas: on.areas }, { loop: 48, areas: ['crypt', 'cave', 'lava', 'forest', 'swamp', 'desert', 'frozen', 'fortress', 'crypt'] });
  chk('Extended Realms ON: checkpoints 1, 49, 97, 145 only', on.cp, [true, false, false, true, true, true]);
  chk('Extended Realms ON: Death still on every 6th floor', on.hunter, [true, true]);
  chk('Area bosses on floor 3 of each area, exit sealed', [21, 27, 33, 39, 45].map(n => [on.floors[n].boss, on.floors[n].sealed]), [['ancient', true], ['colossus', true], ['sunpharaoh', true], ['frosttitan', true], ['deathknight', true]]);
  chk('Area mini-bosses on floor 5 (Grimfang on 23, Sir Varric on 47?)', [on.floors[23].mini, on.floors[47].mini, on.floors[5].mini], ['alpha', 'succubus', 'lich']);
  chk('Faithful floors unchanged with the toggle ON (no boss on 3)', on.floors[3].boss, null);
  console.log('   extended types seen in waves:', on.seen.join(','));
  // ---- every enemy acts
  const smoke = await ev(X => { const out = {}; SAVE.settings.extendedRealms = true;
    for (const t of X) { TT.setup(['paladin']); TT.testRoom(); const h = G.heroes[0]; h.maxHp = h.hp = 1e6; const f = mkFoe(t, h.x + 160, h.y, { awake: true }); let shots = 0; const n0 = G.foes.length;
      for (let i = 0; i < 60 * 6; i++) { __game.tick(); shots += G.shots.filter(s => s.team === 'foe' && s.t < 0.02).length; h.hp = Math.max(h.hp, 1e5); h.dead = false; h.frz = 0; }
      out[t] = { name: FOES[t].name, sprite: foeSprReady(FOE_SPRITE[t]), acted: h.hp < 1e6 || shots > 0, hp: Math.round(f.maxhp) }; }
    return out; }, X);
  for (const t of X) chk(`smoke ${t} (${smoke[t].name})`, smoke[t], g => g.sprite && g.acted);
  const beh = await ev(() => { const out = {}; const room = () => { TT.setup(['paladin']); TT.testRoom(); const h = G.heroes[0]; h.maxHp = h.hp = 1e5; return h; };
    let h = room(); let f = mkFoe('ftroll', h.x + 300, h.y, { awake: true }); f.hp = f.maxhp * 0.5; const t0 = f.hp; for (let i = 0; i < 60; i++) { f.atkT = 9; __game.tick(); } out.trollRegen = f.hp > t0;
    h = room(); f = mkFoe('strangler', h.x + 200, h.y, { awake: true }); let slowed = false; for (let i = 0; i < 60 * 4; i++) { __game.tick(); h.hp = 1e5; if (h.slowT > 0) slowed = true; } out.stranglerSnares = { slowed, x0: Math.round(h.x + 200), x: Math.round(f.x), shots: G.shots.length };
    h = room(); f = mkFoe('spitter', h.x + 220, h.y, { awake: true }); let pool = false; for (let i = 0; i < 60 * 5; i++) { __game.tick(); h.hp = 1e5; if (G.hazards.some(z => z.kind === 'miasma')) pool = true; } out.spitterPool = pool;
    h = room(); f = mkFoe('bogtroll', h.x + 60, h.y, { awake: true }); killFoe(f, h); out.bogPool = G.hazards.some(z => z.kind === 'miasma');
    h = room(); f = mkFoe('sentinel', h.x + 40, h.y, { awake: true }); f.fa = Math.PI; const s0 = f.hp; hitFoe(f, 10, { x: h.x, y: h.y, src: h, tier: 1, freeze: 2 }); out.sentinel = { blocked: s0 - f.hp < 3, noFreeze: !(f.frz > 0) };
    h = room(); f = mkFoe('sprite', h.x + 100, h.y, { awake: true }); let fr = false; for (let i = 0; i < 120; i++) { __game.tick(); h.hp = 1e5; if (h.frz > 0) fr = true; } out.spriteFreezes = fr;
    h = room(); f = mkFoe('igolem', h.x + 60, h.y, { awake: true }); h.inv = 0; killFoe(f, h); out.golemShatterFreeze = h.frz > 0;
    h = room(); f = mkFoe('chanter', h.x + 250, h.y, { awake: true }); let bar = false, c0 = G.foes.length; for (let i = 0; i < 60 * 14; i++) { __game.tick(); h.hp = 1e5; h.frz = 0; if (f.barrier > 0) bar = true; } out.chanter = { barrier: bar, summoned: G.foes.filter(q => q.type === 'thrall').length };
    h = room(); f = mkFoe('croaker', h.x + 250, h.y, { awake: true }); for (let i = 0; i < 60 * 9; i++) { __game.tick(); h.hp = 1e5; } out.croakerGhouls = G.foes.filter(q => q.type === 'ghoul').length;
    h = room(); f = mkFoe('alpha', h.x + 200, h.y, { awake: true }); const wolves = new Set(); for (let i = 0; i < 60 * 10; i++) { __game.tick(); h.hp = 1e5; h.frz = 0; G.foes.forEach(q => { if (q.type === 'wolf') wolves.add(q); }); } out.alphaWolves = wolves.size; __game.draw(); out.miniBar = !!G.miniBar;
    h = room(); f = mkFoe('boneknight', h.x + 90, h.y, { awake: true }); let fz = false; for (let i = 0; i < 60 * 10; i++) { __game.tick(); h.hp = 1e5; if (h.frz > 0) fz = true; } out.knightFreezes = fz;
    return out; });
  chk('Mossback Troll regenerates', beh.trollRegen, true);
  chk('Strangleroot is rooted and snares', beh.stranglerSnares, g => g.slowed && Math.abs(g.x - g.x0) < 40);
  chk('Blight Spitter lobs poison pools', beh.spitterPool, true);
  chk('Peat Hulk rots into a poison pool', beh.bogPool, true);
  chk('Sandstone Sentinel: front block + immune to elements', beh.sentinel, { blocked: true, noFreeze: true });
  chk('Shiver Sprite freezes on touch', beh.spriteFreezes, true);
  chk('Glacier Golem shatters into a freezing burst', beh.golemShatterFreeze, true);
  chk('Doom Chanter: barrier + raises thralls', beh.chanter, g => g.barrier && g.summoned >= 2);
  chk('Mire Croaker raises ghouls', beh.croakerGhouls, g => g >= 2);
  chk('Grimfang calls wolves; mini-boss bar shows', [beh.alphaWolves >= 3, beh.miniBar], [true, true]);
  chk('Sir Varric frost nova freezes', beh.knightFreezes, true);
  // ---- every boss: sprite, uses its attack cycle, hurts, dies and opens the exit
  const bosses = await ev(() => { const out = {};
    for (const k of ['ancient', 'colossus', 'sunpharaoh', 'frosttitan', 'deathknight']) { TT.setup(['paladin', 'sela']); TT.testRoom(); G.heroes.forEach(q => { q.maxHp = q.hp = 1e6; }); const h = G.heroes[0]; G.exitOpen = false;
      const b = spawnBoss(k, h.x + 260, h.y); const acts = new Set(); let lastAi = -1, adds = 0;
      for (let i = 0; i < 60 * 16; i++) { __game.tick(); G.heroes.forEach(q => { q.hp = Math.max(q.hp, 5e5); q.dead = false; q.frz = 0; }); if (b.ai !== lastAi && b.ai !== undefined) { lastAi = b.ai; acts.add(BOSSES[k].acts[b.ai]); } }
      adds = G.foes.filter(q => q !== b && q.type === BOSSES[k].summon).length; const hurt = G.heroes.some(q => q.hp < 1e6);
      b.hp = 1; hitFoe(b, 100, { x: h.x, y: h.y, src: h, tier: 3 }); for (let i = 0; i < 60 * 3; i++) __game.tick();
      out[k] = { name: b.name, sprite: foeSprReady(FOE_SPRITE[k]), acts: acts.size, hurt, adds: adds > 0, dead: !G.foes.includes(b), exitOpen: G.exitOpen }; }
    return out; });
  for (const [k, v] of Object.entries(bosses)) chk(`boss ${k} (${v.name})`, v, g => g.sprite && g.acts >= 3 && g.hurt && g.dead && g.exitOpen);
  await ev(() => { SAVE.settings.extendedRealms = undefined; });
  console.log(`EXTENDED REALMS TESTS: ${pass} passed, ${fail} failed`); console.log('ERRORS:', JSON.stringify(await ev(() => ERRORS)), 'CONSOLE:', logs.join(' | '));
  await b.close();
})();
