const ENV = require('./env');
const puppeteer = require('puppeteer-core');
const SHOT = process.argv[3] || ENV.SHOT;
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await ENV.ready;
  const b = await puppeteer.launch({ executablePath: ENV.CHROME, headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files'] });
  const p = await b.newPage(); await p.setViewport({ width: 1152, height: 648 });
  const logs = []; p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.text()); }); p.on('pageerror', e => logs.push(e.message));
  await p.evaluateOnNewDocument(() => { const mk = i => ({ index: i, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) }); window.__pads = [mk(0), mk(1), mk(2)]; navigator.getGamepads = () => window.__pads; });
  const url = process.argv[2] || (ENV.BASE + 'index.html');
  await p.goto(url); await p.evaluate(() => localStorage.clear());
  await p.waitForFunction(() => HEROES.filter(d => d.sprite).every(d => hasSprite(d)), { timeout: 8000 });
  const sh = async (n, clip) => { await p.evaluate(() => __game.draw()); await p.screenshot(Object.assign({ path: SHOT + n }, clip ? { clip } : {})); };
  const idx = id => p.evaluate(id => HEROES.findIndex(h => h.id === id), id);
  await sleep(600); await sh('30-title-sprites.png');
  const [iP, iT, iZ, iI] = [await idx('paladin'), await idx('brannoc'), await idx('mirelle'), await idx('kestrel')];
  await p.evaluate((a) => { __game.scene = 'select'; __game.SEL.slots = [{ dev: 'kb1', idx: a[0], ready: true }, { dev: 'pad0', idx: a[1], ready: true }, { dev: 'pad1', idx: a[2], ready: false }, { dev: 'pad2', idx: a[3], ready: false }]; }, [iP, iT, iZ, iI]);
  await sleep(900); await sh('31-select-all-heroes.png');
  const party = await p.evaluate(() => { const run = s => { for (let i = 0; i < s * 60; i++) __game.tick(); };
    __game.SEL.slots.forEach(s => s.ready = true); __game.startParty(); run(0.5); return G.heroes.map(h => h.def.name + '@' + h.dev); });
  console.log('party', party);
  // staged 4-player fight in the open arena
  await p.evaluate(() => { startArena(); const c = { x: G.map.w * T / 2, y: G.map.h * T / 2 }; const [a, b2, d, e] = G.heroes;
    a.x = c.x - 60; a.y = c.y + 10; b2.x = c.x + 40; b2.y = c.y + 70; d.x = c.x + 110; d.y = c.y - 30; e.x = c.x - 10; e.y = c.y - 80; updateCamera(true);
    for (let i = 0; i < 10; i++) { const ang = i / 10 * 6.28; mkFoe(['bonesoldier', 'goblin', 'zealot'][i % 3], c.x + Math.cos(ang) * 240, c.y + Math.sin(ang) * 175, { awake: true }); }
    G.arena.state = 'fight'; G.arena.queue = []; G.arena.wave = 1; G.banner = null; });
  await p.evaluate(() => { __pads[0].buttons[2] = { pressed: true, value: 1 }; __pads[0].axes = [0, 0, 1, 0.1]; __pads[1].axes = [0, 0, 1, -0.3]; __pads[1].buttons[1] = { pressed: true, value: 1 }; __pads[2].axes = [0, 0, -1, -0.2]; __pads[2].buttons[2] = { pressed: true, value: 1 }; });
  await sleep(150); await p.evaluate(() => { __pads[1].buttons[1] = { pressed: false, value: 0 }; __pads[1].buttons[2] = { pressed: true, value: 1 }; });
  await p.keyboard.down('ShiftLeft'); const pos = await p.evaluate(() => ({ x: G.heroes[0].x - G.cam.x, y: G.heroes[0].y - G.cam.y })); await p.mouse.move(pos.x - 150, pos.y - 10);
  await sleep(900); await p.screenshot({ path: SHOT + '32-coop-4p-david-theo-zoey-isaac.png' }); await p.keyboard.up('ShiftLeft');
  await p.evaluate(() => { for (const pd of __pads) { pd.buttons.forEach((b, i) => pd.buttons[i] = { pressed: false, value: 0 }); pd.axes = [0, 0, 0, 0]; } });
  // campaign floor
  await p.evaluate(() => { beginRun(); startCampaignFloor(0, 0); const st = G.map.starts[0]; G.heroes.forEach((h, i) => { h.x = st.x + 50 + i * 46; h.y = st.y + 50 + (i % 2) * 30; }); updateCamera(true); G.banner = null; });
  await sleep(1200); await p.screenshot({ path: SHOT + '33-coop-necropolis.png' });
  // hurt + death frames
  await p.evaluate(() => { const [a, b2, c, d] = G.heroes; G.foes = []; c.inv = 0; hurtHero(c, 9999, {}); for (let i = 0; i < 70; i++) __game.tick(); a.inv = 0; hurtHero(a, 5, {}); d.inv = 0; hurtHero(d, 5, {}); __game.tick(); });
  await sh('34-hurt-and-death-frames.png');
  // close-up size lineup: all six heroes side by side, idle, facing the camera
  await p.evaluate(() => { startArena(); G.foes = []; G.arena.state = 'done'; G.banner = null; const c = { x: G.map.w * T / 2, y: G.map.h * T / 2 + 40 };
    const order = ['paladin', 'brannoc', 'sela', 'mirelle', 'vesper', 'kestrel'];
    G.heroes = order.map((id, i) => { const h = mkHero(i % 4, id, 'none'); h.x = c.x - 225 + i * 90; h.y = c.y; h.fa = 1.5708; return h; }); updateCamera(true); window.__lineup = c; });
  const c = await p.evaluate(() => ({ x: __lineup.x - G.cam.x, y: __lineup.y - G.cam.y }));
  await sh('35-size-lineup.png', { x: c.x - 285, y: c.y - 120, width: 570, height: 165 });
  await p.evaluate(() => { const z = 2; const cv = document.querySelector('canvas'); });
  console.log('errors', await p.evaluate(() => __game.ERRORS), logs);
  await b.close();
})();
