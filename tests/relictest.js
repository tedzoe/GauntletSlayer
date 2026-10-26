// Relics vs the Neoseeker FAQ Relics section (the seven David's spec doesn't define): cooldowns, durations, damage and effects per rank.
const ENV = require('./env');
const puppeteer = require('puppeteer-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await ENV.ready;
  const b = await puppeteer.launch({ executablePath: ENV.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage(); await p.setViewport({ width: 1152, height: 648 });
  const logs = []; p.on('pageerror', e => logs.push('pageerror: ' + e.message));
  await p.goto(ENV.BASE + 'index.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await sleep(800);
  let pass = 0, fail = 0; const chk = (name, got, want) => { const okk = typeof want === 'function' ? want(got) : JSON.stringify(got) === JSON.stringify(want); okk ? pass++ : fail++; console.log((okk ? 'PASS ' : 'FAIL ') + name + '  ' + JSON.stringify(got).slice(0, 500)); };
  const R = await p.evaluate(() => {
    const run = s => { for (let i = 0; i < Math.round(s * 60); i++) { menuGuard = 0; __game.tick(); } };
    const room = wall => { const rows = []; for (let y = 0; y < 22; y++) { let r = y === 0 || y === 21 ? '#'.repeat(60) : '#' + '.'.repeat(58) + '#'; if (wall && y > 0 && y < 21) r = r.slice(0, 12) + '#' + r.slice(13); rows.push(r); }
      resetLists(); G.mode = 'campaign'; G.scale = { hp: 1, dmg: 1, spd: 1, spawn: 1 }; G.mods = {}; G.goldMul = 1; G.worldTier = 0; G.map = parseMap(rows, WORLDS[0].theme); G.map.arenaSet = new Set(); G.map.noLock = true;
      G.floorName = 'Test'; G.worldName = 'Test'; renderMapCanvas(); G.stats = newStats(); updateCamera(true); computeFlow(); G.exitOpen = false; };
    const setup = (id, rank, wall) => { const S = __game.SEL; S.slots = [{ dev: 'kb1', idx: HEROES.findIndex(h => h.id === 'brannoc'), ready: true }]; __game.startParty(); room(wall); const h = G.heroes[0];
      h.x = 6 * 32; h.y = 11 * 32; h.fa = 0; h.cd = {}; h.relic = { id, rank }; h.potions = 9; h.shardMeter = 100; h.inv = 0; h.mods.dmg = 1; return h; };
    const foe = (type, dx, dy = 0) => { const h = G.heroes[0]; const f = mkFoe(type, h.x + dx, h.y + dy, { awake: true }); f.spd = 0; f.atkT = 999; f.awake = true; return f; };
    const out = { cd: {}, time: {} };
    for (const id of ['squall', 'quill', 'ember', 'idol', 'rift', 'shade', 'lyre']) out.cd[id] = [1, 2, 3].map(rk => relicCd(id, rk));
    // Tempest Locket: moves forward slowly through walls, 14 / 22 per hit, kills skeletons and ghosts outright, throws small foes, lasts 3.5s / 20s at Rank III
    { const h = setup('squall', 1, true); const sh = foe('shambler', 110); sh.hp = sh.maxhp = 999; const sk = foe('bonesoldier', 110, 50); const gh = foe('wraith', 110, -50); const hv = foe('hulk', 230); hv.hp = hv.maxhp = 9999;
      useRelic(h); const wh = G.hazards.find(z => z.kind === 'whirl'); const x0 = wh.x; run(1); const moved = Math.round(wh.x - x0); run(3);
      out.squall = { moved, life: wh.life !== undefined, hit: 999 - sh.hp, skel: sk.hp <= 0, ghost: gh.hp <= 0, heavyHit: hv.hp < 9999, wall: true, gone: !G.hazards.includes(wh) };
      const h2 = setup('squall', 2); const s2 = foe('shambler', 60); s2.hp = s2.maxhp = 999; useRelic(h2); run(0.5); out.squall2 = 999 - s2.hp;
      const h3 = setup('squall', 3); useRelic(h3); const w3 = G.hazards.find(z => z.kind === 'whirl'); out.squall3life = w3.life; }
    // Golden Feather: food & potions in reach become gold
    { const h = setup('quill', 1); G.pickups.push({ kind: 'ration', x: h.x + 150, y: h.y }, { kind: 'potion', x: h.x + 200, y: h.y }); useRelic(h); out.quill = G.pickups.filter(i => i.kind === 'gold').length; }
    // Firetrail Boots: 2s burst, fire trail lasts 5s
    { const h = setup('ember', 1); useRelic(h); out.ember = { burst: h.buff.ember }; run(0.3); const fz = G.hazards.find(z => z.kind === 'fire'); out.ember.trail = fz && Math.round(fz.life * 10) / 10; }
    // Demonic Effigy: gargoyle 100 HP for 30s, lethal 50-damage fireballs, 17 in 30s (25 at Rank II), 26 to summoning stones
    { for (const rk of [1, 2]) { const h = setup('idol', rk); useRelic(h); const g = G.allies.find(a => a.kind === 'gargoyle'); out['idol' + rk] = { hp: g.hp, life: g.life, dmg: g.dmg, lethal: g.lethal, perThirty: Math.round(30 / g.rate), stone: g.spawnerDmg }; }
      const h = setup('idol', 1); useRelic(h); const big = foe('hulk', 200); big.hp = big.maxhp = 9999; const small = foe('shambler', 200, 40); small.hp = small.maxhp = 999; G.foes = G.foes.filter(f => f === small); run(4); out.idolKillsSmall = small.hp <= 0; }
    // Chaos Amulet: needs a clear line, 2s mark, 154 to the target and 14 around it; Rank II invulnerable until the jump
    { const h = setup('rift', 2); const t = foe('hulk', 200); t.hp = t.maxhp = 9999; const n = foe('hulk', 240, 30); n.hp = n.maxhp = 9999; useRelic(h); const inv = h.inv, tg = t.marked > 0 ? t : n, ot = tg === t ? n : t; run(1.5); const notYet = Math.abs(h.x - tg.x) > 50; run(0.8);   // the mark picks a random foe in sight
      out.rift = { inv: +inv.toFixed(1), notYet, landed: hyp(h.x - tg.x, h.y - tg.y) < 60, target: 9999 - tg.hp, near: 9999 - ot.hp };
      const h2 = setup('rift', 1, true); const behind = foe('shambler', 300); useRelic(h2); out.riftLos = G.hazards.some(z => z.follow === behind); }
    // Ghost Orb 6 / 12 / 12s; Siren's Lute 10 / 15 / 10s
    { out.shade = [1, 2, 3].map(rk => { const h = setup('shade', rk); useRelic(h); return h.invisT; }); }
    { out.lyre = [1, 2, 3].map(rk => { const h = setup('lyre', rk); const f = foe('shambler', 80); useRelic(h); return f.charm; }); }
    return out; });
  console.log(JSON.stringify(R));
  chk('cooldowns match the FAQ (Firetrail Rank III is an estimate)', R.cd, { squall: [40, 40, 35], quill: [20, 20, 10], ember: [60, 50, 40], idol: [80, 80, 60], rift: [30, 30, 24], shade: [40, 40, 30], lyre: [20, 20, 10] });
  chk('Tempest Locket: drifts forward slowly through a wall, 14 per hit, kills skeletons and ghosts, hits heavies, ends after 3.5s', R.squall, g => g.moved > 40 && g.moved < 70 && g.hit >= 14 && g.hit % 14 === 0 && g.skel && g.ghost && g.heavyHit && g.gone);
  chk('Tempest Locket Rank II hits for 22; Rank III lasts 20s', [R.squall2, R.squall3life], g => g[0] >= 22 && g[0] % 22 === 0 && g[1] === 20);
  chk('Golden Feather turns food and potions into gold', R.quill, 2);
  chk('Firetrail Boots: 2s burst, 5s fire trail', R.ember, { burst: 2, trail: 5 });
  chk('Demonic Effigy: 100 HP, 30s, 50 lethal, 17 / 25 fireballs in 30s, 26 to stones', [R.idol1, R.idol2], [{ hp: 100, life: 30, dmg: 50, lethal: true, perThirty: 17, stone: 26 }, { hp: 100, life: 30, dmg: 50, lethal: true, perThirty: 25, stone: 26 }]);
  chk('Demonic Effigy fireballs kill a small foe in one hit', R.idolKillsSmall, true);
  chk('Chaos Amulet: invulnerable through the 2s mark, then 154 to the target, 14 nearby', R.rift, { inv: 2.1, notYet: true, landed: true, target: 154, near: 14 });
  chk('Chaos Amulet needs a clear line of sight', R.riftLos, false);
  chk('Ghost Orb 6 / 12 / 12s', R.shade, [6, 12, 12]);
  chk('Siren\'s Lute 10 / 15 / 10s', R.lyre, [10, 15, 10]);
  chk('no page errors', logs, []);
  console.log(`\nrelictest: ${pass} passed, ${fail} failed`); await b.close(); process.exit(fail ? 1 : 0);
})();
