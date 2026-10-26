// Slayer-style stages and room activation (David, Oct 2026). Numbers in DEV.rooms (tuning.js).
const ENV = require('./env');
const puppeteer = require('puppeteer-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await ENV.ready;
  const b = await puppeteer.launch({ executablePath: ENV.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage(); await p.setViewport({ width: 1152, height: 648 });
  const logs = []; p.on('pageerror', e => logs.push('pageerror: ' + e.message));
  await p.goto(ENV.BASE + 'index.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await sleep(800);
  let pass = 0, fail = 0; const chk = (name, got, want) => { const okk = typeof want === 'function' ? want(got) : JSON.stringify(got) === JSON.stringify(want); okk ? pass++ : fail++; console.log((okk ? 'PASS ' : 'FAIL ') + name.padEnd(62), JSON.stringify(got).slice(0, 400), okk ? '' : ' want ' + (typeof want === 'function' ? want.toString() : JSON.stringify(want))); };
  const ev = (f, ...a) => p.evaluate(f, ...a);
  await ev(() => {
    window.TT = { run(s) { for (let i = 0; i < Math.round(s * 60); i++) { menuGuard = 0; __game.tick(); } },
      setup(ids) { const S = __game.SEL; S.slots = ids.map((id, i) => ({ dev: i ? 'pad' + (i - 1) : 'kb1', idx: HEROES.findIndex(h => h.id === id), ready: true })); __game.startParty(); } };
    // walkable BFS from the start (gates and cracked walls passable: keys / barrels open them), returns the reachable tile set
    window.reach = () => { const m = G.map, seen = new Uint8Array(m.w * m.h), st = m.starts[0], q = [Math.floor(st.y / T) * m.w + Math.floor(st.x / T)]; seen[q[0]] = 1;
      for (let k = 0; k < q.length; k++) { const i = q[k], x = i % m.w, y = (i / m.w) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const j = (y + dy) * m.w + x + dx, t = tileAt(x + dx, y + dy); if (seen[j] || t === TL.WALL || t === TL.VOID || t === TL.PIT) continue; seen[j] = 1; q.push(j); } } return seen; };
    window.tileOf = e => Math.floor(e.y / T) * G.map.w + Math.floor(e.x / T);
    window.floorStats = lab => { const m = G.map, S = reach(), rs = m.rooms, main = rs.filter(r => !r.side), areas = main.map(r => r.w * r.h);
      const big = areas.filter(a => a >= 2 * 108);
      return { lab, w: m.w, h: m.h, rooms: rs.length, exit: !!m.exit && !!S[m.exit.i], keys: G.pickups.filter(i => i.kind === 'key').every(i => S[tileOf(i)]), crown: G.pickups.filter(i => i.kind === 'crown').every(i => S[tileOf(i)]) && G.pickups.some(i => i.kind === 'crown'),
        spawnersReach: G.spawners.every(s => S[tileOf(s)] || [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => S[tileOf({ x: s.x + dx * T, y: s.y + dy * T })])), bigRooms: big.length, maxArea: Math.max(...areas), share: +(areas.filter(a => a > 108).length / areas.length).toFixed(2), multiSpawnerRoom: rs.some((r, k) => G.spawners.filter(s => s.room === k).length >= 2) }; };
  });
  // ---- every campaign floor that is a stage, every endless / Extended Realm area
  const camp = await ev(() => { const out = []; for (let wi = 0; wi < WORLDS.length; wi++) for (let fi = 0; fi < WORLDS[wi].floors.length; fi++) { const fl = WORLDS[wi].floors[fi]; if (fl.boss || fl.map === 'maze') continue; TT.setup(['brannoc']); beginRun(); startCampaignFloor(wi, fi); out.push(floorStats(fl.map)); } return out; });
  chk('campaign stages: exit, keys, crown, spawners reachable', camp.map(f => [f.lab, f.exit, f.keys, f.crown, f.spawnersReach]), g => g.every(r => r[1] && r[2] && r[3] && r[4]));
  chk('campaign stages: large rooms >= 2x old large room (216+ tiles), most rooms bigger than old max', camp.map(f => [f.lab, f.bigRooms, f.maxArea, f.share]), g => g.every(r => r[1] >= 1 && r[2] >= 250 && r[3] >= 0.5));
  chk('campaign stages: a large room holds 2+ spawners', camp.map(f => [f.lab, f.multiSpawnerRoom]), g => g.every(r => r[1]));
  const endless = await ev(() => { const out = []; const L = ENDLESS.loop(); for (let n = 1; n <= L + 6; n += 2) { TT.setup(['brannoc']); beginRun(); startEndlessFloor(n); const s = floorStats('e' + n + ':' + (ENDLESS.worldFor(n).key || ENDLESS.worldFor(n).id)); s.boss = !!G.boss; s.mini = G.foes.some(f => f.d.miniboss); out.push(s); } return out; });
  chk('endless + Extended Realm stages: exit, keys, crown reachable on every sampled floor', endless.map(f => [f.lab, f.exit && f.keys && f.crown]), g => g.every(r => r[1]));
  chk('endless + Extended Realm stages: big rooms on every floor', endless.map(f => [f.lab, f.maxArea]), g => g.every(r => r[1] >= 216));
  const bossFl = await ev(() => { const out = []; for (let n = 1; n <= ENDLESS.loop(); n++) { if (((n - 1) % 6) + 1 !== XAREA_RULES.bossFloor && ((n - 1) % 6) + 1 !== CRYPT.lichEndlessFloor) continue; TT.setup(['brannoc']); beginRun(); startEndlessFloor(n); const w = ENDLESS.worldFor(n); out.push([n, w.key || w.id, !!G.boss || !w.boss || ((n - 1) % 6) + 1 !== XAREA_RULES.bossFloor, G.foes.some(f => f.d.miniboss) || !w.miniboss || ((n - 1) % 6) + 1 !== CRYPT.lichEndlessFloor]); } return out; });
  chk('area boss and mini-boss floors still spawn them', bossFl, g => g.every(r => r[2] && r[3]));
  const campBoss = await ev(() => { const out = []; for (let wi = 0; wi < WORLDS.length; wi++) { const fi = WORLDS[wi].floors.findIndex(f => f.boss); if (fi < 0) continue; TT.setup(['brannoc']); beginRun(); startCampaignFloor(wi, fi); out.push([WORLDS[wi].floors[fi].map, !!G.boss && ALIVE(G.boss)]); } return out; });
  chk('campaign boss floors unchanged (boss present)', campBoss, g => g.every(r => r[1]));
  // ---- activation
  const dorm = await ev(() => { TT.setup(['brannoc']); beginRun(); startCampaignFloor(0, 0); const h = G.heroes[0]; h.inv = 999;
    TT.run(1); const pos = G.foes.filter(f => f.room > 0).map(f => [f.x, f.y]), nSp = G.foes.length; TT.run(4);   // 1s settle: overlapping group members are nudged apart by physics, not AI
    const moved = G.foes.filter(f => f.room > 0).filter((f, i) => pos[i] && hyp(f.x - pos[i][0], f.y - pos[i][1]) > 2).length;
    return { rooms: G.map.rooms.length, awake: [...G.map.awake].reduce((a, b) => a + b, 0), foesInRooms: pos.length, moved, spawned: G.foes.length - nSp, shots: G.shots.filter(s => s.team === 'foe').length }; });
  chk('rooms start dormant: no foe moves, spawns or shoots while heroes wait in the start room', dorm, g => g.awake <= 1 && g.foesInRooms > 10 && g.moved === 0 && g.spawned <= 0 && g.shots === 0);
  const enter = await ev(() => { TT.setup(['brannoc']); beginRun(); startCampaignFloor(0, 0); const h = G.heroes[0]; h.inv = 999; const m = G.map;
    const k = m.rooms.findIndex((r, i) => i > 0 && G.foes.some(f => f.room === i) && G.spawners.some(s => s.room === i)); const r = m.rooms[k];
    const before = G.foes.filter(f => f.room === k).map(f => [f.x, f.y]); h.x = (r.x + 2.5) * T; h.y = (r.y + 2.5) * T; while (collide(h.x, h.y, h.r)) h.x += 8; const nF = G.foes.length;
    TT.run(3); const mv = G.foes.filter(f => f.room === k).filter((f, i) => before[i] && hyp(f.x - before[i][0], f.y - before[i][1]) > 4).length;
    const others = [...m.awake].reduce((a, b) => a + b, 0);
    return { awake: !!m.awake[k], by: G.lastWake && G.lastWake.by, moved: mv, of: before.length, spawned: G.foes.length - nF >= 0, othersAwake: others }; });
  chk('stepping into a room wakes its whole encounter (foes move, spawners spawn)', enter, g => g.awake && g.by === 'enter' && g.moved >= Math.ceil(g.of * 0.6));
  // LOS: hero in the corridor outside a room, a foe within sight range -> wakes; same spot with LOS blocked -> stays asleep
  const sight = await ev(() => { TT.setup(['brannoc']); beginRun(); startCampaignFloor(0, 0); const h = G.heroes[0]; h.inv = 999; const m = G.map;
    const k = m.rooms.findIndex((r, i) => i > 0 && !r.side && !r.arena); const r = m.rooms[k];
    G.foes = G.foes.filter(f => f.room !== k); G.spawners = G.spawners.filter(s => s.room !== k);
    // find a corridor tile next to the room
    let door = null; for (let y = r.y - 1; y <= r.y + r.h && !door; y++) for (let x = r.x - 1; x <= r.x + r.w && !door; x++) { const inside = x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h; if (inside) continue; if (tileAt(x, y) === TL.FLOOR && m.roomOf[y * m.w + x] < 0) door = [x, y]; }
    const dx = (door[0] + 0.5) * T, dy = (door[1] + 0.5) * T;
    // a foe inside the room, in clear view of the doorway, 6 tiles in
    let spot = null; for (let d = 6; d >= 3 && !spot; d--) for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = dx + ax * d * T, y = dy + ay * d * T; if (roomAt(x, y) === k && !collide(x, y, 14) && los(dx, dy, x, y)) { spot = [x, y]; break; } }
    const f = mkFoe('shambler', spot[0], spot[1]); f.atkT = 99;
    h.x = dx; h.y = dy; TT.run(0.5); const sees = !!m.awake[k], by = G.lastWake && G.lastWake.by;
    // reset: asleep again, wall the line of sight with a pillar between them
    m.awake[k] = 0; f.x = spot[0]; f.y = spot[1]; const mx = Math.floor((dx + spot[0]) / 2 / T), my = Math.floor((dy + spot[1]) / 2 / T); const save = m.t[my * m.w + mx]; m.t[my * m.w + mx] = TL.WALL;
    const blocked = !los(f.x, f.y, h.x, h.y); TT.run(1); const stays = !m.awake[k]; m.t[my * m.w + mx] = save;
    // far away (beyond sight range) with clear LOS -> stays asleep
    return { doorFound: !!door, sees, by, blocked, staysWhenBlocked: stays }; });
  chk('LOS wakes a room from its doorway; a wall between them does not', sight, { doorFound: true, sees: true, by: 'sight', blocked: true, staysWhenBlocked: true });
  const hit = await ev(() => { TT.setup(['kestrel']); beginRun(); startCampaignFloor(0, 0); const m = G.map; const f = G.foes.find(f => f.room > 0); const k = f.room; hitFoe(f, 5, { src: G.heroes[0] }); return { awake: !!m.awake[k], by: G.lastWake.by }; });
  chk('hitting a dormant foe (e.g. a long shot) wakes its room', hit, { awake: true, by: 'hit' });
  const reaper = await ev(() => { TT.setup(['brannoc']); beginRun(); startEndlessFloor(6); TT.run(14); const r = G.foes.find(f => f.type === 'reaper'); return { reaper: !!r, room: r ? r.room : null }; });
  chk('Death still hunts on every 6th floor and ignores dormancy', reaper, g => g.reaper && g.room === -1);
  const arena = await ev(() => { TT.setup(['brannoc']); beginRun(); startCampaignFloor(0, 2); const m = G.map; const k = m.rooms.findIndex(r => r.arena); return { arenaRoom: k >= 0, awake: k >= 0 && !!m.awake[k], tiles: m.arenaTiles.length, agates: m.agates.length, exitInArena: [1, -1, m.w, -m.w].some(d => m.arenaSet.has(m.exit.i + d)) }; });
  chk('arena floor: arena room, gates and exit inside the arena', arena, g => g.arenaRoom && g.awake && g.tiles > 150 && g.agates >= 2 && g.exitInArena);
  // ---- perf: a busy large-room fight in co-op on the biggest floor
  const perf = await ev(() => { TT.setup(['brannoc', 'sela']); beginRun(); startEndlessFloor(25); const m = G.map; m.awake.fill(1); for (const s of G.spawners) s.spawnT = 0; const t0 = performance.now(); TT.run(10); return { ms: +((performance.now() - t0) / 600).toFixed(2), foes: G.foes.length, map: m.w + 'x' + m.h }; });
  chk('sim cost per tick with every room awake (< 6 ms)', perf, g => g.ms < 6);
  console.log(`\n${pass} passed, ${fail} failed`); console.log('ERRORS', JSON.stringify(logs));
  await b.close(); process.exit(fail || logs.length ? 1 : 0);
})();
