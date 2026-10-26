'use strict';
// ---------------------------------------------------------------- persistence
const SAVE_KEY = 'delvebound_slayers_v2';
function defaultSave() {
  const s = { bank: 0, owned: {}, loadout: {}, mastery: {}, progress: { w1: 0, w2: 0, w3: 0, fin: 0 }, endless: { best: 0, checkpoint: 0 }, arena: { best: 0, daily: {} },
    settings: { difficulty: 'normal', hunger: false, shake: true, autoAim: true, bombSiege: false, ...RULE_DEFAULTS }, stats: { runs: 0 }, banks: {} };
  for (const h of HEROES) { s.owned[h.id] = { weapons: ['base'], talismans: ['base'], relics: {} }; s.loadout[h.id] = { weapon: 'base', talisman: 'base', relic: null }; s.mastery[h.id] = {}; s.banks[h.id] = 0; }
  return s;
}
let SAVE = defaultSave();
try { const raw = localStorage.getItem(SAVE_KEY); if (raw) { const s = JSON.parse(raw); SAVE = Object.assign(defaultSave(), s); for (const h of HEROES) { SAVE.owned[h.id] = SAVE.owned[h.id] || defaultSave().owned[h.id]; SAVE.loadout[h.id] = SAVE.loadout[h.id] || defaultSave().loadout[h.id]; SAVE.mastery[h.id] = SAVE.mastery[h.id] || {}; }
  // migration guard: drop loadout picks / owned gear that no longer exist after roster changes
  for (const h of HEROES) { const lo = SAVE.loadout[h.id], own = SAVE.owned[h.id];
    own.weapons = (own.weapons || []).filter(w => WEAPONS[h.id].some(x => x.id === w)); if (!own.weapons.includes('base')) own.weapons.unshift('base');
    own.talismans = (own.talismans || []).filter(t => TALISMANS[h.id].some(x => x.id === t)); if (!own.talismans.includes('base')) own.talismans.unshift('base');
    if (!own.weapons.includes(lo.weapon)) lo.weapon = 'base'; if (!own.talismans.includes(lo.talisman)) lo.talisman = 'base';
    if (lo.relic && !RELIC[lo.relic]) lo.relic = null; }
  // gold is banked per hero: split any old shared bank evenly
  SAVE.banks = SAVE.banks || {}; for (const h of HEROES) SAVE.banks[h.id] = SAVE.banks[h.id] || 0;
  if (SAVE.bank > 0) { const each = Math.floor(SAVE.bank / HEROES.length); for (const h of HEROES) SAVE.banks[h.id] += each; SAVE.bank = 0; }
  SAVE.settings = Object.assign(defaultSave().settings, SAVE.settings || {}); } } catch (e) { SAVE = defaultSave(); }
function bankOf(id) { return SAVE.banks[id] || 0; }
function bankTotal() { return HEROES.reduce((a, h) => a + bankOf(h.id), 0); }
// bank the party's secured gold: each hero keeps a share in proportion to the gold they picked up this run
function bankSecured(amount) {
  amount = Math.floor(amount || 0); if (amount <= 0 || !G.heroes.length) return;
  const tot = G.heroes.reduce((a, h) => a + (h.goldRun || 0), 0); let left = amount;
  G.heroes.forEach((h, i) => { const share = i === G.heroes.length - 1 ? left : Math.floor(amount * (tot > 0 ? (h.goldRun || 0) / tot : 1 / G.heroes.length)); SAVE.banks[h.id] = bankOf(h.id) + share; left -= share; h.goldRun = 0; });
}
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(SAVE)); } catch (e) { } }
function mastery(h, stat, v) {
  if (!h || !h.id || !v) return;
  const st = SAVE.mastery[h.id]; const before = st[stat] || 0; st[stat] = before + v;
  for (const ms of masteriesFor(h.id)) if (ms.stat === stat) ms.tiers.forEach((t, i) => { if (before < t && st[stat] >= t) { h.mods = heroMods(h.id); msg(`${h.def.name} mastered ${ms.name}${ms.tiers.length > 1 ? ' ' + ['I', 'II', 'III'][i] : ''}: ${ms.text(i)}`, '#ffd27a', 4); Snd.play('mastery'); G.newMasteries.push(`${h.def.name}: ${ms.name} ${['I', 'II', 'III'][i]}`); } });
}

