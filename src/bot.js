const { Telegraf, session } = require('telegraf');
const apiConfig = require('./config/api');
const stateManager = require('./middlewares/stateManager');
const { validateTelegramUpdate } = require('./middlewares/authMiddleware');
const { syncUserCommands } = require('./helpers/technicianHelper');


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

// Session (required for scenes)
bot.use(session());

// Scenes (WizardScene for technician registration)
const stage = require('./scenes');
bot.use(stage.middleware());

// --- Command Handlers ---
bot.start(async (ctx) => {
  await syncUserCommands(bot, ctx.from.id);
  const { handleStart } = require('./controllers/ClientController');
  return handleStart(ctx);
});

bot.help(async (ctx) => {
  const { sendHelp } = require('./views/MainView');
  return sendHelp(ctx);
});

bot.command('register', async (ctx) => {
  try {
    const { Technician } = require('./Models');
    const existing = await Technician.findByPk(ctx.from.id);
    if (existing) {
      if (existing.status === 'approved') {
        return ctx.reply('✅ أنت مسجل بالفعل كفني في النظام.');
      }
      if (existing.status === 'pending') {
        return ctx.reply('⏳ طلب تسجيلك قيد المراجعة من قبل الإدارة. يرجى الانتظار.');
      }
      if (existing.status === 'rejected') {
        return ctx.reply('❌ تم رفض طلب تسجيلك مسبقاً. يمكنك التواصل مع الإدارة.');
      }
    }
  } catch (err) {
    console.error('[Register] Check existing error:', err.message);
  }
  return ctx.scene.enter('tech-registration');
});

bot.command('cancel', async (ctx) => {
  await ctx.reply('✅ تم إلغاء العملية.');
  return ctx.scene.leave();
});

bot.command('tasks', async (ctx) => {
  const { handleTasks } = require('./controllers/TechnicianController');
  return handleTasks(ctx);
});

bot.command('mytasks', async (ctx) => {
  const { handleTasks } = require('./controllers/TechnicianController');
  return handleTasks(ctx);
});

bot.command('support', async (ctx) => {
  const { handleSupportStart } = require('./controllers/SupportController');
  return handleSupportStart(ctx);
});

bot.command('myid', async (ctx) => {
  let text = `🆔 معرف تيليغرام الخاص بك:\n\`${ctx.from.id}\``;
  try {
    const { Technician } = require('./Models');
    const tech = await Technician.findByPk(ctx.from.id);
    if (tech) {
      const statusMap = { pending: '⏳ قيد المراجعة', approved: '✅ مقبول', rejected: '❌ مرفوض' };
      text += `\n\n📋 *بياناتك كفني:*`;
      text += `\n👤 الاسم: ${tech.full_name}`;
      text += `\n🔧 التخصص: ${tech.category}`;
      text += `\n📍 المنطقة: ${tech.location}`;
      text += `\n📊 الحالة: ${statusMap[tech.status] || tech.status}`;
    }
  } catch (_) {}
  return ctx.reply(text, { parse_mode: 'Markdown' });
});

bot.command('deregister', async (ctx) => {
  const { Markup } = require('telegraf');
  try {
    const { Technician } = require('./Models');
    const tech = await Technician.findByPk(ctx.from.id);
    if (!tech) return ctx.reply('❌ أنت غير مسجل كفني.');
    return ctx.reply('⚠️ هل أنت متأكد من حذف تسجيلك كفني؟', {
      ...Markup.inlineKeyboard([
        [Markup.button.callback('✅ نعم، احذف تسجيلي', 'confirm_deregister')],
        [Markup.button.callback('❌ إلغاء', 'cancel_deregister')],
      ]),
    });
  } catch (err) {
    console.error('[Bot] deregister error:', err.message);
    return ctx.reply('❌ حدث خطأ.');
  }
});

bot.command('newrequest', async (ctx) => {
  const { sendCategorySelection } = require('./views/FormView');
  const { handleNewRequest } = require('./controllers/ClientController');
  return handleNewRequest(ctx);
});

bot.command('myorders', async (ctx) => {
  const { handleMyRequests } = require('./controllers/ClientController');
  return handleMyRequests(ctx);
});

