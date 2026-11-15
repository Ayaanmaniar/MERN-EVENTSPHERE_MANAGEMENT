const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema(
  {
    expo: { type: mongoose.Schema.Types.ObjectId, ref: 'Expo', required: true, index: true },
    title: { type: String, required: true, trim: true },
    topic: { type: String, default: '' },
    description: { type: String, default: '' },
    speaker: { type: String, default: '' },
    location: { type: String, default: '' }, // hall / room
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    capacity: { type: Number, default: 0 }, // 0 = unlimited
    type: { type: String, enum: ['session', 'workshop', 'keynote'], default: 'session' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Session', sessionSchema);
