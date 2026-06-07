/**
 * Bot - Telegram bot setup and event handling
 * GazaServe - Home Services Bot
 */

const { Telegraf } = require('telegraf');
const apiConfig = require('./config/api');
const stateManager = require('./middlewares/stateManager');
const { validateTelegramUpdate } = require('./middlewares/authMiddleware');

const bot = new Telegraf(apiConfig.TELEGRAM_BOT_TOKEN);

// Global error handler
bot.catch((err, ctx) => {
  console.error('[Bot] Unhandled error:', err.message, err.stack);
  try {
    ctx?.reply('⚠️ حدث خطأ غير متوقع. الرجاء المحاولة لاحقاً أو الضغط على /start.');
  } catch (_) {}
});

// Apply middleware
bot.use(validateTelegramUpdate);

// --- Command Handlers ---
bot.start(async (ctx) => {
  const { handleStart } = require('./controllers/ClientController');
  return handleStart(ctx);
});

bot.help(async (ctx) => {
  const { sendHelp } = require('./views/MainView');
  return sendHelp(ctx);
});

bot.command('register', async (ctx) => {
  const { handleRegisterStart } = require('./controllers/TechnicianController');
  return handleRegisterStart(ctx);
});

bot.command('tasks', async (ctx) => {
  const { handleTasks } = require('./controllers/TechnicianController');
  return handleTasks(ctx);
});

bot.command('support', async (ctx) => {
  const { handleSupportStart } = require('./controllers/SupportController');
  return handleSupportStart(ctx);
});

bot.command('myid', async (ctx) => {
  return ctx.reply(`🆔 معرف تيليغرام الخاص بك:\n\`${ctx.from.id}\``, { parse_mode: 'Markdown' });
});

bot.command('archive', async (ctx) => {
  const { handleArchivedRequests } = require('./controllers/ClientController');
  return handleArchivedRequests(ctx);
});

// --- Text Message Handler ---
bot.on('text', async (ctx) => {
  const { handleTextMessage } = require('./controllers/RequestController');
  return handleTextMessage(ctx, ctx.message.text);
});

// --- Photo Message Handler ---
bot.on('photo', async (ctx) => {
  const state = stateManager.getState(ctx.from.id);
  if (state === stateManager.STATE.AWAITING_REQ_PHOTO) {
    const { handleReceivePhoto } = require('./controllers/RequestController');
    return handleReceivePhoto(ctx);
  }
  return ctx.reply('📷 استلمت الصورة! لكن يرجى متابعة الخطوات المطلوبة أولاً.', { parse_mode: 'Markdown' });
});

// --- Voice Message Handler ---
bot.on('voice', async (ctx) => {
  const { handleVoiceMessage } = require('./controllers/RequestController');
  return handleVoiceMessage(ctx, ctx.message.voice);
});

