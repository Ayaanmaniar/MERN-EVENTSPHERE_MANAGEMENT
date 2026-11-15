const mongoose = require('mongoose');

const boothSchema = new mongoose.Schema(
  {
    expo: { type: mongoose.Schema.Types.ObjectId, ref: 'Expo', required: true, index: true },
    code: { type: String, required: true, trim: true }, // e.g. A1
    row: { type: Number, required: true },
    col: { type: Number, required: true },
    size: { type: String, enum: ['small', 'medium', 'large'], default: 'small' },
    price: { type: Number, default: 0 },
    status: { type: String, enum: ['available', 'reserved', 'blocked'], default: 'available' },
    exhibitor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // details that exhibitor manages
    details: {
      title: { type: String, default: '' },
      productsShowcased: { type: String, default: '' },
      staff: [{ name: String, role: String, phone: String }],
    },
  },
  { timestamps: true }
);

boothSchema.index({ expo: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('Booth', boothSchema);
