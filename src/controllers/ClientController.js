const fs = require('fs');
const { User, Request } = require('../Models');
const stateManager = require('../middlewares/stateManager');
const { sendWelcome, getWelcomeCaption, getWelcomeKeyboard, getWelcomeLogoPath } = require('../views/MainView');
const { sendCategorySelection, sendLocationSelection } = require('../views/FormView');
const { Markup } = require('telegraf');

async function handleStart(ctx) {
  stateManager.resetAll(ctx.from.id);
  const { isRegisteredTechnician } = require('../helpers/technicianHelper');
  const isTech = await isRegisteredTechnician(ctx.from.id);
  if (!isTech) {
    const text = '👋 *مرحباً بك في غزة سيرف*\n\nأنا مساعدك الذكي لطلب الخدمات المنزلية بسهولة وسرعة.\n\nاختر شو بدك:';
    return ctx.reply(text, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🔧 طلب خدمة', 'request_service')],
        [Markup.button.callback('📄 طلباتي', 'my_orders')],
        [Markup.button.callback('👨‍🔧 تسجيل كفني', 'register_technician')],
        [Markup.button.callback('📞 التواصل مع الدعم الفني', 'contact_support')],
      ]),
    });
  }
  const name = ctx.from?.first_name || '';
  const text = `👋 أهلاً فيك من جديد، ${name}!\n\nاختار شو بدك:`;
  return ctx.reply(text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('🔧 طلب خدمة', 'request_service')],
      [Markup.button.callback('📋 قائمة الفني', 'technician_panel')],
      [Markup.button.callback('❌ إلغاء الاشتراك كفني', 'deregister_tech')],
      [Markup.button.callback('📞 التواصل مع الدعم الفني', 'contact_support')],
    ]),
  });
}

async function handleNewRequest(ctx) {
  stateManager.setState(ctx.from.id, stateManager.STATE.IDLE);
  stateManager.setData(ctx.from.id, { action: 'new_request' });
  return sendCategorySelection(ctx, '📝 *طلب صيانة جديد*\n\nاختر نوع الخدمة المطلوبة:');
}

async function handleMyRequests(ctx) {
  try {
    const requests = await Request.findAll({
      where: { client_id: ctx.from.id, status: ['pending', 'accepted', 'on_the_way', 'in_progress'], is_archived: false },
      order: [['created_at', 'DESC']],
      limit: 10,
    });

    if (!requests || requests.length === 0) {
      return ctx.reply('📭 لا توجد طلبات حالية.', { parse_mode: 'Markdown' });
    }

    const { displayCategory } = require('../views/FormView');
    const statusMap = {
      pending: '⏳ قيد الانتظار',
      accepted: '✅ تم القبول',
      on_the_way: '🚗 الفني في الطريق',
      in_progress: '🔧 قيد التنفيذ',
      completed: '✔️ مكتمل',
    };

    for (const req of requests) {
      const locationInfo = req.detailed_address ? `📍 ${req.location} - ${req.detailed_address}\n` : req.location ? `📍 ${req.location}\n` : '';
      const dateStr = req.updated_at ? new Date(req.updated_at).toLocaleString('ar-EG') : '—';
      const text = `🆔 *#${req.request_id}*\n📋 *${displayCategory(req.extracted_category)}*\n${locationInfo}📌 الحالة: ${statusMap[req.status] || req.status}\n🕐 آخر تحديث: ${dateStr}`;

      if (req.status === 'pending') {
        await ctx.reply(text, {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🗑️ إلغاء الطلب', `cancel_${req.request_id}`)],
          ]),
        });
      } else {
        await ctx.reply(text, { parse_mode: 'Markdown' });
      }
    }
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

    await request.destroy();

    return ctx.reply('✅ تم حذف الطلب بنجاح.');
  } catch (err) {
    console.error('[ClientController] Error canceling request:', err);
    return ctx.reply('حدث خطأ أثناء إلغاء الطلب.');
  }
}

async function handleArchivedRequests(ctx) {
  try {
    const requests = await Request.findAll({
      where: { client_id: ctx.from.id, is_archived: true },
      order: [['created_at', 'DESC']],
      limit: 10,
    });

    if (!requests || requests.length === 0) {
      return ctx.reply('📦 لا توجد طلبات مؤرشفة.', { parse_mode: 'Markdown' });
    }

    const { displayCategory } = require('../views/FormView');
    const statusMap = {
      completed: '✔️ مكتمل',
      archived: '📦 مؤرشف',
      canceled: '❌ ملغي',
    };

    for (const req of requests) {
      const locationInfo = req.detailed_address ? `📍 ${req.location} - ${req.detailed_address}\n` : req.location ? `📍 ${req.location}\n` : '';
      const dateStr = req.updated_at ? new Date(req.updated_at).toLocaleString('ar-EG') : '—';
      const text = `🆔 *#${req.request_id}*\n📋 *${displayCategory(req.extracted_category)}*\n${locationInfo}📌 الحالة: ${statusMap[req.status] || req.status}\n🕐 آخر تحديث: ${dateStr}`;
      const { Markup: M } = require('telegraf');
      await ctx.reply(text, {
        parse_mode: 'Markdown',
        ...M.inlineKeyboard([
          [M.button.callback('🗑️ حذف نهائياً', `delete_archived_${req.request_id}`)],
        ]),
      });
    }
  } catch (err) {
    console.error('[ClientController] Error fetching archived:', err);
    return ctx.reply('حدث خطأ أثناء جلب الطلبات المؤرشفة.');
  }
}

async function handleDeleteArchived(ctx, requestId) {
  try {
    const request = await Request.findOne({
      where: { request_id: requestId, client_id: ctx.from.id, is_archived: true },
    });
    if (!request) return ctx.reply('لم يتم العثور على الطلب.');
    await request.destroy();
    return ctx.reply('✅ تم حذف الطلب نهائياً.');
  } catch (err) {
    console.error('[ClientController] Delete archived error:', err);
    return ctx.reply('حدث خطأ أثناء حذف الطلب.');
  }
}

module.exports = {
  handleStart,
  handleNewRequest,
  handleMyRequests,
  handleCancelRequest,
  handleArchivedRequests,
  handleDeleteArchived,
};
