const { User, Request } = require('../Models');
const stateManager = require('../middlewares/stateManager');
const { sendWelcome } = require('../views/MainView');
const { sendCategorySelection, sendLocationSelection, displayCategory } = require('../views/FormView');
const { Markup } = require('telegraf');

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
  return sendCategorySelection(ctx,
    '🏠 *طلب خدمة جديدة*\n\nأنا هنا لمساعدتك في طلب أي خدمة منزلية بسهولة وسرعة.\n\nاختر نوع الخدمة التي تحتاجها:'
  );
}

async function handleMyRequests(ctx) {
  try {
    const requests = await Request.findAll({
      where: {
        client_id: ctx.from.id,
        status: ['pending', 'accepted', 'on_the_way', 'in_progress'],
        is_archived: false,
      },
      order: [['created_at', 'DESC']],
      limit: 10,
    });

    if (!requests || requests.length === 0) {
      return ctx.reply(
        '📭 *لا توجد طلبات حالية*\n\nليس لديك أي طلبات نشطة حالياً.',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('+ طلب خدمة جديدة', 'new_request')],
          ]),
        }
      );
    }

    await ctx.reply('📋 *هذه قائمة طلباتك الحالية:*', { parse_mode: 'Markdown' });

    const statusMap = {
      pending: { label: 'قيد المراجعة', emoji: '🕐', color: '🟡' },
      accepted: { label: 'تم القبول', emoji: '✅', color: '🟢' },
      on_the_way: { label: 'في الطريق', emoji: '🚗', color: '🔵' },
      in_progress: { label: 'قيد التنفيذ', emoji: '🔧', color: '🟠' },
      completed: { label: 'مكتمل', emoji: '✅', color: '🟢' },
    };

    for (const req of requests) {
      const st = statusMap[req.status] || { label: req.status, emoji: '📌', color: '⚪' };
      const dateStr = req.created_at
        ? new Date(req.created_at).toLocaleString('ar', { timeZone: 'Asia/Gaza', dateStyle: 'short', timeStyle: 'short' })
        : '—';

      const text =
`#GS-${req.request_id}    ${st.color} *${st.label}*

🔧 *نوع الخدمة:* ${displayCategory(req.extracted_category)}
📍 *المنطقة:* ${req.location || '—'}${req.detailed_address ? `\n🏠 *العنوان:* ${req.detailed_address}` : ''}
📅 *تم الإرسال:* ${dateStr}`;

      const buttons = [];
      if (req.status === 'pending') {
        buttons.push([Markup.button.callback('❌ إلغاء الطلب', `cancel_${req.request_id}`)]);
      }
      buttons.push([Markup.button.callback('👁 عرض التفاصيل', `view_req_${req.request_id}`)]);

      await ctx.reply(text, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons),
      });
    }

    await ctx.reply(
      '─────────────────',
      {
        ...Markup.inlineKeyboard([
          [Markup.button.callback('+ خدمة جديدة', 'new_request'), Markup.button.callback('📦 الأرشيف', 'archived')],
        ]),
      }
    );
  } catch (err) {
    console.error('[ClientController] Error fetching requests:', err);
    return ctx.reply('⚠️ حدث خطأ أثناء جلب طلباتك. الرجاء المحاولة لاحقاً.');
  }
}

async function handleCancelRequest(ctx, requestId) {
  try {
    const request = await Request.findOne({
      where: { request_id: requestId, client_id: ctx.from.id },
    });

    if (!request) {
      return ctx.reply('⚠️ لم يتم العثور على الطلب.');
    }

    if (request.status !== 'pending') {
      return ctx.reply('⚠️ لا يمكن إلغاء الطلب لأنه لم يعد في حالة "قيد الانتظار".');
    }

    await request.update({ status: 'canceled', is_archived: true });

    return ctx.reply(
      `✅ *تم إلغاء الطلب #GS-${requestId} بنجاح.*`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🏠 القائمة الرئيسية', 'back_main')],
        ]),
      }
    );
  } catch (err) {
    console.error('[ClientController] Error canceling request:', err);
    return ctx.reply('⚠️ حدث خطأ أثناء إلغاء الطلب.');
  }
}

