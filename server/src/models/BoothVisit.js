const mongoose = require('mongoose');

// Used for "booth traffic" analytics
const visitSchema = new mongoose.Schema(
  {
    booth: { type: mongoose.Schema.Types.ObjectId, ref: 'Booth', required: true, index: true },
    expo: { type: mongoose.Schema.Types.ObjectId, ref: 'Expo', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('BoothVisit', visitSchema);
