const http = require('http');
const mongoose = require('mongoose');
const app = require('./app');
const env = require('./config/env');
const socket = require('./utils/socket');
const reminders = require('./utils/reminders');
const logger = require('./utils/logger');

async function main() {
  await mongoose.connect(env.mongoUri);
  logger.info('MongoDB connected');
  const server = http.createServer(app);
  socket.init(server);
  reminders.start();
  server.listen(env.port, () => logger.info(`EventSphere API running on http://localhost:${env.port}`));

  const shutdown = async () => {
    logger.info('Shutting down...');
    server.close();
    await mongoose.disconnect();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((e) => {
  logger.error('Failed to start server', e);
  process.exit(1);
});
