const { Telegraf } = require('telegraf');
const apiConfig = require('./config/api');
const stateManager = require('./middlewares/stateManager');
const { validateTelegramUpdate } = require('./middlewares/authMiddleware');

const bot = new Telegraf(apiConfig.TELEGRAM_BOT_TOKEN);

// Set bot description (shown before user presses Start)
bot.telegram.setMyDescription('👋 مرحباً بك في غزة سيرف\n\nأنا مساعدك الذكي لطلب الخدمات المنزلية\n\nبسهولة وسرعة.').catch(() => {});
bot.telegram.setMyShortDescription('مساعدك لطلب الخدمات المنزلية').catch(() => {});

// Global error handler
bot.catch((err) => {
  console.error('[Bot] Unhandled error:', err.message);
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
// Intercept reply keyboard selections before state routing
bot.on('text', async (ctx) => {
  const text = ctx.message.text;
  const state = stateManager.getState(ctx.from.id);

  // Check for separator line – ignore
  if (text === '─ ─ ─ ─ ─ ─ ─') return;

  // Check if text matches a category from reply keyboard
  const { getCategories, cleanCategory } = require('./views/FormView');
  const cats = getCategories();
  const catIndex = cats.indexOf(text);
  if (catIndex !== -1 && state === stateManager.STATE.IDLE) {
    const category = cleanCategory(text);
    const { handleCategorySelection } = require('./controllers/RequestController');
    return handleCategorySelection(ctx, category);
  }

  // Check for secondary buttons from reply keyboard
  if (text === '📋 طلباتي الحالية') {
    const { handleMyRequests } = require('./controllers/ClientController');
    return handleMyRequests(ctx);
  }
  if (text === '🎧 تواصل مع المشرف') {
    const { handleSupportStart } = require('./controllers/SupportController');
    return handleSupportStart(ctx);
  }

  // Check if text matches a main region from reply keyboard
  const { MAIN_REGIONS } = require('./views/FormView');
  if (MAIN_REGIONS.includes(text) && state === stateManager.STATE.AWAITING_REQ_MAIN_REGION) {
    const { handleMainRegionSelection } = require('./controllers/RequestController');
    return handleMainRegionSelection(ctx, text);
  }

  const { handleTextMessage } = require('./controllers/RequestController');
  return handleTextMessage(ctx, text);
});

// --- Photo Message Handler ---
bot.on('photo', async (ctx) => {
  return ctx.reply('📷 استلمت الصورة! لكن يرجى متابعة الخطوات المطلوبة.');
});

// --- Voice Message Handler ---
bot.on('voice', async (ctx) => {
  const { handleVoiceMessage } = require('./controllers/RequestController');
  return handleVoiceMessage(ctx, ctx.message.voice);
});

// --- Callback Query Handler (Inline Keyboard buttons) ---
bot.on('callback_query', async (ctx) => {
  const data = ctx.callbackQuery.data;
  const { handleStart, handleMyRequests, handleCancelRequest, handleRateTechnician } = require('./controllers/ClientController');
  const { handleRegisterStart, handleAcceptRequest, handleRejectRequest, handleOnTheWay, handleInProgress, handleCompleteRequest } = require('./controllers/TechnicianController');
  const { handleCategorySelection, handleSubRegionSelection, handleDateSelection, handleTimeSelection } = require('./controllers/RequestController');
  const { handleSupportStart, handleAdminReplyInit, handleCloseTicket } = require('./controllers/SupportController');

  try {
    await ctx.answerCbQuery();
  } catch (err) {
    console.warn('[Bot] answerCbQuery failed (likely expired):', err.message);
  }

  try {
    // New flow: sub-region selection (format: subregion_{name})
    if (data.startsWith('subregion_')) {
      const subRegion = data.slice('subregion_'.length);
      return handleSubRegionSelection(ctx, subRegion);
    }

    // New flow: date selection (format: date_{value})
    if (data.startsWith('date_')) {
      const date = data.slice('date_'.length);
      return handleDateSelection(ctx, date);
    }

    // New flow: time selection (format: time_{value})
    if (data.startsWith('time_')) {
      const timeStr = data.slice('time_'.length);
      return handleTimeSelection(ctx, timeStr);
    }

    if (data === 'my_requests') return handleMyRequests(ctx);
    if (data === 'back_main') return handleStart(ctx);

    // Category selection (format: cat_0, cat_1, etc.) – for tech registration
    if (data.startsWith('cat_')) {
      const { getCategories, cleanCategory } = require('./views/FormView');
      const index = parseInt(data.split('_')[1]);
      const category = cleanCategory(getCategories()[index]);
      const state = stateManager.getState(ctx.from.id);
      if (state === stateManager.STATE.AWAITING_REG_CATEGORY) {
        const { handleRegistrationCategory } = require('./controllers/TechnicianController');
        return handleRegistrationCategory(ctx, category);
      }
      return handleCategorySelection(ctx, category);
    }

    // Location selection (format: loc_0, loc_1, etc.) – for tech registration
    if (data.startsWith('loc_')) {
      const { MAIN_REGIONS } = require('./views/FormView');
      const index = parseInt(data.split('_')[1]);
      const location = MAIN_REGIONS[index];
      const { handleRegistrationLocation } = require('./controllers/TechnicianController');
      return handleRegistrationLocation(ctx, location);
    }

    // Accept request (format: accept_{request_id})
    if (data.startsWith('accept_')) {
      const requestId = parseInt(data.split('_')[1]);
      return handleAcceptRequest(ctx, requestId);
    }

    // Cancel request by client (format: cancel_{request_id})
    if (data.startsWith('cancel_')) {
      const requestId = parseInt(data.split('_')[1]);
      return handleCancelRequest(ctx, requestId);
    }

    // Reject request by technician (format: reject_{request_id})
    if (data.startsWith('reject_')) {
      const requestId = parseInt(data.split('_')[1]);
      return handleRejectRequest(ctx, requestId);
    }

    // On the way (format: onway_{request_id})
    if (data.startsWith('onway_')) {
      const requestId = parseInt(data.split('_')[1]);
      return handleOnTheWay(ctx, requestId);
    }

    // In progress (format: progress_{request_id})
    if (data.startsWith('progress_')) {
      const requestId = parseInt(data.split('_')[1]);
      return handleInProgress(ctx, requestId);
    }

    // Tech selection by client (format: seltech_{request_id}_{tech_id})
    if (data.startsWith('seltech_')) {
      const parts = data.split('_');
      const requestId = parseInt(parts[1]);
      const techId = parseInt(parts[2]);
      const { handleTechSelection } = require('./controllers/RequestController');
      return handleTechSelection(ctx, requestId, techId);
    }

    // Admin approve technician (format: admin_accept_{tech_id})
    if (data.startsWith('admin_accept_')) {
      const techId = parseInt(data.split('_')[2]);
      const { handleAdminApprove } = require('./controllers/TechnicianController');
      return handleAdminApprove(ctx, techId);
    }

    // Admin reject technician (format: admin_reject_{tech_id})
    if (data.startsWith('admin_reject_')) {
      const techId = parseInt(data.split('_')[2]);
      const { handleAdminReject } = require('./controllers/TechnicianController');
      return handleAdminReject(ctx, techId);
    }

    // Complete task by technician (format: complete_{request_id})
    if (data.startsWith('complete_')) {
      const requestId = parseInt(data.split('_')[1]);
      return handleCompleteRequest(ctx, requestId);
    }

    // Rate technician (format: rate_{request_id}_{stars})
    if (data.startsWith('rate_')) {
      const parts = data.split('_');
      const requestId = parseInt(parts[1]);
      const stars = parts[2];
      return handleRateTechnician(ctx, requestId, stars);
    }

    // Support ticket - start
    if (data === 'support') {
      return handleSupportStart(ctx);
    }

    // Support ticket - admin reply (format: support_reply_{ticket_id})
    if (data.startsWith('support_reply_')) {
      const ticketId = data.split('_')[2];
      return handleAdminReplyInit(ctx, ticketId);
    }

    // Support ticket - close (format: support_close_{ticket_id})
    if (data.startsWith('support_close_')) {
      const ticketId = data.split('_')[2];
      return handleCloseTicket(ctx, ticketId);
    }

    // Skip rating
    if (data.startsWith('skip_rate_')) {
      const requestId = data.split('_')[2];
      const { handleSkipRating } = require('./controllers/ClientController');
      return handleSkipRating(ctx, requestId);
    }

    // Delete archived
    if (data.startsWith('delete_archived_')) {
      const requestId = data.split('_')[2];
      const { handleDeleteArchived } = require('./controllers/ClientController');
      return handleDeleteArchived(ctx, requestId);
    }
  } catch (cbErr) {
    console.error('[Bot] Callback error:', cbErr.message);
    try {
      await ctx.reply(`❌ حدث خطأ: ${cbErr.message}`);
    } catch (_) {}
  }
});

module.exports = bot;
