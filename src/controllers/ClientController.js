'use strict';
/**
 * clientController — handles new service requests & "my requests" flow
 */
const { Markup } = require('telegraf');
const { User, Request, Rating, Technician } = require('../Models');
const sm = require('../middleware/stateManager');
const kb = require('../views/keyboards');
const msg = require('../views/messages');
const { trunc, validatePhone } = require('../utils');
const { extractCategory } = require('../services/aiService');

// ─── /start ───────────────────────────────────────────────────────────────────
async function handleStart(ctx) {
  sm.resetAll(ctx.from.id);
  const name = ctx.from.first_name || 'بك';
  return ctx.reply(msg.welcome(name), { parse_mode: 'Markdown', ...kb.mainMenu() });
}

// ─── New Request ──────────────────────────────────────────────────────────────
async function handleNewRequest(ctx) {
  sm.resetAll(ctx.from.id);
  sm.setData(ctx.from.id, { action: 'new_request' });
  return ctx.reply(msg.selectCategory, { parse_mode: 'Markdown', ...kb.categoryKeyboard() });
}

async function handleCategorySelect(ctx, idx) {
  const category = kb.categoryFromIndex(idx);
  if (!category) return ctx.reply('⚠️ اختيار غير صالح.');
  sm.setData(ctx.from.id, { selected_category: category });
  sm.setState(ctx.from.id, sm.STATE.AWAITING_REQ_DESC);
  return ctx.reply(msg.descPrompt(category), { parse_mode: 'Markdown' });
}

async function handleDesc(ctx, text) {
  // Try AI to confirm category
  let category = sm.getData(ctx.from.id).selected_category;
  if (!category) {
    const ai = await extractCategory(text);
    category = ai.category;
    if (!category) {
      // Still no category — ask user to pick
      sm.setData(ctx.from.id, { problem_desc: text });
      sm.setState(ctx.from.id, sm.STATE.IDLE);
      return ctx.reply('📝 لم نتمكن من تحديد الخدمة تلقائياً.\nاختر نوع الخدمة:', {
        parse_mode: 'Markdown', ...kb.categoryKeyboard(),
      });
    }
    await ctx.reply(`✅ تم تصنيف طلبك كـ: *${kb.displayCategory(category)}*`, { parse_mode: 'Markdown' });
  }
  sm.setData(ctx.from.id, { selected_category: category, problem_desc: text });
  return _askPhoto(ctx);
}

function _askPhoto(ctx) {
  sm.setState(ctx.from.id, sm.STATE.AWAITING_REQ_PHOTO);
  return ctx.reply(msg.photoPrompt, { parse_mode: 'Markdown', ...kb.photoKeyboard() });
}

async function handleSkipPhoto(ctx) {
  sm.setState(ctx.from.id, sm.STATE.AWAITING_REQ_LOCATION);
  return ctx.reply(msg.photoReceived, { parse_mode: 'Markdown', ...kb.regionKeyboard() });
}

async function handleReceivePhoto(ctx) {
  const photos = ctx.message.photo;
  if (!photos?.length) return ctx.reply('❌ لم يتم استلام الصورة. حاول مرة أخرى.');
  sm.setData(ctx.from.id, { photo_file_id: photos[photos.length - 1].file_id });
  sm.setState(ctx.from.id, sm.STATE.AWAITING_REQ_LOCATION);
  return ctx.reply(msg.photoReceived, { parse_mode: 'Markdown', ...kb.regionKeyboard() });
}

async function handleRegionSelect(ctx, idx) {
  const region = kb.regionFromIndex(idx);
  if (!region) return ctx.reply('⚠️ اختيار غير صالح.');
  sm.setData(ctx.from.id, { location: region });

  const subKb = kb.subAreaKeyboard(idx);
  if (subKb) {
    sm.setData(ctx.from.id, { region_idx: idx });
    sm.setState(ctx.from.id, sm.STATE.AWAITING_REQ_SUBAREA);
    return ctx.reply(msg.selectSubArea(region), { parse_mode: 'Markdown', ...subKb });
  }

  sm.setState(ctx.from.id, sm.STATE.AWAITING_REQ_ADDR);
  return ctx.reply(msg.addrPrompt(region), { parse_mode: 'Markdown' });
}

