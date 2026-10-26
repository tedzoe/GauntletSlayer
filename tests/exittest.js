// Every floor ends at an exit (David, Oct 2026: "after beating certain end stages, enemies drop loot but the end screen comes up and
// does not allow you to pick up everything ... each level that ends should have an exit door").
// For every campaign boss floor (the final throne included), an Extended Realm area-boss floor, a campaign arena floor and the Daily
// Arena: the kill opens an exit (with its flourish) that is reachable on foot and clear of the loot, the floor does not end while the
// heroes stay off it, all the loot dropped on the kill can be picked up, and walking onto the exit ends the floor. A hero who stands on
// the exit tile when it opens, or rushes onto it in its first second, is held until stepping off. Co-op keeps the 5 s countdown for one hero on the exit; a party wipe after
// the kill still ends in defeat.
const ENV = require('./env');
const puppeteer = require('puppeteer-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await ENV.ready;
  const b = await puppeteer.launch({ executablePath: ENV.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage(); await p.setViewport({ width: 1152, height: 648 });
  const logs = []; p.on('pageerror', e => logs.push('pageerror: ' + e.message));
  await p.goto(ENV.BASE + 'index.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await sleep(800);
  let pass = 0, fail = 0; const chk = (name, got, want) => { const okk = typeof want === 'function' ? want(got) : JSON.stringify(got) === JSON.stringify(want); okk ? pass++ : fail++; console.log((okk ? 'PASS ' : 'FAIL ') + name + '  ' + JSON.stringify(got).slice(0, 4000)); };
  await p.evaluate(() => {
    const saved = Input.read; Input.read = dev => { const r = saved.call(Input, dev); r.mx = 0; r.my = 0; r.aim = false; r.down = {}; r.pressed = {}; return r; };   // idle pads
    window.XT = {
      party(n) { const S = __game.SEL; S.slots = []; for (let k = 0; k < n; k++) S.slots.push({ dev: k ? 'pad' + k : 'kb1', idx: k, ready: true }); __game.startParty(); },
      run(s) { for (let i = 0; i < Math.round(s * 60); i++) { menuGuard = 0; if (__game.scene !== 'game') return false; for (const h of G.heroes) { if (!h.dead) h.hp = h.maxHp; } G.foes = G.foes.filter(f => f.type === 'boss' || f.dying !== undefined); __game.tick(); } return __game.scene === 'game'; },
      reach(i) { const m = G.map, R = new Uint8Array(m.w * m.h), h = G.heroes.find(x => !x.dead), q = [Math.floor(h.y / T) * m.w + Math.floor(h.x / T)]; R[q[0]] = 1;
        for (let k = 0; k < q.length; k++) { const j = q[k], x = j % m.w, y = (j / m.w) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = (y + dy) * m.w + x + dx; const tt = tileAt(x + dx, y + dy); if (!R[n] && (tt === TL.GATE || !blocksWalk(tt, false))) {   // keyed gates open with the floor's keys (finishtest)
 R[n] = 1; q.push(n); } } } return !!R[i]; },
      // kill the floor's boss next to the hero, then check the exit and the loot
      bossKill() { const b = G.boss || G.foes.find(f => f.type === 'boss'); if (!b) return { err: 'no boss' }; const h = G.heroes[0];
        for (const f of G.foes) if (f !== b) f.dead = true; G.foes = [b]; h.x = b.x - 70; h.y = b.y; if (collide(h.x, h.y, 10)) { h.x = b.x; h.y = b.y + 70; } if (collide(h.x, h.y, 10)) { h.x = b.x + 70; h.y = b.y; }
        const fall = { x: b.x, y: b.y }; hitFoe(b, 1e9, { src: h, x: h.x, y: h.y, tier: 3 }); let t = 0; while (!G.exitOpen && t < 12) { XT.run(0.1); t += 0.1; }
        return XT.after(fall); },
      after(fall) { const m = G.map, h = G.heroes[0], ex = m.exit; if (!G.exitOpen || !ex) return { err: 'exit not open' };
        const loot = G.pickups.filter(it => !it.dead && ['gold', 'feast', 'potion', 'ration', 'shard', 'cache'].includes(it.kind)), nLoot = loot.length;
        const exitTile = tileAt(Math.floor(ex.x / T), Math.floor(ex.y / T)) === TL.EXIT, reach = XT.reach(Math.floor(ex.y / T) * m.w + Math.floor(ex.x / T));
        const lootOnExit = loot.filter(it => tileAt(Math.floor(it.x / T), Math.floor(it.y / T)) === TL.EXIT).length, flourish = !!G.exitFx;
        const stays = XT.run(4);   // idle: nothing ends on its own
        let got = 0; for (const it of loot) { if (it.dead || !G.pickups.includes(it)) { got++; continue; } h.potions = 0; h.x = it.x; h.y = it.y; h.vx = h.vy = 0; XT.run(0.3);   // an empty potion belt: a full one leaves potions on the floor by design
        if (it.dead || !G.pickups.includes(it)) got++; if (__game.scene !== 'game') break; }
        const stillGame = __game.scene === 'game';
        h.x = ex.x; h.y = ex.y; let t = 0; while (__game.scene === 'game' && t < 3) { XT.run(0.1); t += 0.1; }
        const missed = loot.filter(it => !(it.dead || !G.pickups.includes(it))).map(it => [it.kind, it.x | 0, it.y | 0, tileAt(Math.floor(it.x / T), Math.floor(it.y / T))]).slice(0, 4);
        return { missed, exitTile, reach, dist: fall ? +(hyp(ex.x - fall.x, ex.y - fall.y) / T).toFixed(1) : null, flourish, lootOnExit, stays, nLoot, got, stillGame, endsOnExit: __game.scene !== 'game', endT: +t.toFixed(1) }; },
    };
  });
  const good = (r, needLoot = true) => !r.err && r.exitTile && r.reach && r.flourish && r.lootOnExit === 0 && r.stays && (!needLoot || r.nLoot >= 3) && r.got === r.nLoot && r.stillGame && r.endsOnExit && (r.dist === null || r.dist >= 4);
  // 1. every campaign boss floor
  const floors = await p.evaluate(() => { const o = []; WORLDS.forEach((w, wi) => w.floors.forEach((f, fi) => { if (f.boss) o.push([wi, fi, w.id + ':' + f.boss]); })); return o; });
  for (const [wi, fi, lab] of floors) {
    const r = await p.evaluate((wi, fi) => { XT.party(1); beginRun(); startCampaignFloor(wi, fi); __game.scene = 'game'; return XT.bossKill(); }, wi, fi);
    chk(`boss floor ${lab}: the kill opens a reachable exit clear of the loot, nothing ends until the hero walks in, all loot collectible`, r, good);
  }
  // 2. an Extended Realm area-boss floor
  const xr = await p.evaluate(() => { const out = []; SAVE.settings.extendedRealms = true; for (let n = 19; n <= 48; n++) { if (((n - 1) % 6) + 1 !== XAREA_RULES.bossFloor) continue; XT.party(1); beginRun(); startEndlessFloor(n); __game.scene = 'game'; if (G.boss || G.foes.some(f => f.type === 'boss')) { const r = XT.bossKill(); r.n = n; out.push(r); } } return out; });
  chk('Extended Realm area bosses (every realm): same exit rule', xr, a => a.length >= 5 && a.every(r => good(r))); await p.evaluate(() => { SAVE.settings.extendedRealms = undefined; });
  // 3. a campaign arena floor: clearing the waves opens the exit with its flourish; nothing ends on its own
  const ar = await p.evaluate(() => { let wf = null; WORLDS.forEach((w, wi) => w.floors.forEach((f, fi) => { if (f.arena && !wf) wf = [wi, fi]; })); if (!wf) return { err: 'no arena floor' }; XT.party(1); beginRun(); startCampaignFloor(wf[0], wf[1]); __game.scene = 'game'; G.foes = []; arenaDone(); return XT.after(null); });
  chk('campaign arena floor: cleared waves open the exit, the floor waits for the heroes', ar, r => good(r, false));
  // 4. the Daily Arena (the Pit): no more auto-ending 2.5 s after the last wave
  const da = await p.evaluate(() => { XT.party(1); beginRun(); startArena(); __game.scene = 'game'; G.foes = []; const c = G.heroes[0]; arenaDone(); return XT.after(null); });
  chk('Daily Arena: the Pit opens an exit instead of ending on the last kill', da, r => good(r, false));
  // 5. a hero already standing on the exit tile when it opens is held until stepping off
  const hold = await p.evaluate(() => { XT.party(1); beginRun(); startCampaignFloor(0, WORLDS[0].floors.findIndex(f => f.boss)); __game.scene = 'game'; const h = G.heroes[0], b = G.boss;
    G.foes = []; h.x = b.x; h.y = b.y + 200; if (collide(h.x, h.y, 10)) h.y = b.y - 200; const ex = openExitPortal(h.x, h.y); h.x = ex.x; h.y = ex.y; h.exitHold = true;
    const held = XT.run(2); h.x = ex.x + 3 * T; XT.run(0.2); h.x = ex.x; let t = 0; while (__game.scene === 'game' && t < 3) { XT.run(0.1); t += 0.1; } return { held, endsAfterStepping: __game.scene !== 'game' }; });
  chk('a hero on the exit as it opens is held until stepping off and back on', hold, { held: true, endsAfterStepping: true });
  // 5b. a hero still charging from the kill who runs onto the fresh exit within its first second is held too
  const rush = await p.evaluate(() => { XT.party(1); beginRun(); startCampaignFloor(0, WORLDS[0].floors.findIndex(f => f.boss)); __game.scene = 'game'; const h = G.heroes[0], b = G.boss;
    G.foes = [b]; hitFoe(b, 1e9, { src: h, x: h.x, y: h.y, tier: 3 }); let t = 0; while (!G.exitOpen && t < 12) { XT.run(1 / 60); t += 1 / 60; }
    const ex = G.map.exit, d0 = +(hyp(ex.x - h.x, ex.y - h.y) / T).toFixed(1); XT.run(0.3); h.x = ex.x; h.y = ex.y; const held = XT.run(2.5); h.x = ex.x + 3 * T; XT.run(0.2); h.x = ex.x; let t2 = 0; while (__game.scene === 'game' && t2 < 3) { XT.run(0.1); t2 += 0.1; }
    return { heroGapTiles: d0, held, endsAfterStepping: __game.scene !== 'game' }; });
  chk('the exit opens away from the hero, and a hero rushing onto it in its first second is held until stepping off', rush, r => r.heroGapTiles >= 4 && r.held && r.endsAfterStepping);
  // 6. co-op: one hero on the exit starts the 5 s countdown (existing rule); a wipe after the kill is still a defeat
  const coop = await p.evaluate(() => { XT.party(2); beginRun(); startCampaignFloor(0, WORLDS[0].floors.findIndex(f => f.boss)); __game.scene = 'game'; const [a, c] = G.heroes, b = G.boss;
    G.foes = [b]; hitFoe(b, 1e9, { src: a, x: a.x, y: a.y, tier: 3 }); let t = 0; while (!G.exitOpen && t < 12) { XT.run(0.1); t += 0.1; }
    XT.run(1.5); const ex = G.map.exit; a.x = ex.x; a.y = ex.y; c.x = ex.x + 6 * T; c.y = ex.y; if (collide(c.x, c.y, 10)) { c.x = ex.x - 6 * T; } if (collide(c.x, c.y, 10)) { c.x = ex.x; c.y = ex.y + 6 * T; }
    XT.run(0.2); const count = +G.exitT.toFixed(1), at3 = XT.run(3); let t2 = 0; while (__game.scene === 'game' && t2 < 4) { XT.run(0.1); t2 += 0.1; } return { count, at3, ended: __game.scene !== 'game' }; });
  chk('co-op: one hero on the exit starts the 5 s countdown, then the floor ends', coop, r => r.count > 4 && r.count <= 5 && r.at3 && r.ended);
  const wipe = await p.evaluate(() => { XT.party(1); beginRun(); startCampaignFloor(0, WORLDS[0].floors.findIndex(f => f.boss)); __game.scene = 'game'; const h = G.heroes[0], b = G.boss;
    G.foes = [b]; hitFoe(b, 1e9, { src: h, x: h.x, y: h.y, tier: 3 }); let t = 0; while (!G.exitOpen && t < 12) { XT.run(0.1); t += 0.1; }
    G.rez = 0; h.potions = 0; SAVE.revive = 0; h.hp = 0; h.dead = true; for (let i = 0; i < 60 * 5 && __game.scene === 'game'; i++) { menuGuard = 0; __game.tick(); } return { exitOpen: G.exitOpen, scene: __game.scene, title: __game.RESULTS && __game.RESULTS.title }; });
  chk('a party wipe after the kill still ends the run in defeat (no free exit)', wipe, r => r.scene !== 'game' && !/cleared|conquered|broken/i.test(r.title || ''));
  chk('no page errors', logs, []);
  console.log(`\nexittest: ${pass} passed, ${fail} failed`); await b.close(); process.exit(fail ? 1 : 0);
})();
