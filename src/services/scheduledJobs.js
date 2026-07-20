const cron = require('node-cron');
const { Op } = require('sequelize');
const { Request } = require('../Models');
const { findMatchingTechs, notifyTechnicians } = require('./orderDistributor');

const URGENT_CATEGORIES = ['كهرباء', 'سباكة'];

function getEscalationHours(category) {
  return URGENT_CATEGORIES.includes(category) ? 1 : 6;
}

function getExpiryHours(category) {
  return URGENT_CATEGORIES.includes(category) ? 6 : 24;
}

async function processPendingOrders(telegram, adminId) {
  const pendingOrders = await Request.findAll({
    where: {
      status: { [Op.in]: ['pending', 'escalated'] },
      tech_id: null,
    },
  });

  const now = new Date();

  for (const order of pendingOrders) {
    const ageHours = (now - new Date(order.created_at)) / (1000 * 60 * 60);
    const escalateAfter = getEscalationHours(order.extracted_category);
    const expireAfter = getExpiryHours(order.extracted_category);

    if (ageHours >= expireAfter) {
      await order.update({ status: 'expired', expires_at: now });
      await notifyExpired(telegram, order);
      console.log(`[Scheduler] Order #${order.request_id}: expired after ${expireAfter}h`);
      continue;
    }

    if (order.status === 'pending' && ageHours >= escalateAfter) {
      const expanded = await findMatchingTechs(order, true);
      if (expanded.length > 0) {
        await notifyTechnicians(telegram, order, expanded);
        await order.update({ status: 'escalated' });
        console.log(`[Scheduler] Order #${order.request_id}: escalated to ${expanded.length} techs`);
      }
      await notifyClientEscalated(telegram, order);
      continue;
    }

    if (order.status === 'pending') {
      const local = await findMatchingTechs(order, false);
      if (local.length > 0) {
        await notifyTechnicians(telegram, order, local);
        console.log(`[Scheduler] Order #${order.request_id}: notified ${local.length} local techs`);
      }
    }
  }
}

async function notifyClientEscalated(telegram, order) {
  const text =
    `🌍 *تم توسيع نطاق البحث عن طلبك #${order.request_id}*\n\n`
    + `لم نعثر على فني في منطقتك خلال المدة المتوقعة، `
    + `لذا بدأنا بالبحث في المناطق المجاورة.\n\n`
    + `سنخبرك فور العثور على فني مناسب.`;
  try {
    await telegram.sendMessage(order.client_id, text, { parse_mode: 'Markdown' });
  } catch (_) {}
}

async function notifyExpired(telegram, order) {
  const text =
    `⏰ *انتهت مهلة الطلب #${order.request_id}*\n\n`
    + `نعتذر، لم نتمكن من العثور على فني مناسب لتنفيذ طلبك خلال المهلة المحددة.\n`
    + `تم إغلاق الطلب تلقائياً.\n\n`
    + `يمكنك إعادة إرسال الطلب لاحقاً من خلال /start.`;
  try {
    await telegram.sendMessage(order.client_id, text, { parse_mode: 'Markdown' });
  } catch (_) {}
}

function startScheduler(telegram, adminId) {
  processPendingOrders(telegram, adminId).catch(err => {
    console.error('[Scheduler] Initial run error:', err.message);
  });

  cron.schedule('*/15 * * * *', () => {
    processPendingOrders(telegram, adminId).catch(err => {
      console.error('[Scheduler] Error:', err.message);
    });
  });
  console.log('[Scheduler] Started (every 15 min)');
}

module.exports = { startScheduler, processPendingOrders };
