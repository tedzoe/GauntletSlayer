// Anti-stuck sweep (David, Oct 2026): every gate/door and narrow spot on every floor, gate closes, dashes, blinks and knockback into walls.
const ENV = require('./env');
const puppeteer = require('puppeteer-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const REPORT = process.argv.includes('--report');
(async () => {
  await ENV.ready;
  const b = await puppeteer.launch({ executablePath: ENV.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage(); await p.setViewport({ width: 1152, height: 648 });
  const logs = []; p.on('pageerror', e => logs.push('pageerror: ' + e.message));
  await p.goto(ENV.BASE + 'index.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await sleep(800);
  let pass = 0, fail = 0; const chk = (name, got, want) => { const okk = typeof want === 'function' ? want(got) : JSON.stringify(got) === JSON.stringify(want); okk ? pass++ : fail++; console.log((okk ? 'PASS ' : 'FAIL ') + name + ' -> ' + JSON.stringify(got).slice(0, 900)); };
  await p.evaluate(() => {
    const oRead = Input.read; window.HOLD = { mx: 0, my: 0, keys: new Set() }; let prev = new Set();
    Input.read = (dev, s) => { if (dev !== 'kb1') return oRead(dev, s); const st = { mx: HOLD.mx, my: HOLD.my, ax: 0, ay: 0, aim: false, aimFire: false, dev, down: {}, pressed: {}, released: {} }; for (const k of HOLD.keys) { st.down[k] = true; if (!prev.has(k)) st.pressed[k] = true; } return st; };
    const oCommit = Input.commit; Input.commit = d => { prev = new Set(HOLD.keys); oCommit(d); };
    window.ST = {
      setup(id) { const S = __game.SEL; S.slots = [{ dev: 'kb1', idx: HEROES.findIndex(h => h.id === id), ready: true }]; __game.startParty(); },
      clear() { G.foes = []; G.spawners = []; G.shots = []; G.hazards = []; G.gimmick = null; if (G.arena) G.arena.state = 'done'; },
      run(n) { for (let i = 0; i < n; i++) { menuGuard = 0; G.pendingComplete = 0; if (__game.scene !== 'game') __game.scene = 'game'; __game.tick(); } },   // the sweep may roll onto the exit: keep playing the floor
      inside(h) { return !!collide(h.x, h.y, h.r, false); },
      // can the hero move at all? try 4 directions; returns max displacement
      canMove(h) { let best = 0; for (const [mx, my] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x0 = h.x, y0 = h.y; HOLD.mx = mx; HOLD.my = my; ST.run(12); best = Math.max(best, Math.hypot(h.x - x0, h.y - y0)); h.x = x0; h.y = y0; } HOLD.mx = HOLD.my = 0; return best; },
      spots() { // walkable tiles next to gates/doors/arena gates/cracked walls, plus narrow spots
        const m = G.map, out = [], seen = new Set(), wk = (x, y) => !blocksWalk(tileAt(x, y), false);
        const doorish = i => m.t[i] === TL.GATE || m.t[i] === TL.AGATE || m.t[i] === TL.CRACK || (m.agates || []).includes(i) || (m.gateTiles && m.gateTiles.has(i));
        for (let y = 1; y < m.h - 1; y++) for (let x = 1; x < m.w - 1; x++) { const i = y * m.w + x; if (doorish(i)) for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) { const j = (y + dy) * m.w + x + dx; if (!seen.has(j) && wk(x + dx, y + dy)) { seen.add(j); out.push([x + dx, y + dy, 'door']); } } }
        const narrow = []; for (let y = 1; y < m.h - 1; y++) for (let x = 1; x < m.w - 1; x++) { if (!wk(x, y)) continue; const hw = wk(x - 1, y) + wk(x + 1, y), vw = wk(x, y - 1) + wk(x, y + 1); if ((hw === 0 && vw > 0) || (vw === 0 && hw > 0) || (!wk(x - 1, y - 1) + !wk(x + 1, y + 1) + !wk(x + 1, y - 1) + !wk(x - 1, y + 1) >= 3)) narrow.push([x, y, 'narrow']); }
        const step = Math.max(1, Math.floor(narrow.length / 30)); for (let k = 0; k < narrow.length; k += step) out.push(narrow[k]);
        return out;
      },
      sweep(lab, closeFn) {
        const bad = []; const h = G.heroes[0]; h.inv = 1e9; const sp = ST.spots();
        for (const [x, y, kind] of sp) {
          if (G.map.agates && G.map.agates.length) setArenaGates(false);
          h.x = (x + 0.5) * T; h.y = (y + 0.5) * T; h.kx = h.ky = 0; h.dash = null; updateCamera(true);
          if (ST.inside(h)) continue;   // big hero simply doesn't fit this spot from its centre: not a reachable position
          if (closeFn) closeFn();
          ST.run(2);
          const ins = ST.inside(h), mv = ST.canMove(h);
          if (ins || mv < 4) bad.push([lab, kind, x, y, ins ? 'inside' : 'frozen', Math.round(mv)]);
        }
        return { n: sp.length, bad };
      },
    };
  });
  const heroes = ['paladin', 'brannoc', 'kestrel'];   // biggest, polearm, smallest
  // ---- every map: camp, campaign floors, endless + Extended Realms, arena
  const res = await p.evaluate(heroes => {
    const out = [];
    for (const id of heroes) {
      ST.setup(id); beginRun();
      startHub(); ST.clear(); out.push(ST.sweep(id + ':hub'));
      for (let wi = 0; wi < WORLDS.length; wi++) for (let fi = 0; fi < WORLDS[wi].floors.length; fi++) { beginRun(); startCampaignFloor(wi, fi); ST.clear(); out.push(ST.sweep(id + ':' + WORLDS[wi].floors[fi].map, G.map.agates.length ? () => setArenaGates(true) : null)); }
      const L = Math.max(ENDLESS.loop(), 18); for (let n = 1; n <= L; n += (id === 'paladin' ? 1 : 3)) { beginRun(); startEndlessFloor(n); ST.clear(); out.push(ST.sweep(id + ':e' + n)); }
      beginRun(); startArena(); ST.clear(); out.push(ST.sweep(id + ':arena'));
    }
    return out;
  }, heroes);
  const bad = res.flatMap(r => r.bad), n = res.reduce((a, r) => a + r.n, 0);
  if (REPORT) console.log('STUCK SPOTS', JSON.stringify(bad));
  chk(`no hero stuck at ${n} gate/door/narrow spots across ${res.length} map sweeps`, bad, []);
  // ---- moves into walls, corners and pits: dash / blink / leap / roll / charge / knockback, every hero, 8 directions
  const mv = await p.evaluate(() => {
    const out = { tries: 0, bad: [] };
    const edgeSpots = (lim) => { const m = G.map, sp = []; for (let y = 1; y < m.h - 1; y++) for (let x = 1; x < m.w - 1; x++) { if (blocksWalk(m.t[y * m.w + x], false)) continue; let n = 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) if (blocksWalk(tileAt(x + dx, y + dy), false)) n++; if (n >= 2) sp.push([x, y]); } const st = Math.max(1, Math.floor(sp.length / lim)); return sp.filter((_, i) => i % st === 0); };
    const maps = [['hub', () => startHub(), 80], ['w1f1', () => startCampaignFloor(0, 0), 14], ['w2f2', () => startCampaignFloor(1, 1), 14], ['e20', () => startEndlessFloor(20), 10], ['e40', () => startEndlessFloor(40), 10]];
    for (const id of HEROES.map(d => d.id)) for (const [lab, start, lim] of maps) {
      ST.setup(id); beginRun(); start(); ST.clear(); const h = G.heroes[0]; h.inv = 1e9;
      for (const [x, y] of edgeSpots(lim)) for (let k = 0; k < 8; k++) for (const act of ['dash', 'secondary', 'defend', 'ability', 'knock']) {
        h.x = (x + 0.5) * T; h.y = (y + 0.5) * T; if (ST.inside(h)) continue; out.tries++;
        h.dead = false; h.hp = h.maxHp; h.cd = {}; h.spellCd = {}; h.dash = null; h.spin = 0; h.charging = null; h.thrust = null; h.z = 0; h.kx = h.ky = 0; h.atkT = 0; h.lock = 0; h.souls = 30;
        const a = k * Math.PI / 4; h.fa = a; updateCamera(true);
        HOLD.mx = Math.round(Math.cos(a)); HOLD.my = Math.round(Math.sin(a));
        if (act === 'knock') { h.kx = Math.cos(a) * 3000; h.ky = Math.sin(a) * 3000; ST.run(30); }
        else { HOLD.keys = new Set([act]); ST.run(6); HOLD.keys = new Set(); ST.run(50); }
        HOLD.mx = HOLD.my = 0; h.spin = 0; h.blocking = false; ST.run(8);
        const ins = ST.inside(h), m2 = ST.canMove(h);
        if (ins || m2 < 4) { out.bad.push([id, lab, x, y, k, act, ins ? 'inside' : 'frozen']); if (!out.diag) { const st = {}; for (const kk in h) { const v = h[kk]; if (typeof v === 'number' && v !== 0 && !['x','y','r','hp','maxHp','pi','baseSpeed','walk','fa','inv','deadAt','souls'].includes(kk)) st[kk] = +v.toFixed(2); else if (v === true) st[kk] = true; else if (v && typeof v === 'object' && ['channel','charging','thrust','dash','frozenBy'].includes(kk)) st[kk] = 'obj'; } out.diag = { st, scene: __game.scene, menu: !!MENU, allies: G.allies.map(q => [q.kind, Math.round(hyp(q.x - h.x, q.y - h.y))]), props: G.props.filter(q => q.hp > 0 && hyp(q.x - h.x, q.y - h.y) < 60).map(q => q.kind), hz: G.hazards.map(z => z.kind) }; } }
      }
    }
    return out;
  });
  if (REPORT && mv.diag) console.log('DIAG', JSON.stringify(mv.diag));
  chk(`dashes, blinks, leaps, rolls, charges and knockback into walls/corners/pits never leave a hero inside geometry (${mv.tries} tries)`, mv.bad, []);
  // ---- arena-floor gates slam: a hero standing in the gateway and a co-op partner left outside are pulled fully inside
  const ag = await p.evaluate(() => {
    const S = __game.SEL; S.slots = ['paladin', 'kestrel'].map((id, i) => ({ dev: i ? 'pad0' : 'kb1', idx: HEROES.findIndex(h => h.id === id), ready: true })); __game.startParty();
    beginRun(); startCampaignFloor(0, 2); ST.clear(); G.arena.state = 'idle';
    const m = G.map, [a, b] = G.heroes, gi = m.agates[0], inA = e => m.arenaSet.has(Math.floor(e.y / T) * m.w + Math.floor(e.x / T));
    const ai = [...m.arenaSet][Math.floor(m.arenaSet.size / 2)];
    b.x = (gi % m.w + 0.5) * T; b.y = (((gi / m.w) | 0) + 0.5) * T;   // partner standing in the gateway
    a.x = (ai % m.w + 0.5) * T; a.y = (((ai / m.w) | 0) + 0.5) * T; a.inv = b.inv = 1e9; updateCamera(true);
    for (let i = 0; i < 3; i++) { menuGuard = 0; __game.tick(); }
    const r1 = { closed: m.t[gi] === TL.AGATE, bInside: inA(b), bFree: !collide(b.x, b.y, b.r, false) };
    // second case: partner far outside the arena
    beginRun(); startCampaignFloor(0, 2); ST.clear(); G.arena.state = 'idle'; const [a2, b2] = G.heroes; const st = m.starts[0];
    b2.x = G.map.starts[0].x; b2.y = G.map.starts[0].y; a2.x = (ai % G.map.w + 0.5) * T; a2.y = (((ai / G.map.w) | 0) + 0.5) * T; a2.inv = b2.inv = 1e9;
    G.arena.state = 'idle'; for (let i = 0; i < 3; i++) { menuGuard = 0; __game.tick(); }
    const r2 = { bInside: inA(b2), bFree: !collide(b2.x, b2.y, b2.r, false), pulled: b2.pulledIn || 0 };
    const dbg = { dead: b2.dead, scene: __game.scene, arena: G.arena.state }; return { r1, r2, bMove: [[6, 0], [-6, 0], [0, 6], [0, -6]].some(([dx, dy]) => !collide(b2.x + dx, b2.y + dy, b2.r, false)), dbg };
  });
  chk('arena gates never close on a hero: the one in the gateway ends up inside, free', ag.r1, { closed: true, bInside: true, bFree: true });
  chk('a co-op partner left outside is pulled inside when the gates slam', [ag.r2, ag.bMove, ag.dbg], g => g[0].bInside && g[0].bFree && g[0].pulled >= 1 && g[1]);
  // ---- safety net: a hero forced into a wall is freed within 0.5s, and one frozen while steering is nudged
  const sn = await p.evaluate(() => { ST.setup('paladin'); beginRun(); startHub(); ST.clear(); const h = G.heroes[0];
    const m = G.map; let wi = -1; for (let i = 0; i < m.t.length; i++) if (m.t[i] === TL.PIT) { wi = i; break; }
    h.x = (wi % m.w + 0.5) * T; h.y = (((wi / m.w) | 0) + 0.5) * T; const u0 = G.unstuck || 0; ST.run(30);
    return { freed: !collide(h.x, h.y, h.r, false), nudges: (G.unstuck || 0) - u0, canMove: ST.canMove(h) > 4 }; });
  chk('safety net: a hero dropped inside a camp pit is moved out within 0.5s', sn, { freed: true, nudges: 1, canMove: true });
  chk('no page errors', logs, []);
  console.log(`\n${pass} passed, ${fail} failed`);
  if (REPORT) { console.log(`\n${pass} passed, ${fail} failed`); }
  await b.close(); process.exit(fail ? 1 : 0);
})();
