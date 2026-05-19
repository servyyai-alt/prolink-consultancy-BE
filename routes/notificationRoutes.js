const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const { protect } = require('../middlewares/auth');
const { sendSuccess } = require('../utils/response');

router.get('/', protect, async (req, res, next) => {
  try {
    const notifications = await Notification.find({ recipient: req.user._id }).sort('-createdAt').limit(30);
    const unreadCount = await Notification.countDocuments({ recipient: req.user._id, isRead: false });
    sendSuccess(res, 200, 'Notifications fetched.', { data: { notifications, unreadCount } });
  } catch (e) { next(e); }
});

router.patch('/mark-read', protect, async (req, res, next) => {
  try {
    await Notification.updateMany({ recipient: req.user._id, isRead: false }, { isRead: true, readAt: new Date() });
    sendSuccess(res, 200, 'Notifications marked as read.');
  } catch (e) { next(e); }
});

router.patch('/:id/read', protect, async (req, res, next) => {
  try {
    await Notification.findOneAndUpdate({ _id: req.params.id, recipient: req.user._id }, { isRead: true, readAt: new Date() });
    sendSuccess(res, 200, 'Notification read.');
  } catch (e) { next(e); }
});

module.exports = router;