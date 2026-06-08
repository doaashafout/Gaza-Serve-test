'use strict';
/**
 * GazaServe Bot — Main bot setup
 * All callback routing lives here.
 */
const { Telegraf, Markup } = require('telegraf');
const { TELEGRAM_BOT_TOKEN } = require('../config/api');
const { validateTelegramUpdate } = require('../middleware/authMiddleware');
const sm = require('../middleware/stateManager');
const kb = require('../views/keyboards');

const bot = new Telegraf(TELEGRAM_BOT_TOKEN);

// ─── Global error handler ────────────────────────────────────────────────────
bot.catch((err, ctx) => {
  console.error('[Bot] Unhandled error:', err.message);
  try { ctx?.reply('⚠️ حدث خطأ غير متوقع. الرجاء الضغط على /start والمحاولة مجدداً.'); } catch (_) {}
});

// ─── Middleware ───────────────────────────────────────────────────────────────
bot.use(validateTelegramUpdate);

// ─── Commands ─────────────────────────────────────────────────────────────────
bot.start(ctx => require('../controllers/clientController').handleStart(ctx));
bot.help(ctx  => require('../controllers/clientController').handleStart(ctx));
bot.command('tasks',   ctx => require('../controllers/technicianController').handleMyTasks(ctx));
bot.command('support', ctx => require('../controllers/supportController').handleSupportStart(ctx));
bot.command('register',ctx => require('../controllers/technicianController').handleRegisterStart(ctx));
bot.command('myid',    ctx => ctx.reply(`🆔 معرفك: \`${ctx.from.id}\``, { parse_mode: 'Markdown' }));
bot.command('archive', ctx => require('../controllers/clientController').handleArchivedRequests(ctx));

// ─── Text messages ─────────────────────────────────────────────────────────────
bot.on('text', ctx => require('../controllers/textController').handleText(ctx));

// ─── Photo messages ───────────────────────────────────────────────────────────
bot.on('photo', async ctx => {
  if (sm.getState(ctx.from.id) === sm.STATE.AWAITING_REQ_PHOTO) {
    return require('../controllers/clientController').handleReceivePhoto(ctx);
  }
  return ctx.reply('📷 استلمت الصورة. يرجى متابعة الخطوات.');
});

// ─── Voice messages ───────────────────────────────────────────────────────────
bot.on('voice', async ctx => {
  const { OPENAI_API_KEY } = require('../config/api');
  if (!OPENAI_API_KEY) return ctx.reply('🎤 تسجيل الصوت غير متاح حالياً. يرجى كتابة وصف المشكلة.');

  await ctx.reply('🎤 جاري تحليل الرسالة الصوتية...');
  try {
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    const fileLink = await ctx.telegram.getFileLink(ctx.message.voice.file_id);
    const tr = await openai.audio.transcriptions.create({
      model: 'whisper-1',
      file: await fetch(fileLink.href),
      language: 'ar',
    });
    const text = tr.text;
    await ctx.reply(`🎤 *النص المستخرج:*\n${text}`, { parse_mode: 'Markdown' });
    // Route as if typed
    sm.addMsg(ctx.from.id, 'user', text);
    return require('../controllers/textController').handleText({ ...ctx, message: { ...ctx.message, text } });
  } catch (err) {
    console.error('[voice]', err.message);
    return ctx.reply('❌ حدث خطأ أثناء معالجة الصوت. يرجى كتابة المشكلة.');
  }
});