// ---------------------------------------------------------------- party / run
const PARTY = []; // [{dev, hero}] chosen in the select screen
function resetLists() {
  Object.assign(G, { foes: [], allies: [], shots: [], hazards: [], spawners: [], pickups: [], props: [], parts: [], texts: [], rings: [], beams: [], decals: [], swings: [], claws: [], hands: [], waves: [], decor: [] });
  G.boss = null; G.deathsFloor = 0; G.pendingComplete = 0; G.exitT = -1; G.exitOpen = true; G.arena = null; G.gimmick = null; G.banner = null; G.newMasteries = G.newMasteries || [];
}
function newRun() {
  G.heroes = PARTY.map((p, i) => mkHero(i, p.hero, p.dev));
  G.purse = 0; G.secured = 0; G.bankedRun = 0; G.gold = 0; G.deathsRun = 0; G.newMasteries = []; G.rez = diff().rez;
}
Object.defineProperty(G, 'gold', { get() { return G.purse || 0; }, set(v) { G.purse = v; } });
// four difficulties, like the original: Easy / Normal / Hard / Unfair (Unfair spawns no food).
// gold = end-of-floor loot multiplier; rez = revive coins per run (Infinity = unlimited on Easy/Normal)
const DIFFS = {
  easy:   { name: 'Easy',   hp: 0.7, dmg: 0.6, spawn: 1.15, tier: 0, gold: 0.75, rez: Infinity, food: true },
  normal: { name: 'Normal', hp: 1,   dmg: 1,   spawn: 1,    tier: 0, gold: 1,    rez: Infinity, food: true },
  hard:   { name: 'Hard',   hp: 1.6, dmg: 1.4, spawn: 0.8,  tier: 1, gold: 2,    rez: 3,        food: true },
  unfair: { name: 'Unfair', hp: 2.2, dmg: 1.9, spawn: 0.7,  tier: 1, gold: 3,    rez: 1,        food: false },
};
const DIFF_ORDER = ['easy', 'normal', 'hard', 'unfair'];
function diff() { return DIFFS[SAVE.settings.difficulty] || DIFFS.normal; }
function canRevive() { return G.rez > 0; }
function scaleFor(mode, n) {
  const D = diff(), hard = D.tier > 0;
  if (mode === 'endless') return { hp: ENDLESS.hpMul(n) * D.hp, dmg: ENDLESS.dmgMul(n) * D.dmg, spd: ENDLESS.speedMul(n), spawn: D.spawn };   // David's ruling: x1.05/floor HP (cap 3.5x), +2%/floor damage (cap 2x)
  if (mode === 'arena') return { hp: 1.25 + (n - 1) * 0.12, dmg: 1.15 + (n - 1) * 0.06, spd: 1.05, spawn: 0.8 };
  const w = n; // world index for campaign
  return { hp: (1 + w * 0.3) * D.hp, dmg: (1 + w * 0.2) * D.dmg, spd: 1 + w * 0.04, spawn: D.spawn };
}
function placeHeroes() {
  const st = G.map.starts.length ? G.map.starts : [{ x: G.map.w * T / 2, y: G.map.h * T / 2 }];
  G.heroes.forEach((h, i) => { const s = st[i % st.length]; h.x = s.x + (st.length > 1 ? 0 : i * 26); h.y = s.y; h.kx = h.ky = 0; h.dash = null; h.charging = null; h.spin = 0; h.shieldOut = false; h.blocking = false; h.inv = Math.max(h.inv, 1.5); });
  if (G.allies) for (const a of G.allies) if (a.owner) { a.x = a.owner.x + R(-30, 30); a.y = a.owner.y + R(-30, 30); }
  updateCamera(true);
}

