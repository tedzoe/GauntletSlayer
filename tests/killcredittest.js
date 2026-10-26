// Floor tally kills go to the player who owns the kill, whatever did it: boss kills, spells and missiles, burn and other DoTs,
// fire and ward hazards, raised minions, relic pets, charmed foes, a bloater's blast, and a trap finishing off a wounded foe.
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
    const run = s => { for (let i = 0; i < Math.round(s * 60); i++) { menuGuard = 0; __game.tick(); } };
    const ids = ['brannoc', 'mirelle', 'vesper', 'kestrel'];
    const setup = fl => { const S = __game.SEL; S.slots = ids.map((id, i) => ({ dev: i ? 'pad' + (i - 1) : 'kb1', idx: HEROES.findIndex(h => h.id === id), ready: true })); __game.startParty(); beginRun(); startCampaignFloor(0, fl);
      G.foes = G.foes.filter(f => f.boss); G.spawners = []; G.battle = null; G.map.noLock = true; G.heroes.forEach(h => { h.inv = 1e9; h.maxHp = h.hp = 1e6; }); G.stats.hk = {}; };
    const hk = () => ids.map((_, i) => (G.stats.hk || {})[i] || 0);
    const spot = (h, dx = 60) => { for (let d = dx; d < 400; d += 20) for (const a of [0, 1.57, 3.14, 4.71]) { const x = h.x + Math.cos(a) * d, y = h.y + Math.sin(a) * d; if (!collide(x, y, 18)) return { x, y }; } return { x: h.x, y: h.y }; };
    const foe = (h, type = 'shambler', dx) => { const q = spot(h, dx); const f = mkFoe(type, q.x, q.y, { awake: true }); f.spd = 0; f.atkT = 99; return f; };
    const out = {}, [th, zo, ve, is] = (setup(0), G.heroes);
    const trial = (name, fn, who, n = 1) => { G.allies = []; G.hazards = []; G.foes = G.foes.filter(f => ALIVE(f) && f.boss); const before = hk(); let f; try { f = fn(); } catch (e) { out[name] = { err: String(e) }; return; } run(0.1); const after = hk(); out[name] = { dead: !!(f && !ALIVE(f)), delta: after.map((v, i) => v - before[i]), want: who, n }; };
    trial('spell missile (Zoey)', () => { const f = foe(zo); f.hp = 1; const a = Math.atan2(f.y - zo.y, f.x - zo.x); shoot({ team: 'hero', x: zo.x, y: zo.y, vx: Math.cos(a) * 600, vy: Math.sin(a) * 600, dmg: 50, r: 6, life: 1, owner: zo }); run(0.5); return f; }, 1);
    trial('burn DoT (Zoey)', () => { const f = foe(zo); f.hp = 30; hitFoe(f, 1, { src: zo, burn: 40, burnT: 3, quiet: true }); run(2); return f; }, 1);
    trial('fire hazard (Theo ember trail)', () => { const f = foe(th); f.hp = 20; G.hazards.push({ kind: 'fire', x: f.x, y: f.y, r: 30, life: 3, t: 0, dps: 40, owner: th }); run(2); return f; }, 0);
    trial('raised minion (Vesper)', () => { const f = foe(ve); f.hp = 1; const a = mkAlly('warrior', f.x - 20, f.y, ve); hitFoe(f, 50, { src: a, x: a.x, y: a.y }); return f; }, 2);
    trial('relic pet (Isaac gargoyle)', () => { const f = foe(is); f.hp = 1; const g = mkAlly('gargoyle', f.x - 20, f.y, is, { life: 5 }); hitFoe(f, 50, { src: g, x: g.x, y: g.y }); return f; }, 3);
    trial('charmed foe (Vesper)', () => { const c = foe(ve, 'shambler', 60), f = foe(ve, 'shambler', 140); c.charm = 5; c.charmBy = ve; f.hp = 1; hitFoe(f, 50, { src: c, x: c.x, y: c.y }); return f; }, 2);
    trial("bloater blast (Isaac killed the bloater)", () => { const bl = foe(is, 'bloater', 80); const f = mkFoe('shambler', bl.x + 20, bl.y, { awake: true }); f.hp = 1; f.spd = 0; hitFoe(bl, 1e4, { src: is, x: is.x, y: is.y }); run(DEATH_FX.delay + 0.3); return f; }, 3, 2);   // the bloater and the foe its blast killed (the burst waits DEATH_FX.delay)
    trial('trap finishes a foe Theo wounded', () => { const f = foe(th); hitFoe(f, 1, { src: th, quiet: true }); run(1); f.hp = 0.5; hitFoe(f, 14, { quiet: false }); return f; }, 0);
    trial('kill with no hero involved earns nobody credit', () => { const f = foe(th, 'shambler', 200); f.hp = 1; hitFoe(f, 14, {}); return f; }, -1);
    // boss: Theo lands the killing blow; the tally shows it
    setup(3); const bo = G.boss; bo.invuln = false; hitFoe(bo, bo.hp + 10, { src: G.heroes[0], x: G.heroes[0].x, y: G.heroes[0].y }); run(8); floorComplete();   // the tally opens when the party leaves through the exit
    out.boss = { hk: hk(), tally: RESULTS && RESULTS.tally ? RESULTS.tally.heroes.map(x => x.kills) : null };
    return out;
  });
  console.log(JSON.stringify(R));
  for (const [name, r] of Object.entries(R)) { if (name === 'boss') continue;
    chk(`${name}: kill credited to ${r.want < 0 ? 'nobody' : 'P' + (r.want + 1)}`, r, g => !g.err && g.dead && g.delta.every((d, i) => d === (i === g.want ? g.n : 0))); }
  chk('boss kill counts for the player who landed it, on the tally', R.boss, g => g.hk[0] === 1 && g.tally && g.tally[0] === 1 && g.tally.slice(1).every(x => x === 0));
  chk('no page errors', logs, []);
  console.log(`\nkillcredittest: ${pass} passed, ${fail} failed`); await b.close(); process.exit(fail ? 1 : 0);
})();
