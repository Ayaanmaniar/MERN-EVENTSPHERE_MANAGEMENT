// Run: npm run seed   -> wipes the DB and inserts demo data
const mongoose = require('mongoose');
const env = require('./config/env');
const User = require('./models/User');
const Expo = require('./models/Expo');
const Booth = require('./models/Booth');
const ExhibitorProfile = require('./models/ExhibitorProfile');
const Application = require('./models/Application');
const Session = require('./models/Session');
const Registration = require('./models/Registration');
const Feedback = require('./models/Feedback');
const BoothVisit = require('./models/BoothVisit');
const Message = require('./models/Message');
const Notification = require('./models/Notification');

const consent = { terms: true, acceptedAt: new Date() };
const hours = (d, h, m = 0) => new Date(d.getTime() + (h * 60 + m) * 60000);

async function seed() {
  await mongoose.connect(env.mongoUri);
  await Promise.all([User, Expo, Booth, ExhibitorProfile, Application, Session, Registration, Feedback, BoothVisit, Message, Notification].map((m) => m.deleteMany({})));

  const admin = await User.create({ name: 'Event Admin', email: 'admin@eventsphere.com', password: 'Admin@123', role: 'admin', consent });
  const exhibitorData = [
    ['TechNova Ltd', 'tech@eventsphere.com', 'Technology', 'Cloud, AI and IoT solutions', ['Cloud hosting', 'AI chatbots', 'IoT sensors']],
    ['GreenLeaf Foods', 'green@eventsphere.com', 'Food & Beverage', 'Organic snacks and drinks', ['Organic tea', 'Healthy snacks']],
    ['BuildRight Co', 'build@eventsphere.com', 'Construction', 'Modern building materials', ['Smart glass', 'Eco cement']],
    ['MediCare Plus', 'medi@eventsphere.com', 'Healthcare', 'Medical devices and wellness', ['Wearables', 'Diagnostics']],
  ];
  const exhibitors = [];
  for (const [company, email, category, description, products] of exhibitorData) {
    const u = await User.create({ name: company, email, password: 'Exhibitor@123', role: 'exhibitor', consent });
    await ExhibitorProfile.create({ user: u._id, companyName: company, category, description, products, contactEmail: email, website: 'https://example.com' });
    exhibitors.push(u);
  }
  const attendees = [];
  for (const [n, e] of [['Ali Khan', 'ali@eventsphere.com'], ['Sara Ahmed', 'sara@eventsphere.com'], ['John Smith', 'john@eventsphere.com']]) {
    attendees.push(await User.create({ name: n, email: e, password: 'Attendee@123', role: 'attendee', consent }));
  }

  const start = new Date(); start.setDate(start.getDate() + 14); start.setHours(9, 0, 0, 0);
  const expo = await Expo.create({
    title: 'Global Tech & Trade Expo 2026',
    theme: 'Innovation for a Connected World',
    location: 'Expo Center, Karachi',
    description: 'A three day expo bringing together technology companies, startups, investors and visitors.',
    startDate: start,
    endDate: hours(start, 24 * 2 + 8),
    floorPlan: { rows: 4, cols: 6 },
    createdBy: admin._id,
  });
  const expo2 = await Expo.create({
    title: 'Food & Wellness Festival',
    theme: 'Eat well, live well',
    location: 'Lahore Exhibition Hall',
    description: 'Food producers, wellness brands and chefs under one roof.',
    startDate: hours(start, 24 * 40),
    endDate: hours(start, 24 * 42),
    floorPlan: { rows: 2, cols: 4 },
    createdBy: admin._id,
  });

  const makeBooths = async (e, price) => {
    const docs = [];
    for (let r = 0; r < e.floorPlan.rows; r++) for (let c = 0; c < e.floorPlan.cols; c++) {
      docs.push({ expo: e._id, code: `${String.fromCharCode(65 + r)}${c + 1}`, row: r, col: c, price, size: (r + c) % 5 === 0 ? 'large' : 'small' });
    }
    return Booth.insertMany(docs);
  };
  const booths = await makeBooths(expo, 500);
  await makeBooths(expo2, 300);

  // applications: 3 approved (booths reserved), 1 pending
  for (let i = 0; i < 3; i++) {
    const p = exhibitorData[i];
    const booth = booths[i * 2 + 1];
    booth.status = 'reserved'; booth.exhibitor = exhibitors[i]._id;
    booth.details = { title: `${p[0]} Pavilion`, productsShowcased: p[4].join(', '), staff: [{ name: 'Sales Rep', role: 'Sales', phone: '0300-0000000' }] };
    await booth.save();
    await Application.create({ expo: expo._id, exhibitor: exhibitors[i]._id, companyName: p[0], products: p[4].join(', '), status: 'approved', booth: booth._id });
  }
  await Application.create({ expo: expo._id, exhibitor: exhibitors[3]._id, companyName: exhibitorData[3][0], products: exhibitorData[3][4].join(', '), message: 'We would like a large booth near the entrance.' });

  const sessions = await Session.insertMany([
    { expo: expo._id, title: 'Opening Keynote: The Future of Connected Tech', type: 'keynote', speaker: 'Dr. Amina Raza', topic: 'Technology', location: 'Main Hall', startTime: hours(start, 1), endTime: hours(start, 2), capacity: 300 },
    { expo: expo._id, title: 'AI for Small Business', type: 'session', speaker: 'Omar Farooq', topic: 'AI', location: 'Room A', startTime: hours(start, 3), endTime: hours(start, 4), capacity: 60 },
    { expo: expo._id, title: 'Hands-on IoT Workshop', type: 'workshop', speaker: 'TechNova Team', topic: 'IoT', location: 'Lab 1', startTime: hours(start, 5), endTime: hours(start, 7), capacity: 25 },
    { expo: expo._id, title: 'Sustainable Construction Panel', type: 'session', speaker: 'BuildRight Co', topic: 'Construction', location: 'Room B', startTime: hours(start, 24 + 2), endTime: hours(start, 24 + 3), capacity: 80 },
    { expo: expo._id, title: 'Investor Meet & Greet', type: 'session', speaker: 'Various', topic: 'Investment', location: 'Lounge', startTime: hours(start, 48 + 2), endTime: hours(start, 48 + 3), capacity: 0 },
  ]);

  for (const a of attendees) {
    await Registration.create({ user: a._id, expo: expo._id, kind: 'expo' });
    await Registration.create({ user: a._id, expo: expo._id, session: sessions[0]._id, kind: 'session' });
  }
  await Registration.create({ user: attendees[0]._id, expo: expo._id, session: sessions[1]._id, kind: 'bookmark' });
  await Registration.create({ user: attendees[1]._id, expo: expo._id, session: sessions[1]._id, kind: 'session' });

  const reserved = booths.filter((b) => b.status === 'reserved');
  for (let i = 0; i < 25; i++) {
    const b = reserved[i % reserved.length];
    await BoothVisit.create({ booth: b._id, expo: expo._id, user: attendees[i % 3]._id });
  }

  await Message.create({ from: attendees[0]._id, to: exhibitors[0]._id, text: 'Hello! Do you offer a demo of your IoT sensors?' });
  await Feedback.create({ user: attendees[1]._id, type: 'suggestion', subject: 'Add a dark mode', message: 'It would be nice to have a dark mode for the website.', rating: 4 });

  console.log('\nSeed complete. Demo accounts:');
  console.log('  Admin     admin@eventsphere.com / Admin@123');
  console.log('  Exhibitor tech@eventsphere.com  / Exhibitor@123  (also green@, build@, medi@)');
  console.log('  Attendee  ali@eventsphere.com   / Attendee@123   (also sara@, john@)\n');
  await mongoose.disconnect();
}

seed().catch((e) => { console.error(e); process.exit(1); });
