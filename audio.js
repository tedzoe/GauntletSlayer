'use strict';
// Procedural WebAudio sound effects (all synthesized at runtime; no samples, no recordings).
const Snd = (() => {
  let ac = null, master = null, muted = false, nbuf = null, humNode = null;
  const last = {};
  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = 0.28; master.connect(ac.destination); } catch (e) { ac = null; }
  }
  function tone(f, d, type = 'square', v = 0.2, f2 = null, delay = 0) {
    if (!ac || muted) return;
    const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + d);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + d + 0.03);
  }
  function noise(d, v = 0.2, ff = 2000, delay = 0, ftype = 'lowpass', ff2 = null) {
    if (!ac || muted) return;
    if (!nbuf) { nbuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const ch = nbuf.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1; }
    const t = ac.currentTime + delay, s = ac.createBufferSource(); s.buffer = nbuf;
    const f = ac.createBiquadFilter(); f.type = ftype; f.frequency.setValueAtTime(ff, t); if (ff2) f.frequency.exponentialRampToValueAtTime(ff2, t + d);
    const g = ac.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
    s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random() * 0.5); s.stop(t + d + 0.03);
  }
  const arp = (fs, d, type, v, step) => fs.forEach((f, i) => tone(f, d, type, v, null, i * step));
  const S = {
    // weapons & impacts
    swing: () => noise(0.09, 0.14, 2500, 0, 'bandpass', 700), heavyswing: () => { noise(0.18, 0.2, 900, 0, 'bandpass', 300); },
    hit: () => { noise(0.06, 0.22, 1800); tone(150, 0.07, 'square', 0.08, 70); }, thud: () => { tone(90, 0.16, 'sine', 0.35, 40); noise(0.1, 0.2, 500); },
    death: () => noise(0.18, 0.18, 1200, 0, 'lowpass', 200), bigdeath: () => { tone(140, 0.5, 'sawtooth', 0.15, 40); noise(0.5, 0.25, 900, 0, 'lowpass', 100); },
    clank: () => { tone(900, 0.08, 'square', 0.1, 600); tone(1400, 0.06, 'triangle', 0.08); }, tink: () => tone(2400, 0.06, 'triangle', 0.1, 1800),
    spin: () => noise(0.14, 0.12, 1500, 0, 'bandpass', 600), spinstart: () => { noise(0.3, 0.2, 400, 0, 'bandpass', 2400); }, charge: () => tone(300, 0.25, 'triangle', 0.1, 900),
    rush: () => noise(0.22, 0.2, 600, 0, 'bandpass', 2000), leap: () => tone(200, 0.25, 'triangle', 0.15, 600), slam: () => { tone(70, 0.35, 'sine', 0.45, 30); noise(0.3, 0.3, 700, 0, 'lowpass', 120); },
    windup: () => tone(220, 0.25, 'sawtooth', 0.06, 440), windupHero: () => tone(180, 0.2, 'triangle', 0.08, 360), quake: () => { tone(50, 0.6, 'sine', 0.4, 25); noise(0.6, 0.25, 300, 0, 'lowpass', 60); },
    throw: () => noise(0.15, 0.14, 800, 0, 'bandpass', 2200), catch: () => tone(700, 0.08, 'triangle', 0.12, 900), bash: () => { tone(120, 0.12, 'square', 0.2, 60); noise(0.08, 0.2, 1400); },
    lunge: () => noise(0.18, 0.18, 3000, 0, 'bandpass', 900), roll: () => noise(0.16, 0.1, 500, 0, 'lowpass', 200), draw: () => tone(260, 0.3, 'triangle', 0.05, 330), ready: () => tone(1200, 0.08, 'triangle', 0.12),
    load: () => arp([600, 900], 0.06, 'square', 0.08, 0.05), arrow: () => noise(0.06, 0.12, 4000, 0, 'highpass'), bow: () => tone(320, 0.08, 'triangle', 0.1, 180),
    powershot: () => { noise(0.2, 0.2, 5000, 0, 'highpass', 1500); tone(500, 0.15, 'triangle', 0.12, 200); }, roots: () => noise(0.3, 0.15, 400, 0, 'bandpass', 900), smoke: () => noise(0.5, 0.2, 1200, 0, 'lowpass', 200),
    // runes & spells
    rune0: () => tone(392, 0.12, 'sawtooth', 0.08), rune1: () => tone(523, 0.12, 'triangle', 0.1), rune2: () => tone(659, 0.12, 'square', 0.06), prime: () => arp([523, 784], 0.1, 'triangle', 0.1, 0.06),
    firebolt: () => noise(0.18, 0.18, 900, 0, 'lowpass', 300), serpent: () => noise(0.25, 0.14, 600, 0, 'bandpass', 1800), freeze: () => { tone(1800, 0.3, 'sine', 0.08, 2600); noise(0.3, 0.12, 6000, 0, 'highpass'); },
    ray: () => tone(1500 + Math.random() * 200, 0.08, 'sine', 0.04), orb: () => tone(400, 0.35, 'sine', 0.12, 800), thunder: () => { noise(0.45, 0.35, 2500, 0, 'lowpass', 120); tone(60, 0.4, 'sawtooth', 0.15, 30); },
    zap: () => { noise(0.08, 0.2, 5000, 0, 'highpass'); tone(1800, 0.06, 'square', 0.05, 400); }, ward: () => tone(220, 0.4, 'sawtooth', 0.06, 110), vacuum: () => noise(0.4, 0.2, 200, 0, 'bandpass', 2000),
    gloom: () => tone(90, 0.1, 'sawtooth', 0.05, 70), scorch: () => noise(0.35, 0.25, 1600, 0, 'lowpass', 200), flame: () => noise(0.09, 0.08, 900),
    // necromancy
    ghost: () => tone(600, 0.4, 'sine', 0.08, 200), grave: () => { tone(80, 0.3, 'sine', 0.3, 40); noise(0.2, 0.2, 400); }, rake: () => noise(0.12, 0.15, 3000, 0, 'bandpass', 1200), raise: () => arp([196, 233, 294], 0.2, 'sawtooth', 0.07, 0.07),
    // potions & talismans
    potionuse: () => arp([300, 450, 600], 0.1, 'triangle', 0.12, 0.05), titan: () => tone(80, 0.6, 'sawtooth', 0.2, 160), verdict: () => { noise(0.3, 0.3, 3000, 0, 'bandpass', 400); tone(220, 0.3, 'square', 0.1, 110); },
    horn: () => { tone(110, 0.9, 'sawtooth', 0.12, 116); tone(165, 0.9, 'sawtooth', 0.08, 170, 0.05); noise(0.6, 0.05, 600, 0, 'lowpass', 300); },
    thunder: () => { noise(0.5, 0.35, 1800, 0, 'lowpass', 90); tone(60, 0.5, 'sine', 0.3, 30); }, zap: () => { noise(0.12, 0.2, 4000, 0, 'highpass', 1500); tone(900, 0.1, 'square', 0.06, 300); },
    windblock: () => { noise(0.16, 0.18, 1400, 0, 'bandpass', 500); tone(700, 0.06, 'triangle', 0.06, 500); },
    holyslam: () => { tone(80, 0.5, 'sine', 0.45, 35); noise(0.4, 0.3, 900, 0, 'lowpass', 120); arp([523, 784, 1047], 0.3, 'sine', 0.07, 0.05); },
    wings: () => arp([392, 523, 659, 784, 1047], 0.4, 'sine', 0.09, 0.07),
    holy: () => arp([523, 659, 784, 1047], 0.25, 'sine', 0.08, 0.06), pillar: () => { tone(1200, 0.3, 'sine', 0.1, 400); noise(0.25, 0.2, 2000); }, nova: () => { noise(0.5, 0.3, 3000, 0, 'lowpass', 100); tone(300, 0.4, 'sine', 0.15, 60); },
    hunger: () => tone(110, 0.8, 'sawtooth', 0.08, 55), nova: () => { tone(55, 0.7, 'sawtooth', 0.25, 30); noise(0.6, 0.35, 1400, 0, 'lowpass', 150); arp([294, 233, 196], 0.3, 'sine', 0.08, 0.05); }, sprites: () => arp([880, 1100, 1320], 0.12, 'sine', 0.07, 0.05),
    // relics
    relic: () => arp([440, 660], 0.12, 'triangle', 0.1, 0.06), wind: () => noise(0.6, 0.2, 500, 0, 'bandpass', 1500), blink: () => tone(1500, 0.15, 'sine', 0.1, 300),
    lyre: () => arp([523, 659, 784, 659], 0.2, 'sine', 0.08, 0.1), mirror: () => arp([1047, 784, 1047], 0.15, 'sine', 0.07, 0.07),
    // world
    error: () => tone(140, 0.15, 'square', 0.1), gate: () => { tone(110, 0.2, 'square', 0.12, 80); noise(0.25, 0.15, 900); }, crumble: () => noise(0.5, 0.3, 700, 0, 'lowpass', 80),
    boom: () => { tone(60, 0.5, 'sine', 0.5, 25); noise(0.55, 0.4, 1800, 0, 'lowpass', 60); }, squelch: () => noise(0.25, 0.25, 500, 0, 'lowpass', 150),
    eat: () => arp([520, 660, 780], 0.07, 'triangle', 0.12, 0.05), potion: () => arp([660, 880, 1100], 0.08, 'sine', 0.12, 0.05), key: () => arp([1200, 1600], 0.08, 'triangle', 0.12, 0.06),
    coin: () => { tone(1500 + Math.random() * 300, 0.07, 'square', 0.04); tone(2000, 0.06, 'square', 0.03, null, 0.04); }, smash: () => noise(0.18, 0.25, 2200, 0, 'bandpass', 800),
    wood: () => { noise(0.15, 0.25, 800); tone(160, 0.08, 'square', 0.1, 90); }, pot: () => { noise(0.12, 0.2, 3000, 0, 'highpass'); tone(700, 0.05, 'triangle', 0.08, 300); },
    chest: () => arp([392, 523, 659, 784], 0.12, 'triangle', 0.1, 0.06), stonehit: () => { noise(0.08, 0.25, 900); tone(100, 0.08, 'square', 0.1, 70); },
    spawnerdie: () => { noise(0.4, 0.3, 1200, 0, 'lowpass', 100); tone(300, 0.4, 'sawtooth', 0.1, 50); }, spawn: () => tone(180, 0.12, 'triangle', 0.05, 120), summon: () => tone(150, 0.4, 'sawtooth', 0.08, 300),
    hurt: () => { tone(220, 0.14, 'sawtooth', 0.15, 90); }, herodeath: () => { arp([392, 330, 262, 196], 0.25, 'triangle', 0.15, 0.14); }, revive: () => arp([262, 330, 392, 523], 0.2, 'sine', 0.14, 0.08),
    reaper: () => { tone(70, 1.4, 'sawtooth', 0.12, 50); tone(105, 1.4, 'sine', 0.08, 70); noise(1.2, 0.1, 300, 0, 'bandpass', 100); }, reaperhum: () => tone(55, 0.4, 'sine', 0.06, 50), drain: () => tone(300, 0.2, 'sine', 0.1, 80),
    wraith: () => tone(500, 0.3, 'sine', 0.05, 300), roar: () => { noise(0.5, 0.3, 500, 0, 'bandpass', 150); tone(80, 0.5, 'sawtooth', 0.15, 60); }, fuse: () => noise(0.3, 0.06, 6000, 0, 'highpass'),
    spit: () => noise(0.12, 0.15, 1500, 0, 'bandpass', 500), hex: () => tone(330, 0.2, 'square', 0.06, 660), fireshot: () => noise(0.15, 0.15, 1100), bones: () => { for (let i = 0; i < 4; i++) tone(800 + Math.random() * 800, 0.04, 'square', 0.05, null, i * 0.03); },
    allyshot: () => noise(0.05, 0.08, 3000, 0, 'highpass'), shade: () => tone(800, 0.15, 'sine', 0.06, 400), spikes: () => { noise(0.1, 0.15, 5000, 0, 'highpass'); tone(1200, 0.05, 'square', 0.04); },
    bossroar: () => { noise(1.1, 0.35, 400, 0, 'bandpass', 120); tone(60, 1.1, 'sawtooth', 0.2, 40); }, bossdeath: () => { noise(1.6, 0.4, 1500, 0, 'lowpass', 40); tone(110, 1.6, 'sawtooth', 0.2, 30); },
    bonevolley: () => { for (let i = 0; i < 5; i++) tone(500 + i * 90, 0.05, 'square', 0.05, null, i * 0.03); }, burrow: () => noise(0.8, 0.3, 300, 0, 'lowpass', 60), splash: () => { noise(0.35, 0.28, 900, 0, 'bandpass', 2600); noise(0.5, 0.12, 400, 0.05, 'lowpass', 120); tone(180, 0.18, 'sine', 0.12, 70, 0.02); }, rumble: () => tone(40, 0.6, 'sine', 0.3, 30),
    erupt: () => { noise(0.6, 0.4, 900, 0, 'lowpass', 80); tone(70, 0.4, 'sine', 0.4, 35); }, meteorcall: () => tone(900, 0.6, 'sine', 0.08, 200), shatter: () => { noise(0.5, 0.3, 6000, 0, 'highpass', 1500); arp([1600, 1200, 900], 0.1, 'triangle', 0.08, 0.05); },
    pylon: () => arp([330, 494, 659], 0.4, 'sine', 0.08, 0.1),
    // flow & UI
    victory: () => arp([392, 523, 659, 784, 1047], 0.35, 'triangle', 0.13, 0.11), exitopen: () => arp([523, 784, 1047], 0.25, 'sine', 0.1, 0.08), tick: () => tone(1000, 0.05, 'square', 0.06),
    exit: () => arp([523, 659, 784, 1047, 1319], 0.12, 'sine', 0.1, 0.05), wavestart: () => { tone(110, 0.5, 'sawtooth', 0.12, 220); noise(0.4, 0.15, 400); }, wavedone: () => arp([392, 523, 784], 0.2, 'triangle', 0.12, 0.08),
    gateslam: () => { tone(60, 0.3, 'square', 0.3, 40); noise(0.3, 0.3, 600); }, legend: () => arp([523, 659, 784, 1047, 1319, 1568], 0.35, 'sine', 0.1, 0.07), mastery: () => arp([659, 784, 988, 1319], 0.3, 'triangle', 0.1, 0.08),
    defeat: () => arp([392, 349, 311, 262], 0.45, 'sawtooth', 0.1, 0.22), select: () => tone(660, 0.05, 'square', 0.06), confirm: () => arp([660, 990], 0.07, 'square', 0.07, 0.05),
  };
  function play(n) {
    if (!ac || muted) return; const fn = S[n]; if (!fn) return;
    const now = ac.currentTime; if (last[n] && now - last[n] < 0.035) return; last[n] = now;
    try { fn(); } catch (e) { }
  }
  return { init, play, tone, noise, toggle() { muted = !muted; return muted; }, get muted() { return muted; }, names: () => Object.keys(S) };
})();
