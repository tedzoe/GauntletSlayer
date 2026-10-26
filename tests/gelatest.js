// Dawnbringer Gela vs the Slayer Valkyrie guide (docs/slayer_valkyrie_reference_from_david.md): thrust, cancels, shield push-back.
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
    const setup = (x = 8) => { const S = __game.SEL; S.slots = [{ dev: 'kb1', idx: HEROES.findIndex(h => h.id === 'sela'), ready: true }]; __game.startParty(); room(); const h = G.heroes[0]; h.x = x * 32; h.y = 11 * 32; h.fa = 0; h.cd = {}; h.potions = 0; hold.clear(); mv = [0, 0]; run(0.3); h.fa = 0; return h; };
    const foe = (type, dx, dy = 0, o = {}) => { const h = G.heroes[0]; const f = mkFoe(type, h.x + dx, h.y + dy, { awake: true }); f.room = -1; f.atkT = 99; f.spd = 0; Object.assign(f, o); return f; };
    const out = {};
    // 1. thrust: startup, invincible, about running pace, end lag
    { const h = setup(); h.inv = 0; const x0 = h.x; hold.add('secondary'); run(1 / 60); hold.clear(); run(0.1); const still = Math.abs(h.x - x0) < 2; const invStart = h.inv > 0; run(0.12); const invDuring = h.inv > 0;
      let n = 0; while (h.thrust && n++ < 120) run(1 / 60); out.thrust = { still, invStart, invDuring, dist: Math.round(h.x - x0), pace: Math.round(h.baseSpeed * (12 / 60 + 8 / 60 + SPEC.gela.thrustRecovery)), frames: n + 7 }; }
    { const h = setup(); hold.add('secondary'); run(1 / 60); hold.clear(); run(0.05); h.inv = 0; hurtHero(h, 5, { x: h.x - 40, y: h.y }); out.knock = !h.thrust; run(0.5); }
    // 2. shield cancel: hold block after the lunge -> end lag gone
    { const h = setup(); hold.add('secondary'); run(1 / 60); hold.clear(); let n = 0; while (h.thrust && !h.thrust.done && n++ < 60) run(1 / 60); hold.add('defend'); run(2 / 60); out.cancel = { gone: !h.thrust, canceled: !!(h.lastThrust && h.lastThrust.canceled), framesToDone: n }; hold.clear(); }
    // 3. wall: stun on impact; block held at the start = no stun (wall cancel)
    { const h = setup(36); hold.add('secondary'); run(1 / 60); hold.clear(); run(0.33); out.wall = { stunned: !!(h.thrust && h.thrust.stunT > 0) }; run(1);
      const h2 = setup(36); hold.add('defend'); run(0.1); hold.add('secondary'); run(1 / 60); hold.delete('secondary'); run(0.33); out.wall.cancelStun = !!(h2.thrust && h2.thrust.stunT > 0); out.wall.wallCancel = !!(h2.lastThrust ? h2.lastThrust.wallCancel : h2.thrust && h2.thrust.wallCancel); hold.clear(); run(0.5); }
    // 4. heavies stop her and get stunned; wall cancel passes through (mini-boss too); lesser foes in the path die
    { const h = setup(); const hv = foe('barrow', 70); hv.hp = hv.maxhp = 9999; const lesser = foe('shambler', 30, 0); lesser.hp = lesser.maxhp = 999; hold.add('secondary'); run(1 / 60); hold.clear(); run(0.6);
      out.heavy = { stoppedBefore: h.x < hv.x, stunned: hv.stag > 0.5, lesserDead: lesser.hp <= 0 }; run(0.5);
      const h2 = setup(); const mb = foe('horror', 70, 0, { aiFreeze: 99 }); mb.hp = mb.maxhp = 9999; const mbx = mb.x; hold.add('defend'); run(0.1); hold.add('secondary'); run(1 / 60); hold.delete('secondary'); run(0.6); out.heavy.passedMiniBoss = h2.x > mbx + mb.r && Math.abs(mb.x - mbx) < 4; hold.clear(); run(0.3); }
    // 5. shield struck: push back ALL foes in front, 0 damage, interrupt a caster behind them; small foes die on contact; missiles deflect
    { const h = setup(); hold.add('defend'); run(0.4); h.inv = 0; const hp0 = h.hp;
      const fs = [foe('shambler', 40, -20), foe('shambler', 44, 20), foe('barrow', 60, 0)]; for (const f of fs) f.hp = f.maxhp = 999;
      const cast = foe('hexcaller', 240, 0); cast.conjuring = 1.5; const x0 = fs.map(f => f.x);
      const r = hurtHero(h, 10, { x: fs[0].x, y: fs[0].y, foe: fs[0] }); run(0.3);
      out.bash = { blocked: r === false, noDmg: h.hp === hp0, pushed: fs.map((f, i) => Math.round(f.x - x0[i])), hpLost: fs.map(f => 999 - f.hp), caster: cast.conjuring <= 0 };
      const sp = foe('spiderling', 22, 0); const sk = foe('bonesoldier', 24, 6); run(0.1); out.small = { spider: sp.hp <= 0, skeleton: sk.hp <= 0 };
      h.inv = 0; out.reflect = hurtHero(h, 8, { x: h.x + 50, y: h.y, proj: true });
      h.inv = 0; h.slowT = 0; hurtHero(h, 5, { x: h.x + 40, y: h.y, slow: 2 }); out.slowLands = h.slowT > 1;
      // strafe: steering up with the shield raised keeps her facing
      mv = [0, -1]; run(0.4); out.strafe = { fa: +h.fa.toFixed(2), moved: Math.round(11 * 32 - h.y) > 10 }; mv = [0, 0]; hold.clear(); run(0.2); }
    // 6. heavies 4 and 7 stun-lock one heavy; each slash steps forward
    { const h = setup(); const hv = foe('barrow', 46); hv.hp = hv.maxhp = 99999; hv.px = hv.x; hold.add('primary'); const x0 = h.x; let gaps = 0, seen4 = false, minStag = 9;
      for (let i = 0; i < 60 * 5; i++) { run(1 / 60); hv.x = hv.px; hv.kx = hv.ky = 0; h.x = x0; h.y = 11 * 32; /* both pinned: the forward step is tested on its own below */ if (h.combo >= 3) seen4 = true; if (seen4) { minStag = Math.min(minStag, hv.stag); if (hv.stag <= 0) gaps++; } }
      hold.clear(); out.lock = { seen4, gaps, minStag: +minStag.toFixed(2) }; }
    { const h = setup(); const x0 = h.x; hold.add('primary'); run(0.3); hold.clear(); out.step = Math.round(h.x - x0); }
    // 7. no cooldown on the shield: raise, drop, raise again at once
    { const h = setup(); hold.add('defend'); run(0.1); const a = h.blocking; hold.clear(); run(1 / 60); hold.add('defend'); run(1 / 60); out.reraise = a && h.blocking; hold.clear(); }
    return out;
  });
  chk('Spear Thrust: start-up pause (no movement, vulnerable), then an invincible lunge', [R.thrust.still, R.thrust.invStart, R.thrust.invDuring], [true, false, true]);
  chk('a hit in the start-up pause knocks her out of the thrust', R.knock, true);
  chk('Spear Thrust covers about running pace without cancels', R.thrust, g => Math.abs(g.dist - g.pace) <= g.pace * 0.25);
  chk('Spear Thrust has end lag (the move lasts well past the lunge)', R.thrust.frames, g => g >= 40);
  chk('shield cancel: holding block after the lunge ends the end lag at once', R.cancel, g => g.gone && g.canceled);
  chk('hitting a wall stuns her briefly', R.wall.stunned, true);
  chk('wall cancel: block held at the start = no wall stun', [R.wall.wallCancel, R.wall.cancelStun], [true, false]);
  chk('a heavy stops the thrust and is stunned; lesser foes in the path die', R.heavy, g => g.stoppedBefore && g.stunned && g.lesserDead);
  chk('wall cancel passes through a mini-boss', R.heavy.passedMiniBoss, true);
  chk('shield struck: blocked with 0 damage taken', [R.bash.blocked, R.bash.noDmg], [true, true]);
  chk('shield struck: ALL foes in front pushed back, 0 damage to them', R.bash, g => g.pushed.every(d => d >= 6) && g.hpLost.every(v => v === 0));
  chk('shield struck: a caster behind them is interrupted', R.bash.caster, true);
  chk('small foes (spiderling, skeleton) die on contact with the shield', R.small, { spider: true, skeleton: true });
  chk('missiles deflect off the shield', R.reflect, 'reflect');
  chk('the shield does not stop slows', R.slowLands, true);
  chk('strafe: moving with the shield up keeps her facing', R.strafe, g => g.fa === 0 && g.moved);
  chk('heavies 4 and 7 stun-lock a heavy foe (no gap once the chain is going)', R.lock, g => g.seen4 && g.gaps === 0);
  chk('each slash steps her forward', R.step, g => g > 0);
  chk('shield can be re-raised at once (no cooldown)', R.reraise, true);
  chk('no page errors', logs, []);
  console.log(`\ngelatest: ${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail ? 1 : 0);
})();
