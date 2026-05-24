const { User, Technician, Request } = require('../Models');
const stateManager = require('../middleware/stateManager');
const { sendJobNotification } = require('../views/NotificationView');

async function handleTextMessage(ctx, text) {
  const state = stateManager.getState(ctx.from.id);

  switch (state) {
    case stateManager.STATE.AWAITING_REG_NAME:
    case stateManager.STATE.AWAITING_REG_PHONE: {
      const { handleRegistrationName, handleRegistrationPhone } = require('./TechnicianController');
      const fn = state === stateManager.STATE.AWAITING_REG_NAME ? handleRegistrationName : handleRegistrationPhone;
      return fn(ctx, text);
    }
    case stateManager.STATE.AWAITING_REG_CATEGORY:
    case stateManager.STATE.AWAITING_REG_LOCATION:
    case stateManager.STATE.AWAITING_REQ_LOCATION:
      return ctx.reply('🖱️ الرجاء استخدام الأزرار أدناه للاختيار.', { parse_mode: 'Markdown' });
    case stateManager.STATE.AWAITING_REQ_DETAILED_ADDR: {
      return handleDetailedAddress(ctx, text);
    }
    case stateManager.STATE.AWAITING_PROBLEM_DESC: {
      let category = null;
      try {
        const extracted = await extractWithAI(text);
        category = extracted.category;
      } catch (aiErr) {
        console.warn('[AI] Extraction from typed problem failed:', aiErr.message);
      }

      stateManager.setData(ctx.from.id, {
        problem_desc: text,
        selected_category: category,
      });

      if (category) {
        const { displayCategory } = require('../views/FormView');
        stateManager.setState(ctx.from.id, stateManager.STATE.AWAITING_REQ_NAME);
        return ctx.reply(`✅ تم تصنيف طلبك كـ: *${displayCategory(category)}*\n\n👤 *الخطوة التالية:* أرسل اسمك الثلاثي (مثال: محمد أحمد علي):`, { parse_mode: 'Markdown' });
      } else {
        stateManager.setState(ctx.from.id, stateManager.STATE.IDLE);
        const { sendCategorySelection } = require('../views/FormView');
        return sendCategorySelection(ctx, '📝 لم نتمكن من تحديد التخصص تلقائياً.\nالرجاء اختيار نوع الخدمة:');
      }
    }
    case stateManager.STATE.AWAITING_REQ_DESC: {
      stateManager.setData(ctx.from.id, { problem_desc: text });
      stateManager.setState(ctx.from.id, stateManager.STATE.AWAITING_REQ_NAME);
      return ctx.reply('👤 *الخطوة 3/6: الاسم الثلاثي*\nأرسل اسمك الثلاثي (مثال: محمد أحمد علي):', { parse_mode: 'Markdown' });
    }
    case stateManager.STATE.AWAITING_REQ_NAME: {
      stateManager.setData(ctx.from.id, { full_name: text });
      stateManager.setState(ctx.from.id, stateManager.STATE.AWAITING_REQ_PHONE);
      return ctx.reply('📱 *الخطوة 4/6: رقم التواصل*\nأرسل رقم هاتفك للتواصل (مثال: 0599XXXXXX):', { parse_mode: 'Markdown' });
    }
    case stateManager.STATE.AWAITING_REQ_PHONE: {
      stateManager.setData(ctx.from.id, { phone: text });
      stateManager.setState(ctx.from.id, stateManager.STATE.AWAITING_REQ_LOCATION);
      const { sendLocationSelection } = require('../views/FormView');
      return sendLocationSelection(ctx, '📍 *الخطوة 5/6: المنطقة*\nاختر منطقتك السكنية في قطاع غزة:');
    }
    default: {
      if (text.startsWith('/register') || text.startsWith('/start') || text.startsWith('/help')) {
        return;
      }
      return processUserRequest(ctx, text);
    }
  }
}

