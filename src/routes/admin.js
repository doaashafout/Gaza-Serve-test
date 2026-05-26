const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { User, Technician, Request, Rating, SupportTicket, Category, Admin, ActivityLog } = require('../Models');
const { Op, fn, col } = require('sequelize');
const sequelize = require('../config/database');
const apiConfig = require('../config/api');
const bot = require('../bot');

// Rate limiting for admin API
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { error: 'Too many requests' },
  standardHeaders: true,
  legacyHeaders: false,
});
router.use(adminLimiter);

// --- Auth Middleware ---
function auth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
  if (String(token) === String(apiConfig.ADMIN_ID)) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// --- Activity Log Helper ---
async function logAction(adminId, action, details, targetType, targetId) {
  try {
    await ActivityLog.create({ admin_id: adminId, action, details, target_type: targetType, target_id: targetId });
  } catch (_) {}
}

// ===================== DASHBOARD STATS =====================
router.get('/stats', auth, async (req, res) => {
  try {
    const [totalUsers, totalTechs, approvedTechs, pendingTechs, rejectedTechs,
      totalRequests, pendingReqs, acceptedReqs, onWayReqs, inProgReqs, completedReqs, canceledReqs,
      totalTickets, openTickets, repliedTickets, closedTickets] = await Promise.all([
      User.count(), Technician.count(), Technician.count({ where: { status: 'approved' } }),
      Technician.count({ where: { status: 'pending' } }), Technician.count({ where: { status: 'rejected' } }),
      Request.count(), Request.count({ where: { status: 'pending' } }), Request.count({ where: { status: 'accepted' } }),
      Request.count({ where: { status: 'on_the_way' } }), Request.count({ where: { status: 'in_progress' } }),
      Request.count({ where: { status: 'completed' } }), Request.count({ where: { status: 'canceled' } }),
      SupportTicket.count(), SupportTicket.count({ where: { status: 'open' } }),
      SupportTicket.count({ where: { status: 'replied' } }), SupportTicket.count({ where: { status: 'closed' } }),
    ]);
    const topTechs = await Technician.findAll({ where: { status: 'approved', rating_avg: { [Op.gt]: 0 } }, order: [['rating_avg', 'DESC']], limit: 5 });
    const recentRequests = await Request.findAll({ order: [['created_at', 'DESC']], limit: 10, include: [{ model: User, as: 'client', attributes: ['full_name'] }] });

    // Requests by category
    const catCounts = await Request.findAll({ attributes: ['extracted_category', [fn('COUNT', col('extracted_category')), 'count']], group: ['extracted_category'], raw: true });
    const byCategory = {};
    catCounts.forEach(r => { if (r.extracted_category) byCategory[r.extracted_category] = parseInt(r.count); });

    // Requests by month (last 12 months)
    const monthCounts = await Request.findAll({
      attributes: [[fn('DATE_FORMAT', col('created_at'), '%Y-%m'), 'month'], [fn('COUNT', col('request_id')), 'count']],
      group: [fn('DATE_FORMAT', col('created_at'), '%Y-%m')],
      order: [[fn('DATE_FORMAT', col('created_at'), '%Y-%m'), 'ASC']],
      raw: true,
    });
    const byMonth = {};
    monthCounts.forEach(r => { byMonth[r.month] = parseInt(r.count); });

    const recentActivity = await ActivityLog.findAll({ order: [['created_at', 'DESC']], limit: 10, include: [{ model: Admin, as: 'admin', attributes: ['name'] }] });

    res.json({
      users: totalUsers,
      technicians: { total: totalTechs, approved: approvedTechs, pending: pendingTechs, rejected: rejectedTechs },
      requests: { total: totalRequests, pending: pendingReqs, accepted: acceptedReqs, on_the_way: onWayReqs, in_progress: inProgReqs, completed: completedReqs, canceled: canceledReqs, by_category: byCategory },
      tickets: { total: totalTickets, open: openTickets, replied: repliedTickets, closed: closedTickets },
      topTechs: topTechs.map(t => ({ name: t.full_name, category: t.category, rating: Number(t.rating_avg), location: t.location })),
      recentRequests: recentRequests.map(r => ({ id: r.request_id, category: r.extracted_category, status: r.status, location: r.location, client_name: r.client?.full_name || '-', created: r.created_at })),
      requestsByMonth: byMonth,
      recentActivity: recentActivity.map(l => ({ id: l.log_id, admin: l.admin?.name || 'System', action: l.action, details: l.details, time: l.created_at })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===================== USERS =====================
router.get('/users', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const where = {};
    if (search) where.full_name = { [Op.like]: `%${search}%` };
    const { rows, count } = await User.findAndCountAll({ where, limit, offset, order: [['user_id', 'DESC']] });
    const rowsWithCounts = await Promise.all(rows.map(async (u) => {
      const reqCount = await Request.count({ where: { client_id: u.user_id } });
      return { ...u.toJSON(), request_count: reqCount };
    }));
    res.json({ data: rowsWithCounts, total: count, page, totalPages: Math.ceil(count / limit) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/users/:id/block', auth, async (req, res) => {
  try {
    await User.update({ is_active: false }, { where: { user_id: req.params.id } });
    logAction(null, 'block_user', `Blocked user ${req.params.id}`, 'user', req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/users/:id/unblock', auth, async (req, res) => {
  try {
    await User.update({ is_active: true }, { where: { user_id: req.params.id } });
    logAction(null, 'unblock_user', `Unblocked user ${req.params.id}`, 'user', req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/users/:id/requests', auth, async (req, res) => {
  try {
    const requests = await Request.findAll({ where: { client_id: req.params.id }, order: [['created_at', 'DESC']], limit: 20 });
    res.json(requests);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ===================== TECHNICIANS =====================
router.get('/technicians', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const status = req.query.status || '';
    const category = req.query.category || '';
    const where = {};
    if (search) where[Op.or] = [{ full_name: { [Op.like]: `%${search}%` } }, { phone: { [Op.like]: `%${search}%` } }];
    if (status) where.status = status;
    if (category) where.category = category;
    const { rows, count } = await Technician.findAndCountAll({ where, limit, offset, order: [['tech_id', 'DESC']] });
    res.json({ data: rows, total: count, page, totalPages: Math.ceil(count / limit) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/technicians/:id', auth, async (req, res) => {
  try {
    const tech = await Technician.findByPk(req.params.id);
    if (!tech) return res.status(404).json({ error: 'Not found' });
    res.json(tech);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/technicians', auth, async (req, res) => {
  try {
    const { full_name, phone, category, location, password } = req.body;
    if (!full_name || !phone || !category) return res.status(400).json({ error: 'الحقول المطلوبة: name, phone, category' });
    const tech = await Technician.create({ full_name, phone, category, location, password, status: 'approved', is_available: true });
    logAction(null, 'create_technician', `Created technician ${full_name}`, 'technician', tech.tech_id);
    res.json(tech);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/technicians/:id', auth, async (req, res) => {
  try {
    const tech = await Technician.findByPk(req.params.id);
    if (!tech) return res.status(404).json({ error: 'Not found' });
    const { full_name, phone, category, location } = req.body;
    await tech.update({ full_name, phone, category, location });
    logAction(null, 'update_technician', `Updated technician ${tech.full_name}`, 'technician', tech.tech_id);
    res.json(tech);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/technicians/:id', auth, async (req, res) => {
  try {
    const tech = await Technician.findByPk(req.params.id);
    if (!tech) return res.status(404).json({ error: 'Not found' });
    await Request.update({ tech_id: null }, { where: { tech_id: tech.tech_id } });
    await tech.destroy();
    logAction(null, 'delete_technician', `Hard-deleted technician ${tech.full_name}`, 'technician', tech.tech_id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/technicians/:id/approve', auth, async (req, res) => {
  try {
    const tech = await Technician.findByPk(req.params.id);
    if (!tech) return res.status(404).json({ error: 'Not found' });
    await tech.update({ status: 'approved', is_available: true });
    if (bot && tech.telegram_id) {
      try { await bot.telegram.sendMessage(tech.telegram_id, '✅ تم قبول تسجيلك كفني في GazaServe!\nيمكنك الآن استقبال الطلبات.'); } catch (_) {}
    }
    logAction(null, 'approve_technician', `Approved technician ${tech.full_name}`, 'technician', tech.tech_id);
    res.json(tech);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/technicians/:id/reject', auth, async (req, res) => {
  try {
    const tech = await Technician.findByPk(req.params.id);
    if (!tech) return res.status(404).json({ error: 'Not found' });
    await tech.update({ status: 'rejected' });
    if (bot && tech.telegram_id) {
      try { await bot.telegram.sendMessage(tech.telegram_id, '❌ للأسف، لم يتم قبول تسجيلك كفني في GazaServe حالياً.'); } catch (_) {}
    }
    logAction(null, 'reject_technician', `Rejected technician ${tech.full_name}`, 'technician', tech.tech_id);
    res.json(tech);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ===================== REQUESTS =====================
router.get('/requests', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const status = req.query.status || '';
    const where = {};
    if (status) where.status = status;
    const { rows, count } = await Request.findAndCountAll({
      where, limit, offset, order: [['created_at', 'DESC']],
      include: [
        { model: User, as: 'client', attributes: ['full_name', 'telegram_id'] },
        { model: Technician, as: 'technician', attributes: ['full_name', 'category'] },
      ]
    });
    res.json({ data: rows, total: count, page, totalPages: Math.ceil(count / limit) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/requests/:id', auth, async (req, res) => {
  try {
    const request = await Request.findByPk(req.params.id, {
      include: [
        { model: User, as: 'client', attributes: ['full_name', 'telegram_id'] },
        { model: Technician, as: 'technician', attributes: ['full_name', 'category', 'phone'] },
        { model: Rating, as: 'rating' },
      ]
    });
    if (!request) return res.status(404).json({ error: 'Not found' });
    res.json(request);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/requests/:id/available-techs', auth, async (req, res) => {
  try {
    const request = await Request.findByPk(req.params.id);
    if (!request) return res.status(404).json({ error: 'Not found' });
    const techs = await Technician.findAll({ where: { status: 'approved', is_available: true, category: request.extracted_category } });
    res.json(techs);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/requests/:id/reassign', auth, async (req, res) => {
  try {
    const { technician_id } = req.body;
    const request = await Request.findByPk(req.params.id);
    if (!request) return res.status(404).json({ error: 'Not found' });
    const oldTech = request.tech_id;
    await request.update({ tech_id: technician_id, status: 'pending' });
    const newTech = await Technician.findByPk(technician_id);
    if (bot && newTech?.telegram_id) {
      try { await bot.telegram.sendMessage(newTech.telegram_id, `📌 تم تعيين طلب جديد لك\nالتخصص: ${request.extracted_category}\nالموقع: ${request.location}`); } catch (_) {}
    }
    if (bot && request.client_id) {
      try { await bot.telegram.sendMessage(String(request.client_id), '🔄 تم تحويل طلبك إلى فني آخر، سيتم التواصل معك قريباً.'); } catch (_) {}
    }
    logAction(null, 'reassign_request', `Reassign request ${req.params.id} from tech ${oldTech} to ${technician_id}`, 'request', req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ===================== CATEGORIES =====================
router.get('/categories', auth, async (req, res) => {
  try {
    const cats = await Category.findAll({ order: [['name_ar', 'ASC']] });
    res.json(cats);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/categories', auth, async (req, res) => {
  try {
    const { name_ar, name_en, icon } = req.body;
    if (!name_ar || !name_en) return res.status(400).json({ error: 'name_ar and name_en required' });
    const cat = await Category.create({ name_ar, name_en, icon: icon || '🔧' });
    logAction(null, 'create_category', `Created category ${name_ar}`, 'category', cat.category_id);
    res.json(cat);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/categories/:id', auth, async (req, res) => {
  try {
    const cat = await Category.findByPk(req.params.id);
    if (!cat) return res.status(404).json({ error: 'Not found' });
    const { name_ar, name_en, icon } = req.body;
    await cat.update({ name_ar, name_en, icon });
    logAction(null, 'update_category', `Updated category ${name_ar}`, 'category', cat.category_id);
    res.json(cat);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/categories/:id', auth, async (req, res) => {
  try {
    const cat = await Category.findByPk(req.params.id);
    if (!cat) return res.status(404).json({ error: 'Not found' });
    const reqCount = await Request.count({ where: { extracted_category: cat.name_ar } });
    if (reqCount > 0) return res.status(400).json({ error: `لا يمكن حذف التصنيف، مرتبط بـ ${reqCount} طلب` });
    const techCount = await Technician.count({ where: { category: cat.name_ar } });
    if (techCount > 0) return res.status(400).json({ error: `لا يمكن حذف التصنيف، مرتبط بـ ${techCount} فني` });
    await cat.destroy();
    logAction(null, 'delete_category', `Deleted category ${cat.name_ar}`, 'category', req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ===================== TICKETS =====================
router.get('/tickets', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const status = req.query.status || '';
    const where = {};
    if (status) where.status = status;
    const { rows, count } = await SupportTicket.findAndCountAll({
      where, limit, offset, order: [['created_at', 'DESC']],
      include: [{ model: User, as: 'user', attributes: ['full_name', 'telegram_id'] }]
    });
    res.json({ data: rows, total: count, page, totalPages: Math.ceil(count / limit) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/tickets/:id/reply', auth, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });
    const ticket = await SupportTicket.findByPk(req.params.id, { include: [{ model: User, as: 'user' }] });
    if (!ticket) return res.status(404).json({ error: 'Not found' });
    await ticket.update({ admin_reply: message, status: 'replied' });
    if (bot && ticket.user) {
      try { await bot.telegram.sendMessage(String(ticket.user.telegram_id), `📞 رد على تذكرتك:\n\n${message}\n\nللرد، أرسل /support`); } catch (_) {}
    }
    logAction(null, 'reply_ticket', `Replied to ticket ${req.params.id}`, 'ticket', req.params.id);
    res.json(ticket);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ===================== NOTIFICATIONS =====================
router.post('/notifications/broadcast', auth, async (req, res) => {
  try {
    const { target, message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });
    let sent = 0;
    if (target === 'users' || target === 'all') {
      const users = await User.findAll({ attributes: ['telegram_id'] });
      for (const u of users) {
        if (bot) { try { await bot.telegram.sendMessage(String(u.telegram_id), `📢 إشعار من الإدارة:\n\n${message}`); sent++; } catch (_) {} }
      }
    }
    if (target === 'technicians' || target === 'all') {
      const techs = await Technician.findAll({ where: { status: 'approved' }, attributes: ['telegram_id'] });
      for (const t of techs) {
        if (bot && t.telegram_id) { try { await bot.telegram.sendMessage(String(t.telegram_id), `📢 إشعار للفنيين:\n\n${message}`); sent++; } catch (_) {} }
      }
    }
    logAction(null, 'broadcast', `Broadcast to ${target}: ${message.substring(0, 50)}...`, 'notification', null);
    res.json({ success: true, sent });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ===================== ACTIVITY LOGS =====================
router.get('/logs', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 30;
    const offset = (page - 1) * limit;
    const action = req.query.action || '';
    const search = req.query.search || '';
    const where = {};
    if (action) where.action = action;
    if (search) where.details = { [Op.like]: `%${search}%` };
    const { rows, count } = await ActivityLog.findAndCountAll({
      where, limit, offset, order: [['created_at', 'DESC']],
      include: [{ model: Admin, as: 'admin', attributes: ['name'] }]
    });
    res.json({ data: rows, total: count, page, totalPages: Math.ceil(count / limit) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ===================== SETTINGS =====================
let settings = {
  bot_name: 'GazaServe',
  business_hours_start: '08:00',
  business_hours_end: '22:00',
  max_requests_per_day: 50,
  require_approval: true,
};

router.get('/settings', auth, (req, res) => {
  res.json(settings);
});

router.put('/settings', auth, (req, res) => {
  Object.assign(settings, req.body);
  logAction(null, 'update_settings', 'Updated system settings', 'settings', null);
  res.json(settings);
});

// ===================== ADMINS =====================
router.get('/admins', auth, async (req, res) => {
  try {
    const admins = await Admin.findAll({ order: [['admin_id', 'ASC']] });
    // Auto-add the main admin if not exists
    if (!admins.find(a => String(a.telegram_id) === String(apiConfig.ADMIN_ID))) {
      const mainAdmin = await Admin.create({ name: 'Super Admin', telegram_id: apiConfig.ADMIN_ID, role: 'super_admin' });
      admins.push(mainAdmin);
    }
    res.json(admins);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/admins', auth, async (req, res) => {
  try {
    const { name, telegram_id, role } = req.body;
    if (!name || !telegram_id) return res.status(400).json({ error: 'Name and telegram_id required' });
    const admin = await Admin.create({ name, telegram_id, role: role || 'moderator' });
    logAction(null, 'create_admin', `Created admin ${name} with role ${role}`, 'admin', admin.admin_id);
    res.json(admin);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/admins/:id', auth, async (req, res) => {
  try {
    const admin = await Admin.findByPk(req.params.id);
    if (!admin) return res.status(404).json({ error: 'Not found' });
    const { name, telegram_id, role, is_active } = req.body;
    await admin.update({ name, telegram_id, role, is_active });
    logAction(null, 'update_admin', `Updated admin ${name}`, 'admin', admin.admin_id);
    res.json(admin);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/admins/:id', auth, async (req, res) => {
  try {
    const admin = await Admin.findByPk(req.params.id);
    if (!admin) return res.status(404).json({ error: 'Not found' });
    if (String(admin.telegram_id) === String(apiConfig.ADMIN_ID)) {
      return res.status(400).json({ error: 'لا يمكن حذف المشرف الرئيسي' });
    }
    await admin.destroy();
    logAction(null, 'delete_admin', `Deleted admin ${admin.name}`, 'admin', req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
