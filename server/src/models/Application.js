const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema(
  {
    expo: { type: mongoose.Schema.Types.ObjectId, ref: 'Expo', required: true },
    exhibitor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    companyName: { type: String, required: true, trim: true },
    products: { type: String, default: '' },
    message: { type: String, default: '' },
    documents: [{ name: String, url: String }],
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    adminNote: { type: String, default: '' },
    booth: { type: mongoose.Schema.Types.ObjectId, ref: 'Booth', default: null },
  },
  { timestamps: true }
);

applicationSchema.index({ expo: 1, exhibitor: 1 }, { unique: true });

module.exports = mongoose.model('Application', applicationSchema);
