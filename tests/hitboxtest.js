// Hurtboxes: every foe type and boss is hit anywhere on its drawn body. For each one: arrows aimed at the head, chest and feet hit
// (normal speed and a very fast shot, no tunnelling), a melee arc from above reaches the head, and a small blast on the head lands.
// Also reports how many of those the old ground-circle hurtbox missed.
const ENV = require('./env');
const puppeteer = require('puppeteer-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await ENV.ready;
  const b = await puppeteer.launch({ executablePath: ENV.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage(); await p.setViewport({ width: 1152, height: 648 });
  const logs = []; p.on('pageerror', e => logs.push('pageerror: ' + e.message));
  await p.goto(ENV.BASE + 'index.html'); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.waitForFunction(() => Object.values(FOE_SPRITE).every(k => !SPR.foes.man.anims[k + '_idle'] || foeSprReady(k)), { timeout: 15000 }); await sleep(300);
  let pass = 0, fail = 0; const chk = (name, got, want) => { const okk = typeof want === 'function' ? want(got) : JSON.stringify(got) === JSON.stringify(want); okk ? pass++ : fail++; console.log((okk ? 'PASS ' : 'FAIL ') + name + '  ' + JSON.stringify(got).slice(0, 600)); };
  const R = await p.evaluate(() => {
    const S = __game.SEL; S.slots = [{ dev: 'kb1', idx: 0, ready: true }]; __game.startParty();
    const room = () => { const rows = []; for (let y = 0; y < 30; y++) rows.push(y === 0 || y === 29 ? '#'.repeat(60) : '#' + '.'.repeat(58) + '#');
      resetLists(); G.mode = 'campaign'; G.scale = { hp: 1, dmg: 1, spd: 1, spawn: 1 }; G.mods = {}; G.goldMul = 1; G.worldTier = 0; G.map = parseMap(rows, WORLDS[0].theme); G.map.arenaSet = new Set(); G.stats = newStats(); computeFlow(); };
    const h = () => G.heroes[0];
    const make = (kind, boss) => { room(); const x = 30 * T, y = 16 * T; let f; if (boss) { f = spawnBoss(kind, x, y); f.invuln = false; f.state = f.kind === 'rootmaw' ? 'surface' : f.state; G.banner = null; } else { f = mkFoe(kind, x, y, { awake: true }); }
      if (!G.foes.includes(f)) G.foes.push(f); f.fa = 0; f.hp = f.maxhp = 1e7; f.barrier = 0; f.armorUp = 0; f.charm = 0; f.sub = false; f.invis = false; if (boss) { G.spawners = G.spawners.filter(s => !s.pylon); } return f; };   // pylons shield the Sovereign by design; drop them for the test
    const hpOf = f => f.hp;
    const fire = (f, y, spd) => { const hp0 = hpOf(f); G.shots = []; shoot({ team: 'hero', x: f.x - 320, y, vx: spd, vy: 0, dmg: 10, tier: 1, r: 4, life: 2, kind: 'arrow', owner: h(), knock: 0 }); for (let i = 0; i < 60 && G.shots.length; i++) updateShots(1 / 60); return hpOf(f) < hp0; };
    const types = Object.keys(FOES).filter(k => FOES[k] && k !== 'reaper'), bosses = Object.keys(BOSSES), out = [];
    // (Death, the reaper, cannot be harmed by design, so it is left out)
    for (const [kind, boss] of [...types.map(t => [t, false]), ...bosses.map(t => [t, true])]) {
      const f = make(kind, boss); const B = hurtBox(f), H = B.b - B.t, heads = B.t + 0.1 * H, chest = B.t + 0.45 * H, feet = f.y + Math.min(4, f.r * 0.5);
      const r = { kind, boss, h: Math.round(H), w: Math.round(B.r - B.l), r: f.r };
      r.head = fire(f, heads, 900); r.chest = fire(f, chest, 900); r.feet = fire(f, feet, 900); r.fastHead = fire(f, heads, 3000); r.fastFeet = fire(f, feet, 3000);
      // melee from above: a hero just over the head swings down (short 40px arc); the old circle math measured from the feet and missed
      { const hp0 = f.hp; areaHit(f.x, B.t - 20, 40, 10, { cone: Math.PI / 2, arc: 1.4, src: h(), team: 'hero' }); r.meleeHead = f.hp < hp0; }
      { const hp0 = f.hp; areaHit(f.x + 2, heads, 6, 10, { src: h(), team: 'hero' }); r.aoeHead = f.hp < hp0; }
      r.oldHeadMiss = hyp(0, f.y - heads) > f.r + 4;   // what the previous ground circle did with the head shot
      out.push(r); }
    return out;
  });
  const bad = R.filter(r => !(r.head && r.chest && r.feet && r.fastHead && r.fastFeet && r.meleeHead && r.aoeHead));
  console.log(`${R.length} foe types + bosses; old circle missed head shots on ${R.filter(r => r.oldHeadMiss).length}`);
  console.log('sample', JSON.stringify(R.slice(0, 4)));
  chk('every foe type and boss: head, chest and feet arrows hit (also at 3000 px/s); melee arc and blast reach the head', bad.map(r => r.kind), []);
  chk('every body box is taller than wide-ish and covers more than the ground circle', R.filter(r => !(r.h >= 2 * r.r)).map(r => [r.kind, r.h, r.r]), []);
  chk('no page errors', logs, []);
  console.log(`\nhitboxtest: ${pass} passed, ${fail} failed`); await b.close(); process.exit(fail ? 1 : 0);
})();
