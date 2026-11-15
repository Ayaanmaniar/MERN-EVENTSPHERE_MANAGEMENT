const jwt = require('jsonwebtoken');
const { jwtSecret, clientUrl } = require('../config/env');

let io = null;

function init(server) {
  const { Server } = require('socket.io');
  io = new Server(server, { cors: { origin: clientUrl, credentials: true } });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth && socket.handshake.auth.token;
      if (token) {
        const payload = jwt.verify(token, jwtSecret);
        socket.userId = payload.id;
        socket.role = payload.role;
      }
      next(); // anonymous sockets may still receive public broadcasts
    } catch (e) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    if (socket.userId) socket.join(`user:${socket.userId}`);
    socket.on('expo:join', (expoId) => socket.join(`expo:${expoId}`));
    socket.on('expo:leave', (expoId) => socket.leave(`expo:${expoId}`));
  });
  return io;
}

// emit to everyone watching an expo (schedule, booth and expo changes)
function toExpo(expoId, event, payload) {
  if (io) io.to(`expo:${expoId}`).emit(event, payload);
}
function toUser(userId, event, payload) {
  if (io) io.to(`user:${userId}`).emit(event, payload);
}
function broadcast(event, payload) {
  if (io) io.emit(event, payload);
}

module.exports = { init, toExpo, toUser, broadcast };