async function handleVoiceMessage(ctx, voice) {
  try {
    const processingMsg = await ctx.reply('🎤 جاري تحليل الرسالة الصوتية...');

    const fileLink = await ctx.telegram.getFileLink(voice.file_id);
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const transcription = await openai.audio.transcriptions.create({
      model: 'whisper-1',
      file: await fetch(fileLink.href),
      language: 'ar',
    });

    const transcribedText = transcription.text;
    await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id);
    await ctx.reply(`🎤 *النص المستخرج:*\n${transcribedText}`, { parse_mode: 'Markdown' });

    let extractedCategory = null;
    try {
      const extracted = await extractWithAI(transcribedText);
      extractedCategory = extracted.category;
    } catch (aiErr) {
      console.warn('[RequestController] AI extraction from voice failed:', aiErr.message);
    }

    stateManager.setData(ctx.from.id, {
      problem_desc: transcribedText,
      selected_category: extractedCategory,
    });

    if (extractedCategory) {
      const { displayCategory } = require('../views/FormView');
      stateManager.setState(ctx.from.id, stateManager.STATE.AWAITING_REQ_NAME);
      return ctx.reply(`✅ تم تصنيف طلبك كـ: *${displayCategory(extractedCategory)}*\n\n👤 *الخطوة التالية:* أرسل اسمك الثلاثي (مثال: محمد أحمد علي):`, { parse_mode: 'Markdown' });
    } else {
      const { sendCategorySelection } = require('../views/FormView');
      stateManager.setState(ctx.from.id, stateManager.STATE.IDLE);
      return sendCategorySelection(ctx, '📝 لم نتمكن من تحديد التخصص تلقائياً.\nالرجاء اختيار نوع الخدمة:');
    }
  } catch (err) {
    console.error('[RequestController] Voice processing error:', err);
    return ctx.reply('❌ عذراً، حدث خطأ أثناء معالجة الرسالة الصوتية. يرجى إرسال النص كتابةً.');
  }
}

async function processUserRequest(ctx, text) {
  try {
    let category = null;
    let location = null;
    try {
      const extracted = await extractWithAI(text);
      category = extracted.category;
      location = extracted.location;
    } catch (aiErr) {
      console.warn('[RequestController] AI extraction failed, using fallback:', aiErr.message);
      return handleFallback(ctx, text, aiErr.message);
    }

    const [user] = await User.findOrCreate({
      where: { user_id: ctx.from.id },
      defaults: {
        user_id: ctx.from.id,
        full_name: ctx.from.first_name || 'مستخدم',
        phone_number: '0000000000',
        location: location || 'غير محدد',
      },
    });
    if (location && user.location !== location) {
      await user.update({ location });
    }

    const request = await Request.create({
      client_id: ctx.from.id,
      extracted_category: category,
      location,
      problem_description: text,
      status: 'pending',
    });

    const { displayCategory } = require('../views/FormView');
    await ctx.reply(`
✅ *تم استلام طلبك!*
*الخدمة:* ${displayCategory(category)}
*المنطقة:* ${location || 'غير محدد'}
*رقم الطلب:* #${request.request_id}
⏳ جاري البحث عن فني متاح في منطقتك...`);

    const matchedTechs = await Technician.findAll({
      where: { category, location: location || undefined, is_available: true },
    });

    if (matchedTechs.length === 0) {
      return ctx.reply('😔 عذراً، لم نجد فنيين متاحين في منطقتك حالياً. سيتم إشعارك عندما يتوفر فني.');
    }

    if (matchedTechs.length === 1) {
      const tech = matchedTechs[0];
      const notificationData = {
        request_id: request.request_id,
        client_name: user.full_name,
        extracted_category: category,
        location,
        detailed_address: request.detailed_address || null,
        problem_description: text.substring(0, 200),
      };
      const techCtx = { telegram: ctx.telegram, from: { id: tech.tech_id } };
      await sendJobNotification(techCtx, notificationData);
      const ratingStar = tech.rating_avg ? ` ⭐${tech.rating_avg.toFixed(1)}` : '';
      return ctx.reply(`👨‍🔧 تم إرسال طلبك إلى الفني *${tech.full_name}*${ratingStar}.\nسيتم إشعارك عند قبوله.`, { parse_mode: 'Markdown' });
    }

    const { Markup } = require('telegraf');
    const buttons = [];
    for (let i = 0; i < Math.min(matchedTechs.length, 5); i++) {
      const t = matchedTechs[i];
      const label = `${t.full_name}${t.rating_avg ? ` ⭐${t.rating_avg.toFixed(1)}` : ''}`;
      buttons.push([Markup.button.callback(label, `seltech_${request.request_id}_${t.tech_id}`)]);
    }
    await ctx.reply(`*👨‍🔧 اختر الفني المناسب لك في ${location}:*`, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(buttons),
    });
  } catch (err) {
    console.error('[RequestController] Process error:', err);
    return ctx.reply('❌ حدث خطأ أثناء معالجة طلبك. الرجاء المحاولة لاحقاً.');
  }
}

