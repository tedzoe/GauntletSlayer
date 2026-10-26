const ENV = require('./env');
const puppeteer = require('puppeteer-core');
(async () => {
  await ENV.ready;
  const b = await puppeteer.launch({ executablePath: ENV.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage(); await p.goto(ENV.BASE + 'index.html');
  await p.waitForFunction(() => HEROES.filter(d => d.sprite).every(d => hasSprite(d)));
  console.log(await p.evaluate(() => { const run = s => { for (let i = 0; i < s * 60; i++) __game.tick(); };
    __game.SEL.slots = [{ dev: 'kb1', idx: 1, ready: true }, { dev: 'kb2', idx: 3, ready: true }, { dev: 'pad0', idx: 2, ready: true }]; __game.startParty();
    const out = G.heroes.map(h => `${h.def.name}: r=${h.r} scale=${h.body.scale} style=${h.body.style} speed=${Math.round(h.def.speed * h.body.speedMul)}`);
    // Isaac roll timing
    const isaac = G.heroes[2]; startDash(isaac, 0, 150 * isaac.body.rollDist, 0.26 * isaac.body.rollTime, { roll: true }); out.push('isaac roll dur ' + isaac.dash.dur.toFixed(3) + ' dist ' + isaac.dash.dist.toFixed(0));
    // walk Theo through every campaign floor's start area to ensure he isn't stuck (move in 4 dirs)
    const stuck = [];
    for (let wi = 0; wi < 4; wi++) for (let fi = 0; fi < WORLDS[wi].floors.length; fi++) { beginRun(); startCampaignFloor(wi, fi); const t = G.heroes[0]; G.foes = []; const x0 = t.x, y0 = t.y; let moved = 0; for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) { for (let i = 0; i < 30; i++) moveEnt(t, dx * 4, dy * 4); moved += hyp(t.x - x0, t.y - y0); } if (moved < 10) stuck.push(WORLDS[wi].id + fi); }
    out.push('theo stuck at start on: ' + (stuck.join(',') || 'none'));
    return out.join('\n'); }));
  await b.close();
})();
