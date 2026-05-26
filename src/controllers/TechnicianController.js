const { Technician, Request, User } = require('../Models');
const stateManager = require('../middlewares/stateManager');
const { sendTechnicianRegistrationForm } = require('../views/FormView');

/**
 * TechnicianController - Handles technician registration and job management
 */

async function handleRegisterStart(ctx) {
  try {
    stateManager.resetAll(ctx.from.id);

    const existingTech = await Technician.findByPk(ctx.from.id);
    if (existingTech) {
      if (existingTech.status === 'approved') return ctx.reply('✅ أنت مسجل بالفعل كفني في النظام.');
      if (existingTech.status === 'pending') return ctx.reply('⏳ طلب تسجيلك قيد المراجعة من قبل الإدارة. يرجى الانتظار.');
      if (existingTech.status === 'rejected') return ctx.reply('❌ تم رفض طلب تسجيلك مسبقاً. يمكنك التواصل مع الإدارة.');
      return ctx.reply('✅ أنت مسجل بالفعل كفني في النظام.');
    }

    stateManager.setState(ctx.from.id, stateManager.STATE.AWAITING_REG_NAME);
    return sendTechnicianRegistrationForm(ctx);
  } catch (err) {
    console.error('[TechnicianController] Registration start error:', err.message);
    return ctx.reply(`❌ حدث خطأ في الاتصال بقاعدة البيانات.\n${err.message}`);
  }
}

function validateName(name) {
  if (!name || name.trim().length < 3) {
    return { valid: false, message: '❌ الاسم قصير جداً. الرجاء إدخال اسمك الثلاثي (مثال: محمد أحمد علي).' };
  }
  const parts = name.trim().split(/\s+/);
  if (parts.length < 3) {
    return { valid: false, message: '❌ الرجاء إدخال الاسم الثلاثي كاملاً (مثال: محمد أحمد علي).' };
  }
  const arabicPattern = /^[\u0600-\u06FF\s]+$/;
  if (!arabicPattern.test(name.trim())) {
    return { valid: false, message: '❌ الرجاء إدخال الاسم باللغة العربية فقط.' };
  }
  return { valid: true };
}

function validatePhone(phone) {
  const cleaned = phone.replace(/[\s\-\(\)]+/g, '');
  if (!/^05[69]\d{7}$/.test(cleaned) && !/^\+9705[69]\d{7}$/.test(cleaned) && !/^009705[69]\d{7}$/.test(cleaned)) {
    return { valid: false, message: '❌ رقم الهاتف غير صحيح. الرجاء إدخال رقم فلسطيني صحيح يبدأ بـ 059 أو 056 (مثال: 0599XXXXXX).' };
  }
  return { valid: true };
}

async function handleRegistrationName(ctx, text) {
  const nameCheck = validateName(text);
  if (!nameCheck.valid) return ctx.reply(nameCheck.message, { parse_mode: 'Markdown' });
  stateManager.setData(ctx.from.id, { full_name: text });
  stateManager.setState(ctx.from.id, stateManager.STATE.AWAITING_REG_PHONE);
  return ctx.reply('*الخطوة 2/4:* أرسل رقم هاتفك للتواصل (مثال: 0599XXXXXX):', {
    parse_mode: 'Markdown',
  });
}

async function handleRegistrationPhone(ctx, text) {
  const phoneCheck = validatePhone(text);
  if (!phoneCheck.valid) return ctx.reply(phoneCheck.message, { parse_mode: 'Markdown' });
  stateManager.setData(ctx.from.id, { phone_number: text });
  stateManager.setState(ctx.from.id, stateManager.STATE.AWAITING_REG_CATEGORY);

  const { sendCategorySelection } = require('../views/FormView');
  return sendCategorySelection(ctx, '*الخطوة 3/4:* اختر تخصصك المهني:');
}

