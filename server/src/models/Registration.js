const mongoose = require('mongoose');

// kind=expo -> registered for whole expo
// kind=session -> registered for session
// kind=bookmark -> bookmarked session (reminders)
const registrationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    expo: { type: mongoose.Schema.Types.ObjectId, ref: 'Expo', required: true, index: true },
    session: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', default: null },
    kind: { type: String, enum: ['expo', 'session', 'bookmark'], required: true },
    reminded: { type: Boolean, default: false },
  },
  { timestamps: true }
);

registrationSchema.index({ user: 1, expo: 1, session: 1, kind: 1 }, { unique: true });

module.exports = mongoose.model('Registration', registrationSchema);
