// Hit sets also hold spawners and props. Every hero swings, casts and dashes into a ring of spawners, pots and a caster for
// 8 s each: no exceptions (Theo's light slash used to read f.d.beh off a spawner or pot), and spawners/props never get foe-only state.
const ENV = require('./env');
const puppeteer = require('puppeteer-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await ENV.ready;
  const b = await puppeteer.launch({ executablePath: ENV.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage(); await p.setViewport({ width: 1152, height: 648 });
  const logs = []; p.on('pageerror', e => logs.push('pageerror: ' + e.message));
  await p.goto(ENV.BASE + 'index.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await sleep(800);
  let pass = 0, fail = 0; const chk = (name, got, want) => { const okk = typeof want === 'function' ? want(got) : JSON.stringify(got) === JSON.stringify(want); okk ? pass++ : fail++; console.log((okk ? 'PASS ' : 'FAIL ') + name + (okk ? '' : '  got ' + JSON.stringify(got).slice(0, 600))); };
  const R = await p.evaluate(() => {
    const out = {}; const saved = Input.read; let frame = 0;
    const pattern = ['primary', 'primary', 'primary', 'secondary', 'primary', 'ability', 'primary', 'dash', 'primary', 'defend'];
    Input.read = dev => { const r = saved.call(Input, dev); if (dev !== 'kb1') return r; const n = pattern[Math.floor(frame / 9) % pattern.length], on = frame % 9 < 5;
      r.down = Object.assign({}, r.down, { [n]: on }); r.pressed = Object.assign({}, r.pressed, { [n]: on && frame % 9 === 0 }); r.mx = Math.cos(frame / 40) * 0.2; r.my = Math.sin(frame / 40) * 0.2; return r; };
    for (const hd of HEROES) {
      const S = __game.SEL; S.slots = [{ dev: 'kb1', idx: HEROES.indexOf(hd), ready: true }]; __game.startParty(); beginRun(); startCampaignFloor(0, 0);
      const h = G.heroes[0]; h.inv = 1e9; h.maxHp = h.hp = 1e6; G.foes = []; G.spawners = []; G.props = []; G.battle = null; G.map.noLock = true;
      const e0 = ERRORS.length; let swings = 0;
      for (frame = 0; frame < 8 * 60; frame++) {
        if (frame % 30 === 0) { G.spawners = G.spawners.filter(s => s.hp > 0); G.props = G.props.filter(q => q.hp > 0); G.foes = G.foes.filter(f => ALIVE(f));
          for (let k = 0; k < 6; k++) { const a = k / 6 * 6.28 + frame / 100, x = h.x + Math.cos(a) * 34, y = h.y + Math.sin(a) * 34; if (collide(x, y, 10)) continue; if (k % 3 === 0) { const s = mkSpawner(x, y, 1, ['shambler'], 'bones'); s.spawnT = 1e9; } else mkProp('pot', x, y); }
          if (!G.foes.length) { const f = mkFoe('hexcaller', h.x + 50, h.y); f.hp = f.maxhp = 1e7; f.spd = 0; } }
        h.fa = frame / 15; menuGuard = 0; __game.tick(); if (G.swings.length || G.shots.some(s => s.team === 'hero')) swings++;
      }
      out[hd.id] = { errors: ERRORS.slice(e0).map(e => String(e).split('\n').slice(0, 2).join(' | ')), swings, spawnerStag: G.spawners.some(s => s.stag > 0), foes: G.foes.length };
    }
    Input.read = saved; return out;
  });
  for (const [id, r] of Object.entries(R)) chk(`${id}: 8s of swings, casts and dashes into spawners, pots and a caster raise no exception`, r, g => g.errors.length === 0 && g.swings > 0);
  chk('spawners never get foe-only stagger', Object.values(R).map(r => r.spawnerStag), g => g.every(x => !x));
  chk('no page errors', logs, []);
  console.log(`\nhitsettest: ${pass} passed, ${fail} failed`); await b.close(); process.exit(fail ? 1 : 0);
})();