async function handleRegistrationCategory(ctx, category) {
  stateManager.setData(ctx.from.id, { category });
  stateManager.setState(ctx.from.id, stateManager.STATE.AWAITING_REG_LOCATION);

  const { sendLocationSelection } = require('../views/FormView');
  return sendLocationSelection(ctx, '*الخطوة 4/4:* اختر النطاق الجغرافي لعمللك:');
}

async function handleRegistrationLocation(ctx, location) {
  try {
    const data = stateManager.getData(ctx.from.id);
    const apiConfig = require('../config/api');

    const isAdmin = String(ctx.from.id) === String(apiConfig.ADMIN_ID);
    const techStatus = isAdmin ? 'approved' : 'pending';

    await Technician.create({
      tech_id: ctx.from.id,
      full_name: data.full_name,
      phone_number: data.phone_number,
      category: data.category,
      location,
      status: techStatus,
    });

    stateManager.resetAll(ctx.from.id);

    const techName = data.full_name;
    const techPhone = data.phone_number;
    const techCategory = data.category;

    if (isAdmin) {
      return ctx.reply(`✅ *تم تسجيلك كفني فوراً!*\n\nأهلاً بك يا أدمن 👋`, { parse_mode: 'Markdown' });
    }

    ctx.reply(`📋 تم إرسال طلب تسجيلك كفني للمراجعة.\nسيتم إشعارك عند الموافقة من قبل الإدارة.`, { parse_mode: 'Markdown' });

    if (apiConfig.ADMIN_ID) {
      const { Markup } = require('telegraf');
      const { displayCategory } = require('../views/FormView');
      const adminMsg = `
🆕 *طلب تسجيل فني جديد*

*الاسم:* ${techName}
*رقم الهاتف:* ${techPhone}
*التخصص:* ${displayCategory(techCategory)}
*المنطقة:* ${location}
*حساب تيليغرام:* [${ctx.from.first_name}](tg://user?id=${ctx.from.id})`;

      await ctx.telegram.sendMessage(apiConfig.ADMIN_ID, adminMsg, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('✅ قبول الفني', `admin_accept_${ctx.from.id}`),
            Markup.button.callback('❌ رفض الفني', `admin_reject_${ctx.from.id}`),
          ],
        ]),
      });
    }
  } catch (err) {
    console.error('[TechnicianController] Registration error:', err);
    return ctx.reply('❌ حدث خطأ أثناء التسجيل. الرجاء المحاولة مرة أخرى.');
  }
}

async function handleAdminApprove(ctx, techId) {
  try {
    if (String(ctx.from.id) !== String(require('../config/api').ADMIN_ID)) {
      return ctx.reply('❌ ليس لديك صلاحية للقيام بهذا الإجراء.');
    }

    const tech = await Technician.findByPk(techId);
    if (!tech) return ctx.reply('لم يتم العثور على الفني.');

    tech.status = 'approved';
    await tech.save();

    await ctx.telegram.sendMessage(techId, `✅ *تم قبول طلب تسجيلك!*\n\nأهلاً بك في شبكة فنيي GazaServe.\nسيصلك إشعار عند وجود طلبات صيانة تطابق تخصصك ومنطقتك.`, { parse_mode: 'Markdown' });

    return ctx.reply(`✅ تم قبول الفني ${tech.full_name}.`);
  } catch (err) {
    console.error('[TechnicianController] Admin approve error:', err);
    return ctx.reply('❌ حدث خطأ.');
  }
}

async function handleAdminReject(ctx, techId) {
  try {
    if (String(ctx.from.id) !== String(require('../config/api').ADMIN_ID)) {
      return ctx.reply('❌ ليس لديك صلاحية للقيام بهذا الإجراء.');
    }

    const tech = await Technician.findByPk(techId);
    if (!tech) return ctx.reply('لم يتم العثور على الفني.');

    tech.status = 'rejected';
    await tech.save();

    await ctx.telegram.sendMessage(techId, `❌ *عذراً، لم يتم قبول طلب تسجيلك كفني.*\n\nيمكنك التواصل مع الإدارة للمزيد من المعلومات.`, { parse_mode: 'Markdown' });

    return ctx.reply(`❌ تم رفض الفني ${tech.full_name}.`);
  } catch (err) {
    console.error('[TechnicianController] Admin reject error:', err);
    return ctx.reply('❌ حدث خطأ.');
  }
}

