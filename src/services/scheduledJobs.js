const cron = require('node-cron');
const { Request } = require('../Models');
const { escalateOrder } = require('./orderDistributor');
const { calculateWorkingHoursElapsed, isWithinWorkingHours } = require('./workingHours');

async function checkPendingOrders(telegram, adminId) {
  if (!isWithinWorkingHours(new Date())) return;

  const pendingOrders = await Request.findAll({
    where: {
      status: 'pending',
      tech_id: null,
    },
  });

  for (const order of pendingOrders) {
    const elapsed = calculateWorkingHoursElapsed(order.created_at);

    if (elapsed >= 6 && !order.escalated_6h) {
      await escalateOrder(telegram, order, adminId);
      await order.update({ escalated_6h: true });
      console.log(`[Scheduler] Order #${order.request_id}: escalated to admin (6h)`);
    } else if (elapsed >= 3 && !order.escalated_3h) {
      await escalateOrder(telegram, order, adminId);
      await order.update({ escalated_3h: true });
      console.log(`[Scheduler] Order #${order.request_id}: expanded region (3h)`);
    }
  }
}

function startScheduler(telegram, adminId) {
  cron.schedule('*/15 * * * *', () => {
    checkPendingOrders(telegram, adminId).catch((err) => {
      console.error('[Scheduler] Error:', err.message);
    });
  });
  console.log('[Scheduler] Started (every 15 min)');
}

module.exports = { startScheduler, checkPendingOrders };