async function extractWithAI(text) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) throw new Error('OpenAI API key not configured');
  console.log('[AI] Starting extraction for:', text.substring(0, 50));

  const OpenAI = require('openai');
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  console.log('[AI] Calling OpenAI API...');
  const completion = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      {
        role: 'system',
        content: 'أنت مساعد لتصنيف طلبات الصيانة. حلل النص وأعد JSON:\n' +
          'إذا كان النص طلب صيانة حقيقي (مثل: مكسور، لا يعمل، يطلب تصليح):\n' +
          '{"type": "request", "category": "التخصص (سباكة/كهرباء/طاقة شمسية/تبريد وتكييف)", "location": "المنطقة"}\n\n' +
          'إذا كان النص تحية، سؤال، أو طلب تسجيل كفني:\n' +
          '{"type": "other"}\n\n' +
          'أمثلة:\n' +
          '"مكيف غرفتي ما يشتغل" → {"type": "request", "category": "تبريد وتكييف", "location": ""}\n' +
          '"مرحبا" → {"type": "other"}\n' +
          '"بدي سجل فني" → {"type": "other"}',
      },
      { role: 'user', content: text },
    ],
    temperature: 0.1,
  });

  const raw = completion.choices[0].message.content;
  console.log('[AI] Raw response:', raw);
  const parsed = JSON.parse(raw);

  if (parsed.type === 'other') {
    throw new Error('Not a maintenance request');
  }

  return {
    category: parsed.category || 'عام',
    location: parsed.location || 'غير محدد',
  };
}

async function handleFallback(ctx, text, reason) {
  console.log('[AI] Fallback triggered. Reason:', reason);
  const { sendFallbackMenu } = require('../views/FallbackView');
  return sendFallbackMenu(ctx);
}

async function handleCategorySelection(ctx, category) {
  const { displayCategory } = require('../views/FormView');
  stateManager.setData(ctx.from.id, { selected_category: category });
  stateManager.setState(ctx.from.id, stateManager.STATE.AWAITING_REQ_DESC);
  return ctx.reply(`📝 *الخطوة 2/6: وصف المشكلة*\n\nاخترت: ${displayCategory(category)}\n\nاكتب وصف المشكلة بالتفصيل:\n(مثال: "حنفية المطبخ مكسورة وبتسرب مية")`, {
    parse_mode: 'Markdown',
  });
}

async function handleLocationSelection(ctx, location) {
  const { displayCategory } = require('../views/FormView');
  const data = stateManager.getData(ctx.from.id);
  stateManager.setData(ctx.from.id, { location });
  stateManager.setState(ctx.from.id, stateManager.STATE.AWAITING_REQ_DETAILED_ADDR);
  return ctx.reply(`📍 *الخطوة الأخيرة: العنوان التفصيلي*
──────────────────
📋 التخصص: ${displayCategory(data.selected_category)}
📍 المنطقة: ${location}
──────────────────

✍️ اكتب عنوانك بالتفصيل (مثال: "شارع النص، بجانب مسجد السلام، عمارة أبو خضرا الطابق الثالث"):`, { parse_mode: 'Markdown' });
}

