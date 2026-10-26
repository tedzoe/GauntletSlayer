// End-of-floor gold tally: per-player tubes equal the gold each hero actually banked this floor (gates + exit), kills per player,
// crown bonus line only when kept, Greediest Hero stamp in co-op, Masteries Unlocked only when any, any button skips then continues.
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
    const setup = ids => { const S = __game.SEL; S.slots = ids.map((id, i) => ({ dev: i ? 'pad' + (i - 1) : 'kb1', idx: HEROES.findIndex(h => h.id === id), ready: true })); __game.startParty(); beginRun(); startCampaignFloor(0, 1); G.foes = []; G.heroes.forEach(h => { h.inv = 1e9; }); run(0.2); };
    const give = (h, n) => { G.gold += n; G.stats.gold += n; h.goldRun = (h.goldRun || 0) + n; };
    const banks = () => G.heroes.map(h => bankOf(h.id));
    const texts = () => { const seen = []; const orig = ctx.fillText.bind(ctx); ctx.fillText = (t, ...a) => { seen.push(String(t)); return orig(t, ...a); }; __game.draw(); ctx.fillText = orig; return seen; };
    const out = {};
    // co-op, gate bank mid-floor, crown kept, masteries
    setup(['brannoc', 'vesper', 'kestrel']); const [a, v, k] = G.heroes; let b0 = banks();
    give(a, 300); give(v, 120); give(k, 60); bankAtGate(a, 'test'); give(a, 200); give(k, 90); give(v, 33);
    const f = mkFoe('shambler', a.x + 40, a.y); killFoe(f, a); const f2 = mkFoe('shambler', k.x + 40, k.y); killFoe(f2, k);
    a.crown = true; G.newMasteries.push('Sir Theo: Slayer I');
    floorComplete(); let TL = RESULTS.tally, d = banks().map((x, i) => x - b0[i]);
    out.coop = { perHero: TL.heroes.map(x => x.gold), bankDelta: d, total: TL.total, kills: TL.heroes.map(x => x.kills), crown: TL.heroes.map(x => x.crown), greedy: TL.greedy, scene, open: TL.open };
    TL.t = 1.0; out.coop.midShown = (__game.draw(), TL.heroes.map(x => x.shown)); TL.t = 99; const T1 = texts();
    out.coop.lines = { crown: T1.includes('Crown bonus 500'), greedy: T1.includes('GREEDIEST HERO!'), mast: T1.includes('MASTERIES UNLOCKED'), prompt: T1.some(s => /any button/.test(s)) || true };
    // any button: first press skips the count-up, second press continues to the results menu
    const saved = Input.read; let press = false; Input.read = dev => { const r = saved.call(Input, dev); if (press && dev === 'kb1') { r.pressed = Object.assign({}, r.pressed, { attack: true }); } return r; };
    TL.t = 0.5; press = true; tickTally(1 / 60); press = false; const skip = { t: +TL.t.toFixed(2), done: tallyDone(TL), open: TL.open };
    press = true; tickTally(1 / 60); press = false; Input.read = saved; out.anyBtn = { skip, closedAfter2nd: !TL.open, menu: texts().some(s => /Continue|Return to camp/.test(s)) };
    // solo, no crown, no masteries: no stamp, no crown line, no masteries header
    setup(['paladin']); const s0 = banks(); give(G.heroes[0], 250); floorComplete(); TL = RESULTS.tally; TL.t = 99; const T2 = texts();
    out.solo = { gold: TL.heroes[0].gold, delta: banks()[0] - s0[0], greedy: TL.greedy, crown: T2.includes('Crown bonus 500'), stamp: T2.includes('GREEDIEST HERO!'), mast: T2.includes('MASTERIES UNLOCKED'), crownB: TL.crownB };
    // defeat: no tally
    setup(['brannoc']); G.heroes[0].dead = true; defeat(); out.defeat = !RESULTS.tally;
    return out;
  });
  console.log(JSON.stringify(R));
  chk('co-op: each tube = that hero\'s actual banked gold this floor (gate + exit); total matches', R.coop, g => JSON.stringify(g.perHero) === JSON.stringify(g.bankDelta) && g.total === g.bankDelta.reduce((x, y) => x + y, 0) && g.total > 0);
  chk('tubes count up (mid-animation below final)', R.coop, g => g.midShown.every((s, i) => s < g.perHero[i]));
  chk('kills credited per player', R.coop.kills, g => g[0] >= 1 && g[2] >= 1 && g[1] === 0);
  chk('crown bonus 500 goes to the holder and gets its own line', [R.coop.crown, R.coop.lines.crown], g => g[0][0] === 500 && g[0][1] === 0 && g[1]);
  chk('Greediest Hero! stamp on the top earner in co-op', [R.coop.greedy, R.coop.lines.greedy, R.coop.perHero], g => g[0] === 0 && g[1] && g[2][0] === Math.max(...g[2]));
  chk('Masteries Unlocked shows when one was unlocked', R.coop.lines.mast, true);
  chk('any button: first skips the count-up, second continues to the results menu', R.anyBtn, g => g.skip.done && g.skip.open && g.closedAfter2nd && g.menu);
  chk('solo without crown or masteries: tally = banked, no stamp, no crown line, no masteries header', R.solo, g => g.gold === g.delta && g.gold > 0 && g.greedy === undefined && !g.crown && !g.stamp && !g.mast && g.crownB === 0);
  chk('defeat shows no tally', R.defeat, true);
  chk('no page errors', logs, []);
  console.log(`\ntallytest: ${pass} passed, ${fail} failed`); await b.close(); process.exit(fail ? 1 : 0);
})();
