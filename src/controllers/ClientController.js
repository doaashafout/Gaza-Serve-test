const { User, Request } = require('../Models');
const stateManager = require('../middleware/stateManager');
const { sendWelcome } = require('../views/MainView');
const { sendCategorySelection, sendLocationSelection } = require('../views/FormView');

/**
 * ClientController - Handles client (user) interactions
 */

async function handleStart(ctx) {
  stateManager.resetAll(ctx.from.id);
  return sendWelcome(ctx);
}

async function handleNewRequest(ctx) {
  stateManager.setState(ctx.from.id, stateManager.STATE.IDLE);
  stateManager.setData(ctx.from.id, { action: 'new_request' });
  return sendCategorySelection(ctx, '📝 *طلب صيانة جديد*\n\nاختر نوع الخدمة المطلوبة:');
}

async function handleMyRequests(ctx) {
  try {
    const requests = await Request.findAll({
      where: { client_id: ctx.from.id },
      order: [['created_at', 'DESC']],
      limit: 10,
    });

    const { sendOrderStatus } = require('../views/NotificationView');
    return sendOrderStatus(ctx, requests);
  } catch (err) {
    console.error('[ClientController] Error fetching requests:', err);
    return ctx.reply('حدث خطأ أثناء جلب طلباتك. الرجاء المحاولة لاحقاً.');
  }
}

async function handleCancelRequest(ctx, requestId) {
  try {
    const request = await Request.findOne({
      where: { request_id: requestId, client_id: ctx.from.id },
    });

    if (!request) {
      return ctx.reply('لم يتم العثور على الطلب.');
    }

    if (request.status !== 'pending') {
      return ctx.reply('لا يمكن إلغاء الطلب لأنه لم يعد في حالة "قيد الانتظار".');
    }

    request.status = 'canceled';
    await request.save();

    return ctx.reply('✅ تم إلغاء الطلب بنجاح.');
  } catch (err) {
    console.error('[ClientController] Error canceling request:', err);
    return ctx.reply('حدث خطأ أثناء إلغاء الطلب.');
  }
}

async function handleRateTechnician(ctx, requestId, stars) {
  try {
    const { Rating } = require('../Models');

    const request = await Request.findOne({
      where: { request_id: requestId, client_id: ctx.from.id },
    });

    if (!request || request.status !== 'completed') {
      return ctx.reply('لا يمكن تقييم طلب غير مكتمل.');
    }

    const existingRating = await Rating.findOne({ where: { request_id: requestId } });
    if (existingRating) {
      return ctx.reply('لقد قمت بتقييم هذا الطلب مسبقاً.');
    }

    await Rating.create({
      request_id: requestId,
      stars: parseInt(stars),
    });

    return ctx.reply(`✅ شكراً لتقييمك! لقد منحت ${stars} ${stars > 1 ? 'نجوم' : 'نجمة'}.`);
  } catch (err) {
    console.error('[ClientController] Error rating:', err);
    return ctx.reply('حدث خطأ أثناء التقييم.');
  }
}

module.exports = {
  handleStart,
  handleNewRequest,
  handleMyRequests,
  handleCancelRequest,
  handleRateTechnician,
};
