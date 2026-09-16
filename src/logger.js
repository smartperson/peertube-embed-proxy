const config = require('./config');

// silent disables everything; error/info/debug are cumulative (each level
// includes the ones below it).
const LEVELS = { silent: -1, error: 0, info: 1, debug: 2 };
const currentLevel = LEVELS[config.logLevel] ?? LEVELS.info;

function log(level, msg, meta) {
  if (LEVELS[level] > currentLevel) return;
  const line = { ts: new Date().toISOString(), level, msg, ...meta };
  const out = level === 'error' ? console.error : console.log;
  out(JSON.stringify(line));
}

module.exports = {
  error: (msg, meta) => log('error', msg, meta),
  info: (msg, meta) => log('info', msg, meta),
  debug: (msg, meta) => log('debug', msg, meta),
};
