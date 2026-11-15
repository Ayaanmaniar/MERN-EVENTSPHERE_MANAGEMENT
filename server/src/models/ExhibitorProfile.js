const mongoose = require('mongoose');

const profileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    companyName: { type: String, required: true, trim: true },
    category: { type: String, trim: true, default: 'General' },
    description: { type: String, default: '' },
    products: [{ type: String, trim: true }],
    logo: { type: String, default: '' }, // url path
    website: { type: String, default: '' },
    contactEmail: { type: String, default: '' },
    contactPhone: { type: String, default: '' },
    address: { type: String, default: '' },
  },
  { timestamps: true }
);

profileSchema.index({ companyName: 'text', description: 'text', products: 'text', category: 'text' });

module.exports = mongoose.model('ExhibitorProfile', profileSchema);
