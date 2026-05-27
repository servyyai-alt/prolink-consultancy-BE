const express = require('express');
const router = express.Router();
const TeamMember = require('../models/TeamMember');
const { protect, authorize } = require('../middlewares/auth');
const { sendSuccess, sendError } = require('../utils/response');

const adminOnly = [protect, authorize('admin', 'super_admin', 'recruiter')];

const normalizePayload = (body = {}) => ({
  name: body.name?.trim(),
  role: body.role?.trim(),
  bio: body.bio?.trim() || '',
  linkedinUrl: body.linkedinUrl?.trim() || '',
  image: {
    url: body.image?.url?.trim() || '',
    public_id: body.image?.public_id?.trim() || '',
  },
  isActive: body.isActive !== false,
  order: Number(body.order) || 0,
});

router.get('/', async (req, res, next) => {
  try {
    const teamMembers = await TeamMember.find({ isActive: true }).sort({ order: 1, createdAt: -1 });
    sendSuccess(res, 200, 'Team members fetched.', { data: { teamMembers } });
  } catch (e) {
    next(e);
  }
});

router.post('/', ...adminOnly, async (req, res, next) => {
  try {
    const payload = normalizePayload(req.body);
    if (!payload.name) return sendError(res, 400, 'Name is required.', { name: 'Name is required.' });
    if (!payload.role) return sendError(res, 400, 'Role is required.', { role: 'Role is required.' });

    const teamMember = await TeamMember.create(payload);
    sendSuccess(res, 201, 'Team member created.', { data: { teamMember } });
  } catch (e) {
    next(e);
  }
});

router.put('/:id', ...adminOnly, async (req, res, next) => {
  try {
    const teamMember = await TeamMember.findById(req.params.id);
    if (!teamMember) return sendError(res, 404, 'Team member not found.');

    const payload = normalizePayload(req.body);
    if (!payload.name) return sendError(res, 400, 'Name is required.', { name: 'Name is required.' });
    if (!payload.role) return sendError(res, 400, 'Role is required.', { role: 'Role is required.' });

    Object.assign(teamMember, payload);
    await teamMember.save();

    sendSuccess(res, 200, 'Team member updated.', { data: { teamMember } });
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', ...adminOnly, async (req, res, next) => {
  try {
    const teamMember = await TeamMember.findById(req.params.id);
    if (!teamMember) return sendError(res, 404, 'Team member not found.');

    await TeamMember.findByIdAndDelete(req.params.id);
    sendSuccess(res, 200, 'Team member deleted.');
  } catch (e) {
    next(e);
  }
});

module.exports = router;
