/**
 * Bot - Telegram bot setup and event handling
 * Uses telegraf library for Telegram Bot API integration
 */

const { Telegraf } = require('telegraf');
const apiConfig = require('./config/api');
const stateManager = require('./middlewares/stateManager');
const { validateTelegramUpdate } = require('./middlewares/authMiddleware');

const bot = new Telegraf(apiConfig.TELEGRAM_BOT_TOKEN);

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
  // Ignore photos outside the expected flow
  return ctx.reply('📷 استلمت الصورة! لكن يرجى متابعة الخطوات المطلوبة.', { parse_mode: 'Markdown' });
});

// --- Voice Message Handler ---
bot.on('voice', async (ctx) => {
  const { handleVoiceMessage } = require('./controllers/RequestController');
  return handleVoiceMessage(ctx, ctx.message.voice);
});

// --- Callback Query Handler (Inline Keyboard buttons) ---
bot.on('callback_query', async (ctx) => {
  const data = ctx.callbackQuery.data;
  const { handleStart, handleNewRequest, handleMyRequests, handleCancelRequest, handleRateTechnician } = require('./controllers/ClientController');
  const { handleRegisterStart, handleAcceptRequest, handleRejectRequest, handleOnTheWay, handleInProgress, handleCompleteRequest } = require('./controllers/TechnicianController');
  const { handleCategorySelection, handleLocationSelection, handleSkipPhoto } = require('./controllers/RequestController');
  const { handleSupportStart, handleAdminReplyInit, handleCloseTicket } = require('./controllers/SupportController');

  try {
    await ctx.answerCbQuery();
  } catch (err) {
    console.warn('[Bot] answerCbQuery failed (likely expired):', err.message);
  }

  try {
    if (data === 'new_request') return handleNewRequest(ctx);
    if (data === 'register_technician') return handleRegisterStart(ctx);
  if (data === 'my_requests') return handleMyRequests(ctx);
  if (data === 'back_main') return handleStart(ctx);
  if (data === 'type_problem') {
    stateManager.setState(ctx.from.id, stateManager.STATE.AWAITING_PROBLEM_DESC);
    return ctx.reply('✍️ اكتب وصف المشكلة بالتفصيل:\n\nمثال: "عندي حنفية المطبخ مكسورة وبتسرب مية"', { parse_mode: 'Markdown' });
  }

  // Category selection (format: cat_0, cat_1, etc.)
  if (data.startsWith('cat_')) {
    const { getCategories, cleanCategory } = require('./views/FormView');
    const index = parseInt(data.split('_')[1]);
    const category = cleanCategory(getCategories()[index]);
    const state = stateManager.getState(ctx.from.id);

    // If technician is registering, route to registration handler
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
    const location = LOCATIONS[index];
    const state = stateManager.getState(ctx.from.id);

    if (state === stateManager.STATE.AWAITING_REG_LOCATION) {
      const { handleRegistrationLocation } = require('./controllers/TechnicianController');
      return handleRegistrationLocation(ctx, location);
    }
    return handleLocationSelection(ctx, location);
  }

  // Accept request (format: accept_{request_id})
  if (data.startsWith('accept_')) {
    const requestId = data.split('_')[1];
    return handleAcceptRequest(ctx, requestId);
  }

  // Cancel request by client (format: cancel_{request_id})
  if (data.startsWith('cancel_')) {
    const requestId = data.split('_')[1];
    return handleCancelRequest(ctx, requestId);
  }

  // Reject request by technician (format: reject_{request_id})
  if (data.startsWith('reject_')) {
    const requestId = data.split('_')[1];
    return handleRejectRequest(ctx, requestId);
  }

  // On the way (format: onway_{request_id})
  if (data.startsWith('onway_')) {
    const requestId = data.split('_')[1];
    return handleOnTheWay(ctx, requestId);
  }

  // In progress (format: progress_{request_id})
  if (data.startsWith('progress_')) {
    const requestId = data.split('_')[1];
    return handleInProgress(ctx, requestId);
  }

  // Tech selection by client (format: seltech_{request_id}_{tech_id})
  if (data.startsWith('seltech_')) {
    const parts = data.split('_');
    const requestId = parts[1];
    const techId = parts[2];
    const { handleTechSelection } = require('./controllers/RequestController');
    return handleTechSelection(ctx, requestId, techId);
  }

  // Admin approve technician (format: admin_accept_{tech_id})
  if (data.startsWith('admin_accept_')) {
    const techId = data.split('_')[2];
    const { handleAdminApprove } = require('./controllers/TechnicianController');
    return handleAdminApprove(ctx, techId);
  }

  // Admin reject technician (format: admin_reject_{tech_id})
  if (data.startsWith('admin_reject_')) {
    const techId = data.split('_')[2];
    const { handleAdminReject } = require('./controllers/TechnicianController');
    return handleAdminReject(ctx, techId);
  }

  // Complete task by technician (format: complete_{request_id})
  if (data.startsWith('complete_')) {
    const requestId = data.split('_')[1];
    return handleCompleteRequest(ctx, requestId);
  }

  // Rate technician (format: rate_{request_id}_{stars})
  if (data.startsWith('rate_')) {
    const parts = data.split('_');
    const requestId = parts[1];
    const stars = parts[2];
    return handleRateTechnician(ctx, requestId, stars);
  }

  // Skip photo attachment
  if (data === 'skip_photo') {
    return handleSkipPhoto(ctx);
  }

  // Add photo to request
  if (data === 'add_photo') {
    stateManager.setState(ctx.from.id, stateManager.STATE.AWAITING_REQ_PHOTO);
    return ctx.reply('📷 أرسل الصورة الآن:', { parse_mode: 'Markdown' });
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

  // Fallback menu items
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

  if (data.startsWith('skip_rate_')) {
    const requestId = data.split('_')[2];
    const { handleSkipRating } = require('./controllers/ClientController');
    return handleSkipRating(ctx, requestId);
  }

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
