// David's rules (Oct 2026): death resets every cooldown; Valkyrie / paladin shields have no cooldown, duration, stamina or break timer.
const ENV = require('./env');
const puppeteer = require('puppeteer-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await ENV.ready;
  const b = await puppeteer.launch({ executablePath: ENV.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage(); await p.setViewport({ width: 1152, height: 648 });
  const logs = []; p.on('pageerror', e => logs.push('pageerror: ' + e.message));
  await p.goto(ENV.BASE + 'index.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await sleep(800);
  let pass = 0, fail = 0; const chk = (name, got, want) => { const okk = typeof want === 'function' ? want(got) : JSON.stringify(got) === JSON.stringify(want); okk ? pass++ : fail++; console.log((okk ? 'PASS ' : 'FAIL ') + name + ' -> ' + JSON.stringify(got).slice(0, 700)); };
  await p.evaluate(() => {
    const oRead = Input.read; window.HOLD = { keys: new Set() }; let prev = new Set();
    Input.read = (dev, s) => { if (dev !== 'kb1') return oRead(dev, s); const st = { mx: 0, my: 0, ax: 0, ay: 0, aim: false, aimFire: false, dev, down: {}, pressed: {}, released: {} }; for (const k of HOLD.keys) { st.down[k] = true; if (!prev.has(k)) st.pressed[k] = true; } return st; };
    const oCommit = Input.commit; Input.commit = d => { prev = new Set(HOLD.keys); oCommit(d); };
    window.FX = { setup(id) { const S = __game.SEL; S.slots = [{ dev: 'kb1', idx: HEROES.findIndex(h => h.id === id), ready: true }]; __game.startParty(); beginRun(); startCampaignFloor(0, 0); G.foes = []; G.spawners = []; G.rez = 9; return G.heroes[0]; },
      run(n) { for (let i = 0; i < n; i++) { menuGuard = 0; __game.tick(); } } };
  });
  // ---- (B) death resets every cooldown and ability timer
  const B = await p.evaluate(() => HEROES.map(d => {
    const h = FX.setup(d.id); h.relic = { id: 'mirror', rank: 1 };
    // put everything on cooldown by actually using it, then force the rest
    for (const k of ['secondary', 'ability', 'dash', 'relic', 'potion', 'defend']) { HOLD.keys = new Set([k]); FX.run(4); HOLD.keys = new Set(); FX.run(30); }
    for (const k of ['secondary', 'ability', 'defend', 'dash', 'relic', 'potion', 'scharge', 'bash', 'advance', 'consecrate', 'talisman']) h.cd[k] = 20;
    h.spellCd = { x: 9, y: 9 }; h.atkT = 3; h.slamT = 2; h.throwT = 2;
    const before = heroMoves(h).filter(m => m.cd() > 0).length;
    h.inv = 0; killHero(h); const dead = { cd: Object.keys(h.cd).length, spell: Object.keys(h.spellCd).length, atkT: h.atkT };
    reviveHero(h, true); FX.run(1);
    const after = heroMoves(h).filter(m => m.cd() > 0.02).map(m => m.lab);
    return [d.id, before, dead, after];
  }));
  chk('every hero had cooldowns running before dying', B.map(r => [r[0], r[1]]), g => g.every(r => r[1] >= 3));
  chk('dying clears every cooldown table and attack timer', B.map(r => [r[0], r[2]]), g => g.every(r => r[1].cd === 0 && r[1].spell === 0 && !r[1].atkT));
  chk('revived heroes have every move ready (no cooldown sweep left)', B.map(r => [r[0], r[3]]), g => g.every(r => r[1].length === 0));
  // ---- (C) shields: held as long as Defend is held, no cooldown, no stamina, raise again at once, still blocks
  const C = await p.evaluate(() => ['sela', 'paladin'].map(id => {
    const h = FX.setup(id); h.fa = 0; const hp0 = h.hp; h.inv = 0;
    FX.run(40); HOLD.keys = new Set(['defend']); FX.run(2);
    let up = 0; const N = 20 * 60;
    for (let i = 0; i < N; i++) { if (i % 15 === 0) { h.inv = 0; hurtHero(h, 30, { x: h.x + 40, y: h.y }); } if (i % 40 === 0) { h.inv = 0; hurtHero(h, 10, { x: h.x + 60, y: h.y, proj: true }); } menuGuard = 0; __game.tick(); if (h.blocking) up++; }
    const held = { upShare: +(up / N).toFixed(3), hpLost: Math.round(hp0 - h.hp) };
    // release, then raise again immediately
    HOLD.keys = new Set(); FX.run(1); const down = !!h.blocking; HOLD.keys = new Set(['defend']); FX.run(1); const again = h.blocking;
    // side and back hits still land
    h.inv = 0; const hpS = h.hp; hurtHero(h, 20, { x: h.x - 40, y: h.y }); const back = Math.round(hpS - h.hp);
    // an unblockable charge passes once but the shield stays up
    h.inv = 0; FX.run(30); const hpU = h.hp; h.inv = 0; hurtHero(h, 20, { x: h.x + 40, y: h.y, breakBlock: true }); FX.run(40); const unbl = { dmg: Math.round(hpU - h.hp), stillUp: h.blocking };
    const pip = heroMoves(h).find(m => m.lab === 'BLK');
    HOLD.keys = new Set();
    return { id, held, down, again, back, unbl, pip: pip ? { cd: pip.cd(), lit: !!pip.act() } : null, timers: ['stam', 'stamT', 'blockBroken'].filter(k => h[k] !== undefined && h[k] !== 0) };
  }));
  for (const c of C) {
    chk(`${c.id}: shield stays up for 20s of held Defend under repeated front hits and missiles, taking no damage`, c.held, g => g.upShare >= 0.99 && g.hpLost === 0);
    chk(`${c.id}: released, then raised again on the very next frame`, [c.down, c.again], [false, true]);
    chk(`${c.id}: hits from behind still land`, c.back, v => v > 0);
    chk(`${c.id}: an unblockable charge hurts once, the shield stays up (no guard break)`, c.unbl, g => g.dmg > 0 && g.stillUp);
    chk(`${c.id}: HUD shield icon has no cooldown and lights while held; no stamina/break timers`, [c.pip, c.timers], [{ cd: 0, lit: true }, []]);
  }
  chk('no page errors', logs, []);
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail ? 1 : 0);
})();
