const ENV = require('./env');
const puppeteer = require('puppeteer-core');
(async () => {
  await ENV.ready;
  const b = await puppeteer.launch({ executablePath: ENV.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage(); await p.goto(ENV.BASE + 'index.html'); await new Promise(r => setTimeout(r, 400));
  for (let hi = 0; hi < 6; hi++) console.log(await p.evaluate(hi => {
    __game.SEL.slots = [{ dev: 'kb1', idx: hi, ready: true }]; __game.startParty();
    const rows = ['##########', '#........#', '#........#', '#........#', '####.#####', '#........#', '#........#', '##########'];
    resetLists(); G.mode = 'campaign'; G.scale = { hp: 1, dmg: 1, spd: 1 }; G.mods = {}; G.map = parseMap(rows, WORLDS[0].theme); G.map.arenaSet = new Set(); renderMapCanvas();
    const h = G.heroes[0]; const res = [];
    for (const off of [0, 6, 11, -9, -13]) { h.x = 4.5 * 32 + off; h.y = 2.5 * 32; for (let i = 0; i < 60; i++) moveEnt(h, 0, 3); res.push(`offset ${off}: ${h.y > 5 * 32 ? 'through' : 'stuck'}`); }
    return h.def.name + ' r=' + h.r + ' -> ' + res.join(', ');
  }, hi));
  await b.close();
})();
