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
    case stateManager.STATE.AWAITING_PROBLEM_DESC:
      return processUserRequest(ctx, text);
    case stateManager.STATE.AWAITING_REQ_DESC: {
      stateManager.setData(ctx.from.id, { problem_desc: text });
      stateManager.setState(ctx.from.id, stateManager.STATE.AWAITING_REQ_PHONE);
      return ctx.reply('📱 *الخطوة 3/4: رقم التواصل*\nأرسل رقم هاتفك للتواصل (مثال: 0599XXXXXX):', { parse_mode: 'Markdown' });
    }
    case stateManager.STATE.AWAITING_REQ_PHONE: {
      stateManager.setData(ctx.from.id, { phone: text });
      stateManager.setState(ctx.from.id, stateManager.STATE.AWAITING_REQ_LOCATION);
      const { sendLocationSelection } = require('../views/FormView');
      return sendLocationSelection(ctx, '📍 *الخطوة 4/4: المنطقة*\nاختر منطقتك السكنية في قطاع غزة:');
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
      stateManager.setState(ctx.from.id, stateManager.STATE.AWAITING_REQ_PHONE);
      return ctx.reply(`✅ تم تصنيف طلبك كـ: *${extractedCategory}*\n\n📱 *الخطوة التالية:* أرسل رقم هاتفك للتواصل (مثال: 0599XXXXXX):`, { parse_mode: 'Markdown' });
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
      return handleFallback(ctx, text);
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

    const request = await Request.create({
      client_id: ctx.from.id,
      extracted_category: category,
      problem_description: text,
      status: 'pending',
    });

    await ctx.reply(`
✅ *تم استلام طلبك!*
*الخدمة:* ${category}
*المنطقة:* ${location || 'غير محدد'}
*رقم الطلب:* #${request.request_id}
⏳ جاري البحث عن فني متاح في منطقتك...`);

    const matchedTechs = await Technician.findAll({
      where: { category, location: location || undefined, is_available: true },
    });

    if (matchedTechs.length === 0) {
      return ctx.reply('😔 عذراً، لم نجد فنيين متاحين في منطقتك حالياً. سيتم إشعارك عندما يتوفر فني.');
    }

    const notificationData = {
      request_id: request.request_id,
      extracted_category: category,
      location,
      problem_description: text.substring(0, 200),
    };

    for (const tech of matchedTechs) {
      try {
        const techCtx = { telegram: ctx.telegram, from: { id: tech.tech_id } };
        await sendJobNotification(techCtx, notificationData);
      } catch (notifyErr) {
        console.warn(`[RequestController] Failed to notify tech ${tech.tech_id}:`, notifyErr.message);
      }
    }

    return ctx.reply(`📣 تم إرسال طلبك إلى ${matchedTechs.length} فني في منطقتك.`);
  } catch (err) {
    console.error('[RequestController] Process error:', err);
    return ctx.reply('❌ حدث خطأ أثناء معالجة طلبك. الرجاء المحاولة لاحقاً.');
  }
}

async function extractWithAI(text) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) throw new Error('OpenAI API key not configured');

  const OpenAI = require('openai');
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

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
  const parsed = JSON.parse(raw);

  if (parsed.type === 'other') {
    throw new Error('Not a maintenance request');
  }

  return {
    category: parsed.category || 'عام',
    location: parsed.location || 'غير محدد',
  };
}

async function handleFallback(ctx, text) {
  const { sendFallbackMenu } = require('../views/FallbackView');
  return sendFallbackMenu(ctx);
}

async function handleCategorySelection(ctx, category) {
  stateManager.setData(ctx.from.id, { selected_category: category });
  stateManager.setState(ctx.from.id, stateManager.STATE.AWAITING_REQ_DESC);
  return ctx.reply(`📝 *الخطوة 2/4: وصف المشكلة*\n\nاخترت: ${category}\n\nاكتب وصف المشكلة بالتفصيل:\n(مثال: "حنفية المطبخ مكسورة وبتسرب مية")`, {
    parse_mode: 'Markdown',
  });
}

async function handleLocationSelection(ctx, location) {
  const data = stateManager.getData(ctx.from.id);
  const category = data.selected_category;
  const problemDesc = data.problem_desc || `طلب صيانة: ${category} في ${location}`;
  const phone = data.phone || '0000000000';

  try {
    await User.findOrCreate({
      where: { user_id: ctx.from.id },
      defaults: {
        user_id: ctx.from.id,
        full_name: ctx.from.first_name || 'مستخدم',
        phone_number: phone,
        location,
      },
    });

    const request = await Request.create({
      client_id: ctx.from.id,
      extracted_category: category,
      problem_description: problemDesc,
      status: 'pending',
    });

    stateManager.resetAll(ctx.from.id);

    await ctx.reply(`✅ *تم تقديم طلبك بنجاح!*
┌──────────────────────
│📋 الخدمة: ${category}
│📍 المنطقة: ${location}
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

    const notificationData = {
      request_id: request.request_id,
      extracted_category: category,
      location,
      problem_description: problemDesc.substring(0, 200),
    };

    for (const tech of matchedTechs) {
      try {
        const techCtx = { telegram: ctx.telegram, from: { id: tech.tech_id } };
        await sendJobNotification(techCtx, notificationData);
      } catch (notifyErr) {
        console.warn(`[RequestController] Failed to notify tech ${tech.tech_id}:`, notifyErr.message);
      }
    }

    return ctx.reply(`📣 تم إرسال طلبك إلى ${matchedTechs.length} فني في منطقتك.`);
  } catch (err) {
    console.error('[RequestController] handleLocationSelection error:', err);
    return ctx.reply('❌ حدث خطأ أثناء تقديم الطلب. الرجاء المحاولة لاحقاً.');
  }
}

module.exports = {
  handleTextMessage,
  handleVoiceMessage,
  handleCategorySelection,
  handleLocationSelection,
  processUserRequest,
};
