'use strict';
const { Markup } = require('telegraf');
const { Technician, Request, User } = require('../models');
const sm = require('../middleware/stateManager');
const kb = require('../views/keyboards');
const msg = require('../views/messages');
const { validateName, validatePhone, formatDate } = require('../utils');
const { ADMIN_ID } = require('../config/api');

// ─── Registration ─────────────────────────────────────────────────────────────
async function handleRegisterStart(ctx) {
  sm.resetAll(ctx.from.id);
  try {
    const ex = await Technician.findByPk(ctx.from.id);
    if (ex) {
      const replies = {
        approved: '✅ أنت مسجل بالفعل كمقدم خدمة في النظام.',
        pending:  '⏳ طلب تسجيلك قيد المراجعة. يرجى الانتظار.',
        rejected: '❌ تم رفض طلب تسجيلك. تواصل مع الإدارة.',
      };
      return ctx.reply(replies[ex.status] || '✅ أنت مسجل بالفعل.', { ...kb.backMain() });
    }
    sm.setState(ctx.from.id, sm.STATE.AWAITING_REG_NAME);
    return ctx.reply(msg.regStep1, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('[regStart]', err);
    return ctx.reply('❌ حدث خطأ. الرجاء المحاولة لاحقاً.');
  }
}

async function handleRegName(ctx, text) {
  const { valid, message } = validateName(text);
  if (!valid) return ctx.reply(message, { parse_mode: 'Markdown' });
  sm.setData(ctx.from.id, { full_name: text.trim() });
  sm.setState(ctx.from.id, sm.STATE.AWAITING_REG_PHONE);
  return ctx.reply(msg.regStep2, { parse_mode: 'Markdown' });
}

async function handleRegPhone(ctx, text) {
  const { valid, message } = validatePhone(text);
  if (!valid) return ctx.reply(message, { parse_mode: 'Markdown' });
  sm.setData(ctx.from.id, { phone_number: text.trim() });
  sm.setState(ctx.from.id, sm.STATE.AWAITING_REG_CATEGORY);
  return ctx.reply(msg.regStep3, { parse_mode: 'Markdown', ...kb.categoryKeyboard() });
}

async function handleRegCategory(ctx, idx) {
  const category = kb.categoryFromIndex(idx);
  if (!category) return ctx.reply('⚠️ اختيار غير صالح.');
  sm.setData(ctx.from.id, { category });
  sm.setState(ctx.from.id, sm.STATE.AWAITING_REG_LOCATION);
  return ctx.reply(msg.regStep4, { parse_mode: 'Markdown', ...kb.regionKeyboard() });
}

async function handleRegLocation(ctx, idx) {
  const location = kb.regionFromIndex(idx);
  if (!location) return ctx.reply('⚠️ اختيار غير صالح.');
  const data = sm.getData(ctx.from.id);

  try {
    const isAdmin = String(ctx.from.id) === String(ADMIN_ID);
    const tech = await Technician.create({
      tech_id:      ctx.from.id,
      full_name:    data.full_name,
      phone_number: data.phone_number,
      category:     data.category,
      location,
      username:     ctx.from.username || null,
      status:       isAdmin ? 'approved' : 'pending',
    });
    sm.resetAll(ctx.from.id);

    if (isAdmin) {
      return ctx.reply('✅ *تم تسجيلك كمقدم خدمة فوراً!* 👋', { parse_mode: 'Markdown' });
    }

    await ctx.reply(msg.regSubmitted(data.full_name), { parse_mode: 'Markdown' });

    // Notify admin
    if (ADMIN_ID) {
      try {
        await ctx.telegram.sendMessage(Number(ADMIN_ID), msg.adminNewTechMsg(tech, ctx), {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback('✅ قبول', `admin_ok_${ctx.from.id}`),
              Markup.button.callback('❌ رفض',  `admin_no_${ctx.from.id}`),
            ],
          ]),
        });
      } catch (_) {}
    }
  } catch (err) {
    console.error('[regLocation]', err);
    if (err.name === 'SequelizeUniqueConstraintError')
      return ctx.reply('⚠️ أنت مسجل بالفعل في النظام.');
    return ctx.reply('❌ حدث خطأ أثناء التسجيل. حاول مرة أخرى.');
  }
}

// ─── Admin approve / reject ───────────────────────────────────────────────────
async function handleAdminApprove(ctx, techId) {
  if (String(ctx.from.id) !== String(ADMIN_ID)) return ctx.reply('❌ غير مصرح.');
  try {
    const tech = await Technician.findByPk(techId);
    if (!tech) return ctx.reply('⚠️ لم يتم العثور على مقدم الخدمة.');
    await tech.update({ status: 'approved' });
    try {
      await ctx.telegram.sendMessage(Number(techId),
        `✅ *تم قبول طلب تسجيلك!*\n\nأهلاً بك في شبكة غزة سيرف.\nستصلك إشعارات عند توفر طلبات تطابق تخصصك ومنطقتك.`,
        { parse_mode: 'Markdown' });
    } catch (_) {}
    return ctx.reply(`✅ تم قبول مقدم الخدمة: ${tech.full_name}`);
  } catch (err) {
    console.error('[adminApprove]', err);
    return ctx.reply('❌ حدث خطأ.');
  }
}