// --- Callback Query Handler ---
bot.on('callback_query', async (ctx) => {
  const data = ctx.callbackQuery?.data;
  if (!data) return;

  // Always answer callback query first to remove loading spinner
  try {
    await ctx.answerCbQuery();
  } catch (err) {
    // Ignore expired callback queries
  }

  try {
    const {
      handleStart, handleNewRequest, handleMyRequests,
      handleCancelRequest, handleRateTechnician, handleArchivedRequests, handleDeleteArchived,
    } = require('./controllers/ClientController');

    const {
      handleRegisterStart, handleAcceptRequest, handleRejectRequest,
      handleOnTheWay, handleInProgress, handleCompleteRequest,
    } = require('./controllers/TechnicianController');

    const {
      handleCategorySelection, handleLocationSelection, handleSubAreaSelection, handleSkipPhoto,
    } = require('./controllers/RequestController');

    const {
      handleSupportStart, handleAdminReplyInit, handleCloseTicket,
    } = require('./controllers/SupportController');

    // Main menu actions
    if (data === 'new_request') return handleNewRequest(ctx);
    if (data === 'register_technician') return handleRegisterStart(ctx);
    if (data === 'my_requests') return handleMyRequests(ctx);
    if (data === 'archived') return handleArchivedRequests(ctx);
    if (data === 'back_main') return handleStart(ctx);
    if (data === 'support') return handleSupportStart(ctx);

    // Type problem manually
    if (data === 'type_problem') {
      stateManager.setState(ctx.from.id, stateManager.STATE.AWAITING_PROBLEM_DESC);
      return ctx.reply('✍️ اكتب وصف المشكلة بالتفصيل:\n\nمثال: "عندي حنفية المطبخ مكسورة وبتسرب مية"', { parse_mode: 'Markdown' });
    }

    // Photo actions
    if (data === 'skip_photo') return handleSkipPhoto(ctx);
    if (data === 'add_photo') {
      stateManager.setState(ctx.from.id, stateManager.STATE.AWAITING_REQ_PHOTO);
      return ctx.reply('📷 أرسل الصورة الآن:', { parse_mode: 'Markdown' });
    }

    // Category selection (format: cat_0, cat_1, etc.)
    if (data.startsWith('cat_')) {
      const { getCategories, cleanCategory } = require('./views/FormView');
      const index = parseInt(data.split('_')[1]);
      const cats = getCategories();
      if (index < 0 || index >= cats.length) return ctx.reply('⚠️ اختيار غير صالح.');
      const category = cleanCategory(cats[index]);
      const state = stateManager.getState(ctx.from.id);

      if (state === stateManager.STATE.AWAITING_REG_CATEGORY) {
        const { handleRegistrationCategory } = require('./controllers/TechnicianController');
        return handleRegistrationCategory(ctx, category);
      }
      return handleCategorySelection(ctx, category);
    }

    // Location selection (format: loc_0, loc_1, etc.)
    if (data.startsWith('loc_')) {
      const { LOCATIONS } = require('./views/FormView');
      const index = parseInt(data.split('_')[1]);
      if (index < 0 || index >= LOCATIONS.length) return ctx.reply('⚠️ اختيار غير صالح.');
      const locObj = LOCATIONS[index];
      const state = stateManager.getState(ctx.from.id);

      if (state === stateManager.STATE.AWAITING_REG_LOCATION) {
        const { handleRegistrationLocation } = require('./controllers/TechnicianController');
        return handleRegistrationLocation(ctx, locObj.value);
      }
      return handleLocationSelection(ctx, locObj.value);
    }

    // Sub-area selection (format: subarea_0_غزة (الوسطى))
    if (data.startsWith('subarea_')) {
      const parts = data.split('_');
      // parts[0]='subarea', parts[1]=index, parts[2..]=mainLocation
      const subIndex = parseInt(parts[1]);
      const mainLocation = parts.slice(2).join('_');
      const { SUB_AREAS } = require('./views/FormView');
      const subs = SUB_AREAS[mainLocation] || [];
      if (subIndex < 0 || subIndex >= subs.length) return ctx.reply('⚠️ اختيار غير صالح.');
      const subArea = subs[subIndex];
      return handleSubAreaSelection(ctx, subArea, mainLocation);
    }

    // Request actions
    if (data.startsWith('accept_')) {
      const requestId = parseInt(data.split('_')[1]);
      if (isNaN(requestId)) return ctx.reply('⚠️ معرف طلب غير صالح.');
      return handleAcceptRequest(ctx, requestId);
    }

    if (data.startsWith('cancel_')) {
      const requestId = parseInt(data.split('_')[1]);
      if (isNaN(requestId)) return ctx.reply('⚠️ معرف طلب غير صالح.');
      return handleCancelRequest(ctx, requestId);
    }

    if (data.startsWith('reject_')) {
      const requestId = parseInt(data.split('_')[1]);
      if (isNaN(requestId)) return ctx.reply('⚠️ معرف طلب غير صالح.');
      return handleRejectRequest(ctx, requestId);
    }

    if (data.startsWith('onway_')) {
      const requestId = parseInt(data.split('_')[1]);
      return handleOnTheWay(ctx, requestId);
    }

    if (data.startsWith('progress_')) {
      const requestId = parseInt(data.split('_')[1]);
      return handleInProgress(ctx, requestId);
    }

    if (data.startsWith('complete_')) {
      const requestId = parseInt(data.split('_')[1]);
      return handleCompleteRequest(ctx, requestId);
    }

    if (data.startsWith('seltech_')) {
      const parts = data.split('_');
      const requestId = parseInt(parts[1]);
      const techId = parseInt(parts[2]);
      if (isNaN(requestId) || isNaN(techId)) return ctx.reply('⚠️ بيانات غير صالحة.');
      const { handleTechSelection } = require('./controllers/RequestController');
      return handleTechSelection(ctx, requestId, techId);
    }

    if (data.startsWith('view_req_')) {
      const requestId = parseInt(data.split('_')[2]);
      return handleViewRequest(ctx, requestId);
    }

    // Rating
    if (data.startsWith('rate_')) {
      const parts = data.split('_');
      const requestId = parseInt(parts[1]);
      const stars = parts[2];
      return handleRateTechnician(ctx, requestId, stars);
    }

    if (data.startsWith('skip_rate_')) {
      const requestId = parseInt(data.split('_')[2]);
      const { handleSkipRating } = require('./controllers/ClientController');
      return handleSkipRating(ctx, requestId);
    }

    // Admin technician approval
    if (data.startsWith('admin_accept_')) {
      const techId = parseInt(data.split('_')[2]);
      const { handleAdminApprove } = require('./controllers/TechnicianController');
      return handleAdminApprove(ctx, techId);
    }

    if (data.startsWith('admin_reject_')) {
      const techId = parseInt(data.split('_')[2]);
      const { handleAdminReject } = require('./controllers/TechnicianController');
      return handleAdminReject(ctx, techId);
    }

    // Archived requests
    if (data.startsWith('delete_archived_')) {
      const requestId = parseInt(data.split('_')[2]);
      return handleDeleteArchived(ctx, requestId);
    }

    // Support
    if (data.startsWith('support_reply_')) {
      const ticketId = data.split('_')[2];
      return handleAdminReplyInit(ctx, ticketId);
    }

    if (data.startsWith('support_close_')) {
      const ticketId = data.split('_')[2];
      return handleCloseTicket(ctx, ticketId);
    }

    // Fallback for old category buttons
    if (data.startsWith('fallback_')) {
      const service = data.replace('fallback_', '');
      const categoryMap = {
        plumbing: 'سباكة',
        electrical: 'كهرباء',
        solar: 'طاقة شمسية',
        hvac: 'تبريد وتكييف',
      };
      const category = categoryMap[service] || service;
      return handleCategorySelection(ctx, category);
    }

  } catch (cbErr) {
    console.error('[Bot] Callback error for data=%s:', data, cbErr.message, cbErr.stack);
    try {
      await ctx.reply('⚠️ حدث خطأ. الرجاء الضغط على /start والمحاولة مجدداً.');
    } catch (_) {}
  }
});

