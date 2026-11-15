const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['suggestion', 'issue', 'other'], default: 'suggestion' },
    subject: { type: String, required: true, trim: true, maxlength: 150 },
    message: { type: String, required: true, maxlength: 3000 },
    rating: { type: Number, min: 1, max: 5 },
    status: { type: String, enum: ['open', 'in_progress', 'resolved'], default: 'open' },
    adminReply: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Feedback', feedbackSchema);
