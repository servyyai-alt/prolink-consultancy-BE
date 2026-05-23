const express = require('express');
const router = express.Router();
const Service = require('../models/Service');
const { protect, authorize } = require('../middlewares/auth');
const { sendSuccess, sendError } = require('../utils/response');

router.get('/', async (req, res, next) => {
  try {
    const services = await Service.find({ isActive: true }).sort('order');
    sendSuccess(res, 200, 'Services fetched.', { data: { services } });
  } catch (e) { next(e); }
});

router.get('/:slug', async (req, res, next) => {
  try {
    const service = await Service.findOne({ slug: req.params.slug, isActive: true });
    if (!service) return sendError(res, 404, 'Service not found.');
    sendSuccess(res, 200, 'Service fetched.', { data: { service } });
  } catch (e) { next(e); }
});

router.post('/', protect, authorize('admin', 'super_admin'), async (req, res, next) => {
  try {
    const service = await Service.create(req.body);
    sendSuccess(res, 201, 'Service created.', { data: { service } });
  } catch (e) { next(e); }
});

router.put('/:id', protect, authorize('admin', 'super_admin'), async (req, res, next) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) return sendError(res, 404, 'Service not found.');

    Object.assign(service, req.body);
    await service.save();

    sendSuccess(res, 200, 'Service updated.', { data: { service } });
  } catch (e) { next(e); }
});

router.delete('/:id', protect, authorize('admin', 'super_admin'), async (req, res, next) => {
  try {
    await Service.findByIdAndDelete(req.params.id);
    sendSuccess(res, 200, 'Service deleted.');
  } catch (e) { next(e); }
});

module.exports = router;
