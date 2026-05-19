const express = require('express');
const router = express.Router();
const { sendSuccess } = require('../utils/response');

router.get('/', async (req, res, next) => {
  try {
    sendSuccess(res, 200, 'Events fetched.', { data: { events: [] } });
  } catch (e) { next(e); }
});

module.exports = router;