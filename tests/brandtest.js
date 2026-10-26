// Tezois Studio branding: splash on load (fade in, ~2s hold, fade out, skippable), title credit, favicon.
const ENV = require('./env');
const puppeteer = require('puppeteer-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await ENV.ready;
  const b = await puppeteer.launch({ executablePath: ENV.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage(); await p.setViewport({ width: 1152, height: 648 });
  const logs = []; p.on('pageerror', e => logs.push('pageerror: ' + e.message));
  let pass = 0, fail = 0; const chk = (name, got, want) => { const okk = typeof want === 'function' ? want(got) : JSON.stringify(got) === JSON.stringify(want); okk ? pass++ : fail++; console.log((okk ? 'PASS ' : 'FAIL ') + name + ' -> ' + JSON.stringify(got)); };
  await p.goto(ENV.BASE + 'index.html'); await sleep(300);
  chk('automated runs (no ?splash) start on the title', await p.evaluate(() => __game.scene), 'title');
  await p.goto(ENV.BASE + 'index.html?splash'); await sleep(200);
  chk('page load shows the studio splash', await p.evaluate(() => __game.scene), 'splash');
  const len = await p.evaluate(() => splashLen()); chk('splash = fade in + ~2s hold + fade out', len, v => v >= 2.8 && v <= 3.6);
  await sleep(1200); chk('still on the splash after 1.2s', await p.evaluate(() => [__game.scene, brandReady(BRAND.logo)]), ['splash', true]);
  await sleep(len * 1000 + 600); chk('splash ends by itself and goes to the title', await p.evaluate(() => __game.scene), 'title');
  await p.goto(ENV.BASE + 'index.html?splash'); await sleep(400); await p.keyboard.press('KeyX'); await sleep(150);
  chk('any key skips the splash', await p.evaluate(() => __game.scene), 'title');
  await sleep(100); chk('the skipping key does not also start the game', await p.evaluate(() => __game.scene), 'title');
  await p.goto(ENV.BASE + 'index.html?splash'); await sleep(400); await p.mouse.click(500, 300); await sleep(150);
  chk('a click skips the splash', await p.evaluate(() => __game.scene), 'title');
  const icons = await p.evaluate(async () => { const out = []; for (const l of document.querySelectorAll('link[rel~=icon],link[rel=apple-touch-icon]')) { const r = await fetch(l.href); out.push([l.getAttribute('sizes'), r.status]); } return out; });
  chk('favicons (16, 32) and apple-touch icon (180) resolve', icons, [['32x32', 200], ['16x16', 200], ['180x180', 200]]);
  chk('title credit logo loaded', await p.evaluate(() => brandReady(BRAND.small)), true);
  chk('no page errors', logs, []);
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail ? 1 : 0);
})();
