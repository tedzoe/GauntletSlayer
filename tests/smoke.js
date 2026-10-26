const ENV = require('./env');
const puppeteer = require('puppeteer-core');
(async () => {
  await ENV.ready;
  const b = await puppeteer.launch({ executablePath: ENV.CHROME, headless: 'new', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage(); await p.setViewport({ width: 1152, height: 648 });
  const logs = []; p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); }); p.on('pageerror', e => logs.push('pageerror: ' + e.message));
  await p.goto(ENV.BASE + 'index.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await new Promise(r => setTimeout(r, 800));
  await p.screenshot({ path: '/tmp/s_title.png' });
  await p.keyboard.press('Enter'); await new Promise(r => setTimeout(r, 600));
  await p.keyboard.press('Enter'); await new Promise(r => setTimeout(r, 300));
  await p.screenshot({ path: '/tmp/s_select.png' });
  await p.keyboard.press('Enter'); await new Promise(r => setTimeout(r, 800));
  console.log('scene', await p.evaluate(() => __game.scene), await p.evaluate(() => __game.ERRORS));
  await p.screenshot({ path: '/tmp/s_hub.png' });
  console.log(logs.join('\n'));
  await b.close();
})();