// ─── Callback queries ─────────────────────────────────────────────────────────
bot.on('callback_query', async ctx => {
  const data = ctx.callbackQuery?.data;
  if (!data) return;

  try { await ctx.answerCbQuery(); } catch (_) {}

  try {
    const C  = require('../controllers/clientController');
    const TC = require('../controllers/technicianController');
    const SC = require('../controllers/supportController');
    const { safeInt } = require('../utils');
    const { DIVIDER_CB } = require('../views/keyboards');

    // ── Divider (non-functional) ──
    if (data === DIVIDER_CB) return;

    // ── Main menu ──
    if (data === 'new_request')        return C.handleNewRequest(ctx);
    if (data === 'my_requests')        return C.handleMyRequests(ctx);
    if (data === 'archived_requests')  return C.handleArchivedRequests(ctx);
    if (data === 'back_main')          return C.handleStart(ctx);
    if (data === 'support')            return SC.handleSupportStart(ctx);
    if (data === 'register_tech')      return TC.handleRegisterStart(ctx);
    if (data === 'confirm_request')    return C.handleConfirmRequest(ctx);

    // ── Photo step ──
    if (data === 'add_photo') {
      sm.setState(ctx.from.id, sm.STATE.AWAITING_REQ_PHOTO);
      return ctx.reply('📷 أرسل الصورة الآن:');
    }
    if (data === 'skip_photo') return C.handleSkipPhoto(ctx);

    // ── Category ──
    if (data.startsWith('cat_')) {
      const idx = safeInt(data.split('_')[1], -1);
      const state = sm.getState(ctx.from.id);
      if (state === sm.STATE.AWAITING_REG_CATEGORY) return TC.handleRegCategory(ctx, idx);
      return C.handleCategorySelect(ctx, idx);
    }

    // ── Region ──
    if (data.startsWith('region_')) {
      const idx = safeInt(data.split('_')[1], -1);
      const state = sm.getState(ctx.from.id);
      if (state === sm.STATE.AWAITING_REG_LOCATION) return TC.handleRegLocation(ctx, idx);
      return C.handleRegionSelect(ctx, idx);
    }

    // ── Sub-area ── format: sub_regionIdx_subIdx
    if (data.startsWith('sub_')) {
      const parts = data.split('_');
      return C.handleSubAreaSelect(ctx, safeInt(parts[1]), safeInt(parts[2]));
    }

    // ── Date ── format: date_YYYY-MM-DD
    if (data.startsWith('date_')) {
      return C.handleDateSelect(ctx, data.replace('date_', ''));
    }

    // ── Time ── format: time_idx
    if (data.startsWith('time_')) {
      return C.handleTimeSelect(ctx, safeInt(data.split('_')[1]));
    }

    // ── View request ──
    if (data.startsWith('view_req_')) {
      return C.handleViewRequest(ctx, safeInt(data.split('_')[2]));
    }

    // ── Cancel request ──
    if (data.startsWith('cancel_req_')) {
      return C.handleCancelRequest(ctx, safeInt(data.split('_')[2]));
    }

    // ── Delete archived ──
    if (data.startsWith('del_archive_')) {
      return C.handleDeleteArchived(ctx, safeInt(data.split('_')[2]));
    }

    // ── Rating ── format: rate_reqId_stars
    if (data.startsWith('rate_')) {
      const parts = data.split('_');
      return C.handleRate(ctx, safeInt(parts[1]), safeInt(parts[2]));
    }

    if (data.startsWith('skip_rate_')) {
      return C.handleSkipRate(ctx, safeInt(data.split('_')[2]));
    }

    // ── Technician: accept ── format: accept_reqId_techId
    if (data.startsWith('accept_')) {
      const parts = data.split('_');
      return TC.handleAcceptRequest(ctx, safeInt(parts[1]), safeInt(parts[2]));
    }

    // ── Technician: reject ── format: reject_reqId_techId
    if (data.startsWith('reject_')) {
      const parts = data.split('_');
      return TC.handleRejectRequest(ctx, safeInt(parts[1]));
    }

    // ── Technician status updates ──
    if (data.startsWith('onway_'))    return TC.handleOnTheWay(ctx, safeInt(data.split('_')[1]));
    if (data.startsWith('progress_')) return TC.handleInProgress(ctx, safeInt(data.split('_')[1]));
    if (data.startsWith('complete_')) return TC.handleComplete(ctx, safeInt(data.split('_')[1]));

    // ── Admin tech approval ──
    if (data.startsWith('admin_ok_')) return TC.handleAdminApprove(ctx, safeInt(data.split('_')[2]));
    if (data.startsWith('admin_no_')) return TC.handleAdminReject(ctx, safeInt(data.split('_')[2]));

    // ── Support ──
    if (data.startsWith('support_reply_')) {
      return SC.handleAdminReplyInit(ctx, data.split('_')[2]);
    }
    if (data.startsWith('support_close_')) {
      return SC.handleCloseTicket(ctx, data.split('_')[2]);
    }

    // Unknown callback — ignore silently
    console.warn('[bot] Unknown callback_query data:', data);

  } catch (err) {
    console.error('[bot] callback_query error:', err.message, err.stack);
    try { await ctx.reply('⚠️ حدث خطأ. الرجاء الضغط على /start.'); } catch (_) {}
  }
});

module.exports = bot;