// View request details handler
async function handleViewRequest(ctx, requestId) {
  try {
    const { Request } = require('./Models');
    const { displayCategory } = require('./views/FormView');
    const { Markup } = require('telegraf');

    const req = await Request.findOne({
      where: { request_id: requestId, client_id: ctx.from.id },
    });

    if (!req) return ctx.reply('⚠️ لم يتم العثور على الطلب.');

    const statusMap = {
      pending: '🕐 قيد المراجعة',
      accepted: '✅ تم القبول',
      on_the_way: '🚗 في الطريق',
      in_progress: '🔧 قيد التنفيذ',
      completed: '✅ مكتمل',
      canceled: '❌ ملغي',
    };

    const dateStr = req.created_at
      ? new Date(req.created_at).toLocaleString('ar', { timeZone: 'Asia/Gaza' })
      : '—';

    const text =
`📋 *تفاصيل الطلب*
#GS-${req.request_id}

🔧 *نوع الخدمة:* ${displayCategory(req.extracted_category)}
📝 *وصف المشكلة:* ${req.problem_description || '—'}
📍 *العنوان:* ${req.location || '—'}${req.detailed_address ? `\n🏠 *التفاصيل:* ${req.detailed_address}` : ''}
📅 *تاريخ الطلب:* ${dateStr}
📌 *الحالة:* ${statusMap[req.status] || req.status}`;

    const buttons = [[Markup.button.callback('🔙 رجوع', 'my_requests')]];
    if (req.status === 'pending') {
      buttons.unshift([Markup.button.callback('❌ إلغاء الطلب', `cancel_${req.request_id}`)]);
    }

    return ctx.reply(text, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(buttons),
    });
  } catch (err) {
    console.error('[Bot] handleViewRequest error:', err);
    return ctx.reply('⚠️ حدث خطأ أثناء جلب التفاصيل.');
  }
}

module.exports = bot;
