'use strict';
// ---------------------------------------------------------------- boot, scene machine and fixed-step loop
const ERRORS = [];
addEventListener('error', e => ERRORS.push(String(e.message || e)));
addEventListener('unhandledrejection', e => ERRORS.push(String(e.reason)));
Input.attach(cv, W, H);
const DT = 1 / 60;
let titleDev = 'kb1';
function allDevs() { return ['kb1', 'kb2', ...Input.pads().map(p => 'pad' + p.index)]; }
function anyPressed(btn, devs = allDevs()) { for (const d of devs) if (Input.read(d).pressed[btn]) return d; return null; }

// studio splash on page load: fade in, hold, fade out; any key, click or pad button skips. Automated browsers skip it unless ?splash is set.
const SPLASH = { t: 0, wait: 0, skip: false };
if (navigator.webdriver && !/[?&]splash\b/.test(location.search)) scene = 'title';
addEventListener('keydown', () => { SPLASH.skip = true; }, true); addEventListener('pointerdown', () => { SPLASH.skip = true; }, true);
function tickSplash() {
  if (!brandReady(BRAND.logo) && SPLASH.wait < SPEC.splash.maxWait) { SPLASH.wait += DT; if (!SPLASH.skip) return; }
  for (const gp of Input.pads()) if (gp.buttons && gp.buttons.some(b => b.pressed)) SPLASH.skip = true;
  SPLASH.t += DT;
  if (SPLASH.skip || SPLASH.t >= splashLen()) { scene = 'title'; sceneT = 0; }
}
function tickTitle() {
  if (Input.keyPressed('KeyC')) { scene = 'controls'; CONTROLS_BACK = 'title'; sceneT = 0; return; }
  const d = sceneT > 0.4 && anyPressed('confirm'); if (d) { Snd.init(); Snd.play('confirm'); SEL.slots = [{ dev: d, idx: 0, ready: false }]; scene = 'select'; sceneT = 0; }
}
function tickControls() { const d = anyPressed('back') || anyPressed('confirm'); if (d && sceneT > 0.2) { scene = CONTROLS_BACK; sceneT = 0; if (scene === 'game') menuGuard = 0.2; } }
function heroTaken(s, idx) { return SEL.slots.some(o => o !== s && o.ready && o.idx === idx); }
function tickSelect() {
  if (sceneT < 0.25) return;
  const taken = SEL.slots.map(s => s.dev);
  if (SEL.slots.length < 4) { const j = Input.joinPress(taken); if (j) { let idx = 0; while (SEL.slots.some(s => s.idx === idx)) idx = (idx + 1) % HEROES.length; SEL.slots.push({ dev: j, idx, ready: false }); Snd.play('confirm'); return; } }
  for (let i = 0; i < SEL.slots.length; i++) {
    const s = SEL.slots[i], inp = Input.read(s.dev);
    if (!s.ready) {
      if (inp.pressed.left || inp.pressed.right) { const step = inp.pressed.right ? 1 : HEROES.length - 1; let n = 0; do { s.idx = (s.idx + step) % HEROES.length; n++; } while (n < HEROES.length && heroTaken(s, s.idx)); Snd.play('select'); }   // skip heroes locked in by another player
      if (s.dev === 'kb1' && SEL.cards && performance.now() - Input.mouse.lastMove < 200) { const mx = Input.mouse.x, my = Input.mouse.y; SEL.cards.forEach((r, k) => { if (mx > r[0] && mx < r[0] + r[2] && my > r[1] && my < r[1] + r[3] && s.idx !== k && !heroTaken(s, k)) { s.idx = k; Snd.play('select'); } }); }
      if (inp.pressed.confirm) { if (SEL.slots.some(o => o !== s && o.ready && o.idx === s.idx)) Snd.play('error'); else { s.ready = true; Snd.play('confirm'); } }
      if (inp.pressed.back) { SEL.slots.splice(i, 1); Snd.play('select'); if (!SEL.slots.length) { scene = 'title'; sceneT = 0; } return; }
    } else {
      if (inp.pressed.back) { s.ready = false; Snd.play('select'); }
      else if ((inp.pressed.confirm || inp.pressed.pause) && SEL.slots.every(o => o.ready)) { startParty(); return; }
    }
  }
}
function startParty() {
  PARTY.length = 0; for (const s of SEL.slots) PARTY.push({ dev: s.dev, hero: HEROES[s.idx].id });
  newRun(); startHub(); scene = 'game'; sceneT = 0; menuGuard = 0.3; SAVE.stats.runs++; persist();
}
function tickResults() {
  const opts = resultOpts(), devs = PARTY.map(p => p.dev);
  if (sceneT < 0.6) return;
  for (const d of devs) { const inp = Input.read(d);
    if (inp.pressed.up) { RESULTS.sel = (RESULTS.sel + opts.length - 1) % opts.length; Snd.play('select'); }
    if (inp.pressed.down) { RESULTS.sel = (RESULTS.sel + 1) % opts.length; Snd.play('select'); }
    if (d === 'kb1') opts.forEach((o, i) => { const r = o._r; const mx = Input.mouse.x, my = Input.mouse.y; if (r && mx > r[0] && mx < r[0] + r[2] && my > r[1] && my < r[1] + r[3] && performance.now() - Input.mouse.lastMove < 200) RESULTS.sel = i; });
    if (inp.pressed.confirm) { Snd.play('confirm'); const o = opts[RESULTS.sel]; menuGuard = 0.3; o.go(); sceneT = 0; return; }
  }
}
function tickGame(dt) {
  if (MENU) { menuInput(Input.read(MENU.dev || 'kb1')); return; }
  menuGuard -= dt;
  const pd = anyPressed('pause', PARTY.map(p => p.dev)); if (pd && menuGuard <= 0) { openPause(pd); return; }
  // drop-in co-op at camp
  if (G.mode === 'hub' && PARTY.length < 4) {
    const j = Input.joinPress(PARTY.map(p => p.dev));
    if (j && j !== 'kb1') { const free = HEROES.find(d => !G.heroes.some(h => h.id === d.id)); PARTY.push({ dev: j, hero: free.id }); const h = mkHero(PARTY.length - 1, free.id, j); h.x = G.heroes[0].x + 30; h.y = G.heroes[0].y; G.heroes.push(h); msg(`P${PARTY.length} joined as ${free.name}! Visit the Hero Shrine to change.`, PCOL[h.pi], 3); Snd.play('revive'); }
  }
  if (G.hitstop > 0) { G.hitstop -= dt; return; }
  G.time += dt;
  const solo = PARTY.length === 1;
  for (const h of G.heroes) { const inp = Input.read(h.dev, solo && h.dev === 'kb1'); if (menuGuard > 0) { for (const k in inp.pressed) inp.pressed[k] = false; } updateHero(h, inp, dt); if (MENU) return; updateHeroBuffs(h, dt); }
  if (scene !== 'game') return;
  if (G.mode !== 'hub') {
    flowT -= dt; if (flowT <= 0) { flowT = 0.2; computeFlow(); }
    updateFoes(dt); updateAllies(dt); updateSpawners(dt);
  }
  updateShots(dt); updateHazards(dt); updatePickups(dt); updateWaves(dt);
  for (const s of G.swings) { s.life -= dt; } G.swings = G.swings.filter(s => s.life > 0);
  for (const c of G.claws) c.life -= dt; G.claws = G.claws.filter(c => c.life > 0);
  for (const c of G.hands) c.life -= dt; G.hands = G.hands.filter(c => c.life > 0);
  if (G.banner) { if (!G.banner.max) G.banner.max = G.banner.t; G.banner.t -= dt; if (G.banner.t <= 0) G.banner = null; }
  updateMode(dt);
  if (scene === 'game') { updateCamera(false, dt); updateFx(dt); }
}
function tick() {
  sceneT += DT;
  if (Input.keyPressed('KeyM') && !(MENU)) { Snd.init(); Snd.toggle(); }
  if (Input.keyPressed('KeyF') && scene !== 'game') { (document.fullscreenElement ? document.exitFullscreen() : cv.requestFullscreen()).catch(() => { }); }
  try {
    if (scene === 'splash') tickSplash(); else if (scene === 'title') tickTitle(); else if (scene === 'select') tickSelect(); else if (scene === 'controls') tickControls();
    else if (scene === 'results') { tickResults(); updateFx(DT); } else if (scene === 'game') tickGame(DT);
  } catch (e) { ERRORS.push(e.stack || String(e)); console.error(e); }
  Input.commit(allDevs());
}
// crisp at every size: the backing store follows the on-screen size x devicePixelRatio; everything draws in the 1152x648 logical space
function fitBacking() {
  const r = cv.getBoundingClientRect(), dpr = Math.min(SPEC.cam.maxDpr, window.devicePixelRatio || 1);
  const bw = Math.max(W, Math.round(r.width * dpr)), bh = Math.round(bw * H / W);
  if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; }
  ctx.setTransform(bw / W, 0, 0, bh / H, 0, 0); ctx.imageSmoothingEnabled = true;
}
function draw() {
  fitBacking();
  try {
    if (scene === 'splash') drawSplash(); else if (scene === 'title') drawTitle(); else if (scene === 'select') drawSelect(); else if (scene === 'controls') drawControls();
    else if (scene === 'results') drawResults();
    else if (scene === 'game') { drawWorld(); drawStations(); drawHUD(); drawMenu(); DEBUG.draw(); }
  } catch (e) { ERRORS.push(e.stack || String(e)); console.error(e); }
}
let acc = 0, lastT = performance.now();
function frame(now) {
  acc += Math.min(0.25, (now - lastT) / 1000); lastT = now;
  let n = 0; while (acc >= DT && n < 5) { tick(); acc -= DT; n++; } if (n >= 5) acc = 0;
  draw(); requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
// debug / test hooks
window.__game = { SPLASH, G, get scene() { return scene; }, set scene(v) { scene = v; }, get SAVE() { return SAVE; }, ERRORS, PARTY, SEL, startParty, startHub, startCampaignFloor, startEndlessFloor, startArena, openStation, tick, draw,
  get MENU() { return MENU; }, get RESULTS() { return RESULTS; }, closeMenu, mkFoe, killFoe, beginRun, resultOpts, Input };
