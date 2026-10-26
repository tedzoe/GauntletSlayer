// Gate crossings bank gold like the exit (David, Oct 2026: "gold banks only when you cross an exit or gate").
const ENV = require('./env');
const puppeteer = require('puppeteer-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await ENV.ready;
  const b = await puppeteer.launch({ executablePath: ENV.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage(); await p.setViewport({ width: 1152, height: 648 });
  const logs = []; p.on('pageerror', e => logs.push('pageerror: ' + e.message));
  await p.goto(ENV.BASE + 'index.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await sleep(800);
  let pass = 0, fail = 0; const chk = (name, got, want) => { const okk = typeof want === 'function' ? want(got) : JSON.stringify(got) === JSON.stringify(want); okk ? pass++ : fail++; console.log((okk ? 'PASS ' : 'FAIL ') + name + ' -> ' + JSON.stringify(got)); };
  const r = await p.evaluate(() => {
    const out = {};
    const run = s => { updateCamera(true); for (let i = 0; i < Math.round(s * 60); i++) { menuGuard = 0; __game.tick(); } };
    const setup = ids => { const S = __game.SEL; S.slots = ids.map((id, i) => ({ dev: i ? 'pad' + (i - 1) : 'kb1', idx: HEROES.findIndex(h => h.id === id), ready: true })); __game.startParty(); };
    // a campaign stage with a key gate
    let wi = -1, fi = -1;
    for (let a = 0; a < WORLDS.length && wi < 0; a++) for (let c = 0; c < WORLDS[a].floors.length; c++) { const fl = WORLDS[a].floors[c]; if (MAPS[fl.map] && MAPS[fl.map].some(row => row.includes('='))) { wi = a; fi = c; break; } }
    out.floor = [wi, fi];
    setup(['brannoc', 'sela']); beginRun(); startCampaignFloor(wi, fi);
    const [t, g] = G.heroes; t.inv = g.inv = 999; for (const f of G.foes) f.hp = 0; G.pickups = G.pickups.filter(i => i.kind !== 'gold' && i.kind !== 'crown');
    const m = G.map, gi = [...m.gateTiles][0], gx = gi % m.w, gy = (gi / m.w) | 0;
    const bank = () => [bankOf('brannoc'), bankOf('sela')];
    const b0 = bank();
    // 1) opening a gate banks the carried gold, split per hero like the exit
    G.purse = 400; t.goldRun = 300; g.goldRun = 100; t.keys = 1; t.x = (gx - 1.5) * T; t.y = (gy + 0.5) * T; g.x = t.x; g.y = t.y + 40;
    updateCamera(true); const n0 = G.texts.length; tryGate(t, { gate: true, tx: gx, ty: gy });
    const b1 = bank(); out.open = { gained: [b1[0] - b0[0], b1[1] - b0[1]], bankedRun: G.bankedRun, secured: G.secured, how: G.lastGateBank && G.lastGateBank.how,
      popups: G.texts.slice(n0).filter(x => /banked/.test(x.s)).map(x => x.s), saved: JSON.parse(localStorage.getItem(SAVE_KEY)).banks.brannoc - b0[0] };
    // 2) walking through the opened gate with nothing new: no double bank
    const c0 = G.gateBanks; t.x = (gx + 0.5) * T; t.y = (gy + 0.5) * T; run(0.1); t.x = (gx - 2.5) * T; run(0.1);
    out.noDouble = { banks: G.gateBanks - c0, bank: bank().join() === b1.join() };
    // 3) new gold, then crossing the opened gate banks only the new amount (to whoever picked it up)
    G.purse += 50; g.goldRun = 50; g.x = (gx + 0.5) * T; g.y = (gy + 0.5) * T; run(0.1);
    const b2 = bank(); out.cross = { gained: [b2[0] - b1[0], b2[1] - b1[1]], how: G.lastGateBank.how, bankedRun: G.bankedRun };
    // 4) the crown's +500 is exit-only: crossing a gate with the crown banks just the carried gold
    g.x = (gx + 3.5) * T; run(0.1); t.crown = true; G.purse += 10; t.goldRun = 10; t.x = (gx + 0.5) * T; t.y = (gy + 0.5) * T; run(0.1);
    const b3 = bank(); out.crown = b3[0] + b3[1] - b2[0] - b2[1]; t.crown = false;
    // 5) dying after a gate keeps the gate-banked gold; only the unbanked part can drop
    const bankedBefore = G.bankedRun; G.purse += 100; t.goldRun = 100; const st = m.starts[0]; t.x = g.x = st.x; t.y = st.y; g.y = st.y + 30; run(0.05);
    out.dbg = [bankedBefore, G.purse, G.bankedRun, t.dead]; t.inv = 0; killHero(t); out.dbg.push(G.purse, t.dead); out.deathDrop = Math.round(bankedBefore + 100 - G.purse);
    g.inv = 0; killHero(g); G.rez = 0; defeat();
    out.afterDefeat = { purse: G.purse, bankedRun: G.bankedRun, bank: bank().join() === b3.join() };
    bankAndReturn(); out.afterReturn = bank().join() === b3.join();
    // 6) exit after a gate banks only the rest (gate gold + exit gold = everything carried)
    setup(['brannoc', 'sela']); beginRun(); startCampaignFloor(wi, fi);
    const [t2, g2] = G.heroes; const e0 = bank(); const m2 = G.map, gj = [...m2.gateTiles][0];
    G.purse = 200; t2.goldRun = 200; t2.keys = 1; tryGate(t2, { gate: true, tx: gj % m2.w, ty: (gj / m2.w) | 0 });
    G.purse += 120; g2.goldRun = 120; floorComplete();
    const e1 = bank(); out.exit = { total: e1[0] + e1[1] - e0[0] - e0[1], purse: Math.floor(G.purse), bankedRun: G.bankedRun };
    // 7) endless floors with gates also bank
    setup(['brannoc']); beginRun(); let n = 1; for (; n < 30; n++) { startEndlessFloor(n); if (G.map.gateTiles && G.map.gateTiles.size) break; }
    const k0 = bankOf('brannoc'), m3 = G.map, gk = [...m3.gateTiles][0]; G.purse = 77; G.heroes[0].goldRun = 77; G.heroes[0].keys = 1; tryGate(G.heroes[0], { gate: true, tx: gk % m3.w, ty: (gk / m3.w) | 0 });
    out.endless = { n, gained: bankOf('brannoc') - k0 };
    return out;
  });
  chk('a campaign stage with a gate exists', r.floor[0] >= 0, true);
  chk('opening a gate banks carried gold, split per hero like the exit', r.open.gained, [300, 100]);
  chk('gate bank updates bankedRun/secured and is saved', [r.open.bankedRun, r.open.secured, r.open.how, r.open.saved], [400, 400, 'open', 300]);
  chk('per-hero "+N banked" popups', r.open.popups, ['+300 banked', '+100 banked']);
  chk('walking through an opened gate with nothing new does not bank again', r.noDouble, { banks: 0, bank: true });
  chk('crossing an opened gate banks only the new gold, to the hero who carried it', [r.cross.gained, r.cross.how, r.cross.bankedRun], [[0, 50], 'cross', 450]);
  chk('crown +500 is exit-only (gate banks just the carried 10)', r.crown, 10);
  chk("death after a gate drops 20% of the unbanked gold only", [r.deathDrop, r.dbg], g => g[0] === 20);
  chk('defeat after a gate keeps the gate-banked gold', r.afterDefeat, { purse: 460, bankedRun: 460, bank: true });
  chk('returning to camp after defeat adds nothing twice', r.afterReturn, true);
  chk('exit after a gate banks the rest exactly once (bank gained = whole purse)', r.exit.total === r.exit.purse && r.exit.bankedRun === r.exit.purse, true);
  chk('endless floors bank at gates too', r.endless.gained, 77);
  chk('no page errors', logs, []);
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail ? 1 : 0);
})();
