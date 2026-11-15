const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', '..', 'logs');
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, 'app.log');

function write(level, ...args) {
  const line = `${new Date().toISOString()} [${level}] ${args
    .map((a) => (a instanceof Error ? a.stack : typeof a === 'string' ? a : JSON.stringify(a)))
    .join(' ')}\n`;
  if (process.env.NODE_ENV !== 'test') fs.appendFile(file, line, () => {});
  (level === 'ERROR' ? console.error : console.log)(line.trim());
}

module.exports = {
  info: (...a) => write('INFO', ...a),
  warn: (...a) => write('WARN', ...a),
  error: (...a) => write('ERROR', ...a),
  accessLogPath: path.join(dir, 'access.log'),
};
