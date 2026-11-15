const router = require('express').Router();
const Session = require('../models/Session');
const Registration = require('../models/Registration');
const Expo = require('../models/Expo');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/HttpError');
const validate = require('../middleware/validate');
const { protect, optionalAuth, authorize } = require('../middleware/auth');
const socket = require('../utils/socket');
const { notifyMany } = require('../utils/notify');

const rules = {
  expo: { required: true },
  title: { required: true, max: 150 },
  startTime: { required: true, type: 'date' },
  endTime: { required: true, type: 'date' },
};

// schedule of an expo, includes per-user flags and registration counts
router.get(
  '/expo/:expoId',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const sessions = await Session.find({ expo: req.params.expoId }).sort({ startTime: 1 });
    const regs = await Registration.find({ expo: req.params.expoId, session: { $ne: null } });
    const counts = {};
    const mine = {};
    regs.forEach((r) => {
      const id = String(r.session);
      if (r.kind === 'session') counts[id] = (counts[id] || 0) + 1;
      if (req.user && String(r.user) === String(req.user._id)) {
        mine[id] = { ...(mine[id] || {}), [r.kind]: true };
      }
    });
    res.json({
      sessions: sessions.map((s) => ({
        ...s.toObject(),
        registeredCount: counts[String(s._id)] || 0,
        registered: !!(mine[String(s._id)] && mine[String(s._id)].session),
        bookmarked: !!(mine[String(s._id)] && mine[String(s._id)].bookmark),
      })),
    });
  })
);

// my schedule (all expos): sessions that I registered for or bookmarked
router.get(
  '/mine',
  protect,
  asyncHandler(async (req, res) => {
    const regs = await Registration.find({ user: req.user._id, session: { $ne: null } }).populate({
      path: 'session',
      populate: { path: 'expo', select: 'title' },
    });
    const map = new Map();
    regs.filter((r) => r.session).forEach((r) => {
      const id = String(r.session._id);
      const cur = map.get(id) || { ...r.session.toObject(), registered: false, bookmarked: false };
      if (r.kind === 'session') cur.registered = true;
      if (r.kind === 'bookmark') cur.bookmarked = true;
      map.set(id, cur);
    });
    res.json({ sessions: [...map.values()].sort((a, b) => new Date(a.startTime) - new Date(b.startTime)) });
  })
);

router.post(
  '/',
  protect,
  authorize('admin'),
  validate(rules),
  asyncHandler(async (req, res) => {
    if (!(await Expo.exists({ _id: req.body.expo }))) throw new HttpError(404, 'Expo not found');
    if (new Date(req.body.endTime) <= new Date(req.body.startTime)) throw new HttpError(400, 'End time must be after start time');
    const session = await Session.create(req.body);
    socket.toExpo(session.expo, 'schedule:changed', { action: 'created', session });
    res.status(201).json({ session });
  })
);

router.put(
  '/:id',
  protect,
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const session = await Session.findById(req.params.id);
    if (!session) throw new HttpError(404, 'Session not found');
    ['title', 'topic', 'description', 'speaker', 'location', 'startTime', 'endTime', 'capacity', 'type'].forEach((k) => {
      if (req.body[k] !== undefined) session[k] = req.body[k];
    });
    if (session.endTime <= session.startTime) throw new HttpError(400, 'End time must be after start time');
    await session.save();
    // reset reminder flags because the time may have moved
    await Registration.updateMany({ session: session._id, kind: 'bookmark' }, { $set: { reminded: false } });
    socket.toExpo(session.expo, 'schedule:changed', { action: 'updated', session });
    const regs = await Registration.find({ session: session._id });
    await notifyMany([...new Set(regs.map((r) => String(r.user)))], `Schedule change: ${session.title}`, 'This session was updated. Please check the new time/location.', `/expos/${session.expo}`);
    res.json({ session });
  })
);

router.delete(
  '/:id',
  protect,
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const session = await Session.findById(req.params.id);
    if (!session) throw new HttpError(404, 'Session not found');
    const regs = await Registration.find({ session: session._id });
    await Registration.deleteMany({ session: session._id });
    await session.deleteOne();
    socket.toExpo(session.expo, 'schedule:changed', { action: 'deleted', session });
    await notifyMany([...new Set(regs.map((r) => String(r.user)))], `Session cancelled: ${session.title}`, '', `/expos/${session.expo}`);
    res.json({ message: 'Session deleted' });
  })
);

// toggle register / bookmark
async function toggle(req, res, kind) {
  const session = await Session.findById(req.params.id);
  if (!session) throw new HttpError(404, 'Session not found');
  const key = { user: req.user._id, expo: session.expo, session: session._id, kind };
  const existing = await Registration.findOne(key);
  if (existing) {
    await existing.deleteOne();
    return res.json({ active: false });
  }
  if (kind === 'session' && session.capacity > 0) {
    const count = await Registration.countDocuments({ session: session._id, kind: 'session' });
    if (count >= session.capacity) throw new HttpError(409, 'This session is full');
  }
  await Registration.create(key);
  res.json({ active: true });
}

router.post('/:id/register', protect, asyncHandler((req, res) => toggle(req, res, 'session')));
router.post('/:id/bookmark', protect, asyncHandler((req, res) => toggle(req, res, 'bookmark')));

// Admin: attendee list for a session
router.get(
  '/:id/attendees',
  protect,
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const regs = await Registration.find({ session: req.params.id, kind: 'session' }).populate('user', 'name email');
    res.json({ attendees: regs.map((r) => r.user) });
  })
);

module.exports = router;
