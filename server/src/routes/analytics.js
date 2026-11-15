const router = require('express').Router();
const Expo = require('../models/Expo');
const Booth = require('../models/Booth');
const BoothVisit = require('../models/BoothVisit');
const Registration = require('../models/Registration');
const Session = require('../models/Session');
const Application = require('../models/Application');
const User = require('../models/User');
const ExhibitorProfile = require('../models/ExhibitorProfile');
const Feedback = require('../models/Feedback');
const asyncHandler = require('../utils/asyncHandler');
const { protect, authorize } = require('../middleware/auth');

router.use(protect, authorize('admin'));

// Overall numbers for dashboard cards
router.get(
  '/overview',
  asyncHandler(async (req, res) => {
    const [expos, users, exhibitors, attendees, pendingApps, openFeedback, booths, reserved, regs, sessionRegs, visits] = await Promise.all([
      Expo.countDocuments(),
      User.countDocuments(),
      User.countDocuments({ role: 'exhibitor' }),
      User.countDocuments({ role: 'attendee' }),
      Application.countDocuments({ status: 'pending' }),
      Feedback.countDocuments({ status: 'open' }),
      Booth.countDocuments(),
      Booth.countDocuments({ status: 'reserved' }),
      Registration.countDocuments({ kind: 'expo' }),
      Registration.countDocuments({ kind: 'session' }),
      BoothVisit.countDocuments(),
    ]);
    res.json({ expos, users, exhibitors, attendees, pendingApps, openFeedback, booths, reserved, registrations: regs, sessionRegistrations: sessionRegs, boothVisits: visits });
  })
);

// Per expo report: attendee engagement, booth traffic, session popularity
router.get(
  '/expo/:expoId',
  asyncHandler(async (req, res) => {
    const expoId = req.params.expoId;
    const expo = await Expo.findById(expoId);
    const [attendees, booths, sessions, sessionRegs, visits, apps, profiles] = await Promise.all([
      Registration.countDocuments({ expo: expoId, kind: 'expo' }),
      Booth.find({ expo: expoId }).lean(),
      Session.find({ expo: expoId }).lean(),
      Registration.find({ expo: expoId, session: { $ne: null } }).select('session kind').lean(),
      BoothVisit.find({ expo: expoId }).select('booth user createdAt').lean(),
      Application.find({ expo: expoId }).select('status').lean(),
      ExhibitorProfile.find().select('user companyName').lean(),
    ]);

    // session popularity
    const pop = new Map(sessions.map((s) => [String(s._id), { _id: s._id, title: s.title, capacity: s.capacity, registrations: 0, bookmarks: 0 }]));
    sessionRegs.forEach((r) => {
      const p = pop.get(String(r.session));
      if (!p) return;
      if (r.kind === 'session') p.registrations += 1;
      if (r.kind === 'bookmark') p.bookmarks += 1;
    });
    const sessionPopularity = [...pop.values()].sort((a, b) => b.registrations + b.bookmarks - (a.registrations + a.bookmarks)).slice(0, 10);

    // booth traffic
    const boothMap = new Map(booths.map((b) => [String(b._id), b]));
    const company = new Map(profiles.map((p) => [String(p.user), p.companyName]));
    const traffic = new Map();
    const perDay = new Map();
    visits.forEach((v) => {
      const t = traffic.get(String(v.booth)) || { visits: 0, users: new Set() };
      t.visits += 1;
      if (v.user) t.users.add(String(v.user));
      traffic.set(String(v.booth), t);
      const day = new Date(v.createdAt).toISOString().slice(0, 10);
      perDay.set(day, (perDay.get(day) || 0) + 1);
    });
    const boothTraffic = [...traffic.entries()]
      .map(([id, t]) => {
        const b = boothMap.get(id) || {};
        return { _id: id, code: b.code, company: b.exhibitor ? company.get(String(b.exhibitor)) : undefined, visits: t.visits, uniqueVisitors: t.users.size };
      })
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 10);

    const reserved = booths.filter((b) => b.status === 'reserved').length;
    const applications = {};
    apps.forEach((a) => (applications[a.status] = (applications[a.status] || 0) + 1));
    res.json({
      expo: expo && { _id: expo._id, title: expo.title },
      attendees,
      sessions: sessions.length,
      booths: { total: booths.length, reserved, available: booths.filter((b) => b.status === 'available').length, occupancyRate: booths.length ? Math.round((reserved / booths.length) * 100) : 0 },
      sessionPopularity,
      boothTraffic,
      applications,
      visitsByDay: [...perDay.entries()].sort().map(([date, v]) => ({ date, visits: v })),
      generatedAt: new Date(),
    });
  })
);

// CSV export of the report
router.get(
  '/expo/:expoId/export.csv',
  asyncHandler(async (req, res) => {
    const sessions = await Session.find({ expo: req.params.expoId }).sort({ startTime: 1 });
    const regs = await Registration.find({ expo: req.params.expoId, session: { $ne: null } }).select('session kind').lean();
    const get = (id, k) => regs.filter((r) => String(r.session) === String(id) && r.kind === k).length;
    const rows = [['Session', 'Start', 'Speaker', 'Registrations', 'Bookmarks']].concat(
      sessions.map((s) => [s.title, s.startTime.toISOString(), s.speaker, get(s._id, 'session'), get(s._id, 'bookmark')])
    );
    const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    res.header('Content-Type', 'text/csv').attachment('expo-report.csv').send(csv);
  })
);

module.exports = router;