async function handleSubAreaSelect(ctx, regionIdx, subIdx) {
  const sub = kb.subAreaFromIndex(regionIdx, subIdx);
  if (!sub) return ctx.reply('⚠️ اختيار غير صالح.');
  sm.setData(ctx.from.id, { sub_area: sub });
  const location = sm.getData(ctx.from.id).location || kb.regionFromIndex(regionIdx) || '—';
  const full = `${location} - ${sub}`;
  sm.setState(ctx.from.id, sm.STATE.AWAITING_REQ_ADDR);
  return ctx.reply(msg.addrPrompt(full), { parse_mode: 'Markdown' });
}

async function handleAddr(ctx, text) {
  sm.setData(ctx.from.id, { detailed_addr: text });
  sm.setState(ctx.from.id, sm.STATE.AWAITING_REQ_DATE);
  return ctx.reply(msg.selectDate, { parse_mode: 'Markdown', ...kb.dateKeyboard() });
}

async function handleDateSelect(ctx, dateStr) {
  sm.setData(ctx.from.id, { scheduled_date: dateStr });
  sm.setState(ctx.from.id, sm.STATE.AWAITING_REQ_TIME);
  return ctx.reply(msg.selectTime, { parse_mode: 'Markdown', ...kb.timeKeyboard() });
}

async function handleTimeSelect(ctx, idx) {
  const time = kb.timeFromIndex(idx);
  if (!time) return ctx.reply('⚠️ اختيار غير صالح.');
  sm.setData(ctx.from.id, { scheduled_time: time });
  sm.setState(ctx.from.id, sm.STATE.AWAITING_REQ_PHONE);
  return ctx.reply(msg.phonePrompt, { parse_mode: 'Markdown' });
}

async function handlePhone(ctx, text) {
  const { valid, message } = validatePhone(text);
  if (!valid) return ctx.reply(message, { parse_mode: 'Markdown' });
  sm.setData(ctx.from.id, { client_phone: text });
  sm.setState(ctx.from.id, sm.STATE.IDLE);

  const data = sm.getData(ctx.from.id);
  return ctx.reply(msg.requestSummary(data), {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('✅ تأكيد وإرسال الطلب', 'confirm_request')],
      [Markup.button.callback('✏️ تعديل البيانات',     'new_request')],
    ]),
  });
}

async function handleConfirmRequest(ctx) {
  const data = sm.getData(ctx.from.id);
  if (!data.selected_category || !data.location) {
    sm.resetAll(ctx.from.id);
    return ctx.reply('⚠️ بيانات ناقصة. الرجاء البدء من جديد.', { ...kb.backMain() });
  }

  try {
    const firstName  = ctx.from.first_name || 'مستخدم';
    const lastName   = ctx.from.last_name  || '';
    const username   = ctx.from.username   || null;
    const fullName   = `${firstName} ${lastName}`.trim();
    const fullLoc    = data.sub_area ? `${data.location} - ${data.sub_area}` : data.location;

    // Upsert user
    const [user] = await User.findOrCreate({
      where: { user_id: ctx.from.id },
      defaults: { user_id: ctx.from.id, full_name: fullName, phone_number: data.client_phone || '—', location: fullLoc, username },
    });
    const upd = {};
    if (user.phone_number !== data.client_phone && data.client_phone) upd.phone_number = data.client_phone;
    if (user.location !== fullLoc) upd.location = fullLoc;
    if (username && user.username !== username) upd.username = username;
    if (Object.keys(upd).length) await user.update(upd);

    // Create request
    const request = await Request.create({
      client_id:           ctx.from.id,
      extracted_category:  data.selected_category,
      location:            fullLoc,
      detailed_address:    data.detailed_addr || null,
      problem_description: data.problem_desc  || `طلب ${data.selected_category}`,
      photo_file_id:       data.photo_file_id || null,
      scheduled_date:      data.scheduled_date || null,
      scheduled_time:      data.scheduled_time || null,
      client_phone:        data.client_phone  || null,
      status:              'pending',
    });

    sm.resetAll(ctx.from.id);

    // Success message
    await ctx.reply(msg.requestSent(request.request_id), { parse_mode: 'Markdown' });

    // Summary card
    await ctx.reply(msg.requestSummary(data, request.request_id), {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📋 طلباتي', 'my_requests'), Markup.button.callback('+ خدمة جديدة', 'new_request')],
      ]),
    });

    // Notify technicians (non-blocking)
    _notifyTechnicians(ctx, request, user, data).catch(e => console.error('[notify]', e.message));

  } catch (err) {
    console.error('[confirmRequest]', err.message, err.stack);
    return ctx.reply('❌ حدث خطأ أثناء تقديم الطلب. الرجاء المحاولة لاحقاً.');
  }
}

