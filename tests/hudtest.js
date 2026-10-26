// Slayer bottom-center player panels: square icons with a clockwise dark radial sweep; Vesper's weapon ability shows Soul Power instead.
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
    const setup = ids => { const S = __game.SEL; S.slots = ids.map((id, i) => ({ dev: i ? 'pad' + (i - 1) : 'kb1', idx: HEROES.findIndex(h => h.id === id), ready: true })); __game.startParty(); beginRun(); startCampaignFloor(0, 0); G.foes = []; G.spawners = []; G.heroes.forEach(h => { h.inv = 1e9; }); run(0.2); };
    const cv = document.querySelector('canvas'), k = cv.width / W, c2 = cv.getContext('2d');
    const lum = (x, y, w, h) => { const d = c2.getImageData(Math.round(x * k), Math.round(y * k), Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k))).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] + d[i + 2]; return s / (d.length / 4) / 3; };
    const out = {};
    for (const ids of [['brannoc'], ['brannoc', 'vesper'], ['sela', 'paladin', 'mirelle', 'kestrel']]) {
      setup(ids); __game.draw(); const ps = G.heroes.map(h => h._panel);
      out['n' + ids.length] = { inside: ps.every(q => q.x >= 0 && q.x + q.w <= W && q.y + q.h <= H), noOverlap: ps.every((q, i) => !i || q.x >= ps[i - 1].x + ps[i - 1].w),
        centred: Math.abs((ps[0].x + ps[ps.length - 1].x + ps[ps.length - 1].w) / 2 - W / 2) <= 1, bottom: ps.every(q => H - (q.y + q.h) < 16), compact: ps.every(q => q.h <= 70),
        labs: G.heroes.map(h => h._lastMoves) };
    }
    // every move except the main attack has a square, with Potion, Relic, Weapon Ability first
    out.cover = HEROES.map(d => { setup([d.id]); const h = G.heroes[0]; __game.draw(); const want = heroMoves(h).filter(m => !m.main && m.lab !== 'POT').map(m => m.lab); return { id: d.id, ok: want.every(l => h._lastMoves.includes(l)) && h._lastMoves.includes('REL'), first3: h._lastMoves.slice(0, 3), all: h._lastMoves.slice(), slayer: h._panel.sq.filter(q => q.slayer).length }; });
    // sweep: half way through the cooldown, the remaining (dark) half is the left half -> clockwise from 12 o'clock
    setup(['brannoc']); const h = G.heroes[0]; h.cd.ability = 5; h._cdm = { SPIN: 10 }; G.heroes[0].hp = h.maxHp; __game.draw();
    const q = h._panel.sq.find(s => s.lab === 'SPIN'); out.sweep = { left: Math.round(lum(q.x + 2, q.y + 2, q.s / 2 - 4, q.s / 2 - 4)), right: Math.round(lum(q.x + q.s / 2 + 2, q.y + 2, q.s / 2 - 4, q.s / 2 - 4)) };
    h.cd.ability = 7.5; __game.draw(); out.sweep75 = { tl: Math.round(lum(q.x + 2, q.y + 2, 6, 6)), tr: Math.round(lum(q.x + q.s - 8, q.y + 2, 6, 6)), br: Math.round(lum(q.x + q.s - 8, q.y + q.s - 12, 6, 6)) };
    h.cd.ability = 0; __game.draw(); out.ready = Math.round(lum(q.x + 2, q.y + 2, q.s - 4, q.s / 2 - 4));
    // seconds text on cooling squares (David's deviation)
    { let seen = []; const orig = ctx.fillText.bind(ctx); ctx.fillText = (t, ...a) => { seen.push(String(t)); return orig(t, ...a); }; h.cd.secondary = 2.4; h._cdm.LEAP = 4; h.cd.ability = 7.5; __game.draw(); ctx.fillText = orig; out.secs = ['3', '8'].every(s => seen.includes(s)); }
    // Vesper: SOUL square is the meter (no sweep): it follows souls, not cooldowns
    setup(['vesper']); const v = G.heroes[0]; const vs = () => { __game.draw(); const s = v._panel.sq.find(x => x.soul); return Math.round(lum(s.x + 2, s.y + 2, s.s - 4, s.s - 8)); };
    v.souls = 0; const a0 = vs(); v.souls = 75; const a1 = vs(); v.souls = 100; const a2 = vs(); v.cd.ability = 9; v.souls = 75; const a3 = vs();
    out.soul = { first3: v._lastMoves.slice(0, 3), a0, a1, a2, a3, isSoul: v._panel.sq.filter(x => x.soul).map(x => x.lab) };
    // potion flasks (David, Oct 2026): one icon per potion held, like the keys
    out.pots = []; for (const id of ['brannoc', 'sela', 'mirelle']) { setup([id]); const h = G.heroes[0]; h.keys = 5; for (let n = 0; n <= POTION_CAP; n++) { h.potions = n; __game.draw(); const P = h._pots, q = h._panel, last = q.sq[q.sq.length - 1];
      out.pots.push({ id, n, icons: P.icons, empty: P.empty, count: P.count, inside: P.x.every(x => x - 6 >= q.x && x + 6 <= q.x + q.w), clear: P.x[0] - 6 > last.x + last.s }); } }
    return out;
  });
  console.log(JSON.stringify(R));
  for (const n of ['n1', 'n2', 'n4']) chk(`${n.slice(1)} player(s): panels compact, bottom-centre, on screen, not overlapping`, R[n], g => g.inside && g.noOverlap && g.centred && g.bottom && g.compact);
  chk('every hero: a square for every move but the main attack and potions, Relic / Weapon Ability first (gold framed), no potion square', R.cover, g => g.every(x => x.ok && x.first3[0] === 'REL' && !x.all.includes('POT') && x.slayer === 2));
  chk('potions are flask icons after the squares, one per potion (0-5), a dim empty flask at 0, inside the panel and clear of the squares', R.pots, g => g.every(x => x.inside && x.clear && x.icons === (x.n || 1) && x.empty === (x.n === 0) && x.count === null));
  chk('radial sweep at 50%: remaining dark wedge is the left half (clockwise from 12)', R.sweep, g => g.right > g.left + 30);
  chk('radial sweep at 75% left: only the top-right quarter is clear', R.sweep75, g => g.tr > g.tl + 30 && g.tr > g.br + 30);
  chk('ready icon is bright again', [R.ready, R.sweep.right], g => g[0] >= g[1] - 10);
  chk('cooling squares print the seconds left', R.secs, true);
  chk('Vesper weapon ability square = Soul Power meter: brighter as souls grow, white at FULL, ignores cooldowns', R.soul, g => g.first3[1] === 'SOUL' && g.a1 > g.a0 + 20 && g.a2 > g.a1 + 20 && Math.abs(g.a3 - g.a1) < 3 && g.isSoul.length === 1);
  chk('no page errors', logs, []);
  console.log(`\nhudtest: ${pass} passed, ${fail} failed`); await b.close(); process.exit(fail ? 1 : 0);
})();
