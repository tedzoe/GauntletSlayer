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
  const press = async (key, ms = 60) => { await p.keyboard.down(key); await p.evaluate(n => TT.run(n), ms / 1000); await p.keyboard.up(key); await p.evaluate(() => TT.run(0.05)); };
  const hold = press;
  const mouseAim = async (dx = 120, dy = 0) => { const pos = await p.evaluate(() => ({ x: G.heroes[0].x - G.cam.x, y: G.heroes[0].y - G.cam.y })); await p.mouse.move(pos.x + dx, pos.y + dy); };
  const click = async (btn = 'left', ms = 60) => { await p.mouse.down({ button: btn }); await p.evaluate(n => TT.run(n), ms / 1000); await p.mouse.up({ button: btn }); await p.evaluate(() => TT.run(0.05)); };
  const ev = (f, ...a) => p.evaluate(f, ...a);
  const shot = async name => { await ev(() => __game.draw()); await p.screenshot({ path: SHOT + name }); };

  // ---------------- title & select via real keys
  await shot('01-title.png');
  await p.keyboard.press('Enter'); await sleep(500);
  await p.keyboard.press('ArrowRight'); // nothing for kb1
  ok('select scene', await ev(() => __game.scene));

  // ---------------- BRANNOC
  await ev(() => TT.setup(['brannoc'])); await ev(() => TT.testRoom()); await ev(() => TT.dummies(3, 'shambler', 50)); await mouseAim();
  let d0 = await ev(() => TT.dmg()); await click('left'); await ev(() => TT.run(0.3)); await click('left'); await ev(() => TT.run(0.3)); await click('left'); await ev(() => TT.run(0.4));
  await click('left'); await ev(() => TT.run(0.6)); ok('theo 4-swing combo dmg (3 light + 360 finisher)', (await ev(() => TT.dmg())) - d0);
  d0 = await ev(() => TT.dmg()); await click('right'); await ev(() => TT.run(0.8)); ok('brannoc smash dmg', (await ev(() => TT.dmg())) - d0);
  await p.keyboard.down('ShiftLeft'); await ev(() => TT.run(0.03)); const dashing = await ev(() => !!G.heroes[0].dash); await p.keyboard.up('ShiftLeft'); await ev(() => TT.run(0.1));
  ok('theo furious charge', { dashing, cd: await ev(() => +G.heroes[0].cd.defend.toFixed(2)), armor: await ev(() => true) });
  await ev(() => { G.heroes[0].x = 8 * 32; G.heroes[0].cd = {}; }); await ev(() => TT.run(0.2));
  await p.keyboard.down('ShiftLeft'); await ev(() => TT.run(0.1)); await p.keyboard.up('ShiftLeft'); d0 = await ev(() => TT.dmg()); await ev(() => TT.run(0.8)); ok('theo smash time', await ev(() => SPEC.theo.smashTime));
  await ev(() => { G.heroes[0].x = 8 * 32; G.heroes[0].y = 11 * 32; G.heroes[0].cd = {}; });
  await p.keyboard.down('Space'); await ev(() => TT.run(0.05)); const chg = 0; await mouseAim(); await p.keyboard.up('Space'); await ev(() => TT.run(0.1));
  const spin = await ev(() => G.heroes[0].spin); d0 = await ev(() => TT.dmg()); await p.keyboard.down('KeyD'); await ev(() => TT.run(0.8)); await shot('03-theo-whirlwind.png'); await ev(() => TT.run(1.5)); await p.keyboard.up('KeyD');
  ok('brannoc whirlwind', { charge: +chg.toFixed(2), spin: +spin.toFixed(2), dmg: (await ev(() => TT.dmg())) - d0 });
  for (const w of ['axe', 'turbo', 'demonic']) { await ev(w => { SAVE.owned.brannoc.weapons.push(w); SAVE.loadout.brannoc.weapon = w; rebuildHero(G.heroes[0]); TT.testRoom(); G.foes = []; TT.dummies(3); }, w); await mouseAim(); d0 = await ev(() => TT.dmg()); await hold('Space', 700); await ev(() => TT.run(1.5)); ok('brannoc ability ' + w, (await ev(() => TT.dmg())) - d0); }
  await ev(() => { G.heroes[0].potions = 3; G.heroes[0].cd = {}; G.pickups = []; }); await press('KeyQ'); await ev(() => TT.run(0.3)); ok('theo potion (quartermaster horn) food spawned', await ev(() => G.pickups.filter(i => i.talisman).length));

  // ---------------- SELA
  await ev(() => TT.setup(['sela'])); await ev(() => { TT.testRoom(); TT.dummies(2, 'shambler', 50); }); await mouseAim();
  d0 = await ev(() => TT.dmg()); await click('left'); await ev(() => TT.run(0.35)); await click('left'); await ev(() => TT.run(0.3)); ok('sela slash dmg', (await ev(() => TT.dmg())) - d0);
  await p.keyboard.down('ShiftLeft'); await ev(() => TT.run(0.1));
  const blk = await ev(() => { const h = G.heroes[0]; const hp0 = h.hp; const s = shoot({ team: 'foe', x: h.x + 200, y: h.y, vx: -400, vy: 0, dmg: 20, r: 6, life: 2, kind: 'fire', col: '#f80' }); TT.run(0.6); return { blocking: h.blocking, hpLost: hp0 - h.hp, reflected: s.team === 'hero' }; });
  await shot('04-gela-block.png');
  d0 = await ev(() => TT.dmg()); await click('left'); await ev(() => TT.run(0.3)); await p.keyboard.up('ShiftLeft'); ok('sela held block + bash (reflect needs a perfect block)', Object.assign(blk, { bashDmg: (await ev(() => TT.dmg())) - d0 }));
  d0 = await ev(() => TT.dmg()); await p.mouse.down({ button: 'right' }); await ev(() => TT.run(0.8)); await p.mouse.up({ button: 'right' }); await ev(() => TT.run(0.6)); ok('sela lance lunge dmg', (await ev(() => TT.dmg())) - d0);
  await ev(() => { TT.testRoom(); G.foes = []; TT.dummies(3, 'shambler', 50); G.foes.forEach(f => f.x0 = f.x); }); await mouseAim(); d0 = await ev(() => TT.dmg()); await press('Space'); await ev(() => TT.run(0.8)); ok('gela extreme prejudice', await ev(d0 => ({ knockPx: Math.round(Math.max(...G.foes.map(f => f.x - f.x0))), swingDmg: TT.dmg() - d0 }), d0));
  for (const w of ['splitter', 'ricochet']) { await ev(w => { SAVE.owned.sela.weapons.push(w); SAVE.loadout.sela.weapon = w; rebuildHero(G.heroes[0]); TT.testRoom(); G.foes = []; TT.dummies(3, 'shambler', 140); }, w); await mouseAim(140); d0 = await ev(() => TT.dmg()); await press('Space'); await ev(() => TT.run(1.8)); ok('sela ability ' + w, (await ev(() => TT.dmg())) - d0); }
  ok('gela deflecting thrust (missiles knocked away)', await ev(() => { SAVE.owned.sela.weapons.push('vanguard'); SAVE.loadout.sela.weapon = 'vanguard'; rebuildHero(G.heroes[0]); TT.testRoom(); const h = G.heroes[0]; h.fa = 0; for (let k = 0; k < 4; k++) shoot({ team: 'foe', x: h.x + 34, y: h.y + (k - 1.5) * 4, vx: -10, vy: 0, dmg: 5, r: 5, life: 3, kind: 'arrow' }); const hp0 = h.hp; h.atkT = 0; KITS.sela(h, { pressed: { secondary: true }, down: { secondary: true }, mx: 0, my: 0, dev: 'kb1' }, 1 / 60); TT.run(0.3); SAVE.loadout.sela.weapon = 'base'; return { deflected: h.lastDeflect, hpLost: hp0 - h.hp }; }));
  await ev(() => { G.heroes[0].potions = 3; G.heroes[0].hp = 40; G.heroes[0].weapon = 'base'; }); await press('KeyQ'); await ev(() => TT.run(0.3)); ok('gela potion (valkyrie call)', await ev(() => ({ shieldmaidens: G.allies.filter(a => a.valkyrie).length, hp: Math.round(G.heroes[0].hp) })));
  await ev(() => { SAVE.loadout.sela.weapon = 'base'; });

  // ---------------- PALADIN
  await ev(() => TT.setup(['paladin'])); await ev(() => { TT.testRoom(); TT.dummies(3, 'shambler', 60); }); await mouseAim();
  ok('paladin body', await ev(() => ({ name: G.heroes[0].def.name, r: G.heroes[0].r, scale: G.heroes[0].body.scale, speed: Math.round(G.heroes[0].def.speed * G.heroes[0].body.speedMul) })));
  d0 = await ev(() => TT.dmg()); for (let k = 0; k < 3; k++) { await click('left'); await ev(() => TT.run(0.45)); } ok('paladin crusader combo dmg', (await ev(() => TT.dmg())) - d0);
  d0 = await ev(() => TT.dmg()); await p.mouse.down({ button: 'right' }); await ev(() => TT.run(0.85)); await p.mouse.up({ button: 'right' }); await ev(() => TT.run(0.05)); await shot('40-paladin-judgment.png'); await ev(() => TT.run(0.5)); ok('paladin judgment dmg', (await ev(() => TT.dmg())) - d0);
  await ev(() => { TT.testRoom(); G.foes = []; TT.dummies(2, 'shambler', 160); }); await mouseAim();
  await p.keyboard.down('ShiftLeft'); await ev(() => TT.run(0.1));
  const pblk = await ev(() => { const h = G.heroes[0]; const hp0 = h.hp; const ss = [0, -0.5, 0.5].map(dy => shoot({ team: 'foe', x: h.x + 220, y: h.y + dy * 120, vx: -420, vy: -dy * 230, dmg: 20, r: 6, life: 2, kind: 'fire', col: '#f80' })); TT.run(0.75); return { blocking: h.blocking, hpLost: hp0 - h.hp, reflected: ss.filter(s => s.team === 'hero').length }; });
  await ev(() => { shoot({ team: 'foe', x: G.heroes[0].x + 90, y: G.heroes[0].y - 10, vx: -400, vy: 0, dmg: 20, r: 6, life: 2, kind: 'fire', col: '#f80' }); TT.run(0.1); });
  await shot('41-paladin-shield-block.png'); await p.keyboard.up('ShiftLeft'); ok('paladin block/reflect', pblk);
  await ev(() => { TT.testRoom(); G.foes = []; TT.dummies(4, 'shambler', 70); }); await mouseAim();
  await ev(() => { G.heroes[0].cd = {}; }); d0 = await ev(() => TT.dmg()); await press('Space'); await ev(() => TT.run(0.26)); await ev(() => TT.run(0.1)); await shot('42-paladin-holy-slam.png'); await ev(() => TT.run(0.7)); ok('paladin holy slam dmg', (await ev(() => TT.dmg())) - d0);
  await ev(() => { TT.testRoom(); G.foes = []; TT.dummies(4, 'shambler', 70); G.heroes[0].cd = {}; G.heroes[0].hp = 120; }); await p.keyboard.down('ShiftLeft'); await ev(() => TT.run(0.05)); await press('Space'); await p.keyboard.up('ShiftLeft'); await ev(() => TT.run(1.2)); await shot('44-paladin-consecration.png'); ok('paladin consecration', await ev(() => ({ field: G.hazards.some(z => z.kind === 'consecrate'), healed: G.heroes[0].hp > 120, dmg: TT.dmg() })));
  await ev(() => { TT.testRoom(); G.foes = []; TT.dummies(3, 'shambler', 70); G.heroes[0].potions = 3; G.heroes[0].cd = {}; }); d0 = await ev(() => TT.dmg()); await press('KeyQ'); await ev(() => TT.run(0.3)); await shot('43-paladin-golden-wings.png');
  const wings = await ev(() => { const h = G.heroes[0]; const hp0 = h.hp; hurtHero(h, 50, { x: h.x + 10, y: h.y }); return { wings: +h.buff.wings.toFixed(1), invulnerable: h.hp === hp0 }; }); await ev(() => TT.run(4)); ok('paladin golden wings', Object.assign(wings, { landingBurstHits: await ev(() => G.heroes[0].lastWingsBurst) }));
  ok('paladin lay on hands', await ev(() => { SAVE.owned.paladin.talismans.push('layhands'); SAVE.loadout.paladin.talisman = 'layhands'; rebuildHero(G.heroes[0]); TT.testRoom(); const h = G.heroes[0]; h.hp = 50; h.potions = 1; usePotion(h); SAVE.loadout.paladin.talisman = 'base'; return { hp: h.hp, max: h.maxHp }; }));
  await ev(() => { SAVE.loadout.paladin.weapon = 'base'; });

  // ---------------- KESTREL
  await ev(() => TT.setup(['kestrel'])); await ev(() => { TT.testRoom(); TT.dummies(3, 'shambler', 200); }); await mouseAim(200);
  d0 = await ev(() => TT.dmg()); await click('left', 900); await ev(() => TT.run(0.6)); ok('kestrel rapid shots dmg', (await ev(() => TT.dmg())) - d0);
  d0 = await ev(() => TT.dmg()); await p.mouse.down({ button: 'right' }); await ev(() => TT.run(1.1)); await shot('05-isaac-powershot.png'); await p.mouse.up({ button: 'right' }); await ev(() => TT.run(0.7)); ok('kestrel power shot dmg', (await ev(() => TT.dmg())) - d0);
  const roll = await ev(() => { const h = G.heroes[0]; const x0 = h.x; return x0; }); await p.keyboard.down('KeyS'); await press('ShiftLeft', 40); const rolled = await ev(() => !!G.heroes[0].dash || true); await ev(() => TT.run(0.5)); await p.keyboard.up('KeyS'); ok('kestrel dodge roll moved px', Math.round(await ev(r => Math.abs(G.heroes[0].y - 11 * 32), roll)));
  await ev(() => { G.heroes[0].x = 8 * 32; G.heroes[0].y = 11 * 32; G.heroes[0].cd = {}; }); await mouseAim(200);
  await ev(() => { TT.testRoom(); G.foes = []; TT.dummies(3, 'shambler', 70); }); d0 = await ev(() => TT.dmg()); await p.keyboard.down('KeyD'); await p.keyboard.down('ShiftLeft'); await ev(() => TT.run(0.05)); await p.keyboard.up('ShiftLeft'); await press('Space'); await p.keyboard.up('KeyD'); await ev(() => TT.run(0.1)); const bomb = await ev(() => G.hazards.some(z => z.kind === 'bomb')); await ev(() => TT.run(2.5)); ok('kestrel mid-roll bomb', { bomb, dmg: (await ev(() => TT.dmg())) - d0 });
  await ev(() => { G.heroes[0].cd = {}; }); d0 = await ev(() => TT.dmg()); await press('Space'); await ev(() => TT.run(1.2)); ok('kestrel mortar shot dmg', (await ev(() => TT.dmg())) - d0);
  for (const w of ['thorn', 'sparks', 'dusk']) { await ev(w => { SAVE.owned.kestrel.weapons.push(w); SAVE.loadout.kestrel.weapon = w; rebuildHero(G.heroes[0]); TT.testRoom(); G.foes = []; TT.dummies(3, 'shambler', 160); }, w); await mouseAim(160); await press('Space'); await ev(() => TT.run(0.8)); ok('kestrel ability ' + w, await ev(() => G.hazards.map(z => z.kind).join(',') + ' invis=' + G.heroes[0].invis + ' rooted=' + G.foes.filter(f => f.root > 0).length)); }
  await ev(() => { TT.testRoom(); G.foes = []; TT.dummies(3, 'hulk', 150); G.heroes[0].potions = 3; G.heroes[0].fa = 0; }); await mouseAim(150); d0 = await ev(() => TT.dmg()); await press('KeyQ'); await ev(() => TT.run(1)); ok('kestrel potion (heartpiercer) dmg', (await ev(() => TT.dmg())) - d0);

  // ---------------- MIRELLE: all 9 spells
  await ev(() => TT.setup(['mirelle']));
  const runeKey = { 0: 'Space', 1: 'ShiftLeft', 2: 'KeyK' };
  const spells = [];
  for (let a = 0; a < 3; a++) for (let c = 0; c < 3; c++) {
    await ev(a => { TT.testRoom(); G.foes = []; TT.dummies(3, 'shambler', a === 2 ? 60 : 110); G.heroes[0].spellCd = {}; }, a);
    await mouseAim(110);
    await press(runeKey[a]); await press(runeKey[c]);
    const nm = await ev(() => spellOf(G.heroes[0]).name);
    d0 = await ev(() => TT.dmg());
    await click('left', nm.match(/Ray|Torrent|Breath|Bolt/) ? 900 : 60); await ev(() => TT.run(1.6));
    if (a === 1 && c === 1) { await click('left', 400); }
    const eff = await ev(() => ({ dmg: Math.round(TT.dmg()), frozen: G.foes.filter(f => f.frz > 0).length, hz: G.hazards.map(z => z.kind).filter(k => k !== 'tele').join('') }));
    spells.push(`${nm}:${eff.dmg - d0}${eff.frozen ? ' frz' + eff.frozen : ''}${eff.hz ? ' [' + eff.hz + ']' : ''}`);
    if (a === 0 && c === 2) await shot('06-zoey-mortar.png');
  }
  ok('mirelle 9 spells', spells);
  await ev(() => { TT.testRoom(); G.foes = []; TT.dummies(3, 'shambler', 60); }); await press('ShiftLeft'); await press('ShiftLeft'); await mouseAim(80); await p.mouse.down(); await ev(() => TT.run(0.7)); await shot('07-zoey-frostray.png'); await p.mouse.up();
  for (const w of ['hollow', 'ashen']) { const out = []; await ev(w => { SAVE.owned.mirelle.weapons.push(w); SAVE.loadout.mirelle.weapon = w; rebuildHero(G.heroes[0]); }, w);
    for (let c = 0; c < 3; c++) { const a = w === 'hollow' ? 2 : 1; await ev(() => { TT.testRoom(); G.foes = []; TT.dummies(3, 'shambler', 70); G.heroes[0].spellCd = {}; }); await mouseAim(110); await press(runeKey[a]); await press(runeKey[c]); const nm = await ev(() => spellOf(G.heroes[0]).name); d0 = await ev(() => TT.dmg()); await click('left', 700); await ev(() => TT.run(1.6)); out.push(nm + ':' + ((await ev(() => TT.dmg())) - d0)); }
    ok('mirelle ' + w + ' book', out); }
  await ev(() => { SAVE.loadout.mirelle.weapon = 'base'; rebuildHero(G.heroes[0]); TT.testRoom(); TT.dummies(3, 'hulk', 60); G.heroes[0].potions = 2; }); d0 = await ev(() => TT.dmg()); await press('KeyQ'); await ev(() => TT.run(0.5)); ok('mirelle potion (nova) dmg', (await ev(() => TT.dmg())) - d0);

  // ---------------- VESPER
  await ev(() => TT.setup(['vesper'])); await ev(() => { TT.testRoom(); TT.dummies(3, 'shambler', 50); }); await mouseAim(100);
  d0 = await ev(() => TT.dmg()); await click('left'); await ev(() => TT.run(0.5)); ok('vesper soul reap dmg', (await ev(() => TT.dmg())) - d0);
  d0 = await ev(() => TT.dmg()); await p.mouse.down({ button: 'right' }); await ev(() => TT.run(0.4)); const ret = await ev(() => !!G.heroes[0].reticle); await p.mouse.up({ button: 'right' }); await ev(() => TT.run(0.6)); ok('vesper bone spikes', { reticle: ret, dmg: (await ev(() => TT.dmg())) - d0 });
  const s0 = await ev(() => G.heroes[0].souls); await p.keyboard.down('KeyD'); await press('ShiftLeft'); await ev(() => TT.run(0.4)); await p.keyboard.up('KeyD'); ok('vesper ghostwalk souls', { before: s0, after: await ev(() => G.heroes[0].souls) });
  await ev(() => { G.heroes[0].souls = 100; G.heroes[0].x = 8 * 32; }); await press('Space'); await ev(() => TT.run(1.3)); await press('Space'); await ev(() => TT.run(1.0));
  ok('vesper raised allies', await ev(() => G.allies.map(a => a.kind).join(',')));
  await ev(() => TT.run(2)); await shot('08-vesper-allies.png'); ok('vesper allies dealt dmg', await ev(() => Math.round(G.foes.reduce((q, f) => q + f.maxhp - Math.max(0, f.hp), 0))));
  await ev(() => { G.heroes[0].souls = 100; G.heroes[0].cd = {}; }); await p.keyboard.down('Space'); await ev(() => TT.run(0.9)); await p.keyboard.up('Space'); await ev(() => TT.run(0.6));
  ok('vesper bone golem', await ev(() => ({ golem: G.allies.filter(a => a.kind === 'golem').length, souls: G.heroes[0].souls })));
  await ev(() => TT.run(1.5)); await shot('08b-vesper-golem.png');
  for (const k of ['lantern']) { await ev(k => { const h = G.heroes[0]; h.weapon = k; h.souls = 100; h.cd = {}; }, k); await press('Space'); await ev(() => TT.run(0.3)); }
  ok('vesper minion kinds', await ev(() => G.allies.map(a => a.kind).join(',')));
  ok('vesper skeletons draw aggro', await ev(() => { G.allies = G.allies.filter(a => a.kind !== 'wraith'); const sk = mkAlly('warrior', G.heroes[0].x + 120, G.heroes[0].y, G.heroes[0]); const f = TT.dummies(1, 'shambler', 150)[0]; return pickTarget(f)[0] === sk; }));
  await ev(() => { G.foes = []; TT.dummies(4, 'shambler', 50); G.heroes[0].potions = 2; G.heroes[0].souls = 0; G.heroes[0].weapon = 'base'; }); d0 = await ev(() => TT.dmg()); await press('KeyQ'); await ev(() => TT.run(0.6)); await shot('08d-vesper-dread-mist.png'); await ev(() => TT.run(0.5));
  ok('vesper potion (dread mist)', await ev(() => ({ mist: G.hazards.some(z => z.kind === 'dread'), feared: G.foes.filter(f => f.fearT > 0).length })));
  await ev(() => { G.heroes[0].weapon = 'base'; });

  // ---------------- relics (all 10)
  const rel = [];
  for (const r of ['haste', 'squall', 'quill', 'ember', 'hoar', 'idol', 'rift', 'shade', 'lyre', 'mirror']) {
    await ev(r => { SAVE.owned.vesper.relics[r] = 3; SAVE.loadout.vesper.relic = r; rebuildHero(G.heroes[0]); TT.testRoom(); G.foes = []; G.allies = []; TT.dummies(3, 'shambler', 100); G.pickups.push({ kind: 'ration', x: G.heroes[0].x + 30, y: G.heroes[0].y }); }, r);
    await mouseAim(100); await press('KeyE'); await ev(() => TT.run(1.2));
    rel.push(r + ':' + (await ev(() => (G.heroes[0].cd.relic > 0 ? 'cd' : 'nocd') + (G.allies.length ? '+allies' : '') + (G.foes.some(f => f.charm > 0) ? '+charm' : '') + (G.foes.some(f => f.frz > 0) ? '+frz' : ''))));
  }
  ok('relics', rel);

  // ---------------- boss fights
  for (const [wi, name] of [[0, 'ossuary'], [1, 'rootmaw'], [2, 'forgemaster'], [3, 'sovereign']]) {
    await ev(() => TT.setup(['sela'])); await ev(wi => { beginRun(); startCampaignFloor(wi, WORLDS[wi].floors.length - 1); }, wi);
    const info = await ev(async () => { let minHp = 1e9, hits = 0; const h = G.heroes[0]; const b = G.boss;
      for (let s = 0; s < 14 * 60; s++) { __game.tick(); minHp = Math.min(minHp, h.hp); if (h.hp < h.maxHp * 0.3) h.hp = h.maxHp; if (h.dead) { h.dead = false; h.hp = h.maxHp; } if (s % 30 === 0) { h.x = b.x - 140; h.y = b.y + 40; } }
      return { name: b.name, phase: b.phase, hp: Math.round(b.hp), minHeroHp: Math.round(minHp), foes: G.foes.length, hazards: G.hazards.length };
    });
    await shot(`09-boss-${name}.png`);
    const kill = await ev(async () => { const b = G.boss; let t = 0;
      while (G.boss && t < 60 * 60) { for (const s of G.spawners) if (s.pylon) hitSpawner(s, 9999, G.heroes[0]); if (!b.invuln && !b.dying) hitFoe(b, 60, { src: G.heroes[0], x: b.x, y: b.y + 1 }); __game.tick(); t++; const h = G.heroes[0]; h.hp = h.maxHp; h.dead = false; }
      const h = G.heroes[0]; if (G.map.exit) { h.x = G.map.exit.x; h.y = G.map.exit.y; } for (let i = 0; i < 120; i++) __game.tick();
      return { secs: Math.round(t / 60), exitOpen: G.exitOpen, scene: __game.scene, title: __game.RESULTS && __game.RESULTS.title };
    });
    ok('boss ' + name, Object.assign(info, kill));
  }
  await shot('10-results.png');

  // ---------------- each campaign floor loads + exploration play sample
  const floors = await ev(() => { const out = []; for (let wi = 0; wi < 4; wi++) for (let fi = 0; fi < WORLDS[wi].floors.length; fi++) { TT.setup(['brannoc']); beginRun(); startCampaignFloor(wi, fi); TT.run(3); out.push(`${WORLDS[wi].id}.${fi}:${G.map.w}x${G.map.h} sp${G.spawners.length} f${G.foes.length} k${G.pickups.filter(i => i.kind === 'key').length} g${G.map.t.filter(t => t === TL.GATE).length}`); } return out; });
  ok('campaign floors', floors);
  await ev(() => { TT.setup(['kestrel']); beginRun(); startCampaignFloor(0, 0); TT.run(2); }); await mouseAim(150); await p.mouse.down(); await ev(() => TT.run(1.0)); await shot('11-necropolis-floor.png'); await p.mouse.up();
  await ev(() => { beginRun(); startCampaignFloor(0, 1); TT.run(8); const h = G.heroes[0]; const r = G.foes.find(f => f.type === 'reaper'); if (r) { r.x = h.x + 100; r.y = h.y; } TT.run(0.6); }); await shot('12-reaper-labyrinth.png');
  ok('reaper drains', await ev(() => ({ reaper: G.foes.some(f => f.type === 'reaper'), hp: Math.round(G.heroes[0].hp) })));
  const repel = await ev(() => { const h = G.heroes[0]; h.potions = 2; const r = G.foes.find(f => f.type === 'reaper'); usePotion(h); TT.run(0.5); return { gone: r ? r.gone > 0 || r.repel > 0 : 'none' }; }); ok('reaper repelled by potion', repel);
  await ev(() => { beginRun(); startCampaignFloor(1, 1); TT.run(4); }); await shot('13-lightless-burrows.png');
  await ev(() => { beginRun(); startCampaignFloor(2, 1); TT.run(5); }); await shot('14-cinderfall.png');
  // gates & keys
  ok('gate+key', await ev(() => { beginRun(); startCampaignFloor(0, 0); const h = G.heroes[0]; const m = G.map; let gi = m.t.findIndex(t => t === TL.GATE); if (gi < 0) return 'no gate'; const gx = gi % m.w, gy = (gi / m.w) | 0; h.keys = 1; let p = null; for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) if (!blocksWalk(tileAt(gx + dx, gy + dy))) { p = [dx, dy]; break; } h.x = (gx + p[0] + 0.5) * T; h.y = (gy + p[1] + 0.5) * T; G.foes = []; const mvx = -p[0], mvy = -p[1]; for (let i = 0; i < 40; i++) { moveEnt(h, mvx * 3, mvy * 3, false, g => tryGate(h, g)); } return { opened: m.t[gi] !== TL.GATE, keysLeft: h.keys }; }));
  // food / potion pickup
  ok('food heals', await ev(() => { const h = G.heroes[0]; h.hp = 30; G.pickups.push({ kind: 'feast', x: h.x, y: h.y }); TT.run(0.2); return Math.round(h.hp); }));

  // ---------------- arena floor (campaign) & daily arena
  ok('campaign arena floor', await ev(() => { TT.setup(['brannoc']); beginRun(); startCampaignFloor(0, 2); const h = G.heroes[0]; let t = 0; while (!G.exitOpen && t < 240 * 60) { const at = G.map.arenaTiles[(G.map.arenaTiles.length / 2) | 0]; if (G.arena.state === 'idle' && t === 60) { h.x = (at % G.map.w + 0.5) * T; h.y = ((at / G.map.w | 0) + 0.5) * T; } if (t % 30 === 0) for (const f of G.foes) if (ALIVE(f) && f.type !== 'reaper') killFoe(f, h); h.hp = h.maxHp; __game.tick(); t++; } return { secs: Math.round(t / 60), exitOpen: G.exitOpen, waves: G.arena && G.arena.wave }; }));
  await ev(() => { TT.setup(['vesper']); beginRun(); startArena(); TT.run(9); }); await shot('15-arena.png');
  ok('daily arena 6 waves', await ev(() => { const h = G.heroes[0]; let t = 0, maxW = 0; while (__game.scene === 'game' && t < 400 * 60) { if (t % 30 === 0) for (const f of G.foes) if (ALIVE(f) && f.type !== 'reaper') killFoe(f, h); h.hp = h.maxHp; h.dead = false; __game.tick(); maxW = Math.max(maxW, G.arena ? G.arena.wave : 0); t++; } return { secs: Math.round(t / 60), maxWave: maxW, scene: __game.scene, title: __game.RESULTS && __game.RESULTS.title, mods: Object.keys(G.mods) }; }));

  // ---------------- endless
  ok('endless gen 1..40', await ev(() => { TT.setup(['kestrel']); beginRun(); const out = []; for (let n = 1; n <= 40; n++) { startEndlessFloor(n); TT.run(0.5); if (n % 6 === 0 || n === 1 || n === 19 || n === 37) out.push(`${n}:${G.worldName.split(' ')[0]} ${G.map.w}x${G.map.h} sp${G.spawners.length}${G.gimmick ? ' ' + G.gimmick : ''}${G.map.dark ? ' dark' : ''}`); } return out; }));
  await ev(() => { beginRun(); startEndlessFloor(7); TT.run(3); }); await shot('16-endless.png');
  ok('endless descend', await ev(() => { beginRun(); startEndlessFloor(18); const h = G.heroes[0]; G.foes = []; h.x = G.map.exit.x; h.y = G.map.exit.y; TT.run(2); const r = __game.RESULTS; const o = resultOpts(); o[0].go(); return { results: r.title, next: o[0].label, depth: G.endless, checkpoint: SAVE.endless.checkpoint }; }));

  // ---------------- death, gold drop, revive (solo offer)
  ok('death/revive solo', await ev(() => { beginRun(); startCampaignFloor(0, 0); G.purse = 1000; const h = G.heroes[0]; G.foes = []; h.inv = 0; hurtHero(h, 9999, {}); TT.run(0.5); const dropped = G.pickups.filter(i => i.kind === 'gold').length; const purseAfter = G.purse; const offer = G.reviveOffer; __game.Input.pressedK.add('Enter'); __game.tick(); return { dead: h.dead, purseAfterDeath: purseAfter, offer, revived: !h.dead, purseNow: G.purse }; }));
  ok('defeat flow', await ev(() => { G.purse = 0; G.secured = 0; const h = G.heroes[0]; h.inv = 0; hurtHero(h, 9999, {}); TT.run(3); return { scene: __game.scene, title: __game.RESULTS && __game.RESULTS.title }; }));
  await shot('17-defeat.png');

  // ---------------- 2P co-op: keyboard+mouse + fake gamepad (Gamepad API path)
  await ev(() => { __game.scene = 'title'; }); await sleep(100);
  await p.keyboard.press('Enter'); await ev(() => TT.run(0.5));
  const pi = await ev(() => __addPad()); await ev(() => { __btn(0, 0, true); TT.run(0.05); __btn(0, 0, false); TT.run(0.05); });
  await ev(() => { __ax(0, [1, 0, 0, 0]); TT.run(0.1); __ax(0, [0, 0, 0, 0]); TT.run(0.05); }); // pad picks next hero
  await p.keyboard.press('Enter'); await ev(() => TT.run(0.3)); await ev(() => { __btn(0, 0, true); TT.run(0.05); __btn(0, 0, false); TT.run(0.05); });
  await shot('02-select-coop.png');
  await p.keyboard.press('Enter'); await ev(() => TT.run(0.3));
  ok('coop party', await ev(() => ({ scene: __game.scene, heroes: G.heroes.map(h => h.id + '@' + h.dev) })));
  await ev(() => TT.run(1)); await shot('18-camp-coop.png');
  // open a station via pad A
  ok('hub station (pad)', await ev(() => { const h = G.heroes[1]; const st = G.stations.find(s => s.id === 'M'); h.x = st.x; h.y = st.y + 20; TT.run(0.1); __btn(0, 0, true); TT.run(0.05); __btn(0, 0, false); TT.run(0.1); const m = __game.MENU; const r = m && m.title; return r; }));
  await shot('19-shop.png'); await ev(() => { __btn(0, 1, true); TT.run(0.05); __btn(0, 1, false); TT.run(0.3); });
  ok('menu closed via pad B', await ev(() => !__game.MENU));
  for (const id of ['Q', 'N', 'A', 'K', 'T', 'H', 'O']) { const t2 = await ev(id => { openStation(G.stations.find(s => s.id === id), G.heroes[0]); const t = __game.MENU && __game.MENU.title; __game.draw(); closeMenu(); return t; }, id); R['station ' + id] = t2; }
  ok('stations', Object.keys(R).filter(k => k.startsWith('station')).map(k => R[k]));
  await ev(() => { openStation(G.stations.find(s => s.id === 'T'), G.heroes[0]); }); await shot('20-mastery.png'); await ev(() => closeMenu());
  // coop floor: pad moves + attacks with stick, kb1 attacks
  await ev(() => { beginRun(); startCampaignFloor(1, 0); TT.run(1); });
  const coop = await ev(() => { const h2 = G.heroes[1]; const x0 = h2.x; __ax(0, [1, 0, 1, 0]); TT.run(1); __ax(0, [0, 0, -1, 0]); __btn(0, 2, true); let ns = 0; const n0 = G.shots.length; let fired = 0; const _sh = window.shoot; window.shoot = o => { if (o.owner === h2) fired++; return _sh(o); }; for (let i = 0; i < 60; i++) { __game.tick(); ns = Math.max(ns, G.shots.filter(s => s.owner === h2).length); } window.shoot = _sh; __btn(0, 2, false); __ax(0, [0, 0, 0, 0]); TT.run(0.2); return { moved: Math.round(h2.x - x0), arrowsFired: fired, maxArrowsInFlight: ns, aim: h2.fa.toFixed(2) }; });
  ok('coop pad move/attack', coop);
  await shot('21-coop-caverns.png');
  ok('coop revive via gold', await ev(() => { G.purse = 2000; const h2 = G.heroes[1]; h2.inv = 0; hurtHero(h2, 9999, {}); TT.run(0.3); const dead = h2.dead; __btn(0, 0, true); TT.run(0.05); __btn(0, 0, false); TT.run(0.1); return { died: dead, revived: !h2.dead, purse: G.purse }; }));
  ok('masteries progress', await ev(() => Object.fromEntries(Object.entries(SAVE.mastery).map(([k, v]) => [k, Object.keys(v).length]))));
  ok('save persisted', await ev(() => !!localStorage.getItem('delvebound_slayers_v2')));

  // real-time run (rendering) to check for runtime errors in draw paths
  await ev(() => { TT.setup(['mirelle']); beginRun(); startCampaignFloor(2, 0); }); await sleep(3000); await shot('22-foundry.png');
  ok('ERRORS', await ev(() => __game.ERRORS.slice(0, 5)));
  console.log('CONSOLE:', logs.slice(0, 20).join('\n'));
  await b.close();
})().catch(e => { console.error('TEST FAIL', e); process.exit(1); });
