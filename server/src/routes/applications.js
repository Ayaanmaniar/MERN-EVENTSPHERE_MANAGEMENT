const router = require('express').Router();
const Application = require('../models/Application');
const Expo = require('../models/Expo');
const Booth = require('../models/Booth');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/HttpError');
const validate = require('../middleware/validate');
const upload = require('../middleware/upload');
const { protect, authorize } = require('../middleware/auth');
const { notify } = require('../utils/notify');
const socket = require('../utils/socket');

router.use(protect);

// Exhibitor: apply for an expo (company details, products, documents)
router.post(
  '/',
  authorize('exhibitor'),
  upload.array('documents', 5),
  validate({ expo: { required: true }, companyName: { required: true } }),
  asyncHandler(async (req, res) => {
    const expo = await Expo.findById(req.body.expo);
    if (!expo || expo.status !== 'published') throw new HttpError(404, 'Expo not found or not open for applications');
    const documents = (req.files || []).map((f) => ({ name: f.originalname, url: `/uploads/${f.filename}` }));
    const app = await Application.create({
      expo: expo._id,
      exhibitor: req.user._id,
      companyName: req.body.companyName,
      products: req.body.products || '',
      message: req.body.message || '',
      documents,
    });
    // let admins know
    const User = require('../models/User');
    const admins = await User.find({ role: 'admin' }).select('_id');
    await Promise.all(admins.map((a) => notify(a._id, 'New exhibitor application', `${app.companyName} applied for ${expo.title}`, '/admin/applications')));
    res.status(201).json({ application: app });
  })
);

router.get(
  '/mine',
  authorize('exhibitor'),
  asyncHandler(async (req, res) => {
    const applications = await Application.find({ exhibitor: req.user._id })
      .populate('expo', 'title startDate endDate location')
      .populate('booth', 'code status')
      .sort({ createdAt: -1 });
    res.json({ applications });
  })
);

// Admin: list (filter by expo/status)
router.get(
  '/',
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const q = {};
    if (req.query.expo) q.expo = req.query.expo;
    if (req.query.status) q.status = req.query.status;
    const applications = await Application.find(q)
      .populate('expo', 'title')
      .populate('exhibitor', 'name email')
      .populate('booth', 'code')
      .sort({ createdAt: -1 });
    res.json({ applications });
  })
);

// Admin: approve / reject (optional booth assignment on approval)
router.put(
  '/:id/status',
  authorize('admin'),
  validate({ status: { required: true, type: 'enum', values: ['approved', 'rejected', 'pending'] } }),
  asyncHandler(async (req, res) => {
    const app = await Application.findById(req.params.id).populate('expo', 'title');
    if (!app) throw new HttpError(404, 'Application not found');
    app.status = req.body.status;
    app.adminNote = req.body.adminNote || '';

    if (req.body.status === 'approved' && req.body.boothId) {
      const booth = await Booth.findOneAndUpdate(
        { _id: req.body.boothId, expo: app.expo._id, status: 'available' },
        { $set: { status: 'reserved', exhibitor: app.exhibitor } },
        { returnDocument: 'after' }
      );
      if (!booth) throw new HttpError(409, 'Selected booth is not available');
      app.booth = booth._id;
      socket.toExpo(app.expo._id, 'booth:updated', booth);
    }
    if (req.body.status === 'rejected' && app.booth) {
      const booth = await Booth.findByIdAndUpdate(
        app.booth,
        { $set: { status: 'available', exhibitor: null, details: { title: '', productsShowcased: '', staff: [] } } },
        { returnDocument: 'after' }
      );
      app.booth = null;
      if (booth) socket.toExpo(app.expo._id, 'booth:updated', booth);
    }
    await app.save();
    await notify(
      app.exhibitor,
      `Application ${app.status}`,
      `Your application for ${app.expo.title} was ${app.status}.${app.adminNote ? ' Note: ' + app.adminNote : ''}`,
      '/exhibitor/applications'
    );
    res.json({ application: app });
  })
);

module.exports = router;