// ---------------------------------------------------------------- floor loading
// endless wave composition by floor band: elites join at 20 (by elite rate), minibosses from 40
function waveFoe(world) {
  if (G.mode !== 'endless') return pick(world.foes);
  const n = G.endless, t = ENDLESS.tier(n);
  if (t >= 3 && Math.random() < 0.08) return pick(['hexcaller', 'ravager']);
  if (t >= 2 && Math.random() < ENDLESS.eliteRate(n)) return pick(world.elite);
  return pick(world.foes);
}
function populate(world) {
  const m = G.map;
  for (const it of m.items) {
    const { x, y, c } = it;
    switch (c) {
      case 'k': G.pickups.push({ kind: 'key', x, y }); break;
      case 'f': G.pickups.push({ kind: 'ration', x, y }); break;
      case 'F': G.pickups.push({ kind: 'feast', x, y }); break;
      case 'p': G.pickups.push({ kind: 'potion', x, y }); break;
      case '$': G.pickups.push({ kind: 'gold', x, y, val: RI(30, 60) }); break;
      case 'c': mkProp('chest', x, y); break;
      case 'L': mkProp('legend', x, y); break;
      case 'v': mkProp('urn', x, y); break;
      case 'b': mkProp('barrel', x, y); break;
      case 'w': G.decor.push({ kind: world.decor || (G.map.theme === WORLDS[1].theme ? 'web' : 'rubble'), x, y, s: R(0.7, 1.3) }); break;
      case 'e': { const n = Math.round(RI(2, 4) * ENDLESS.coopCount(Math.max(1, G.heroes.length))); for (let k = 0; k < n; k++) { const fx = x + R(-28, 28), fy = y + R(-28, 28); if (!collide(fx, fy, 12)) mkFoe(waveFoe(world), fx, fy, { tier: RI(1, Math.min(3, 1 + G.worldTier)) }); } break; }
      case 'E': mkFoe(G.mode === 'endless' && ENDLESS.tier(G.endless) < 2 ? pick(world.foes) : pick(world.elite), x, y); break;   // endless 1-19: grunts only
    }
  }
  for (const s of m.spawns) mkSpawner(s.x, s.y, Math.min(3, s.tier + diff().tier), G.mode === 'endless' && ENDLESS.allEliteSpawners(G.endless) ? world.elite : world.spawn, world.id);
  // one crown per floor, near the first item spot past the start
  if (G.mode === 'campaign' || G.mode === 'endless') { const spots = m.items.filter(i => i.c === '$' || i.c === 'c'); const sp = spots.length ? spots[Math.floor(spots.length / 2)] : null; if (sp) G.pickups.push({ kind: 'crown', x: sp.x + 20, y: sp.y }); }
  // endless: a skull-coin podium every 3rd floor
  if (G.mode === 'endless' && ENDLESS.coinFloor(G.endless) && m.starts.length) { const st = m.starts[0]; G.pickups.push({ kind: 'coin', x: st.x + 60, y: st.y }); }
  for (const r of m.reapers) mkFoe('reaper', r.x, r.y);
  m.arenaSet = new Set(m.arenaTiles);
}
function startCampaignFloor(wi, fi) {
  resetLists();
  const world = WORLDS[wi], fl = world.floors[fi];
  G.mode = 'campaign'; G.worldIdx = wi; G.floorIdx = fi; G.worldTier = wi;
  G.scale = scaleFor('campaign', wi); G.mods = {}; G.goldMul = 1;
  const rows = fl.map === 'maze' ? genMaze(world) : MAPS[fl.map];
  G.map = parseMap(rows, world.theme, { dark: fl.gimmick === 'dark' });
  G.floorName = fl.name; G.worldName = world.name;
  populate(world);
  renderMapCanvas(); placeHeroes();
  G.gimmick = fl.gimmick || null; G.gimmickT = 6;
  if (fl.arena) { G.exitOpen = false; G.arena = { kind: 'floor', wave: 0, waves: 3, state: 'idle', world }; }
  if (fl.boss) { G.exitOpen = false; spawnBoss(fl.boss, G.map.bossAt.x, G.map.bossAt.y); }
  if (fl.gimmick === 'reaper') { msg('Something follows you through the labyrinth...', '#9ff', 3.5); }
  if (fl.gimmick === 'dark') msg('The burrows swallow the light. Stay close.', '#bba', 3.5);
  if (fl.gimmick === 'meteors') msg('The ceiling is coming down. Keep moving!', '#ff9a5a', 3.5);
  G.banner = G.banner || { s: fl.name, sub: world.name.toUpperCase() + ` · ${fi < 3 ? 'FLOOR ' + (fi + 1) : 'BOSS'}`, t: 3 };
  computeFlow(); G.startTime = G.time; G.stats = newStats();
}
function newStats() { return { kills: 0, gold: 0, spawners: 0, foodSmashed: 0, start: G.time, purseStart: G.purse }; }
function spawnAreaBoss(kind) {   // Extended Realms: the area boss guards the far end of its floor; the exit stays sealed until it falls
  const st = G.map.starts[0] || { x: 0, y: 0 }; let best = null, bd = -1;
  for (const s of [...(G.map.spawns || []), ...(G.map.items || []).filter(i => i.c === 'E' || i.c === 'e')]) { const d = hyp(s.x - st.x, s.y - st.y); if (d > bd && !collide(s.x, s.y, 40)) { bd = d; best = s; } }
  if (!best) best = G.map.exit || st; const b = spawnBoss(kind, best.x, best.y); G.exitOpen = false; return b;
}
function spawnLich() { return spawnMiniboss('lich'); }
function spawnMiniboss(type) {   // mini-boss: as far from the start as possible
  const st = G.map.starts[0] || { x: 0, y: 0 }; let best = null, bd = -1;
  for (const s of [...(G.map.spawns || []), ...(G.map.items || []).filter(i => i.c === 'E' || i.c === 'e')]) { const d = hyp(s.x - st.x, s.y - st.y); if (d > bd && !collide(s.x, s.y, 18)) { bd = d; best = s; } }
  if (!best) return null; const l = mkFoe(type, best.x, best.y + 30); msg(FOES[type].name + ' waits in the dark...', FOES[type].col === '#3a5a9a' ? '#9fd8ff' : '#ffb07a', 3); return l;
}
function startEndlessFloor(n) {
  resetLists();
  const cycle = ENDLESS.area(n), world = ENDLESS.worldFor(n);   // faithful: identical to (n-1)/6 % 3
  G.mode = 'endless'; G.endless = n; G.worldTier = Math.min(2, Math.floor((n - 1) / 6)); G.worldIdx = cycle < 3 ? cycle : 0; G.areaIdx = cycle;
  G.scale = scaleFor('endless', n); G.mods = {}; G.goldMul = ENDLESS.goldMul(n);
  G.map = parseMap(genDungeon(n, world), world.theme, { dark: n % 6 === 4 });
  G.floorName = `Endless Depth ${n}`; G.worldName = world.name;
  populate(world); renderMapCanvas(); placeHeroes();
  if (world.miniboss && ((n - 1) % 6) + 1 === CRYPT.lichEndlessFloor) spawnMiniboss(world.miniboss);
  if (world.boss && ((n - 1) % 6) + 1 === XAREA_RULES.bossFloor) spawnAreaBoss(world.boss);
  if (n % 6 === 0) { G.gimmick = 'reaper'; G.gimmickT = 12; msg('Depth ' + n + ': the Pale Collector hunts this floor!', '#9ff', 3.5); }
  else if (n % 6 === 3 && world.id === 'w3') G.gimmick = 'meteors';
  G.banner = { s: `Depth ${n}`, sub: `ENDLESS · ${world.short.toUpperCase()}${n > 36 ? ' · BRUTAL' : n > 18 ? ' · HARD' : ''}`, t: 2.5 };
  computeFlow(); G.stats = newStats();
}
function startArena() {
  resetLists();
  G.mode = 'arena'; G.worldTier = 2; G.scale = scaleFor('arena', 1);
  const mods = dailyMods(); G.mods = {}; for (const m of mods) G.mods[m.id] = true; G.goldMul = 1;
  G.map = parseMap(MAPS.arena, ARENA_THEME); G.floorName = 'The Proving Pit'; G.worldName = 'Daily Arena';
  renderMapCanvas(); placeHeroes();
  G.exitOpen = false; G.arena = { kind: 'arena', wave: 0, waves: 6, state: 'break', t: 3, world: null };
  G.banner = { s: 'The Proving Pit', sub: 'TODAY: ' + mods.map(m => m.name.toUpperCase()).join(' + '), t: 3.5 };
  if (G.mods.reaper) { const f = mkFoe('reaper', 4 * T, 4 * T, { awake: true }); f.gone = 20; }
  computeFlow(); G.stats = newStats();
}
function todayKey() { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }
function dailyMods() { const d = new Date(), seed = d.getFullYear() * 1000 + d.getMonth() * 40 + d.getDate(), rnd = seeded(seed); const a = ARENA_MODS.slice().sort(() => rnd() - 0.5); return a.slice(0, 2); }