async function handleRateTechnician(ctx, requestId, stars) {
  try {
    const { Rating, Technician, Request: Req } = require('../Models');

    const request = await Req.findOne({
      where: { request_id: requestId, client_id: ctx.from.id },
    });

    if (!request || request.status !== 'completed') {
      return ctx.reply('⚠️ لا يمكن تقييم طلب غير مكتمل.');
    }

    const existingRating = await Rating.findOne({ where: { request_id: requestId } });
    if (existingRating) {
      return ctx.reply('ℹ️ لقد قمت بتقييم هذا الطلب مسبقاً.');
    }

    const starsNum = parseInt(stars);
    await Rating.create({ request_id: requestId, stars: starsNum });

    // Update technician's average rating
    if (request.tech_id) {
      const techRequests = await Req.findAll({
        where: { tech_id: request.tech_id },
        attributes: ['request_id'],
      });
      const reqIds = techRequests.map(r => r.request_id);
      const ratings = await Rating.findAll({ where: { request_id: reqIds } });
      if (ratings.length > 0) {
        const avg = ratings.reduce((s, r) => s + r.stars, 0) / ratings.length;
        await Technician.update(
          { rating_avg: Math.round(avg * 100) / 100 },
          { where: { tech_id: request.tech_id } }
        );
      }
    }

    await request.update({ is_archived: true, status: 'archived' });

    const starEmojis = '⭐'.repeat(starsNum) + '☆'.repeat(5 - starsNum);
    return ctx.reply(
      `✅ *شكراً لتقييمك!*\n\n${starEmojis}\n\nتقييمك يساعدنا في تحسين جودة الخدمة.\n📦 تم أرشفة الطلب.`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🏠 القائمة الرئيسية', 'back_main')],
        ]),
      }
    );
  } catch (err) {
    console.error('[ClientController] Error rating:', err);
    return ctx.reply('⚠️ حدث خطأ أثناء التقييم. الرجاء المحاولة لاحقاً.');
  }
}

async function handleSkipRating(ctx, requestId) {
  try {
    const request = await Request.findOne({
      where: { request_id: requestId, client_id: ctx.from.id },
    });
    if (request) {
      await request.update({ is_archived: true, status: 'archived' });
    }
    return ctx.reply(
      'تم تخطي التقييم. شكراً لاستخدامك غزة سيرف! 🙏\n📦 تم أرشفة الطلب.',
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🏠 القائمة الرئيسية', 'back_main')],
        ]),
      }
    );
  } catch (err) {
    console.error('[ClientController] Skip rating error:', err);
    return ctx.reply('تم تخطي التقييم. شكراً لك!');
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

    const statusMap = {
      completed: '✅ مكتمل',
      archived: '📦 مؤرشف',
      canceled: '❌ ملغي',
    };

    await ctx.reply('📦 *الطلبات المؤرشفة:*', { parse_mode: 'Markdown' });

    for (const req of requests) {
      const dateStr = req.updated_at ? new Date(req.updated_at).toLocaleDateString('ar-EG') : '—';
      const text =
`#GS-${req.request_id} — ${statusMap[req.status] || req.status}
🔧 ${displayCategory(req.extracted_category)}
📍 ${req.location || '—'}
📅 ${dateStr}`;

      await ctx.reply(text, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🗑️ حذف نهائياً', `delete_archived_${req.request_id}`)],
        ]),
      });
    }
  } catch (err) {
    console.error('[ClientController] Error fetching archived:', err);
    return ctx.reply('⚠️ حدث خطأ أثناء جلب الطلبات المؤرشفة.');
  }
}

async function handleDeleteArchived(ctx, requestId) {
  try {
    const request = await Request.findOne({
      where: { request_id: requestId, client_id: ctx.from.id, is_archived: true },
    });
    if (!request) return ctx.reply('⚠️ لم يتم العثور على الطلب.');
    await request.destroy();
    return ctx.reply('✅ تم حذف الطلب نهائياً.');
  } catch (err) {
    console.error('[ClientController] Delete archived error:', err);
    return ctx.reply('⚠️ حدث خطأ أثناء حذف الطلب.');
  }
}

module.exports = {
  handleStart,
  handleNewRequest,
  handleMyRequests,
  handleCancelRequest,
  handleRateTechnician,
  handleSkipRating,
  handleArchivedRequests,
  handleDeleteArchived,
};
