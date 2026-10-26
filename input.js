'use strict';
// Unified input: keyboard+mouse (P1), keyboard right-hand cluster (P2), and up to 4 gamepads (Gamepad API).
const Input = (() => {
  const keys = new Set(), pressedK = new Set();
  const mouse = { x: 0, y: 0, b: [false, false, false], pb: [false, false, false], lastMove: -1e9 };
  let canvasEl = null, VW = 1152, VH = 648;
  const BTN = ['primary', 'secondary', 'defend', 'ability', 'dash', 'potion', 'relic', 'confirm', 'back', 'pause', 'up', 'down', 'left', 'right'];
  // keyboard maps. Caster runes reuse defend/ability/secondary (like the twin-stick original: three face buttons).
  const KB1 = {
    up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'],
    primary: ['KeyJ', 'M0'], secondary: ['KeyK', 'M2'], defend: ['ShiftLeft', 'KeyL'], ability: ['Space', 'KeyI'], dash: ['KeyF', 'M1'],
    potion: ['KeyQ'], relic: ['KeyE'], confirm: ['Enter', 'Space', 'KeyJ', 'M0'], back: ['Escape', 'Backspace'], pause: ['Escape', 'KeyP'],
  };
  const KB2 = {
    up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'],
    primary: ['Numpad1', 'Period'], secondary: ['Numpad2', 'Slash'], defend: ['Numpad3', 'ShiftRight'], ability: ['Numpad0', 'ControlRight'], dash: ['Numpad6', 'Comma'],
    potion: ['Numpad4', 'Semicolon'], relic: ['Numpad5', 'Quote'], confirm: ['Numpad1', 'Period', 'NumpadEnter'], back: ['NumpadDecimal', 'Backslash'], pause: ['NumpadAdd'],
  };
  const devState = {}; // per device id: previous button states for edge detection
  const PREVENT = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Slash', 'Quote', 'Period', 'Enter', 'Tab', 'Backspace', 'ShiftRight', 'ControlRight', 'Comma']);
  function attach(cv, w, h) {
    canvasEl = cv; VW = w; VH = h;
    addEventListener('keydown', e => { if (PREVENT.has(e.code) || e.code.startsWith('Numpad')) e.preventDefault(); if (!keys.has(e.code)) pressedK.add(e.code); keys.add(e.code); Snd.init(); });
    addEventListener('keyup', e => keys.delete(e.code));
    addEventListener('blur', () => { keys.clear(); mouse.b = [false, false, false]; });
    const mp = e => { const r = cv.getBoundingClientRect(); mouse.x = (e.clientX - r.left) * VW / r.width; mouse.y = (e.clientY - r.top) * VH / r.height; };
    cv.addEventListener('mousemove', e => { mp(e); mouse.lastMove = performance.now(); });
    cv.addEventListener('mousedown', e => { mp(e); if (e.button === 1) e.preventDefault(); Snd.init(); cv.focus(); mouse.b[e.button] = true; mouse.lastMove = performance.now(); });
    addEventListener('mouseup', e => { mouse.b[e.button] = false; });
    cv.addEventListener('contextmenu', e => e.preventDefault());
  }
  const kd = c => c === 'M0' ? mouse.b[0] : c === 'M1' ? mouse.b[1] : c === 'M2' ? mouse.b[2] : keys.has(c);
  function pads() { try { return Array.from(navigator.getGamepads ? navigator.getGamepads() : []).filter(Boolean); } catch (e) { return []; } }
  const dz = (x, y, d) => { const m = Math.hypot(x, y); if (m < d) return [0, 0]; const s = Math.min(1, (m - d) / (1 - d)) / m; return [x * s, y * s]; };
  // raw read of a device -> {buttons:{name:bool}, mx,my, ax,ay, aimActive}
  function readRaw(dev, soloArrows) {
    const out = { b: {}, mx: 0, my: 0, ax: 0, ay: 0, aim: false, aimFire: false, kind: dev };
    if (dev === 'kb1' || dev === 'kb2') {
      const map = dev === 'kb1' ? KB1 : KB2;
      for (const n of BTN) out.b[n] = (map[n] || []).some(kd);
      if (dev === 'kb1' && soloArrows) { for (const n of ['up', 'down', 'left', 'right']) out.b[n] = out.b[n] || KB2[n].some(kd); }
      out.mx = (out.b.right ? 1 : 0) - (out.b.left ? 1 : 0); out.my = (out.b.down ? 1 : 0) - (out.b.up ? 1 : 0);
      const m = Math.hypot(out.mx, out.my); if (m) { out.mx /= m; out.my /= m; }
      if (dev === 'kb1' && performance.now() - mouse.lastMove < 4000) { out.aim = 'mouse'; }
    } else {
      const gp = pads().find(p => 'pad' + p.index === dev);
      if (!gp) return out;
      const B = i => !!(gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.5));
      [out.mx, out.my] = dz(gp.axes[0] || 0, gp.axes[1] || 0, 0.22);
      if (B(12)) out.my = -1; if (B(13)) out.my = 1; if (B(14)) out.mx = -1; if (B(15)) out.mx = 1;
      const [ax, ay] = dz(gp.axes[2] || 0, gp.axes[3] || 0, 0.3);
      if (ax || ay) { const m = Math.hypot(ax, ay); out.ax = ax / m; out.ay = ay / m; out.aim = 'stick'; out.aimFire = m > 0.55; }
      out.b.primary = B(2); out.b.secondary = B(3); out.b.ability = B(1); out.b.defend = B(7) || B(11); out.b.dash = B(6) || B(10);   // LT / L3 = dash
      out.b.potion = B(4); out.b.relic = B(5); out.b.confirm = B(0); out.b.back = B(1); out.b.pause = B(9);
      out.b.up = out.my < -0.6; out.b.down = out.my > 0.6; out.b.left = out.mx < -0.6; out.b.right = out.mx > 0.6;
    }
    return out;
  }
  // stateful read with pressed/released edges
  function read(dev, soloArrows) {
    const raw = readRaw(dev, soloArrows);
    const prev = devState[dev] || {};
    const st = { mx: raw.mx, my: raw.my, ax: raw.ax, ay: raw.ay, aim: raw.aim, aimFire: raw.aimFire, dev, down: {}, pressed: {}, released: {} };
    for (const n of BTN) { const d = !!raw.b[n]; st.down[n] = d; st.pressed[n] = d && !prev[n]; st.released[n] = !d && !!prev[n]; }
    // mouse edges need the latched pressed flags so very short clicks are not lost
    if (dev === 'kb1') {
      for (const n of BTN) { const m = (KB1[n] || []); if (m.includes('M0') && mouse.pb[0]) st.pressed[n] = true; if (m.includes('M2') && mouse.pb[2]) st.pressed[n] = true; if (m.includes('M1') && mouse.pb[1]) st.pressed[n] = true; }
      for (const n of BTN) { const m = (KB1[n] || []); if (m.some(c => c[0] !== 'M' && pressedK.has(c))) st.pressed[n] = true; }
    } else if (dev === 'kb2') {
      for (const n of BTN) if ((KB2[n] || []).some(c => pressedK.has(c))) st.pressed[n] = true;
    }
    return st;
  }
  // called after every simulation tick
  function commit(devs) {
    for (const d of devs) { const raw = readRaw(d, false); devState[d] = {}; for (const n of BTN) devState[d][n] = !!raw.b[n]; }
    pressedK.clear(); mouse.pb = [false, false, false];
  }
  // detect any device pressing "confirm" this tick (for joining)
  function joinPress(taken) {
    const devs = ['kb1', 'kb2', ...pads().map(p => 'pad' + p.index)];
    for (const d of devs) { if (taken.includes(d)) continue; const s = read(d); if (s.pressed.confirm) return d; }
    return null;
  }
  addEventListener('mousedown', e => { mouse.pb[e.button] = true; });
  return { attach, read, commit, joinPress, mouse, keys, pressedK, pads, keyPressed: c => pressedK.has(c) };
})();
