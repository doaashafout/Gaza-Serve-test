'use strict';
/**
 * REST API routes — used by the admin dashboard
 * Base path: /api
 */
const express = require('express');
const router  = express.Router();
const { User, Technician, Request, Rating, SupportTicket, Category, sequelize } = require('../Models');
const { Op } = require('sequelize');
const { ADMIN_ID } = require('../config/api');

// ─── Simple API-key auth ──────────────────────────────────────────────────────
function adminOnly(req, res, next) {
  const key = req.headers['x-admin-id'] || req.query.admin_id;
  if (String(key) !== String(ADMIN_ID)) return res.status(403).json({ error: 'Forbidden' });
  next();
}

// ─── Stats ────────────────────────────────────────────────────────────────────
router.get('/stats', adminOnly, async (req, res) => {
  try {
    const [users, techs, requests, openTickets] = await Promise.all([
      User.count(),
      Technician.count({ where: { status: 'approved' } }),
      Request.count({ where: { is_archived: false } }),
      SupportTicket.count({ where: { status: 'open' } }),
    ]);

    const byStatus = await Request.findAll({
      attributes: ['status', [sequelize.fn('COUNT', sequelize.col('status')), 'count']],
      where: { is_archived: false },
      group: ['status'],
      raw: true,
    });

    const byCategory = await Request.findAll({
      attributes: ['extracted_category', [sequelize.fn('COUNT', '*'), 'count']],
      group: ['extracted_category'],
      order: [[sequelize.fn('COUNT', '*'), 'DESC']],
      limit: 6,
      raw: true,
    });

    res.json({ users, techs, requests, openTickets, byStatus, byCategory });
  } catch (err) {
    console.error('[api/stats]', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Requests ─────────────────────────────────────────────────────────────────
router.get('/requests', adminOnly, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const where = {};
    if (status) where.status = status;
    const { rows, count } = await Request.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
    });
    res.json({ data: rows, total: count, page: parseInt(page) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/requests/:id', adminOnly, async (req, res) => {
  try {
    const req2 = await Request.findByPk(req.params.id);
    if (!req2) return res.status(404).json({ error: 'Not found' });
    res.json(req2);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/requests/:id/status', adminOnly, async (req, res) => {
  try {
    const { status } = req.body;
    const r = await Request.findByPk(req.params.id);
    if (!r) return res.status(404).json({ error: 'Not found' });
    await r.update({ status });
    res.json({ success: true, status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Technicians ──────────────────────────────────────────────────────────────
router.get('/technicians', adminOnly, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const where = {};
    if (status) where.status = status;
    const { rows, count } = await Technician.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
    });
    res.json({ data: rows, total: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/technicians/:id/status', adminOnly, async (req, res) => {
  try {
    const { status } = req.body;
    const t = await Technician.findByPk(req.params.id);
    if (!t) return res.status(404).json({ error: 'Not found' });
    await t.update({ status });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/technicians/:id', adminOnly, async (req, res) => {
  try {
    const t = await Technician.findByPk(req.params.id);
    if (!t) return res.status(404).json({ error: 'Not found' });
    await t.destroy();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Users ────────────────────────────────────────────────────────────────────
router.get('/users', adminOnly, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const { rows, count } = await User.findAndCountAll({
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
    });
    res.json({ data: rows, total: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/users/:id/block', adminOnly, async (req, res) => {
  try {
    const { block } = req.body;
    const u = await User.findByPk(req.params.id);
    if (!u) return res.status(404).json({ error: 'Not found' });
    await u.update({ is_active: !block });
    res.json({ success: true, is_active: !block });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Support Tickets ──────────────────────────────────────────────────────────
router.get('/tickets', adminOnly, async (req, res) => {
  try {
    const { status } = req.query;
    const where = {};
    if (status) where.status = status;
    const tickets = await SupportTicket.findAll({
      where,
      order: [['created_at', 'DESC']],
      limit: 50,
    });
    res.json(tickets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Categories ───────────────────────────────────────────────────────────────
router.get('/categories', async (req, res) => {
  try {
    const cats = await Category.findAll({ where: { is_active: true }, order: [['name_ar', 'ASC']] });
    res.json(cats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/categories', adminOnly, async (req, res) => {
  try {
    const { name_ar, name_en, icon } = req.body;
    if (!name_ar || !name_en) return res.status(400).json({ error: 'name_ar and name_en are required' });
    const cat = await Category.create({ name_ar, name_en, icon: icon || '🔧' });
    res.json(cat);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/categories/:id', adminOnly, async (req, res) => {
  try {
    const cat = await Category.findByPk(req.params.id);
    if (!cat) return res.status(404).json({ error: 'Not found' });
    await cat.update({ is_active: false });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
