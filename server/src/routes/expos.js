const router = require('express').Router();
const Expo = require('../models/Expo');
const Booth = require('../models/Booth');
const Session = require('../models/Session');
const Registration = require('../models/Registration');
const Application = require('../models/Application');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/HttpError');
const validate = require('../middleware/validate');
const { protect, optionalAuth, authorize } = require('../middleware/auth');
const socket = require('../utils/socket');
const { notifyMany } = require('../utils/notify');

const expoRules = {
  title: { required: true, max: 150 },
  location: { required: true },
  startDate: { required: true, type: 'date' },
  endDate: { required: true, type: 'date' },
};

// list (search + filter). Drafts only visible to admins
router.get(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const q = {};
    if (!req.user || req.user.role !== 'admin') q.status = { $ne: 'draft' };
    if (req.query.search) {
      const rx = new RegExp(String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      q.$or = [{ title: rx }, { location: rx }, { theme: rx }];
    }
    if (req.query.status && req.user && req.user.role === 'admin') q.status = req.query.status;
    const expos = await Expo.find(q).sort({ startDate: 1 });
    res.json({ expos });
  })
);

router.get(
  '/:id',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const expo = await Expo.findById(req.params.id);
    if (!expo) throw new HttpError(404, 'Expo not found');
    if (expo.status === 'draft' && (!req.user || req.user.role !== 'admin')) throw new HttpError(404, 'Expo not found');
    const [boothTotal, boothReserved, sessions, registered] = await Promise.all([
      Booth.countDocuments({ expo: expo._id }),
      Booth.countDocuments({ expo: expo._id, status: 'reserved' }),
      Session.countDocuments({ expo: expo._id }),
      req.user ? Registration.findOne({ user: req.user._id, expo: expo._id, kind: 'expo' }) : null,
    ]);
    res.json({ expo, stats: { boothTotal, boothReserved, sessions }, registered: !!registered });
  })
);

router.post(
  '/',
  protect,
  authorize('admin'),
  validate(expoRules),
  asyncHandler(async (req, res) => {
    if (new Date(req.body.endDate) < new Date(req.body.startDate)) throw new HttpError(400, 'End date must be after start date');
    const expo = await Expo.create({ ...req.body, createdBy: req.user._id });
    socket.broadcast('expo:created', expo);
    res.status(201).json({ expo });
  })
);

router.put(
  '/:id',
  protect,
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const expo = await Expo.findById(req.params.id);
    if (!expo) throw new HttpError(404, 'Expo not found');
    ['title', 'description', 'theme', 'location', 'startDate', 'endDate', 'status', 'floorPlan'].forEach((k) => {
      if (req.body[k] !== undefined) expo[k] = req.body[k];
    });
    if (expo.endDate < expo.startDate) throw new HttpError(400, 'End date must be after start date');
    await expo.save();
    socket.toExpo(expo._id, 'expo:updated', expo);
    // tell registered attendees that details changed
    const regs = await Registration.find({ expo: expo._id, kind: 'expo' }).select('user');
    await notifyMany(regs.map((r) => r.user), `Update: ${expo.title}`, 'Event details were updated by the organizers.', `/expos/${expo._id}`);
    res.json({ expo });
  })
);

router.delete(
  '/:id',
  protect,
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const expo = await Expo.findById(req.params.id);
    if (!expo) throw new HttpError(404, 'Expo not found');
    await Promise.all([
      Booth.deleteMany({ expo: expo._id }),
      Session.deleteMany({ expo: expo._id }),
      Registration.deleteMany({ expo: expo._id }),
      Application.deleteMany({ expo: expo._id }),
      expo.deleteOne(),
    ]);
    socket.broadcast('expo:deleted', { _id: expo._id });
    res.json({ message: 'Expo deleted' });
  })
);

// Attendee registers for the expo
router.post(
  '/:id/register',
  protect,
  asyncHandler(async (req, res) => {
    const expo = await Expo.findById(req.params.id);
    if (!expo) throw new HttpError(404, 'Expo not found');
    await Registration.updateOne(
      { user: req.user._id, expo: expo._id, session: null, kind: 'expo' },
      { $setOnInsert: { user: req.user._id, expo: expo._id, kind: 'expo' } },
      { upsert: true }
    );
    res.json({ message: 'Registered for expo' });
  })
);

router.delete(
  '/:id/register',
  protect,
  asyncHandler(async (req, res) => {
    await Registration.deleteOne({ user: req.user._id, expo: req.params.id, kind: 'expo' });
    res.json({ message: 'Registration cancelled' });
  })
);

// Admin: who registered
router.get(
  '/:id/attendees',
  protect,
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const regs = await Registration.find({ expo: req.params.id, kind: 'expo' }).populate('user', 'name email');
    res.json({ attendees: regs.map((r) => ({ ...r.user.toObject(), registeredAt: r.createdAt })) });
  })
);

module.exports = router;
