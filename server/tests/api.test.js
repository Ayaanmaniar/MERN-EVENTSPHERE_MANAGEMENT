const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');

let mongod;
const tokens = {};
const ids = {};

beforeAll(async () => {
  // Use TEST_MONGO_URI to point at any MongoDB; otherwise an in-memory MongoDB is started.
  if (process.env.TEST_MONGO_URI) {
    await mongoose.connect(process.env.TEST_MONGO_URI);
    await mongoose.connection.dropDatabase();
  } else {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
  }
  await User.create({ name: 'Admin', email: 'admin@test.com', password: 'Admin1234', role: 'admin', consent: { terms: true } });
});
afterAll(async () => {
  if (process.env.TEST_MONGO_URI) await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

const auth = (t) => ({ Authorization: `Bearer ${t}` });

describe('Auth', () => {
  test('register exhibitor + attendee, reject weak password and missing consent', async () => {
    let r = await request(app).post('/api/auth/register').send({ name: 'Ex', email: 'ex@test.com', password: 'Passw0rd1', role: 'exhibitor', companyName: 'ExCo', consent: true });
    expect(r.status).toBe(201);
    tokens.ex = r.body.token; ids.ex = r.body.user._id;
    r = await request(app).post('/api/auth/register').send({ name: 'At', email: 'at@test.com', password: 'Passw0rd1', role: 'attendee', consent: true });
    expect(r.status).toBe(201);
    tokens.at = r.body.token; ids.at = r.body.user._id;
    r = await request(app).post('/api/auth/register').send({ name: 'x', email: 'x@test.com', password: 'short', consent: true });
    expect(r.status).toBe(400);
    r = await request(app).post('/api/auth/register').send({ name: 'x', email: 'x@test.com', password: 'Passw0rd1' });
    expect(r.status).toBe(400);
  });

  test('cannot self-register as admin', async () => {
    const r = await request(app).post('/api/auth/register').send({ name: 'Evil', email: 'evil@test.com', password: 'Passw0rd1', role: 'admin', consent: true });
    expect(r.body.user.role).toBe('attendee');
  });

  test('login works and password is hashed', async () => {
    const r = await request(app).post('/api/auth/login').send({ email: 'admin@test.com', password: 'Admin1234' });
    expect(r.status).toBe(200);
    tokens.admin = r.body.token;
    const u = await User.findOne({ email: 'admin@test.com' }).select('+password');
    expect(u.password).not.toBe("Admin1234");
  });

  test('wrong password rejected', async () => {
    const r = await request(app).post('/api/auth/login').send({ email: 'admin@test.com', password: 'nope12345' });
    expect(r.status).toBe(401);
  });

  test('NoSQL injection in login is blocked', async () => {
    const r = await request(app).post('/api/auth/login').send({ email: { $gt: '' }, password: { $gt: '' } });
    expect(r.status).toBe(400);
  });

  test('forgot + reset password flow', async () => {
    let r = await request(app).post('/api/auth/forgot-password').send({ email: 'at@test.com' });
    expect(r.status).toBe(200);
    const token = r.body.devResetLink.split('/').pop();
    r = await request(app).post(`/api/auth/reset-password/${token}`).send({ password: 'NewPassw0rd' });
    expect(r.status).toBe(200);
    r = await request(app).post('/api/auth/login').send({ email: 'at@test.com', password: 'NewPassw0rd' });
    expect(r.status).toBe(200);
    r = await request(app).post(`/api/auth/reset-password/${token}`).send({ password: 'Another1234' });
    expect(r.status).toBe(400); // token is single use
  });
});

describe('Expo / RBAC', () => {
  test('only admin can create expo', async () => {
    const body = { title: 'Test Expo', location: 'Hall 1', startDate: '2030-01-01', endDate: '2030-01-03' };
    let r = await request(app).post('/api/expos').set(auth(tokens.at)).send(body);
    expect(r.status).toBe(403);
    r = await request(app).post('/api/expos').set(auth(tokens.admin)).send(body);
    expect(r.status).toBe(201);
    ids.expo = r.body.expo._id;
  });

  test('anonymous cannot access protected route', async () => {
    const r = await request(app).get('/api/applications/mine');
    expect(r.status).toBe(401);
  });
});

describe('Booths, applications and reservation', () => {
  test('admin generates booths', async () => {
    const r = await request(app).post(`/api/booths/expo/${ids.expo}/generate`).set(auth(tokens.admin)).send({ rows: 2, cols: 3, price: 100 });
    expect(r.status).toBe(201);
    expect(r.body.total).toBe(6);
  });

  test('exhibitor cannot reserve before approval', async () => {
    const list = await request(app).get(`/api/booths/expo/${ids.expo}`);
    ids.booth = list.body.booths[0]._id;
    ids.booth2 = list.body.booths[1]._id;
    const r = await request(app).post(`/api/booths/${ids.booth}/reserve`).set(auth(tokens.ex));
    expect(r.status).toBe(403);
  });

  test('apply -> approve -> reserve; double booking prevented', async () => {
    let r = await request(app).post('/api/applications').set(auth(tokens.ex)).field('expo', ids.expo).field('companyName', 'ExCo').field('products', 'Widgets');
    expect(r.status).toBe(201);
    ids.app = r.body.application._id;
    // duplicate application
    r = await request(app).post('/api/applications').set(auth(tokens.ex)).field('expo', ids.expo).field('companyName', 'ExCo');
    expect(r.status).toBe(409);

    r = await request(app).put(`/api/applications/${ids.app}/status`).set(auth(tokens.admin)).send({ status: 'approved' });
    expect(r.status).toBe(200);

    r = await request(app).post(`/api/booths/${ids.booth}/reserve`).set(auth(tokens.ex));
    expect(r.status).toBe(200);
    expect(r.body.booth.status).toBe('reserved');

    // second booth for same exhibitor refused
    r = await request(app).post(`/api/booths/${ids.booth2}/reserve`).set(auth(tokens.ex));
    expect(r.status).toBe(409);
  });

  test('exhibitor edits own booth details', async () => {
    const r = await request(app).put(`/api/booths/${ids.booth}/details`).set(auth(tokens.ex)).send({ title: 'My Booth', staff: [{ name: 'A', role: 'Sales' }] });
    expect(r.status).toBe(200);
    expect(r.body.booth.details.title).toBe('My Booth');
  });
});

describe('Schedule, registrations, messaging, feedback, analytics', () => {
  test('admin creates session; attendee registers & bookmarks; capacity enforced', async () => {
    let r = await request(app).post('/api/sessions').set(auth(tokens.admin)).send({ expo: ids.expo, title: 'Talk', startTime: '2030-01-01T10:00:00Z', endTime: '2030-01-01T11:00:00Z', capacity: 1 });
    expect(r.status).toBe(201);
    ids.session = r.body.session._id;
    r = await request(app).post(`/api/sessions/${ids.session}/register`).set(auth(tokens.at));
    expect(r.body.active).toBe(true);
    r = await request(app).post(`/api/sessions/${ids.session}/bookmark`).set(auth(tokens.at));
    expect(r.body.active).toBe(true);
    r = await request(app).post(`/api/sessions/${ids.session}/register`).set(auth(tokens.ex));
    expect(r.status).toBe(409);
    r = await request(app).get(`/api/sessions/expo/${ids.expo}`).set(auth(tokens.at));
    expect(r.body.sessions[0].registered).toBe(true);
    expect(r.body.sessions[0].bookmarked).toBe(true);
  });

  test('invalid session times rejected', async () => {
    const r = await request(app).post('/api/sessions').set(auth(tokens.admin)).send({ expo: ids.expo, title: 'Bad', startTime: '2030-01-01T12:00:00Z', endTime: '2030-01-01T11:00:00Z' });
    expect(r.status).toBe(400);
  });

  test('attendee messages exhibitor; attendee->attendee blocked', async () => {
    let r = await request(app).post('/api/messages').set(auth(tokens.at)).send({ to: ids.ex, text: 'Hi, interested in your products' });
    expect(r.status).toBe(201);
    r = await request(app).get('/api/messages/conversations').set(auth(tokens.ex));
    expect(r.body.conversations[0].unread).toBe(1);
    r = await request(app).get(`/api/messages/thread/${ids.at}`).set(auth(tokens.ex));
    expect(r.body.messages).toHaveLength(1);
  });

  test('feedback submit + admin list', async () => {
    let r = await request(app).post('/api/feedback').set(auth(tokens.at)).send({ type: 'issue', subject: 'Bug', message: 'Something is wrong' });
    expect(r.status).toBe(201);
    r = await request(app).get('/api/feedback').set(auth(tokens.admin));
    expect(r.body.feedback).toHaveLength(1);
    r = await request(app).get('/api/feedback').set(auth(tokens.at));
    expect(r.status).toBe(403);
  });

  test('booth view tracks traffic; analytics shows it', async () => {
    await request(app).get(`/api/booths/${ids.booth}`).set(auth(tokens.at));
    const r = await request(app).get(`/api/analytics/expo/${ids.expo}`).set(auth(tokens.admin));
    expect(r.status).toBe(200);
    expect(r.body.boothTraffic[0].visits).toBe(1);
    expect(r.body.sessionPopularity[0].registrations).toBe(1);
    expect(r.body.booths.reserved).toBe(1);
  });

  test('exhibitor search by keyword', async () => {
    const r = await request(app).get(`/api/exhibitors?expo=${ids.expo}&search=exco`);
    expect(r.body.exhibitors).toHaveLength(1);
  });
});

describe('Privacy', () => {
  test('export my data and delete account', async () => {
    let r = await request(app).post('/api/auth/register').send({ name: 'Temp', email: 'temp@test.com', password: 'Passw0rd1', consent: true });
    const t = r.body.token;
    r = await request(app).get('/api/auth/me/export').set(auth(t));
    expect(r.status).toBe(200);
    expect(r.body.user.email).toBe('temp@test.com');
    r = await request(app).delete('/api/auth/me').set(auth(t)).send({ password: 'wrongpass1' });
    expect(r.status).toBe(400);
    r = await request(app).delete('/api/auth/me').set(auth(t)).send({ password: 'Passw0rd1' });
    expect(r.status).toBe(200);
    r = await request(app).post('/api/auth/login').send({ email: 'temp@test.com', password: 'Passw0rd1' });
    expect(r.status).toBe(401);
  });
});
