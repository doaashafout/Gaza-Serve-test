const { Technician, Request, User } = require('../Models');
const crypto = require('crypto');
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

async function handleRegistrationName(ctx, text) {
  stateManager.setData(ctx.from.id, { full_name: text });
  stateManager.setState(ctx.from.id, stateManager.STATE.AWAITING_REG_PHONE);
  return ctx.reply('*الخطوة 2/4:* أرسل رقم هاتفك للتواصل (مثال: 0599XXXXXX):', {
    parse_mode: 'Markdown',
  });
}

async function handleRegistrationPhone(ctx, text) {
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

    const confirmationCode = crypto.randomInt(1000, 9999).toString();

    request.tech_id = ctx.from.id;
    request.status = 'accepted';
    request.confirmation_code = confirmationCode;
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

🔐 *كود التأكيد:* ${confirmationCode}

⚠️ يرجى إعطاء كود التأكيد للفني عند وصوله لبدء العمل.${request.detailed_address ? `\n\n📍 *عنوانك المسجل:* ${request.detailed_address}` : ''}`, { parse_mode: 'Markdown' });
    }

    const { displayCategory } = require('../views/FormView');
    return ctx.reply(`
📞 *تم قبول الطلب - بيانات الزبون*

*الاسم:* ${client.full_name}
*رقم الهاتف:* ${client.phone_number}
*المنطقة:* ${client.location}
${request.detailed_address ? `*العنوان:* ${request.detailed_address}\n` : ''}
🔐 *كود التأكيد:* ${confirmationCode}

⚠️ يجب طلب كود التأكيد من الزبون عند الوصول لبدء العمل.`, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('[TechnicianController] Accept error:', err);
    return ctx.reply('حدث خطأ أثناء قبول الطلب.');
  }
}

async function handleRejectRequest(ctx, requestId) {
  return ctx.reply('❌ تم رفض الطلب.', { parse_mode: 'Markdown' });
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
  handleCompleteRequest,
};
