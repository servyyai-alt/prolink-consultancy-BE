const Notification = require('../models/Notification');
const User = require('../models/User');

const ADMIN_ROLES = ['admin', 'super_admin', 'recruiter'];

const emitNotification = (req, recipientId, notification) => {
  req.app.get('io')?.sendNotification?.(String(recipientId), notification);
};

const createNotification = async (req, payload) => {
  const notification = await Notification.create(payload);
  emitNotification(req, payload.recipient, notification);
  return notification;
};

const notifyAdmins = async (req, payload, options = {}) => {
  const roles = options.roles || ADMIN_ROLES;
  const excludeUserId = options.excludeUserId ? String(options.excludeUserId) : null;
  const admins = await User.find({
    role: { $in: roles },
    isActive: true,
    isBlocked: { $ne: true },
    ...(excludeUserId ? { _id: { $ne: excludeUserId } } : {}),
  }).select('_id');

  const notifications = await Promise.all(
    admins.map((admin) => createNotification(req, {
      ...payload,
      recipient: admin._id,
    }))
  );

  return notifications;
};

module.exports = {
  ADMIN_ROLES,
  createNotification,
  notifyAdmins,
};
