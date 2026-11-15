const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const { clientUrl } = require('./config/env');
const sanitize = require('./middleware/sanitize');
const { notFound, errorHandler } = require('./middleware/error');
const logger = require('./utils/logger');

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: clientUrl, credentials: true }));
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(sanitize);

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', { stream: fs.createWriteStream(logger.accessLogPath, { flags: 'a' }) }));
  app.use(morgan('dev'));
}

// rate limits (stricter on auth endpoints)
const limiter = (max) => rateLimit({ windowMs: 15 * 60 * 1000, max, standardHeaders: true, legacyHeaders: false });
if (process.env.NODE_ENV !== 'test') {
  app.use('/api/auth', limiter(100));
  app.use('/api', limiter(2000));
}

app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date() }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/expos', require('./routes/expos'));
app.use('/api/booths', require('./routes/booths'));
app.use('/api/applications', require('./routes/applications'));
app.use('/api/exhibitors', require('./routes/exhibitors'));
app.use('/api/sessions', require('./routes/sessions'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/feedback', require('./routes/feedback'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/analytics', require('./routes/analytics'));

// Serve the built React app in production (single deployable)
const dist = path.join(__dirname, '..', '..', 'client', 'dist');
if (process.env.NODE_ENV === 'production' && fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api|uploads).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use(notFound);
app.use(errorHandler);

module.exports = app;
