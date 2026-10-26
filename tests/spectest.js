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
  let pass = 0, fail = 0; const chk = (name, got, want) => { const okk = JSON.stringify(got) === JSON.stringify(want); okk ? pass++ : fail++; console.log((okk ? 'PASS ' : 'FAIL ') + name.padEnd(46), JSON.stringify(got), okk ? '' : ' want ' + JSON.stringify(want)); };
  const near = (a, b, e = 0.01) => Math.abs(a - b) <= e;
  // ---- hero HP, speeds, cooldowns
  const heroes = await ev(() => HEROES.map(d => { TT.setup([d.id]); const h = G.heroes[0]; return [d.id, h.maxHp, SPEC.hero[d.id].uiHp, Math.round(h.baseSpeed)]; }));
  chk('internal HP (Theo 200, Gela 150, rest 100; David 200)', heroes.map(x => [x[0], x[1]]), [['brannoc', 200], ['sela', 150], ['kestrel', 100], ['mirelle', 100], ['vesper', 100], ['paladin', 200]]);
  chk('UI HP proportions 100/75/50', heroes.map(x => x[2]), [100, 75, 50, 50, 50, 100]);
  chk('speed ratings x140 (Theo 1.0, Gela 1.25, Isaac 1.5, Zoey 0.95, Vesper 1.35, David 0.95)', heroes.map(x => x[3]), [140, 175, 210, 133, 189, 133]);
  const cds = await ev(() => {
    const out = {}; TT.setup(['brannoc']); TT.testRoom(); const h = G.heroes[0];
    const I = (k) => ({ pressed: { [k]: true }, down: { [k]: true }, mx: 0, my: 0, dev: 'kb1' });
    KITS.brannoc(h, I('defend'), 1 / 60); out.theoCharge = +h.cd.defend.toFixed(2); h.dash = null;
    KITS.brannoc(h, I('secondary'), 1 / 60); out.theoLeap = +h.cd.secondary.toFixed(2); h.dash = null; h.z = 0;
    KITS.brannoc(h, I('ability'), 1 / 60); out.theoSpin = +h.spin.toFixed(2); for (let i = 0; i < 230; i++) KITS.brannoc(h, { pressed: {}, down: {}, mx: 0, my: 0, dev: 'kb1' }, 1 / 60); out.theoSpinCd = +(h.cd.ability || 0).toFixed(1);
    TT.setup(['kestrel']); TT.testRoom(); const k = G.heroes[0]; KITS.kestrel(k, I('defend'), 1 / 60); out.isaacRollCd = +k.cd.defend.toFixed(2); out.isaacRollInv = +k.inv.toFixed(2);
    TT.setup(['vesper']); TT.testRoom(); const v = G.heroes[0]; KITS.vesper(v, I('defend'), 1 / 60); out.vesperGhostCd = +v.cd.defend.toFixed(2); out.vesperGhostInv = +v.inv.toFixed(2);
    TT.setup(['mirelle']); TT.testRoom(); const z = G.heroes[0]; z.spell = [0, 1]; SPELLS.ember[1].cast(z); out.zoeyTpInv = +z.inv.toFixed(3); out.zoeyTpDur = +z.dash.dur.toFixed(3);
    out.zoeyCds = Object.fromEntries(Object.entries(SPEC.zoey.spells).map(([k2, v2]) => [k2, v2.cd]));
    TT.setup(['sela']); TT.testRoom(); const g = G.heroes[0]; g.weapon = 'base'; KITS.sela(g, I('ability'), 1 / 60); out.gelaExecCd = +g.cd.ability.toFixed(2);
    return out; });
  chk('Theo charge/leap/spin cooldowns 5/3/12, spin 3.5s', [cds.theoCharge, cds.theoLeap, cds.theoSpin, cds.theoSpinCd], [5, 3, 3.5, 12]);
  chk('Isaac roll cd 1.5, i-frames 0.4', [cds.isaacRollCd, cds.isaacRollInv], [1.5, 0.4]);
  chk('Vesper ghostwalk cd 4, i-frames 2.0', [cds.vesperGhostCd, cds.vesperGhostInv], [4, 2]);
  chk('Zoey teleport 48 i-frames then 6 open frames', [cds.zoeyTpInv, cds.zoeyTpDur], [0.8, 0.9]);
  chk('Zoey spell cooldowns', cds.zoeyCds, { 'ember+ember': 0, 'ember+rime': 6, 'ember+storm': 4, 'rime+rime': 0, 'rime+ember': 5, 'rime+storm': 8, 'storm+storm': 10, 'storm+rime': 3, 'storm+ember': 2 });
  chk('Gela Extreme Prejudice cd 9', cds.gelaExecCd, 9);
  const inv = await ev(() => { TT.setup(['brannoc']); TT.testRoom(); const h = G.heroes[0]; h.spin = 3.5; const a = hurtHero(h, 10, { x: h.x + 10, y: h.y }); TT.setup(['sela']); TT.testRoom(); const g = G.heroes[0]; g.blocking = true; g.blockStart = -9; g.fa = 0; const b = hurtHero(g, 10, { x: g.x + 20, y: g.y }); const hpB = g.hp; return { spinHit: a, frontBlockHit: b, gelaHp: hpB }; });
  chk('i-frames: spin and Gela front shield take no damage', inv, { spinHit: false, frontBlockHit: false, gelaHp: 150 });
  // ---- endless scaling
  const sc = await ev(() => { const fl = [1, 15, 20, 25, 27, 40, 50, 60]; const f = fl.map(n => [n, +ENDLESS.hpMul(n).toFixed(3), +ENDLESS.dmgMul(n).toFixed(2)]); ENDLESS.mode = 'table'; const t = fl.map(n => [n, ENDLESS.hpMul(n), ENDLESS.dmgMul(n)]); ENDLESS.mode = ENDLESS_SCALING; return { mode: ENDLESS_SCALING, f, t }; });
  chk('default ENDLESS_SCALING', sc.mode, 'formula');
  chk('formula HP 1.05^(n-1) cap 3.5, dmg +2%/floor cap 2', sc.f, [[1, 1, 1], [15, 1.98, 1.28], [20, 2.527, 1.38], [25, 3.225, 1.48], [27, 3.5, 1.52], [40, 3.5, 1.78], [50, 3.5, 1.98], [60, 3.5, 2]]);
  chk('table mode (switchable)', sc.t, [[1, 1, 1], [15, 1.5, 1.3], [20, 1.5, 1.3], [25, 1.5, 1.3], [27, 2.2, 1.7], [40, 3, 2], [50, 3, 2.5], [60, 3, 2.5]]);
  const cyc = await ev(() => ({ biome: [1, 6, 7, 12, 13, 18, 19, 37].map(n => ENDLESS.biome(n)), checkpoints: [1, 2, 18, 19, 36, 37, 55].filter(ENDLESS.checkpoint), hunters: Array.from({ length: 30 }, (_, i) => i + 1).filter(ENDLESS.hunter) }));
  chk('18-floor loop 6 crypt / 6 cave / 6 lava', cyc.biome, ['crypt', 'crypt', 'cave', 'cave', 'lava', 'lava', 'crypt', 'crypt']);
  chk('checkpoint saves at 1, 19, 37, 55', cyc.checkpoints, [1, 19, 37, 55]);
  chk('Death hunter floors', cyc.hunters, [6, 12, 18, 24, 30]);
  const hunt = await ev(() => { TT.setup(['brannoc']); beginRun(); const r = []; for (const n of [5, 6, 12]) { startEndlessFloor(n); r.push([n, G.gimmick === 'reaper' || G.foes.some(f => f.type === 'reaper')]); } return r; });
  chk('hunter actually spawns on 6 and 12, not 5', hunt, [[5, false], [6, true], [12, true]]);
  const food = await ev(() => { TT.setup(['brannoc']); beginRun(); const out = []; for (const n of [36, 37]) { startEndlessFloor(n); G.pickups.push({ kind: 'ration', x: 0, y: 0 }); updatePickups(0.01); out.push([n, G.pickups.filter(i => i.kind === 'ration' || i.kind === 'feast').length > 0]); } return out; });
  chk('food cutoff at floor 37 (food -> gold)', food, [[36, true], [37, false]]);
  // ---- trap at 37+ on a 100-HP hero: 80 dmg -> 20 HP + low-health burst
  const trap = await ev(() => { TT.setup(['mirelle']); beginRun(); startEndlessFloor(37); const h = G.heroes[0]; h.hp = h.maxHp; h.inv = 0; hurtHero(h, TRAP_DMG(trapBand()), { cause: 'spike', raw: true }); updateHero(h, { pressed: {}, down: {}, mx: 0, my: 0, dev: 'kb1' }, 1 / 60); return { maxHp: h.maxHp, hp: Math.round(h.hp), lowBurst: h.lowT > 0, flash: h.lowFlash > 0 }; });
  chk('floor 37+ trap: 100 -> 20 HP, low-health burst', trap, { maxHp: 100, hp: 20, lowBurst: true, flash: true });
  chk('trap damage bands 20/40/80', await ev(() => [1, 19, 20, 36, 37, 80].map(TRAP_DMG)), [20, 20, 40, 40, 80, 80]);
  // ---- relics
  const rel = await ev(() => ({ cost: RELIC.mirror.cost, mirror: RELIC_SPEC.mirror, haste: RELIC_SPEC.haste, feather: RELIC_SPEC.feather, hoar: RELIC_SPEC.hoar, shard: RELIC_SHARD_COST }));
  chk('relic prices 4000 / 12000 / 32000', rel.cost, [4000, 12000, 32000]);
  chk('mirror ranks', [rel.mirror.clones, rel.mirror.time, rel.mirror.cd], [[2, 3, 4], [6, 8, 10], [60, 52.5, 45]]);
  chk('boots ranks', [rel.haste.speed, rel.haste.time, rel.haste.cd], [[0.3, 0.4, 0.5], [4, 5.5, 7], [40, 32.5, 25]]);
  chk('feather ranks', [rel.feather.slow, rel.feather.cd], [[3, 4.5, 6], [50, 42.5, 35]]);
  chk('freeze ranks (px, 1m=32)', [rel.hoar.freeze, rel.hoar.cd, rel.hoar.range], [[4, 6, 8], [45, 37.5, 30], [96, 176, 256]]);
  chk('Rank III shard costs (mirror/freeze 50, boots/feather 35)', rel.shard, { mirror: 50, hoar: 50, haste: 35, feather: 35 });
  const shard = await ev(() => { TT.setup(['brannoc']); TT.testRoom(); const h = G.heroes[0]; h.relic = { id: 'haste', rank: 3 }; h.potions = 0; h.shardMeter = 40; useRelic(h); const a = h.shardMeter; h.cd = {}; useRelic(h); const b = h.shardMeter; h.cd = {}; h.potions = 1; useRelic(h); return [a, b, h.shardMeter, h.potions]; });
  chk('shard meter: 40-35=5, blocked at 5, potion refills to 100-35', shard, [5, 5, 65, 0]);
  // ---- essence
  const ess = await ev(() => { TT.setup(['vesper']); TT.testRoom(); const v = G.heroes[0]; v.souls = 0; const g = TT.dummies(1, 'bonesoldier', 40)[0]; killFoe(G.foes[0], v); const a = v.souls; const e = mkFoe('hexcaller', v.x + 40, v.y); killFoe(e, v); return [a, v.souls, SPEC.vesper.raiseCost, SPEC.vesper.essenceMax]; });
  chk('essence: +5 grunt, +25 elite, raise 20, max 100', ess, [5, 30, 20, 100]);
  // ---- crown
  const crown = await ev(() => { TT.setup(['brannoc']); TT.testRoom(); const h = G.heroes[0]; G.pickups = [{ kind: 'crown', x: h.x, y: h.y }]; updatePickups(0.016); const got = h.crown; G.purse = 0; G.pickups.push({ kind: 'gold', x: h.x, y: h.y, val: 10, src: 'mob' }); updatePickups(0.016); const gold = G.purse; h.inv = 0; hurtHero(h, 1, {}); const dropped = !h.crown && G.pickups.some(i => i.kind === 'crown');
    for (let i = 0; i < 60 * 4.9; i++) { h.x = 0; updatePickups(1 / 60); } const still = G.pickups.some(i => i.kind === 'crown'); for (let i = 0; i < 12; i++) updatePickups(1 / 60); return { got, gold, dropped, at4_9s: still, after5s: G.pickups.some(i => i.kind === 'crown'), slowLinger: +h.crownSlowT.toFixed(2) }; });
  chk('crown: x2 gold, knocked out by any hit, floats 5s', crown, { got: true, gold: 20, dropped: true, at4_9s: true, after5s: false, slowLinger: 0.75 });
  // ---- co-op hero lock
  const lock = await ev(() => { const S = __game.SEL; S.slots = [{ dev: 'kb1', idx: 0, ready: true }, { dev: 'pad0', idx: 5, ready: false }]; return { taken: heroTaken(S.slots[1], 0), free: heroTaken(S.slots[1], 1) }; });
  chk('co-op: hero locked by another player is taken', lock, { taken: true, free: false });
  // ---- spawners
  const sp = await ev(() => { TT.setup(['brannoc']); TT.testRoom(); const h = G.heroes[0]; const out = [];
    for (const t of [1, 2, 3]) { G.spawners = []; const s = mkSpawner(h.x + 60, h.y, t, ['bonesoldier'], 'w1'); let n = 0; while (s.hp > 0 && n < 50) { G.time += 0.2; hitSpawner(s, heroDmg(h, DMG.light), h); n++; } out.push(n); }
    G.spawners = []; const s3 = mkSpawner(h.x + 60, h.y, 3, ['bonesoldier'], 'w1'); let m = 0; while (s3.hp > 0 && m < 50) { G.time += 0.2; hitSpawner(s3, heroDmg(h, DMG.heavy), h); m++; } out.push(m); return out; });
  chk('spawner hits: tier 1/2/3 = 3/6/12, tier 3 by T3 = 4', sp, [3, 6, 12, 4]);
  const siege = await ev(() => { const def = defaultSave().settings.bombSiege; TT.setup(['kestrel']); TT.testRoom(); const h = G.heroes[0]; SAVE.settings.bombSiege = true; const s = mkSpawner(h.x + 60, h.y, 1, ['bonesoldier'], 'w1'); hitSpawner(s, heroDmg(h, DMG.light), h); const afterLight = s.hp; G.time += 1; hitSpawner(s, heroDmg(h, DMG.light), h, { tag: 'bomb' }); const afterBomb = s.hp; SAVE.settings.bombSiege = false; G.time += 1; hitSpawner(s, heroDmg(h, DMG.light), h); return { def, afterLight, afterBomb, offAgain: s.hp, flag: ELF_LIGHT_ARROWS_HIT_SPAWNERS }; });
  chk('Bomb Siege: off by default, light ignored when on', siege, { def: false, afterLight: 3, afterBomb: 2, offAgain: 1, flag: true });
  // ---- stun break
  const sb = await ev(() => { TT.setup(['brannoc']); TT.testRoom(); const h = G.heroes[0]; for (let i = 0; i < 3; i++) { h.inv = 0; G.time += 0.3; hurtHero(h, 3, { x: h.x + 20, y: h.y, knock: 200 }); } return { immune: +(h.stunImmune || 0).toFixed(2) }; });
  chk('stun break: 3 T1/T2 hits in 1.5s -> 0.5s immunity', sb, { immune: 0.5 });
  const sb2 = await ev(() => { TT.setup(['brannoc']); TT.testRoom(); const h = G.heroes[0]; for (let i = 0; i < 3; i++) { h.inv = 0; G.time += 0.8; hurtHero(h, 3, { x: h.x + 20, y: h.y }); } return { immune: +(h.stunImmune || 0).toFixed(2) }; });
  chk('stun break: hits spread over 1.6s do not trigger', sb2, { immune: 0 });
  // ---- shatter
  const sh = await ev(() => { TT.setup(['brannoc']); TT.testRoom(); const h = G.heroes[0]; const [a, b] = TT.dummies(2, 'shambler', 60); a.frz = 2; const d = heroDmg(h, DMG.heavy); const h0 = a.hp, h1 = b.hp; hitFoe(a, d, { src: h }); hitFoe(b, d, { src: h }); return { frozen: Math.round(h0 - a.hp), normal: Math.round(h1 - b.hp) }; });
  chk('shatter: frozen foe takes x2 from T3', sh, { frozen: 64, normal: 32 });
  // ---- underdog
  const ud = await ev(() => { TT.setup(['brannoc', 'kestrel']); const [a, b] = G.heroes; const r = []; for (const [la, lb] of [[1000, 700], [1000, 590], [1000, 700], [1000, 810]]) { a.goldRun = la; b.goldRun = lb; r.push(underdog(b)); } return r; });
  chk('underdog: on below 60% of leader, off at 80%', ud, [false, true, true, false]);
  // ---- mastery cap
  const cap = await ev(() => { const st = {}; for (const ms of masteriesFor('brannoc')) st[ms.stat] = 1e9; SAVE.mastery.brannoc = st; const m = heroMods('brannoc'); SAVE.mastery.brannoc = {}; return { speed: m.speed <= 0.25, armor: m.armor <= 0.25, dmgUncapped: m.dmg > 1.25 }; });
  chk('mastery cap: speed/mitigation <= 25%, kill-damage bonus uncapped', cap, { speed: true, armor: true, dmgUncapped: true });
  const pot = await ev(() => { TT.setup(['brannoc']); TT.testRoom(); const h = G.heroes[0]; h.potions = 4; for (let i = 0; i < 3; i++) G.pickups.push({ kind: 'potion', x: h.x, y: h.y }); for (let i = 0; i < 5; i++) updatePickups(1 / 60); return { carried: h.potions, leftOnFloor: G.pickups.filter(i => i.kind === 'potion').length, cap: POTION_CAP }; });
  chk('potion cap 5 per hero, extras stay on the floor', pot, { carried: 5, leftOnFloor: 2, cap: 5 });
  const death = await ev(() => { const r = {}; for (const id of ['brannoc', 'sela']) { TT.setup([id]); TT.testRoom(); const h = G.heroes[0]; h.bubble = true; h.mods.armor = 0.25; if (id === 'sela') { h.blocking = true; h.blockStart = -9; } const f = mkFoe('reaper', h.x + 10, h.y, { awake: true }); if (!G.foes.includes(f)) G.foes.push(f); G.coins = 0; let t = 0; while (!h.dead && h.hp > 0 && t < 3) { f.x = h.x + 10; f.y = h.y; f.repel = 0; updateFoes(1 / 60); t += 1 / 60; } r[id] = +t.toFixed(2); } return r; });
  chk('Death contact downs any hero within ~1s (armor/bubble/shield ignored)', Object.values(death).every(t => t > 0.5 && t <= 1.0), true);
  console.log('   death contact seconds', JSON.stringify(death));
  const rules = await ev(() => { const d = defaultSave().settings; const keys = Object.keys(RULE_DEFAULTS); return { allPresent: keys.every(k => d[k] === RULE_DEFAULTS[k]), on: ['spawnerCleanup', 'tileCap', 'spearCap', 'orbCap', 'potionFoodInv', 'underdogGold', 'crownLinger', 'reviveShock'].every(k => RULE(k) === true), bombSiege: RULE('bombSiege'), goldMul: RULE('goldMul') }; });
  chk('gameplay rule toggles: unverified rules ON, Bomb Siege OFF, gold x1', rules, { allPresent: true, on: true, bombSiege: false, goldMul: 1 });
  const offs = await ev(() => { TT.setup(['brannoc', 'kestrel']); const [a, b] = G.heroes; a.goldRun = 1000; b.goldRun = 100; SAVE.settings.underdogGold = false; const u = underdog(b); SAVE.settings.underdogGold = true; TT.setup(['brannoc']); TT.testRoom(); const h = G.heroes[0]; h.crown = true; SAVE.settings.crownLinger = false; dropCrown(h); const lin = h.crownSlowT; SAVE.settings.crownLinger = true; SAVE.settings.goldMul = 2; h.crown = false; G.purse = 0; G.pickups = [{ kind: 'gold', x: h.x, y: h.y, val: 10, src: 'chest' }]; updatePickups(0.016); const g = G.purse; SAVE.settings.goldMul = 1; return { underdogOff: u, lingerOff: lin, goldX2: g }; });
  chk('toggles switch rules off / gold multiplier applies', offs, { underdogOff: false, lingerOff: 0, goldX2: 20 });
  chk('damage tiers', await ev(() => [DMG, [9, 15, 28, 50].map(d => dmgTier(d))]), [{ light: 10, medium: 18, heavy: 32, massive: 60 }, [1, 2, 3, 4]]);
  const orb = await ev(() => { TT.setup(['mirelle']); TT.testRoom(); const h = G.heroes[0]; G.foes = []; for (let i = 0; i < 40; i++) { const f = mkFoe('shambler', h.x + 100 + (i % 8) * 4, h.y + Math.floor(i / 8) * 4 - 8); f.maxHp = f.hp = 9999; f.ai = 'idle'; if (!G.foes.includes(f)) G.foes.push(f); } G.hazards.push({ kind: 'frost', x: h.x + 110, y: h.y, r: 115, life: 6, t: 0, cap: 30, caught: new Set(), dps: 1, team: 'hero', src: h }); updateHazards(0.1); return { caught: G.hazards[0].caught.size, slowed: new Set(G.foes.filter(f => f.slowT > 0)).size, total: new Set(G.foes).size }; });
  chk('slow orb catches at most 30 of 40 foes', orb, { caught: 30, slowed: 30, total: 40 });
  const maps = await ev(() => { const w = WORLDS[0]; return [40, 51, 90].map(n => { let rooms = 0, big = 0, area = 0, k = 0; for (let t = 0; t < 6; t++) { const m = genDungeon(n, w); rooms = Math.max(rooms, m.rooms.length); big = Math.max(big, m.length, m[0].length); m.rooms.forEach(r => { area += r.w * r.h; k++; }); } return [n, rooms <= ENDLESS_MAX_ROOMS, big <= Math.max(DEV.rooms.maxW, DEV.rooms.maxH) + 6, Math.round(area / k)]; }); });
  console.log('      endless stage rooms', JSON.stringify(maps));
  chk('endless stages: at most 12 rooms, bounded size, tighter past 50', maps.every(x => x[1] && x[2]) && maps[1][3] < maps[0][3] && maps[2][3] < maps[0][3], true);
  await ev(() => { TT.setup(['vesper']); TT.testRoom(); }); await p.keyboard.press('F3'); await ev(() => { TT.dummies(2, 'shambler', 50); hitFoe(G.foes[0], 32, { src: G.heroes[0] }); __game.draw(); });
  chk('debug overlay toggles with F3', await ev(() => DEBUG.on && DEBUG.log.length > 0), true);
  await p.screenshot({ path: SHOT + '50-debug-overlay.png' }); await p.keyboard.press('Backquote'); chk('debug overlay off with backtick', await ev(() => DEBUG.on), false);
  console.log(`SPEC TESTS: ${pass} passed, ${fail} failed`); console.log('CONSOLE:', logs.join(' | '));
  await b.close();
})();
