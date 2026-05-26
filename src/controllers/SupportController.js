const { SupportTicket, User } = require('../Models');
const stateManager = require('../middlewares/stateManager');
const apiConfig = require('../config/api');
const { Markup } = require('telegraf');

async function handleSupportStart(ctx) {
  stateManager.setState(ctx.from.id, stateManager.STATE.AWAITING_SUPPORT);
  return ctx.reply(`📞 *الدعم الفني - GazaServe*

صف مشكلتك بالتفصيل وسيتم إرسالها لفريق الدعم.

مثال: "لا أستطيع تقديم طلب صيانة"
أو: "الفني لم يصل في الوقت المحدد"`, { parse_mode: 'Markdown' });
}

async function handleSupportMessage(ctx, text) {
  try {
    const ticket = await SupportTicket.create({
      user_id: ctx.from.id,
      message: text,
      status: 'open',
    });

    stateManager.resetAll(ctx.from.id);

    await ctx.reply(`✅ *تم إرسال تذكرتك بنجاح!*
رقم التذكرة: #${ticket.ticket_id}

سيتم الرد عليك في أقرب وقت ممكن.`, { parse_mode: 'Markdown' });

    if (apiConfig.ADMIN_ID) {
      const user = await User.findByPk(ctx.from.id);
      const userName = user ? user.full_name : ctx.from.first_name || 'مستخدم';
      await ctx.telegram.sendMessage(apiConfig.ADMIN_ID, `
🚨 *تذكرة دعم جديدة* 🚨

*رقم التذكرة:* #${ticket.ticket_id}
*المستخدم:* ${userName}
*الرسالة:*
${text}`, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('✉️ رد على التذكرة', `support_reply_${ticket.ticket_id}`)],
          [Markup.button.callback('✅ إغلاق التذكرة', `support_close_${ticket.ticket_id}`)],
        ]),
      });
    }
  } catch (err) {
    console.error('[SupportController] Create ticket error:', err);
    return ctx.reply('❌ حدث خطأ أثناء إرسال تذكرتك. الرجاء المحاولة لاحقاً.');
  }
}

async function handleAdminReplyInit(ctx, ticketId) {
  if (String(ctx.from.id) !== String(apiConfig.ADMIN_ID)) {
    return ctx.reply('❌ ليس لديك صلاحية.');
  }
  stateManager.setState(ctx.from.id, stateManager.STATE.AWAITING_SUPPORT_REPLY);
  stateManager.setData(ctx.from.id, { reply_ticket_id: ticketId });
  return ctx.reply(`✉️ *الرد على التذكرة #${ticketId}*

أكتب ردك الآن:`, { parse_mode: 'Markdown' });
}

async function handleAdminReplyText(ctx, text) {
  const data = stateManager.getData(ctx.from.id);
  const ticketId = data.reply_ticket_id;

  if (!ticketId) {
    stateManager.resetAll(ctx.from.id);
    return ctx.reply('❌ لم يتم العثور على التذكرة.');
  }

  try {
    const ticket = await SupportTicket.findByPk(ticketId);
    if (!ticket || ticket.status === 'closed') {
      stateManager.resetAll(ctx.from.id);
      return ctx.reply('التذكرة مغلقة أو غير موجودة.');
    }

    ticket.admin_reply = text;
    ticket.status = 'replied';
    await ticket.save();

    stateManager.resetAll(ctx.from.id);

    await ctx.reply(`✅ تم إرسال الرد على التذكرة #${ticketId}.`);

    const user = await User.findByPk(ticket.user_id);
    if (user) {
      await ctx.telegram.sendMessage(ticket.user_id, `
📬 *رد على تذكرتك #${ticketId}*

${text}

📌 يمكنك الرد على هذه الرسالة لفتح تذكرة جديدة.`, { parse_mode: 'Markdown' });
    }
  } catch (err) {
    console.error('[SupportController] Admin reply error:', err);
    return ctx.reply('❌ حدث خطأ.');
  }
}

async function handleCloseTicket(ctx, ticketId) {
  try {
    const ticket = await SupportTicket.findByPk(ticketId);
    if (!ticket) return ctx.reply('التذكرة غير موجودة.');

    if (String(ctx.from.id) !== String(apiConfig.ADMIN_ID) && String(ctx.from.id) !== String(ticket.user_id)) {
      return ctx.reply('❌ ليس لديك صلاحية.');
    }

    ticket.status = 'closed';
    await ticket.save();

    await ctx.reply(`✅ تم إغلاق التذكرة #${ticketId}.`);

    const otherPartyId = String(ctx.from.id) === String(apiConfig.ADMIN_ID) ? ticket.user_id : apiConfig.ADMIN_ID;
    if (otherPartyId) {
      await ctx.telegram.sendMessage(otherPartyId, `✅ تم إغلاق التذكرة #${ticketId}.`);
    }
  } catch (err) {
    console.error('[SupportController] Close ticket error:', err);
    return ctx.reply('❌ حدث خطأ.');
  }
}

module.exports = {
  handleSupportStart,
  handleSupportMessage,
  handleAdminReplyInit,
  handleAdminReplyText,
  handleCloseTicket,
};
