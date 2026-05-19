const express = require('express');
const router = express.Router();
const { sendSuccess, sendPaginated } = require('../utils/response');
const { protect, authorize } = require('../middlewares/auth');

router.get('/', async (req, res, next) => {
  try {
    const drives = []; // TODO: Fetch from CampusDrive model
    sendSuccess(res, 200, 'Campus drives fetched.', { data: { drives } });
  } catch (e) { next(e); }
});

module.exports = router;