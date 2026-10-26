'use strict';
// Floor layouts: hand-designed camp, boss arenas and daily arena; campaign floors come from genStage() (bottom of file).
// Legend: # wall, space void, . floor, S start, X exit, = locked gate, k key, f ration, F feast, p potion,
// $ gold, c chest, L legendary chest, v urn/crate, b explosive barrel, % cracked wall (explosives break it),
// ^ spike trap, 1-3 spawner tier, e foe, E elite foe, a arena floor, _ arena gate, R reaper, B boss,
// ~ pit / lava (blocks walking, not missiles), t wall torch, g grave marker, P pylon, w web/rubble decor
const MAPS = {
  hub: [
    '##########################################',
    '#t.......t#######t###t#######t.........t#',
    '#.........#..Q..#.....#..W..#...........#',
    '#..T......#.....#.....#.....#.......K...#',
    '#.........##...##.....##...##...........#',
    '#.......................................#',
    '#....~~~.......................~~~......#',
    '#....~~~...........H...........~~~......#',
    '#.......................................#',
    '#..M.............S.S....................#',
    '#.......................................#',
    '#.......................................#',
    '#....~~~.......................~~~......#',
    '#....~~~...........O...........~~~......#',
    '#.......................................#',
    '#.........##...##.....##...##...........#',
    '#..N......#.....#.....#.....#.......A...#',
    '#.........#..Z..#.....#..Y..#...........#',
    '#t.......t#######t###t#######t.........t#',
    '##########################################',
  ],
  // ---------------- World I: the Sunken Necropolis (undead)
  w1boss: [
    '##################################',
    '#t..............................t#',
    '#................................#',
    '#...~~.......g.......g.......~~..#',
    '#...~~.......................~~..#',
    '#................................#',
    '#........#...............#.......#',
    '#................B...............#',
    '#................................#',
    '#........#...............#.......#',
    '#................................#',
    '#...~~.......g.......g.......~~..#',
    '#...~~.......................~~..#',
    '#................................#',
    '#...............S.S..............#',
    '#t..............................t#',
    '##################################',
  ],
  // ---------------- World II: the Gloomroot Caverns (beasts)
  w2boss: [
    '########################################',
    '#t....................................t#',
    '#......~~~~......................~~....#',
    '#......~~~~......................~~....#',
    '#......................................#',
    '#..........w..............w............#',
    '#......................................#',
    '#...................B..................#',
    '#......................................#',
    '#.......w...........................w..#',
    '#.....~~~.......................~~~....#',
    '#.....~~~.......................~~~....#',
    '#......................................#',
    '#..................S.S.................#',
    '#t....................................t#',
    '########################################',
  ],
  // ---------------- World III: the Ember Foundry (cult & fiends)
  w3boss: [
    '######################################',
    '#t..................................t#',
    '#....~~~....................~~~.....#',
    '#....~~~....................~~~.....#',
    '#...................................#',
    '#.........#.................#.......#',
    '#...................................#',
    '#..................B................#',
    '#...................................#',
    '#.........#.................#.......#',
    '#...................................#',
    '#....~~~....................~~~.....#',
    '#....~~~.........S.S........~~~.....#',
    '#t..................................t#',
    '######################################',
  ],
  // ---------------- Final area: the Hollow Throne
  fboss: [
    '##########################################',
    '#t......................................t#',
    '#........................................#',
    '#.....P........~~~~~~~~~~~~.......P......#',
    '#..............~~~~~~~~~~~~..............#',
    '#........................................#',
    '#....................B...................#',
    '#........................................#',
    '#........................................#',
    '#........~~~~.................~~~~.......#',
    '#........~~~~.........P.......~~~~.......#',
    '#........................................#',
    '#...................S.S..................#',
    '#t......................................t#',
    '##########################################',
  ],
  arena: [
    '########################################',
    '#t..................................t..#',
    '#......................................#',
    '#....~~~......................~~~......#',
    '#....~~~..........#..#........~~~......#',
    '#......................................#',
    '#.........#....................#.......#',
    '#..................SS..................#',
    '#.........#....................#.......#',
    '#......................................#',
    '#....~~~..........#..#........~~~......#',
    '#....~~~......................~~~......#',
    '#......................................#',
    '#t..................................t..#',
    '########################################',
  ],
};

