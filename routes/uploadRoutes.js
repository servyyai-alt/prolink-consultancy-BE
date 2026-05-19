const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const { anyUpload } = require('../middlewares/upload');
const { uploadToCloudinary } = require('../config/cloudinary');
const { sendSuccess, sendError } = require('../utils/response');
const fs = require('fs');

router.post('/image', protect, anyUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return sendError(res, 400, 'No file uploaded.');
    const { folder = 'prolink/misc' } = req.body;
    const result = await uploadToCloudinary(req.file.path, folder);
    fs.unlink(req.file.path, () => {});
    sendSuccess(res, 200, 'File uploaded.', { data: result });
  } catch (e) { next(e); }
});

module.exports = router;