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
  const shares = [];
  amount = Math.floor(amount || 0); if (amount <= 0 || !G.heroes.length) return [];
  const tot = G.heroes.reduce((a, h) => a + (h.goldRun || 0), 0); let left = amount;
  const hg = G.stats && (G.stats.hg || (G.stats.hg = {}));   // per-player gold banked this floor (gates + exit), shown by the tally
  G.heroes.forEach((h, i) => { const share = i === G.heroes.length - 1 ? left : Math.floor(amount * (tot > 0 ? (h.goldRun || 0) / tot : 1 / G.heroes.length)); SAVE.banks[h.id] = bankOf(h.id) + share; left -= share; h.goldRun = 0; shares.push(share); if (hg) hg[h.pi] = (hg[h.pi] || 0) + share; });
  return shares;
}
// gate crossing (spec: 'gold banks only when you cross an exit or gate'): opening a gate or walking through an opened one banks
// the not-yet-banked part of the party purse, split per hero exactly like the exit. The crown's +500 stays exit-only (spec ties it to the floor exit).
function bankAtGate(h, how) {
  if (G.mode !== 'campaign' && G.mode !== 'endless') return 0;
  const unb = Math.floor((G.purse || 0) - (G.bankedRun || 0)); if (unb < SPEC.gateBank.min) return 0;
  G.secured = G.purse; const shares = bankSecured(unb); G.bankedRun = G.purse; persist();
  G.gateBanks = (G.gateBanks || 0) + 1; G.lastGateBank = { amount: unb, how, shares, t: G.time };
  G.heroes.forEach((o, i) => { if (shares[i] > 0) text(o.x, o.y - 44, `+${shares[i]} banked`, '#9fffe0', true); });
  G.bankFlash = SPEC.gateBank.flash; Snd.play('coin'); msg(`Gate crossed: ${unb} gold banked`, '#9fffe0', 2);
  return unb;
}
function checkGateCrossing() {
  const m = G.map; if (!m || !m.gateTiles) return;
  for (const h of G.heroes) { if (h.dead) continue; const i = Math.floor(h.y / T) * m.w + Math.floor(h.x / T);
    if (m.gateTiles.has(i) && m.t[i] !== TL.GATE) bankAtGate(h, 'cross'); }   // standing in an opened gateway banks whatever is not banked yet
}
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(SAVE)); } catch (e) { } }
function mastery(h, stat, v) {
  if (!h || !h.id || !v) return;
  const st = SAVE.mastery[h.id]; const before = st[stat] || 0; st[stat] = before + v;
  for (const ms of masteriesFor(h.id)) if (ms.stat === stat) ms.tiers.forEach((t, i) => { if (before < t && st[stat] >= t) { h.mods = heroMods(h.id); msg(`${h.def.name} mastered ${ms.name}${masteryTier(ms, i)}: ${ms.text(i)}`, '#ffd27a', 4); Snd.play('mastery'); G.newMasteries.push(`${h.def.name}: ${ms.name}${masteryTier(ms, i)}`); } });
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
  G.battle = null;
  G.heroes.forEach((h, i) => { const s = st[i % st.length]; h.x = s.x + (st.length > 1 ? 0 : i * 26); h.y = s.y; h.kx = h.ky = 0; h.dash = null; h.charging = null; h.spin = 0; h.souls = 0; h.shieldOut = false; h.blocking = false; h.inv = Math.max(h.inv, 1.5); });
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
  const m = G.map; G.stageWorld = world;
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
  if (G.mode === 'campaign' || G.mode === 'endless') { const spots = m.items.filter(i => i.c === '$' || i.c === 'c'); const sp = spots.length ? spots[Math.floor(spots.length / 2)] : null; if (sp) { const off = [[20, 0], [-20, 0], [0, 20], [0, -20]].find(([dx, dy]) => !blocksWalk(tileAt(Math.floor((sp.x + dx) / T), Math.floor((sp.y + dy) / T)), false)) || [0, 8]; G.pickups.push({ kind: 'crown', x: sp.x + off[0], y: sp.y + off[1] }); } }   // beside the item spot, on a walkable tile (it used to be +20px blind, sometimes inside a wall or pit)
  // endless: a skull-coin podium every 3rd floor
  if (G.mode === 'endless' && ENDLESS.coinFloor(G.endless) && m.starts.length) { const st = m.starts[0]; G.pickups.push({ kind: 'coin', x: st.x + 60, y: st.y }); }
  for (const r of m.reapers) mkFoe('reaper', r.x, r.y);
  m.arenaSet = new Set(m.arenaTiles);
}
// ---------------------------------------------------------------- never-stuck guarantee
// After a floor is built, everything needed to finish it (the exit, every key) and the crown must be reachable on foot from the start.
// Gates and cracked walls count as passable (keys or the rusted-lock fallback open gates; hits break cracks); walls, void and pits do not.
// Repairs: an unreachable key or crown moves to the nearest reachable floor tile; an unreachable start joins the first start; an exit cut off
// by walls or pits gets a corridor carved to it. Every repair is logged in G.floorRepairs.
function floorReach(m, from) {
  const seen = new Uint8Array(m.w * m.h), q = [from]; seen[from] = 1;
  for (let k = 0; k < q.length; k++) { const i = q[k], x = i % m.w, y = (i / m.w) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h) continue; const j = ny * m.w + nx, t = m.t[j]; if (seen[j] || t === TL.WALL || t === TL.VOID || t === TL.PIT) continue; seen[j] = 1; q.push(j); } }
  return seen;
}
function ensureFinishable() {
  const m = G.map, log = G.floorRepairs = []; if (!m || !m.starts.length) return log;
  const tIdx = e => Math.floor(e.y / T) * m.w + Math.floor(e.x / T);
  let S = floorReach(m, tIdx(m.starts[0]));
  // the exit: carve the shortest corridor (through walls and pits, never void or the map edge) from the reachable area
  if (m.exit && !S[m.exit.i]) {
    const prev = new Int32Array(m.w * m.h).fill(-1), q = [m.exit.i]; prev[m.exit.i] = m.exit.i; let hit = -1;
    for (let k = 0; k < q.length && hit < 0; k++) { const i = q[k], x = i % m.w, y = (i / m.w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 1 || ny < 1 || nx >= m.w - 1 || ny >= m.h - 1) continue; const j = ny * m.w + nx; if (prev[j] >= 0 || m.t[j] === TL.VOID) continue; prev[j] = i; if (S[j]) { hit = j; break; } q.push(j); } }
    if (hit >= 0) { let n = 0; for (let i = prev[hit]; i !== m.exit.i; i = prev[i]) if (m.t[i] === TL.WALL || m.t[i] === TL.PIT) { m.t[i] = TL.FLOOR; n++; } log.push({ what: 'exitCorridor', tiles: n }); S = floorReach(m, tIdx(m.starts[0])); }
  }
  const spots = []; for (let i = 0; i < S.length; i++) if (S[i] && m.t[i] === TL.FLOOR) spots.push(i);
  const nearest = (x, y) => { let best = -1, bd = Infinity; for (const i of spots) { const d = hyp((i % m.w + 0.5) * T - x, (((i / m.w) | 0) + 0.5) * T - y); if (d < bd) { bd = d; best = i; } } return best; };
  for (const it of G.pickups) { if ((it.kind !== 'key' && it.kind !== 'crown') || S[tIdx(it)]) continue; const j = nearest(it.x, it.y); if (j < 0) continue;
    log.push({ what: it.kind, from: [Math.round(it.x), Math.round(it.y)] }); it.x = (j % m.w + 0.5) * T; it.y = (((j / m.w) | 0) + 0.5) * T; }
  for (let k = 1; k < m.starts.length; k++) if (!S[tIdx(m.starts[k])]) { log.push({ what: 'start', k }); m.starts[k] = { x: m.starts[0].x + 24 * k, y: m.starts[0].y }; if (!S[tIdx(m.starts[k])]) m.starts[k] = { x: m.starts[0].x, y: m.starts[0].y }; }
  if (log.length) console.warn('floor repaired', JSON.stringify(log));
  return log;
}
function startCampaignFloor(wi, fi) {
  resetLists();
  const world = WORLDS[wi], fl = world.floors[fi];
  G.mode = 'campaign'; G.worldIdx = wi; G.floorIdx = fi; G.worldTier = wi;
  G.scale = scaleFor('campaign', wi); G.mods = {}; G.goldMul = 1;
  const rows = fl.map === 'maze' ? genMaze(world) : MAPS[fl.map];
  G.map = parseMap(rows, world.theme, { dark: fl.gimmick === 'dark' });
  G.floorName = fl.name; G.worldName = world.name;
  populate(world); ensureFinishable();
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
function newStats() { return { kills: 0, gold: 0, spawners: 0, foodSmashed: 0, start: G.time, purseStart: G.purse, hk: {}, hg: {} }; }
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
  populate(world); ensureFinishable(); renderMapCanvas(); placeHeroes();
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
  for (const h of G.heroes) { h.dead = false; h.hp = h.maxHp; h.potions = 2; h.keys = 0; h.souls = 0; h.cd = {}; h.buff = {}; }
  placeHeroes(); G.banner = null;   // the top bar names the camp; a centre banner covered the Hero Shrine
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
  checkGateCrossing(); if (G.bankFlash > 0) G.bankFlash -= dt;
  // gimmicks
  if (G.gimmick === 'reaper') { G.gimmickT -= dt; if (G.gimmickT <= 0 && !G.foes.some(f => f.type === 'reaper')) { const h = pick(G.heroes.filter(x => !x.dead)); if (h) { const s = G.map.starts[0] || h; const f = mkFoe('reaper', s.x, s.y, { awake: true }); Snd.play('reaper'); msg('The Reaper enters the labyrinth!', '#9ff', 3); } } }
  if (G.gimmick === 'meteors') { G.gimmickT -= dt; if (G.gimmickT <= 0) { G.gimmickT = R(0.7, 1.3) / G.heroes.length; const h = pick(G.heroes.filter(x => !x.dead)); if (h) { const x = h.x + R(-220, 220) + (h.vx || 0) * 0.8, y = h.y + R(-180, 180) + (h.vy || 0) * 0.8; if (!blocksShot(tileAt(Math.floor(x / T), Math.floor(y / T)))) tele(x, y, 48, 1.1, 20 * G.scale.dmg, '#ff7a2a', hz => G.hazards.push({ kind: 'fire', x: hz.x, y: hz.y, r: 28, life: 2.2, t: 0, team: 'foe', dps: 10 })); } } }
  if (G.gimmick === 'dark' || G.map.dark) { G.gimmickT -= dt; if (G.gimmickT <= 0) { G.gimmickT = 3.5; if (G.foes.length < 60) { const h = pick(G.heroes.filter(x => !x.dead)); if (h) for (let k = 0; k < 3; k++) { const a = R(0, 6.28), x = h.x + Math.cos(a) * 300, y = h.y + Math.sin(a) * 300; if (!collide(x, y, 9)) mkFoe('spiderling', x, y, { spawned: true }); } } } }
  // arena waves
  if (G.arena) updateArena(dt);
  updateBattleRooms(dt);
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
// ---------------------------------------------------------------- battle rooms (Slayer match, Oct 25 2026; numbers in SPEC.battle)
// A large room locks once it is awake and a hero is well inside: iron gates slam on every doorway, any partner outside is pulled
// in, and waves come (some rise out of the dirt, some step out of the room's obelisks). When the waves are spent and every foe
// and obelisk in the room is gone, the gates open. Safety valves: Death showing up, every living hero ending up outside, or 25s
// with no progress all open the gates, so a locked room can never trap the party.
function battleRoomOk(r) { const m = G.map, rr = m && m.rooms && m.rooms[r]; return !!rr && SPEC.battle.kinds.includes(rr.kind) && !rr.arena && !rr.side && (G.mode === 'campaign' || G.mode === 'endless') && !G.boss && !G.arena && !(m.cleared && m.cleared[r]) && !m.noLock; }
function roomTileSet(r) { const m = G.map; m._roomSets = m._roomSets || {}; if (!m._roomSets[r]) { const s = new Set(); for (let i = 0; i < m.roomOf.length; i++) if (m.roomOf[i] === r) s.add(i); m._roomSets[r] = s; } return m._roomSets[r]; }
function roomDoors(r) {   // the first walkable tile outside the room on every opening
  const m = G.map, set = roomTileSet(r), out = new Set();
  for (const i of set) { const x = i % m.w, y = (i / m.w) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h) continue; const j = ny * m.w + nx; if (set.has(j)) continue; const t = m.t[j]; if (t === TL.FLOOR || t === TL.SPIKE) out.add(j); } }
  return [...out];
}
const battleFoes = B => G.foes.filter(f => ALIVE(f) && f.type !== 'reaper' && f.charm <= 0 && (f.battleR === B.r || B.set.has(Math.floor(f.y / T) * G.map.w + Math.floor(f.x / T))));   // a room foe that wandered out before the lock is not locked in, so it doesn't hold the gates
const battleSpawners = B => G.spawners.filter(s => s.hp > 0 && s.room === B.r);
function lockBattle(r) {
  const m = G.map, S = SPEC.battle, doors = roomDoors(r); if (!doors.length) { (m.cleared = m.cleared || {})[r] = true; return; }
  const set = roomTileSet(r);
  for (const i of doors) { m.t[i] = TL.AGATE; redrawTile(i % m.w, (i / m.w) | 0); burst((i % m.w + 0.5) * T, (((i / m.w) | 0) + 0.5) * T, '#9a9aa4', 10, 160, 3, 0.5); }
  flowT = 0; sealInside(set);
  Snd.play('gateslam'); addTrauma(0.5); msg('The gates slam shut!', '#ff9a5a', 2);
  const n = G.mode === 'endless' && G.endless >= S.deepEndless ? S.wavesDeep : S.waves;
  G.battle = { r, set, doors, waves: n, wave: 0, queue: [], t: S.firstDelay, gap: 0, stall: 0, sig: '', pullT: 0 };
  G.battleLog = (G.battleLog || []).concat([{ r, t: G.time, ev: 'lock', doors: doors.length }]);
}
function unlockBattle(why) {
  const B = G.battle, m = G.map; if (!B) return;
  for (const i of B.doors) if (m.t[i] === TL.AGATE) { m.t[i] = TL.FLOOR; redrawTile(i % m.w, (i / m.w) | 0); burst((i % m.w + 0.5) * T, (((i / m.w) | 0) + 0.5) * T, '#ffd27a', 12, 180, 3, 0.6); }
  flowT = 0; Snd.play('gate'); addTrauma(0.3);
  if (why === 'clear') { (m.cleared = m.cleared || {})[B.r] = true; msg('Room cleared! The gates open.', '#ffd27a', 2.2); Snd.play('wavedone'); const rr = m.rooms[B.r]; ring((rr.x + rr.w / 2) * T, (rr.y + rr.h / 2) * T, 160, '#ffd27a', 0.6, 6); }
  else if (why === 'death') { m.noLock = true; msg('Death comes... the gates give way!', '#ff6a5a', 2.2); }
  else (m.cleared = m.cleared || {})[B.r] = true;   // left / stalled: never re-locks
  G.battleLog = (G.battleLog || []).concat([{ r: B.r, t: G.time, ev: 'open', why }]);
  G.battle = null;
}
function battleSpawn(B, type) {
  const m = G.map, S = SPEC.battle, tiles = [...B.set], sp = battleSpawners(B), rise = !sp.length || Math.random() < S.riseShare;
  for (let k = 0; k < 40; k++) {
    let x, y; if (rise) { const i = pick(tiles); x = (i % m.w + 0.5) * T; y = (((i / m.w) | 0) + 0.5) * T; } else { const s = pick(sp), a = R(0, 6.28); x = s.x + Math.cos(a) * (s.r + 18); y = s.y + Math.sin(a) * (s.r + 18); }
    if (!B.set.has(Math.floor(y / T) * m.w + Math.floor(x / T)) || collide(x, y, 14) || G.heroes.some(h => !h.dead && hyp(h.x - x, h.y - y) < S.minHeroDist)) continue;
    const tier = G.mode === 'endless' ? Math.min(3, 1 + Math.floor(G.endless / 25)) : 1;
    if (rise) G.hazards.push({ kind: 'tele', x, y, r: 22, delay: S.riseTime, t: 0, col: '#8a6a40', waveSpawn: true, battle: true, onFire: hz => { const f = mkFoe(type, hz.x, hz.y, { tier, spawned: true }); f.room = B.r; f.battleR = B.r; f.stag = Math.max(f.stag || 0, S.riseStun); f.risen = 0.6; burst(hz.x, hz.y, '#6a5030', 18, 140, 4, 0.7); decal(hz.x, hz.y, 16, 'rgba(40,25,10,0.45)', 20); } });   // rises out of the dirt
    else { const f = mkFoe(type, x, y, { tier, spawned: true }); f.room = B.r; f.battleR = B.r; burst(x, y, '#c9b08a', 10, 120, 3, 0.5); }
    return true;
  }
  return false;
}
function updateBattleRooms(dt) {
  const m = G.map; if (!m || !m.rooms || !m.rooms.length || G.mode === 'hub' || !(G.mode === 'campaign' || G.mode === 'endless')) return;
  const S = SPEC.battle, reaper = G.foes.some(f => f.type === 'reaper' && ALIVE(f) && !roomAsleep(f.room));
  let B = G.battle;
  if (!B) {
    if (reaper) return;
    for (const h of G.heroes) { if (h.dead) continue; const r = roomAt(h.x, h.y); if (r < 0 || roomAsleep(r) || !battleRoomOk(r)) continue;
      const doors = roomDoors(r); if (doors.some(i => hyp((i % m.w + 0.5) * T - h.x, (((i / m.w) | 0) + 0.5) * T - h.y) < S.doorClear * T + T)) continue;   // wait until the hero is past the doorway
      lockBattle(r); break; }
    return;
  }
  if (reaper) { unlockBattle('death'); return; }
  const alive = G.heroes.filter(h => !h.dead), inside = alive.filter(h => B.set.has(Math.floor(h.y / T) * m.w + Math.floor(h.x / T)));
  if (!alive.length) return;   // everyone down: the normal revive / defeat flow decides
  if (!inside.length) { unlockBattle('left'); return; }
  if (inside.length < alive.length) { B.pullT -= dt; if (B.pullT <= 0) { B.pullT = S.pullEvery; sealInside(B.set); } }   // a revived or lagging partner is pulled in
  const foes = battleFoes(B), sps = battleSpawners(B), pend = G.hazards.filter(z => z.battle && z.t < z.delay).length;
  const sig = foes.length + ':' + Math.round(foes.reduce((a, f) => a + f.hp, 0)) + ':' + sps.map(s => s.hp).join(',') + ':' + B.wave + ':' + B.queue.length;
  if (sig !== B.sig) { B.sig = sig; B.stall = 0; } else if ((B.stall += dt) > S.stall) { unlockBattle('stall'); return; }
  B.t -= dt;
  if (B.queue.length) { B.gap -= dt; if (B.gap <= 0) { B.gap = S.spawnGap; if (battleSpawn(B, B.queue[0])) B.queue.shift(); } return; }
  if (B.wave < B.waves) {
    if (B.t <= 0 && foes.length + pend <= S.nextAt) { B.wave++; const n = Math.round((S.waveBase + S.wavePer * (B.wave - 1)) * ENDLESS.coopCount(Math.max(1, G.heroes.length)));
      for (let k = 0; k < n; k++) B.queue.push(waveFoe(G.stageWorld || WORLDS[0])); msg(`Wave ${B.wave} of ${B.waves}`, '#ff9a5a', 1.4); Snd.play('windup'); B.t = 1.0; }
    return;
  }
  if (!foes.length && !sps.length && !pend) unlockBattle('clear');
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
    const foes = arenaFoes(), pend = G.hazards.filter(h => h.waveSpawn && h.arena).length;
    const left = foes.length + A.queue.length + pend;
    A.left = left;
    if (left && arenaGuard(A, foes, dt)) return;
    if (left === 0) {
      if (A.wave >= A.waves) { A.state = 'done'; arenaDone(); }
      else { A.state = 'break'; A.t = 4; msg(`Wave ${A.wave} cleared!`, '#ffd27a', 2); Snd.play('wavedone'); if (A.kind === 'arena') { G.purse += 120 * A.wave; text(G.heroes[0].x, G.heroes[0].y - 40, `+${120 * A.wave} gold`, '#ffd84a', true); mastery(G.heroes[0], 'arenaWaves', 1); for (const h of G.heroes.slice(1)) mastery(h, 'arenaWaves', 1); } dropWaveSupplies(); }
    }
  }
}
// Wave progress counts only what is locked in with the party: this wave's own spawns (wherever they are) plus any foe standing
// inside the arena. Foes and spawners elsewhere on the floor, Death and charmed foes never hold a wave open.
const inArena = (x, y) => { const m = G.map; return !m.arenaSet || !m.arenaSet.size || m.arenaSet.has(Math.floor(y / T) * m.w + Math.floor(x / T)); };
function arenaFoes() { return G.foes.filter(f => ALIVE(f) && f.type !== 'reaper' && !(f.charm > 0) && (f.arenaWave || inArena(f.x, f.y))); }
// Soft-lock guard: if nothing changes for a while, stragglers are pulled into the arena, and after a long stall they crumble.
function arenaGuard(A, foes, dt) {
  const S = SPEC.arenaGuard, sig = foes.length + ':' + Math.round(foes.reduce((a, f) => a + f.hp, 0)) + ':' + A.queue.length + ':' + A.wave;
  if (sig !== A.sig) { A.sig = sig; A.stall = 0; A.pullT = 0; return false; }
  A.stall = (A.stall || 0) + dt;
  if (A.stall >= S.clearAfter) {
    for (const f of foes) { burst(f.x, f.y, '#c060ff', 12, 120, 3, 0.5); f.hp = 0; f.dead = true; f.noLoot = true; }
    A.queue.length = 0; G.hazards = G.hazards.filter(h => !(h.waveSpawn && h.arena)); A.stall = 0; A.sig = ''; msg('The stragglers crumble to dust.', '#c8a0ff', 2.5);
    (G.arenaLog = G.arenaLog || []).push({ ev: 'clear', wave: A.wave, n: foes.length }); return true;
  }
  if (A.stall >= S.pullAfter && (A.pullT -= dt) <= 0) {
    A.pullT = S.pullEvery; const tiles = arenaTiles(), m = G.map; let n = 0;
    for (const f of foes) { if (inArena(f.x, f.y) && G.heroes.some(h => !h.dead && hyp(h.x - f.x, h.y - f.y) < 8 * T)) continue;
      for (let k = 0; k < 20; k++) { const i = pick(tiles), x = (i % m.w + 0.5) * T, y = (Math.floor(i / m.w) + 0.5) * T; if (collide(x, y, f.r)) continue;
        burst(f.x, f.y, '#c060ff', 10, 120, 3, 0.5); f.x = x; f.y = y; f.kx = f.ky = 0; f.awake = true; burst(x, y, '#c060ff', 14, 120, 3, 0.5); n++; break; } }
    if (n) (G.arenaLog = G.arenaLog || []).push({ ev: 'pull', wave: A.wave, n });
  }
  return false;
}
function arenaTiles() { const m = G.map; if (m.arenaTiles.length) return m.arenaTiles; const out = []; for (let i = 0; i < m.t.length; i++) if (m.t[i] === TL.FLOOR) out.push(i); return out; }
function spawnWaveFoe(type) {
  const tiles = arenaTiles();
  for (let k = 0; k < 30; k++) {
    const i = pick(tiles), x = (i % G.map.w + 0.5) * T, y = (Math.floor(i / G.map.w) + 0.5) * T;
    if (G.heroes.some(h => !h.dead && hyp(h.x - x, h.y - y) < 200) || collide(x, y, 14)) continue;
    G.hazards.push({ kind: 'tele', x, y, r: 24, delay: 0.7, t: 0, col: '#c060ff', waveSpawn: true, arena: true, onFire: hz => { const f = mkFoe(type, hz.x, hz.y, { tier: 1 + Math.floor(G.arena.wave / 3), spawned: true }); f.arenaWave = G.arena ? G.arena.wave : 1; burst(hz.x, hz.y, '#c060ff', 14, 120, 3, 0.5); } });
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
  const king = G.heroes.find(h => h.crown && !h.dead), crownB = king ? SPEC.crown.endBonus : 0, base = Math.round((150 * depth + (isFinite(G.rez) ? G.rez * 60 : 0) ) * D.gold * deathCut);
  const loot = base + crownB + potionsHeld * SPEC.potion.exitGold;   // +500 per potion held at the exit
  G.purse += loot; for (const h of G.heroes) h.goldRun = (h.goldRun || 0) + base / G.heroes.length + (h.dead ? 0 : h.potions * SPEC.potion.exitGold) + (h === king ? crownB : 0);   /* the crown and potion bonuses go to the hero who earned them */
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
  const hg = G.stats.hg || {}, hk = G.stats.hk || {}, masteries = G.newMasteries.splice(0);
  const tally = { t: 0, open: true, masteries, crownB, heroes: G.heroes.map(h => ({ pi: h.pi, name: h.def.name, col: h.def.color, accent: h.def.accent, gold: hg[h.pi] || 0, kills: hk[h.pi] || 0, crown: h === king ? crownB : 0, def: h.def, weapon: h.weapon })) };
  { const top = tally.heroes.slice().sort((a, b) => b.gold - a.gold || b.kills - a.kills)[0]; if (G.heroes.length > 1 && top && top.gold > 0) tally.greedy = top.pi; }
  tally.total = tally.heroes.reduce((a, x) => a + x.gold, 0);
  RESULTS = { title, gained, loot, lootNote: `${D.name} x${D.gold}${G.deathsFloor ? `, ${G.deathsFloor} death${G.deathsFloor > 1 ? 's' : ''} -${Math.round((1 - deathCut) * 100)}%` : ''}`, kills: G.stats.kills, spawners: G.stats.spawners, time: G.time - G.stats.start, purse: G.purse, next, masteries, tally, defeat: false };
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
function genDungeon(n, world) {   // Endless and Extended Realms: Slayer-style stage (see genStage in maps.js)
  const tight = n > 50 && RULE('tileCap'), cap = RULE('tileCap') ? ENDLESS_MAX_ROOMS : 15;   // at most 12 rooms; past floor 50 they pack tighter
  const chainN = Math.min(4 + Math.floor(n / 3), 8), side = Math.min(1 + Math.floor(n / 10), 3, cap - chainN);
  const seq = tight ? 'MSMLSM' : 'LMLSLM'; let plan = 'M'; for (let k = 1; k < chainN; k++) plan += seq[(k - 1 + n) % seq.length];
  const water = !['w1', 'final'].includes(world.id) && world.theme !== WORLDS[0].theme;
  return genStage({ seed: Math.floor(Math.random() * 1e9), plan, side, gates: Math.min(1 + Math.floor(n / 4), 4), hazard: water ? '~' : '^', tierMax: Math.min(3, 1 + Math.floor(n / 4)),
    legend: n % 5 === 0, decor: world.theme === WORLDS[1].theme ? 'w' : world.theme === WORLDS[0].theme ? 'g' : null, eliteP: Math.min(0.3, n * 0.01) });
}
