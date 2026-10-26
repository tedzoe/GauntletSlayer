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
  const shot = async name => { await ev(() => __game.draw()); await p.screenshot({ path: SHOT + name }); };
  await new Promise(r => setTimeout(r, 900));
  // 1: roster lineup in the test room, mid-fight
  await ev(() => { TT.setup(['paladin', 'sela']); TT.testRoom(); const h = G.heroes[0], g = G.heroes[1]; h.x -= 120; g.x = h.x; g.y = h.y + 60; [h, g].forEach(q => { q.maxHp = q.hp = 1e5; });
    const row = ['shambler', 'barrow', 'blight', 'bloater', 'wraith', 'hexcaller', 'bonesoldier', 'warden', 'marshal'];
    row.forEach((t, i) => { const f = mkFoe(t, h.x + 140 + (i % 5) * 70, h.y - 70 + Math.floor(i / 5) * 120, { awake: true }); f.fa = Math.PI; });
    for (let i = 0; i < 20; i++) __game.tick(); });
  await shot('60-crypt-roster.png');
  // 2: endless crypt floor 2 in play (2 heroes)
  await ev(() => { TT.setup(['brannoc', 'kestrel']); beginRun(); startEndlessFloor(2); G.heroes.forEach(q => { q.maxHp = q.hp = 1e5; }); const h = G.heroes[0];
    const near = G.foes.slice().sort((a, b) => hyp(a.x - h.x, a.y - h.y) - hyp(b.x - h.x, b.y - h.y)).slice(0, 14); near.forEach((f, i) => { const a = i * 0.45; const x = h.x + Math.cos(a) * (120 + (i % 3) * 40), y = h.y + Math.sin(a) * (90 + (i % 3) * 30); if (!collide(x, y, f.r)) { f.x = x; f.y = y; } f.awake = true; });
    for (let i = 0; i < 40; i++) { __game.tick(); G.heroes.forEach(q => q.hp = 1e5); } });
  await shot('61-crypt-endless-floor2.png');
  // 3: Lich mini-boss casting its frost nova
  await ev(() => { TT.setup(['zoey' in {} ? 'mirelle' : 'mirelle', 'paladin']); TT.testRoom(); G.heroes.forEach(q => { q.maxHp = q.hp = 1e5; }); const h = G.heroes[0]; const L = mkFoe('lich', h.x + 150, h.y, { awake: true }); L.novaT = 0.05; mkFoe('warden', h.x + 110, h.y + 60, { awake: true }); mkFoe('warden', h.x + 110, h.y - 60, { awake: true });
    for (let i = 0; i < 35; i++) { __game.tick(); G.heroes.forEach(q => q.hp = 1e5); } });
  await shot('62-crypt-lich-frost-nova.png');
  await ev(() => { const L = G.foes.find(f => f.type === 'lich'); L.barrier = 3; L.fa = Math.PI; for (let i = 0; i < 30; i++) { __game.tick(); G.heroes.forEach(q => q.hp = 1e5); } });
  await shot('63-crypt-lich-barrier-frozen.png');
  // 4: Bone Marshal rally
  await ev(() => { TT.setup(['brannoc']); TT.testRoom(); const h = G.heroes[0]; h.maxHp = h.hp = 1e5; const m = mkFoe('marshal', h.x + 170, h.y, { awake: true }); m.rallyT = 0.05; for (let k = 0; k < 3; k++) mkFoe('bonesoldier', h.x + 120 + k * 30, h.y + 50 - k * 40, { awake: true }); for (let i = 0; i < 20; i++) { __game.tick(); h.hp = 1e5; } });
  await shot('64-crypt-marshal-rally.png');
  // 5: crypt boss
  await ev(() => { TT.setup(['paladin', 'sela', 'vesper']); beginRun(); startCampaignFloor(0, 3); G.heroes.forEach(q => { q.maxHp = q.hp = 1e5; }); const b = G.boss; G.heroes.forEach((q, i) => { q.x = b.x - 120 + i * 120; q.y = b.y + 170; }); for (let i = 0; i < 90; i++) { __game.tick(); G.heroes.forEach(q => q.hp = 1e5); } });
  await shot('65-crypt-boss-ossuary-king.png');

  const roster = async (heroes, row, name) => { await ev((heroes, row) => { TT.setup(heroes); TT.testRoom(); const h = G.heroes[0]; h.x -= 120; G.heroes.forEach((q, i) => { q.maxHp = q.hp = 1e5; q.x = h.x; q.y = h.y + i * 60; });
      row.forEach((t, i) => { const f = mkFoe(t, h.x + 150 + (i % 5) * 80, h.y - 80 + Math.floor(i / 5) * 140, { awake: true }); f.fa = Math.PI; if (f.d.beh === 'lurker') { f.sub = false; f.subT = 9; } });
      for (let i = 0; i < 20; i++) { __game.tick(); G.heroes.forEach(q => q.hp = 1e5); } }, heroes, row); await shot(name); };
  await roster(['brannoc', 'kestrel'], ['savage', 'shieldbrute', 'hulk', 'goblin', 'totemist', 'spiderling', 'spiderwar', 'dweller'], '66-cave-roster.png');
  await roster(['sela', 'mirelle'], ['novice', 'zealot', 'pyromancer', 'conjurer', 'imp', 'ravager'], '67-lava-roster.png');
  const endless = async (n, heroes, name) => { await ev((n, heroes) => { TT.setup(heroes); beginRun(); startEndlessFloor(n); G.heroes.forEach(q => { q.maxHp = q.hp = 1e5; }); const h = G.heroes[0];
      const near = G.foes.filter(f => !f.d.miniboss).sort((a, b) => hyp(a.x - h.x, a.y - h.y) - hyp(b.x - h.x, b.y - h.y)).slice(0, 14); near.forEach((f, i) => { const a = i * 0.45; const x = h.x + Math.cos(a) * (120 + (i % 3) * 40), y = h.y + Math.sin(a) * (90 + (i % 3) * 30); if (!collide(x, y, f.r)) { f.x = x; f.y = y; } });
      for (let i = 0; i < 150; i++) { __game.tick(); G.heroes.forEach(q => q.hp = 1e5); } }, n, heroes); await shot(name); };
  await endless(8, ['paladin', 'vesper'], '68-cave-endless-floor8.png');
  await endless(14, ['brannoc', 'sela'], '69-lava-endless-floor14.png');
  const mini = async (type, heroes, name, setup) => { await ev((type, heroes) => { TT.setup(heroes); TT.testRoom(); G.heroes.forEach(q => { q.maxHp = q.hp = 1e5; }); const h = G.heroes[0]; const m = mkFoe(type, h.x + 180, h.y, { awake: true }); m.hp *= 0.7; m.novaT = 0.6; m.fa = Math.PI;
      for (let i = 0; i < 70; i++) { __game.tick(); G.heroes.forEach(q => q.hp = 1e5); } }, type, heroes); await shot(name); };
  await mini('lich', ['mirelle', 'paladin'], '62-crypt-lich-frost-nova.png');
  await mini('broodmother', ['kestrel', 'paladin'], '70-cave-web-queen-miniboss.png');
  await mini('horror', ['brannoc', 'sela'], '71-lava-maw-below-miniboss.png');
  const boss = async (wi, heroes, name) => { await ev((wi, heroes) => { TT.setup(heroes); beginRun(); startCampaignFloor(wi, WORLDS[wi].floors.findIndex(q => q.boss)); G.heroes.forEach(q => { q.maxHp = q.hp = 1e5; }); const b = G.boss; G.heroes.forEach((q, i) => { q.x = b.x - 120 + i * 120; q.y = b.y + 190; if (collide(q.x, q.y, q.r)) { q.x = b.x; q.y = b.y + 150; } });
      for (let i = 0; i < 240; i++) { __game.tick(); G.heroes.forEach(q => q.hp = 1e5); if (b.kind === 'rootmaw' && b.state === 'surface' && i > 60) break; } }, wi, heroes); await shot(name); };
  await boss(1, ['paladin', 'kestrel', 'mirelle'], '72-cave-boss-rootmaw.png');
  await boss(2, ['brannoc', 'sela', 'vesper'], '73-lava-boss-forgemaster.png');
  await boss(3, ['paladin', 'sela', 'mirelle', 'kestrel'], '74-final-boss-hollowfang.png');
  console.log('ERRORS:', JSON.stringify(await ev(() => ERRORS)), 'CONSOLE:', logs.join(' | '));
  await b.close();
})();
