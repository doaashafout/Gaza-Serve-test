const { User, Request } = require('../Models');
const stateManager = require('../middlewares/stateManager');
const { sendWelcome } = require('../views/MainView');
const { sendCategorySelection, sendLocationSelection } = require('../views/FormView');
const { Markup } = require('telegraf');

/**
 * ClientController - Handles client (user) interactions
 */

async function handleStart(ctx) {
  const logoPath = getWelcomeLogoPath();

  await ctx.replyWithPhoto(
    { source: fs.createReadStream(logoPath) },
    {
      caption: getWelcomeCaption(),
      ...getWelcomeKeyboard()
    }
  );
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

async function handleRateTechnician(ctx, requestId, stars) {
  try {
    const { Rating, Technician, Request: Req } = require('../Models');

    const request = await Req.findOne({
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
    return ctx.reply(`✅ شكراً لتقييمك! لقد منحت ${stars} ${stars > 1 ? 'نجوم' : 'نجمة'}.\n📦 تم أرشفة الطلب.`);
  } catch (err) {
    console.error('[ClientController] Error rating:', err);
    return ctx.reply('حدث خطأ أثناء التقييم.');
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
    return ctx.reply('تم تخطي التقييم. شكراً لك!\n📦 تم أرشفة الطلب.');
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
  handleRateTechnician,
  handleSkipRating,
  handleArchivedRequests,
  handleDeleteArchived,
};