// ---------------------------------------------------------------- hub
function startHub() {
  resetLists();
  G.mode = 'hub'; G.scale = { hp: 1, dmg: 1, spd: 1 }; G.mods = {};
  G.map = parseMap(MAPS.hub, HUB_THEME); G.floorName = "Wayfarer's Rest"; G.worldName = 'Camp';
  G.stations = [];
  const LABEL = { Q: 'World I · ' + WORLDS[0].short, W: 'World II · ' + WORLDS[1].short, Z: 'World III · ' + WORLDS[2].short, Y: 'The Hollow Throne', N: 'Endless Descent', A: 'Daily Arena', M: 'Peddler (Shop)', T: 'Mastery Tablet', K: 'Armory (Loadout)', H: 'Hero Shrine (change hero)', O: 'Lantern Post (Options)' };
  for (const it of G.map.items) if (LABEL[it.c]) G.stations.push({ id: it.c, x: it.x, y: it.y, label: LABEL[it.c] });
  renderMapCanvas();
  for (const h of G.heroes) { h.dead = false; h.hp = h.maxHp; h.potions = 2; h.keys = 0; h.souls = 30; h.cd = {}; h.buff = {}; }
  placeHeroes(); G.banner = { s: "Wayfarer's Rest", sub: G.heroes.map(h => `${h.def.name.toUpperCase()} ${bankOf(h.id)}G`).join(' · '), t: 2 };
}
function hubInteract(h, inp) {
  let near = null, bd = 50;
  for (const s of G.stations) { const d = hyp(s.x - h.x, s.y - h.y); if (d < bd) { bd = d; near = s; } }
  h.station = near;
  if (near && (inp.pressed.confirm || inp.pressed.primary)) openStation(near, h);
}