async function handleAdminReject(ctx, techId) {
  if (String(ctx.from.id) !== String(ADMIN_ID)) return ctx.reply('❌ غير مصرح.');
  try {
    const tech = await Technician.findByPk(techId);
    if (!tech) return ctx.reply('⚠️ لم يتم العثور على مقدم الخدمة.');
    await tech.update({ status: 'rejected' });
    try {
      await ctx.telegram.sendMessage(Number(techId),
        `❌ *عذراً، لم يتم قبول طلب تسجيلك.*\n\nيمكنك التواصل مع الإدارة للمزيد من المعلومات.`,
        { parse_mode: 'Markdown' });
    } catch (_) {}
    return ctx.reply(`❌ تم رفض: ${tech.full_name}`);
  } catch (err) {
    console.error('[adminReject]', err);
    return ctx.reply('❌ حدث خطأ.');
  }
}

// ─── Accept / Reject Request ──────────────────────────────────────────────────
async function handleAcceptRequest(ctx, requestId, expectedTechId) {
  try {
    const request = await Request.findByPk(requestId);
    if (!request) return ctx.reply('⚠️ الطلب غير موجود.');
    if (request.status !== 'pending') return ctx.reply('ℹ️ هذا الطلب لم يعد متاحاً.');
    if (request.tech_id && Number(request.tech_id) !== ctx.from.id)
      return ctx.reply('ℹ️ تم اختيار مقدم خدمة آخر لهذا الطلب.');

    const tech = await Technician.findByPk(ctx.from.id);
    if (!tech || tech.status !== 'approved')
      return ctx.reply('⚠️ لا يمكنك قبول الطلبات. تحقق من حالة حسابك.');

    await request.update({ tech_id: ctx.from.id, status: 'accepted' });

    const client = await User.findByPk(request.client_id);

    // Notify client
    if (client) {
      try {
        await ctx.telegram.sendMessage(Number(client.user_id), msg.clientAcceptedMsg(tech, requestId), {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('📋 طلباتي', 'my_requests')],
          ]),
        });
      } catch (_) {}
    }

    // Show client data to tech
    return ctx.reply(msg.techClientData(request, client), {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🚗 أنا في الطريق', `onway_${requestId}`)],
      ]),
    });
  } catch (err) {
    console.error('[acceptRequest]', err);
    return ctx.reply('❌ حدث خطأ أثناء قبول الطلب.');
  }
}

