// Slayer camera: zooms out to frame a big battle room plus every player, back to 1x elsewhere; mouse aim and co-op leash follow the zoom.
const ENV = require('./env');
const puppeteer = require('puppeteer-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await ENV.ready;
  const b = await puppeteer.launch({ executablePath: ENV.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage(); await p.setViewport({ width: 1152, height: 648 });
  const logs = []; p.on('pageerror', e => logs.push('pageerror: ' + e.message));
  await p.goto(ENV.BASE + 'index.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await sleep(800);
  let pass = 0, fail = 0; const chk = (name, got, want) => { const okk = typeof want === 'function' ? want(got) : JSON.stringify(got) === JSON.stringify(want); okk ? pass++ : fail++; console.log((okk ? 'PASS ' : 'FAIL ') + name + (okk ? '' : '  got ' + JSON.stringify(got).slice(0, 400))); };
  const R = await p.evaluate(() => {
    const run = s => { for (let i = 0; i < Math.round(s * 60); i++) { menuGuard = 0; __game.tick(); } };
    const setup = ids => { const S = __game.SEL; S.slots = ids.map((id, i) => ({ dev: i ? 'pad' + (i - 1) : 'kb1', idx: HEROES.findIndex(h => h.id === id), ready: true })); __game.startParty(); beginRun(); startCampaignFloor(0, 0); G.foes = []; G.spawners = []; G.heroes.forEach(h => { h.inv = 1e9; h.maxHp = h.hp = 1e6; }); };
    const fits = r => { const x0 = r.x * T, y0 = r.y * T, x1 = (r.x + r.w) * T, y1 = (r.y + r.h) * T, mw = G.map.w * T, mh = G.map.h * T, t = 4;
      return (G.cam.x <= Math.max(0, x0) + t || G.cam.x <= 0) && G.cam.x + viewW() >= Math.min(mw, x1) - t && G.cam.y <= y0 + t && G.cam.y + viewH() >= Math.min(mh, y1) - t; };
    const out = {};
    setup(['brannoc']); const rooms = G.map.rooms; const big = rooms.find(r => r.kind === 'L'), small = rooms.find(r => r.kind === 'S' || (r.w * r.h < 80 && !r.side));
    const h = G.heroes[0]; h.x = (big.x + big.w / 2) * T; h.y = (big.y + big.h / 2) * T; run(3);
    out.big = { kind: big.kind, area: big.w * big.h, z: +camZ().toFixed(2), fits: fits(big), room: G.cam.room };
    // mouse aim at a zoomed-out screen point maps to the right world point
    Input.mouse.x = 900; Input.mouse.y = 300; const wx = 900 / camZ() + G.cam.x, wy = 300 / camZ() + G.cam.y; const h0 = G.heroes[0]; const saved = Input.read;
    out.aimMath = { wx: Math.round(wx), wy: Math.round(wy), screen: toScreen(wx, wy) };
    if (small) { h.x = (small.x + small.w / 2) * T; h.y = (small.y + small.h / 2) * T; run(3); out.small = { z: +camZ().toFixed(2), room: G.cam.room }; }
    // co-op: two heroes far apart in a big room stay on screen and the room still fits
    setup(['brannoc', 'kestrel']); const b2 = G.map.rooms.find(r => r.kind === 'L'); const [a, c] = G.heroes;
    a.x = (b2.x + 2) * T; a.y = (b2.y + 2) * T; c.x = (b2.x + b2.w - 2) * T; c.y = (b2.y + b2.h - 2) * T; run(3);
    const on = e => e.x >= G.cam.x && e.x <= G.cam.x + viewW() && e.y >= G.cam.y && e.y <= G.cam.y + viewH();
    out.coop = { z: +camZ().toFixed(2), both: on(a) && on(c), fits: fits(b2) };
    out.min = SPEC.cam.min;
    return out;
  });
  console.log(JSON.stringify(R));
  chk('big battle room: camera zooms out (< 1x, >= min) and frames the whole room', R.big, g => g.z < 1 && g.z >= R.min && g.fits && g.room >= 0);
  chk('small room / corridor: camera returns to 1x', R.small, g => !g || g.z === 1);
  chk('screen <-> world math is consistent while zoomed', R.aimMath, g => Math.abs(g.screen.x - 900) < 1 && Math.abs(g.screen.y - 300) < 1);
  chk('co-op: both players and the room stay on screen', R.coop, g => g.both && g.fits && g.z < 1);
  chk('no page errors', logs, []);
  console.log(`\ncamtest: ${pass} passed, ${fail} failed`); await b.close(); process.exit(fail ? 1 : 0);
})();