bot.command('about', async (ctx) => {
  const text = `ℹ️ *عن غزة سيرف*\n\nغزة سيرف منصة ذكية لطلب الخدمات المنزلية في قطاع غزة.\n\nنقدم خدمات:\n🔧 الكهرباء - 🚰 السباكة - 🔧 الصيانة العامة\n🧹 التنظيف - ☀️ الطاقة الشمسية\n🏗️ الترميم والبناء - 🪟 الألومنيوم والحدادة\n🚚 نقل وتركيب الأثاث\n\n*بوت يعمل بالكامل بدون إنترنت عالي السرعة*`;
  return ctx.reply(text, { parse_mode: 'Markdown' });
});

bot.command('unsubscribe', async (ctx) => {
  const { Markup } = require('telegraf');
  try {
    const { Technician } = require('./Models');
    const tech = await Technician.findByPk(ctx.from.id);
    if (!tech) return ctx.reply('❌ أنت غير مسجل كفني.');
    return ctx.reply('⚠️ هل أنت متأكد من حذف تسجيلك كفني؟', {
      ...Markup.inlineKeyboard([
        [Markup.button.callback('✅ نعم، احذف تسجيلي', 'confirm_deregister')],
        [Markup.button.callback('❌ إلغاء', 'cancel_deregister')],
      ]),
    });
  } catch (err) {
    console.error('[Bot] unsubscribe error:', err.message);
    return ctx.reply('❌ حدث خطأ.');
  }
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

  const { handleTextMessage } = require('./controllers/RequestController');
  return handleTextMessage(ctx, text);
});

// --- Photo Message Handler ---
bot.on('photo', async (ctx) => {
  const stateManager = require('./middlewares/stateManager');
  const state = stateManager.getState(ctx.from.id);
  if (state !== stateManager.STATE.AWAITING_REQ_PHOTO) {
    return ctx.reply('📷 استلمت الصورة! لكن يرجى متابعة الخطوات المطلوبة.');
  }
  const photoFileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
  stateManager.setData(ctx.from.id, { photo_file_id: photoFileId });
  const photoData = stateManager.getData(ctx.from.id);
  if (photoData.return_to_summary) {
    stateManager.setData(ctx.from.id, { return_to_summary: undefined });
    const { sendRequestSummary } = require('./views/FormView');
    await ctx.reply('✅ تم استلام الصورة.');
    return sendRequestSummary(ctx, stateManager.getData(ctx.from.id));
  }
  stateManager.setState(ctx.from.id, stateManager.STATE.AWAITING_REQ_MAIN_REGION);
  const { sendMainRegionSelection } = require('./views/FormView');
  await ctx.reply('✅ تم استلام الصورة. شكراً لك!');
  return sendMainRegionSelection(ctx);
});

// --- Voice Message Handler ---
bot.on('voice', async (ctx) => {
  const { handleVoiceMessage } = require('./controllers/RequestController');
  return handleVoiceMessage(ctx, ctx.message.voice);
});

// --- Contact Message Handler (phone share button during request) ---
bot.on('contact', async (ctx) => {
  const state = stateManager.getState(ctx.from.id);
  if (state !== stateManager.STATE.AWAITING_REQ_PHONE) {
    return ctx.reply('✅ تم استلام رقم هاتفك.');
  }
  const { handleClientPhone } = require('./controllers/RequestController');
  return handleClientPhone(ctx, ctx.message.contact.phone_number);
});

// --- Web App Data Handler ---
bot.on('message', async (ctx) => {
  if (!ctx.message?.web_app_data) return;
  try {
    const data = JSON.parse(ctx.message.web_app_data.data);
    if (data.action === 'register_tech' && data.status === 'success') {
      const { Technician } = require('./Models');
      const tech = await Technician.findByPk(data.tech_id);
      if (!tech) return ctx.reply('❌ حدث خطأ في استكمال التسجيل.');
      await tech.update({ status: 'approved' });
      return ctx.reply('✅ تم تسجيلك كفني في GazaServe بنجاح! يمكنك البدء في استقبال الطلبات.');
    }
  } catch (err) {
    console.error('[Bot] Web App data error:', err.message);
  }
});

