const express = require('express');
const fs = require('fs');
const router = express.Router();
const Brochure = require('../models/Brochure');
const { protect, authorize } = require('../middlewares/auth');
const { anyUpload } = require('../middlewares/upload');
const { cloudinary, uploadToCloudinary, deleteFromCloudinary } = require('../config/cloudinary');
const { sendSuccess, sendError } = require('../utils/response');

router.get('/', async (req, res, next) => {
  try {
    const brochures = await Brochure.find({ isActive: true })
      .sort({ createdAt: -1 })
      .select('name fileName url mimeType size createdAt');

    sendSuccess(res, 200, 'Brochures fetched.', {
      data: {
        brochures,
        count: brochures.length,
      },
    });
  } catch (e) { next(e); }
});

router.get('/:id/open', async (req, res, next) => {
  try {
    const brochure = await Brochure.findById(req.params.id).select('url mimeType fileName publicId isActive');

    if (!brochure || !brochure.isActive) {
      return sendError(res, 404, 'Brochure not found.');
    }

    const isPdf =
      (brochure.mimeType || '').toLowerCase() === 'application/pdf' ||
      brochure.fileName?.toLowerCase().endsWith('.pdf');

    if (!isPdf) {
      return res.redirect(302, brochure.url);
    }

    const publicId =
      brochure.publicId ||
      brochure.url.split('/upload/').pop()?.replace(/\.pdf$/i, '');

    const signedPdfUrl = cloudinary.utils.private_download_url(publicId, 'pdf', {
      resource_type: 'image',
      type: 'upload',
      secure: true,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    });

    return res.redirect(302, signedPdfUrl);
  } catch (e) { next(e); }
});

router.post(
  '/',
  protect,
  authorize('admin', 'super_admin', 'recruiter'),
  anyUpload.single('file'),
  async (req, res, next) => {
    try {
      const name = req.body.name?.trim();

      if (!name) return sendError(res, 400, 'Brochure name is required.');
      if (!req.file) return sendError(res, 400, 'Brochure file is required.');

      const uploadResult = await uploadToCloudinary(req.file.path, 'prolink/brochures');

      const brochure = await Brochure.create({
        name,
        fileName: req.file.originalname,
        url: uploadResult.url,
        publicId: uploadResult.public_id,
        mimeType: req.file.mimetype,
        size: req.file.size,
        uploadedBy: req.user._id,
      });

      fs.unlink(req.file.path, () => {});

      sendSuccess(res, 201, 'Brochure uploaded.', { data: { brochure } });
    } catch (e) {
      if (req.file?.path) fs.unlink(req.file.path, () => {});
      next(e);
    }
  }
);

router.delete(
  '/:id',
  protect,
  authorize('admin', 'super_admin', 'recruiter'),
  async (req, res, next) => {
    try {
      const brochure = await Brochure.findById(req.params.id);

      if (!brochure || !brochure.isActive) {
        return sendError(res, 404, 'Brochure not found.');
      }

      if (brochure.publicId) {
        const resourceTypes = ['image', 'raw', 'video'];
        for (const resourceType of resourceTypes) {
          try {
            const result = await deleteFromCloudinary(brochure.publicId, { resource_type: resourceType });
            if (result?.result !== 'not found') break;
          } catch (error) {
            if (resourceType === resourceTypes[resourceTypes.length - 1]) throw error;
          }
        }
      }

      brochure.isActive = false;
      await brochure.save();

      sendSuccess(res, 200, 'Brochure deleted.', { data: { brochure } });
    } catch (e) { next(e); }
  }
);

module.exports = router;
