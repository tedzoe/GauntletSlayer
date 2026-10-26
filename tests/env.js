// Shared test environment: serves the game folder (one level up) on a free local port and finds Chrome.
// Usage from a test:  const ENV = require('./env');  await ENV.ready;  page.goto(ENV.BASE + 'index.html')
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const SHOT = path.join(ROOT, 'screenshots') + path.sep;
fs.mkdirSync(SHOT, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(d); });
});
const ENV = { ROOT, SHOT, FILE_URL: 'file://' + path.join(ROOT, 'index.html'), BASE: null };
ENV.ready = new Promise(r => server.listen(0, '127.0.0.1', () => { ENV.BASE = `http://127.0.0.1:${server.address().port}/`; r(ENV); }));
server.unref();
const CANDIDATES = [process.env.CHROME, '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'].filter(Boolean);
ENV.CHROME = CANDIDATES.find(p => { try { return fs.existsSync(p); } catch (e) { return false; } });
module.exports = ENV;
