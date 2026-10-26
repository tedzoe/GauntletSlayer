const ENV = require('./env');
const puppeteer = require('puppeteer-core');
(async () => {
  await ENV.ready;
  const b = await puppeteer.launch({ executablePath: ENV.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage(); await p.setViewport({ width: 1152, height: 648 });
  const logs = []; p.on('console', m => { if (m.type() === 'error') logs.push(m.text()); }); p.on('pageerror', e => logs.push(e.message));
  await p.goto(ENV.BASE + 'index.html'); await new Promise(r => setTimeout(r, 1000));
  // Start goes straight to camp (the hero-select screen is archived); kb2 drops in at camp
  await p.keyboard.press('Enter'); await new Promise(r => setTimeout(r, 700));
  console.log('scene', await p.evaluate(() => __game.scene + ':' + G.mode));
  await p.keyboard.press('Numpad1'); await new Promise(r => setTimeout(r, 300));
  console.log('party', await p.evaluate(() => G.heroes.map(h => h.id + '@' + h.dev).join(' ')));
  if (await p.evaluate(() => G.heroes.length) < 2) { console.log('FAIL kb2 did not drop in at camp'); process.exitCode = 1; }
  await p.evaluate(() => { beginRun(); startCampaignFloor(0, 0); }); await new Promise(r => setTimeout(r, 300));
  await p.keyboard.down('ArrowRight'); await p.keyboard.down('Numpad1'); await p.keyboard.down('KeyD'); await p.mouse.move(800, 300); await p.mouse.down();
  const fps = await p.evaluate(() => new Promise(res => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 8000) requestAnimationFrame(f); else res(n / 8); }; requestAnimationFrame(f); }));
  await p.mouse.up(); await p.keyboard.up('ArrowRight'); await p.keyboard.up('Numpad1'); await p.keyboard.up('KeyD');
  console.log('fps', fps, await p.evaluate(() => ({ foes: G.foes.length, parts: G.parts.length, kills: G.stats.kills, p2x: Math.round(G.heroes[1].x), hp: G.heroes.map(h => Math.round(h.hp)) })));
  await p.screenshot({ path: '/tmp/perf.png' });
  console.log('errors', await p.evaluate(() => __game.ERRORS), logs);
  await b.close();
})();
