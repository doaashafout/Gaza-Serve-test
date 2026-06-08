'use strict';
const sm = require('../middleware/stateManager');
const kb = require('../views/keyboards');
const { chat } = require('../services/aiService');

async function handleText(ctx) {
  const text = ctx.message.text;
  if (text.startsWith('/')) return; // commands handled by bot handlers

  const state = sm.getState(ctx.from.id);
  const id    = ctx.from.id;

  // ─── State-based routing ───────────────────────────────────────────────────
  const { handleRegName, handleRegPhone } = require('./TechnicianController');
  const {
    handleDesc, handleAddr, handlePhone,
  } = require('./ClientController');
  const { handleSupportMessage, handleAdminReplyText } = require('./SupportController');

  switch (state) {
    case sm.STATE.AWAITING_REG_NAME:       return handleRegName(ctx, text);
    case sm.STATE.AWAITING_REG_PHONE:      return handleRegPhone(ctx, text);
    case sm.STATE.AWAITING_REQ_DESC:
    case sm.STATE.AWAITING_PROBLEM_DESC:   return handleDesc(ctx, text);
    case sm.STATE.AWAITING_REQ_ADDR:       return handleAddr(ctx, text);
    case sm.STATE.AWAITING_REQ_PHONE:      return handlePhone(ctx, text);
    case sm.STATE.AWAITING_SUPPORT:        return handleSupportMessage(ctx, text);
    case sm.STATE.AWAITING_SUPPORT_REPLY:  return handleAdminReplyText(ctx, text);

    // Button-only states — remind user
    case sm.STATE.AWAITING_REG_CATEGORY:
    case sm.STATE.AWAITING_REG_LOCATION:
    case sm.STATE.AWAITING_REQ_LOCATION:
    case sm.STATE.AWAITING_REQ_SUBAREA:
    case sm.STATE.AWAITING_REQ_DATE:
    case sm.STATE.AWAITING_REQ_TIME:
      return ctx.reply('🖱️ الرجاء استخدام الأزرار أعلاه للاختيار.');

    case sm.STATE.AWAITING_REQ_PHOTO:
      return ctx.reply('📷 أرسل صورة أو اضغط على زر التخطي.');

    default:
      return handleAIOrFallback(ctx, text);
  }
}

async function handleAIOrFallback(ctx, text) {
  const id = ctx.from.id;
  sm.addMsg(id, 'user', text);
  const history = sm.getHistory(id, 6);

  const result = await chat(history, text);

  if (result.action === 'request') {
    sm.addMsg(id, 'assistant', result.reply || '');
    sm.setData(id, { selected_category: result.category, problem_desc: text });

    if (result.reply) {
      await ctx.reply(result.reply, { parse_mode: 'Markdown' });
    }
    if (result.category) {
      await ctx.reply(`✅ تم تصنيف طلبك كـ: *${kb.displayCategory(result.category)}*`, { parse_mode: 'Markdown' });
    }

    // Continue request flow — ask for photo
    const { _askPhoto } = require('./ClientController');
    // Use handleDesc pattern directly
    sm.setState(id, sm.STATE.AWAITING_REQ_PHOTO);
    const { Markup } = require('telegraf');
    return ctx.reply('📷 إذا كانت لديك صورة توضح المشكلة يمكنك إرسالها:', {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📷 إرسال صورة',      'add_photo')],
        [Markup.button.callback('⏭ تخطي هذه الخطوة', 'skip_photo')],
      ]),
    });
  }

  if (result.action === 'respond') {
    sm.addMsg(id, 'assistant', result.reply || '');
    await ctx.reply(result.reply || 'كيف يمكنني مساعدتك؟', { parse_mode: 'Markdown' });
    if (result.show_menu) {
      const { handleStart } = require('./ClientController');
    }
  }
  const { handleStart } = require('./ClientController');
  return handleStart(ctx);
}

module.exports = { handleText };
