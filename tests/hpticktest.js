// HP bar food ticks (David, Oct 2026): each hero's HUD HP bar has a tick every small-food heal (FOOD.small x HP_SCALE x the hero's food
// bonus) of its max HP, so heroes with more HP get more, finer ticks; the ticks follow max-HP and food-bonus changes, and eating one small
// food really fills one tick's width.
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
  const R = await p.evaluate(() => {
    const run = s => { for (let i = 0; i < Math.round(s * 60); i++) { menuGuard = 0; __game.tick(); } };
    const setup = id => { const S = __game.SEL; S.slots = [{ dev: 'kb1', idx: HEROES.findIndex(h => h.id === id), ready: true }]; __game.startParty(); beginRun(); startCampaignFloor(0, 0); G.foes = []; G.spawners = []; const h = G.heroes[0]; h.inv = 1e9; h.mods.food = 0; run(0.1); __game.draw(); return h; };
    const out = { small: FOOD.small, scale: HP_SCALE, heroes: [] };
    for (const d of HEROES) { const h = setup(d.id), T = h._hpTicks; const expect = Math.ceil(h.maxHp / (FOOD.small * HP_SCALE)) - 1;
      const even = T.xs.every((x, k) => Math.abs(x - 0.5 - Math.round(T.bx + T.bw * (k + 1) * T.step)) < 0.01);
      // one ration from 0 fills exactly one tick
      h.hp = 1; G.pickups.push({ kind: 'ration', x: h.x, y: h.y }); run(0.2); const filled = (h.hp - 1) / h.maxHp;
      out.heroes.push({ id: d.id, maxHp: h.maxHp, heal: smallFoodHeal(h), ticks: T.n, expect, even, oneFood: +(filled / T.step).toFixed(3) }); }
    // max HP and food bonus changes move the ticks
    { const h = setup('brannoc'); const n0 = h._hpTicks.n; h.maxHp = 400; h.hp = 400; __game.draw(); const n1 = h._hpTicks.n; h.mods.food = 1; __game.draw(); const n2 = h._hpTicks.n; out.change = { n0, n1, n2 }; }
    return out;
  });
  console.log('small food heals', R.small, 'x HP_SCALE', R.scale, '=', R.small * R.scale, 'HP');
  chk('every hero: one tick per small-food heal of max HP, evenly spaced', R.heroes, g => g.every(x => x.ticks === x.expect && x.even && x.ticks >= 1));
  chk('heroes with more HP get more ticks (Theo/David > Gela > Zoey/Isaac/Linda)', R.heroes.map(x => x.id + ':' + x.ticks), g => { const t = Object.fromEntries(R.heroes.map(x => [x.id, x.ticks])); return t.brannoc > t.sela && t.sela > t.mirelle && t.paladin === t.brannoc; });
  chk('eating one small food fills exactly one tick', R.heroes.map(x => x.oneFood), g => g.every(v => Math.abs(v - 1) < 0.01));
  chk('ticks follow max HP and the food bonus (200 HP -> 400 HP doubles them, +100% food halves them)', R.change, c => c.n1 === 2 * c.n0 + 1 && c.n2 === c.n0);
  chk('no page errors', logs, []);
  console.log(`\nhpticktest: ${pass} passed, ${fail} failed`); await b.close(); process.exit(fail ? 1 : 0);
})();
