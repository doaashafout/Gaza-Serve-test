const { Telegraf } = require('telegraf');
const apiConfig = require('./config/api');
const stateManager = require('./middlewares/stateManager');
const { validateTelegramUpdate } = require('./middlewares/authMiddleware');


const bot = new Telegraf(apiConfig.TELEGRAM_BOT_TOKEN);

// Set bot description (shown before user presses Start)
bot.telegram.setMyDescription('👋 مرحباً بك في غزة سيرف\n\nأنا مساعدك الذكي لطلب الخدمات المنزلية\n\nبسهولة وسرعة.').catch(e => console.warn('[Bot] setDescription:', e.message));
bot.telegram.setMyShortDescription('مساعدك لطلب الخدمات المنزلية').catch(e => console.warn('[Bot] setShortDescription:', e.message));

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
    console.warn('[Bot] answerCbQuery failed:', err.message);
  }

  try {
    if (data === '___') return; // divider, no action

    if (data.startsWith('subregion_')) {
      const subRegion = data.slice('subregion_'.length);
      return handleSubRegionSelection(ctx, subRegion);
    }

    if (data.startsWith('date_')) {
      const date = data.slice('date_'.length);
      return handleDateSelection(ctx, date);
    }

    if (data.startsWith('time_')) {
      const timeStr = data.slice('time_'.length);
      return handleTimeSelection(ctx, timeStr);
    }

    if (data === 'my_requests') return handleMyRequests(ctx);
    if (data === 'back_main') return handleStart(ctx);

    // الجديد — هذا أضيفيه
    if (data === 'welcome_start') {
      const { sendWelcome } = require('./views/MainView');
      return sendWelcome(ctx);
    }

    if (data.startsWith('cat_')) {
      const { getCategories, cleanCategory } = require('./views/FormView');
      const index = parseInt(data.split('_')[1]);
      const category = cleanCategory(getCategories()[index]);
      const state = stateManager.getState(ctx.from.id);

      if (state === stateManager.STATE.AWAITING_REG_CATEGORY) {
        const { handleRegistrationCategory } = require('./controllers/TechnicianController');
        return handleRegistrationCategory(ctx, category);
      }

      const { hasSubmenu, sendSubMenu } = require('./views/SubMenuView');
      if (hasSubmenu(category)) {
        return sendSubMenu(ctx, category, index);
      }

      return handleCategorySelection(ctx, category);
    }

    // Submenu item selection (format: sub_{parentIndex}_{itemIndex})
    if (data.startsWith('sub_')) {
      const parts = data.split('_');
      const parentIndex = parseInt(parts[1]);
      const itemIndex = parseInt(parts[2]);
      const { getCategories, cleanCategory } = require('./views/FormView');
      const parentCategory = cleanCategory(getCategories()[parentIndex]);
      const { SUBMENUS, cleanSubService } = require('./views/SubMenuView');
      const subService = SUBMENUS[parentCategory]?.[itemIndex];
      if (!subService) return ctx.reply('❌ الخدمة غير متوفرة.');
      stateManager.setData(ctx.from.id, {
        selected_category: parentCategory,
        sub_service: cleanSubService(subService),
      });
      return handleCategorySelection(ctx, cleanSubService(subService));
    }

    // Submenu back button (format: back_sub_{parentIndex})
    if (data.startsWith('back_sub_')) {
      const { sendWelcome } = require('./views/MainView');
      return sendWelcome(ctx);
    }

    if (data.startsWith('loc_')) {
      const { MAIN_REGIONS } = require('./views/FormView');
      const index = parseInt(data.split('_')[1]);
      const location = MAIN_REGIONS[index];
      const { handleRegistrationLocation } = require('./controllers/TechnicianController');
      return handleRegistrationLocation(ctx, location);
    }

    if (data.startsWith('accept_')) {
      const requestId = parseInt(data.split('_')[1]);
      return handleAcceptRequest(ctx, requestId);
    }

    if (data.startsWith('cancel_')) {
      const requestId = parseInt(data.split('_')[1]);
      return handleCancelRequest(ctx, requestId);
    }

    if (data.startsWith('reject_')) {
      const requestId = parseInt(data.split('_')[1]);
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

  } catch (cbErr) {
    console.error('[Bot] Callback error:', cbErr.message);
    try {
      await ctx.reply(`❌ حدث خطأ: ${cbErr.message}`);
    } catch (_) {}
  }
});

module.exports = bot;
