'use strict';
// Hidden debug overlay: F3 or ` (backtick) toggles. Shows recent damage numbers with tiers, hero cooldowns,
// floor scaling, and essence / shard / stamina meters. Off by default; no effect on gameplay.
const DEBUG = {
  on: false, hurt: false, log: [],
  drawHurt() {   // green = hurtbox (the whole drawn body), yellow = ground circle (movement / contact), cyan = live hero shots
    ctx.save(); ctx.lineWidth = 1;
    for (const f of G.foes) { if (f.hp <= 0) continue; const b = hurtBox(f); ctx.fillStyle = 'rgba(80,255,120,0.16)'; ctx.fillRect(b.l, b.t, b.r - b.l, b.b - b.t); ctx.strokeStyle = '#5f8'; ctx.strokeRect(b.l + 0.5, b.t + 0.5, b.r - b.l - 1, b.b - b.t - 1);
      ctx.strokeStyle = '#ff4'; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.stroke(); }
    ctx.strokeStyle = '#4ff'; for (const s of G.shots) if (s.team === 'hero') { ctx.beginPath(); ctx.arc(s.x, s.y, s.r || 3, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
  },
  hit(f, dmg, o) { this.log.push({ t: G.time, who: (FOES[f.type] && FOES[f.type].name) || f.type, dmg, tier: (o && o.tier) || dmgTier(dmg, o && o.src && (o.src.isHero ? o.src : o.src.owner)), by: o && o.src && o.src.def ? o.src.def.name : (o && o.tag) || '' }); if (this.log.length > 10) this.log.shift(); },
  draw() {
    if (!this.on || typeof G === 'undefined' || !G.heroes) return;
    const x = W - 380, w = 366; let y = 12;
    const lines = [];
    const fl = G.mode === 'endless' ? G.endless : (G.floor != null ? G.floor + 1 : 1);
    lines.push([`DEBUG  mode ${G.mode || '-'}  floor ${fl}  scaling ${ENDLESS.mode}`, '#ffd84a']);
    if (G.mode === 'endless') lines.push([`HP x${ENDLESS.hpMul(fl).toFixed(2)}  DMG x${ENDLESS.dmgMul(fl).toFixed(2)}  trap ${TRAP_DMG(fl)}  biome ${ENDLESS.biome(fl)}${ENDLESS.hunter(fl) ? '  DEATH' : ''}`, '#cfe']);
    lines.push([`foes ${G.foes.length}  spawners ${(G.spawners || []).length}  shots ${G.shots.length}  gold x${RULE('goldMul')}`, '#cfe']);
    for (const h of G.heroes) {
      const cds = Object.entries(h.cd || {}).filter(([, v]) => v > 0).map(([k, v]) => `${k} ${v.toFixed(1)}`).join('  ') || 'ready';
      lines.push([`${h.def.name}  HP ${Math.ceil(h.hp)}/${h.maxHp} (bar ${Math.round(h.hp / h.maxHp * SPEC.hero[h.def.id].uiHp)})  inv ${Math.max(0, h.inv || 0).toFixed(2)}`, h.def.color]);
      lines.push([`  cd: ${cds}`, '#ddd']);
      const meters = [`potions ${h.potions}`, `shards ${Math.round(h.shardMeter || 0)}/100`];
      if (h.def.id === 'vesper') meters.push(`souls ${Math.round(h.souls || 0)}/${SPEC.vesper.essenceMax} (${soulBars(h)} bars${soulFull(h) ? ', FULL' : ''})`);
      if (h.crown) meters.push('CROWN'); if (h.bubble) meters.push('bubble');
      lines.push([`  ${meters.join('  ')}`, '#ddd']);
    }
    lines.push(['recent hits:', '#ffd84a']);
    for (const e of this.log.slice().reverse()) lines.push([`  ${Math.round(e.dmg)} T${e.tier}  ${e.by} -> ${e.who}`, G.time - e.t < 1 ? '#fff' : '#999']);
    ctx.save(); ctx.globalAlpha = 0.82; ctx.fillStyle = '#000'; ctx.fillRect(x - 6, y - 4, w, lines.length * 15 + 10); ctx.globalAlpha = 1;
    ctx.font = '12px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    for (const [s, c] of lines) { ctx.fillStyle = c; ctx.fillText(s.slice(0, 58), x, y); y += 15; }
    ctx.restore();
  },
};
addEventListener('keydown', e => { if (e.code === 'F3' || e.code === 'Backquote') { e.preventDefault(); if (!e.repeat) DEBUG.on = !DEBUG.on; }
  if (e.code === 'KeyH' && !e.repeat && typeof scene !== 'undefined' && scene === 'game') DEBUG.hurt = !DEBUG.hurt; });   // H: draw hurtboxes
