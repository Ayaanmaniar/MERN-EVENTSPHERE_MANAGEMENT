const router = require('express').Router();
const ExhibitorProfile = require('../models/ExhibitorProfile');
const Booth = require('../models/Booth');
const Application = require('../models/Application');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/HttpError');
const upload = require('../middleware/upload');
const { protect, optionalAuth, authorize } = require('../middleware/auth');

const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Public search: ?expo=&search=&category=
router.get(
  '/',
  asyncHandler(async (req, res) => {
    let userFilter = null;
    if (req.query.expo) {
      const apps = await Application.find({ expo: req.query.expo, status: 'approved' }).select('exhibitor');
      userFilter = apps.map((a) => a.exhibitor);
    }
    const q = {};
    if (userFilter) q.user = { $in: userFilter };
    if (req.query.category) q.category = new RegExp(`^${esc(req.query.category)}$`, 'i');
    if (req.query.search) {
      const rx = new RegExp(esc(req.query.search), 'i');
      q.$or = [{ companyName: rx }, { description: rx }, { products: rx }, { category: rx }];
    }
    const profiles = await ExhibitorProfile.find(q).sort({ companyName: 1 }).limit(200);
    let booths = [];
    if (req.query.expo) booths = await Booth.find({ expo: req.query.expo, exhibitor: { $in: profiles.map((p) => p.user) } }).select('code exhibitor row col');
    const bmap = new Map(booths.map((b) => [String(b.exhibitor), b]));
    res.json({
      exhibitors: profiles.map((p) => ({ ...p.toObject(), booth: bmap.get(String(p.user)) || null })),
    });
  })
);

router.get(
  '/categories',
  asyncHandler(async (req, res) => {
    res.json({ categories: (await ExhibitorProfile.distinct('category')).sort() });
  })
);

router.get('/me/profile', protect, authorize('exhibitor'), asyncHandler(async (req, res) => {
  let profile = await ExhibitorProfile.findOne({ user: req.user._id });
  if (!profile) profile = await ExhibitorProfile.create({ user: req.user._id, companyName: req.user.name, contactEmail: req.user.email });
  res.json({ profile });
}));

router.put(
  '/me/profile',
  protect,
  authorize('exhibitor'),
  upload.single('logo'),
  asyncHandler(async (req, res) => {
    let profile = await ExhibitorProfile.findOne({ user: req.user._id });
    if (!profile) profile = new ExhibitorProfile({ user: req.user._id, companyName: req.user.name });
    ['companyName', 'category', 'description', 'website', 'contactEmail', 'contactPhone', 'address'].forEach((k) => {
      if (req.body[k] !== undefined) profile[k] = req.body[k];
    });
    if (req.body.products !== undefined) {
      profile.products = String(req.body.products).split(',').map((s) => s.trim()).filter(Boolean);
    }
    if (req.file) profile.logo = `/uploads/${req.file.filename}`;
    await profile.save();
    res.json({ profile });
  })
);

router.get(
  '/:userId',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const profile = await ExhibitorProfile.findOne({ user: req.params.userId });
    if (!profile) throw new HttpError(404, 'Exhibitor not found');
    const booths = await Booth.find({ exhibitor: profile.user }).populate('expo', 'title');
    res.json({ profile, booths });
  })
);

module.exports = router;
