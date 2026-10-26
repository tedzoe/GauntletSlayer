// Slayer battle rooms: large rooms lock with iron gates when they wake, send waves, and open when cleared; no soft-locks.
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
    const setup = (ids, fl = 0) => { const S = __game.SEL; S.slots = ids.map((id, i) => ({ dev: i ? 'pad' + (i - 1) : 'kb1', idx: HEROES.findIndex(h => h.id === id), ready: true })); __game.startParty(); beginRun(); startCampaignFloor(0, fl); G.heroes.forEach(h => { h.inv = 1e9; h.maxHp = h.hp = 1e6; }); const m = G.map; const r = m.rooms.findIndex(q => q.kind === 'L' && !q.side && !q.arena); const rr = m.rooms[r]; return { m, r, rr, cx: (rr.x + rr.w / 2) * T, cy: (rr.y + rr.h / 2) * T }; };
    const tileOf = e => Math.floor(e.y / T) * G.map.w + Math.floor(e.x / T);
    const sealed = (m, set) => { const st = [...set][0], seen = new Set([st]), q = [st]; while (q.length) { const i = q.pop(), x = i % m.w, y = (i / m.w) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const j = (y + dy) * m.w + x + dx; if (seen.has(j) || blocksWalk(m.t[j], false)) continue; if (!set.has(j)) return false; seen.add(j); q.push(j); } } return true; };
    const clearRoom = (B, h) => { for (const f of battleFoes(B)) killFoe(f, h, {}); for (const s of battleSpawners(B)) hitSpawner(s, 999, h, { spawnerHits: 9999 }); };
    const out = {};
    // 1-3. lock, pull-in (partner standing in a doorway), sealed, waves, clear
    { const { m, r, cx, cy } = setup(['brannoc', 'kestrel']); const [a, c] = G.heroes; a.x = cx; a.y = cy; const doors = roomDoors(r); const d0 = doors[0]; c.x = (d0 % m.w + 0.5) * T; c.y = (((d0 / m.w) | 0) + 0.5) * T;
      wakeRoom(r, 'test'); run(0.2); const B = G.battle;
      out.lock = { locked: !!B && B.r === r, gates: B ? B.doors.every(i => m.t[i] === TL.AGATE) : false, nDoors: doors.length, sealed: B ? sealed(m, B.set) : false, partnerInside: !!B && B.set.has(tileOf(c)), partnerFree: !collide(c.x, c.y, c.r, false) };
      let waves = 0, spawned = 0, risen = 0, seen = new Set(), k = 0; while (G.battle && k++ < 400) { const Bb = G.battle; waves = Bb.wave; for (const f of battleFoes(Bb)) if (!seen.has(f)) { seen.add(f); if (f.spawned) spawned++; if (f.risen) risen++; } clearRoom(Bb, a); run(0.25); }
      const log = (G.battleLog || []).filter(e => e.r === r);
      out.waves = { waves, spawned, risen, opened: !G.battle, why: (log[log.length - 1] || {}).why, gatesOpen: doors.every(i => m.t[i] === TL.FLOOR), cleared: !!(m.cleared && m.cleared[r]) };
      a.x = G.map.starts[0].x; a.y = G.map.starts[0].y; c.x = a.x + 20; c.y = a.y; run(0.5); a.x = cx; a.y = cy; c.x = cx + 30; c.y = cy; run(0.5); out.waves.noRelock = !G.battle; }
    // 4. Death shows up -> gates give way, no re-lock this floor
    { const { m, r, cx, cy } = setup(['brannoc']); const h = G.heroes[0]; h.x = cx; h.y = cy; wakeRoom(r, 'test'); run(0.2); const was = !!G.battle; const d = mkFoe('reaper', cx + 300, cy); d.room = -1; run(0.2);
      out.death = { was, open: !G.battle, noLock: !!m.noLock, gatesOpen: roomDoors(r).every(i => m.t[i] !== TL.AGATE) }; d.hp = 0; d.dead = true; G.foes = G.foes.filter(f => f !== d); }
    // 5. every living hero outside (e.g. a revive at the start) -> gates open
    { const { m, r, cx, cy } = setup(['brannoc']); const h = G.heroes[0]; h.x = cx; h.y = cy; wakeRoom(r, 'test'); run(0.2); const was = !!G.battle; h.x = G.map.starts[0].x; h.y = G.map.starts[0].y; run(0.1);
      out.left = { was, open: !G.battle, why: (G.battleLog || []).slice(-1)[0].why }; }
    // 6. no progress for 25s -> gates open (safety valve)
    { const { m, r, cx, cy } = setup(['brannoc']); const h = G.heroes[0]; h.x = cx; h.y = cy; wakeRoom(r, 'test'); run(0.2); const B = G.battle; B.waves = 0; for (const f of G.foes) { f.aiFreeze = 1e9; f.atkT = 1e9; } for (const s of G.spawners) s.spawnT = 1e9; h.x = cx; h.y = cy; run(SPEC.battle.stall + 1);
      out.stall = { was: !!B, open: !G.battle, why: (G.battleLog || []).slice(-1)[0].why }; }
    // 7. obelisk cracks on each tier lost
    { setup(['brannoc']); const s = mkSpawner(G.heroes[0].x + 200, G.heroes[0].y, 3, ['shambler'], 'w1'); const hits = s.maxHp / 12; for (let i = 0; i < 7; i++) { G.time += 0.2; hitSpawner(s, 10, G.heroes[0], { spawnerHits: hits }); } out.crack = { cracks: s.cracks || 0, tier: s.tier }; }
    return out;
  });
  console.log(JSON.stringify(R));
  chk('lock: gates slam on every doorway, the room is sealed, a partner in the doorway ends up inside and free', R.lock, g => g.locked && g.gates && g.nDoors >= 1 && g.sealed && g.partnerInside && g.partnerFree);
  chk('waves: 2 waves come (some rise from the dirt), then the gates open as cleared and never re-lock', R.waves, g => g.waves === 2 && g.spawned >= 8 && g.risen >= 1 && g.opened && g.why === 'clear' && g.gatesOpen && g.cleared && g.noRelock);
  chk('Death opens the gates and stops locking for the floor', R.death, { was: true, open: true, noLock: true, gatesOpen: true });
  chk('every living hero outside -> gates open', R.left, { was: true, open: true, why: 'left' });
  chk('no progress for 25s -> gates open', R.stall, { was: true, open: true, why: 'stall' });
  chk('obelisks crack as they lose tiers', R.crack, g => g.cracks >= 1 && g.tier < 3);
  chk('no page errors', logs, []);
  console.log(`\nlocktest: ${pass} passed, ${fail} failed`); await b.close(); process.exit(fail ? 1 : 0);
})();
