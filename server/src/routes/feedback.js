const router = require('express').Router();
const Feedback = require('../models/Feedback');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/HttpError');
const validate = require('../middleware/validate');
const { protect, authorize } = require('../middleware/auth');
const { notify } = require('../utils/notify');

router.use(protect);

router.post(
  '/',
  validate({ subject: { required: true, max: 150 }, message: { required: true, max: 3000 }, type: { type: 'enum', values: ['suggestion', 'issue', 'other'] } }),
  asyncHandler(async (req, res) => {
    const { type, subject, message, rating } = req.body;
    const fb = await Feedback.create({ user: req.user._id, type, subject, message, rating });
    const admins = await User.find({ role: 'admin' }).select('_id');
    await Promise.all(admins.map((a) => notify(a._id, `New ${fb.type}`, subject, '/admin/feedback')));
    res.status(201).json({ feedback: fb });
  })
);

router.get('/mine', asyncHandler(async (req, res) => {
  res.json({ feedback: await Feedback.find({ user: req.user._id }).sort({ createdAt: -1 }) });
}));

router.get('/', authorize('admin'), asyncHandler(async (req, res) => {
  const q = {};
  if (req.query.status) q.status = req.query.status;
  if (req.query.type) q.type = req.query.type;
  res.json({ feedback: await Feedback.find(q).populate('user', 'name email role').sort({ createdAt: -1 }) });
}));

router.put('/:id', authorize('admin'), asyncHandler(async (req, res) => {
  const fb = await Feedback.findById(req.params.id);
  if (!fb) throw new HttpError(404, 'Feedback not found');
  if (req.body.status) fb.status = req.body.status;
  if (req.body.adminReply !== undefined) fb.adminReply = req.body.adminReply;
  await fb.save();
  if (req.body.adminReply) await notify(fb.user, 'Reply to your feedback', req.body.adminReply, '/feedback');
  res.json({ feedback: fb });
}));

module.exports = router;
