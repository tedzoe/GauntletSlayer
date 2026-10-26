// David's deliberate deviations (Oct 2026): dash on one button, cooldown HUD, pets hit spawners, slowed enemy missiles,
// ground-speed cap, damage order. All numbers come from DEV in tuning.js.
const ENV = require('./env');
const puppeteer = require('puppeteer-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await ENV.ready;
  const b = await puppeteer.launch({ executablePath: ENV.CHROME, headless: 'new', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage(); await p.setViewport({ width: 1152, height: 648 });
  const logs = []; p.on('pageerror', e => logs.push('pageerror: ' + e.message));
  await p.evaluateOnNewDocument(() => {
    const mk = i => ({ index: i, id: 'Fake Pad', connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) });
    window.__pads = []; window.__addPad = () => { const pd = mk(window.__pads.length); window.__pads.push(pd); return pd.index; };
    window.__btn = (i, bb, v) => { window.__pads[i].buttons[bb] = { pressed: v, value: v ? 1 : 0 }; };
    navigator.getGamepads = () => window.__pads;
  });
  await p.goto(ENV.BASE + 'index.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await sleep(800);
  let pass = 0, fail = 0; const chk = (name, got, want) => { const okk = typeof want === 'function' ? want(got) : JSON.stringify(got) === JSON.stringify(want); okk ? pass++ : fail++; console.log((okk ? 'PASS ' : 'FAIL ') + name.padEnd(60), JSON.stringify(got), okk ? '' : ' want ' + (typeof want === 'function' ? want.toString() : JSON.stringify(want))); };
  const ev = (f, ...a) => p.evaluate(f, ...a);
  await ev(() => {
    const hold = new Set(); let prev = new Set(); const oRead = Input.read, oCommit = Input.commit;
    window.TT = {
      hold, pin: null,
      run(s) { for (let i = 0; i < Math.round(s * 60); i++) { menuGuard = 0; __game.tick(); if (TT.pin) { const f = TT.pin; f.x = f.px; f.y = f.py; f.kx = f.ky = 0; } } },
      setup(ids, devs) { const S = __game.SEL; S.slots = ids.map((id, i) => ({ dev: devs ? devs[i] : 'kb1', idx: HEROES.findIndex(h => h.id === id), ready: true })); __game.startParty(); TT.room(); },
      room(wall) { const rows = []; for (let y = 0; y < 22; y++) rows.push(y === 0 || y === 21 ? '#'.repeat(60) : '#' + '.'.repeat(58) + '#');
        resetLists(); G.mode = 'campaign'; G.scale = { hp: 1, dmg: 1, spd: 1, spawn: 1 }; G.mods = {}; G.goldMul = 1; G.worldTier = 0; G.map = parseMap(rows, WORLDS[0].theme); G.map.arenaSet = new Set();
        G.floorName = 'T'; G.worldName = 'T'; renderMapCanvas(); for (const h of G.heroes) { h.x = 8 * 32; h.y = 11 * 32; h.fa = 0; h.ax = 1; h.ay = 0; h.inv = 0; h.cd = {}; h.hp = h.maxHp; h.souls = 100; } G.stats = newStats(); updateCamera(true); computeFlow(); G.exitOpen = false; TT.pin = null; },
    };
    Input.read = (dev, s) => { if (dev !== 'kb1') return oRead(dev, s); const st = { mx: 0, my: 0, ax: 0, ay: 0, aim: false, aimFire: false, dev, down: {}, pressed: {}, released: {} }; for (const k of hold) { st.down[k] = true; if (!prev.has(k)) st.pressed[k] = true; } return st; };
    Input.commit = d => { prev = new Set(hold); oCommit(d); };
  });

  // ---- 1. DASH: same button for all six, cooldown from DEV.dash
  const dash = await ev(() => HEROES.map(d => { TT.setup([d.id]); const h = G.heroes[0]; const x0 = h.x; TT.hold.add('dash'); TT.run(1 / 60); TT.hold.clear(); const started = !!h.dash || h.rushPrep > 0; const cd = +(h.cd[DEV.dash[d.id].cdKey] || 0).toFixed(2); TT.run(0.5); return [d.id, started, Math.round(h.x - x0) > 60, cd]; }));
  chk('every hero dashes on the dash button (moves > 60 px) with its cooldown (the Theo Rush may be in its 0.1s start-up; Vesper Ghostwalk has none)', dash, g => g.every(r => r[1] && r[2] && (r[3] > 0 || r[0] === 'vesper')));   // Ghostwalk has no cooldown (Slayer)
  console.log('      dash cooldowns', JSON.stringify(dash.map(r => [r[0], r[3]])));
  const again = await ev(() => { TT.setup(['mirelle']); const h = G.heroes[0]; TT.hold.add('dash'); TT.run(1 / 60); TT.hold.clear(); TT.run(0.4); const x1 = h.x; TT.hold.add('dash'); TT.run(1 / 60); TT.hold.clear(); TT.run(0.3); return Math.round(h.x - x1); });
  chk('dash is blocked while on cooldown', again, 0);
  const padDash = await ev(() => { const i = __addPad(); TT.setup(['kestrel'], ['pad' + i]); const h = G.heroes[0]; __btn(i, 6, true); TT.run(1 / 60); const lt = !!h.dash; __btn(i, 6, false); TT.run(2); __btn(i, 10, true); TT.run(1 / 60); const l3 = !!h.dash; __btn(i, 10, false); return { lt, l3 }; });
  chk('gamepad LT and L3 dash', padDash, { lt: true, l3: true });
  const kbMap = await ev(() => { const st = []; for (const code of ['KeyF', 'Numpad6']) { Input.keys.add(code); Input.pressedK.add(code); } return null; });
  // ---- 2. HUD: every move listed, countdown visible mid-cooldown
  const hud = await ev(() => HEROES.map(d => { TT.setup([d.id]); const h = G.heroes[0]; h.relic = { id: 'mirror', rank: 1 }; const labs = heroMoves(h).map(m => m.lab); return [d.id, labs]; }));
  chk('HUD lists main, secondary, special, dash, relic, potion for every hero', hud, g => g.every(([id, l]) => l.length >= 6 && l.includes('DSH') && l.includes('REL') && l.includes('POT')));
  console.log('      ', JSON.stringify(hud));
  const coop = await ev(() => { TT.setup(['brannoc', 'sela', 'paladin', 'vesper'], ['kb1', 'kb2', 'kb2', 'kb2']); G.heroes.forEach(h => { h.cd.secondary = 2.4; }); __game.draw(); return G.heroes.map(h => (h._lastMoves || []).length); });
  chk('4-player co-op: each player panel draws its own move bar', coop, g => g.length === 4 && g.every(n => n >= 5));
  // ---- 3. PETS hit spawners (no foes around)
  const pets = await ev(() => { const out = {}; for (const kind of ['warrior', 'spear', 'archer', 'guard', 'mage', 'wraith', 'golem', 'illusion', 'gargoyle', 'sprite', 'shade']) {
      TT.setup(['vesper']); const h = G.heroes[0]; h.x = 4 * 32; const s = mkSpawner(h.x + 160, h.y, 3, ['shambler'], 'crypt'); s.hp = s.maxHp = 999; s.spawnT = 999;
      const a = mkAlly(kind, h.x + 110, h.y, h); a.life = 1e9; if (kind === 'sprite') { a.ang = 0; h.x = s.x - 52; }
      const hp0 = s.hp; for (let i = 0; i < 360; i++) { menuGuard = 0; s.spawnT = 999; __game.tick(); } out[kind] = Math.round(hp0 - s.hp); } return out; });
  chk('every pet / clone / summon damages a spawner on its own', pets, g => Object.values(g).every(v => v > 0));
  const valk = await ev(() => { TT.setup(['sela']); const h = G.heroes[0]; h.talisman = 'base'; h.potions = 1; const s = mkSpawner(h.x + 200, h.y, 3, ['shambler'], 'crypt'); s.hp = s.maxHp = 999; usePotion(h); const hp0 = s.hp; for (let i = 0; i < 300; i++) { menuGuard = 0; s.spawnT = 999; __game.tick(); } return Math.round(hp0 - s.hp); });
  chk("Valkyrie's Call valkyries attack a spawner", valk, g => g > 0);
  const mirror = await ev(() => { TT.setup(['brannoc']); const h = G.heroes[0]; h.relic = { id: 'mirror', rank: 1 }; h.potions = 1; const s = mkSpawner(h.x + 200, h.y, 3, ['shambler'], 'crypt'); s.hp = s.maxHp = 999; useRelic(h); const hp0 = s.hp; for (let i = 0; i < 300; i++) { menuGuard = 0; s.spawnT = 999; __game.tick(); } return Math.round(hp0 - s.hp); });
  chk('Ring of Mirrors clones attack a spawner', mirror, g => g > 0);
  // ---- 4. ENEMY MISSILES: every foe shot <= cap, range kept
  const proj = await ev(() => { TT.setup(['brannoc']); const cap = PROJ_CAP(), out = []; const h = G.heroes[0];
    for (const [type, d] of Object.entries(FOES)) { if (!['ranged', 'caster', 'brood', 'lurker'].includes(d.beh) && !d.shot) continue; G.shots = []; const f = mkFoe(type, h.x + 300, h.y, { awake: true }); foeShoot(f, Math.PI, d.shot ? Object.assign({}, d.shot) : {}); const s = G.shots[0]; out.push([type, Math.round(hyp(s.vx, s.vy))]); }
    G.shots = []; const fb = { x: h.x + 300, y: h.y, r: 30, dmg: 10 }; bossProj(fb, Math.PI, 260); out.push(['bossVolley', Math.round(hyp(G.shots[0].vx, G.shots[0].vy))]);
    return { cap: Math.round(cap), max: Math.max(...out.map(o => o[1])), out }; });
  chk('every enemy missile (bosses included) <= PROJ_CAP (200 px/s)', proj, g => g.max <= g.cap + 0.5 && g.cap <= 200);
  console.log('      ', JSON.stringify(proj.out));
  const dodge = await ev(() => { const v = PROJ_CAP(), s = SLOWEST_HERO_SPEED(); const need = DEV.proj.react + DEV.proj.sidestepPx / s, have = DEV.proj.minRange / v; return { need: +need.toFixed(2), have: +have.toFixed(2) }; });
  chk('slowest hero can sidestep a capped missile from 160 px (time to impact > reaction + sidestep)', dodge, g => g.have > g.need * 1.3);
  // ---- 5. GROUND SPEED: no ground foe ever steps faster than 90% of the slowest hero, charges included, Endless x1.15 + totem haste
  const ground = await ev(() => { const cap = GROUND_CAP(), res = []; let worst = 0, worstT = '';
    for (const [type, d] of Object.entries(FOES)) { if (type === 'reaper') continue;
      TT.setup(['mirelle']); const h = G.heroes[0]; h.x = 4 * 32; h.inv = 999; G.scale.spd = 1.15; const f = mkFoe(type, 30 * 32, h.y, { awake: true }); f.hasteT = 99; f.spd *= 1.15; f.atkT = 0;
      let mx = 0; for (let i = 0; i < 240; i++) { const x0 = f.x, y0 = f.y; menuGuard = 0; h.hp = h.maxHp; __game.tick(); if (!ALIVE(f)) break; if (f.kx || f.ky) continue; const v = hyp(f.x - x0, f.y - y0) * 60; if (v > mx) mx = v; }
      if (foeSpeedExempt(f)) { res.push([type, 'exempt', Math.round(mx)]); continue; }
      if (mx > worst) { worst = mx; worstT = type; } }
    return { cap: +cap.toFixed(1), worst: Math.round(worst), worstT, exempt: res }; });
  chk('ground foes <= 90% of slowest hero (120 px/s) incl. charge, Endless, totem haste', ground, g => g.worst <= g.cap + 2);
  const reaper = await ev(() => { TT.setup(['mirelle']); const h = G.heroes[0]; h.x = 4 * 32; h.inv = 999; const f = mkFoe('reaper', 30 * 32, h.y, { awake: true }); let mx = 0; for (let i = 0; i < 120; i++) { const x0 = f.x; menuGuard = 0; __game.tick(); mx = Math.max(mx, Math.abs(f.x - x0) * 60); } return Math.round(mx); });
  chk('Death (Pale Collector) walks under the ground cap too', reaper, g => g <= 121);
  const boss = await ev(() => { const out = {}; for (const kind of Object.keys(BOSSES)) { TT.setup(['mirelle']); const h = G.heroes[0]; h.x = 4 * 32; h.inv = 999; const f = spawnBoss(kind, 30 * 32, h.y); let mx = 0; for (let i = 0; i < 600; i++) { const x0 = f.x, y0 = f.y; menuGuard = 0; h.hp = h.maxHp; __game.tick(); if (!f.kx && !f.ky && kind !== 'sovereign') mx = Math.max(mx, hyp(f.x - x0, f.y - y0) * 60); } out[kind] = Math.round(mx); } return out; });
  chk('ground bosses (walk + charge) <= ground cap', boss, g => Object.entries(g).every(([k, v]) => k === 'sovereign' || v <= 122));
  // ---- 6. DAMAGE ORDER: main < secondary < special (numbers)
  // Slayer reference (Oct 2026) wins over the old per-hit rule: main hit < secondary < special PER USE; the reference's own per-hit exceptions are listed
  const order = await ev(() => { const D = DEV.dmg; return {
    theo: [Math.max(...D.theo.combo), D.theo.leap, D.theo.spinTick * D.theo.spinTicks], gela: [D.gela.combo[0], D.gela.thrust, D.gela.execHit], paladin: [D.paladin.combo[0], D.paladin.judgmentMax, D.paladin.slam],
    isaac: [D.isaac.quick, D.isaac.powerMax, D.isaac.mortar], vesper: [D.vesper.reap, D.vesper.spikes, D.vesper.raiseBurst], zoey: [D.zoey.bolt, D.zoey.mortar, D.zoey.nova] }; });
  chk('per use: main hit < secondary < special for every hero (Slayer reference)', order, g => Object.values(g).every(([a, s, sp]) => a < s && s < sp));
  const exc = await ev(() => { const D = DEV.dmg; return { theoSpinTick: D.theo.spinTick < D.theo.leap, zoeyLow: [D.zoey.thunderclap, D.zoey.serpentPass].every(v => v < D.zoey.bolt) }; });
  chk('reference per-hit exceptions kept on purpose: Destructo Spin ticks (20) < Smash (50); Shock Blast 14 and Serpents 16 < Firebolt 22', exc, { theoSpinTick: true, zoeyLow: true });
  console.log(`\n${pass} passed, ${fail} failed`); console.log('ERRORS', JSON.stringify(logs));
  await b.close(); process.exit(fail || logs.length ? 1 : 0);
})();
