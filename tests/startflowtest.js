// Start flow (David, Oct 2026): the starting hero-select screen is archived. Start on the title goes straight to camp with the last
// hero played (else the first hero), the Hero Shrine change is remembered across reloads, a second player drops in at camp, and the
// archived screen's code is still there (HERO_SELECT_SCREEN = false) so it can be restored.
const ENV = require('./env');
const puppeteer = require('puppeteer-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await ENV.ready;
  const b = await puppeteer.launch({ executablePath: ENV.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage(); await p.setViewport({ width: 1152, height: 648 });
  const logs = []; p.on('pageerror', e => logs.push('pageerror: ' + e.message));
  let pass = 0, fail = 0; const chk = (name, got, want) => { const okk = typeof want === 'function' ? want(got) : JSON.stringify(got) === JSON.stringify(want); okk ? pass++ : fail++; console.log((okk ? 'PASS ' : 'FAIL ') + name + '  ' + JSON.stringify(got)); };
  await p.goto(ENV.BASE + 'index.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await sleep(900);
  const scenes = []; const watch = () => p.evaluate(() => { window.__sc = [__game.scene]; setInterval(() => { const s = __game.scene; if (window.__sc[window.__sc.length - 1] !== s) window.__sc.push(s); }, 16); });
  await watch(); chk('the game opens on the title', await p.evaluate(() => __game.scene), 'title');
  await p.keyboard.press('Enter'); await sleep(700);
  chk('Enter on the title goes straight to camp with the first hero (fresh save)', await p.evaluate(() => ({ scene: __game.scene, mode: G.mode, heroes: G.heroes.map(h => h.id), seen: window.__sc })), { scene: 'game', mode: 'hub', heroes: ['brannoc'], seen: ['title', 'game'] });
  await p.evaluate(() => { rebuildHero(G.heroes[0], 'vesper'); });
  chk('changing hero at the Hero Shrine is saved as the last hero', await p.evaluate(() => JSON.parse(localStorage.getItem(SAVE_KEY)).lastHero), 'vesper');
  await p.reload(); await sleep(900); await watch(); await p.keyboard.press('Enter'); await sleep(700);
  chk('after a reload, Start opens camp with the last hero played', await p.evaluate(() => ({ scene: __game.scene, heroes: G.heroes.map(h => h.id), seen: window.__sc })), { scene: 'game', heroes: ['vesper'], seen: ['title', 'game'] });
  await p.keyboard.press('Numpad1'); await sleep(300);
  chk('a second player (keyboard 2) drops in at camp on a free hero', await p.evaluate(() => G.heroes.map(h => h.dev + ':' + h.id)), g => g.length === 2 && g[1].startsWith('kb2:') && g[1] !== 'kb2:vesper');
  chk('the archived select screen is still in the code, switched off', await p.evaluate(() => ({ flag: HERO_SELECT_SCREEN, tick: typeof tickSelect, draw: typeof drawSelect })), { flag: false, tick: 'function', draw: 'function' });
  chk('the archived screen still draws if restored', await p.evaluate(() => { __game.SEL.slots = [{ dev: 'kb1', idx: 0, ready: false }]; try { drawSelect(); return 'ok'; } catch (e) { return String(e); } }), 'ok');
  chk('no page errors', logs, []);
  console.log(`\nstartflowtest: ${pass} passed, ${fail} failed`); await b.close(); process.exit(fail ? 1 : 0);
})();
