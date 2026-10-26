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
  await ev(() => { SAVE.settings.extendedRealms = true; });
  const AREAS = [['forest', 19, ['fscout', 'wolf', 'ftroll', 'wisp', 'strangler', 'alpha'], ['paladin', 'kestrel']],
    ['swamp', 25, ['ghoul', 'leech', 'bogtroll', 'croaker', 'spitter', 'hag'], ['sela', 'mirelle']],
    ['desert', 31, ['dmummy', 'scarab', 'sentinel', 'suncult', 'jackal', 'pharaohq'], ['brannoc', 'vesper']],
    ['frozen', 37, ['fskel', 'sprite', 'yeti', 'rimemage', 'igolem', 'boneknight'], ['paladin', 'mirelle']],
    ['fortress', 43, ['thrall', 'assassin', 'bulwark', 'chanter', 'abyssal', 'succubus'], ['kestrel', 'sela']]];

  await ev(() => { window.__open = () => { let best = null, bs = -1; const m = G.map;
    for (let ty = 5; ty < m.h - 5; ty++) for (let tx = 5; tx < m.w - 5; tx++) { if (tileAt(tx, ty) !== TL.FLOOR) continue; let c = 0; for (let dy = -4; dy <= 4; dy++) for (let dx = -5; dx <= 5; dx++) if (tileAt(tx + dx, ty + dy) === TL.FLOOR) c++; if (c > bs) { bs = c; best = { x: (tx + 0.5) * T, y: (ty + 0.5) * T }; } }
    return best; }; });
  let num = 75;
  for (const [key, n, row, heroes] of AREAS) {
    await ev((n, row, heroes) => { TT.setup(heroes); beginRun(); startEndlessFloor(n); G.foes.length = 0; G.spawners.length = 0; G.shots.length = 0; G.hazards.length = 0;
      const o = __open(); const h = G.heroes[0]; G.heroes.forEach((q, i) => { q.maxHp = q.hp = 1e5; q.x = o.x - 200; q.y = o.y - 30 + i * 60; }); G.banner = null;
      // find an open patch near the start for the lineup
      row.forEach((t, i) => { let x = o.x - 60 + (i % 3) * 100, y = o.y - 70 + Math.floor(i / 3) * 140; for (let k = 0; k < 24 && collide(x, y, 22); k++) { const a = k * 0.8; x = h.x + Math.cos(a) * (110 + k * 6); y = h.y + Math.sin(a) * (110 + k * 6); }
        const f = mkFoe(t, x, y, { awake: true }); f.fa = Math.PI; f.__p = [x, y]; });
      const hp0 = G.heroes.map(q => [q.x, q.y]);
      for (let i = 0; i < 150; i++) { __game.tick(); G.heroes.forEach((q, j) => { q.hp = 1e5; if (i < 130) { q.x = hp0[j][0]; q.y = hp0[j][1]; } }); G.foes.forEach(f => { if (f.__p && i < 130) { f.x = f.__p[0]; f.y = f.__p[1]; } }); } }, n, row, heroes);
    await shot(`${num++}-${key}-roster.png`);
  }
  const BOSS = [['forest', 21, 'ancient'], ['swamp', 27, 'colossus'], ['desert', 33, 'sunpharaoh'], ['frozen', 39, 'frosttitan'], ['fortress', 45, 'deathknight']];
  for (const [key, n, kind] of BOSS) {
    await ev((n) => { TT.setup(['paladin', 'sela', 'kestrel']); beginRun(); startEndlessFloor(n); G.heroes.forEach(q => { q.maxHp = q.hp = 1e5; }); const b = G.boss; const o = __open(); G.banner = null; G.foes.filter(f => f !== b).forEach(f => { if (hyp(f.x - o.x, f.y - o.y) < 500) f.hp = 0, f.dead = true; }); G.foes = G.foes.filter(f => !f.dead || f === b); b.x = o.x + 60; b.y = o.y - 40;
      G.heroes.forEach((q, i) => { q.x = o.x - 200 + i * 40; q.y = o.y + 60 - i * 50; });
      for (let i = 0; i < 200; i++) { __game.tick(); G.heroes.forEach(q => q.hp = 1e5); } }, n);
    await shot(`${num++}-${key}-boss-${kind}.png`);
  }
  await ev(() => { SAVE.settings.extendedRealms = true; TT.setup(['paladin']); openGameplayRules(G.heroes[0].dev); __game.draw(); });
  await shot('85-gameplay-rules-extended-realms-on.png');
  const fps = await ev(() => { TT.setup(['paladin', 'sela']); beginRun(); startEndlessFloor(45); scene = 'game'; G.heroes.forEach(q => { q.maxHp = q.hp = 1e6; }); const b = G.boss; G.heroes.forEach(q => { q.x = b.x - 150; q.y = b.y + 120; });
    return new Promise(res => { let n = 0; const t0 = performance.now(); const f = () => { n++; G.heroes.forEach(q => q.hp = 1e6); if (performance.now() - t0 < 6000) requestAnimationFrame(f); else res({ fps: n / 6, foes: G.foes.length }); }; requestAnimationFrame(f); }); });
  console.log('FPS on floor 45 (Death Knight fight):', JSON.stringify(fps));
  await ev(() => { SAVE.settings.extendedRealms = undefined; });
  console.log('SHOTS DONE', num - 75, 'ERRORS:', JSON.stringify(await ev(() => ERRORS)), 'CONSOLE:', logs.join(' | '));
  await b.close();
})();
