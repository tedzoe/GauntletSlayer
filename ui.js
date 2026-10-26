'use strict';
const GAME_TITLE = 'HOLLOWCROWN', GAME_SUB = 'SLAYERS OF THE DEEP';
let scene = 'title', sceneT = 0, RESULTS = null, MENU = null, PAUSE = null, menuGuard = 0;
const FONT = (s, b = 'bold') => `${b} ${s}px "Trebuchet MS", Verdana, sans-serif`;
function txt(s, x, y, size, col = '#fff', align = 'left', b = 'bold') { ctx.font = FONT(size, b); ctx.textAlign = align; ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillText(s, x + 1.5, y + 1.5); ctx.fillStyle = col; ctx.fillText(s, x, y); }
function panel(x, y, w, h, a = 0.78, border = '#6a5a3a') { ctx.fillStyle = `rgba(14,10,8,${a})`; ctx.fillRect(x, y, w, h); ctx.strokeStyle = border; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2); ctx.strokeStyle = 'rgba(255,220,150,0.08)'; ctx.strokeRect(x + 4, y + 4, w - 8, h - 8); }
function bar(x, y, w, h, k, col, bg = '#200') { ctx.fillStyle = '#000'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2); ctx.fillStyle = bg; ctx.fillRect(x, y, w, h); ctx.fillStyle = col; ctx.fillRect(x, y, w * clamp(k, 0, 1), h); ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(x, y, w * clamp(k, 0, 1), h / 3); }
function wrapText(s, x, y, maxW, lh, size, col, align = 'left') { ctx.font = FONT(size, 'normal'); const words = s.split(' '); let line = '', yy = y; for (const w of words) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { txt(line, x, yy, size, col, align, 'normal'); line = w; yy += lh; } else line = t; } if (line) txt(line, x, yy, size, col, align, 'normal'); return yy + lh; }
function cdPip(x, y, r, h, key, label, col) {
  if (!h._cdm) h._cdm = {}; const c = h.cd[key] || 0; if (c <= 0) h._cdm[key] = 0; else if (c > (h._cdm[key] || 0)) h._cdm[key] = c;
  const k = c > 0 ? c / (h._cdm[key] || 1) : 0;
  circ(x, y, r, k ? '#1a1410' : col, '#000', 2);
  if (k) { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, r, -1.57, -1.57 + 6.28 * k); ctx.fill(); circ(x, y, r - 4, null, col, 2); }
  txt(label, x, y + 4, 10, k ? '#999' : '#111', 'center');
}