async function _notifyTechnicians(ctx, request, user, data) {
  const { Op } = require('sequelize');
  const locationKey = (data.location || '').split('(')[0].trim();
  const techs = await Technician.findAll({
    where: {
      category: data.selected_category,
      status: 'approved',
      is_available: true,
      location: { [Op.like]: `%${locationKey}%` },
    },
    order: [['rating_avg', 'DESC']],
    limit: 5,
  });

  if (!techs.length) {
    // Broader fallback — same category any location
    const any = await Technician.findAll({
      where: { category: data.selected_category, status: 'approved', is_available: true },
      order: [['rating_avg', 'DESC']],
      limit: 3,
    });
    techs.push(...any);
  }

  const notifData = {
    client_name:         user.full_name,
    extracted_category:  request.extracted_category,
    location:            request.location,
    detailed_address:    request.detailed_address,
    problem_description: request.problem_description,
    photo_file_id:       request.photo_file_id,
    scheduled_date:      request.scheduled_date,
    scheduled_time:      request.scheduled_time,
    request_id:          request.request_id,
  };

  for (const tech of techs) {
    try {
      const text = msg.jobNotification(notifData);
      const btns = Markup.inlineKeyboard([
        [Markup.button.callback('✅ قبول الطلب', `accept_${request.request_id}_${tech.tech_id}`),
         Markup.button.callback('❌ رفض',         `reject_${request.request_id}_${tech.tech_id}`)],
      ]);
      if (notifData.photo_file_id) {
        await ctx.telegram.sendPhoto(Number(tech.tech_id), notifData.photo_file_id, {
          caption: text, parse_mode: 'Markdown', ...btns,
        });
      } else {
        await ctx.telegram.sendMessage(Number(tech.tech_id), text, { parse_mode: 'Markdown', ...btns });
      }
    } catch (e) {
      console.warn('[notify tech]', tech.tech_id, e.message);
    }
  }
}

// ─── My Requests ──────────────────────────────────────────────────────────────
async function handleMyRequests(ctx) {
  try {
    const active = await Request.findAll({
      where: { client_id: ctx.from.id, is_archived: false, status: ['pending','accepted','on_the_way','in_progress'] },
      order: [['created_at', 'DESC']],
      limit: 10,
    });

    if (!active.length) {
      const archived = await Request.count({ where: { client_id: ctx.from.id, is_archived: true } });
      return ctx.reply(
        `📭 *لا توجد طلبات نشطة حالياً*${archived ? `\n\nلديك ${archived} طلبات في الأرشيف.` : ''}`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('+ طلب خدمة جديدة', 'new_request')],
            ...(archived ? [[Markup.button.callback('📦 الأرشيف', 'archived_requests')]] : []),
          ]),
        }
      );
    }

    await ctx.reply('📋 *هذه قائمة طلباتك الحالية:*', { parse_mode: 'Markdown' });

    for (const req of active) {
      const btns = [];
      if (req.status === 'pending') {
        btns.push([Markup.button.callback('❌ إلغاء الطلب', `cancel_req_${req.request_id}`)]);
      }
      btns.push([Markup.button.callback('👁 عرض التفاصيل', `view_req_${req.request_id}`)]);
      await ctx.reply(msg.requestCard(req), { parse_mode: 'Markdown', ...Markup.inlineKeyboard(btns) });
    }

    await ctx.reply('─────────────────', {
      ...Markup.inlineKeyboard([
        [Markup.button.callback('+ خدمة جديدة', 'new_request'), Markup.button.callback('📦 الأرشيف', 'archived_requests')],
      ]),
    });
  } catch (err) {
    console.error('[myRequests]', err);
    return ctx.reply('⚠️ حدث خطأ. الرجاء المحاولة لاحقاً.');
  }
}

async function handleViewRequest(ctx, requestId) {
  const req = await Request.findOne({ where: { request_id: requestId, client_id: ctx.from.id } });
  if (!req) return ctx.reply('⚠️ لم يتم العثور على الطلب.');

  const btns = [[Markup.button.callback('🔙 رجوع', 'my_requests')]];
  if (req.status === 'pending') btns.unshift([Markup.button.callback('❌ إلغاء الطلب', `cancel_req_${requestId}`)]);

  return ctx.reply(msg.requestDetail(req), { parse_mode: 'Markdown', ...Markup.inlineKeyboard(btns) });
}

