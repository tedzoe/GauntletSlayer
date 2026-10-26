// Shooting foes: slower than before (DEV.shooter.spdMul) and rooted from wind-up through release and recovery; Hollowfang hovers still
// for its volleys. Every enemy missile stays at or under 65% of the slowest hero.
const ENV = require('./env');
const puppeteer = require('puppeteer-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await ENV.ready;
  const b = await puppeteer.launch({ executablePath: ENV.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage(); await p.setViewport({ width: 1152, height: 648 });
  const logs = []; p.on('pageerror', e => logs.push('pageerror: ' + e.message));
  await p.goto(ENV.BASE + 'index.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await sleep(900);
  let pass = 0, fail = 0; const chk = (name, got, want) => { const okk = typeof want === 'function' ? want(got) : JSON.stringify(got) === JSON.stringify(want); okk ? pass++ : fail++; console.log((okk ? 'PASS ' : 'FAIL ') + name + '  ' + JSON.stringify(got).slice(0, 700)); };
  const R = await p.evaluate(() => {
    const S = __game.SEL; S.slots = [{ dev: 'kb1', idx: HEROES.findIndex(h => h.id === 'kestrel'), ready: true }]; __game.startParty(); beginRun(); startCampaignFloor(0, 0);
    const room = () => { const rows = []; for (let y = 0; y < 30; y++) rows.push(y === 0 || y === 29 ? '#'.repeat(60) : '#' + '.'.repeat(58) + '#');
      resetLists(); G.map = parseMap(rows, WORLDS[0].theme); G.map.arenaSet = new Set(); G.map.noLock = true; computeFlow(); renderMapCanvas(); };
    let log = []; const o0 = window.shoot; window.shoot = function (o) { const s = o0(o); if (s.team === 'foe') log.push({ t: G.time, v: s.lob ? hyp(s.tx - s.sx, s.ty - s.sy) / s.T : hyp(s.vx, s.vy) }); return s; };
    const out = { types: [], slowFail: [], moveFail: [], windFail: [], fastest: 0 };
    const list = [...Object.keys(FOES).filter(k => DEV.shooter.beh.includes(FOES[k].beh)).map(k => [k, false]), ...Object.keys(BOSSES).map(k => [k, true])];
    for (const [kind, boss] of list) {
      room(); const h = G.heroes[0]; h.x = 20 * T; h.y = 15 * T; G.time = 0;
      let f; if (boss) { f = spawnBoss(kind, h.x + 260, h.y); G.banner = null; } else f = mkFoe(kind, h.x + 260, h.y, { awake: true });
      if (!G.foes.includes(f)) G.foes.push(f); log = []; const tr = []; let sawWind = 0;
      for (let i = 0; i < (boss ? 30 : 16) * 60; i++) { h.inv = 1e9; h.maxHp = h.hp = 1e9; h.x = 20 * T; h.y = 15 * T; menuGuard = 0; const n0 = log.length, st0 = f.state, aim0 = !!f.aim; __game.tick(); if (!ALIVE(f)) break;
        tr.push([G.time, f.x, f.y, f.walk || 0]); if (log.length > n0 && !boss && f.d.beh !== 'lurker' && st0 === 'windup' && aim0) sawWind++; G.foes = G.foes.filter(o => o === f || o.boss); }
      const at = tt => tr.reduce((a, q) => Math.abs(q[0] - tt) < Math.abs(a[0] - tt) ? q : a, tr[0]);
      const shotT = [...new Set(log.map(s => +s.t.toFixed(2)))];
      // from the start of the wind-up (just before it) to the end of the recovery, the foe must not move
      const wu = boss ? DEV.shooter.bossWindup : DEV.shooter.windup, rc = boss ? DEV.shooter.bossRecover : DEV.shooter.recover;
      // walking is measured by the AI's own walk counter, so separation nudges (its totem spawning on top of it) don't count
      const drift = shotT.map(t0 => { const a = at(t0 - wu + 0.03), c = at(t0 + rc - 0.03); return c[3] - a[3]; }), push = shotT.map(t0 => { const a = at(t0 - wu + 0.03), c = at(t0 + rc - 0.03); return hyp(c[1] - a[1], c[2] - a[2]); });
      const maxDrift = drift.length ? Math.max(...drift) : 0, fast = log.length ? Math.max(...log.map(s => s.v)) : 0; out.fastest = Math.max(out.fastest, fast);
      out.types.push([kind, Math.round(f.spd || 0), log.length, +maxDrift.toFixed(2), +(push.length ? Math.max(...push) : 0).toFixed(1), Math.round(fast)]);
      if (!boss && !(FOES[kind].spd <= Math.round(FOES[kind].spd0 * 0.7) + 0.5)) out.slowFail.push(kind);
      const rooted = !boss || kind === 'sovereign' || kind === 'ossuary' || BOSSES[kind].ai === 'x';   // Rootmaw never walks; Forgemaster fires no missiles
      if (rooted && log.length && maxDrift > 0.001) out.moveFail.push([kind, +maxDrift.toFixed(1)]);
      if (!boss && f.d.beh !== 'lurker' && log.length && sawWind < shotT.length) out.windFail.push([kind, sawWind, shotT.length]); }
    window.shoot = o0; out.cap = PROJ_CAP(); return out; });
  console.log('kind, speed, shots, walk during wind-up..recovery, max displacement, fastest missile:', JSON.stringify(R.types));
  chk('every shooter is at most 70% of its old speed', R.slowFail, []);
  chk('shooters (and Hollowfang) do not move from wind-up through recovery', R.moveFail, []);
  chk('every shot comes out of a wind-up (telegraph)', R.windFail, []);
  chk('fastest enemy missile <= 65% of the slowest hero (86 px/s)', Math.round(R.fastest), g => g <= Math.round(R.cap) && g <= 93);
  chk('no page errors', logs, []);
  console.log(`\nshootertest: ${pass} passed, ${fail} failed`); await b.close(); process.exit(fail ? 1 : 0);
})();
