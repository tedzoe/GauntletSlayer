// Floating words over heroes don't stack: the same spell/relic/status word near the same spot refreshes instead of piling up,
// different words get their own line, numbers are untouched; Zoey's primed-spell label sits above her rune pips; boss phase and
// wave banners stay clear of the solo "You have fallen" box.
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
    const setup = id => { const S = __game.SEL; S.slots = [{ dev: 'kb1', idx: HEROES.findIndex(h => h.id === id), ready: true }]; __game.startParty(); beginRun(); startCampaignFloor(0, 3); G.heroes[0].inv = 1e9; };
    const calls = () => { const seen = []; const orig = ctx.fillText.bind(ctx); ctx.fillText = (t, x, y, ...a) => { seen.push({ s: String(t), x, y, tf: ctx.getTransform().d }); return orig(t, x, y, ...a); }; __game.draw(); ctx.fillText = orig; return seen; };
    const out = {};
    setup('mirelle'); const h = G.heroes[0]; G.texts = [];
    for (let k = 0; k < 3; k++) { text(h.x, h.y - 40, 'Static Ward', '#9cf'); for (let i = 0; i < 6; i++) updateFx(1 / 60); }
    out.dedupe = G.texts.filter(t => t.s === 'Static Ward').length;
    G.texts = []; text(h.x, h.y - 34, 'PERFECT'); text(h.x + 4, h.y - 30, 'THUD'); text(h.x, h.y - 34, 'No Soul Power'); const ws = G.texts.map(t => t.y).sort((a, b) => a - b);
    out.stack = { n: G.texts.length, minGap: Math.min(...ws.slice(1).map((y, i) => y - ws[i])) };
    G.texts = []; for (let k = 0; k < 3; k++) text(h.x, h.y - 24, '-14'); out.numbers = G.texts.length;
    // Zoey: primed label above the pips while new runes are drawn
    G.texts = []; h.spell = []; h.runes = []; h.runeT = 0; G.foes = G.foes.filter(f => f.boss); G.boss.st = 99; G.boss.actT = 99; let err = null;
    const saved = Input.read; let fr = 0; Input.read = dev => { const r = saved.call(Input, dev); if (dev !== 'kb1') return r; const b = fr < 4 ? 'ability' : fr >= 12 && fr < 16 ? 'defend' : null;
      if (b) { r.down = Object.assign({}, r.down, { [b]: true }); r.pressed = Object.assign({}, r.pressed, { [b]: fr === 0 || fr === 12 }); } return r; };
    try { for (fr = 0; fr < 20; fr++) { menuGuard = 0; __game.tick(); } } catch (e) { err = String(e); } Input.read = saved;
    const nm = h.spell && h.spell.length === 2 ? spellOf(h).name : null, pops = G.texts.filter(t => t.s === nm).length, c1 = calls(), lab = [...new Set(c1.filter(c => c.s === nm && c.y < 500).map(c => Math.round(c.y)))];
    out.zoey = { nm, err, pops, overhead: lab.length, spell: h.spell };
    // banner vs revive box
    G.boss.hp = G.boss.maxhp; G.banner = { s: 'The King is enraged!', sub: 'PHASE II', t: 2, max: 3 }; out.bannerNormal = bannerRect();
    h.dead = true; G.reviveOffer = true; const br = bannerRect(), rr = reviveRect(); const c2 = calls();
    out.revive = { br, rr, up: reviveBoxUp(), bannerTxt: c2.filter(c => /enraged|PHASE II/.test(c.s)).map(c => c.y), boxTxt: c2.filter(c => /You have fallen/.test(c.s)).map(c => c.y) };
    return out;
  });
  console.log(JSON.stringify(R));
  chk('the same word popped 3 times at one spot shows once', R.dedupe, 1);
  chk('different words at one spot each get their own line (>= 13 px apart)', R.stack, g => g.n === 3 && g.minGap >= 13);
  chk('damage numbers are not merged', R.numbers, 3);
  chk("priming a Zoey spell shows its name once over her head, with no extra floating copy", R.zoey, g => !g.err && g.nm && g.pops === 0 && g.overhead === 1);
  chk('normal banner keeps its usual place', R.bannerNormal, g => !g.compact && Math.abs(g.y - (648 * 0.3 - 40)) < 1);
  chk('with the revive box up, the phase banner sits below the boss bar and well above the box', R.revive, g => g.up && g.br.y >= 82 && g.br.y + g.br.h + 20 <= g.rr.y && g.bannerTxt.length >= 2 && g.bannerTxt.every(y => y < g.rr.y - 20) && g.boxTxt.length >= 1);
  chk('no page errors', logs, []);
  console.log(`\ntexttest: ${pass} passed, ${fail} failed`); await b.close(); process.exit(fail ? 1 : 0);
})();
