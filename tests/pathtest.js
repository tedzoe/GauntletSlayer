// Enemy pathing (David, Oct 2026: "a lot of NPCs just stay in one spot, stuck, they don't know how to move around blocks").
// On every campaign floor (rooms, corridors, the maze), three Endless depths and a built test room with pillars, a cover-block
// cluster, a pit field and a shut gate: chasers placed behind an obstacle (no straight line to the hero, 5-18 tiles of walking) must
// reach a standing hero within (path length / speed) x 1.6 + 3 s, and none may stand stuck (wanting to walk, under 10 px moved in
// a second) for longer than 2 s. Small and big bodies (Gloomtusk, r 19) both; big ones only where their body fits.
// Also: a sleeping room's foes stay put until a hero enters or is seen, a shut gate is walked around and a newly opened one is used,
// and 80 chasers pathing at once keep the simulation cheap.
const ENV = require('./env');
const puppeteer = require('puppeteer-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await ENV.ready;
  const b = await puppeteer.launch({ executablePath: ENV.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage(); await p.setViewport({ width: 1152, height: 648 });
  const logs = []; p.on('pageerror', e => logs.push('pageerror: ' + e.message));
  await p.goto(ENV.BASE + 'index.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await sleep(800);
  let pass = 0, fail = 0; const chk = (name, got, want) => { const okk = typeof want === 'function' ? want(got) : JSON.stringify(got) === JSON.stringify(want); okk ? pass++ : fail++; console.log((okk ? 'PASS ' : 'FAIL ') + name + '  ' + JSON.stringify(got).slice(0, 900)); };
  await p.evaluate(() => {
    const S = __game.SEL; S.slots = [{ dev: 'kb1', idx: 0, ready: true }]; __game.startParty(); beginRun();
    const saved = Input.read; Input.read = dev => { const r = saved.call(Input, dev); if (dev === 'kb1') { r.mx = 0; r.my = 0; r.down = {}; r.pressed = {}; r.aim = false; } return r; };
    window.PT = {
      calm() { const m = G.map; G.foes = []; G.spawners = []; G.hazards = []; G.shots = []; G.allies = []; G.gimmick = null; G.arena = null; G.battle = null; m.noLock = true; if (m.awake) m.awake.fill(1); const h = G.heroes[0]; h.inv = 1e9; h.hp = h.maxHp = 1e7; },
      tick() { menuGuard = 0; G.pendingComplete = 0; G.heroes[0].hp = G.heroes[0].maxHp; __game.tick(); if (__game.scene !== 'game') __game.scene = 'game'; },
      // chase one foe from (fx, fy) to the standing hero; returns reach time (-1 never) and the longest stuck stretch
      chase(type, hx, hy, fx, fy, limit) {
        const h = G.heroes[0]; G.foes = []; G.shots = []; G.hazards = []; G.allies = []; h.x = hx; h.y = hy; h.dead = false; h.kx = h.ky = 0; updateCamera(true); computeFlow(); flowT = 0.2;
        const f = mkFoe(type, fx, fy, { awake: true }); f.atkT = 1e9; f.hp = f.maxhp = 1e9; if (collide(f.x, f.y, f.r, false)) return null;
        if (typeof navNode === 'function' && !navNode(f) && !sweepClear(f.x, f.y, hx, hy, f.r, f.fly)) return null;   // its body can't get there at all (too big for every gap)
        let t = 0, reached = -1, stuck = 0, maxStuck = 0; const hist = [];
        for (; t < limit + 1; t += 1 / 60) { PT.tick(); if (!G.foes.includes(f)) G.foes.push(f);
          if (hyp(f.x - h.x, f.y - h.y) < f.r + h.r + (f.d.reach || 20) + 12) { reached = t; break; }
          hist.push([f.x, f.y]); if (hist.length > 60) hist.shift(); const moved = hist.length >= 60 ? hyp(f.x - hist[0][0], f.y - hist[0][1]) : 99;
          if (moved < 10 && f.state === 'move' && !(f.stag > 0)) { stuck += 1 / 60; maxStuck = Math.max(maxStuck, stuck + 1); } else stuck = 0; }
        return { reached: +reached.toFixed(2), maxStuck: +maxStuck.toFixed(2), end: [Math.round(f.x / T), Math.round(f.y / T)] };
      },
      // obstacle pairs on the current map: hero tile and a foe tile behind something (no LOS), 5-18 tiles of walking apart
      pairs(n, seed) {
        const m = G.map, N = m.w * m.h, wk = (x, y) => !blocksWalk(tileAt(x, y), false);
        const bfs = s => { const d = new Int16Array(N).fill(-1), q = [s]; d[s] = 0; for (let k = 0; k < q.length; k++) { const i = q[k], x = i % m.w, y = (i / m.w) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const j = (y + dy) * m.w + x + dx; if (wk(x + dx, y + dy) && d[j] < 0) { d[j] = d[i] + 1; q.push(j); } } } return d; };
        const tiles = []; for (let y = 1; y < m.h - 1; y++) for (let x = 1; x < m.w - 1; x++) if (wk(x, y) && tileAt(x, y) !== TL.SPIKE) tiles.push(y * m.w + x);
        const rnd = seeded(seed), out = [], c = i => [(i % m.w + 0.5) * T, (((i / m.w) | 0) + 0.5) * T];
        for (let tries = 0; tries < 600 && out.length < n; tries++) { const hi = tiles[Math.floor(rnd() * tiles.length)], d = bfs(hi), [hx, hy] = c(hi);
          const cand = tiles.filter(i => { if (d[i] < 5 || d[i] > 18) return false; const [x, y] = c(i); return hyp(x - hx, y - hy) < 11 * T && !los(hx, hy, x, y); });
          if (!cand.length) continue; const fi = cand[Math.floor(rnd() * cand.length)]; out.push({ hi, fi, path: d[fi], h: c(hi), f: c(fi), where: roomAt(hx, hy) >= 0 ? 'room' : 'corridor' }); }
        return out;
      },
    };
  });
  // ---- every floor
  const floors = await p.evaluate(() => { const L = []; WORLDS.forEach((w, wi) => w.floors.forEach((f, fi) => L.push({ wi, fi, name: w.id + ' ' + f.name }))); for (const n of [1, 4, 9]) L.push({ endless: n, name: 'Endless ' + n }); return L; });
  const all = [], per = [];
  for (const FL of floors) {
    const R = await p.evaluate(FL => {
      if (FL.endless) startEndlessFloor(FL.endless); else startCampaignFloor(FL.wi, FL.fi); PT.calm();
      const out = [], spd = type => Math.min(FOES[type].spd, GROUND_CAP());
      for (const P of PT.pairs(14, 99 + (FL.wi || 0) * 31 + (FL.fi || 0) * 7 + (FL.endless || 0)))
        for (const type of ['bonesoldier', 'goblin', 'hulk']) { const lim = P.path * T / spd(type) * 1.6 + 3, r = PT.chase(type, P.h[0], P.h[1], P.f[0], P.f[1], lim); if (r) out.push(Object.assign({ type, path: P.path, where: P.where, limit: +lim.toFixed(1) }, r)); }
      return out;
    }, FL);
    const bad = R.filter(r => r.reached < 0 || r.reached > r.limit || r.maxStuck > 2);
    per.push(`${FL.name}: ${R.length} chases (${R.filter(r => r.where === 'room').length} room, ${R.filter(r => r.where === 'corridor').length} corridor), worst stuck ${Math.max(0, ...R.map(r => r.maxStuck)).toFixed(1)}s, ${bad.length} late or stuck`);
    for (const x of bad) all.push(Object.assign({ floor: FL.name }, x));
  }
  console.log(per.join('\n')); console.log(`${all.length} of ${per.reduce((a, l) => a + +l.split(': ')[1].split(' ')[0], 0)} chases late or stuck`);
  chk('every chaser behind an obstacle on every floor reaches the hero in time and is never stuck for more than 2 s', all, []);
  // ---- built room: pillars, a block cluster, a pit field, a shut gate with a way around
  const T2 = await p.evaluate(() => {
    const rows = [
      '########################################',
      '#......................................#',
      '#...##.......PPPPPP..........##........#',
      '#...##.......PPPPPP..........##........#',
      '#............PPPPPP....................#',
      '#..........................###.........#',
      '#.......###................###.........#',
      '#.......###.......#####................#',
      '#.......###.......#####................#',
      '#.................#####......PPPP......#',
      '#............................PPPP......#',
      '############GG#########################',
      '#......................................#',
      '#......................................#',
      '#...........................#####......#',
      '#..........###..............#####......#',
      '#..........###.........................#',
      '#......................................#',
      '########################################'];
    const fix = rows.map(r => r.replace(/[PG]/g, '.')); resetLists(); G.mode = 'campaign'; G.scale = { hp: 1, dmg: 1, spd: 1, spawn: 1 }; G.mods = {}; G.worldTier = 0;
    G.map = parseMap(fix, WORLDS[0].theme); const m = G.map;
    for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y].length; x++) { if (rows[y][x] === 'P') m.t[y * m.w + x] = TL.PIT; if (rows[y][x] === 'G') m.t[y * m.w + x] = TL.GATE; }
    G.map.arenaSet = new Set(); G.stats = newStats(); renderMapCanvas(); PT.calm();
    const c = (x, y) => [(x + 0.5) * T, (y + 0.5) * T], out = {};
    const run = (name, type, h, f, lim) => { out[name] = PT.chase(type, ...c(...h), ...c(...f), lim); };
    run('around the pillar block', 'bonesoldier', [4, 7], [12, 7], 9); run('around the pillar block (big)', 'hulk', [4, 7], [13, 7], 11);
    run('around the cover blocks', 'bonesoldier', [16, 8], [26, 8], 9); run('around the cover blocks (big)', 'hulk', [15, 8], [26, 8], 11);
    run('around the pit field', 'bonesoldier', [10, 3], [21, 3], 10); run('around the pit field (big)', 'hulk', [10, 3], [21, 3], 12);
    run('around the second pit', 'goblin', [28, 10], [35, 9], 9);
    // the shut gate: the only way from the bottom hall to the top is the gate, so the foe waits at the gate (it can't arrive)...
    G.foes = []; const h = G.heroes[0]; h.x = c(12, 6)[0]; h.y = c(12, 6)[1];
    const f = mkFoe('bonesoldier', ...c(13, 15), { awake: true }); f.atkT = 1e9; f.hp = 1e9; computeFlow(); for (let i = 0; i < 240; i++) PT.tick();
    out.gateShutReached = hyp(f.x - h.x, f.y - h.y) < 40; out.gateShutAtGate = hyp(f.x - c(12.5, 12)[0], f.y - c(12.5, 12)[1]) < 3 * T;
    // ...and goes through as soon as it opens
    openGate(12, 11, h); let t = 0; for (; t < 6 && hyp(f.x - h.x, f.y - h.y) > 44; t += 1 / 60) PT.tick(); out.gateOpenT = +t.toFixed(2);
    return out;
  });
  for (const k of ['around the pillar block', 'around the pillar block (big)', 'around the cover blocks', 'around the cover blocks (big)', 'around the pit field', 'around the pit field (big)', 'around the second pit']) chk(`test room: ${k}`, T2[k], r => r && r.reached >= 0 && r.maxStuck <= 2);
  chk('test room: a foe never walks through a shut gate (waits at it)', [T2.gateShutReached, T2.gateShutAtGate], [false, true]);
  chk('test room: once the gate opens it comes through', T2.gateOpenT, t => t < 6);
  // ---- dormant rooms still sleep: foes in a room the hero is outside of (no line of sight) don't move
  const D = await p.evaluate(() => {
    startCampaignFloor(0, 0); const m = G.map; G.foes = []; G.spawners = []; G.gimmick = null; const h = G.heroes[0]; h.inv = 1e9;
    let r = -1, fx = 0, fy = 0; for (let k = 0; k < m.rooms.length && r < 0; k++) { const rr = m.rooms[k]; if (roomAt(h.x, h.y) === k) continue; const x = (rr.x + rr.w / 2) * T, y = (rr.y + rr.h / 2) * T; if (!los(x, y, h.x, h.y) && hyp(x - h.x, y - h.y) > 500 && !collide(x, y, 12)) { r = k; fx = x; fy = y; } }
    if (r < 0) return { skipped: true };
    m.awake[r] = 0; const f = mkFoe('bonesoldier', fx, fy); f.room = r; for (let i = 0; i < 180; i++) PT.tick();
    return { room: r, moved: Math.round(hyp(f.x - fx, f.y - fy)), asleep: roomAsleep(r) };
  });
  chk('a sleeping room\'s foe stays put while no hero is in it or in sight', D, d => d.skipped || (d.moved < 2 && d.asleep));
  // ---- 80 chasers pathing at once
  const PF = await p.evaluate(() => {
    startCampaignFloor(0, 0); PT.calm(); const m = G.map, h = G.heroes[0]; const tiles = [];
    for (let y = 1; y < m.h - 1; y++) for (let x = 1; x < m.w - 1; x++) { const px = (x + 0.5) * T, py = (y + 0.5) * T, d = hyp(px - h.x, py - h.y); if (!blocksWalk(m.t[y * m.w + x], false) && d > 200 && d < 1200 && !collide(px, py, 12)) tiles.push([px, py]); }
    const rnd = seeded(7); for (let k = 0; k < 80; k++) { const [x, y] = tiles[Math.floor(rnd() * tiles.length)]; const f = mkFoe(k % 5 ? 'bonesoldier' : 'hulk', x, y, { awake: true, spawned: true }); f.atkT = 1e9; f.hp = 1e9; }
    for (let i = 0; i < 30; i++) PT.tick();
    const t0 = performance.now(); for (let i = 0; i < 300; i++) PT.tick(); const ms = (performance.now() - t0) / 300;
    const t1 = performance.now(); for (let i = 0; i < 50; i++) computeFlow(); const flowMs = (performance.now() - t1) / 50;
    return { foes: G.foes.length, msPerTick: +ms.toFixed(2), flowMs: +flowMs.toFixed(2), map: m.w + 'x' + m.h };
  });
  chk('80 chasers pathing at once: a game tick stays cheap (< 6 ms here, flow fields < 1.5 ms)', PF, x => x.foes >= 80 && x.msPerTick < 6 && x.flowMs < 1.5);
  chk('no page errors', logs, []);
  console.log(`\npathtest: ${pass} passed, ${fail} failed`); await b.close(); process.exit(fail ? 1 : 0);
})();
