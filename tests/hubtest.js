// Camp (hub) layout: at 1280x720, 1920x1080 and a small 800x450 window, with 1 and 4 players, every station label is fully on
// screen and clear of the top bar, the gold box, the player panels and the other labels; no centre banner covers the Hero
// Shrine; the bank total shows exactly once; a station's prompt replaces its label and stays on screen at the map's edge.
const ENV = require('./env');
const puppeteer = require('puppeteer-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await ENV.ready;
  const b = await puppeteer.launch({ executablePath: ENV.CHROME, headless: 'new', args: ['--no-sandbox'] });
  let pass = 0, fail = 0; const chk = (name, got, want) => { const okk = typeof want === 'function' ? want(got) : JSON.stringify(got) === JSON.stringify(want); okk ? pass++ : fail++; console.log((okk ? 'PASS ' : 'FAIL ') + name + (okk ? '' : '  got ' + JSON.stringify(got).slice(0, 600))); };
  const logs = [];
  for (const [w, h] of [[1280, 720], [1920, 1080], [800, 450]]) for (const n of [1, 4]) {
    const p = await b.newPage(); await p.setViewport({ width: w, height: h }); p.on('pageerror', e => logs.push('pageerror: ' + e.message));
    await p.goto(ENV.BASE + 'index.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await sleep(600);
    const R = await p.evaluate(n => {
      const S = __game.SEL; S.slots = ['brannoc', 'sela', 'kestrel', 'vesper'].slice(0, n).map((id, i) => ({ dev: i ? 'pad' + (i - 1) : 'kb1', idx: HEROES.findIndex(h => h.id === id), ready: true }));
      __game.startParty(); startHub(); scene = 'game'; for (let i = 0; i < 20; i++) { menuGuard = 0; __game.tick(); }
      const draw = () => { const seen = []; const orig = ctx.fillText.bind(ctx); ctx.fillText = (t, x, y, ...a) => { const m = ctx.measureText(String(t)), wd = m.width, al = ctx.textAlign, x0 = al === 'center' ? x - wd / 2 : al === 'right' ? x - wd : x; const sz = parseInt(/(\d+)px/.exec(ctx.font)[1]);
          if (ctx.fillStyle !== 'rgba(0, 0, 0, 0.85)' && !/^rgba\(0, 0, 0/.test(ctx.fillStyle)) seen.push({ s: String(t), x0, x1: x0 + wd, y0: y - sz * 0.8, y1: y + sz * 0.2 }); return orig(t, x, y, ...a); }; __game.draw(); ctx.fillText = orig; return seen; };
      const T1 = draw(), labels = G.stations.map(s => T1.find(t => t.s === s.label) || { s: s.label, missing: true });
      const boxes = [{ n: 'top bar', x0: W / 2 - 230, x1: W / 2 + 230, y0: 6, y1: 40 }, { n: 'gold box', x0: W - 200, x1: W - 10, y0: 6, y1: 40 }, ...G.heroes.map((h, i) => ({ n: 'panel P' + (i + 1), x0: h._panel.x, x1: h._panel.x + h._panel.w, y0: h._panel.y - 16, y1: h._panel.y + h._panel.h }))];
      const hit = (a, c) => a.x0 < c.x1 && c.x0 < a.x1 && a.y0 < c.y1 && c.y0 < a.y1;
      const bad = [];
      for (const l of labels) { if (l.missing) { bad.push(l.s + ': not drawn'); continue; } if (l.x0 < 0 || l.x1 > W || l.y0 < 0 || l.y1 > H) bad.push(l.s + ': off screen');
        for (const c of boxes) if (hit(l, c)) bad.push(l.s + ' overlaps ' + c.n); for (const o of labels) if (o !== l && !o.missing && hit(l, o)) bad.push(l.s + ' overlaps ' + o.s); }
      const bankTexts = T1.filter(t => /bank/i.test(t.s)).map(t => t.s);
      // stand at the far-right Armory: its prompt replaces the label and stays on screen
      const k = G.stations.find(s => s.id === 'K'); G.heroes[0].x = k.x; G.heroes[0].y = k.y + 20; menuGuard = 0; __game.tick(); const T2 = draw();
      const prompt = T2.filter(t => t.s === k.label);
      return { bad: [...new Set(bad)], banner: G.banner, bankTexts, z: G.cam.z, prompt: prompt.map(t => [Math.round(t.x0), Math.round(t.x1)]), station: G.heroes[0].station && G.heroes[0].station.id, W };
    }, n);
    const tag = `${w}x${h} ${n}P`;
    chk(`${tag}: every station label is on screen and overlaps nothing`, R.bad, []);
    chk(`${tag}: no centre banner in camp`, R.banner, null);
    chk(`${tag}: bank total shows exactly once`, R.bankTexts, g => g.length === 1 && /^Banked \d+$/.test(g[0]));
    chk(`${tag}: at the Armory its prompt replaces the label and is fully on screen`, R, g => g.station === 'K' && g.prompt.length === 1 && g.prompt[0][0] >= 0 && g.prompt[0][1] <= g.W);
    await p.close();
  }
  chk('no page errors', logs, []);
  console.log(`\nhubtest: ${pass} passed, ${fail} failed`); await b.close(); process.exit(fail ? 1 : 0);
})();
