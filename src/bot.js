/**
 * Bot - Telegram bot setup and event handling
 * Uses telegraf library for Telegram Bot API integration
 */

const { Telegraf } = require('telegraf');
const apiConfig = require('./config/api');
const stateManager = require('./middleware/stateManager');
const { validateTelegramUpdate } = require('./middleware/authMiddleware');

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

// --- Text Message Handler ---
bot.on('text', async (ctx) => {
  const { handleTextMessage } = require('./controllers/RequestController');
  return handleTextMessage(ctx, ctx.message.text);
});

// --- Voice Message Handler ---
bot.on('voice', async (ctx) => {
  const { handleVoiceMessage } = require('./controllers/RequestController');
  return handleVoiceMessage(ctx, ctx.message.voice);
});

// --- Callback Query Handler (Inline Keyboard buttons) ---
bot.on('callback_query', async (ctx) => {
  const data = ctx.callbackQuery.data;
  const { handleNewRequest, handleMyRequests, handleCancelRequest, handleRateTechnician } = require('./controllers/ClientController');
  const { handleRegisterStart, handleAcceptRequest, handleRejectRequest, handleCompleteRequest } = require('./controllers/TechnicianController');
  const { handleCategorySelection, handleLocationSelection } = require('./controllers/RequestController');

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
    const { CATEGORIES } = require('./views/FormView');
    const index = parseInt(data.split('_')[1]);
    const category = CATEGORIES[index];
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

  // Reject request (format: reject_{request_id})
  if (data.startsWith('reject_')) {
    const requestId = data.split('_')[1];
    return handleRejectRequest(ctx, requestId);
  }

  // Rate technician (format: rate_{request_id}_{stars})
  if (data.startsWith('rate_')) {
    const parts = data.split('_');
    const requestId = parts[1];
    const stars = parts[2];
    return handleRateTechnician(ctx, requestId, stars);
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
    return ctx.reply('تم تخطي التقييم. شكراً لك!');
  }
  } catch (cbErr) {
    console.error('[Bot] Callback error:', cbErr.message);
    try {
      await ctx.reply(`❌ حدث خطأ: ${cbErr.message}`);
    } catch (_) {}
  }
});

module.exports = bot;
