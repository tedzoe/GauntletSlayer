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
  const types = ['shambler', 'barrow', 'blight', 'bloater', 'bonesoldier', 'warden', 'marshal', 'wraith', 'hexcaller', 'lich', 'savage', 'shieldbrute', 'hulk', 'goblin', 'totemist', 'spiderling', 'spiderwar', 'dweller', 'broodmother', 'novice', 'zealot', 'pyromancer', 'conjurer', 'imp', 'ravager', 'horror'];
  const smoke = await ev(types => { const out = {};
    for (const t of types) { TT.setup(['paladin']); TT.testRoom(); const h = G.heroes[0]; h.maxHp = h.hp = 1e6; const f = mkFoe(t, h.x + 200, h.y, { awake: true }); if (!G.foes.includes(f)) G.foes.push(f); const x0 = f.x, hp0 = h.hp; const shots0 = 0; let shots = 0;
      for (let i = 0; i < 60 * 5; i++) { __game.tick(); shots += G.shots.filter(s => s.team === 'foe' && s.t < 0.02).length; h.hp = Math.max(h.hp, 1e5); h.dead = false; }
      out[t] = { name: FOES[t].name, sprite: foeSprReady(FOE_SPRITE[t]), moved: Math.round(Math.abs(f.x - x0)) > 5, hurtHero: h.hp < 1e6 || shots > 0, foes: G.foes.length, alive: ALIVE(f) }; }
    return out; }, types);
  for (const t of types) chk(`smoke ${t} (${smoke[t].name})`, smoke[t], g => g.sprite && (g.alive || t === 'wraith') && g.hurtHero);
  const beh = await ev(() => { const out = {};
    const popFx = () => { const L = G.hazards.filter(z => z.deathFx); G.hazards = G.hazards.filter(z => !z.deathFx); for (const z of L) z.onFire(z); };   // death effects wait DEATH_FX.delay: skip the wait
    // Blightwrapped: poison pool on death
    TT.setup(['paladin']); TT.testRoom(); let h = G.heroes[0]; let f = mkFoe('blight', h.x + 60, h.y, { awake: true }); killFoe(f, h); popFx(); out.blightPool = G.hazards.some(z => z.kind === 'miasma' && z.team === 'foe');
    // Swollen Embalmed: bursts on death
    TT.testRoom(); h = G.heroes[0]; f = mkFoe('bloater', h.x + 40, h.y, { awake: true }); const hp0 = h.hp; killFoe(f, h); popFx(); out.bloaterBlast = h.hp < hp0;
    // Crypt Warden: blocks frontal hits
    TT.testRoom(); h = G.heroes[0]; f = mkFoe('warden', h.x + 40, h.y, { awake: true }); f.fa = Math.PI; const w0 = f.hp; hitFoe(f, 10, { x: h.x, y: h.y, src: h, tier: 1 }); const front = w0 - f.hp; const g = mkFoe('warden', h.x + 40, h.y + 90, { awake: true }); g.fa = 0; const w1 = g.hp; hitFoe(g, 10, { x: h.x, y: h.y + 90, src: h, tier: 1 }); out.wardenBlocks = { front: +front.toFixed(1), back: +(w1 - g.hp).toFixed(1) };
    // Bone Marshal: hastes skeletons, rallies two more
    TT.testRoom(); h = G.heroes[0]; h.x = 4 * 32; const m = mkFoe('marshal', h.x + 600, h.y, { awake: true }); const sk = mkFoe('bonesoldier', h.x + 640, h.y, { awake: true }); const n0 = G.foes.length; for (let i = 0; i < 60 * 6; i++) __game.tick(); out.marshal = { hasted: sk.hasteT > 0 || !ALIVE(sk), rallied: G.foes.length - n0 };
    // Grave Wisp flies
    out.wispFlies = mkFoe('wraith', 0, 0).fly;
    // Bone Hexer summons
    TT.testRoom(); h = G.heroes[0]; const hx = mkFoe('hexcaller', h.x + 250, h.y, { awake: true }); const c0 = G.foes.length; for (let i = 0; i < 60 * 9; i++) { __game.tick(); h.hp = h.maxHp; } out.hexerSummons = G.foes.length - c0;
    // Lich: barrier, frost nova freeze, summons wardens
    TT.testRoom(); h = G.heroes[0]; h.maxHp = h.hp = 1e5; const L = mkFoe('lich', h.x + 80, h.y, { awake: true }); let froze = false, barrier = false, wardens = 0;
    for (let i = 0; i < 60 * 14; i++) { __game.tick(); h.hp = 1e5; h.dead = false; if (h.frz > 0) froze = true; if (L.barrier > 0) barrier = true; }
    wardens = G.foes.filter(q => q.type === 'warden').length; out.lich = { froze, barrier, wardens, elite: L.elite, hp: L.maxhp };
    // Boss
    TT.setup(['paladin']); startCampaignFloor(0, 3); out.boss = { name: G.boss && G.boss.name, sprite: foeSprReady('king') };
    // waves
    out.cryptSpawnsNoArchers = !WORLDS[0].foes.includes('bonearcher') && !WORLDS[0].spawn.includes('bonearcher');
    TT.setup(['paladin']); beginRun(); startEndlessFloor(5); out.endless5Lich = G.foes.some(q => q.type === 'lich'); startEndlessFloor(4); out.endless4Lich = G.foes.some(q => q.type === 'lich');
    const seen = new Set(); for (const n of [1, 2, 3, 4, 5]) { startEndlessFloor(n); G.foes.forEach(q => seen.add(q.type)); G.spawners.forEach(s => seen.add(s.type)); } out.endlessCryptTypes = [...seen].sort();
    TT.setup(['paladin']); beginRun(); startCampaignFloor(0, 2); const A = G.arena; A.wave = CRYPT.lichCampaignWave - 1; startWave(); out.campaignLichWave = A.queue.includes('lich');
    return out; });
  chk('Blightwrapped leaves a poison pool', beh.blightPool, true);
  chk('Swollen Embalmed bursts on death', beh.bloaterBlast, true);
  chk('Crypt Warden blocks frontal hits (85% less)', beh.wardenBlocks, g => g.front < g.back * 0.3);
  chk('Bone Marshal hastes skeletons and rallies 2', beh.marshal, g => g.hasted && g.rallied >= 2);
  chk('Grave Wisp floats through walls', beh.wispFlies, true);
  chk('Bone Hexer summons skeletons', beh.hexerSummons, g => g >= 2);
  chk('Lich: barrier, frost nova freezes, summons wardens', beh.lich, g => g.froze && g.barrier && g.wardens >= 1 && g.elite);
  chk('Crypt boss uses the king sprite', beh.boss, { name: 'The Ossuary King', sprite: true });
  chk('No skeletal archers in crypt spawns', beh.cryptSpawnsNoArchers, true);
  chk('Lich mini-boss on endless crypt floor 5 (not 4)', [beh.endless5Lich, beh.endless4Lich], [true, false]);
  chk('Lich mini-boss in Charnel Court wave 3', beh.campaignLichWave, true);
  console.log('   endless crypt types seen:', beh.endlessCryptTypes.join(','));

  const cl = await ev(() => { const out = {};
    // Mire Lurker: untouchable while submerged, surfaces and spits a 3-shot fan
    TT.setup(['paladin']); TT.testRoom(); let h = G.heroes[0]; h.maxHp = h.hp = 1e5; const L = mkFoe('dweller', h.x + 180, h.y, { awake: true }); for (let i = 0; i < 5; i++) __game.tick();
    const hp0 = L.hp; const subHit = hitFoe(L, 50, { x: h.x, y: h.y, src: h }); let surfaced = false, fan = 0;
    for (let i = 0; i < 60 * 6 && !fan; i++) { __game.tick(); h.hp = 1e5; if (L.sub === false) { surfaced = true; fan = Math.max(fan, G.shots.filter(q => q.owner === L).length); } }
    out.lurker = { submergedImmune: !subHit && L.hp === hp0, surfaced, fan };
    // Fangback Stalker pounces (charge state)
    TT.testRoom(); h = G.heroes[0]; h.maxHp = h.hp = 1e5; const S = mkFoe('spiderwar', h.x + 200, h.y, { awake: true }); let charged = false; for (let i = 0; i < 180; i++) { __game.tick(); h.hp = 1e5; if (S.state === 'charge' || S.state === 'windup') charged = true; } out.stalkerPounces = charged;
    // Web Queen: mini-boss, web nova slows, spawns skitterlings
    TT.testRoom(); h = G.heroes[0]; h.maxHp = h.hp = 1e5; const Q = mkFoe('broodmother', h.x + 90, h.y, { awake: true }); let slowed = false; const c0 = G.foes.length;
    for (let i = 0; i < 60 * 12; i++) { __game.tick(); h.hp = 1e5; h.dead = false; if (h.slowT > 0) slowed = true; } out.queen = { miniboss: !!Q.d.miniboss, slowed, spawned: G.foes.filter(q => q.type === 'spiderling').length, bar: !!G.miniBar || (__game.draw(), !!G.miniBar) };
    // Maw Below: fire nova leaves fire, summons imps
    TT.testRoom(); h = G.heroes[0]; h.maxHp = h.hp = 1e5; const M = mkFoe('horror', h.x + 90, h.y, { awake: true }); let fire = false;
    for (let i = 0; i < 60 * 12; i++) { __game.tick(); h.hp = 1e5; h.dead = false; if (G.hazards.some(z => z.kind === 'fire' && z.team === 'foe')) fire = true; } out.horror = { miniboss: !!M.d.miniboss, fire, imps: G.foes.filter(q => q.type === 'imp').length };
    // Hexdrummer drops the haste totem
    TT.testRoom(); h = G.heroes[0]; h.maxHp = h.hp = 1e5; mkFoe('totemist', h.x + 200, h.y, { awake: true }); for (let i = 0; i < 60 * 8; i++) { __game.tick(); h.hp = 1e5; } out.totem = G.foes.some(q => q.type === 'totem');
    // bosses
    out.bosses = {}; for (const [wi, k] of [[1, 'rootmaw'], [2, 'forgemaster'], [3, 'sovereign']]) { TT.setup(['paladin']); beginRun(); startCampaignFloor(wi, WORLDS[wi].floors.findIndex(q => q.boss)); out.bosses[k] = { name: G.boss && G.boss.name, sprite: foeSprReady(FOE_SPRITE[k]) }; }
    // waves: mini-bosses on the 5th floor of each 6-floor group; legacy units out of the rotation
    TT.setup(['paladin']); beginRun(); out.endlessMini = {}; for (const n of [5, 11, 17, 23, 10]) { startEndlessFloor(n); out.endlessMini[n] = (G.foes.find(q => q.d.miniboss) || {}).type || null; }
    const seen = new Set(); for (const n of [7, 8, 9, 13, 14, 15]) { startEndlessFloor(n); G.foes.forEach(q => seen.add(q.type)); } out.seen = [...seen].sort();
    out.legacyOut = !WORLDS[1].foes.includes('rockthrower') && !WORLDS[2].foes.includes('firebrand') && !WORLDS[1].elite.includes('broodmother');
    const camp = {}; for (const wi of [1, 2]) { TT.setup(['paladin']); beginRun(); startCampaignFloor(wi, 2); const A = G.arena; A.wave = CRYPT.lichCampaignWave - 1; startWave(); camp[wi] = A.queue.includes(WORLDS[wi].miniboss); } out.campMini = camp;
    return out; });
  chk('Mire Lurker: immune submerged, surfaces, 3-shot fan', cl.lurker, g => g.submergedImmune && g.surfaced && g.fan >= 3);
  chk('Fangback Stalker pounces', cl.stalkerPounces, true);
  chk('Web Queen: mini-boss bar, web nova slows, spawns', cl.queen, g => g.miniboss && g.slowed && g.spawned >= 2 && g.bar);
  chk('Maw Below: fire nova, summons imps', cl.horror, g => g.miniboss && g.fire && g.imps >= 3);
  chk('Hexdrummer drops a haste totem', cl.totem, true);
  chk('Cave/lava/final bosses use their sprites', cl.bosses, g => Object.values(g).every(b => b.sprite && b.name));
  chk('Endless mini-boss floors 5/11/17/23 (none on 10)', cl.endlessMini, { 5: 'lich', 10: null, 11: 'broodmother', 17: 'horror', 23: 'lich' });
  chk('Campaign arena wave 3 brings the area mini-boss', cl.campMini, { 1: true, 2: true });
  chk('Legacy units out of cave/lava rotation', cl.legacyOut, true);
  console.log('   endless cave+lava types seen:', cl.seen.join(','), ' bosses:', JSON.stringify(cl.bosses));
  console.log(`ENEMY TESTS: ${pass} passed, ${fail} failed`); console.log('ERRORS:', JSON.stringify(await ev(() => ERRORS)), 'CONSOLE:', logs.join(' | '));
  await b.close();
})();
