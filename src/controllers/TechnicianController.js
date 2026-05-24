const { Technician, Request, User } = require('../Models');
const stateManager = require('../middleware/stateManager');
const { sendTechnicianRegistrationForm } = require('../views/FormView');

/**
 * TechnicianController - Handles technician registration and job management
 */

async function handleRegisterStart(ctx) {
  try {
    stateManager.resetAll(ctx.from.id);
    stateManager.setState(ctx.from.id, stateManager.STATE.AWAITING_REG_NAME);

    const existingTech = await Technician.findByPk(ctx.from.id);
    if (existingTech) {
      return ctx.reply('✅ أنت مسجل بالفعل كفني في النظام.');
    }

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

    await Technician.create({
      tech_id: ctx.from.id,
      full_name: data.full_name,
      phone_number: data.phone_number,
      category: data.category,
      location,
    });

    stateManager.resetAll(ctx.from.id);

    return ctx.reply(`
✅ *تم التسجيل بنجاح!*

أهلاً بك ${data.full_name} في شبكة فنيي GazaServe.
سيتم إرسال إشعارات لك عند وجود طلبات صيانة تطابق تخصصك ومنطقتك.

شكراً لانضمامك! 🙌`, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('[TechnicianController] Registration error:', err);
    return ctx.reply('❌ حدث خطأ أثناء التسجيل. الرجاء المحاولة مرة أخرى.');
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
${request.detailed_address ? `📍 *عنوانك المسجل:* ${request.detailed_address}` : ''}`, { parse_mode: 'Markdown' });
    }

    const { displayCategory } = require('../views/FormView');
    return ctx.reply(`
📞 *تم قبول الطلب - بيانات الزبون*

*الاسم:* ${client.full_name}
*رقم الهاتف:* ${client.phone_number}
*المنطقة:* ${client.location}
${request.detailed_address ? `*العنوان:* ${request.detailed_address}\n` : ''}`, { parse_mode: 'Markdown' });
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
      where: { tech_id: ctx.from.id, status: 'accepted' },
      order: [['created_at', 'DESC']],
    });

    if (!tasks || tasks.length === 0) {
      return ctx.reply('📭 لا توجد مهام حالية.', { parse_mode: 'Markdown' });
    }

    for (const task of tasks) {
      const { displayCategory } = require('../views/FormView');
      const text = `🆔 *#${task.request_id}*
📋 *${displayCategory(task.extracted_category)}*
📍 ${task.location || 'غير محدد'}
📝 ${task.problem_description.substring(0, 100)}`;

      await ctx.reply(text, {
        parse_mode: 'Markdown',
        ...require('telegraf').Markup.inlineKeyboard([
          [require('telegraf').Markup.button.callback('✅ إتمام المهمة', `complete_${task.request_id}`)],
        ]),
      });
    }
  } catch (err) {
    console.error('[TechnicianController] Tasks error:', err);
    return ctx.reply('حدث خطأ أثناء جلب المهام.');
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
      const { Markup } = require('telegraf');
      const ratingButtons = [];
      const row = [];
      for (let i = 1; i <= 5; i++) {
        row.push(Markup.button.callback(`${'⭐'.repeat(i)}`, `rate_${request.request_id}_${i}`));
      }
      ratingButtons.push(row);
      ratingButtons.push([Markup.button.callback('تخطي التقييم', `skip_rate_${request.request_id}`)]);
      await ctx.telegram.sendMessage(client.user_id, '✅ *تم إكمال طلبك!*\nيرجى تقييم الفني:', {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(ratingButtons),
      });
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
  handleCompleteRequest,
};
