const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 8, select: false },
    // admin = organizer
    role: { type: String, enum: ['admin', 'exhibitor', 'attendee'], default: 'attendee' },
    phone: { type: String, trim: true },
    // GDPR style consent
    consent: {
      terms: { type: Boolean, default: false },
      marketing: { type: Boolean, default: false },
      acceptedAt: Date,
    },
    resetTokenHash: { type: String, select: false },
    resetTokenExpires: { type: Date, select: false },
  },
  { timestamps: true }
);

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.matchPassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

userSchema.methods.toSafeJSON = function () {
  return {
    _id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    phone: this.phone,
    consent: this.consent,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('User', userSchema);
