'use strict';
const { Markup } = require('telegraf');
const { SupportTicket, User } = require('../models');
const sm = require('../middleware/stateManager');
const msg = require('../views/messages');
const kb = require('../views/keyboards');
const { ADMIN_ID } = require('../config/api');

async function handleSupportStart(ctx) {
  sm.setState(ctx.from.id, sm.STATE.AWAITING_SUPPORT);
  return ctx.reply(msg.supportIntro, { parse_mode: 'Markdown' });
}

async function handleSupportMessage(ctx, text) {
  try {
    const ticket = await SupportTicket.create({ user_id: ctx.from.id, message: text });
    sm.resetAll(ctx.from.id);
    await ctx.reply(msg.supportTicketSent(ticket.ticket_id), { parse_mode: 'Markdown', ...kb.backMain() });

    if (ADMIN_ID) {
      const user = await User.findByPk(ctx.from.id);
      try {
        await ctx.telegram.sendMessage(Number(ADMIN_ID), msg.adminNewTicket(ticket, user), {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('✉️ رد',       `support_reply_${ticket.ticket_id}`)],
            [Markup.button.callback('✅ إغلاق',    `support_close_${ticket.ticket_id}`)],
          ]),
        });
      } catch (_) {}
    }
  } catch (err) {
    console.error('[supportMessage]', err);
    return ctx.reply('❌ حدث خطأ أثناء إرسال رسالتك. الرجاء المحاولة لاحقاً.');
  }
}

async function handleAdminReplyInit(ctx, ticketId) {
  if (String(ctx.from.id) !== String(ADMIN_ID)) return ctx.reply('❌ غير مصرح.');
  sm.setState(ctx.from.id, sm.STATE.AWAITING_SUPPORT_REPLY);
  sm.setData(ctx.from.id, { reply_ticket_id: ticketId });
  return ctx.reply(`✉️ *الرد على المحادثة #${ticketId}*\n\nاكتب ردك الآن:`, { parse_mode: 'Markdown' });
}

async function handleAdminReplyText(ctx, text) {
  const { reply_ticket_id: ticketId } = sm.getData(ctx.from.id);
  if (!ticketId) { sm.resetAll(ctx.from.id); return ctx.reply('⚠️ لم يتم العثور على المحادثة.'); }

  try {
    const ticket = await SupportTicket.findByPk(ticketId);
    if (!ticket || ticket.status === 'closed') {
      sm.resetAll(ctx.from.id);
      return ctx.reply('⚠️ المحادثة مغلقة أو غير موجودة.');
    }
    await ticket.update({ admin_reply: text, status: 'replied' });
    sm.resetAll(ctx.from.id);
    await ctx.reply(`✅ تم إرسال الرد على المحادثة #${ticketId}.`);

    try {
      await ctx.telegram.sendMessage(Number(ticket.user_id),
        `📬 *رد على محادثتك #${ticketId}*\n\n${text}\n\n📌 يمكنك فتح محادثة جديدة إذا احتجت لمزيد من المساعدة.`,
        { parse_mode: 'Markdown' });
    } catch (_) {}
  } catch (err) {
    console.error('[adminReplyText]', err);
    return ctx.reply('❌ حدث خطأ.');
  }
}

async function handleCloseTicket(ctx, ticketId) {
  try {
    const ticket = await SupportTicket.findByPk(ticketId);
    if (!ticket) return ctx.reply('⚠️ المحادثة غير موجودة.');
    if (String(ctx.from.id) !== String(ADMIN_ID) && String(ctx.from.id) !== String(ticket.user_id))
      return ctx.reply('❌ غير مصرح.');
    await ticket.update({ status: 'closed' });
    await ctx.reply(`✅ تم إغلاق المحادثة #${ticketId}.`);
    const other = String(ctx.from.id) === String(ADMIN_ID) ? ticket.user_id : ADMIN_ID;
    if (other) {
      try { await ctx.telegram.sendMessage(Number(other), `✅ تم إغلاق المحادثة #${ticketId}.`); } catch (_) {}
    }
  } catch (err) {
    console.error('[closeTicket]', err);
    return ctx.reply('❌ حدث خطأ.');
  }
}

module.exports = { handleSupportStart, handleSupportMessage, handleAdminReplyInit, handleAdminReplyText, handleCloseTicket };
