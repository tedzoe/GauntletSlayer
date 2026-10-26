// Neoseeker FAQ checks (Elf -> Isaac, Wizard -> Zoey): Tumble has no cooldown but a short vulnerable end pause, so rolling
// repeatedly outruns running; Shadowstrike smoke lasts 4s and ends on a shot or roll; the bomb / explosive arrow / mortar share a 6s cd;
// Ice Beam hits one target at a time.
const ENV = require('./env');
const puppeteer = require('puppeteer-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await ENV.ready;
  const b = await puppeteer.launch({ executablePath: ENV.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage(); await p.setViewport({ width: 1152, height: 648 });
  const logs = []; p.on('pageerror', e => logs.push('pageerror: ' + e.message));
  await p.goto(ENV.BASE + 'index.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await sleep(800);
  let pass = 0, fail = 0; const chk = (name, got, want) => { const okk = typeof want === 'function' ? want(got) : JSON.stringify(got) === JSON.stringify(want); okk ? pass++ : fail++; console.log((okk ? 'PASS ' : 'FAIL ') + name + (okk ? '' : '  got ' + JSON.stringify(got).slice(0, 500))); };
  const R = await p.evaluate(() => {
    const hold = new Set(), pr = new Set(); let mv = [0, 0];
    const saved = Input.read; Input.read = dev => { if (dev !== 'kb1') return saved.call(Input, dev); const r = { mx: mv[0], my: mv[1], ax: 0, ay: 0, aim: null, dev, down: {}, pressed: {}, released: {} }; for (const k of hold) r.down[k] = true; for (const k of pr) r.pressed[k] = true; return r; };
    const run = s => { for (let i = 0; i < Math.round(s * 60); i++) { menuGuard = 0; __game.tick(); pr.clear(); } };
    const tap = k => { pr.add(k); hold.add(k); run(1 / 60); hold.delete(k); run(1 / 60); };
    const room = () => { const rows = []; for (let y = 0; y < 22; y++) rows.push(y === 0 || y === 21 ? '#'.repeat(60) : '#' + '.'.repeat(58) + '#');
      resetLists(); G.mode = 'campaign'; G.scale = { hp: 1, dmg: 1, spd: 1, spawn: 1 }; G.mods = {}; G.goldMul = 1; G.worldTier = 0; G.map = parseMap(rows, WORLDS[0].theme); G.map.arenaSet = new Set();
      G.floorName = 'Test'; G.worldName = 'Test'; renderMapCanvas(); G.stats = newStats(); updateCamera(true); computeFlow(); G.exitOpen = false; };
    const setup = (id, weapon) => { const S = __game.SEL; S.slots = [{ dev: 'kb1', idx: HEROES.findIndex(h => h.id === id), ready: true }]; __game.startParty(); room(); const h = G.heroes[0]; if (weapon) h.weapon = weapon; h.x = 4 * 32; h.y = 11 * 32; h.fa = 0; h.cd = {}; h.hp = h.maxHp; hold.clear(); mv = [0, 0]; run(0.2); return h; };
    const out = {};
    // Tumble: no real cooldown, pause at the end, spamming outruns running
    { let h = setup('kestrel'); mv = [1, 0]; const x0 = h.x; run(2); const runD = h.x - x0;
      h = setup('kestrel'); mv = [1, 0]; const x1 = h.x; let rolls = 0; for (let t = 0; t < 120; t++) { if (cdReady(h, 'defend') && !(h.rollPause > 0) && !h.dash) { pr.add('defend'); rolls++; } run(1 / 60); } const rollD = h.x - x1;
      h = setup('kestrel'); mv = [1, 0]; h.inv = 0; tap('defend'); let sawPause = false, vulnInPause = false, still = true, px = null; for (let i = 0; i < 40; i++) { run(1 / 60); if (h.rollPause > 0) { sawPause = true; if (h.inv <= 0) vulnInPause = true; out.pinv = Math.max(out.pinv || 0, +h.inv.toFixed(3)); if (px !== null && Math.abs(h.x - px) > 0.5) still = false; px = h.x; } }
      out.tumble = { runD: Math.round(runD), rollD: Math.round(rollD), rolls, cd: SPEC.isaac.rollCd, sawPause, vulnInPause, still }; }
    // Shared 6s cooldown on the Questor's-Bow-style tools
    { const h = setup('kestrel', 'base'); tap('defend'); pr.add('ability'); run(1 / 60); out.bombCd = +(h.cd.ability || 0).toFixed(1); h.cd = {}; h.dash = null; h.rollPause = 0; h.rolling = false;
      hold.add('secondary'); pr.add('secondary'); run(0.1); pr.add('ability'); run(1 / 60); out.explCd = +(h.cd.ability || 0).toFixed(1); hold.clear(); run(0.1); h.cd = {}; pr.add('ability'); run(1 / 60); out.mortarCd = +(h.cd.ability || 0).toFixed(1); }
    // Smoke: 4s, cd 5, broken by a quick shot, not renewed by standing in the cloud
    { const h = setup('kestrel', 'dusk'); pr.add('ability'); run(1 / 60); const s = { cd: +(h.cd.ability || 0).toFixed(1), inv0: h.invisT > 3.5 }; run(1); s.after1 = h.invis; hold.add('primary'); run(0.1); hold.clear(); run(0.3); s.afterShot = h.invis;
      h.cd = {}; pr.add('ability'); run(1 / 60); run(4.4); s.lasts4 = h.invis === false; h.cd = {}; pr.add('ability'); run(3.5); s.at35 = h.invis; tap('defend'); run(0.5); s.afterRoll = h.invis; out.smoke = s; }
    // Ice Beam: single target
    { const h = setup('mirelle'); h.schools = ['ember', 'rime', 'storm']; const fs = [0, 1, 2].map(i => { const f = mkFoe('shambler', h.x + 90 + i * 40, h.y, { awake: true }); f.spd = 0; f.atkT = 999; f.hp = f.maxhp = 5000; return f; });
      h.spell = [1, 1]; h.runes = [1, 1]; hold.add('primary'); h.fa = 0; run(2); hold.clear(); out.ray = fs.map(f => Math.round(f.maxhp - f.hp)); }
    Input.read = saved; return out;
  });
  console.log(JSON.stringify(R));
  chk('Tumble: no real cooldown (spam guard = roll + end pause), rolling repeatedly beats running', R.tumble, g => g.cd <= 0.5 && g.rolls >= 4 && g.rollD > g.runD * 1.25);
  chk('Tumble: a short pause at the end, standing still and hittable', R.tumble, g => g.sawPause && g.vulnInPause && g.still);
  chk('Questor\'s Bow style: bomb, explosive arrow and mortar share a 6s cooldown', [R.bombCd, R.explCd, R.mortarCd], g => g.every(c => c >= 5.9 && c <= 6.0));
  chk('Shadowstrike smoke: 5s cd, ~4s invisibility, ended by a shot or a roll', R.smoke, g => g.cd === 5 && g.inv0 && g.after1 && !g.afterShot && g.lasts4 && g.at35 && !g.afterRoll);
  chk('Ice Beam hits only the first foe in line', R.ray, g => g[0] > 40 && g[1] === 0 && g[2] === 0);
  chk('no page errors', logs, []);
  console.log(`\nfaqtest: ${pass} passed, ${fail} failed`); await b.close(); process.exit(fail ? 1 : 0);
})();