// ---------------------------------------------------------------- HUD
function drawHUD() {
  const n = G.heroes.length, pw = n > 2 ? 280 : 300;
  G.heroes.forEach((h, i) => {
    const x = n === 1 ? 14 : i * (W - pw - 28) / Math.max(1, n - 1) + 14, y = H - 92;
    panel(x, y, pw, 80, 0.8, PCOL[h.pi]);
    // portrait
    circ(x + 38, y + 40, 28, '#0c0a08', h.def.color, 3);
    if (!drawPortrait(h.def, x + 38, y + 40, 26)) { ctx.save(); ctx.beginPath(); ctx.arc(x + 38, y + 40, 26, 0, 6.28); ctx.clip(); drawHeroSprite(h.def, x + 38, y + 50, 1.57, 1.7, { noShadow: true, weapon: h.weapon }); ctx.restore(); }
    if (h.dead) { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.beginPath(); ctx.arc(x + 38, y + 40, 26, 0, 6.28); ctx.fill(); txt('✝', x + 38, y + 50, 26, '#c33', 'center'); }
    txt(`${n > 1 ? 'P' + (h.pi + 1) + ' ' : ''}${h.def.name}`, x + 74, y + 20, 14, h.def.accent);
    bar(x + 74, y + 27, pw - 90, 12, h.hp / h.maxHp, h.hp < h.maxHp * 0.25 ? '#ff3a2a' : '#d43a2a', '#3a0806');
    txt(`${Math.ceil(Math.max(0, h.hp))} / ${h.maxHp}`, x + 74 + (pw - 90) / 2, y + 37, 10, '#fff', 'center');
    // potions & keys
    for (let k = 0; k < Math.max(h.potions, 0) && k < 6; k++) { const px = x + 80 + k * 13, py = y + 53; circ(px, py + 2, 5, '#4a8cff', '#cfe0ff', 1); ctx.fillStyle = '#ddd'; ctx.fillRect(px - 1.5, py - 6, 3, 4); }
    for (let k = 0; k < h.keys && k < 5; k++) { const kx = x + 80 + k * 12, ky = y + 70; ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(kx - 2, ky - 3, 3, 0, 6.28); ctx.moveTo(kx + 1, ky - 3); ctx.lineTo(kx + 8, ky - 3); ctx.stroke(); }
    // class resource
    const rx = x + pw - 162;
    if (h.id === 'vesper') { for (let k = 0; k < 10; k++) circ(rx + 4 + (k % 5) * 11, y + 52 + Math.floor(k / 5) * 11, 4, k < Math.floor(h.souls / 10) ? '#b07aff' : '#1f1a2a', '#000', 1); }
    if (h.id === 'mirelle') { for (let k = 0; k < 2; k++) { const r = (h.runes || [])[k]; circ(rx + 6 + k * 16, y + 56, 6, '#111', r !== undefined ? RUNE_COL[h.schools[r]] : '#333', 2); if (r !== undefined) circ(rx + 6 + k * 16, y + 56, 3, RUNE_COL[h.schools[r]]); } if (h.spell && h.spell.length === 2) { const sp = spellOf(h); txt(sp.name, rx - 2, y + 75, 10, RUNE_COL[h.schools[h.spell[0]]]); } }
    if (h.id === 'kestrel' && h.explosiveArrow) txt('EXPLOSIVE', rx - 2, y + 75, 10, '#ff8a2a');
    // cooldown pips: defend / ability / relic
    const cx = x + pw - 74;
    if (h.id !== 'mirelle') { cdPip(cx, y + 60, 11, h, h.id === 'brannoc' || h.id === 'kestrel' || h.id === 'vesper' ? 'defend' : 'secondary', h.id === 'sela' ? 'LNC' : h.id === 'brannoc' ? 'RSH' : h.id === 'kestrel' ? 'RLL' : h.id === 'paladin' ? 'OVH' : 'GHO', '#9ad0ff'); cdPip(cx + 26, y + 60, 11, h, 'ability', 'ABL', '#ffd27a'); }
    if (h.relic) { cdPip(cx + 52, y + 60, 11, h, 'relic', 'REL', '#d8a0ff'); }
    if (G.mode === 'hub') txt(`Bank ${bankOf(h.id)} gold`, x + 150, y + 75, 10, '#ffd84a');
    if (h.dead) txt(n > 1 ? `Confirm: rez coin (${isFinite(G.rez) ? G.rez + ' left' : 'unlimited'})` : '', x + 74, y + 75, 10, canRevive() ? '#9fffe0' : '#f88');
  });
  // top bar: location, purse, mode status
  const top = G.mode === 'hub' ? `${G.floorName}` : `${G.worldName} — ${G.floorName}`;
  panel(W / 2 - 230, 6, 460, 34, 0.7);
  txt(top, W / 2, 28, 14, '#f2e6c8', 'center');
  panel(W - 200, 6, 190, 34, 0.7); circ(W - 182, 23, 7, '#ffd84a', '#a07a10', 2);
  txt(G.mode === 'hub' ? `Banked ${G.heroes.reduce((a, h) => a + bankOf(h.id), 0)}` : `${Math.floor(G.purse)}`, W - 166, 29, 15, '#ffd84a');
  if (G.mode !== 'hub' && G.secured) txt(`secured ${Math.floor(Math.min(G.secured, G.purse))}`, W - 70, 29, 10, '#bba', 'left', 'normal');
  if (G.arena) { const A = G.arena; panel(14, 6, 230, 34, 0.7); txt(A.state === 'done' ? 'Arena cleared' : A.wave ? `Wave ${A.wave}/${A.waves} · foes ${G.foes.filter(f => ALIVE(f) && f.type !== 'reaper').length}` : 'Step into the arena', 26, 28, 13, '#ff9a7a'); }
  else if (G.mode === 'endless') { panel(14, 6, 230, 34, 0.7); txt(`Depth ${G.endless} · best ${SAVE.endless.best}`, 26, 28, 13, '#9fffe0'); }
  // boss bar
  { const mb = (!G.boss || !ALIVE(G.boss)) && G.foes.find(f => f.d.miniboss && ALIVE(f) && (f.hp < f.maxhp || G.heroes.some(h => !h.dead && hyp(h.x - f.x, h.y - f.y) < 520))); if (mb) { G.miniBar = mb; panel(W / 2 - 240, 46, 480, 34, 0.75, '#3a5a9a'); txt(mb.d.name + '  ·  MINI-BOSS', W / 2, 62, 12, '#cfe0ff', 'center'); bar(W / 2 - 220, 66, 440, 8, mb.hp / mb.maxhp, mb.barrier > 0 ? '#9fd8ff' : '#d42a1a'); } else G.miniBar = null; }
  if (G.boss && ALIVE(G.boss)) { const b = G.boss; panel(W / 2 - 280, 46, 560, 34, 0.75, '#a03a2a'); txt(b.name, W / 2, 62, 12, '#ffb0a0', 'center'); bar(W / 2 - 260, 66, 520, 8, b.hp / b.maxhp, b.invuln ? '#9a7aff' : '#d42a1a'); if (b.invuln && b.kind === 'sovereign') txt('SHIELDED', W / 2 + 230, 62, 10, '#c8a0ff', 'center'); }
  // exit countdown
  if (G.exitT >= 0) { txt(`Leaving floor in ${Math.ceil(G.exitT)}…`, W / 2, H - 112, 18, '#9fffe0', 'center'); txt('All heroes on the portal to go now', W / 2, H - 96, 11, '#bcd', 'center', 'normal'); }
  // messages
  G.msgs.forEach((m, i) => { ctx.globalAlpha = Math.min(1, m.t); txt(m.s, 16, 66 + i * 20, 13, m.col, 'left'); ctx.globalAlpha = 1; });
  // banner
  if (G.banner) { const b = G.banner, a = Math.min(1, b.t * 2, (b.max || 3) - b.t + 0.3); ctx.globalAlpha = clamp(a, 0, 1); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, H * 0.3 - 40, W, 74); txt(b.sub || '', W / 2, H * 0.3 - 16, 13, '#d8b070', 'center'); txt(b.s, W / 2, H * 0.3 + 18, 30, '#fff4dc', 'center'); ctx.globalAlpha = 1; }
  // solo revive offer
  if (G.reviveOffer && G.heroes.every(h => h.dead)) { panel(W / 2 - 220, H / 2 - 50, 440, 92, 0.9, '#9fffe0'); txt('You have fallen', W / 2, H / 2 - 18, 22, '#ffb0a0', 'center'); txt(`Press confirm to spend a rez coin${isFinite(G.rez) ? ` (${G.rez} left)` : ''}`, W / 2, H / 2 + 10, 14, '#9fffe0', 'center'); txt('(or wait to accept defeat)', W / 2, H / 2 + 30, 11, '#aaa', 'center', 'normal'); }
  // hub station prompts
  if (G.mode === 'hub') for (const h of G.heroes) if (h.station) { const s = h.station, sx = s.x - G.cam.x, sy = s.y - G.cam.y - 44; panel(sx - 120, sy - 20, 240, 30, 0.85, PCOL[h.pi]); txt(`${s.label}`, sx, sy - 1, 12, '#fff', 'center'); txt(h.dev.startsWith('pad') ? '[A]' : '[Enter/Click]', sx, sy + 24, 10, '#ffd27a', 'center'); }
}
function drawStations() {
  if (G.mode !== 'hub') return;
  for (const s of G.stations) {
    const x = s.x - G.cam.x, y = s.y - G.cam.y;
    const col = { Q: '#9ab8d0', W: '#9ad070', Z: '#ff8a4a', Y: '#b07aff', N: '#9fffe0', A: '#ff6a5a', M: '#ffd84a', T: '#e8d8a0', K: '#c0c8d0', H: '#ff9ad0', O: '#ffcf7a' }[s.id];
    const world = 'QWZY'.includes(s.id);
    if (world) { const k = 'QWZY'.indexOf(s.id); const locked = k === 3 && !finUnlocked(); ell(x, y + 6, 26, 10, 'rgba(0,0,0,0.4)'); circ(x, y - 8, 22, '#0a0812', locked ? '#555' : col, 4); if (!locked) for (let i = 0; i < 3; i++) { ctx.strokeStyle = hexA(col, 0.6 - i * 0.15); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y - 8, 6 + i * 5, G.time * (2 + i), G.time * (2 + i) + 4); ctx.stroke(); } const prog = SAVE.progress[['w1', 'w2', 'w3', 'fin'][k]] || 0, tot = WORLDS[k].floors.length; txt(locked ? 'SEALED' : `${prog}/${tot}`, x, y + 26, 10, locked ? '#888' : col, 'center'); }
    else { ell(x, y + 8, 18, 7, 'rgba(0,0,0,0.4)'); ctx.fillStyle = '#3a3028'; ctx.fillRect(x - 12, y - 14, 24, 22); ctx.fillStyle = col; ctx.fillRect(x - 12, y - 18, 24, 5); const g = 0.5 + 0.3 * Math.sin(G.time * 3 + s.x); circ(x, y - 26, 6, hexA(col, g), null); txt({ N: '∞', A: '⚔', M: '$', T: '★', K: '⚒', H: '☉', O: '⚙' }[s.id] || '?', x, y + 3, 14, col, 'center'); }
    txt(s.label, x, y - 40, 10, hexA(col, 0.85), 'center', 'normal');
  }
}
function finUnlocked() { return (SAVE.progress.w1 || 0) >= 4 && (SAVE.progress.w2 || 0) >= 4 && (SAVE.progress.w3 || 0) >= 4; }

