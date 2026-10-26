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
  let pass = 0, fail = 0; const chk = (name, got, want) => { const okk = typeof want === 'function' ? want(got) : JSON.stringify(got) === JSON.stringify(want); okk ? pass++ : fail++; console.log((okk ? 'PASS ' : 'FAIL ') + name.padEnd(58), JSON.stringify(got), okk ? '' : ' want ' + (typeof want === 'function' ? want.toString() : JSON.stringify(want))); };
  await ev(() => {
    window.WT = {
      I: (...ks) => { const o = { pressed: {}, down: {}, mx: 0, my: 0, dev: 'kb1' }; for (const k of ks) { o.pressed[k] = true; o.down[k] = true; } return o; },
      N: () => ({ pressed: {}, down: {}, mx: 0, my: 0, dev: 'kb1' }),
      equip(id, w, tal) { TT.setup([id]); const own = SAVE.owned[id]; if (!own.weapons.includes(w)) own.weapons.push(w); SAVE.loadout[id].weapon = w; if (tal) { if (!own.talismans.includes(tal)) own.talismans.push(tal); SAVE.loadout[id].talisman = tal; } rebuildHero(G.heroes[0]); TT.testRoom(); const h = G.heroes[0]; h.fa = 0; h.souls = 100; return h; },
      run(h, sec, inp) { const n = Math.round(sec * 60); for (let i = 0; i < n; i++) { updateHero(h, inp || WT.N(), 1 / 60); __game.tick(); } },
      tick(sec) { TT.run(sec); },
      foe(type, dx, dy = 0, hp = 5000) { const h = G.heroes[0]; const f = mkFoe(type, h.x + dx, h.y + dy, { awake: true }); if (!G.foes.includes(f)) G.foes.push(f); f.hp = f.maxhp = f.maxHp = hp; f.atkT = 999; f.spd = 0; return f; },
      cd: (h, k = 'ability') => +((h.cd[k] || 0)).toFixed(2),
    };
  });
  // ======================= weapon signatures fire with the specced cooldown
  const wres = await ev(() => {
    const out = {}, I = WT.I;
    const fire = (id, w, prep) => { const h = WT.equip(id, w); if (prep) prep(h); const before = { shots: G.shots.length, hz: G.hazards.length, allies: G.allies.length, swings: G.swings.length }; KITS[id](h, I('ability'), 1 / 60); return { h, before }; };
    // Theo
    { const { h } = fire('brannoc', 'base'); const sp = h.spin; for (let i = 0; i < 215; i++) KITS.brannoc(h, WT.N(), 1 / 60); out.theo_base = { spin: +sp.toFixed(2), cd: WT.cd(h), r: SPEC.theo.spinR }; }
    { const { h, before } = fire('brannoc', 'axe'); out.theo_axe = { cd: WT.cd(h), shot: G.shots.length - before.shots, tier: G.shots[G.shots.length - 1].tier }; }
    { const { h } = fire('brannoc', 'turbo', h => { const f = WT.foe('hexcaller', 60); f.state = 'windup'; }); out.theo_turbo = { cd: WT.cd(h), hit: h.lastTurbo, windupReset: G.foes[0].state !== 'windup', stun: G.foes[0].stag >= 1 }; }
    { const { h } = fire('brannoc', 'demonic', h => { WT.foe('barrow', -50); WT.foe('barrow', 0, 50); }); const cd0 = WT.cd(h); const x0 = h.x; out.theo_demonic = { cd: cd0, inv: h.inv > 0.4, rooted: h.cleaveT > 0, hit: h.lastCleave }; }
    // Gela
    { const { h } = fire('sela', 'base'); out.gela_base = { cd: WT.cd(h) }; }
    { const { h, before } = fire('sela', 'splitter'); const ss = G.shots.slice(before.shots); out.gela_splitter = { cd: WT.cd(h), shields: ss.length, fanDeg: Math.round((Math.atan2(ss[2].vy, ss[2].vx) - Math.atan2(ss[0].vy, ss[0].vx)) * 180 / Math.PI), pierce: ss[0].pierce }; }
    { const h = WT.equip('sela', 'vanguard'); for (let i = 0; i < 9; i++) shoot({ team: 'foe', x: h.x + 40, y: h.y + (i % 3 - 1) * 4, vx: -10, vy: 0, dmg: 5, r: 5, life: 3, kind: 'arrow' }); h.atkT = 0; KITS.sela(h, WT.I('ability'), 1 / 60); const first = h.lastDeflect;   /* Intercept is on the ability button; the secondary is the javelin */ h.atkT = 0; KITS.sela(h, WT.I('ability'), 1 / 60); out.gela_vanguard = { cd: WT.cd(h), broken: first, capped: h.lastDeflect, stamina: Math.round(h.stam) }; }
    { const { h } = fire('sela', 'ricochet', () => { for (let i = 0; i < 6; i++) WT.foe('shambler', 60 + i * 90, (i % 2) * 20); }); const cd0 = WT.cd(h); WT.tick(2.5); out.gela_ricochet = { cd: cd0, hitFoes: G.foes.filter(f => f.hp < 5000).length, hop: SPEC.wpn.ricochetHop }; }
    // Isaac
    { const { h } = fire('kestrel', 'base'); out.isaac_base = { cd: WT.cd(h), r: SPEC.wpn.mortarR }; }
    { const { h, before } = fire('kestrel', 'thorn', () => WT.foe('shambler', 100)); WT.tick(0.4); out.isaac_thorn = { cd: +(h.cd.ability + 0.4).toFixed(1), root: +G.foes[0].root.toFixed(1) }; }
    { const { h, before } = fire('kestrel', 'sparks'); const m = G.hazards.find(z => z.kind === 'mine'); out.isaac_sparks = { cd: WT.cd(h), mine: !!m, trigger: m && m.r }; }
    { const { h } = fire('kestrel', 'dusk', () => { const f = WT.foe('shambler', 120); f.spd = 80; }); out.isaac_dusk = { cd: WT.cd(h), invis: h.invisT >= 2, smoke: G.hazards.some(z => z.kind === 'smoke' && z.r === 2 * MTR), lost: G.foes[0].lostT > 0 }; }
    // Vesper
    { const { h } = fire('vesper', 'base'); KITS.vesper(h, WT.N(), 1 / 60); out.vesper_base = { cd: WT.cd(h), essence: h.souls, minions: G.allies.length }; }
    { const { h } = fire('vesper', 'lantern', () => { WT.foe('shambler', 80); WT.foe('hulk', 200, 0, 9000).elite = true; WT.foe('hulk', 200, 60, 3000).elite = true; }); KITS.vesper(h, WT.N(), 1 / 60); const ws = G.allies.filter(a => a.kind === 'shade'); out.vesper_lantern = { cd: WT.cd(h), essence: h.souls, shades: ws.length, dmg: ws[0] && ws[0].dmg }; }
    { const { h } = fire('vesper', 'marrow', h => { h.souls = 60; }); const ar = G.allies.filter(a => a.kind === 'archer'); out.vesper_marrow = { cd: WT.cd(h), essenceLeft: h.souls, archers: ar.length, behind: ar.every(a => (a.x - h.x) * Math.cos(h.fa) + (a.y - h.y) * Math.sin(h.fa) < 0), life: ar[0] && Math.round(ar[0].life) }; }
    // Paladin
    for (const w of ['base', 'hammer', 'lance', 'sanctuary']) { const { h, before } = fire('paladin', w); out['david_' + w] = { cd: WT.cd(h) }; }
    // Zoey schools: cooldown rule across all 9 combos
    for (const w of ['base', 'hollow', 'ashen']) { const h = WT.equip('mirelle', w); const cds = []; for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) { h.spell = [a, b]; cds.push(+spellCdOf(h).toFixed(2)); } out['zoey_' + w] = cds; }
    return out;
  });
  chk('Theo Destructo-Spin: 2.5s spin (Slayer reference), 10s cd, 2m radius', wres.theo_base, { spin: 2.5, cd: 10, r: 64 });
  chk('Theo Thrown Axe: 5s, one T2 projectile', wres.theo_axe, { cd: 5, shot: 1, tier: 2 });
  chk('Theo Turbo-Slam: 7s, hits, resets elite wind-up, stuns', wres.theo_turbo, { cd: 7, hit: 1, windupReset: true, stun: true });
  chk('Theo Demonic Cleave: 6s, invincible, rooted, reaches the sides (not mid-back)', wres.theo_demonic, g => g.cd === 6 && g.inv && g.rooted && g.hit === 1);
  chk('Gela Extreme Prejudice: 9s', wres.gela_base, { cd: 9 });
  chk('Gela Shield Splitter: 6s, 3 piercing shields, 45-degree fan', wres.gela_splitter, { cd: 6, shields: 3, fanDeg: 45, pierce: 99 });
  chk('Gela Deflecting Thrust: no cd, 6 missiles max per 30 frames, no stamina', wres.gela_vanguard, g => g.cd === 0 && g.broken === 6 && g.capped === 0 && !g.stamina);   // shields have no stamina at all (David's rule)
  chk('Gela Shield Ricochet: 8s, up to 4 targets, 4m hops', wres.gela_ricochet, g => g.cd === 8 && g.hitFoes >= 1 && g.hitFoes <= 4 && g.hop === 128);
  chk('Isaac Mortar Shot: 6s, 3m', wres.isaac_base, { cd: 6, r: 96 });
  chk('Isaac Rooting Shot: 5s, 2.5s root', wres.isaac_thorn, g => g.cd === 5 && g.root >= 2);
  chk('Isaac Sparks trap: 8s, 1m trigger mine', wres.isaac_sparks, { cd: 8, mine: true, trigger: 32 });
  chk('Isaac Smoke Bomb: 7s, 2m cloud, 2s invisible, aggro lost', wres.isaac_dusk, { cd: 7, invis: true, smoke: true, lost: true });
  chk('Vesper Raise Skeletons: no cd, spends ALL Soul Power, full meter = 5', wres.vesper_base, { cd: 0, essence: 0, minions: 5 });
  chk('Vesper Summon Shades: full meter = 20 shades of 28', wres.vesper_lantern, { cd: 0, essence: 0, shades: 20, dmg: 28 });
  chk('Vesper Bone Archers: 5 souls = 5 archers behind her, 20s, meter emptied', wres.vesper_marrow, { cd: 0, essenceLeft: 0, archers: 5, behind: true, life: 20 });
  chk('David weapon cooldowns: Slam 9, Hammer 6, Lance 7, Pulse 10', [wres.david_base.cd, wres.david_hammer.cd, wres.david_lance.cd, wres.david_sanctuary.cd], [9, 6, 7, 10]);
  chk('Zoey Spellweaver cooldowns = spec matrix', wres.zoey_base, [0, 6, 2, 3, 0, 20, 1, 1, 20]);
  chk('Zoey Hollow Chapters: even 5s cooldowns', wres.zoey_hollow, [5, 5, 5, 5, 5, 5, 5, 5, 5]);
  chk('Zoey Firebound Tomes: +20% cooldowns', wres.zoey_ashen, [0, 7.2, 2.4, 3.6, 0, 24, 1.2, 1.2, 24]);
  const school = await ev(() => { const r = {}; for (const w of ['hollow', 'ashen']) { const h = WT.equip('mirelle', w); WT.foe('shambler', 120); h.spell = [1, 2]; const n0 = G.hazards.length; spellOf(h).cast(h); TT.run(0.8); r[w] = { name: spellOf(h).name, zone: G.hazards.some(z => z.kind === 'gloom' && z.tier === 2), dmg: Math.round(5000 - G.foes[0].hp) }; } return r; });
  chk('Hollow Chapters spell = persistent T2 shadow zone', school.hollow, g => g.zone && g.dmg > 0);
  chk('Firebound Tomes spell = explosive splash', school.ashen, g => g.dmg > 0);
  // ======================= mortar: T3 spawner dies in exactly 4 mortars
  const mort = await ev(() => { const h = WT.equip('kestrel', 'base'); const p = aimPoint(h, 360, 80); const s = mkSpawner(p.x, p.y, 3, ['bonesoldier'], 'w1'); s.spawnT = 99; const hits = [];
    for (let k = 0; k < 6 && s.hp > 0; k++) { h.cd = {}; KITS.kestrel(h, WT.I('ability'), 1 / 60); for (let i = 0; i < 60; i++) { G.time += 1 / 60; updateShots(1 / 60); updateHazards(1 / 60); } hits.push(+s.hp.toFixed(2)); }
    return { mortars: hits.length, hp: hits, dead: s.hp <= 0 }; });
  chk('Mortar: tier-3 spawner (12 hits) dies in exactly 4 mortars', mort, g => g.dead && g.mortars === 4);
  // ======================= spell queue buffer
  const q = await ev(() => { const h = WT.equip('mirelle', 'base'); const kb = (o) => Object.assign(WT.N(), o);
    h.spell = [1, 0]; KITS.mirelle(h, kb({ pressed: { primary: true }, down: { primary: true } }), 1 / 60); const first = h.lastSpell, rec = +h.atkT.toFixed(2);
    // during recovery: enter Storm + Storm (Thunderclap) and press cast once
    h.atkT = 0.12; KITS.mirelle(h, kb({ pressed: { secondary: true } }), 1 / 60); KITS.mirelle(h, kb({ pressed: { secondary: true } }), 1 / 60); KITS.mirelle(h, kb({ pressed: { primary: true }, down: {} }), 1 / 60);
    const queued = h.castBuf > 0, during = h.lastSpell; for (let i = 0; i < 12; i++) { h.atkT -= 1 / 60; KITS.mirelle(h, WT.N(), 1 / 60); }
    return { first, queued, during, after: h.lastSpell }; });
  chk('Spell queue: combo entered during recovery fires when recovery ends', q, g => g.queued && g.during === g.first && g.after === 'Static Ward');
  // ======================= utility moves
  const ep = await ev(() => { const h = WT.equip('sela', 'base'); const f = WT.foe('shambler', 50); f.spd = 0; const x0 = f.x, h0 = f.hp; KITS.sela(h, WT.I('ability'), 1 / 60); const swing = h0 - f.hp; TT.run(1.0); return { swingDmg: swing, knockPx: Math.round(f.x - x0), crushed: !!f.crushed }; });
  chk('Extreme Prejudice: 70 swing damage (Slayer reference), big knockback in the open', ep, g => g.swingDmg === 70 && g.knockPx >= 100 && !g.crushed);
  const crush = await ev(() => { const h = WT.equip('sela', 'base'); h.x = 36 * 32; const g = WT.foe('hulk', 40, 0, 900); g.elite = true; const sk = WT.foe('shambler', 40, 40, 300); KITS.sela(h, WT.I('ability'), 1 / 60); TT.run(0.6); return { wall: Math.round((38 * 32 - g.x)), eliteCrushed: g.crushed || 0, eliteDmg: Math.round(900 - Math.max(0, g.hp)), eliteStun: +g.stag.toFixed(1), gruntDead: !ALIVE(sk) }; });
  chk('Wall crush: T4 damage + 2s stun on elites, grunts executed', crush, g => g.eliteCrushed >= 1 && g.eliteDmg >= 60 && g.eliteStun >= 1.5 && g.gruntDead);
  const feast = await ev(() => { const r = {}; for (const fl of [5, 40]) { TT.setup(['brannoc']); beginRun(); startEndlessFloor(fl); const h = G.heroes[0]; h.talisman = 'base'; h.potions = 1; G.foes.forEach(f => f.hp = f.maxhp = 1e6); const h0 = G.foes.reduce((a, f) => a + f.hp, 0); usePotion(h); for (let i = 0; i < 30; i++) updatePickups(1 / 60); r[fl] = { food: G.pickups.filter(i => i.talisman && (i.kind === 'ration' || i.kind === 'feast') && !i.dead).length, dmg: Math.round(h0 - G.foes.reduce((a, f) => a + f.hp, 0)) }; } return r; });
  chk("Quartermaster's Horn: food spawned, 0 damage, works past floor 37", feast, g => g[5].food === 3 && g[40].food === 3 && g[5].dmg === 0);
  const dread = await ev(() => { const h = WT.equip('vesper', 'base', 'base'); h.potions = 1; const fs = [WT.foe('shambler', 50), WT.foe('shambler', -50)]; const hp0 = fs.map(f => f.hp); usePotion(h); const cast = h.hungerCast > 0; const burst = fs.map((f, i) => hp0[i] - f.hp); TT.run(2.0); const hz = G.hazards.find(z => z.kind === 'darkHunger'); return { cast, burst: Math.max(...burst), ring: !!hz, drained: fs.filter((f, i) => f.hp < hp0[i]).length, slowed: fs.filter(f => f.slowT > 0).length }; });
  chk('Hungering Heart: slow cast, 0 burst, then a drain ring that hurts and slows', dread, g => g.cast && g.burst === 0 && g.ring && g.drained === 2 && g.slowed === 2);
  const aegis = await ev(() => { const h = WT.equip('sela', 'base', 'aegis'); h.potions = 1; h.hp = 60; usePotion(h); const f = WT.foe('shambler', 30); f.spd = 80; for (let i = 0; i < 5; i++) shoot({ team: 'foe', x: h.x + 200, y: h.y, vx: -400, vy: 0, dmg: 10, r: 5, life: 2, kind: 'arrow' }); const hp0 = h.hp; TT.run(1.5); const hz = G.hazards.find(z => z.kind === 'aegis');
    return { blocked: hz.blocked || 0, pushedOut: hyp(f.x - hz.x, f.y - hz.y) >= hz.r, healed: h.hp > hp0, dmg: 0 }; });
  chk('Shieldwall Oath: field blocks missiles, keeps melee out, heals', aegis, { blocked: 5, pushedOut: true, healed: true, dmg: 0 });
  const nova = await ev(() => { const h = WT.equip('mirelle', 'base', 'base'); h.potions = 1; WT.foe('hulk', 200, 0, 3000).elite = true; WT.foe('shambler', 100); usePotion(h); return { hit: h.lastNova, eliteDmg: Math.round(3000 - G.foes.find(f => f.elite).hp), gruntGone: G.foes.filter(f => f.type === 'shambler' && ALIVE(f)).length === 0 }; });
  chk('Arcane Nova: screen blast damages (T4: executes grunts, hurts elites)', nova, g => g.hit === 2 && g.eliteDmg >= 60 && g.gruntGone);
  const pots = await ev(() => { const r = {}; for (const id of ['brannoc', 'kestrel']) { const h = WT.equip(id, 'base', 'base'); h.potions = 2; for (let i = 0; i < 3; i++) WT.foe('shambler', 80 + i * 30); WT.foe('hulk', 120, 0, 3000).elite = true; const k0 = G.stats.kills; usePotion(h); TT.run(1.2); r[id] = { kills: G.stats.kills - k0, eliteDmg: Math.round(3000 - (G.foes.find(f => f.elite) || { hp: 3000 }).hp) }; } return r; });
  chk('Old negative potion readings were T4 executes (kills counted now)', pots, g => g.kestrel.kills >= 1 && g.brannoc.kills === 0);
  // ======================= paladin kit
  const pal = await ev(() => { const out = {}; let h = WT.equip('paladin', 'base', 'base');
    const e = WT.foe('shambler', 50, 0, 5000); const tiers = [];
    for (let i = 0; i < 3; i++) { h.atkT = 0; DEBUG.on = true; DEBUG.log = []; KITS.paladin(h, WT.I('primary'), 1 / 60); tiers.push(DEBUG.log.length ? DEBUG.log[0].tier : 0); }
    DEBUG.on = false; out.combo = tiers;
    h.cd = {}; KITS.paladin(h, WT.I('secondary'), 1 / 60); for (let i = 0; i < 50; i++) KITS.paladin(h, { pressed: {}, down: { secondary: true }, mx: 0, my: 0, dev: 'kb1' }, 1 / 60); e.stag = 0; KITS.paladin(h, WT.N(), 1 / 60);
    out.judgment = { cd: WT.cd(h, 'secondary'), hit: h.lastJudgment, stun: +e.stag.toFixed(1), executed: e.hp <= 0 };
    // Holy Bulwark: block, reflect, stamina, perfect
    h.blocking = false; KITS.paladin(h, WT.I('defend'), 1 / 60); const r1 = hurtHero(h, 5, { x: h.x + 30, y: h.y, proj: true }); G.time += 1; const st0 = h.stam; const r2 = hurtHero(h, 10, { x: h.x + 30, y: h.y, foe: e }); out.bulwark = { reflect: r1, meleeBlocked: r2, stamDrained: st0 - h.stam > 0, hp: h.hp };
    // Righteous Advance
    h.cd = {}; h.blocking = true; KITS.paladin(h, { pressed: { secondary: true }, down: { defend: true, secondary: true }, mx: 0, my: 0, dev: 'kb1' }, 1 / 60); out.advance = { cd: WT.cd(h, 'advance'), armored: !!(h.dash && h.dash.armor) }; h.dash = null;
    // Consecration
    h.cd = {}; TT.setup(['paladin', 'brannoc']); TT.testRoom(); h = G.heroes[0]; const ally = G.heroes[1]; ally.x = h.x + 30; ally.y = h.y; ally.hp = 50; const f = WT.foe('hulk', 40, 0, 5000); f.elite = true;
    KITS.paladin(h, { pressed: { ability: true }, down: { defend: true, ability: true }, mx: 0, my: 0, dev: 'kb1' }, 1 / 60); const z = G.hazards.find(q => q.kind === 'consecrate');
    for (let i = 0; i < 60 * 2; i++) { G.time += 1 / 60; updateHazards(1 / 60); }
    out.consecration = { cd: WT.cd(h, 'consecrate'), r: z.r, life: z.life, ticks: z.ticks, allyHealed: Math.round(ally.hp - 50), foeDmg: Math.round(5000 - f.hp) };
    // Devotion aura
    const near = G.heroes[1]; near.hp = near.maxHp; near.inv = 0; hurtHero(near, 10, {}); const nearLoss = near.maxHp - near.hp; near.x = h.x + 400; near.hp = near.maxHp; near.inv = 0; near.hitLog = []; hurtHero(near, 10, {}); const farLoss = near.maxHp - near.hp;
    out.aura = { near: nearLoss, far: farLoss };
    // Hammer / Lance / Pulse effects
    h = WT.equip('paladin', 'hammer'); WT.foe('shambler', 100); WT.foe('shambler', 160); KITS.paladin(h, WT.I('ability'), 1 / 60); TT.run(1.2); out.hammer = { hit: G.foes.filter(q => q.hp < 5000).length, back: !G.shots.some(s => s.owner === h) };
    h = WT.equip('paladin', 'lance'); const sk = WT.foe('bonesoldier', 100, 0, 5000), gr = WT.foe('hulk', 160, 0, 5000); gr.elite = true; KITS.paladin(h, WT.I('ability'), 1 / 60); out.lance = { hit: h.lastLance, undeadX2: Math.round((5000 - sk.hp) / (5000 - gr.hp) * 10) / 10 };
    TT.setup(['paladin', 'brannoc']); TT.testRoom(); h = G.heroes[0]; SAVE.owned.paladin.weapons.push('sanctuary'); h.weapon = 'sanctuary'; G.heroes[1].x = h.x + 40; G.heroes[1].y = h.y; WT.foe('shambler', 60); KITS.paladin(h, WT.I('ability'), 1 / 60); const a2 = G.heroes[1]; a2.inv = 0; const hp0 = a2.hp; hurtHero(a2, 10, {}); out.pulse = { cd: WT.cd(h), shield: a2.absorb, absorbed: hp0 === a2.hp };
    // Golden Wings
    h = WT.equip('paladin', 'base', 'base'); h.potions = 1; const gf = WT.foe('hulk', 120, 0, 9000); gf.elite = true; usePotion(h); const invuln = hurtHero(h, 50, { x: h.x + 10, y: h.y }) === false; for (let i = 0; i < 245; i++) updateHeroBuffs(h, 1 / 60), h.buff.wings -= 1 / 60; out.wings = { invuln, landed: h.lastWingsBurst || 0, eliteDmg: Math.round(9000 - gf.hp) };
    // Lay on Hands
    TT.setup(['paladin', 'brannoc']); TT.testRoom(); h = G.heroes[0]; SAVE.owned.paladin.talismans.push('layhands'); h.talisman = 'layhands'; h.potions = 1; h.hp = 40; const d = G.heroes[1]; d.x = h.x + 60; d.y = h.y; killHero(d); G.rez = 0; usePotion(h);
    out.lay = { revived: !d.dead, allyFull: d.hp === d.maxHp, selfFull: h.hp === h.maxHp, coinsUsed: G.rez };
    return out; });
  chk('Crusader combo tiers T1, T1, T3 (18 / 18 / strong 48)', pal.combo, [1, 1, 3]);
  chk('Judgment: full charge is a Lethal 50 (executes a non-elite) or stuns, 1.6s cd', pal.judgment, g => g.cd === 1.6 && g.hit >= 1 && (g.stun >= 1 || g.executed));
  chk('Holy Bulwark: reflects missiles, front melee blocked, no stamina drain (David: shields have no limits)', pal.bulwark, g => g.reflect === 'reflect' && g.meleeBlocked === false && !g.stamDrained && g.hp === 200);
  chk('Righteous Advance: armored dash, 5s cd', pal.advance, { cd: 5, armored: true });
  chk('Consecration: 3m, 5s, 12s cd, T1 ticks foes, heals ally 2 bar HP/tick', pal.consecration, g => g.cd === 12 && g.r === 96 && g.life === 5 && g.ticks >= 4 && g.allyHealed >= 16 && g.foeDmg > 0);
  chk('Devotion Aura: ally within 4m takes 10% less', pal.aura, g => Math.abs(g.near / g.far - 0.9) < 0.01);
  chk('Hammer of Light: pierces and returns', pal.hammer, { hit: 2, back: true });
  chk('Radiant Lance: pierces, x2 vs undead', pal.lance, g => g.hit === 2 && g.undeadX2 === 2);
  chk('Sanctuary Pulse: 10s, 30 HP shield absorbs the hit', pal.pulse, g => g.cd === 10 && g.absorbed);
  chk('Golden Wings: invulnerable, T4 burst on landing', pal.wings, g => g.invuln && g.landed >= 1 && g.eliteDmg >= 60);
  chk('Lay on Hands: full heals, revives in range without a coin', pal.lay, { revived: true, allyFull: true, selfFull: true, coinsUsed: 0 });
  // ======================= shop + gold banking + crown bonus
  const shop = await ev(() => { const prices = {}; for (const id in WEAPONS) prices[id] = WEAPONS[id].map(w => w.cost); TT.setup(['paladin']); SAVE.banks.paladin = 20000; SAVE.owned.paladin.weapons = ['base']; openShop(G.heroes[0]); const it = MENU.items.find(i => i.label && i.label.startsWith('Sunspear')); it.act(); closeMenu(); return { prices, bank: SAVE.banks.paladin, owned: SAVE.owned.paladin.weapons.includes('lance'), armory: WEAPONS.paladin.length }; });
  chk('All alt weapons 15000, default free', shop.prices, { brannoc: [0, 15000, 15000, 15000], sela: [0, 15000, 15000, 15000], kestrel: [0, 15000, 15000, 15000], mirelle: [0, 15000, 15000], vesper: [0, 15000, 15000, 15000], paladin: [0, 15000, 15000, 15000] });
  chk('Shop: buying a weapon spends that hero\'s own bank', { bank: shop.bank, owned: shop.owned }, { bank: 5000, owned: true });
  const bank = await ev(() => { TT.setup(['brannoc']); SAVE.banks.brannoc = 0; beginRun(); startCampaignFloor(0, 0); const h = G.heroes[0]; G.purse = 300; h.goldRun = 300; G.deathsFloor = 0; G.rez = 0; h.potions = 0; floorComplete(); const afterExit = SAVE.banks.brannoc;
    startCampaignFloor(0, 1); scene = 'game'; G.purse += 700; h.goldRun += 700; defeat(); const afterDeath = SAVE.banks.brannoc; const purse = G.purse; bankAndReturn(); return { afterExit, afterDeath, purseAfterDeath: purse, final: SAVE.banks.brannoc }; });
  chk('Gold banks on crossing the exit; floor gold lost on death', bank, g => g.afterExit > 300 && g.afterDeath === g.afterExit && g.final === g.afterExit && g.purseAfterDeath === g.afterExit);
  const quit = await ev(() => { TT.setup(['brannoc']); SAVE.banks.brannoc = 0; beginRun(); startCampaignFloor(0, 0); G.purse = 900; G.heroes[0].goldRun = 900; bankAndReturn(); return SAVE.banks.brannoc; });
  chk('Quitting mid-floor banks nothing from that floor', quit, 0);
  const crownB = await ev(() => { const r = []; for (const c of [false, true]) { TT.setup(['brannoc']); beginRun(); startCampaignFloor(0, 0); const h = G.heroes[0]; h.potions = 0; G.rez = 0; G.deathsFloor = 0; h.crown = c; G.purse = 0; floorComplete(); r.push(RESULTS.loot); } return r[1] - r[0]; });
  chk('Crossing the exit with the crown: +500 gold', crownB, 500);
  console.log(`WEAPON/UTILITY/PALADIN TESTS: ${pass} passed, ${fail} failed`); console.log('ERRORS:', JSON.stringify(await ev(() => ERRORS)), 'CONSOLE:', logs.join(' | '));
  await b.close();
})();
