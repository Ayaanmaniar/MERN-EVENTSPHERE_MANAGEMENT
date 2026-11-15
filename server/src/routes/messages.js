const router = require('express').Router();
const Message = require('../models/Message');
const User = require('../models/User');
const ExhibitorProfile = require('../models/ExhibitorProfile');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/HttpError');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const socket = require('../utils/socket');

router.use(protect);

// who can chat with whom:
//  admin <-> anyone ; exhibitor <-> exhibitor/attendee/admin ; attendee <-> exhibitor/admin
function allowed(a, b) {
  if (a.role === 'admin' || b.role === 'admin') return true;
  if (a.role === 'attendee' && b.role === 'attendee') return false;
  return true;
}

// Admin contact (for support)
router.get('/admins', asyncHandler(async (req, res) => {
  res.json({ admins: await User.find({ role: 'admin' }).select('name email role') });
}));

// conversation list: last message per partner + unread count
router.get(
  '/conversations',
  asyncHandler(async (req, res) => {
    const me = String(req.user._id);
    const msgs = await Message.find({ $or: [{ from: req.user._id }, { to: req.user._id }] })
      .sort({ createdAt: -1 })
      .limit(3000)
      .lean();
    const byPartner = new Map();
    for (const m of msgs) {
      const partner = String(m.from) === me ? String(m.to) : String(m.from);
      let c = byPartner.get(partner);
      if (!c) byPartner.set(partner, (c = { last: m, unread: 0 })); // first = newest
      if (String(m.to) === me && !m.read) c.unread += 1;
    }
    const ids = [...byPartner.keys()];
    const users = await User.find({ _id: { $in: ids } }).select('name role');
    const profiles = await ExhibitorProfile.find({ user: { $in: ids } }).select('user companyName');
    const umap = new Map(users.map((u) => [String(u._id), u]));
    const pmap = new Map(profiles.map((p) => [String(p.user), p.companyName]));
    const conversations = ids.map((id) => {
      const c = byPartner.get(id);
      const u = umap.get(id) || {};
      return { user: { _id: id, name: pmap.get(id) || u.name || 'Unknown', role: u.role }, lastMessage: c.last.text, lastAt: c.last.createdAt, unread: c.unread };
    });
    res.json({ conversations });
  })
);

router.get(
  '/thread/:userId',
  asyncHandler(async (req, res) => {
    const other = await User.findById(req.params.userId).select('name role');
    if (!other) throw new HttpError(404, 'User not found');
    const messages = await Message.find({
      $or: [
        { from: req.user._id, to: other._id },
        { from: other._id, to: req.user._id },
      ],
    })
      .sort({ createdAt: 1 })
      .limit(500);
    await Message.updateMany({ from: other._id, to: req.user._id, read: false }, { $set: { read: true } });
    res.json({ user: other, messages });
  })
);

router.post(
  '/',
  validate({ to: { required: true }, text: { required: true, max: 2000 } }),
  asyncHandler(async (req, res) => {
    const to = await User.findById(req.body.to);
    if (!to) throw new HttpError(404, 'Recipient not found');
    if (String(to._id) === String(req.user._id)) throw new HttpError(400, 'You cannot message yourself');
    if (!allowed(req.user, to)) throw new HttpError(403, 'Attendees cannot message other attendees');
    const msg = await Message.create({ from: req.user._id, to: to._id, text: req.body.text });
    socket.toUser(String(to._id), 'message:new', msg);
    res.status(201).json({ message: msg });
  })
);

router.get(
  '/unread-count',
  asyncHandler(async (req, res) => {
    res.json({ count: await Message.countDocuments({ to: req.user._id, read: false }) });
  })
);

module.exports = router;