// ---------------------------------------------------------------- floor flow: exits, arenas, gimmicks
function updateMode(dt) {
  if (G.mode === 'hub') return;
  if (G.pendingComplete > 0) { G.pendingComplete -= dt; if (G.pendingComplete <= 0) { floorComplete(); return; } }
  // gimmicks
  if (G.gimmick === 'reaper') { G.gimmickT -= dt; if (G.gimmickT <= 0 && !G.foes.some(f => f.type === 'reaper')) { const h = pick(G.heroes.filter(x => !x.dead)); if (h) { const s = G.map.starts[0] || h; const f = mkFoe('reaper', s.x, s.y, { awake: true }); Snd.play('reaper'); msg('The Reaper enters the labyrinth!', '#9ff', 3); } } }
  if (G.gimmick === 'meteors') { G.gimmickT -= dt; if (G.gimmickT <= 0) { G.gimmickT = R(0.7, 1.3) / G.heroes.length; const h = pick(G.heroes.filter(x => !x.dead)); if (h) { const x = h.x + R(-220, 220) + (h.vx || 0) * 0.8, y = h.y + R(-180, 180) + (h.vy || 0) * 0.8; if (!blocksShot(tileAt(Math.floor(x / T), Math.floor(y / T)))) tele(x, y, 48, 1.1, 20 * G.scale.dmg, '#ff7a2a', hz => G.hazards.push({ kind: 'fire', x: hz.x, y: hz.y, r: 28, life: 2.2, t: 0, team: 'foe', dps: 10 })); } } }
  if (G.gimmick === 'dark' || G.map.dark) { G.gimmickT -= dt; if (G.gimmickT <= 0) { G.gimmickT = 3.5; if (G.foes.length < 60) { const h = pick(G.heroes.filter(x => !x.dead)); if (h) for (let k = 0; k < 3; k++) { const a = R(0, 6.28), x = h.x + Math.cos(a) * 300, y = h.y + Math.sin(a) * 300; if (!collide(x, y, 9)) mkFoe('spiderling', x, y, { spawned: true }); } } } }
  // arena waves
  if (G.arena) updateArena(dt);
  // exit
  if (G.exitOpen && G.map.exit) {
    const alive = G.heroes.filter(h => !h.dead), on = alive.filter(h => tileAt(Math.floor(h.x / T), Math.floor(h.y / T)) === TL.EXIT);
    if (on.length && G.exitT < 0) { G.exitT = alive.length === on.length ? 0.6 : 5; Snd.play('exitopen'); }
    if (G.exitT >= 0) { const prev = Math.ceil(G.exitT); G.exitT -= dt; if (Math.ceil(G.exitT) !== prev && G.exitT > 0) Snd.play('tick'); if (alive.length && alive.every(h => tileAt(Math.floor(h.x / T), Math.floor(h.y / T)) === TL.EXIT)) G.exitT = Math.min(G.exitT, 0.4); if (G.exitT <= 0) floorComplete(); }
  }
  // defeat
  if (G.heroes.every(h => h.dead)) {
    if (G.heroes.length === 1 && canRevive() && !G.reviveOffer) { G.reviveOffer = true; }
    if (G.reviveOffer && !canRevive()) G.reviveOffer = false;
    if (!G.reviveOffer || G.heroes.length > 1 && !canRevive()) { G.defeatT = (G.defeatT || 0) + dt; if (G.defeatT > 2.2) defeat(); }
  } else { G.defeatT = 0; G.reviveOffer = false; }
}
function updateArena(dt) {
  const A = G.arena;
  if (A.kind === 'floor' && A.state === 'idle') {
    for (const h of G.heroes) if (!h.dead && G.map.arenaSet.has(Math.floor(h.y / T) * G.map.w + Math.floor(h.x / T))) { A.state = 'break'; A.t = 1.2; setArenaGates(true); Snd.play('gateslam'); msg('The gates slam shut behind you!', '#ff9a5a', 2.5); addTrauma(0.4); break; }
    return;
  }
  if (A.state === 'break') { A.t -= dt; if (A.t <= 0) startWave(); return; }
  if (A.state === 'fight') {
    A.spawnQ = A.spawnQ || [];
    A.t -= dt;
    if (A.queue.length && A.t <= 0) { A.t = 0.35; const type = A.queue.shift(); spawnWaveFoe(type); }
    const left = G.foes.filter(f => ALIVE(f) && f.type !== 'reaper').length + A.queue.length + G.hazards.filter(h => h.waveSpawn).length;
    A.left = left;
    if (left === 0) {
      if (A.wave >= A.waves) { A.state = 'done'; arenaDone(); }
      else { A.state = 'break'; A.t = 4; msg(`Wave ${A.wave} cleared!`, '#ffd27a', 2); Snd.play('wavedone'); if (A.kind === 'arena') { G.purse += 120 * A.wave; text(G.heroes[0].x, G.heroes[0].y - 40, `+${120 * A.wave} gold`, '#ffd84a', true); mastery(G.heroes[0], 'arenaWaves', 1); for (const h of G.heroes.slice(1)) mastery(h, 'arenaWaves', 1); } dropWaveSupplies(); }
    }
  }
}
function arenaTiles() { const m = G.map; if (m.arenaTiles.length) return m.arenaTiles; const out = []; for (let i = 0; i < m.t.length; i++) if (m.t[i] === TL.FLOOR) out.push(i); return out; }
function spawnWaveFoe(type) {
  const tiles = arenaTiles();
  for (let k = 0; k < 30; k++) {
    const i = pick(tiles), x = (i % G.map.w + 0.5) * T, y = (Math.floor(i / G.map.w) + 0.5) * T;
    if (G.heroes.some(h => !h.dead && hyp(h.x - x, h.y - y) < 200) || collide(x, y, 14)) continue;
    G.hazards.push({ kind: 'tele', x, y, r: 24, delay: 0.7, t: 0, col: '#c060ff', waveSpawn: true, onFire: hz => { mkFoe(type, hz.x, hz.y, { tier: 1 + Math.floor(G.arena.wave / 3), spawned: true }); burst(hz.x, hz.y, '#c060ff', 14, 120, 3, 0.5); } });
    return;
  }
}
function startWave() {
  const A = G.arena; A.wave++; A.state = 'fight'; A.t = 0.2;
  let pool, elites;
  if (A.kind === 'arena') { G.scale = scaleFor('arena', A.wave); pool = [...WORLDS[0].foes, ...WORLDS[1].foes, ...WORLDS[2].foes].filter(f => f !== 'bonearcher').filter(f => f !== 'wraith' || Math.random() < 0.5); elites = ['hexcaller', 'hulk', 'ravager', 'marshal', 'conjurer']; }
  else { pool = A.world.foes; elites = A.world.elite; }
  const n = Math.round((6 + A.wave * 4) * (1 + 0.4 * (G.heroes.length - 1)));
  A.queue = []; for (let k = 0; k < n; k++) A.queue.push(pick(pool));
  const ne = (A.wave >= 2 ? 1 : 0) + (A.wave >= A.waves ? 1 : 0) + (G.mods.elite ? 1 : 0);
  for (let k = 0; k < ne; k++) A.queue.splice(RI(0, A.queue.length), 0, pick(elites));
  if (A.kind === 'floor' && A.world.miniboss && A.wave === CRYPT.lichCampaignWave) { A.queue.push(A.world.miniboss); msg(FOES[A.world.miniboss].name + ' joins the fight!', '#ffd27a', 3); }   // crypt mini-boss
  G.banner = { s: `Wave ${A.wave} / ${A.waves}`, sub: A.kind === 'arena' ? 'THE PROVING PIT' : G.floorName.toUpperCase(), t: 1.6 }; Snd.play('wavestart');
}
function dropWaveSupplies() {
  const tiles = arenaTiles(), m = G.map;
  const drop = kind => { const i = pick(tiles); G.pickups.push({ kind, x: (i % m.w + 0.5) * T, y: (Math.floor(i / m.w) + 0.5) * T }); };
  if (!G.mods.famine) { drop('ration'); if (G.arena.wave % 2 === 0) drop('feast'); }
  if (G.arena.wave % 2 === 1) drop('potion');
  for (let k = 0; k < 4; k++) { const i = pick(tiles); dropGold((i % m.w + 0.5) * T, (Math.floor(i / m.w) + 0.5) * T, RI(20, 40)); }
}
function arenaDone() {
  if (G.arena.kind === 'floor') { G.exitOpen = true; setArenaGates(false); msg('The way onward opens!', '#9fffe0', 3); Snd.play('victory'); G.banner = { s: 'Arena cleared', sub: 'THE EXIT IS OPEN', t: 2.5 }; return; }
  // daily arena victory
  G.purse += 1000; SAVE.arena.best = Math.max(SAVE.arena.best, 6); SAVE.arena.daily[todayKey()] = true;
  G.banner = { s: 'The Pit is conquered!', sub: '+1000 GOLD', t: 3 }; Snd.play('victory');
  G.arena.state = 'done'; G.pendingComplete = 2.5;
}

