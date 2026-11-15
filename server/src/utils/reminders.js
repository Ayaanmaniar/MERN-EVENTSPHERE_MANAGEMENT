const Registration = require('../models/Registration');
const Session = require('../models/Session');
const { notify } = require('./notify');
const logger = require('./logger');

// Every minute: remind users 15 minutes before a bookmarked/registered session starts.
async function runOnce() {
  const now = new Date();
  const soon = new Date(now.getTime() + 15 * 60 * 1000);
  const sessions = await Session.find({ startTime: { $gt: now, $lte: soon } }).select('_id title startTime location expo');
  for (const s of sessions) {
    const regs = await Registration.find({ session: s._id, kind: { $in: ['bookmark', 'session'] }, reminded: false });
    for (const r of regs) {
      await notify(r.user, `Starting soon: ${s.title}`, `Starts at ${s.startTime.toLocaleTimeString()}${s.location ? ' in ' + s.location : ''}`, `/expos/${s.expo}`);
      r.reminded = true;
      await r.save();
    }
  }
}

function start() {
  const t = setInterval(() => runOnce().catch((e) => logger.error('reminder job failed', e)), 60 * 1000);
  t.unref();
  return t;
}

module.exports = { start, runOnce };
