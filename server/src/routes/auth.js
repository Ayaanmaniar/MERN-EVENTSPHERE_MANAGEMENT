const router = require('express').Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ExhibitorProfile = require('../models/ExhibitorProfile');
const { jwtSecret, jwtExpiresIn, clientUrl } = require('../config/env');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/HttpError');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { sendMail } = require('../utils/mailer');

const sign = (user) => jwt.sign({ id: user._id, role: user.role }, jwtSecret, { expiresIn: jwtExpiresIn });

// Public registration. Admin accounts can only be created via seed / by an existing admin.
router.post(
  '/register',
  validate({
    name: { required: true, max: 80 },
    email: { required: true, type: 'email' },
    password: { required: true, min: 8, max: 100 },
    role: { type: 'enum', values: ['exhibitor', 'attendee', 'admin'] },
  }),
  asyncHandler(async (req, res) => {
    const { name, email, password, phone, companyName, consent } = req.body;
    let { role } = req.body;
    role = role || 'attendee';
    if (role === 'admin' && !process.env.ALLOW_ADMIN_SIGNUP) role = 'attendee';
    if (!consent) throw new HttpError(400, 'You must accept the terms & privacy policy to register');
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      throw new HttpError(400, 'Password must contain at least one letter and one number');
    }
    if (await User.findOne({ email: String(email).toLowerCase() })) throw new HttpError(409, 'Email already registered');

    const user = await User.create({
      name,
      email,
      password,
      role,
      phone,
      consent: { terms: true, marketing: !!(req.body.marketing), acceptedAt: new Date() },
    });
    if (role === 'exhibitor') {
      await ExhibitorProfile.create({ user: user._id, companyName: companyName || name, contactEmail: email });
    }
    res.status(201).json({ token: sign(user), user: user.toSafeJSON() });
  })
);

router.post(
  '/login',
  validate({ email: { required: true, type: 'email' }, password: { required: true } }),
  asyncHandler(async (req, res) => {
    const user = await User.findOne({ email: String(req.body.email).toLowerCase() }).select('+password');
    if (!user || !(await user.matchPassword(req.body.password))) throw new HttpError(401, 'Invalid email or password');
    res.json({ token: sign(user), user: user.toSafeJSON() });
  })
);

router.get('/me', protect, (req, res) => res.json({ user: req.user.toSafeJSON() }));

router.put(
  '/me',
  protect,
  asyncHandler(async (req, res) => {
    const { name, phone, marketing } = req.body;
    if (name) req.user.name = name;
    if (phone !== undefined) req.user.phone = phone;
    if (marketing !== undefined) req.user.consent.marketing = !!marketing;
    await req.user.save();
    res.json({ user: req.user.toSafeJSON() });
  })
);

router.put(
  '/change-password',
  protect,
  validate({ currentPassword: { required: true }, newPassword: { required: true, min: 8 } }),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select('+password');
    if (!(await user.matchPassword(req.body.currentPassword))) throw new HttpError(400, 'Current password is incorrect');
    user.password = req.body.newPassword;
    await user.save();
    res.json({ message: 'Password updated' });
  })
);

// Forgot password: always answers 200 so that emails cannot be enumerated
router.post(
  '/forgot-password',
  validate({ email: { required: true, type: 'email' } }),
  asyncHandler(async (req, res) => {
    const user = await User.findOne({ email: String(req.body.email).toLowerCase() });
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      user.resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');
      user.resetTokenExpires = new Date(Date.now() + 30 * 60 * 1000);
      await user.save({ validateBeforeSave: false });
      const link = `${clientUrl}/reset-password/${token}`;
      await sendMail({
        to: user.email,
        subject: 'EventSphere password reset',
        text: `Hi ${user.name},\n\nUse this link to reset your password (valid for 30 minutes):\n${link}\n\nIf you did not request this, ignore this email.`,
      });
      if (process.env.NODE_ENV !== 'production' && !process.env.SMTP_HOST) {
        return res.json({ message: 'If that email exists, a reset link has been sent.', devResetLink: link });
      }
    }
    res.json({ message: 'If that email exists, a reset link has been sent.' });
  })
);

router.post(
  '/reset-password/:token',
  validate({ password: { required: true, min: 8 } }),
  asyncHandler(async (req, res) => {
    const hash = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const user = await User.findOne({ resetTokenHash: hash, resetTokenExpires: { $gt: new Date() } }).select(
      '+resetTokenHash +resetTokenExpires'
    );
    if (!user) throw new HttpError(400, 'Reset link is invalid or has expired');
    user.password = req.body.password;
    user.resetTokenHash = undefined;
    user.resetTokenExpires = undefined;
    await user.save();
    res.json({ message: 'Password has been reset. You can now log in.' });
  })
);

// Data privacy: download everything we store about me (GDPR "right of access")
router.get(
  '/me/export',
  protect,
  asyncHandler(async (req, res) => {
    const Registration = require('../models/Registration');
    const Message = require('../models/Message');
    const Feedback = require('../models/Feedback');
    const Application = require('../models/Application');
    const [registrations, messages, feedback, applications, profile] = await Promise.all([
      Registration.find({ user: req.user._id }).lean(),
      Message.find({ $or: [{ from: req.user._id }, { to: req.user._id }] }).lean(),
      Feedback.find({ user: req.user._id }).lean(),
      Application.find({ exhibitor: req.user._id }).lean(),
      ExhibitorProfile.findOne({ user: req.user._id }).lean(),
    ]);
    res.header('Content-Disposition', 'attachment; filename="my-eventsphere-data.json"');
    res.json({ user: req.user.toSafeJSON(), profile, registrations, applications, messages, feedback });
  })
);

// Data privacy: delete my account and personal data ("right to erasure")
router.delete(
  '/me',
  protect,
  validate({ password: { required: true } }),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select('+password');
    if (!(await user.matchPassword(req.body.password))) throw new HttpError(400, 'Password is incorrect');
    if (user.role === 'admin' && (await User.countDocuments({ role: 'admin' })) <= 1) throw new HttpError(400, 'The last organizer account cannot be deleted');
    const Registration = require('../models/Registration');
    const Message = require('../models/Message');
    const Feedback = require('../models/Feedback');
    const Application = require('../models/Application');
    const Booth = require('../models/Booth');
    const Notification = require('../models/Notification');
    await Booth.updateMany({ exhibitor: user._id }, { $set: { status: 'available', exhibitor: null, details: { title: '', productsShowcased: '', staff: [] } } });
    await Promise.all([
      Registration.deleteMany({ user: user._id }),
      Message.deleteMany({ $or: [{ from: user._id }, { to: user._id }] }),
      Feedback.deleteMany({ user: user._id }),
      Application.deleteMany({ exhibitor: user._id }),
      Notification.deleteMany({ user: user._id }),
      ExhibitorProfile.deleteMany({ user: user._id }),
      user.deleteOne(),
    ]);
    res.json({ message: 'Your account and data have been deleted' });
  })
);

module.exports = router;
