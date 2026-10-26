// Vesper Linda vs the Slayer Necromancer guide (docs/slayer_necromancer_reference_from_david.md) and the FAQ Lilith section: slash, hammer, Ghostwalk, Soul Power, summons, Dominate, Hungering Heart, HUD meter.
const ENV = require('./env');
const puppeteer = require('puppeteer-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await ENV.ready;
  const b = await puppeteer.launch({ executablePath: ENV.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage(); await p.setViewport({ width: 1152, height: 648 });
  const logs = []; p.on('pageerror', e => logs.push('pageerror: ' + e.message));
  await p.goto(ENV.BASE + 'index.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await sleep(800);
  let pass = 0, fail = 0; const chk = (name, got, want) => { const okk = typeof want === 'function' ? want(got) : JSON.stringify(got) === JSON.stringify(want); okk ? pass++ : fail++; console.log((okk ? 'PASS ' : 'FAIL ') + name + (okk ? '' : '  got ' + JSON.stringify(got).slice(0, 400))); };
  const R = await p.evaluate(() => {
    const hold = new Set(); let prev = new Set(), mv = [0, 0];
    const oRead = Input.read, oCommit = Input.commit;
    Input.read = (dev, s) => { if (dev !== 'kb1') return oRead(dev, s); const st = { mx: mv[0], my: mv[1], ax: 0, ay: 0, aim: false, aimFire: false, dev, down: {}, pressed: {}, released: {} }; for (const k of hold) { st.down[k] = true; if (!prev.has(k)) st.pressed[k] = true; } for (const k of prev) if (!hold.has(k)) st.released[k] = true; return st; };
    Input.commit = d => { prev = new Set(hold); oCommit(d); };
    const run = s => { for (let i = 0; i < Math.round(s * 60); i++) { menuGuard = 0; __game.tick(); } };
    const room = () => { const rows = []; for (let y = 0; y < 22; y++) rows.push(y === 0 || y === 21 ? '#'.repeat(40) : '#' + '.'.repeat(38) + '#');
      resetLists(); G.mode = 'campaign'; G.scale = { hp: 1, dmg: 1, spd: 1, spawn: 1 }; G.mods = {}; G.goldMul = 1; G.worldTier = 0; G.map = parseMap(rows, WORLDS[0].theme); G.map.arenaSet = new Set(); renderMapCanvas(); computeFlow(); G.exitOpen = false; };
    const setup = (x = 8) => { const S = __game.SEL; S.slots = [{ dev: 'kb1', idx: HEROES.findIndex(h => h.id === 'vesper'), ready: true }]; __game.startParty(); room(); if (!G.stats) G.stats = new Proxy({}, { get: (t, k) => t[k] ?? 0 }); const h = G.heroes[0]; h.x = x * 32; h.y = 11 * 32; h.fa = 0; h.cd = {}; h.potions = 0; hold.clear(); mv = [0, 0]; run(0.3); h.fa = 0; return h; };
    const foe = (type, dx, dy = 0, o = {}) => { const h = G.heroes[0]; const f = mkFoe(type, h.x + dx, h.y + dy, { awake: true }); f.room = -1; f.atkT = 99; f.spd = 0; Object.assign(f, o); return f; };
    const out = {};
    const tap = (k, n = 1) => { hold.add(k); run(n / 60); hold.delete(k); run(1 / 60); };
    // 1. Skeleton Slash: auto-ranges to the nearest foe, no minimum range, rooted while swinging
    { const h = setup(); const f = foe('shambler', 100, 0); f.hp = f.maxhp = 999; tap('primary'); const far = { dist: h.lastSlashDist, hit: f.hp < 999 }; const x0 = h.x; mv = [1, 0]; run(0.1); const rooted = Math.abs(h.x - x0) < 1; mv = [0, 0]; run(0.5);
      f.x = h.x + 22; f.hp = 999; tap('primary'); out.slash = { far, near: f.hp < 999, rooted }; run(0.5); }
    // 2. Skeleton Smash: minimum range, mid-range auto-correct, Lethal 46, hammer entity foes target, front zone staggers small foes, ~1/s, rooted (Ghostwalk cancels)
    { const h = setup(); const near = foe('shambler', 40, 0); near.hp = near.maxhp = 999; tap('secondary'); const minR = h.lastSmashDist; const nearStag = near.stag > 0.3; const hm = h.lastHammer; const tgt = pickTarget(near)[0] === hm; run(1.2);
      const big = foe('shambler', 150, 30); big.heavy = false; big.hp = big.maxhp = 5000; h.cd = {}; near.hp = 0; near.dead = true; h.fa = Math.atan2(30, 150); hold.add('secondary'); run(1 / 60); hold.delete('secondary'); const mid = h.lastSmashDist; const rootedAfter = h.vRoot > 0; run(1 / 60); hold.add('defend'); run(1 / 60); hold.delete('defend'); const cancel = !!(h.dash && h.dash.ghost) && h.vRoot === 0; run(0.6);
      out.smash = { minR, nearStag, hammer: !!hm && hm.kind === 'hammer', foesTargetIt: tgt, mid, lethal: big.hp <= 0, rootedAfter, cancel, cd: SPEC.vesper.smashCd }; }
    // 3. Ghostwalk: no cooldown, invincible, through foes (slow 5, 4 dmg, flat souls, same for a heavy), facing unchanged, landing delay
    { const h = setup(); const a = foe('shambler', 60, 0), b = foe('barrow', 100, 0); a.hp = a.maxhp = 999; b.hp = b.maxhp = 999; h.souls = 0; h.fa = Math.PI / 2; mv = [1, 0]; const fa0 = h.fa; tap('defend'); let inv = true, faSame = true, n = 0;
      while (h.dash && n++ < 40) { if (h.inv <= 0) inv = false; if (Math.abs(h.fa - fa0) > 0.01) faSame = false; run(1 / 60); }
      const landDelay = h.ghostEnd > 0; mv = [0, 0]; run(0.3); const x1 = h.x; tap('defend'); const again = !!(h.dash && h.dash.ghost); run(0.5);
      out.ghost = { inv, faSame, through: x1 > b.x, slowA: a.slowT > 3, slowB: b.slowT > 3, dmg: 999 - a.hp, souls: h.souls, landDelay, again, cd: SPEC.vesper.ghostCd }; }
    // 4. ability cancels Ghostwalk mid-flight (emergency brake)
    { const h = setup(); h.souls = 20; h.weapon = 'base'; hold.add('defend'); run(1 / 60); hold.delete('defend'); run(1 / 60); const was = !!h.dash; tap('ability'); out.brake = { was, stopped: !h.dash, summoned: (h.lastSummon || {}).bars === 2 }; run(0.3); }
    // 5. Soul Power: size-weighted kills, last hit on spawners, empties on use, resets on floor change and revive
    { const h = setup(); h.souls = 0; const g = foe('shambler', 300, 0), hv = foe('barrow', 300, 40), el = foe('shambler', 300, -40); el.elite = true; killFoe(g, h, {}); const s1 = h.souls; killFoe(hv, h, {}); const s2 = h.souls - s1; killFoe(el, h, {}); const s3 = h.souls - s1 - s2;
      h.souls = 0; const sp = mkSpawner(h.x + 200, h.y, 1, ['shambler'], 'crypt'); sp.hp = 1; G.heroes.length; hitSpawner(sp, 50, h, { spawnerHits: 5 }); const spw = h.souls;
      h.souls = 70; placeHeroes(); const floorReset = h.souls === 0; h.souls = 50; h.dead = true; reviveHero(h, true); const reviveReset = h.souls === 0;
      out.souls = { grunt: s1, heavy: s2, elite: s3, spawner: spw, floorReset, reviveReset }; }
    // 6. Bloated-mummy blast kills count for her
    { const h = setup(); h.souls = 0; const bl = foe('bloater', 200, 0), v = foe('shambler', 215, 0); v.hp = v.maxhp = 1; killFoe(bl, h, {}); run(DEATH_FX.delay + 0.3); out.bloater = { victimDead: v.hp <= 0, souls: h.souls }; }   // the burst waits DEATH_FX.delay
    // 7. summons by souls and FULL: soldiers in front, shades x2 (20 at full), archers behind (20s, fragile, stack, stun as they rise, fire at full)
    { const sum = (w, souls) => { const h = setup(); G.allies = []; h.weapon = w; h.souls = souls; tap('ability'); const al = G.allies.filter(a => a.owner === h && !a.d.passive); return { h, al, souls: h.souls }; };
      const s3 = sum('base', 30), s10 = sum('base', 100), l3 = sum('lantern', 30), l10 = sum('lantern', 100);
      const ar = sum('marrow', 20); const h = ar.h; const behind = ar.al.every(a => (a.x - h.x) * Math.cos(h.fa) + (a.y - h.y) * Math.sin(h.fa) < 0);
      h.souls = 30; tap('ability'); const stack = G.allies.filter(a => a.kind === 'archer').length;
      const af = sum('marrow', 100); const st = setup(); G.allies = []; st.weapon = 'marrow'; st.souls = 10; const nf = foe('shambler', -40, 0); nf.hp = nf.maxhp = 9999; tap('ability'); const riseStun = nf.stag > 0.3;
      out.summon = { soldiers: [s3.al.length, s10.al.length, s10.al[0].dmg > s3.al[0].dmg, s3.souls], soldierLife: Math.round(s3.al[0].life), shades: [l3.al.length, l10.al.length],
        archers: { n: ar.al.length, behind, life: Math.round(ar.al[0].life), hp: ar.al[0].hp, stack, fire: af.al.every(a => a.fireArrows), riseStun } }; }
    // 8. Dominate: souls set the time (3/5/7/10/15), bosses immune, FULL = faster, Smash spares the dominated, kills heal
    { const h = setup(); G.allies = []; h.weapon = 'scepter'; h.souls = 40; const f = foe('shambler', 40, 0); f.hp = f.maxhp = 999; const bs = foe('shambler', -40, 0); bs.boss = true; tap('ability'); const t4 = +f.charm.toFixed(1), bossNo = !(bs.charm > 0); bs.boss = false; bs.hp = 0; bs.dead = true;
      h.cd = {}; h.fa = 0; f.x = h.x + 140; const hp0 = f.hp; tap('secondary'); run(0.5); const spared = f.hp === hp0;
      const h2 = setup(); h2.weapon = 'scepter'; h2.souls = 100; const g = foe('shambler', 40, 0); g.spd = 60; const sp0 = g.spd; tap('ability'); const fast = g.charmHaste && g.spd > sp0;
      h2.souls = 5; h2.hp = 50; const k = foe('shambler', 300, 0); killFoe(k, h2, {}); const k2 = foe('shambler', 300, 20); killFoe(k2, h2, {}); const healed = h2.hp > 50;
      out.dominate = { t4, bossNo, spared, fast, healed }; }
    // 9. Hungering Heart talisman: slow vulnerable cast (ability cuts it short), 6s drain ring that slows and heals, ghosts die
    { const h = setup(); h.talisman = 'base'; h.potions = 2; usePotion(h); const casting = h.hungerCast > 0; const x0 = h.x; mv = [1, 0]; run(0.4); const rooted = Math.abs(h.x - x0) < 1; mv = [0, 0]; run(0.5);
      const hz = G.hazards.find(z => z.kind === 'darkHunger'); const gh = foe('wraith', 30, 0), sh = foe('shambler', -30, 0); sh.hp = sh.maxhp = 999; h.hp = 40; run(1.0);
      const out9 = { casting, rooted, ring: !!hz, life: hz && hz.life, ghostDead: gh.hp <= 0, drained: sh.hp < 999, slowed: sh.slowT > 0, healed: h.hp > 40 };
      const h2 = setup(); h2.talisman = 'base'; h2.potions = 2; h2.souls = 10; usePotion(h2); run(0.1); tap('ability'); out9.abilityCuts = G.hazards.some(z => z.kind === 'darkHunger') && h2.hungerCast <= 0; out.hunger = out9; }
    // 10. HUD: her weapon-ability pip is the Soul meter (no cooldown sweep); her other moves keep their sweeps
    { const h = setup(); const L = heroMoves(h); const soul = L.find(m => m.soul); h.cd = { secondary: 0.7, defend: 0.2 }; out.hud = { soul: !!soul, soulCd: soul ? soul.cd() : -1, smashCd: +L.find(m => m.lab === 'SMSH').cd().toFixed(1), hasDash: L.some(m => m.lab === 'DSH') }; }
    return out;
  });
  console.log(JSON.stringify(R));
  chk('Slash: auto-ranges to a far foe, hits a close one (no minimum range), rooted', [R.slash.far.hit, R.slash.far.dist > 80, R.slash.near, R.slash.rooted], [true, true, true, true]);
  chk('Smash: minimum range, hammer entity foes target, front zone staggers', [R.smash.minR >= 70, R.smash.hammer, R.smash.foesTargetIt, R.smash.nearStag], [true, true, true, true]);
  chk('Smash: mid-range auto-correct, Lethal 46, rooted after, Ghostwalk cancels, ~1/s', [R.smash.mid > 130, R.smash.lethal, R.smash.rootedAfter, R.smash.cancel, R.smash.cd], [true, true, true, true, 1]);
  chk('Ghostwalk: invincible, facing unchanged, passes through, slows 5, 4 dmg, flat souls (heavy same), landing delay, no cooldown', R.ghost, g => g.inv && g.faSame && g.through && g.slowA && g.slowB && g.dmg === 4 && g.souls === 6 && g.landDelay && g.again && g.cd === 0);
  chk('weapon ability cancels Ghostwalk mid-flight', R.brake, { was: true, stopped: true, summoned: true });
  chk('Soul Power: grunt 3 < heavy 6 < elite 10; spawner last hit 15; reset on floor change and revive', R.souls, { grunt: 3, heavy: 6, elite: 10, spawner: 15, floorReset: true, reviveReset: true });
  chk('Bloated-mummy blast kills count for her', [R.bloater.victimDead, R.bloater.souls >= 6], [true, true]);
  chk('Soldiers: 1 per soul (3), 5 at full and stronger, meter emptied, 15s', [R.summon.soldiers, R.summon.soldierLife], [[3, 5, true, 0], 15]);
  chk('Shades: 2 per soul (6), 20 at full', R.summon.shades, [6, 20]);
  chk('Archers: 1 per soul, behind her, 20s, fragile, stack, stun on rising, fire arrows at full', R.summon.archers, g => g.n === 2 && g.behind && g.life === 20 && g.hp <= 16 && g.stack === 5 && g.fire && g.riseStun);
  chk('Dominate: 4 souls = 10s, bosses immune, Smash spares dominated, FULL = faster, kills heal', R.dominate, { t4: 10, bossNo: true, spared: true, fast: true, healed: true });
  chk('Hungering Heart: rooted cast, 6s ring, ghosts die, drains, slows, heals; ability cuts the cast', R.hunger, g => g.casting && g.rooted && g.ring && g.life === 6 && g.ghostDead && g.drained && g.slowed && g.healed && g.abilityCuts);
  chk('HUD: weapon ability shows the Soul meter (no sweep), other moves keep sweeps', R.hud, { soul: true, soulCd: 0, smashCd: 0.7, hasDash: true });
  console.log('ERRORS', JSON.stringify(logs));
  console.log(`${pass} passed, ${fail} failed`); await b.close(); process.exit(fail ? 1 : 0);
})();
