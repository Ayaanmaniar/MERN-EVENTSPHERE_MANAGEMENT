const router = require('express').Router();
const Booth = require('../models/Booth');
const Expo = require('../models/Expo');
const BoothVisit = require('../models/BoothVisit');
const Application = require('../models/Application');
const ExhibitorProfile = require('../models/ExhibitorProfile');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/HttpError');
const { protect, optionalAuth, authorize } = require('../middleware/auth');
const socket = require('../utils/socket');
const { notify } = require('../utils/notify');

const rowLabel = (i) => String.fromCharCode(65 + i); // 0 -> A

async function publicBooth(b) {
  const o = b.toObject();
  if (b.exhibitor) {
    o.profile = await ExhibitorProfile.findOne({ user: b.exhibitor._id || b.exhibitor }).select('companyName logo category');
  }
  return o;
}

// all booths of an expo (floor plan)
router.get(
  '/expo/:expoId',
  asyncHandler(async (req, res) => {
    const booths = await Booth.find({ expo: req.params.expoId }).sort({ row: 1, col: 1 });
    const profiles = await ExhibitorProfile.find({ user: { $in: booths.map((b) => b.exhibitor).filter(Boolean) } }).select(
      'user companyName logo category'
    );
    const map = new Map(profiles.map((p) => [String(p.user), p]));
    res.json({
      booths: booths.map((b) => ({ ...b.toObject(), profile: b.exhibitor ? map.get(String(b.exhibitor)) || null : null })),
    });
  })
);

// Admin: generate a grid of booths from expo.floorPlan (rows x cols). Existing booths are kept.
router.post(
  '/expo/:expoId/generate',
  protect,
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const expo = await Expo.findById(req.params.expoId);
    if (!expo) throw new HttpError(404, 'Expo not found');
    const rows = Number(req.body.rows || expo.floorPlan.rows);
    const cols = Number(req.body.cols || expo.floorPlan.cols);
    const price = Number(req.body.price || 0);
    if (rows < 1 || cols < 1 || rows > 30 || cols > 30) throw new HttpError(400, 'rows/cols must be between 1 and 30');
    expo.floorPlan = { rows, cols };
    await expo.save();

    const docs = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        docs.push({ expo: expo._id, code: `${rowLabel(r)}${c + 1}`, row: r, col: c, price });
      }
    }
    // insert, skip duplicates
    await Booth.insertMany(docs, { ordered: false }).catch((e) => {
      if (e.code !== 11000 && !(e.writeErrors || []).every((w) => w.code === 11000)) throw e;
    });
    socket.toExpo(expo._id, 'booths:changed', { expo: expo._id });
    res.status(201).json({ message: 'Booths generated', total: await Booth.countDocuments({ expo: expo._id }) });
  })
);

// Admin: edit booth (size, price, status block/unblock) or assign exhibitor directly
router.put(
  '/:id',
  protect,
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const booth = await Booth.findById(req.params.id);
    if (!booth) throw new HttpError(404, 'Booth not found');
    ['size', 'price', 'code'].forEach((k) => {
      if (req.body[k] !== undefined) booth[k] = req.body[k];
    });
    if (req.body.status) {
      if (!['available', 'blocked'].includes(req.body.status)) throw new HttpError(400, 'Admins can set available or blocked here');
      if (booth.status === 'reserved') throw new HttpError(400, 'Release the booth before changing its status');
      booth.status = req.body.status;
    }
    await booth.save();
    socket.toExpo(booth.expo, 'booth:updated', booth);
    res.json({ booth });
  })
);

// Admin: assign booth to an approved exhibitor of that expo
router.post(
  '/:id/assign',
  protect,
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const booth = await Booth.findById(req.params.id);
    if (!booth) throw new HttpError(404, 'Booth not found');
    if (booth.status !== 'available') throw new HttpError(409, 'Booth is not available');
    const app = await Application.findOne({ expo: booth.expo, exhibitor: req.body.exhibitorId, status: 'approved' });
    if (!app) throw new HttpError(400, 'Exhibitor does not have an approved application for this expo');
    if (app.booth) throw new HttpError(409, 'Exhibitor already has a booth. Release it first.');
    booth.status = 'reserved';
    booth.exhibitor = app.exhibitor;
    await booth.save();
    app.booth = booth._id;
    await app.save();
    socket.toExpo(booth.expo, 'booth:updated', booth);
    await notify(app.exhibitor, 'Booth assigned', `Booth ${booth.code} was assigned to you.`, `/exhibitor/booth/${booth.expo}`);
    res.json({ booth });
  })
);