async function handleAcceptRequest(ctx, requestId) {
  try {
    const request = await Request.findByPk(requestId);
    if (!request || request.status !== 'pending') {
      return ctx.reply('هذا الطلب لم يعد متاحاً.');
    }

    request.tech_id = ctx.from.id;
    request.status = 'accepted';
    await request.save();

    const technician = await Technician.findByPk(ctx.from.id);
    const client = await User.findByPk(request.client_id);

    if (client) {
      const { displayCategory } = require('../views/FormView');
      await ctx.telegram.sendMessage(client.user_id, `
✅ *تم قبول طلبك!*

*الفني:* ${technician.full_name}
*رقم الهاتف:* ${technician.phone_number}
*التخصص:* ${displayCategory(technician.category)}
${request.detailed_address ? `📍 *عنوانك المسجل:* ${request.detailed_address}` : ''}

*حالة الطلب:* ✅ تم القبول`, { parse_mode: 'Markdown' });
    }

    const { displayCategory } = require('../views/FormView');
    const { Markup } = require('telegraf');
    return ctx.reply(`
📞 *تم قبول الطلب - بيانات الزبون*

*الاسم:* ${client.full_name}
*رقم الهاتف:* ${client.phone_number}
*المنطقة:* ${client.location}
${request.detailed_address ? `*العنوان:* ${request.detailed_address}\n` : ''}`, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🚗 على الطريق', `onway_${request.request_id}`)],
      ]),
    });
  } catch (err) {
    console.error('[TechnicianController] Accept error:', err);
    return ctx.reply('حدث خطأ أثناء قبول الطلب.');
  }
}

async function handleRejectRequest(ctx, requestId) {
  return ctx.reply('❌ تم رفض الطلب.', { parse_mode: 'Markdown' });
}

async function handleTasks(ctx) {
  try {
    const tasks = await Request.findAll({
      where: { tech_id: ctx.from.id, status: ['accepted', 'on_the_way', 'in_progress'] },
      order: [['created_at', 'DESC']],
    });

    if (!tasks || tasks.length === 0) {
      return ctx.reply('📭 لا توجد مهام حالية.', { parse_mode: 'Markdown' });
    }

    for (const task of tasks) {
      const { displayCategory } = require('../views/FormView');
      const { Markup } = require('telegraf');
      const statusLabels = {
        accepted: '✅ تم القبول',
        on_the_way: '🚗 في الطريق',
        in_progress: '🔧 قيد التنفيذ',
      };
      const text = `🆔 *#${task.request_id}*
📋 *${displayCategory(task.extracted_category)}*
📍 ${task.location || 'غير محدد'}
📝 ${(task.problem_description || '').substring(0, 100)}
📌 *الحالة:* ${statusLabels[task.status] || task.status}`;

      let buttons = [];
      if (task.status === 'accepted') {
        buttons = [[Markup.button.callback('🚗 على الطريق', `onway_${task.request_id}`)]];
      } else if (task.status === 'on_the_way') {
        buttons = [[Markup.button.callback('🔧 قيد التنفيذ', `progress_${task.request_id}`)]];
      } else if (task.status === 'in_progress') {
        buttons = [[Markup.button.callback('✅ إتمام المهمة', `complete_${task.request_id}`)]];
      }

      await ctx.reply(text, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons),
      });
    }
  } catch (err) {
    console.error('[TechnicianController] Tasks error:', err);
    return ctx.reply('حدث خطأ أثناء جلب المهام.');
  }
}