async function handleDetailedAddress(ctx, text) {
  const data = stateManager.getData(ctx.from.id);
  const category = data.selected_category;
  const location = data.location;
  const fullName = data.full_name || ctx.from.first_name || 'مستخدم';
  const problemDesc = data.problem_desc || `طلب صيانة: ${category} في ${location}`;
  const phone = data.phone || '0000000000';
  const detailedAddress = text;

  try {
    const [user] = await User.findOrCreate({
      where: { user_id: ctx.from.id },
      defaults: {
        user_id: ctx.from.id,
        full_name: fullName,
        phone_number: phone,
        location,
      },
    });
    const updates = {};
    if (user.phone_number !== phone) updates.phone_number = phone;
    if (user.location !== location) updates.location = location;
    if (user.full_name !== fullName) updates.full_name = fullName;
    if (Object.keys(updates).length > 0) await user.update(updates);

    const request = await Request.create({
      client_id: ctx.from.id,
      extracted_category: category,
      location,
      detailed_address: detailedAddress,
      problem_description: problemDesc,
      status: 'pending',
    });

    stateManager.resetAll(ctx.from.id);

    const { displayCategory } = require('../views/FormView');
    await ctx.reply(`✅ *تم تقديم طلبك بنجاح!*
┌──────────────────────
│👤 الاسم: ${fullName}
│📋 الخدمة: ${displayCategory(category)}
│📍 المنطقة: ${location}
│🏠 العنوان: ${detailedAddress}
│📱 هاتفك: ${phone}
│📝 الوصف: ${problemDesc.substring(0, 100)}
└──────────────────────
⏳ جاري البحث عن فني متاح...`, { parse_mode: 'Markdown' });

    const matchedTechs = await Technician.findAll({
      where: { category, location, is_available: true },
    });

    if (matchedTechs.length === 0) {
      return ctx.reply('😔 عذراً، لم نجد فنيين متاحين في منطقتك حالياً. سيتم إشعارك عندما يتوفر فني.');
    }

    if (matchedTechs.length === 1) {
      const tech = matchedTechs[0];
      const notificationData = {
        request_id: request.request_id,
        client_name: fullName,
        extracted_category: category,
        location,
        detailed_address: detailedAddress,
        problem_description: problemDesc.substring(0, 200),
      };
      const techCtx = { telegram: ctx.telegram, from: { id: tech.tech_id } };
      await sendJobNotification(techCtx, notificationData);
      const ratingStar = tech.rating_avg ? ` ⭐${tech.rating_avg.toFixed(1)}` : '';
      return ctx.reply(`👨‍🔧 تم إرسال طلبك إلى الفني *${tech.full_name}*${ratingStar}.\nسيتم إشعارك عند قبوله.`, { parse_mode: 'Markdown' });
    }

    const { Markup } = require('telegraf');
    const buttons = [];
    for (let i = 0; i < Math.min(matchedTechs.length, 5); i++) {
      const t = matchedTechs[i];
      const label = `${t.full_name}${t.rating_avg ? ` ⭐${t.rating_avg.toFixed(1)}` : ''}`;
      buttons.push([Markup.button.callback(label, `seltech_${request.request_id}_${t.tech_id}`)]);
    }
    await ctx.reply(`*👨‍🔧 اختر الفني المناسب لك في ${location}:*`, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(buttons),
    });
  } catch (err) {
    console.error('[RequestController] handleDetailedAddress error:', err);
    return ctx.reply('❌ حدث خطأ أثناء تقديم الطلب. الرجاء المحاولة لاحقاً.');
  }
}

async function handleTechSelection(ctx, requestId, techId) {
  try {
    const request = await Request.findByPk(requestId);
    if (!request || request.status !== 'pending') {
      return ctx.reply('هذا الطلب لم يعد متاحاً.');
    }

    const tech = await Technician.findByPk(techId);
    if (!tech) {
      return ctx.reply('لم يتم العثور على الفني.');
    }

    const client = await User.findByPk(request.client_id);
    const notificationData = {
      request_id: request.request_id,
      client_name: client ? client.full_name : 'مستخدم',
      extracted_category: request.extracted_category,
      location: request.location,
      detailed_address: request.detailed_address,
      problem_description: request.problem_description.substring(0, 200),
    };

    const techCtx = { telegram: ctx.telegram, from: { id: tech.tech_id } };
    await sendJobNotification(techCtx, notificationData);

    const { displayCategory } = require('../views/FormView');
    const ratingStar = tech.rating_avg ? ` ⭐${tech.rating_avg.toFixed(1)}` : '';
    return ctx.reply(`👨‍🔧 تم إرسال طلبك إلى الفني *${tech.full_name}*${ratingStar}.\nسيتم إشعارك عند قبوله.`, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('[RequestController] handleTechSelection error:', err);
    return ctx.reply('❌ حدث خطأ. الرجاء المحاولة لاحقاً.');
  }
}

module.exports = {
  handleTextMessage,
  handleVoiceMessage,
  handleCategorySelection,
  handleLocationSelection,
  handleDetailedAddress,
  handleTechSelection,
  processUserRequest,
};
