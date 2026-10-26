const ENV = require('./env');
// file:// run of the sprite screenshot script
process.argv[2] = ENV.FILE_URL; process.argv[3] = require('path').join(require('os').tmpdir(), 'hollowcrown-fileshots') + require('path').sep;
require('fs').mkdirSync(process.argv[3], { recursive: true });
require('./spr.js');
