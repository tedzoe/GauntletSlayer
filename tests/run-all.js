// Runs every headless suite in order and prints a summary. Needs Chrome (set CHROME=/path/to/chrome if it is not found).
const { spawnSync } = require('child_process'), path = require('path');
const SUITES = ['smoke', 'full', 'spectest', 'weapontest', 'enemytest', 'xrealmtest', 'spr', 'sprfile', 'door', 'body', 'perf', 'devtest', 'roomtest', 'gatebanktest', 'brandtest', 'stucktest', 'fixtest', 'dpstest', 'gelatest', 'theotest', 'vespertest', 'camtest', 'locktest', 'hudtest', 'tallytest', 'faqtest', 'finishtest', 'hitboxtest', 'shootertest', 'relictest', 'arenatest', 'hitsettest', 'soundtest', 'masterytest', 'texttest', 'hubtest', 'killcredittest', 'pathtest', 'deathfxtest', 'exittest', 'startflowtest', 'hpticktest'];
const ONLY = process.env.SUITES ? process.env.SUITES.split(',') : null;   // SUITES=a,b node run-all.js runs just those
const LONG = { stucktest: 1500000, finishtest: 1200000, hitboxtest: 1200000 };   // the big sweeps can pass 10 min on a busy machine
let bad = 0;
for (const s of SUITES) {
  if (ONLY && !ONLY.includes(s)) continue;
  const t0 = Date.now(), r = spawnSync(process.execPath, [path.join(__dirname, s + '.js')], { encoding: 'utf8', timeout: LONG[s] || 600000, maxBuffer: 64 << 20 });
  const out = (r.stdout || '') + (r.stderr || ''), fails = (out.match(/^FAIL /mg) || []).length, errs = /pageerror|TypeError|ReferenceError/.test(out.replace(/ERRORS\s+\[\]/g, ''));
  const okk = r.status === 0 && !fails && !errs; if (!okk) bad++;
  console.log(`${okk ? 'ok  ' : 'FAIL'} ${s.padEnd(11)} ${(out.match(/(\d+ passed, \d+ failed)/) || [''])[0]}${fails ? ` (${fails} FAIL lines)` : ''}${errs ? ' (page errors)' : ''}`);
  if (!okk) console.log(`     ${s}: exit ${r.status}${r.signal ? ', killed by ' + r.signal : ''}${r.error ? ', ' + r.error.code : ''} after ${Math.round((Date.now() - t0) / 1000)} s\n     ` + out.trim().split('\n').slice(-4).join('\n     ').slice(0, 1200));
}
console.log(bad ? `${bad} suite(s) failed` : 'all suites passed'); process.exit(bad ? 1 : 0);