// ---------------------------------------------------------------- completion / defeat
function floorComplete() {
  if (scene !== 'game' || G.mode === 'hub') return;
  Snd.play('exit');
  // end-of-floor loot: base by depth, x difficulty, lowered by each death on this floor, plus unused rez coins and a kept crown
  const depth = G.mode === 'campaign' ? G.worldIdx + 1 : G.mode === 'endless' ? 1 + Math.floor(G.endless / 4) : 2;
  const D = diff(), deathCut = Math.max(0.25, 1 - 0.2 * (G.deathsFloor || 0));
  const potionsHeld = G.heroes.reduce((a, h) => a + (h.dead ? 0 : h.potions), 0);
  const loot = Math.round((150 * depth + (isFinite(G.rez) ? G.rez * 60 : 0) ) * D.gold * deathCut) + (G.heroes.some(h => h.crown && !h.dead) ? SPEC.crown.endBonus : 0) + potionsHeld * SPEC.potion.exitGold;   // +500 per potion held at the exit
  G.purse += loot; for (const h of G.heroes) h.goldRun = (h.goldRun || 0) + loot / G.heroes.length;
  if (D.name === 'Unfair' && !G.deathsFloor && G.mode === 'campaign' && !WORLDS[G.worldIdx].floors[G.floorIdx].boss) for (const h of G.heroes) mastery(h, 'flawless_' + WORLDS[G.worldIdx].id, 1);
  const gained = G.purse - (G.stats.purseStart || 0);
  G.secured = G.purse;
  bankSecured(G.secured - (G.bankedRun || 0)); G.bankedRun = G.secured;   // gold banks the moment the party crosses the exit
  let next = null, title = 'Floor cleared';
  if (G.mode === 'campaign') {
    const key = WORLDS[G.worldIdx].id; SAVE.progress[key] = Math.max(SAVE.progress[key] || 0, G.floorIdx + 1);
    const w = WORLDS[G.worldIdx];
    if (G.floorIdx + 1 < w.floors.length) next = { label: `Continue: ${w.floors[G.floorIdx + 1].name}`, go: () => { startCampaignFloor(G.worldIdx, G.floorIdx + 1); scene = 'game'; } };
    else { title = w.id === 'fin' ? 'The Hollow Throne is broken!' : `${w.name} conquered!`; if (w.id === 'fin') G.victory = true; }
  } else if (G.mode === 'endless') {
    for (const h of G.heroes) mastery(h, 'endlessFloors', 1);
    SAVE.endless.best = Math.max(SAVE.endless.best, G.endless);
    if (ENDLESS.checkpoint(G.endless + 1)) { SAVE.endless.checkpoint = Math.max(SAVE.endless.checkpoint, G.endless + 1); msg('Checkpoint portal saved!', '#9fffe0', 3); }
    const n = G.endless + 1; next = { label: `Descend to depth ${n}`, go: () => { startEndlessFloor(n); scene = 'game'; } };
  } else if (G.mode === 'arena') title = 'Arena victory!';
  persist();
  RESULTS = { title, gained, loot, lootNote: `${D.name} x${D.gold}${G.deathsFloor ? `, ${G.deathsFloor} death${G.deathsFloor > 1 ? 's' : ''} -${Math.round((1 - deathCut) * 100)}%` : ''}`, kills: G.stats.kills, spawners: G.stats.spawners, time: G.time - G.stats.start, purse: G.purse, next, masteries: G.newMasteries.splice(0), defeat: false };
  for (const h of G.heroes) if (h.dead) { h.dead = false; h.hp = h.maxHp * 0.5; }
  scene = 'results'; RESULTS.sel = 0; sceneT = 0;
}
function bankAndReturn() {
  bankSecured(G.secured - (G.bankedRun || 0)); G.purse = 0; G.secured = 0; G.bankedRun = 0; persist(); startHub(); scene = 'game';
}
function defeat() {
  if (scene !== 'game') return;
  G.purse = G.secured;
  const retry = G.mode === 'campaign' ? (() => { const wi = G.worldIdx, fi = G.floorIdx; for (const h of G.heroes) { h.dead = false; h.hp = h.maxHp; } startCampaignFloor(wi, fi); scene = 'game'; })
    : G.mode === 'endless' ? (() => { const n = G.endless; for (const h of G.heroes) { h.dead = false; h.hp = h.maxHp; } startEndlessFloor(n); scene = 'game'; })
    : (() => { for (const h of G.heroes) { h.dead = false; h.hp = h.maxHp; } G.purse = 0; G.secured = 0; startArena(); scene = 'game'; });
  if (G.mode === 'arena') { SAVE.arena.best = Math.max(SAVE.arena.best, (G.arena && G.arena.wave - 1) || 0); G.secured = Math.floor(G.purse * 0.5); }
  persist();
  RESULTS = { title: 'Defeated', gained: 0, kills: G.stats.kills, spawners: G.stats.spawners, time: G.time - G.stats.start, purse: G.secured, next: { label: 'Try again', go: retry }, masteries: G.newMasteries.splice(0), defeat: true };
  scene = 'results'; RESULTS.sel = 0; sceneT = 0; Snd.play('defeat');
}
function openLegend(h, p) {
  if (h.keys <= 0) { if ((h.legMsg || 0) < G.time) { h.legMsg = G.time + 3; msg('This reliquary needs a key.', '#fd5', 2); } return; }
  h.keys--; p.hp = 0; Snd.play('legend'); burst(p.x, p.y, '#ffd84a', 40, 240, 4, 1); ring(p.x, p.y, 80, '#ffd84a', 0.6, 8); addTrauma(0.3);
  const id = h.id, own = SAVE.owned[id];
  const opts = [];
  for (const w of WEAPONS[id]) if (!own.weapons.includes(w.id)) opts.push(() => { own.weapons.push(w.id); return `Legendary weapon found: ${w.name}! Equip it at the Armory.`; });
  for (const t of TALISMANS[id]) if (!own.talismans.includes(t.id)) opts.push(() => { own.talismans.push(t.id); return `Talisman found: ${t.name}!`; });
  for (const r of RELICS) if (!own.relics[r.id]) opts.push(() => { own.relics[r.id] = 1; return `Relic found: ${r.name}!`; });
  if (opts.length) { const s = pick(opts)(); G.banner = { s, sub: 'LEGENDARY CHEST', t: 3.5 }; persist(); }
  else { for (let k = 0; k < 10; k++) dropGold(p.x + R(-40, 40), p.y + R(-40, 40), 80); G.banner = { s: 'A hoard of gold!', sub: 'LEGENDARY CHEST', t: 2.5 }; }
}

