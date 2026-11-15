const Notification = require('../models/Notification');
const socket = require('./socket');

async function notify(userId, title, body = '', link = '') {
  const n = await Notification.create({ user: userId, title, body, link });
  socket.toUser(String(userId), 'notification:new', n);
  return n;
}

async function notifyMany(userIds, title, body = '', link = '') {
  return Promise.all(userIds.map((id) => notify(id, title, body, link)));
}

module.exports = { notify, notifyMany };