// --- Callback Query Handler (Inline Keyboard buttons) ---
bot.on('callback_query', async (ctx) => {
  const data = ctx.callbackQuery.data;
  const { handleStart, handleMyRequests, handleCancelRequest } = require('./controllers/ClientController');
  const { handleAcceptRequest, handleRejectRequest, handleOnTheWay, handleInProgress, handleCompleteRequest } = require('./controllers/TechnicianController');
  const { handleCategorySelection, handleSubRegionSelection, handleDateSelection, handleTimeSelection, handleSkipPhoto, handleConfirmSubmission, handleEditField } = require('./controllers/RequestController');
  const { handleSupportStart, handleAdminReplyInit, handleCloseTicket } = require('./controllers/SupportController');

  try {
    await ctx.answerCbQuery();
  } catch (err) {
    console.warn('[Bot] answerCbQuery failed:', err.message);
  }

  try {
    if (data === '___') return; // divider, no action

    if (data.startsWith('mainregion_')) {
      const mainRegion = data.slice('mainregion_'.length);
      const { handleMainRegionSelection } = require('./controllers/RequestController');
      return handleMainRegionSelection(ctx, mainRegion);
    }

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

    if (data === 'confirm_submit') return handleConfirmSubmission(ctx);

    if (data.startsWith('edit_')) {
      const field = data.slice('edit_'.length);
      return handleEditField(ctx, field);
    }

    if (data === 'my_requests' || data === 'my_orders') return handleMyRequests(ctx);
    if (data === 'back_main') return handleStart(ctx);

    if (data === 'request_service') {
      const { sendCategorySelection } = require('./views/FormView');
      stateManager.setState(ctx.from.id, stateManager.STATE.IDLE);
      stateManager.setData(ctx.from.id, { action: 'new_request' });
      return sendCategorySelection(ctx, '📝 *طلب صيانة جديد*\n\nاختر نوع الخدمة المطلوبة:');
    }

    if (data === 'technician_panel') {
      const { handleTasks } = require('./controllers/TechnicianController');
      return handleTasks(ctx);
    }

    if (data === 'register_technician') {
      try {
        const { Technician } = require('./Models');
        const existing = await Technician.findByPk(ctx.from.id);
        if (existing) {
          if (existing.status === 'approved') return ctx.reply('✅ أنت مسجل بالفعل كفني في النظام.');
          if (existing.status === 'pending') return ctx.reply('⏳ طلب تسجيلك قيد المراجعة من قبل الإدارة. يرجى الانتظار.');
          if (existing.status === 'rejected') return ctx.reply('❌ تم رفض طلب تسجيلك مسبقاً. يمكنك التواصل مع الإدارة.');
          return ctx.reply('✅ أنت مسجل بالفعل كفني في النظام.');
        }
      } catch (_) {}
      const { Markup } = require('telegraf');
      const text = `📝 *تسجيل كفني جديد*

أهلاً فيك! رح نجمع منك بعض المعلومات الأساسية لتسجيلك كفني معتمد بمنصة غزة سيرف.

العملية بتاخد كم دقيقة بس، وبتشمل:
✅ معلومات شخصية
✅ تخصصك ومنطقة عملك
✅ التحقق من الهوية

جاهز نبدأ؟`;
      return ctx.reply(text, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('✅ ابدأ التسجيل', 'start_tech_registration')],
          [Markup.button.callback('❌ إلغاء', 'cancel_tech_registration')],
        ]),
      });
    }

    if (data === 'start_tech_registration') {
      return ctx.scene.enter('tech-registration');
    }

    if (data === 'cancel_tech_registration') {
      return ctx.reply('✅ تم إلغاء العملية.');
    }

    if (data === 'contact_support') {
      const { handleSupportStart } = require('./controllers/SupportController');
      return handleSupportStart(ctx);
    }

    if (data === 'confirm_deregister') {
      try {
        const { Technician } = require('./Models');
        await Technician.destroy({ where: { tech_id: ctx.from.id } });
        await syncUserCommands(bot, ctx.from.id);
        return ctx.reply('✅ تم حذف تسجيلك كفني بنجاح.\nيمكنك إعادة التسجيل بأمر /register');
      } catch (err) {
        return ctx.reply('❌ حدث خطأ أثناء الحذف.');
      }
    }

    if (data === 'deregister_tech') {
      try {
        const { Technician } = require('./Models');
        const tech = await Technician.findByPk(ctx.from.id);
        if (!tech) return ctx.reply('❌ أنت غير مسجل كفني.');
      } catch (_) { return ctx.reply('❌ أنت غير مسجل كفني.'); }
      const { Markup } = require('telegraf');
      return ctx.reply('⚠️ هل أنت متأكد من حذف تسجيلك كفني؟', {
        ...Markup.inlineKeyboard([
          [Markup.button.callback('✅ نعم، احذف تسجيلي', 'confirm_deregister')],
          [Markup.button.callback('❌ إلغاء', 'cancel_deregister')],
        ]),
      });
    }

    if (data === 'cancel_deregister') {
      return ctx.reply('✅ تم إلغاء العملية.');
    }

    if (data === 'skip_photo') {
      return handleSkipPhoto(ctx);
    }

    // الجديد — هذا أضيفيه
    if (data === 'welcome_start') {
      const { sendWelcome } = require('./views/MainView');
      return sendWelcome(ctx);
    }

    if (data.startsWith('cat_')) {
      const { getCategories, cleanCategory } = require('./views/FormView');
      const index = parseInt(data.split('_')[1]);
      const category = cleanCategory(getCategories()[index]);
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
      const { sendCategorySelection } = require('./views/FormView');
      return sendCategorySelection(ctx, '📝 *طلب صيانة جديد*\n\nاختر نوع الخدمة المطلوبة:');
    }

    if (data.startsWith('accept_order_')) {
      const requestId = parseInt(data.split('_')[2]);
      const { acceptOrderAtomic, notifyOtherTechsTaken, notifyClientAccepted } = require('./services/orderDistributor');
      const result = await acceptOrderAtomic(ctx.telegram, requestId, ctx.from.id);
      if (!result.success) {
        return ctx.reply('⚠️ عذراً، هذا الطلب تم قبوله من فني آخر.');
      }
      await notifyOtherTechsTaken(ctx.telegram, requestId, ctx.from.id);
      await notifyClientAccepted(ctx.telegram, result.order, result.tech);
      await ctx.reply(`✅ تم قبول الطلب رقم #${requestId} بنجاح.\nتم إشعار العميل وسيتواصل معك.`);
      try {
        const { User } = require('./Models');
        const client = await User.findByPk(result.order.client_id);
        const clientPhone = client && client.phone_number ? `+${client.phone_number}` : 'غير متوفر';
        await ctx.reply(
          `📞 *بيانات العميل للتواصل*\n\n`
          + `👤 *الاسم:* ${client ? client.full_name : 'غير معروف'}\n`
          + `📱 *الهاتف:* ${clientPhone}\n`
          + `📍 *العنوان الكامل:* ${result.order.detailed_address || result.order.location}\n\n`
          + `🆔 رقم الطلب: #${requestId}`,
          { parse_mode: 'Markdown' }
        );
      } catch (clientErr) {
        console.warn('[Bot] Failed to send client data to tech:', clientErr.message);
      }
      return;
    }

    if (data.startsWith('reject_order_')) {
      const requestId = parseInt(data.split('_')[2]);
      return ctx.reply(`✅ تم رفض الطلب رقم #${requestId}.`);
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

    if (data.startsWith('support_reply_')) {
      const ticketId = parseInt(data.split('_')[2]);
      const { handleAdminReplyInit } = require('./controllers/SupportController');
      return handleAdminReplyInit(ctx, ticketId);
    }

    if (data.startsWith('support_close_')) {
      const ticketId = parseInt(data.split('_')[2]);
      const { handleCloseTicket } = require('./controllers/SupportController');
      return handleCloseTicket(ctx, ticketId);
    }

    if (data.startsWith('admin_accept_')) {
      const techId = data.split('_')[2];
      const { handleAdminApprove } = require('./controllers/TechnicianController');
      return handleAdminApprove(ctx, techId);
    }

    if (data.startsWith('admin_reject_')) {
      const techId = data.split('_')[2];
      const { handleAdminReject } = require('./controllers/TechnicianController');
      return handleAdminReject(ctx, techId);
    }

  } catch (cbErr) {
    console.error('[Bot] Callback error:', cbErr.message);
    try {
      await ctx.reply(`❌ حدث خطأ: ${cbErr.message}`);
    } catch (_) {}
  }
});

module.exports = bot;