async function handleRejectRequest(ctx, requestId) {
  try {
    const request = await Request.findByPk(requestId);
    if (!request || request.status !== 'pending') return ctx.reply('ℹ️ الطلب غير متاح.');

    const client = await User.findByPk(request.client_id);

    // Try to find another tech
    const { Op } = require('sequelize');
    const other = await Technician.findOne({
      where: {
        category: request.extracted_category,
        status: 'approved',
        is_available: true,
        tech_id: { [Op.ne]: ctx.from.id },
      },
      order: [['rating_avg', 'DESC']],
    });

    if (other) {
      await request.update({ tech_id: Number(other.tech_id) });
      const notifData = {
        client_name: client?.full_name || 'مستخدم',
        extracted_category: request.extracted_category,
        location: request.location,
        detailed_address: request.detailed_address,
        problem_description: request.problem_description,
        photo_file_id: request.photo_file_id,
        scheduled_date: request.scheduled_date,
        scheduled_time: request.scheduled_time,
        request_id: requestId,
      };
      const text = msg.jobNotification(notifData);
      const btns = Markup.inlineKeyboard([
        [Markup.button.callback('✅ قبول الطلب', `accept_${requestId}_${other.tech_id}`),
         Markup.button.callback('❌ رفض',         `reject_${requestId}_${other.tech_id}`)],
      ]);
      try {
        if (notifData.photo_file_id)
          await ctx.telegram.sendPhoto(Number(other.tech_id), notifData.photo_file_id, { caption: text, parse_mode: 'Markdown', ...btns });
        else
          await ctx.telegram.sendMessage(Number(other.tech_id), text, { parse_mode: 'Markdown', ...btns });
      } catch (_) {}
    } else {
      await request.update({ tech_id: null, status: 'pending' });
      if (client) {
        try {
          await ctx.telegram.sendMessage(Number(client.user_id),
            `😔 لا يوجد مقدمو خدمة متاحون حالياً في منطقتك للطلب #GS-${requestId}.\nسيتم إشعارك عند توفر أحدهم.`);
        } catch (_) {}
      }
    }

    return ctx.reply('❌ تم رفض الطلب.', { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('[rejectRequest]', err);
    return ctx.reply('❌ حدث خطأ أثناء رفض الطلب.');
  }
}

// ─── Status Updates ───────────────────────────────────────────────────────────
async function _updateStatus(ctx, requestId, fromStatus, toStatus, clientNotifStatus) {
  try {
    const request = await Request.findOne({ where: { request_id: requestId, tech_id: ctx.from.id } });
    if (!request) return ctx.reply('⚠️ الطلب غير موجود أو غير مصرح لك.');
    if (request.status !== fromStatus) return ctx.reply(`⚠️ الحالة الحالية هي: ${request.status}`);

    await request.update({ status: toStatus });

    const client = await User.findByPk(request.client_id);
    if (client) {
      try {
        await ctx.telegram.sendMessage(Number(client.user_id), msg.statusUpdateToClient(toStatus, requestId), { parse_mode: 'Markdown' });
      } catch (_) {}
    }
    return null;
  } catch (err) {
    console.error(`[updateStatus ${toStatus}]`, err);
    return ctx.reply('❌ حدث خطأ.');
  }
}

async function handleOnTheWay(ctx, requestId) {
  const err = await _updateStatus(ctx, requestId, 'accepted', 'on_the_way', 'on_the_way');
  if (err) return;
  return ctx.reply('✅ تم تحديث الحالة: 🚗 في الطريق', {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([[Markup.button.callback('🔧 بدأت العمل', `progress_${requestId}`)]]),
  });
}

async function handleInProgress(ctx, requestId) {
  const err = await _updateStatus(ctx, requestId, 'on_the_way', 'in_progress', 'in_progress');
  if (err) return;
  return ctx.reply('✅ تم تحديث الحالة: 🔧 قيد التنفيذ', {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([[Markup.button.callback('✅ إتمام المهمة', `complete_${requestId}`)]]),
  });
}

async function handleComplete(ctx, requestId) {
  try {
    const request = await Request.findOne({ where: { request_id: requestId, tech_id: ctx.from.id } });
    if (!request) return ctx.reply('⚠️ الطلب غير موجود.');
    await request.update({ status: 'completed' });

    const client = await User.findByPk(request.client_id);
    if (client) {
      try {
        await ctx.telegram.sendMessage(Number(client.user_id), msg.statusUpdateToClient('completed', requestId), { parse_mode: 'Markdown' });
        // Send rating keyboard
        await ctx.telegram.sendMessage(Number(client.user_id), 'كيف تقيّم الخدمة؟', {
          ...kb.ratingKeyboard(requestId),
        });
      } catch (_) {}
    }

    return ctx.reply('🎉 *تم إتمام المهمة بنجاح!*\nشكراً لعملك.', { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('[complete]', err);
    return ctx.reply('❌ حدث خطأ.');
  }
}

// ─── My Tasks ─────────────────────────────────────────────────────────────────
async function handleMyTasks(ctx) {
  try {
    const tasks = await Request.findAll({
      where: { tech_id: ctx.from.id, status: ['accepted','on_the_way','in_progress'] },
      order: [['created_at', 'DESC']],
    });

    if (!tasks.length) {
      return ctx.reply('📭 *لا توجد مهام نشطة حالياً.*', { parse_mode: 'Markdown' });
    }

    for (const t of tasks) {
      const status_labels = { accepted: '✅ تم القبول', on_the_way: '🚗 في الطريق', in_progress: '🔧 قيد التنفيذ' };
      const text = (
`🆔 *#GS-${t.request_id}*
🔧 ${kb.displayCategory(t.extracted_category)}
📍 ${t.location || '—'}
📅 ${t.scheduled_date || '—'} — ${t.scheduled_time || '—'}
📌 *الحالة:* ${status_labels[t.status] || t.status}`
      );

      let btns = [];
      if (t.status === 'accepted')    btns = [[Markup.button.callback('🚗 أنا في الطريق',  `onway_${t.request_id}`)]];
      if (t.status === 'on_the_way')  btns = [[Markup.button.callback('🔧 بدأت العمل',      `progress_${t.request_id}`)]];
      if (t.status === 'in_progress') btns = [[Markup.button.callback('✅ إتمام المهمة',    `complete_${t.request_id}`)]];

      await ctx.reply(text, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(btns) });
    }
  } catch (err) {
    console.error('[myTasks]', err);
    return ctx.reply('⚠️ حدث خطأ أثناء جلب المهام.');
  }
}

module.exports = {
  handleRegisterStart, handleRegName, handleRegPhone, handleRegCategory, handleRegLocation,
  handleAdminApprove, handleAdminReject,
  handleAcceptRequest, handleRejectRequest,
  handleOnTheWay, handleInProgress, handleComplete,
  handleMyTasks,
};