async function handleCancelRequest(ctx, requestId) {
  try {
    const req = await Request.findOne({ where: { request_id: requestId, client_id: ctx.from.id } });
    if (!req) return ctx.reply('⚠️ لم يتم العثور على الطلب.');
    if (req.status !== 'pending') return ctx.reply('⚠️ لا يمكن إلغاء الطلب في هذه المرحلة.');

    await req.update({ status: 'canceled', is_archived: true });
    return ctx.reply(`✅ *تم إلغاء الطلب #GS-${requestId} بنجاح.*`, {
      parse_mode: 'Markdown', ...kb.backMain(),
    });
  } catch (err) {
    console.error('[cancelRequest]', err);
    return ctx.reply('⚠️ حدث خطأ أثناء إلغاء الطلب.');
  }
}

async function handleArchivedRequests(ctx) {
  try {
    const reqs = await Request.findAll({
      where: { client_id: ctx.from.id, is_archived: true },
      order: [['created_at', 'DESC']],
      limit: 10,
    });
    if (!reqs.length) return ctx.reply('📦 لا توجد طلبات مؤرشفة.', { ...kb.backMain() });

    await ctx.reply('📦 *الطلبات المؤرشفة:*', { parse_mode: 'Markdown' });
    for (const req of reqs) {
      await ctx.reply(msg.requestCard(req), {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[Markup.button.callback('🗑 حذف نهائياً', `del_archive_${req.request_id}`)]]),
      });
    }
  } catch (err) {
    console.error('[archivedRequests]', err);
    return ctx.reply('⚠️ حدث خطأ.');
  }
}

async function handleDeleteArchived(ctx, requestId) {
  const req = await Request.findOne({ where: { request_id: requestId, client_id: ctx.from.id, is_archived: true } });
  if (!req) return ctx.reply('⚠️ لم يتم العثور على الطلب.');
  await req.destroy();
  return ctx.reply('✅ تم حذف الطلب نهائياً.');
}

// ─── Rating ───────────────────────────────────────────────────────────────────
async function handleRate(ctx, requestId, stars) {
  try {
    const req = await Request.findOne({ where: { request_id: requestId, client_id: ctx.from.id } });
    if (!req || req.status !== 'completed') return ctx.reply('⚠️ لا يمكن تقييم هذا الطلب.');
    if (await Rating.findOne({ where: { request_id: requestId } }))
      return ctx.reply('ℹ️ لقد قمت بتقييم هذا الطلب مسبقاً.');

    await Rating.create({ request_id: requestId, stars: parseInt(stars) });
    await req.update({ is_archived: true, status: 'archived' });

    // Recalculate tech avg
    if (req.tech_id) {
      const ratings = await Rating.findAll({
        include: [{ model: Request, as: 'request', where: { tech_id: req.tech_id }, attributes: [] }],
      });
      if (ratings.length) {
        const avg = ratings.reduce((s, r) => s + r.stars, 0) / ratings.length;
        await Technician.update({ rating_avg: Math.round(avg * 100) / 100, total_jobs: ratings.length }, { where: { tech_id: req.tech_id } });
      }
    }

    const { starBar } = require('../utils');
    return ctx.reply(
      `✅ *شكراً لتقييمك!*\n\n${starBar(stars)}\n\nتقييمك يساعدنا في تحسين جودة الخدمة.\n📦 تم أرشفة الطلب.`,
      { parse_mode: 'Markdown', ...kb.backMain() }
    );
  } catch (err) {
    console.error('[handleRate]', err);
    return ctx.reply('⚠️ حدث خطأ أثناء التقييم.');
  }
}

async function handleSkipRate(ctx, requestId) {
  try {
    const req = await Request.findOne({ where: { request_id: requestId, client_id: ctx.from.id } });
    if (req) await req.update({ is_archived: true, status: 'archived' });
    return ctx.reply('تم تخطي التقييم. شكراً لاستخدامك غزة سيرف! 🙏\n📦 تم أرشفة الطلب.', { ...kb.backMain() });
  } catch (err) {
    return ctx.reply('تم تخطي التقييم. شكراً لك!');
  }
}

module.exports = {
  handleStart, handleNewRequest, handleCategorySelect, handleDesc,
  handleSkipPhoto, handleReceivePhoto,
  handleRegionSelect, handleSubAreaSelect, handleAddr,
  handleDateSelect, handleTimeSelect, handlePhone,
  handleConfirmRequest,
  handleMyRequests, handleViewRequest, handleCancelRequest,
  handleArchivedRequests, handleDeleteArchived,
  handleRate, handleSkipRate,
};
