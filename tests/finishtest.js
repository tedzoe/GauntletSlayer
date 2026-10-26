// Never-stuck guarantee: seeded sweep of 500 floors per mode (endless, Extended Realm, regenerated campaign stages): exit, every key and
// the crown reachable on foot from the start. Plus the repair paths: a walled-off exit gets a corridor, a key or crown inside a wall moves out.
const ENV = require('./env');
const puppeteer = require('puppeteer-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const N = +(process.env.FINISH_N || 500);
(async () => {
  await ENV.ready;
  const b = await puppeteer.launch({ executablePath: ENV.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage(); await p.setViewport({ width: 1152, height: 648 });
  const logs = []; p.on('pageerror', e => logs.push('pageerror: ' + e.message));
  await p.goto(ENV.BASE + 'index.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await sleep(800);
  let pass = 0, fail = 0; const chk = (name, got, want) => { const okk = typeof want === 'function' ? want(got) : JSON.stringify(got) === JSON.stringify(want); okk ? pass++ : fail++; console.log((okk ? 'PASS ' : 'FAIL ') + name + '  ' + JSON.stringify(got).slice(0, 400)); };
  await p.evaluate(() => {
    const S = __game.SEL; S.slots = [{ dev: 'kb1', idx: 0, ready: true }]; __game.startParty();
    window.FT = {
      tileOf: e => Math.floor(e.y / T) * G.map.w + Math.floor(e.x / T),
      reach() { const m = G.map, seen = new Uint8Array(m.w * m.h), q = [FT.tileOf(m.starts[0])]; seen[q[0]] = 1;   // independent of the game's own floorReach
        for (let k = 0; k < q.length; k++) { const i = q[k], x = i % m.w, y = (i / m.w) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const j = (y + dy) * m.w + x + dx, t = tileAt(x + dx, y + dy); if (seen[j] || t === TL.WALL || t === TL.VOID || t === TL.PIT) continue; seen[j] = 1; q.push(j); } } return seen; },
      ok() { const R = FT.reach(), m = G.map, ks = G.pickups.filter(i => i.kind === 'key'), cs = G.pickups.filter(i => i.kind === 'crown');
        return { exit: !!m.exit && !!R[m.exit.i], keys: ks.every(i => R[FT.tileOf(i)]), crown: cs.length === 1 && cs.every(i => R[FT.tileOf(i)]), starts: m.starts.every(s => R[FT.tileOf(s)]) }; },
      build(mode, k, seed) { const real = Math.random; Math.random = seeded(seed * 7919 + 13); let lab;
        try { if (mode === 'camp') { const fl = []; WORLDS.forEach((w, wi) => w.floors.forEach((f, fi) => { if (!f.boss && f.map !== 'maze' && STAGE_SPECS[f.map]) fl.push([wi, fi, f.map]); })); const [wi, fi, key] = fl[k % fl.length]; lab = key; const keep = MAPS[key];
              try { MAPS[key] = genStage(Object.assign({}, STAGE_SPECS[key], { seed: seed * 104729 + 7 })); beginRun(); startCampaignFloor(wi, fi); } finally { MAPS[key] = keep; } }
          else { const L = ENDLESS.loop(), n = mode === 'endless' ? 1 + (k % L) : L + 1 + (k % 12); lab = 'e' + n; beginRun(); startEndlessFloor(n); } } finally { Math.random = real; }
        return lab; } };
  });
  const sweep = mode => p.evaluate((mode, N) => { const out = { n: 0, bad: [], repaired: 0 }; for (let k = 0; k < N; k++) { const lab = FT.build(mode, k, 1 + k); const r = FT.ok(); out.n++; if ((G.floorRepairs || []).length) out.repaired++; if (!(r.exit && r.keys && r.crown && r.starts)) out.bad.push([lab, 1 + k, r]); } return out; }, mode, N);
  for (const mode of ['endless', 'xrealm', 'camp']) { const r = await sweep(mode); chk(`${mode}: ${r.n} seeded floors, exit + keys + crown + starts reachable on every one`, r, g => g.n === N && g.bad.length === 0); }
  // the shipped campaign floors (fixed seeds) too
  const fixed = await p.evaluate(() => { const bad = []; let n = 0; WORLDS.forEach((w, wi) => w.floors.forEach((f, fi) => { if (f.boss || f.map === 'maze') return; for (let s = 1; s <= 20; s++) { const real = Math.random; Math.random = seeded(s); try { beginRun(); startCampaignFloor(wi, fi); } finally { Math.random = real; } n++; const r = FT.ok(); if (!(r.exit && r.keys && r.crown)) bad.push([f.map, s, r]); } })); return { n, bad }; });
  chk('shipped campaign stages x 20 populate seeds: all finishable', fixed, g => g.bad.length === 0 && g.n > 0);
  // repair paths
  const rep = await p.evaluate(() => { const out = {};
    FT.build('endless', 3, 42); { const m = G.map, ex = m.exit, ring = []; const R0 = FT.reach();
      // wall the exit in completely, then rerun the guarantee
      const cx = ex.i % m.w, cy = (ex.i / m.w) | 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { if (Math.max(Math.abs(dx), Math.abs(dy)) !== 2) continue; const j = (cy + dy) * m.w + cx + dx; if (m.t[j] !== TL.VOID) { m.t[j] = TL.WALL; ring.push(j); } }
      const before = FT.ok().exit; const log = ensureFinishable(); out.exit = { before, after: FT.ok().exit, log: log.map(x => x.what), wasReachable: !!R0[ex.i] }; }
    FT.build('endless', 4, 43); { const m = G.map; let wallT = -1; for (let i = 0; i < m.t.length && wallT < 0; i++) { const x = i % m.w, y = (i / m.w) | 0; if (m.t[i] === TL.WALL && x > 2 && y > 2 && x < m.w - 3 && y < m.h - 3) { let solid = true; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (m.t[i + dy * m.w + dx] !== TL.WALL) solid = false; if (solid) wallT = i; } }
      const key = { kind: 'key', x: (wallT % m.w + 0.5) * T, y: (((wallT / m.w) | 0) + 0.5) * T }; G.pickups.push(key); const cr = G.pickups.find(i => i.kind === 'crown'); cr.x = key.x + 1; cr.y = key.y;
      const before = FT.ok(); const log = ensureFinishable(); const after = FT.ok(); out.items = { before: [before.keys, before.crown], after: [after.keys, after.crown], log: log.map(x => x.what), onFloor: [key, cr].every(i => tileAt(Math.floor(i.x / T), Math.floor(i.y / T)) === TL.FLOOR) }; }
    // the root cause: an item spot right next to a wall / pit no longer pushes the crown into it
    { const fails = []; for (let s = 1; s <= 300; s++) { FT.build('endless', s, 5000 + s); const c = G.pickups.find(i => i.kind === 'crown'); if (c && blocksWalk(tileAt(Math.floor(c.x / T), Math.floor(c.y / T)), false)) fails.push(s); if ((G.floorRepairs || []).some(x => x.what === 'crown')) fails.push('rep' + s); } out.crownPlace = fails; }
    return out; });
  chk('a walled-off exit gets a corridor carved and is reachable again', rep.exit, g => !g.before && g.after && g.log.includes('exitCorridor'));
  chk('a key and the crown inside solid wall are moved to reachable floor', rep.items, g => !g.before[0] && !g.before[1] && g.after[0] && g.after[1] && g.onFloor && g.log.includes('key') && g.log.includes('crown'));
  chk('root cause fixed: the crown is placed on a walkable tile without needing a repair (300 floors)', rep.crownPlace, []);
  chk('no page errors', logs, []);
  console.log(`\nfinishtest: ${pass} passed, ${fail} failed`); await b.close(); process.exit(fail ? 1 : 0);
})();