// ---------------------------------------------------------------- generic menu
function openMenu(m) { MENU = Object.assign({ sel: 0, scroll: 0, t: 0 }, m); MENU.items = MENU.build(); MENU.sel = Math.min(MENU.sel, MENU.items.length - 1); skipDisabled(1); Snd.play('select'); }
function skipDisabled(dir) { const it = MENU.items; for (let k = 0; k < it.length && it[MENU.sel] && it[MENU.sel].header; k++) MENU.sel = (MENU.sel + dir + it.length) % it.length; }
function closeMenu() { MENU = null; menuGuard = 0.15; }
function menuInput(inp) {
  const m = MENU; if (!m) return; m.t += 1 / 60;
  if (m.t < 0.12) return;
  const n = m.items.length;
  if (inp.pressed.up) { m.sel = (m.sel - 1 + n) % n; skipDisabled(-1); Snd.play('select'); }
  if (inp.pressed.down) { m.sel = (m.sel + 1) % n; skipDisabled(1); Snd.play('select'); }
  const it = m.items[m.sel];
  if (it && it.cycle && (inp.pressed.left || inp.pressed.right)) { it.cycle(inp.pressed.right ? 1 : -1); m.items = m.build(); Snd.play('select'); }
  // mouse hover/click
  if (m.dev === 'kb1' || !m.dev) { const mx = Input.mouse.x, my = Input.mouse.y; m.items.forEach((it2, i) => { const r = it2._r; if (r && mx > r[0] && mx < r[0] + r[2] && my > r[1] && my < r[1] + r[3] && !it2.header && performance.now() - Input.mouse.lastMove < 200) m.sel = i; }); }
  if (inp.pressed.confirm || (inp.pressed.primary && m.dev && m.dev.startsWith('pad'))) {
    const it2 = m.items[m.sel]; if (!it2 || it2.header) return;
    if (it2.disabled) { Snd.play('error'); if (it2.why) m.note = it2.why; return; }
    Snd.play('confirm'); const r = it2.act ? it2.act() : null;
    if (r === 'close' || !it2.act) closeMenu(); else if (MENU === m) { m.items = m.build(); if (m.sel >= m.items.length) m.sel = m.items.length - 1; }
    return;
  }
  if (inp.pressed.back) { Snd.play('select'); if (m.onBack) m.onBack(); else closeMenu(); }
}
function drawMenu() {
  const m = MENU; if (!m) return;
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, H);
  const w = m.w || 640, x = (W - w) / 2, rowH = 30, maxRows = 13, y = 70;
  const hdr = 70, h = Math.min(m.items.length, maxRows) * rowH + hdr + 70;
  panel(x, y, w, h, 0.94, m.col || '#a08050');
  txt(m.title, x + w / 2, y + 34, 22, '#ffe6b0', 'center');
  if (m.sub) txt(m.sub, x + w / 2, y + 54, 12, '#bba88a', 'center', 'normal');
  if (m.sel < m.scroll) m.scroll = m.sel; if (m.sel >= m.scroll + maxRows) m.scroll = m.sel - maxRows + 1;
  m.items.forEach((it, i) => {
    it._r = null; if (i < m.scroll || i >= m.scroll + maxRows) return;
    const ry = y + hdr + (i - m.scroll) * rowH; it._r = [x + 16, ry, w - 32, rowH - 4];
    if (it.header) { txt(it.label, x + 24, ry + 19, 12, '#d8b070'); line(x + 24 + ctx.measureText(it.label).width + 10, ry + 14, x + w - 24, ry + 14, 'rgba(216,176,112,0.3)', 1); return; }
    if (i === m.sel) { ctx.fillStyle = 'rgba(255,210,120,0.16)'; ctx.fillRect(x + 16, ry, w - 32, rowH - 4); ctx.strokeStyle = '#ffd27a'; ctx.lineWidth = 1; ctx.strokeRect(x + 16.5, ry + 0.5, w - 33, rowH - 5); }
    const col = it.disabled ? '#7a7066' : it.col || (i === m.sel ? '#fff' : '#e8dcc0');
    txt((it.cycle ? '◂ ' : '') + it.label + (it.cycle ? ' ▸' : ''), x + 30, ry + 19, 14, col);
    if (it.right) txt(it.right, x + w - 30, ry + 19, 13, it.rightCol || (it.disabled ? '#7a7066' : '#ffd84a'), 'right');
  });
  const cur = m.items[m.sel];
  const fy = y + h - 52; line(x + 20, fy - 6, x + w - 20, fy - 6, 'rgba(216,176,112,0.25)', 1);
  if (cur && cur.desc) wrapText(cur.desc, x + 24, fy + 12, w - 48, 16, 12, '#cfc2a8');
  if (m.note) txt(m.note, x + w / 2, y + h + 18, 12, '#ff9a7a', 'center');
  txt((m.dev && m.dev.startsWith('pad') ? '[A] select   [B] back   ◂▸ change' : '[Enter/Click] select   [Esc] back   ◂▸ change'), x + w / 2, y + h - 10, 10, '#998a70', 'center', 'normal');
}

