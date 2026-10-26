// Runs every headless suite in order and prints a summary. Needs Chrome (set CHROME=/path/to/chrome if it is not found).
const { spawnSync } = require('child_process'), path = require('path');
const SUITES = ['smoke', 'full', 'spectest', 'weapontest', 'enemytest', 'xrealmtest', 'spr', 'sprfile', 'door', 'body', 'perf', 'devtest', 'roomtest', 'gatebanktest', 'brandtest', 'stucktest', 'fixtest', 'dpstest', 'gelatest', 'theotest', 'vespertest', 'camtest', 'locktest', 'hudtest', 'tallytest', 'faqtest'];
let bad = 0;
for (const s of SUITES) {
  const r = spawnSync(process.execPath, [path.join(__dirname, s + '.js')], { encoding: 'utf8', timeout: 600000 });
  const out = (r.stdout || '') + (r.stderr || ''), fails = (out.match(/^FAIL /mg) || []).length, errs = /pageerror|TypeError|ReferenceError/.test(out.replace(/ERRORS\s+\[\]/g, ''));
  const okk = r.status === 0 && !fails && !errs; if (!okk) bad++;
  console.log(`${okk ? 'ok  ' : 'FAIL'} ${s.padEnd(11)} ${(out.match(/(\d+ passed, \d+ failed)/) || [''])[0]}${fails ? ` (${fails} FAIL lines)` : ''}${errs ? ' (page errors)' : ''}`);
}
console.log(bad ? `${bad} suite(s) failed` : 'all suites passed'); process.exit(bad ? 1 : 0);
