const mongoose = require('mongoose');

const expoSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, trim: true, default: '' },
    theme: { type: String, trim: true, default: '' },
    location: { type: String, required: true, trim: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: { type: String, enum: ['draft', 'published', 'completed'], default: 'published' },
    // floor plan grid used to draw booths
    floorPlan: {
      rows: { type: Number, default: 4, min: 1, max: 30 },
      cols: { type: Number, default: 6, min: 1, max: 30 },
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Expo', expoSchema);