// ---------------------------------------------------------------- hub stations
function rebuildHero(h, heroId) {
  const i = G.heroes.indexOf(h), nh = mkHero(h.pi, heroId || h.id, h.dev);
  nh.x = h.x; nh.y = h.y; nh.fa = h.fa; G.heroes[i] = nh; PARTY[h.pi].hero = nh.id;
  G.allies = G.allies.filter(a => a.owner !== h); return nh;
}
function beginRun() { G.purse = 0; G.secured = 0; G.bankedRun = 0; G.deathsRun = 0; G.rez = diff().rez; G.victory = false; G.newMasteries = []; for (const h of G.heroes) { h.goldRun = 0; h.dead = false; h.hp = h.maxHp; h.potions = 2; h.keys = 0; h.souls = 30; h.cd = {}; h.buff = {}; } G.allies = []; }
function openStation(st, h) {
  const dev = h.dev;
  if ('QWZY'.includes(st.id)) {
    const wi = 'QWZY'.indexOf(st.id), w = WORLDS[wi], key = w.id;
    if (wi === 3 && !finUnlocked()) { msg('The Hollow Throne is sealed until all three worlds are conquered.', '#c8a0ff', 3); Snd.play('error'); return; }
    openMenu({ dev, title: w.name, sub: `${w.floors.length} floors — pick any floor you have reached`, col: '#8a7aaa', build: () => {
      const prog = SAVE.progress[key] || 0;
      return w.floors.map((f, i) => ({ label: `${i + 1}. ${f.name}`, right: i < prog ? 'cleared' : i === prog ? 'next' : 'locked', rightCol: i < prog ? '#9fffe0' : '#ffd27a', disabled: i > prog, why: 'Clear the previous floor first.',
        desc: f.boss ? 'Boss floor: ' + BOSSES[f.boss].name + '.' : f.arena ? 'Arena floor: the gates seal and waves pour in until the court is clear.' : f.gimmick === 'reaper' ? 'A winding labyrinth. The Pale Collector hunts you. You cannot kill it — only outrun it, or drive it off with a potion.' : f.gimmick === 'dark' ? 'Pitch-black burrows. Only your own light (and torches) reveal what crawls toward you.' : f.gimmick === 'meteors' ? 'Fire rains from the ceiling. Watch the red circles and keep moving.' : 'Explore, find keys, smash spawners, and reach the exit portal.',
        act: () => { beginRun(); startCampaignFloor(wi, i); return 'close'; } }));
    } });
  } else if (st.id === 'N') {
    openMenu({ dev, title: 'Endless Descent', sub: `Best depth ${SAVE.endless.best}. Checkpoint every 18 floors. The Pale Collector stalks every 6th.`, col: '#3a8a7a', build: () => {
      const it = [{ label: 'Begin at Depth 1', desc: 'Floors cycle Necropolis → Caverns → Foundry every 6 depths. Depth 19+ is Hard, 37+ Brutal (more gold).', act: () => { beginRun(); startEndlessFloor(1); return 'close'; } }];
      if (SAVE.endless.checkpoint > 1) it.push({ label: `Resume at checkpoint: Depth ${SAVE.endless.checkpoint}`, desc: 'Start from your deepest checkpoint portal.', act: () => { beginRun(); startEndlessFloor(SAVE.endless.checkpoint); return 'close'; } });
      return it;
    } });
  } else if (st.id === 'A') {
    const mods = dailyMods();
    openMenu({ dev, title: 'The Proving Pit', sub: `Today: ${mods.map(m => m.name).join(' + ')} · best ${SAVE.arena.best}/6 waves`, col: '#a04a3a', build: () => [
      { header: true, label: "TODAY'S RULES" }, ...mods.map(m => ({ label: m.name, right: '', desc: m.desc, disabled: true })),
      { label: SAVE.arena.daily[todayKey()] ? 'Fight again (already cleared today)' : 'Enter the Pit', desc: 'Survive 6 waves. Supplies drop between waves. Clear all 6 for 1000 gold.', act: () => { beginRun(); startArena(); return 'close'; } }] });
    MENU.sel = MENU.items.length - 1;
  } else if (st.id === 'M') openShop(h);
  else if (st.id === 'K') openArmory(h);
  else if (st.id === 'T') {
    openMenu({ dev, w: 720, title: `${h.def.name}'s Masteries`, sub: 'Lifetime feats. Each tier grants a permanent bonus to this hero.', col: '#a0905a', build: () => masteriesFor(h.id).map(ms => {
      const v = Math.floor((SAVE.mastery[h.id] || {})[ms.stat] || 0); let tier = -1; ms.tiers.forEach((t, i) => { if (v >= t) tier = i; });
      const nextT = ms.tiers[tier + 1];
      return { label: `[${ms.group}] ${ms.name} ${tier >= 0 && ms.tiers.length > 1 ? ['I', 'II', 'III'][tier] : ''}`, right: nextT ? `${v} / ${nextT}` : 'MASTERED', rightCol: tier >= 0 ? '#9fffe0' : '#ffd27a',
        desc: `Track: ${MASTERY_TRACK[ms.stat] || ms.stat}. ${tier >= 0 ? 'Current bonus: ' + ms.text(tier) + '. ' : ''}${nextT ? 'Next: ' + ms.text(tier + 1) : ''}`, act: () => { } };
    }) });
  } else if (st.id === 'H') {
    openMenu({ dev, title: 'Hero Shrine', sub: 'Change who you play. Each hero keeps their own gear and masteries.', col: '#a05a8a', build: () => HEROES.map(d => {
      const taken = G.heroes.some(o => o !== h && o.id === d.id);
      return { label: d.name, right: d.id === h.id ? 'current' : taken ? 'taken' : d.role, rightCol: d.color, disabled: taken, why: 'Another player is using that hero.', desc: d.blurb,
        act: () => { if (d.id !== h.id) { rebuildHero(h, d.id); Snd.play('revive'); } return 'close'; } };
    }) });
  } else if (st.id === 'O') openOptions(dev);
}
function openShop(h) {
  const id = h.id;
  openMenu({ dev: h.dev, w: 720, title: 'The Peddler', sub: `${h.def.name}'s bank: ${bankOf(h.id)} gold`, col: '#a08a3a', build() {
    this.sub = `${h.def.name}'s bank: ${bankOf(h.id)} gold (gold is kept per hero)`;
    const own = SAVE.owned[id], it = [{ header: true, label: 'WEAPONS (change your weapon ability)' }];
    for (const w of WEAPONS[id]) if (w.id !== 'base') { const has = own.weapons.includes(w.id); it.push({ label: `${w.name} — ${w.ability}`, right: has ? 'owned' : `${w.cost}g`, rightCol: has ? '#9fffe0' : undefined, disabled: has || bankOf(id) < w.cost, why: has ? 'Already owned.' : 'Not enough gold in the bank.', desc: w.desc, act: () => { SAVE.banks[id] -= w.cost; own.weapons.push(w.id); persist(); Snd.play('coin'); } }); }
    it.push({ header: true, label: 'TALISMANS (change your potion ability)' });
    for (const t of TALISMANS[id]) if (t.id !== 'base') { const has = own.talismans.includes(t.id); it.push({ label: t.name, right: has ? 'owned' : `${t.cost}g`, rightCol: has ? '#9fffe0' : undefined, disabled: has || bankOf(id) < t.cost, why: has ? 'Already owned.' : 'Not enough gold.', desc: t.desc, act: () => { SAVE.banks[id] -= t.cost; own.talismans.push(t.id); persist(); Snd.play('coin'); } }); }
    it.push({ header: true, label: 'RELICS (cooldown items, 3 ranks)' });
    for (const r of RELICS) { const rk = own.relics[r.id] || 0, cost = r.cost[rk]; it.push({ label: `${r.name}${rk ? ' (rank ' + rk + ')' : ''}`, right: rk >= 3 ? 'max' : `${rk ? 'rank up ' : ''}${cost}g`, rightCol: rk >= 3 ? '#9fffe0' : undefined, disabled: rk >= 3 || bankOf(id) < cost, why: rk >= 3 ? 'Already max rank.' : 'Not enough gold.',
      desc: `${r.cd}s cooldown. ` + r.desc.map((d, i) => `R${i + 1}: ${d}`).join(' · '), act: () => { SAVE.banks[id] -= cost; own.relics[r.id] = rk + 1; if (!SAVE.loadout[id].relic) SAVE.loadout[id].relic = r.id; persist(); Snd.play('coin'); const nh = rebuildHero(h); h = nh; } }); }
    return it;
  } });
}
function openArmory(h) {
  const id = h.id;
  openMenu({ dev: h.dev, w: 720, title: 'Armory', sub: `${h.def.name}'s loadout — ◂ ▸ to change`, col: '#7a8a9a', build() {
    const own = SAVE.owned[id], lo = SAVE.loadout[id];
    const cyc = (list, cur, set) => d => { const i = list.indexOf(cur); set(list[(i + d + list.length) % list.length]); persist(); h = rebuildHero(h); };
    const ws = WEAPONS[id].filter(w => own.weapons.includes(w.id)), w = WEAPONS[id].find(x => x.id === lo.weapon);
    const ts = TALISMANS[id].filter(t => own.talismans.includes(t.id)), t = TALISMANS[id].find(x => x.id === lo.talisman);
    const rs = [null, ...RELICS.filter(r => own.relics[r.id]).map(r => r.id)], r = lo.relic ? RELIC[lo.relic] : null;
    return [
      { label: `Weapon: ${w.name}`, right: w.ability, desc: w.desc + ` (${ws.length} owned)`, cycle: cyc(ws.map(x => x.id), lo.weapon, v => lo.weapon = v) },
      { label: `Talisman: ${t.name}`, right: 'potion', desc: t.desc + ` (${ts.length} owned)`, cycle: cyc(ts.map(x => x.id), lo.talisman, v => lo.talisman = v) },
      { label: `Relic: ${r ? r.name + ' (rank ' + own.relics[r.id] + ')' : 'none'}`, right: r ? r.cd + 's' : '', desc: r ? r.desc.slice(0, own.relics[r.id]).join(' · ') : 'Buy relics at the Peddler or find them in legendary chests.', cycle: cyc(rs, lo.relic, v => lo.relic = v) },
      { label: 'Done', act: () => 'close' }];
  } });
}
function openGameplayRules(dev) {
  openMenu({ dev, title: 'Gameplay rules', sub: 'Unverified rules default ON; Bomb Siege and Extended Realms default OFF', col: '#a08a5a', build: () => {
    const s = SAVE.settings; const flip = k => () => { s[k] = !RULE(k); persist(); };
    return [...RULE_INFO.map(([k, name, desc]) => ({ label: `${name}: ${RULE(k) ? 'On' : 'Off'}`, desc, cycle: flip(k), act: flip(k) })),
      { label: `Gold multiplier: x${RULE('goldMul')}`, desc: 'Multiplies all gold picked up (default x1).', cycle: d => { const i = GOLD_MULS.indexOf(RULE('goldMul')); s.goldMul = GOLD_MULS[(i + (d || 1) + GOLD_MULS.length) % GOLD_MULS.length]; persist(); }, act: () => { const i = GOLD_MULS.indexOf(RULE('goldMul')); s.goldMul = GOLD_MULS[(i + 1) % GOLD_MULS.length]; persist(); } },
      { label: 'Back', act: () => { openOptions(dev); } }];
  } });
}
function openOptions(dev) {
  openMenu({ dev, title: 'Options', sub: 'Saved in this browser', col: '#a08a5a', build: () => {
    const s = SAVE.settings;
    return [
      { label: `Difficulty: ${(DIFFS[s.difficulty] || DIFFS.normal).name}`, desc: 'Easy / Normal: unlimited rez coins. Hard: 3 rez coins, loot x2. Unfair: 1 rez coin, no food, loot x3.', cycle: d => { s.difficulty = DIFF_ORDER[(DIFF_ORDER.indexOf(s.difficulty) + (d || 1) + 4) % 4]; persist(); }, act: () => { s.difficulty = DIFF_ORDER[(DIFF_ORDER.indexOf(s.difficulty) + 1) % 4]; persist(); } },
      { label: 'Gameplay rules...', desc: 'Toggle rules that came from unverified sources, Bomb Siege, and the gold multiplier.', act: () => { openGameplayRules(dev); } },
      { label: `Health drain: ${s.hunger ? 'On' : 'Off'}`, desc: 'Optional old-school rule: health ticks down slowly while in a dungeon.', cycle: () => { s.hunger = !s.hunger; persist(); }, act: () => { s.hunger = !s.hunger; persist(); } },
      { label: `Screen shake: ${s.shake ? 'On' : 'Off'}`, desc: 'Camera shake on heavy hits and explosions.', cycle: () => { s.shake = !s.shake; persist(); }, act: () => { s.shake = !s.shake; persist(); } },
      { label: `Sound: ${Snd.muted ? 'Off' : 'On'}`, desc: 'Toggle all sound (also M during play).', act: () => { Snd.toggle(); } },
      { label: 'Erase all progress', col: '#ff8a7a', desc: 'Wipes bank, gear, masteries and world progress. Press twice.', act: () => { if (!MENU.armed) { MENU.armed = true; MENU.note = 'Press again to erase everything.'; return; } SAVE = defaultSave(); persist(); for (const h of G.heroes.slice()) rebuildHero(h); MENU.note = 'Progress erased.'; MENU.armed = false; } },
      { label: 'Close', act: () => 'close' }];
  } });
}