// ================================================================ Slayer-style stages (David, Oct 2026)
// Floors are a chain of battle rooms joined by corridors, like Gauntlet: Slayer Edition: big "mini-stage" rooms with
// several spawners, enemy groups, pillars, cover and pools, plus medium/small rooms and side treasure rooms.
// genStage() returns ASCII rows (legend above) with rows.rooms = room rectangles, used for room activation (DEV.rooms).
function genStage(o) {
  let seed = (o.seed >>> 0) || 1;
  const rnd = () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1)), pk = a => a[Math.floor(rnd() * a.length)], ch = p => rnd() < p;
  const S = DEV.rooms.sizes, CW = DEV.rooms.corridorW;
  const plan = o.plan || 'MLSLML';
  const dims = k => { const z = S[k === 'A' ? 'L' : k]; return { w: ri(z[0], z[1]), h: ri(z[2], z[3]) }; };
  // ---- place a chain of rooms; every link is a straight corridor
  const rooms = [], links = [];
  const hit = (x, y, w, h, m) => rooms.some(r => x < r.x + r.w + m && x + w + m > r.x && y < r.y + r.h + m && y + h + m > r.y) || links.some(c => x < c.x + c.w + 1 && x + w + 1 > c.x && y < c.y + c.h + 1 && y + h + 1 > c.y);
  const bbox = () => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const r of rooms) { x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y); x1 = Math.max(x1, r.x + r.w); y1 = Math.max(y1, r.y + r.h); } return { x0, y0, x1, y1 }; };
  const attach = (a, kind, dirs, lenR) => {
    const { w, h } = dims(kind);
    for (let t = 0; t < 40; t++) {
      const d = pk(dirs), L = ri(lenR[0], lenR[1]); let x, y, c;
      if (d === 'E' || d === 'W') { y = ri(a.y - h + CW + 2, a.y + a.h - CW - 2); x = d === 'E' ? a.x + a.w + L : a.x - L - w;
        const lo = Math.max(a.y, y) + 1, hi = Math.min(a.y + a.h, y + h) - CW - 1; if (hi < lo) continue; const cy = ri(lo, hi);
        c = d === 'E' ? { x: a.x + a.w, y: cy, w: L, h: CW, v: false } : { x: x + w, y: cy, w: L, h: CW, v: false }; }
      else { x = ri(a.x - w + CW + 2, a.x + a.w - CW - 2); y = d === 'S' ? a.y + a.h + L : a.y - L - h;
        const lo = Math.max(a.x, x) + 1, hi = Math.min(a.x + a.w, x + w) - CW - 1; if (hi < lo) continue; const cx = ri(lo, hi);
        c = d === 'S' ? { x: cx, y: a.y + a.h, w: CW, h: L, v: true } : { x: cx, y: y + h, w: CW, h: L, v: true }; }
      if (hit(x, y, w, h, 3)) continue;
      const b = bbox(); if (Math.max(b.x1, x + w) - Math.min(b.x0, x) > DEV.rooms.maxW || Math.max(b.y1, y + h) - Math.min(b.y0, y) > DEV.rooms.maxH) continue;
      const r = { x, y, w, h, kind, from: rooms.indexOf(a) }; rooms.push(r); c.a = rooms.indexOf(a); c.b = rooms.length - 1; links.push(c); return r;
    }
    return null;
  };
  { const k0 = plan[0]; const { w, h } = dims(k0 === 'L' ? 'M' : k0); rooms.push({ x: 0, y: 0, w, h, kind: k0, from: -1 }); }
  const dirW = o.dirs || ['E', 'E', 'S', 'N'];
  for (let i = 1; i < plan.length; i++) { const r = attach(rooms[rooms.length - 1], plan[i], dirW, [3, 7]) || attach(rooms[rooms.length - 1], plan[i], ['E', 'S', 'N', 'W'], [3, 9]); if (!r) break; }
  const chain = rooms.length;
  for (let k = 0; k < (o.side || 0); k++) { const base = rooms[ri(1, Math.max(1, chain - 2))]; const r = attach(base, 'T', ['N', 'S', 'E', 'W'], [3, 5]); if (r) r.side = true; }
  // ---- rasterise
  const b = bbox(), M = 2, GW = b.x1 - b.x0 + M * 2, GH = b.y1 - b.y0 + M * 2;
  const g = []; for (let y = 0; y < GH; y++) g.push(Array(GW).fill('#'));
  for (const r of rooms) { r.x += M - b.x0; r.y += M - b.y0; } for (const c of links) { c.x += M - b.x0; c.y += M - b.y0; }
  const inR = (r, x, y, m = 0) => x >= r.x + m && x < r.x + r.w - m && y >= r.y + m && y < r.y + r.h - m;
  for (const r of rooms) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) g[y][x] = '.';
  for (const c of links) for (let y = c.y; y < c.y + c.h; y++) for (let x = c.x; x < c.x + c.w; x++) g[y][x] = '.';
  const free = (r, m = 1) => { for (let t = 0; t < 80; t++) { const x = ri(r.x + m, r.x + r.w - 1 - m), y = ri(r.y + m, r.y + r.h - 1 - m); if (g[y][x] === '.') return [x, y]; } return null; };
  const put = (r, c, m = 1) => { const p = free(r, m); if (p) g[p[1]][p[0]] = c; return p; };
  const block = (x, y, w, h, c) => { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (g[yy] && g[yy][xx] === '.') g[yy][xx] = c; };
  const hz = o.hazard || '^';
  // ---- interiors: pillars, cover and pools keep a 2-tile clear ring around the walls so every doorway stays connected
  const furnish = r => {
    const big = r.kind === 'L' || r.kind === 'A', med = r.kind === 'M';
    if (big) { const t = ri(0, 3), qx = Math.floor(r.w / 4), qy = Math.floor(r.h / 3);
      if (t === 0) for (const [fx, fy] of [[1, 1], [3, 1], [1, 2], [3, 2]]) block(r.x + fx * qx - 1, r.y + fy * qy - 1, 2, 2, '#');   // four pillars
      else if (t === 1) { for (let x = r.x + 3; x < r.x + r.w - 3; x += 4) { block(x, r.y + qy, 1, 1, '#'); block(x, r.y + r.h - 1 - qy, 1, 1, '#'); } }   // colonnade
      else if (t === 2) { const cx = r.x + (r.w >> 1), cy = r.y + (r.h >> 1); block(cx - 2, cy - 1, 4, 2, hz === '~' ? '~' : '#'); block(r.x + 3, r.y + 3, 3, 1, '#'); block(r.x + r.w - 6, r.y + r.h - 4, 3, 1, '#'); block(r.x + r.w - 6, r.y + 3, 1, 2, '#'); block(r.x + 5, r.y + r.h - 5, 1, 2, '#'); }   // central block + cover walls
      else { block(r.x + qx - 1, r.y + qy, 3, 2, hz); block(r.x + r.w - qx - 2, r.y + r.h - qy - 2, 3, 2, hz); block(r.x + (r.w >> 1), r.y + 3, 2, 2, '#'); block(r.x + (r.w >> 1) - 1, r.y + r.h - 5, 2, 2, '#'); }   // pools / spikes and pillars
    } else if (med && ch(0.6)) { const cx = r.x + (r.w >> 1); block(cx - 3, r.y + (r.h >> 1), 1, 1, '#'); block(cx + 2, r.y + (r.h >> 1), 1, 1, '#'); if (ch(0.5)) block(cx - 1, r.y + 2, 2, 1, hz); }
  };
  const tierMax = o.tierMax || 3, T = () => String(ri(1, tierMax));
  rooms.forEach((r, i) => {
    if (o.arena && i === chain - 1) { r.kind = 'A'; r.arena = true; }
    if (i > 0) furnish(r);
    if (r.side) { put(r, 'c'); put(r, '$'); put(r, '$'); if (ch(0.5)) put(r, ch(0.3) ? 'F' : 'f'); if (ch(0.3)) put(r, 'p'); return; }
    if (i === 0) { const cx = r.x + 2, cy = r.y + (r.h >> 1); g[cy][cx] = 'S'; g[cy][cx + 1] = 'S'; if (ch(0.6)) put(r, 'f'); put(r, 'v'); return; }
    if (r.arena) return;
    const big = r.kind === 'L', med = r.kind === 'M';
    const nSp = big ? ri(2, 3) : med ? (ch(0.75) ? 1 : 0) : (ch(0.25) ? 1 : 0), nGrp = big ? ri(2, 3) : med ? ri(1, 2) : ri(0, 1);
    for (let k = 0; k < nSp; k++) put(r, T(), 2);
    for (let k = 0; k < nGrp; k++) put(r, 'e', 2);
    if (ch((big ? 0.5 : 0.2) + (o.eliteP || 0))) put(r, 'E', 2);
    for (let k = 0; k < (big ? ri(3, 6) : ri(1, 3)); k++) put(r, 'v');
    if (ch(big ? 0.8 : 0.4)) put(r, '$'); if (ch(0.3)) put(r, 'b'); if (big && ch(0.35)) put(r, 'c');
    if (ch(0.3)) put(r, ch(0.3) ? 'F' : 'f'); if (ch(0.1)) put(r, 'p');
    if (o.decor && ch(0.7)) for (let k = 0; k < ri(1, 4); k++) put(r, o.decor);
  });
  // arena: the final room becomes the arena (gates where the corridor enters), exit inside it
  const last = rooms[chain - 1];
  if (last.arena) { for (let y = last.y; y < last.y + last.h; y++) for (let x = last.x; x < last.x + last.w; x++) if (g[y][x] === '.') g[y][x] = 'a';
    const c = links.find(l => l.b === chain - 1); if (c) { const cells = []; for (let y = c.y; y < c.y + c.h; y++) for (let x = c.x; x < c.x + c.w; x++) cells.push([x, y]); const edge = c.v ? (c.y + c.h === last.y ? c.y + c.h - 1 : c.y) : (c.x + c.w === last.x ? c.x + c.w - 1 : c.x); for (const [x, y] of cells) if ((c.v ? y : x) === edge) g[y][x] = '_'; }
    for (let k = 0; k < 2; k++) { const p = free(last, 3); if (p) g[p[1]][p[0]] = 'g'; } }
  { const p = (() => { for (let t = 0; t < 80; t++) { const x = ri(last.x + Math.floor(last.w * 0.6), last.x + last.w - 3), y = ri(last.y + 2, last.y + last.h - 3); if (g[y][x] === '.' || g[y][x] === 'a') return [x, y]; } return [last.x + last.w - 3, last.y + (last.h >> 1)]; })(); g[p[1]][p[0]] = 'X'; }
  // gates on chain corridors, each key in a room before it
  const chainLinks = links.filter(l => l.b < chain && l.b > 1 && !(o.arena && l.b === chain - 1));
  for (let k = 0; k < Math.min(o.gates ?? 1, chainLinks.length); k++) { const c = chainLinks.splice(ri(0, chainLinks.length - 1), 1)[0];
    const mid = c.v ? c.y + (c.h >> 1) : c.x + (c.w >> 1); for (let y = c.y; y < c.y + c.h; y++) for (let x = c.x; x < c.x + c.w; x++) if ((c.v ? y : x) === mid) g[y][x] = '=';
    put(rooms[ri(Math.max(1, c.a - 1), c.a)], 'k', 2); }
  // side rooms: half sit behind a cracked wall (a barrel waits nearby), half behind a gate whose key is on the main path
  for (const l of links) { const r = rooms[l.b]; if (!r.side) continue;
    const mid = l.v ? l.y + (l.h >> 1) : l.x + (l.w >> 1), cell = (x, y) => (l.v ? y : x) === mid;
    if (ch(0.5)) { for (let y = l.y; y < l.y + l.h; y++) for (let x = l.x; x < l.x + l.w; x++) if (cell(x, y)) g[y][x] = '%'; put(rooms[l.a], 'b', 2); }
    else { for (let y = l.y; y < l.y + l.h; y++) for (let x = l.x; x < l.x + l.w; x++) if (cell(x, y)) g[y][x] = '='; put(rooms[l.a], 'k', 2); } }
  if (o.legend) { const sr = rooms.find(r => r.side) || rooms[Math.max(1, chain - 2)]; put(sr, 'L', 2); }
  // wall torches along the top walls of rooms
  if (o.torches !== false) for (const r of rooms) for (let x = r.x + 2; x < r.x + r.w - 2; x += 6) if (g[r.y - 1] && g[r.y - 1][x] === '#' && r.y - 1 > 0) g[r.y - 1][x] = 't';
  const rows = g.map(r => r.join(''));
  rows.rooms = rooms.map(r => ({ x: r.x, y: r.y, w: r.w, h: r.h, kind: r.kind, side: !!r.side, arena: !!r.arena }));
  return rows;
}
// Campaign floors (fixed seeds, so each floor keeps one layout). plan letters: S small, M medium, L large battle room, T treasure.
const STAGE_SPECS = {
  w1f1: { seed: 1101, plan: 'MLMLSL', side: 2, gates: 1, hazard: '^', decor: 'g', tierMax: 2, legend: true },
  w1f3: { seed: 1103, plan: 'MLMA', side: 1, gates: 1, hazard: '^', decor: 'g', tierMax: 2, arena: true },
  w2f1: { seed: 2101, plan: 'MLSLML', side: 1, gates: 1, hazard: '~', decor: 'w', tierMax: 3 },
  w2f2: { seed: 2102, plan: 'SMLSMLM', side: 1, gates: 1, hazard: '~', decor: 'w', tierMax: 3, dirs: ['E', 'S', 'S', 'N'] },
  w2f3: { seed: 2103, plan: 'MLMA', side: 1, gates: 1, hazard: '~', decor: 'w', tierMax: 3, arena: true },
  w3f1: { seed: 3101, plan: 'MLMLSL', side: 2, gates: 2, hazard: '~', tierMax: 3 },
  w3f2: { seed: 3102, plan: 'SMLMLML', side: 1, gates: 1, hazard: '~', tierMax: 3, dirs: ['E', 'E', 'E', 'S', 'N'] },
  w3f3: { seed: 3103, plan: 'MLMA', side: 1, gates: 1, hazard: '~', tierMax: 3, arena: true },
  f1: { seed: 4101, plan: 'MLMLML', side: 2, gates: 2, hazard: '^', decor: 'g', tierMax: 3, legend: true },
};
for (const k in STAGE_SPECS) MAPS[k] = genStage(STAGE_SPECS[k]);