// Release a booth (admin: any, exhibitor: own)
router.post(
  '/:id/release',
  protect,
  asyncHandler(async (req, res) => {
    const booth = await Booth.findById(req.params.id);
    if (!booth) throw new HttpError(404, 'Booth not found');
    const isOwner = booth.exhibitor && String(booth.exhibitor) === String(req.user._id);
    if (req.user.role !== 'admin' && !isOwner) throw new HttpError(403, 'Not allowed');
    const owner = booth.exhibitor;
    await Application.updateOne({ expo: booth.expo, exhibitor: owner }, { $set: { booth: null } });
    booth.status = 'available';
    booth.exhibitor = null;
    booth.details = { title: '', productsShowcased: '', staff: [] };
    await booth.save();
    socket.toExpo(booth.expo, 'booth:updated', booth);
    if (owner && req.user.role === 'admin') await notify(owner, 'Booth released', `Booth ${booth.code} was released by the organizers.`);
    res.json({ booth });
  })
);

// Exhibitor reserves a booth (must have approved application and no booth yet)
router.post(
  '/:id/reserve',
  protect,
  authorize('exhibitor'),
  asyncHandler(async (req, res) => {
    const existing = await Booth.findById(req.params.id);
    if (!existing) throw new HttpError(404, 'Booth not found');
    const app = await Application.findOne({ expo: existing.expo, exhibitor: req.user._id });
    if (!app || app.status !== 'approved') throw new HttpError(403, 'Your application for this expo must be approved first');
    if (app.booth) throw new HttpError(409, 'You already reserved a booth. Release it first to pick another.');

    // atomic reservation: prevents two exhibitors from getting the same booth
    const booth = await Booth.findOneAndUpdate(
      { _id: existing._id, status: 'available' },
      { $set: { status: 'reserved', exhibitor: req.user._id } },
      { returnDocument: 'after' }
    );
    if (!booth) throw new HttpError(409, 'Sorry, this booth was just taken');
    app.booth = booth._id;
    await app.save();
    socket.toExpo(booth.expo, 'booth:updated', booth);
    res.json({ booth });
  })
);

// Exhibitor updates details of own booth
router.put(
  '/:id/details',
  protect,
  authorize('exhibitor'),
  asyncHandler(async (req, res) => {
    const booth = await Booth.findById(req.params.id);
    if (!booth || String(booth.exhibitor) !== String(req.user._id)) throw new HttpError(403, 'This is not your booth');
    const { title, productsShowcased, staff } = req.body;
    if (title !== undefined) booth.details.title = title;
    if (productsShowcased !== undefined) booth.details.productsShowcased = productsShowcased;
    if (Array.isArray(staff)) booth.details.staff = staff.slice(0, 20).map((s) => ({ name: s.name, role: s.role, phone: s.phone }));
    await booth.save();
    socket.toExpo(booth.expo, 'booth:updated', booth);
    res.json({ booth });
  })
);

// my booth for an expo
router.get(
  '/mine/:expoId',
  protect,
  authorize('exhibitor'),
  asyncHandler(async (req, res) => {
    const booth = await Booth.findOne({ expo: req.params.expoId, exhibitor: req.user._id });
    res.json({ booth });
  })
);

// Single booth view + traffic tracking (analytics)
router.get(
  '/:id',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const booth = await Booth.findById(req.params.id);
    if (!booth) throw new HttpError(404, 'Booth not found');
    if (!req.user || String(req.user._id) !== String(booth.exhibitor)) {
      await BoothVisit.create({ booth: booth._id, expo: booth.expo, user: req.user ? req.user._id : undefined });
    }
    res.json({ booth: await publicBooth(booth) });
  })
);

router.delete(
  '/:id',
  protect,
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const booth = await Booth.findById(req.params.id);
    if (!booth) throw new HttpError(404, 'Booth not found');
    if (booth.status === 'reserved') throw new HttpError(400, 'Release the booth before deleting');
    await booth.deleteOne();
    socket.toExpo(booth.expo, 'booths:changed', { expo: booth.expo });
    res.json({ message: 'Booth deleted' });
  })
);

module.exports = router;
