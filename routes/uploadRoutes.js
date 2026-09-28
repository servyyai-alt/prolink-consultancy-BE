const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const { anyUpload } = require('../middlewares/upload');
const { uploadToCloudinary } = require('../config/cloudinary');
const { sendSuccess, sendError } = require('../utils/response');

router.post('/image', protect, anyUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return sendError(res, 400, 'No file uploaded.');
    const { folder = 'prolink/misc' } = req.body;
    // Pass the whole file object — uploadToCloudinary uses req.file.buffer (memoryStorage / Vercel)
    const result = await uploadToCloudinary(req.file, folder);
    sendSuccess(res, 200, 'File uploaded.', { data: result });
  } catch (e) { next(e); }
});

module.exports = router;