// ---------------------------------------------------------------- pause
function openPause(dev) {
  openMenu({ dev, title: 'Paused', sub: G.mode === 'hub' ? "Wayfarer's Rest" : `${G.worldName} — ${G.floorName}`, col: '#8a7a5a', build: () => {
    const it = [{ label: 'Resume', act: () => 'close' }, { label: 'Controls', act: () => { closeMenu(); scene = 'controls'; sceneT = 0; CONTROLS_BACK = 'game'; return 'close'; } }, { label: 'Options', act: () => { openOptions(dev); } }];
    if (G.mode !== 'hub') it.push({ label: 'Retreat to camp', desc: `Gold from cleared floors (${Math.floor(G.secured || 0)}) is already banked. Gold picked up on this floor is lost.`, act: () => { closeMenu(); G.purse = G.secured || 0; bankAndReturn(); return 'close'; } });
    it.push({ label: 'Quit to title', desc: G.mode === 'hub' ? '' : 'Unbanked gold is lost.', act: () => { closeMenu(); scene = 'title'; sceneT = 0; return 'close'; } });
    return it;
  } });
}
let CONTROLS_BACK = 'title';

// ---------------------------------------------------------------- title / select / results / controls screens
function drawBackdrop(t) {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0d0a14'); g.addColorStop(1, '#1d1008'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 60; i++) { const x = (hash(i, 3) * W + t * 12 * (0.3 + hash(i, 7))) % W, y = H - ((hash(i, 5) * H + t * 30 * (0.4 + hash(i, 9))) % H); circ(x, y, 1 + hash(i, 1) * 2, `rgba(255,${120 + hash(i, 2) * 100 | 0},60,${0.25 + 0.4 * hash(i, 4)})`); }
  ctx.fillStyle = '#07050a'; ctx.beginPath(); ctx.moveTo(0, H); for (let x = 0; x <= W; x += 48) ctx.lineTo(x, H - 90 - hash(x, 1) * 70 - (x % 96 ? 0 : 40)); ctx.lineTo(W, H); ctx.fill();
}
function drawTitle() {
  drawBackdrop(sceneT);
  const k = Math.min(1, sceneT * 1.5);
  ctx.globalAlpha = k;
  txt(GAME_TITLE, W / 2, 170, 78, '#ffcf7a', 'center'); txt(GAME_SUB, W / 2, 210, 22, '#d8b0ff', 'center');
  HEROES.forEach((d, i) => drawHeroSprite(d, W / 2 + (i - 2) * 110, 330 + Math.sin(sceneT * 2 + i) * 4, 1.57 + Math.sin(sceneT + i) * 0.4, 2.4, { sprMul: 1.8, pose: { anim: 'idle', dir: 'down', t: sceneT + i }, walk: sceneT * 6 + i, weapon: 'base' }));
  HEROES.forEach((d, i) => txt(d.name, W / 2 + (i - (HEROES.length - 1) / 2) * 168, 390, 13, d.color, 'center'));
  if (Math.floor(sceneT * 2) % 2 === 0) txt('Press ENTER / CLICK / (A) to begin', W / 2, 460, 20, '#fff', 'center');
  txt('C — controls    ·    up to 4 players: keyboard+mouse, a second keyboard cluster, and gamepads', W / 2, 500, 12, '#bba88a', 'center', 'normal');
  txt(`Banked ${bankTotal()} gold · Worlds ${['w1', 'w2', 'w3'].filter(w => SAVE.progress[w] >= 4).length}/3 · Endless best ${SAVE.endless.best} · Arena best ${SAVE.arena.best}/6`, W / 2, 530, 12, '#998a70', 'center', 'normal');
  txt('An original action-dungeon crawler. All art and sound are generated in code.', W / 2, H - 16, 10, '#665a4a', 'center', 'normal');
  ctx.globalAlpha = 1;
}
const SEL = { slots: [] }; // [{dev, idx, ready}]
function drawSelect() {
  drawBackdrop(sceneT);
  txt('Choose your heroes', W / 2, 40, 28, '#ffcf7a', 'center');
  txt('Press confirm on any keyboard cluster or gamepad to join (P1: Enter/J/Click · P2: Numpad1 or . · Pads: A) · ◂ ▸ or mouse to pick', W / 2, 62, 12, '#bba88a', 'center', 'normal');
  // --- row of all heroes: portrait cards with the players currently on each one
  const N = HEROES.length, gap = 12, cw = Math.min(172, (W - 72 - gap * (N - 1)) / N), ch = 182, cx0 = W / 2 - (N * cw + (N - 1) * gap) / 2, cy = 78;
  SEL.cards = [];
  HEROES.forEach((d, k) => {
    const x = cx0 + k * (cw + gap), on = SEL.slots.map((o, j) => ({ o, j })).filter(e => e.o.idx === k);
    SEL.cards.push([x, cy, cw, ch]);
    const lock = on.find(e => e.o.ready);
    panel(x, cy, cw, ch, 0.85, lock ? PCOL[lock.j] : on.length ? hexA(PCOL[on[0].j], 0.9) : '#3a3028');
    const pr = 56, px = x + cw / 2, py = cy + 70;
    circ(px, py, pr + 3, '#0c0a08', d.color, 2);
    if (!drawPortrait(d, px, py, pr)) { ctx.save(); ctx.beginPath(); ctx.arc(px, py, pr, 0, 6.28); ctx.clip(); drawHeroSprite(d, px, py + 22, 1.57, 2.6, { walk: 0, weapon: 'base', noShadow: true }); ctx.restore(); }
    if (!on.length && SEL.slots.length) { ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.arc(px, py, pr, 0, 6.28); ctx.fill(); }
    txt(d.name, px, cy + 148, d.name.length > 14 ? 14 : 16, d.accent, 'center');
    txt(d.role.toUpperCase(), px, cy + 166, 10, d.color, 'center');
    on.forEach((e, n) => { const bx = x + 8 + n * 30, by = cy + 8; ctx.fillStyle = e.o.ready ? PCOL[e.j] : 'rgba(0,0,0,0.75)'; ctx.fillRect(bx, by, 26, 17); ctx.strokeStyle = PCOL[e.j]; ctx.lineWidth = 2; ctx.strokeRect(bx + 0.5, by + 0.5, 25, 16);
      txt('P' + (e.j + 1), bx + 13, by + 13, 11, e.o.ready ? '#111' : PCOL[e.j], 'center'); });
    if (lock) { txt('✔', x + cw - 16, cy + 22, 16, PCOL[lock.j], 'center');
      if (SEL.slots.some(o => !o.ready)) { ctx.fillStyle = 'rgba(10,8,6,0.55)'; ctx.fillRect(x + 2, cy + 2, cw - 4, ch - 4); txt(`TAKEN · P${lock.j + 1}`, px, cy + 128, 13, PCOL[lock.j], 'center'); } }   // one hero per player
  });
  // --- one detail panel per player slot (up to 4)
  const pw = (N * cw + (N - 1) * gap - 3 * gap) / 4, ph = 352, py0 = cy + ch + 14;
  for (let i = 0; i < 4; i++) {
    const x = cx0 + i * (pw + gap), y = py0, s = SEL.slots[i];
    panel(x, y, pw, ph, 0.82, s ? PCOL[i] : '#3a3028');
    if (!s) { txt(`P${i + 1}`, x + pw / 2, y + 160, 28, '#4a4038', 'center'); txt('press confirm to join', x + pw / 2, y + 188, 12, '#5a5048', 'center', 'normal'); continue; }
    const d = HEROES[s.idx];
    txt(`P${i + 1} · ${s.dev === 'kb1' ? 'Keyboard + Mouse' : s.dev === 'kb2' ? 'Keyboard 2' : 'Gamepad ' + (+s.dev.slice(3) + 1)}`, x + pw / 2, y + 20, 11, PCOL[i], 'center');
    txt('◂', x + 12, y + 50, 18, s.ready ? '#5a5048' : '#ffd27a'); txt('▸', x + pw - 24, y + 50, 18, s.ready ? '#5a5048' : '#ffd27a');
    txt(d.name, x + pw / 2, y + 48, d.name.length > 15 ? 17 : 20, d.accent, 'center');
    txt(d.title, x + pw / 2, y + 66, 12, '#cbb', 'center', 'normal');
    // live sprite preview (turns through the four directions) on the left, moves on the right
    const sx = x + 52, sy = y + 238, dirs = ['down', 'right', 'up', 'left'], dir = dirs[Math.floor(sceneT / 1.5) % 4];
    ctx.fillStyle = hexA(d.color, 0.12); ctx.beginPath(); ctx.ellipse(sx, sy - 66, 44, 82, 0, 0, 6.28); ctx.fill();
    if (hasSprite(d)) drawHeroArt(d, sx, sy - 20, 0, 1, { sprMul: 1.55, pose: { anim: Math.floor(sceneT / 3) % 2 ? 'run' : 'idle', dir, t: sceneT, moving: true } });
    else drawHeroSprite(d, sx, sy - 8, 1.57 + Math.sin(sceneT * 1.5) * 0.6, 2.2, { walk: sceneT * 5, weapon: SAVE.loadout[d.id].weapon });
    txt(d.role.toUpperCase(), x + 100, y + 96, 10, d.color, 'left');
    let my = y + 114; d.moves.forEach(mv => { my = wrapText('· ' + mv, x + 100, my, pw - 110, 13, 10, '#d8ccb0') + 3; });
    const blY = Math.max(sy + 10, my + 4); ctx.fillStyle = 'rgba(255,210,120,0.15)'; ctx.fillRect(x + 14, blY - 8, pw - 28, 1);
    wrapText(d.blurb, x + 14, blY + 8, pw - 28, 14, 11, '#bba88a');
    const taken = SEL.slots.some((o, j) => j !== i && o.idx === s.idx && o.ready);
    txt(s.ready ? 'READY' : taken ? 'taken by another player' : 'confirm = ready · back = leave', x + pw / 2, y + ph - 14, s.ready ? 16 : 11, s.ready ? '#9fffe0' : taken ? '#f88' : '#ffd27a', 'center');
  }
  if (SEL.slots.length && SEL.slots.every(s => s.ready)) { if (Math.floor(sceneT * 3) % 2) txt('All ready — press START / Enter (or P1 confirm) to enter camp', W / 2, 640, 14, '#9fffe0', 'center'); }
  txt('Esc / B: back', W - 60, 40, 11, '#887a66', 'center', 'normal');
}
function drawResults() {
  drawWorld(); ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H);
  const R2 = RESULTS, w = 560, x = (W - w) / 2, y = 90;
  panel(x, y, w, 430, 0.94, R2.defeat ? '#a03a2a' : '#a08a3a');
  txt(R2.title, W / 2, y + 48, 30, R2.defeat ? '#ff9a8a' : '#ffe6b0', 'center');
  const rows = [...(R2.loot ? [['Floor loot (' + R2.lootNote + ')', '+' + R2.loot]] : []), ['Foes slain', R2.kills], ['Spawners destroyed', R2.spawners], ['Time', `${Math.floor(R2.time / 60)}:${String(Math.floor(R2.time % 60)).padStart(2, '0')}`], [R2.defeat ? 'Gold kept (secured)' : 'Gold gathered this floor', R2.defeat ? Math.floor(R2.purse) : Math.floor(R2.gained)], ['Party purse', Math.floor(R2.purse)]];
  rows.forEach(([a, b], i) => { txt(a, x + 50, y + 100 + i * 28, 15, '#d8ccb0'); txt(String(b), x + w - 50, y + 100 + i * 28, 15, '#ffd84a', 'right'); });
  (R2.masteries || []).slice(0, 3).forEach((m, i) => txt('★ ' + m, W / 2, y + 255 + i * 18, 12, '#ffd27a', 'center'));
  const opts = resultOpts();
  opts.forEach((o, i) => { const oy = y + 320 + i * 38; if (i === R2.sel) { ctx.fillStyle = 'rgba(255,210,120,0.16)'; ctx.fillRect(x + 60, oy - 22, w - 120, 32); ctx.strokeStyle = '#ffd27a'; ctx.strokeRect(x + 60.5, oy - 21.5, w - 121, 31); } o._r = [x + 60, oy - 22, w - 120, 32]; txt(o.label, W / 2, oy, 16, i === R2.sel ? '#fff' : '#cbb', 'center'); });
}
function resultOpts() {
  const R2 = RESULTS, o = [];
  if (R2.next) o.push({ label: R2.next.label, go: R2.next.go });
  o.push({ label: R2.defeat ? (R2.purse > (G.bankedRun || 0) ? `Return to camp (bank ${Math.floor(R2.purse - (G.bankedRun || 0))} arena gold)` : 'Return to camp (this floor\'s gold is lost)') : `Return to camp (${Math.floor(G.secured || 0)} gold banked)`, go: () => { G.secured = R2.defeat ? R2.purse : G.secured; bankAndReturn(); } });
  RESULTS._opts = o; return o;
}
function drawControls() {
  drawBackdrop(sceneT); txt('Controls', W / 2, 50, 28, '#ffcf7a', 'center');
  const colX = [40, 420, 800], rows = [
    ['', 'Keyboard + Mouse (P1)', 'Gamepad', 'Keyboard 2 (P2)'],
    ['Move', 'WASD', 'Left stick / D-pad', 'Arrow keys'], ['Aim', 'Mouse', 'Right stick (fires primary)', 'Movement direction + auto-aim'],
    ['Primary attack', 'Left click / J', 'X', 'Numpad1 / .'], ['Secondary attack', 'Right click / K', 'Y', 'Numpad2 / /'],
    ['Defend / mobility', 'Shift / L', 'RT / LT / R3', 'Numpad3 / Right Shift'], ['Weapon ability', 'Space / I', 'B', 'Numpad0 / Right Ctrl'],
    ['Potion ability', 'Q', 'LB', 'Numpad4 / ;'], ['Relic', 'E', 'RB', "Numpad5 / '"], ['Interact / confirm', 'Enter / Click', 'A', 'Numpad1 / NumpadEnter'], ['Pause', 'Esc / P', 'Start', 'Numpad +'],
  ];
  rows.forEach((r, i) => { const y = 100 + i * 26; txt(r[0], 60, y, 13, '#d8b070'); for (let k = 1; k < 4; k++) txt(r[k], 260 + (k - 1) * 300, y, i ? 13 : 14, i ? '#e8dcc0' : '#ffd27a', 'left', i ? 'normal' : 'bold'); });
  const notes = [
    `${HERO_NAMES.zoey} (rune caster): Space = Ember rune, Shift = Rime rune, Right click = Storm rune. Two runes prime one of 9 spells; Left click casts (hold for channeled spells).`,
    'On a gamepad: Y = Ember, X = Rime, B = Storm; cast with the right stick or a trigger.',
    `${HERO_NAMES.theo}: hold the ability to wind up Whirlwind, release to spin and steer. After a Rush (Shift): Primary = Rush Strike, Secondary = Leap Slam.`,
    `${HERO_NAMES.gela}: hold Defend for a wind barrier (reflects missiles); Primary while blocking = Shield Bash. Hold Secondary to charge a Lance Lunge.`,
    `${HERO_NAMES.paladin}: slow greatsword combo; Secondary = heavy overhead; hold Defend for a golden barrier that reflects missiles; Ability = Holy Slam; Potion = Golden Wings.`,
    `${HERO_NAMES.isaac}: hold Secondary to charge a Power Shot; shoot your own bomb for an Explosive Shot; press Ability while charging to load an explosive arrow.`,
    `${HERO_NAMES.vesper}: Soul Bolt; hold Secondary to aim Bone Spikes; Ghostwalk (Shift) harvests souls; tap Ability to Raise Dead, hold with 10 souls for a Bone Golem.`,
    'Revive a fallen hero with shared gold (press confirm while dead). M toggles sound. F toggles fullscreen.',
  ];
  notes.forEach((n2, i) => wrapText(n2, 60, 404 + i * 27, W - 120, 14, 12, '#cfc2a8'));
  txt('Esc / B / Enter: back', W / 2, H - 14, 11, '#887a66', 'center', 'normal');
}
