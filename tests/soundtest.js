// Every sound name the game plays is defined in audio.js (Snd.play silently ignores unknown names, so a typo means silence).
// Collects every quoted name inside Snd.play(...) and every `sound: '...'` option, plus the wizard's 'rune' + index sounds.
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0; const chk = (name, got, want) => { const okk = typeof want === 'function' ? want(got) : JSON.stringify(got) === JSON.stringify(want); okk ? pass++ : fail++; console.log((okk ? 'PASS ' : 'FAIL ') + name + (okk ? '' : '  got ' + JSON.stringify(got).slice(0, 500))); };
const ctx = { window: {} }; vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(ROOT, 'audio.js'), 'utf8') + '\nthis.Snd = Snd;', ctx);
const defined = new Set(ctx.Snd.names());
const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.js'));
const used = new Map(); const add = (n, where) => { if (!used.has(n)) used.set(n, where); };
let dynamic = 0;
for (const f of files) {
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
  for (const m of src.matchAll(/Snd\.play\(([^)]*)\)/g)) {
    const arg = m[1], line = src.slice(0, m.index).split('\n').length;
    const lits = [...arg.replace(/[!=]==? *'[A-Za-z0-9_]+'/g, '').matchAll(/'([A-Za-z0-9_]+)'/g)].map(x => x[1]);   // skip comparison operands (h.id === 'sela' ? ...)
    if (/^'rune' \+ \w+$/.test(arg.trim())) { dynamic++; for (let i = 0; i < 3; i++) add('rune' + i, `${f}:${line}`); continue; }
    if (!lits.length && !/o\.sound/.test(arg)) { add('<unchecked: ' + arg.trim() + '>', `${f}:${line}`); continue; }
    for (const n of lits) add(n, `${f}:${line}`);
  }
  for (const m of src.matchAll(/sound: *'([A-Za-z0-9_]+)'/g)) add(m[1], `${f}:${src.slice(0, m.index).split('\n').length}`);
}
const missing = [...used].filter(([n]) => !defined.has(n)).map(([n, w]) => `${n} (${w})`);
chk(`found the sound names the code plays (${used.size} names, ${defined.size} defined)`, used.size, n => n > 80);
chk('the wizard rune sounds (rune0-2) are covered', dynamic, n => n >= 1);
chk('every played sound name is defined in audio.js', missing, []);
chk("water lurkers have a 'splash' sound", defined.has('splash'), true);
console.log(`\nsoundtest: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
