const fs = require('node:fs');
const path = require('node:path');

const dir = path.join(__dirname, '..', 'logs');
const file = path.join(dir, 'zqradar.log');
const maxBytes = 5 * 1024 * 1024;
const backups = 4;

function rotate() {
  if (!fs.existsSync(file) || fs.statSync(file).size < maxBytes) return;
  for (let i = backups; i >= 1; i--) {
    const from = i === 1 ? file : `${file}.${i - 1}`;
    const to = `${file}.${i}`;
    if (fs.existsSync(from)) {
      if (fs.existsSync(to)) fs.unlinkSync(to);
      fs.renameSync(from, to);
    }
  }
}

function log(level, message, error) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    rotate();
    const record = { time: new Date().toISOString(), level, message };
    if (error) record.error = error.stack || String(error);
    fs.appendFileSync(file, `${JSON.stringify(record)}\n`, 'utf8');
  } catch (writeError) {
    console.error('Não foi possível gravar o log:', writeError.message);
  }
  const output = `[${level.toUpperCase()}] ${message}`;
  (level === 'error' ? console.error : console.log)(output, error ? error.message : '');
}

module.exports = { info: (m) => log('info', m), warn: (m) => log('warn', m), error: (m, e) => log('error', m, e) };
