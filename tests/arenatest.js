// Arena floors (Charnel Court, Gnawing Pit, Crucible) and the Daily Arena: a wave counts only its own spawns and foes inside the
// arena, so floor foes and spawners left outside the sealed gates never hold it open; the soft-lock guard pulls stragglers in and
// clears a stalled wave. Battle rooms: a room foe that wandered outside before the lock doesn't hold the gates.
const ENV = require('./env');
const puppeteer = require('puppeteer-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await ENV.ready;
  const b = await puppeteer.launch({ executablePath: ENV.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage(); await p.setViewport({ width: 1152, height: 648 });
  const logs = []; p.on('pageerror', e => logs.push('pageerror: ' + e.message));
  await p.goto(ENV.BASE + 'index.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await sleep(800);
  let pass = 0, fail = 0; const chk = (name, got, want) => { const okk = typeof want === 'function' ? want(got) : JSON.stringify(got) === JSON.stringify(want); okk ? pass++ : fail++; console.log((okk ? 'PASS ' : 'FAIL ') + name + (okk ? '' : '  got ' + JSON.stringify(got).slice(0, 500))); };
  const R = await p.evaluate(() => {
    const run = s => { for (let i = 0; i < Math.round(s * 60); i++) { menuGuard = 0; __game.tick(); } };
    const setup = (wi, fi, ids = ['brannoc']) => { const S = __game.SEL; S.slots = ids.map((id, i) => ({ dev: i ? 'pad' + (i - 1) : 'kb1', idx: HEROES.findIndex(h => h.id === id), ready: true })); __game.startParty(); beginRun();
      if (wi < 0) startArena(); else startCampaignFloor(wi, fi); G.heroes.forEach(h => { h.inv = 1e9; h.maxHp = h.hp = 1e6; }); };
    const tileOf = e => Math.floor(e.y / T) * G.map.w + Math.floor(e.x / T);
    const enter = () => { const m = G.map, i = m.arenaTiles[Math.floor(m.arenaTiles.length / 2)]; for (const h of G.heroes) { const q = freeSpot((i % m.w + 0.5) * T, (((i / m.w) | 0) + 0.5) * T, h.r, false, j => m.arenaSet.has(j)); h.x = q.x; h.y = q.y; } run(0.1); };
    const outside = () => { const m = G.map; return { foes: G.foes.filter(f => ALIVE(f) && f.type !== 'reaper' && !m.arenaSet.has(tileOf(f))).length, spawners: G.spawners.filter(s => s.hp > 0 && !m.arenaSet.has(tileOf(s))).length }; };
    const out = { floors: [] };
    // every arena-type floor: fight all three waves, never touching anything outside the arena
    for (const [wi, fi] of WORLDS.slice(0, 3).flatMap((w, wi) => w.floors.map((f, fi) => f.arena ? [wi, fi] : null).filter(Boolean))) {
      setup(wi, fi); const before = outside(); enter(); const A = G.arena; const r = { name: G.floorName, before, sealed: A.state !== 'idle' && G.map.agates.every(i => G.map.t[i] === TL.AGATE), waves: [] };
      for (let k = 0; k < 600 && A.state !== 'done'; k++) { for (const f of arenaFoes()) killFoe(f, G.heroes[0], {}); run(0.25); if (r.waves[r.waves.length - 1] !== A.wave) r.waves.push(A.wave); }
      r.after = outside(); r.state = A.state; r.exitOpen = G.exitOpen; r.gatesOpen = G.map.agates.every(i => G.map.t[i] === TL.FLOOR); r.guard = (G.arenaLog || []).length; r.time = +G.time.toFixed(1);
      out.floors.push(r); G.arenaLog = [];
    }
    // the Daily Arena (whole map is the arena) still clears its first wave
    { setup(-1); const A = G.arena; for (let k = 0; k < 400 && A.wave < 2; k++) { for (const f of arenaFoes()) killFoe(f, G.heroes[0], {}); run(0.25); } out.daily = { wave: A.wave, state: A.state }; }
    // guard: a wave foe stranded outside the gates (and never hurt) gets pulled in after 15s, then crumbles after 45s
    { setup(0, 2); enter(); const A = G.arena; run(1.5); A.queue.length = 0; run(1.0); const mine = arenaFoes().filter(f => f.arenaWave);
      const keep = mine[0]; for (const f of mine.slice(1)) killFoe(f, G.heroes[0], {}); G.hazards = G.hazards.filter(h => !h.arena);
      const m = G.map, outT = [...Array(m.t.length).keys()].find(i => m.t[i] === TL.FLOOR && !m.arenaSet.has(i) && !collide((i % m.w + 0.5) * T, (((i / m.w) | 0) + 0.5) * T, 16)); keep.x = (outT % m.w + 0.5) * T; keep.y = (((outT / m.w) | 0) + 0.5) * T; keep.inv = 0;
      const wave0 = A.wave, outsideNow = !m.arenaSet.has(tileOf(keep)); run(10); const stillOut = !m.arenaSet.has(tileOf(keep)); run(8);
      const pulled = m.arenaSet.has(tileOf(keep)); keep.atkT = 999; keep.spd = 0; keep.d = Object.assign({}, keep.d, { beh: 'none' }); run(45);
      out.guard = { wave0, outsideNow, stillOutAt10s: stillOut, pulledBy18s: pulled, crumbled: !ALIVE(keep), progressed: A.wave > wave0 || A.state === 'break' || A.state === 'done', log: (G.arenaLog || []).map(e => e.ev) };
    }
    // battle room: a room foe that walked out of the room before the lock doesn't count toward that room's waves
    { const S = __game.SEL; S.slots = [{ dev: 'kb1', idx: HEROES.findIndex(h => h.id === 'brannoc'), ready: true }]; __game.startParty(); beginRun(); startCampaignFloor(0, 0); G.heroes.forEach(h => { h.inv = 1e9; h.maxHp = h.hp = 1e6; });
      const m = G.map, r = m.rooms.findIndex(q => q.kind === 'L' && !q.side && !q.arena), rr = m.rooms[r], h = G.heroes[0]; h.x = (rr.x + rr.w / 2) * T; h.y = (rr.y + rr.h / 2) * T;
      const set = roomTileSet(r), outT = [...Array(m.t.length).keys()].find(i => m.t[i] === TL.FLOOR && !set.has(i) && m.roomOf[i] !== r && !collide((i % m.w + 0.5) * T, (((i / m.w) | 0) + 0.5) * T, 16));
      const stray = mkFoe('shambler', (outT % m.w + 0.5) * T, (((outT / m.w) | 0) + 0.5) * T); stray.room = r; stray.awake = false; stray.spd = 0;
      wakeRoom(r, 'test'); run(0.2); const B = G.battle; const counted = B ? battleFoes(B).includes(stray) : null; let k = 0;
      while (G.battle && k++ < 400) { for (const f of battleFoes(G.battle)) killFoe(f, h, {}); for (const s of battleSpawners(G.battle)) hitSpawner(s, 999, h, { spawnerHits: 9999 }); run(0.25); }
      const log = (G.battleLog || []).filter(e => e.r === r); out.battle = { locked: !!B, strayCounted: counted, strayAlive: ALIVE(stray), opened: !G.battle, why: (log[log.length - 1] || {}).why };
    }
    return out;
  });
  console.log(JSON.stringify(R));
  chk('all three campaign arena floors found (Charnel Court, Gnawing Pit, Crucible)', R.floors.map(f => f.name), ['Charnel Court', 'The Gnawing Pit', 'The Crucible']);
  for (const f of R.floors) {
    chk(`${f.name}: foes and spawners are left alive outside the arena`, [f.before, f.after], g => g[0].foes > 0 && g[1].foes > 0 && g[1].spawners >= 0);
    chk(`${f.name}: gates seal on entry`, f.sealed, true);
    chk(`${f.name}: all 3 waves complete with outsiders alive; exit opens, gates open, no guard needed`, f, g => g.state === 'done' && g.exitOpen && g.gatesOpen && g.waves.includes(3) && g.guard === 0);
  }
  chk('Daily Arena: first wave clears', R.daily, g => g.wave >= 2);
  chk('guard: a stranded wave foe is pulled into the arena after 15s (not before)', R.guard, g => g.outsideNow && g.stillOutAt10s && g.pulledBy18s);
  chk('guard: a stalled wave crumbles after 45s and the arena moves on', R.guard, g => g.crumbled && g.progressed && g.log.includes('pull') && g.log.includes('clear'));
  chk('battle room: a room foe outside the room when it locks is not counted; room still clears', R.battle, g => g.locked && g.strayCounted === false && g.strayAlive && g.opened && g.why === 'clear');
  chk('no page errors', logs, []);
  console.log(`\narenatest: ${pass} passed, ${fail} failed`); await b.close(); process.exit(fail ? 1 : 0);
})();
