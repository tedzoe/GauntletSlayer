// Masteries always show display text: the Mastery Tablet's "Track:" line, the unlock message, the tally's Masteries Unlocked
// and the results screen never show internal stat keys (fam_bones, boss_ossuary, flawless_w1...). Boss masteries unlock.
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
    const RAW = /\b(fam|boss|flawless|elem|death)_\w+|\b[a-z]+[A-Z]\w*\b/;   // snake keys or camelCase ids
    const texts = () => { const seen = []; const orig = ctx.fillText.bind(ctx); ctx.fillText = (t, ...a) => { seen.push(String(t)); return orig(t, ...a); }; __game.draw(); ctx.fillText = orig; return seen; };
    const setup = id => { const S = __game.SEL; S.slots = [{ dev: 'kb1', idx: HEROES.findIndex(h => h.id === id), ready: true }]; __game.startParty(); };
    const out = { tracks: [], menus: {} };
    for (const hd of HEROES) for (const ms of masteriesFor(hd.id)) { const t = masteryTrack(ms, hd.id); if (RAW.test(t)) out.tracks.push(`${hd.id}/${ms.stat}: ${t}`); }
    // the Mastery Tablet menu, for every hero: every item's label and description
    for (const hd of HEROES) { setup(hd.id); startHub(); const h = G.heroes[0]; MENU = null; openStation(G.stations.find(s => s.id === 'T'), h);
      const items = MENU && (MENU.items || (MENU.build && MENU.build())) || []; out.menus[hd.id] = { n: items.length, bad: items.map(i => (i.label || '') + ' | ' + (i.desc || '')).filter(s => RAW.test(s) || /undefined/.test(s)) };
      out.menus[hd.id].sample = items.find(i => /Bone Breaker/.test(i.label)); out.menus[hd.id].sample = out.menus[hd.id].sample && out.menus[hd.id].sample.desc; MENU = null; }
    // boss kill unlocks the boss mastery; tally + results list display names with no stray numeral on single-tier feats
    setup('brannoc'); beginRun(); startCampaignFloor(0, 3); const h = G.heroes[0]; h.inv = 1e9; const bo = G.boss; SAVE.mastery.brannoc = {};
    bossFinish(bo); out.bossStat = SAVE.mastery.brannoc.boss_ossuary || 0; out.newM = G.newMasteries.slice();
    floorComplete(); const TL = RESULTS.tally; out.tallyM = TL ? TL.masteries.slice() : null; if (TL) TL.t = 99; const T1 = texts(); out.tallyShown = T1.filter(s => /★/.test(s));
    out.rawOnScreen = T1.filter(s => RAW.test(s));
    return out;
  });
  const RAW = /\b(fam|boss|flawless|elem|death)_\w+|\b[a-z]+[A-Z]\w*\b/;
  console.log(JSON.stringify(R).slice(0, 1500));
  chk('every mastery has a display track (no internal keys), for every hero', R.tracks, []);
  for (const [id, m] of Object.entries(R.menus)) chk(`${id}: Mastery Tablet lists masteries with no raw keys`, m, g => g.n >= 10 && g.bad.length === 0);
  chk('Bone Breaker reads "Track: skeletons slain"', R.menus.brannoc.sample, s => /^Track: skeletons slain\./.test(s));
  chk('killing the Ossuary King unlocks its mastery (boss_ossuary)', R.bossStat, 1);
  chk('unlocked list uses display names, no numeral on single-tier feats', R.newM, g => g.includes('Sir Theo: The Rib-King Unmade') && g.every(s => !RAW.test(s)));
  chk("tally's Masteries Unlocked shows the display name", [R.tallyM, R.tallyShown], g => g[0] && g[0].includes('Sir Theo: The Rib-King Unmade') && g[1].some(s => /Rib-King Unmade/.test(s)));
  chk('no raw keys anywhere on the tally screen', R.rawOnScreen, []);
  chk('no page errors', logs, []);
  console.log(`\nmasterytest: ${pass} passed, ${fail} failed`); await b.close(); process.exit(fail ? 1 : 0);
})();
