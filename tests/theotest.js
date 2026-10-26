// Sir Theo vs the Slayer Warrior guide (docs/slayer_warrior_reference_from_david.md) and the FAQ Thor section: Rush, Super Slash, Leap, Smash, cleaves.
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
    const setup = (x = 8) => { const S = __game.SEL; S.slots = [{ dev: 'kb1', idx: HEROES.findIndex(h => h.id === 'brannoc'), ready: true }]; __game.startParty(); room(); const h = G.heroes[0]; h.x = x * 32; h.y = 11 * 32; h.fa = 0; h.cd = {}; h.potions = 0; hold.clear(); mv = [0, 0]; run(0.3); h.fa = 0; return h; };
    const foe = (type, dx, dy = 0, o = {}) => { const h = G.heroes[0]; const f = mkFoe(type, h.x + dx, h.y + dy, { awake: true }); f.room = -1; f.atkT = 99; f.spd = 0; Object.assign(f, o); return f; };
    const out = {};
    const rush = () => { hold.add('dash'); run(1 / 60); hold.delete('dash'); };
    // 1. Rush: short vulnerable start-up, then invincible all the way, faster than running, can't steer, flows into running
    { const h = setup(); h.inv = 0; const x0 = h.x, y0 = h.y; rush(); run(2 / 60); const still = Math.abs(h.x - x0) < 2 && !h.dash; const hp0 = h.hp; hurtHero(h, 5, { x: h.x - 30, y: h.y }); const hitStart = h.hp < hp0; h.hp = h.maxHp; h.inv = 0; h.rushPrep = 0; run(0.3); h.cd = {}; h.x = x0; h.y = y0;
      rush(); let n = 0; while (!h.dash && n++ < 20) run(1 / 60); const xs = h.x, t0 = n; mv = [0, 1]; let allInv = true, frames = 0; while (h.dash && frames++ < 120) { run(1 / 60); if (h.dash && h.inv <= 0) allInv = false; }
      const speed = (h.x - xs) / (frames / 60); const ySteer = Math.abs(h.y - y0) < 3; mv = [1, 0]; const x1 = h.x; run(0.2); out.rush = { spd: Math.round(speed), base: h.baseSpeed, frames, still, hitStart, allInv, faster: speed > h.baseSpeed * 1.2, ySteer, runsOn: h.x - x1 > h.baseSpeed * 0.12 }; mv = [0, 0]; }
    // 2. Rush kills skeletons and ghosts on contact, tackles lesser foes aside
    { const h = setup(); const sk = foe('bonesoldier', 70, 0), gh = foe('wraith', 120, 0), sm = foe('shambler', 170, 0); sm.hp = sm.maxhp = 999; const sy = sm.y, sx = sm.x;
      rush(); run(1.2); out.rushKill = { skeleton: sk.hp <= 0, ghost: gh.hp <= 0, small: sm.hp > 0 && (Math.abs(sm.x - sx) + Math.abs(sm.y - sy) > 10 || sm.stag > 0.5) }; }
    // 3. heavies block the Rush: heavy staggers, Theo recovers a moment
    { const h = setup(); const hv = foe('barrow', 110, 0); hv.hp = hv.maxhp = 9999; rush(); let n = 0; while (!h.dash && n++ < 20) run(1 / 60); n = 0; while (h.dash && n++ < 120) run(1 / 60);
      out.rushHeavy = { stoppedBefore: h.x < hv.x, heavyStag: hv.stag > 0.5, recover: h.lock > 0.1 }; run(0.6); }
    // 4. Super Slash during the Rush: stops it, brief root, white-trail hit 4 stuns a heavy, chain continues from hit 5
    { const h = setup(); const hv = foe('barrow', 300, 0); hv.hp = hv.maxhp = 9999; rush(); let n = 0; while (!h.dash && n++ < 20) run(1 / 60); run(3 / 60); hv.x = h.x + 44; hv.y = h.y;
      hold.add('primary'); run(1 / 60); hold.delete('primary'); out.superSlash = { stopped: !h.dash, rooted: h.lock > 0.05, combo: h.combo + 1, heavyStun: hv.stag >= SPEC.theo.heavyStun - 0.05 }; run(0.6); }
    // 5. Leap (Rush + smash): jumps over a heavy, invincibility runs on through the landing, lands a stunning Lethal Smash
    { const h = setup(); const hv = foe('barrow', 300, 0); hv.hp = hv.maxhp = 9999; rush(); let n = 0; while (!h.dash && n++ < 20) run(1 / 60); run(2 / 60); hv.x = h.x + 60; hv.y = h.y; const hx = hv.x;
      hold.add('secondary'); run(1 / 60); hold.delete('secondary'); let allInv = true; n = 0; while (h.dash && n++ < 60) { run(1 / 60); if (h.inv <= 0 && h.dash) allInv = false; }
      out.leap = { over: h.x > hx, heavyStill: Math.abs(hv.x - hx) < 30, allInv, heavyStun: hv.stag >= SPEC.theo.heavyStun - 0.05 }; run(0.5); }
    // 6. Rush cancels into the weapon ability
    { const h = setup(); rush(); let n = 0; while (!h.dash && n++ < 20) run(1 / 60); run(2 / 60); hold.add('ability'); run(1 / 60); hold.delete('ability'); out.rushCancel = { spin: h.spin > 0, dashGone: !h.dash }; run(3); }
    // 7. Smash: instant wide stun (before any damage) that interrupts a caster and destroys missiles; then 50 Lethal that stuns heavies
    { const h = setup(); const far = foe('shambler', 105, 0); far.hp = far.maxhp = 999; const cast = foe('hexcaller', -60, 0); cast.conjuring = 1.5; 
      G.shots.push({ team: 'foe', x: h.x + 50, y: h.y - 50, vx: 0, vy: 0, r: 4, dmg: 5, life: 5, t: 0, hit: new Set() }); const sh = G.shots[G.shots.length - 1];
      hold.add('secondary'); run(1 / 60); hold.delete('secondary'); const instant = { farStun: far.stag > 0.3, farHp: far.hp === 999, caster: cast.conjuring <= 0, missile: !!sh.dead }; run(0.6);
      const h2 = setup(); const hv = foe('barrow', 50, 0); hv.hp = hv.maxhp = 9999; hold.add('secondary'); run(1 / 60); hold.delete('secondary'); hv.stag = 0; run(0.3);
      out.smash = Object.assign(instant, { heavyHit: hv.hp < 9999, heavyStun: hv.stag > 0.5, dps: Math.round(DEV.dmg.theo.leap / SPEC.theo.smashTime) }); }
    // 8. slashes: weak hits stagger small foes only and interrupt casters; hit 7 has a long recovery
    { const h = setup(); const cast = foe('hexcaller', 40, 0); cast.hp = cast.maxhp = 999; cast.conjuring = 1.5; const hv = foe('barrow', 300, 0); hv.hp = hv.maxhp = 9999;
      hold.add('primary'); run(1 / 60); hold.delete('primary'); const interrupt = cast.conjuring <= 0; cast.hp = 0; cast.dead = true; run(0.5); hv.x = h.x + 44; hv.y = h.y; hv.stag = 0;
      hold.add('primary'); run(1 / 60); hold.delete('primary'); const weakHeavy = hv.stag; run(0.5);
      h.combo = 5; h.comboT = 0.5; h.atkT = 0; hold.add('primary'); run(1 / 60); hold.delete('primary'); out.slash = { interrupt, weakHeavyStag: +weakHeavy.toFixed(2), finRecovery: +(h.atkT * hasteMul(h)).toFixed(2) }; run(1); }
    // 9. Demonic Cleave: ~6s, rooted, invincible, reaches the sides but not mid-back, tiny stun ring all round
    { const h = setup(); h.weapon = 'demonic'; h.cd = {}; const fr = foe('shambler', 50, 0), side = foe('shambler', 0, 50), back = foe('shambler', -30, 0), backFar = foe('shambler', -70, 0); for (const f of [fr, side, back, backFar]) f.hp = f.maxhp = 999;
      mv = [1, 0]; hold.add('ability'); run(1 / 60); hold.delete('ability'); const x0 = h.x, inv = h.inv > 0.4; run(0.3); const rooted = Math.abs(h.x - x0) < 1;
      out.cleave = { cd: SPEC.weapons.brannoc.demonic, rooted, inv, front: fr.hp < 999, side: side.hp < 999, backNoDmg: back.hp === 999 && backFar.hp === 999, backStun: back.stag > 0.3 }; mv = [0, 0]; run(0.5); }
    // 10. Destructo Spin: ~10s cooldown, Theo slides (keeps drifting when the stick is let go)
    { const h = setup(); hold.add('ability'); run(1 / 60); hold.delete('ability'); mv = [1, 0]; run(0.6); mv = [0, 0]; const x1 = h.x; run(0.15); out.spin = { cd: SPEC.theo.spinCd, slides: h.x - x1 > 4 }; run(3); }
    // 11. More of Thor: invincible from the start, rooted while transforming unless Rush is held
    { const h = setup(); h.talisman = 'titan'; h.potions = 2; h.inv = 0; mv = [1, 0]; usePotion(h); const x0 = h.x; run(0.4); const rooted = Math.abs(h.x - x0) < 1; const hp0 = h.hp; h.inv = 0; hurtHero(h, 10, { x: h.x - 20, y: h.y }); const invuln = h.hp === hp0; run(1);
      const h2 = setup(); h2.talisman = 'titan'; h2.potions = 2; mv = [1, 0]; hold.add('dash'); usePotion(h2); run(1 / 60); hold.delete('dash'); const x2 = h2.x; run(0.3); out.titan = { rooted, invuln, rushSkips: h2.titanRoot <= 0 }; mv = [0, 0]; }
    return out;
  });
  console.log(JSON.stringify(R));
  chk('Rush: short vulnerable start-up', [R.rush.still, R.rush.hitStart], [true, true]);
  chk('Rush: invincible for the whole dash, faster than running, cannot steer, flows into running', [R.rush.allInv, R.rush.faster, R.rush.ySteer, R.rush.runsOn], [true, true, true, true]);
  chk('Rush kills skeletons and ghosts, tackles lesser foes aside', R.rushKill, { skeleton: true, ghost: true, small: true });
  chk('Rush blocked by a heavy: heavy staggers, Theo recovers', R.rushHeavy, { stoppedBefore: true, heavyStag: true, recover: true });
  chk('Super Slash mid-Rush: stops it, roots, is hit 4, stuns a heavy', R.superSlash, { stopped: true, rooted: true, combo: 4, heavyStun: true });
  chk('Leap mid-Rush: over a heavy, invincible throughout, stuns it on landing', R.leap, { over: true, heavyStill: true, allInv: true, heavyStun: true });
  chk('Rush cancels into the weapon ability', R.rushCancel, { spin: true, dashGone: true });
  chk('Smash: instant wide stun before damage, interrupts casters, destroys missiles; 50 Lethal stuns heavies; ~60 DPS', R.smash, g => g.farStun && g.farHp && g.caster && g.missile && g.heavyHit && g.heavyStun && g.dps >= 55 && g.dps <= 65);
  chk('Slash: weak hits interrupt casters, barely touch heavies; hit 7 long recovery 0.6s', [R.slash.interrupt, R.slash.weakHeavyStag < 0.3, R.slash.finRecovery], [true, true, 0.6]);
  chk('Demonic Cleave: 6s, rooted, invincible, sides yes, mid-back no damage but stun ring', R.cleave, { cd: 6, rooted: true, inv: true, front: true, side: true, backNoDmg: true, backStun: true });
  chk('Destructo Spin: 10s cooldown, slides', R.spin, { cd: 10, slides: true });
  chk('More of Thor: rooted while transforming, invincible, holding Rush skips the root', R.titan, { rooted: true, invuln: true, rushSkips: true });
  console.log('ERRORS', JSON.stringify(logs));
  console.log(`${pass} passed, ${fail} failed`); await b.close(); process.exit(fail ? 1 : 0);
})();