async function handleOnTheWay(ctx, requestId) {
  try {
    const request = await Request.findOne({
      where: { request_id: requestId, tech_id: ctx.from.id },
    });

    if (!request) {
      return ctx.reply('لم يتم العثور على الطلب أو غير مصرح لك.');
    }

    if (request.status !== 'accepted') {
      return ctx.reply('لا يمكن تحديث الحالة. الحالة الحالية: ' + request.status);
    }

    request.status = 'on_the_way';
    await request.save();

    const client = await User.findByPk(request.client_id);
    if (client) {
      await ctx.telegram.sendMessage(client.user_id, `
🚗 *الفني في الطريق إليك!*

الفني في طريقه إليك الآن.
📍 ${request.location || 'المنطقة المحددة'}
${request.detailed_address ? `*العنوان:* ${request.detailed_address}` : ''}`, { parse_mode: 'Markdown' });
    }

    const { Markup } = require('telegraf');
    return ctx.reply('✅ *تم تحديث الحالة:* 🚗 في الطريق', {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🔧 قيد التنفيذ', `progress_${request.request_id}`)],
      ]),
    });
  } catch (err) {
    console.error('[TechnicianController] OnTheWay error:', err);
    return ctx.reply('حدث خطأ أثناء تحديث الحالة.');
  }
}

async function handleInProgress(ctx, requestId) {
  try {
    const request = await Request.findOne({
      where: { request_id: requestId, tech_id: ctx.from.id },
    });

    if (!request) {
      return ctx.reply('لم يتم العثور على الطلب أو غير مصرح لك.');
    }

    if (request.status !== 'on_the_way') {
      return ctx.reply('لا يمكن تحديث الحالة. الحالة الحالية: ' + request.status);
    }

    request.status = 'in_progress';
    await request.save();

    const client = await User.findByPk(request.client_id);
    if (client) {
      await ctx.telegram.sendMessage(client.user_id, `
🔧 *بدأ الفني بالعمل!*

الفني بدأ بالعمل على طلبك الآن.
سيتم إشعارك عند الانتهاء.`, { parse_mode: 'Markdown' });
    }

    const { Markup } = require('telegraf');
    return ctx.reply('✅ *تم تحديث الحالة:* 🔧 قيد التنفيذ', {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('✅ إتمام المهمة', `complete_${request.request_id}`)],
      ]),
    });
  } catch (err) {
    console.error('[TechnicianController] InProgress error:', err);
    return ctx.reply('حدث خطأ أثناء تحديث الحالة.');
  }
}

async function handleCompleteRequest(ctx, requestId) {
  try {
    const request = await Request.findOne({
      where: { request_id: requestId, tech_id: ctx.from.id },
    });

    if (!request) {
      return ctx.reply('لم يتم العثور على الطلب أو غير مصرح لك.');
    }

    request.status = 'completed';
    await request.save();

    const client = await User.findByPk(request.client_id);
    if (client) {
      const { sendRatingSelection } = require('../views/FormView');
      const tempCtx = { telegram: ctx.telegram, reply: async (text, opts) => ctx.telegram.sendMessage(client.user_id, text, opts) };
      await sendRatingSelection(tempCtx, request.request_id);
    }

    return ctx.reply('✅ تم تحديث حالة الطلب إلى "مكتمل". شكراً لعملك!');
  } catch (err) {
    console.error('[TechnicianController] Complete error:', err);
    return ctx.reply('حدث خطأ أثناء تحديث حالة الطلب.');
  }
}

module.exports = {
  handleRegisterStart,
  handleRegistrationName,
  handleRegistrationPhone,
  handleRegistrationCategory,
  handleRegistrationLocation,
  handleAcceptRequest,
  handleRejectRequest,
  handleTasks,
  handleOnTheWay,
  handleInProgress,
  handleCompleteRequest,
  handleAdminApprove,
  handleAdminReject,
};