// ---------------------------------------------------------------- procedural generators
function genMaze(world) {
  const cw = 15, ch = 9, W2 = cw * 3 + 1, H2 = ch * 3 + 1;
  const g = []; for (let y = 0; y < H2; y++) g.push(Array(W2).fill('#'));
  const seen = new Set(), st = [[0, 0]]; seen.add('0,0');
  const carveCell = (cx, cy) => { for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) g[cy * 3 + 1 + y][cx * 3 + 1 + x] = '.'; };
  carveCell(0, 0);
  while (st.length) {
    const [cx, cy] = st[st.length - 1];
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [cx + dx, cy + dy, dx, dy]).filter(([x, y]) => x >= 0 && y >= 0 && x < cw && y < ch && !seen.has(x + ',' + y));
    if (!nb.length) { st.pop(); continue; }
    const [nx, ny, dx, dy] = pick(nb); seen.add(nx + ',' + ny); carveCell(nx, ny);
    for (let k = 0; k < 2; k++) { if (dx) g[cy * 3 + 1 + k][cx * 3 + (dx > 0 ? 3 : 0)] = '.'; else g[cy * 3 + (dy > 0 ? 3 : 0)][cx * 3 + 1 + k] = '.'; }
    st.push([nx, ny]);
  }
  // loops so the Reaper can be outmaneuvered
  for (let k = 0; k < 28; k++) { const x = RI(1, cw - 2), y = RI(1, ch - 2); if (Math.random() < 0.5) { g[y * 3 + 1][x * 3 + 3] = '.'; g[y * 3 + 2][x * 3 + 3] = '.'; } else { g[y * 3 + 3][x * 3 + 1] = '.'; g[y * 3 + 3][x * 3 + 2] = '.'; } }
  g[1][1] = 'S'; g[2][2] = 'S'; g[H2 - 3][W2 - 3] = 'X';
  const put = (c, n) => { for (let k = 0; k < n; k++) for (let t = 0; t < 50; t++) { const x = RI(1, W2 - 2), y = RI(1, H2 - 2); if (g[y][x] === '.' && (x > 6 || y > 6)) { g[y][x] = c; break; } } };
  put('$', 28); put('f', 5); put('F', 2); put('p', 2); put('v', 14); put('e', 7); put('c', 2);
  return g.map(r => r.join(''));
}
function genDungeon(n, world) {
  const MW = Math.min(46 + n * 2, 80), MH = Math.min(34 + n, 54);
  const g = []; for (let y = 0; y < MH; y++) g.push(Array(MW).fill('#'));
  const rooms = [];
  for (let k = 0; k < 600 && rooms.length < Math.min(7 + Math.floor(n / 2), RULE('tileCap') ? ENDLESS_MAX_ROOMS : 15); k++) {   // at most 12 room tiles; past floor 50 they pack tighter
    const tight = n > 50 && RULE('tileCap'), w = RI(6, tight ? 9 : 12), h = RI(5, tight ? 7 : 9), gap = tight ? 1 : 3, x = RI(2, MW - w - 2), y = RI(2, MH - h - 2);
    if (rooms.some(r => x < r.x + r.w + gap && x + w + gap > r.x && y < r.y + r.h + gap && y + h + gap > r.y)) continue;
    rooms.push({ x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1) });
  }
  for (const r of rooms) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) g[y][x] = '.';
  const corr = [];
  const carve = (a, b) => { const s = []; const hx = (x0, x1, y) => { for (let x = Math.min(x0, x1); x <= Math.max(x0, x1) + 1; x++) { g[y][x] = g[y][x] === '#' ? '.' : g[y][x]; g[y + 1][x] = g[y + 1][x] === '#' ? '.' : g[y + 1][x]; s.push([x, y, 'h']); } }; const vy = (y0, y1, x) => { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1) + 1; y++) { g[y][x] = g[y][x] === '#' ? '.' : g[y][x]; g[y][x + 1] = g[y][x + 1] === '#' ? '.' : g[y][x + 1]; s.push([x, y, 'v']); } }; if (Math.random() < 0.5) { hx(a.cx, b.cx, a.cy); vy(a.cy, b.cy, b.cx); } else { vy(a.cy, b.cy, a.cx); hx(a.cx, b.cx, b.cy); } corr.push(s); };
  const conn = [0], rest = rooms.map((_, i) => i).slice(1);
  while (rest.length) { let best = null; for (const i of rest) for (const j of conn) { const d = Math.abs(rooms[i].cx - rooms[j].cx) + Math.abs(rooms[i].cy - rooms[j].cy); if (!best || d < best.d) best = { i, j, d }; } carve(rooms[best.j], rooms[best.i]); conn.push(best.i); rest.splice(rest.indexOf(best.i), 1); }
  for (let k = 0; k < 2; k++) { const a = pick(rooms), b = pick(rooms); if (a !== b) carve(a, b); }
  const inRoom = (x, y) => rooms.some(r => x >= r.x - 1 && x < r.x + r.w + 1 && y >= r.y - 1 && y < r.y + r.h + 1);
  // gates on a few corridor chokepoints, with matching keys placed before them
  let gates = 0;
  for (const s of corr.sort(() => Math.random() - 0.5)) { if (gates >= 1 + Math.floor(n / 4) || gates >= 4) break; const [x, y, d] = s[s.length >> 1];
    if (d === 'h' && !inRoom(x, y) && !inRoom(x, y + 1) && g[y - 1][x] === '#' && g[y + 2][x] === '#' && g[y][x] === '.' && g[y + 1][x] === '.') { g[y][x] = '='; g[y + 1][x] = '='; gates++; }
    else if (d === 'v' && !inRoom(x, y) && !inRoom(x + 1, y) && g[y][x - 1] === '#' && g[y][x + 2] === '#' && g[y][x] === '.' && g[y][x + 1] === '.') { g[y][x] = '='; g[y][x + 1] = '='; gates++; } }
  // decorate rooms
  const start = rooms[0]; g[start.cy][start.cx] = 'S'; g[start.cy][start.cx + 1] = 'S';
  let far = rooms[rooms.length - 1], fd = -1; for (const r of rooms) { const d = Math.abs(r.cx - start.cx) + Math.abs(r.cy - start.cy); if (d > fd) { fd = d; far = r; } }
  g[far.cy][far.cx] = 'X';
  const free = r => { for (let t = 0; t < 40; t++) { const x = RI(r.x + 1, r.x + r.w - 2), y = RI(r.y + 1, r.y + r.h - 2); if (g[y][x] === '.') return [x, y]; } return null; };
  const put = (r, c) => { const p = free(r); if (p) g[p[1]][p[0]] = c; };
  for (let k = 0; k < gates + 1; k++) put(rooms[Math.min(rooms.length - 1, 1 + k % Math.max(1, rooms.length - 1))], 'k');
  const tierMax = Math.min(3, 1 + Math.floor(n / 4));
  for (const r of rooms.slice(1)) {
    if (Math.random() < 0.75) put(r, String(RI(1, tierMax)));
    if (n > 3 && Math.random() < 0.35) put(r, String(RI(1, tierMax)));
    for (let k = 0; k < RI(0, 2); k++) put(r, 'e');
    if (Math.random() < 0.15 + n * 0.01) put(r, 'E');
    for (let k = 0; k < RI(1, 3); k++) put(r, 'v');
    if (Math.random() < 0.4) put(r, '$'); if (Math.random() < 0.25) put(r, 'b'); if (Math.random() < 0.2) put(r, 'c');
    if (Math.random() < 0.35) put(r, Math.random() < 0.3 ? 'F' : 'f');
    if (Math.random() < 0.12) put(r, 'p');
    if (r.w >= 9 && r.h >= 7 && Math.random() < 0.5) for (let k = 0; k < 3; k++) { const p = free(r); if (p && p[0] > r.x + 1 && p[1] > r.y + 1 && p[0] < r.x + r.w - 2 && p[1] < r.y + r.h - 2) g[p[1]][p[0]] = Math.random() < 0.5 ? '#' : '^'; }
  }
  if (n % 5 === 0) put(pick(rooms.slice(1)), 'L');
  return g.map(r => r.join(''));
}
