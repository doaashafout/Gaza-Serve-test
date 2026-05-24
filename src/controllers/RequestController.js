const { User, Technician, Request } = require('../Models');
const stateManager = require('../middleware/stateManager');
const { sendJobNotification } = require('../views/NotificationView');

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
  return { valid: true, message: null };
}

function validatePhone(phone) {
  const cleaned = phone.replace(/[\s\-\(\)]+/g, '');
  if (!/^05[69]\d{7}$/.test(cleaned) && !/^\+9705[69]\d{7}$/.test(cleaned) && !/^009705[69]\d{7}$/.test(cleaned)) {
    return { valid: false, message: '❌ رقم الهاتف غير صحيح. الرجاء إدخال رقم فلسطيني صحيح يبدأ بـ 059 أو 056 (مثال: 0599XXXXXX).' };
  }
  return { valid: true, message: null };
}

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
      const nameCheck = validateName(text);
      if (!nameCheck.valid) return ctx.reply(nameCheck.message, { parse_mode: 'Markdown' });
      stateManager.setData(ctx.from.id, { full_name: text });
      stateManager.setState(ctx.from.id, stateManager.STATE.AWAITING_REQ_PHONE);
      return ctx.reply('📱 *الخطوة 4/6: رقم التواصل*\nأرسل رقم هاتفك للتواصل (مثال: 0599XXXXXX):', { parse_mode: 'Markdown' });
    }
    case stateManager.STATE.AWAITING_REQ_PHONE: {
      const phoneCheck = validatePhone(text);
      if (!phoneCheck.valid) return ctx.reply(phoneCheck.message, { parse_mode: 'Markdown' });
      stateManager.setData(ctx.from.id, { phone: text });
      stateManager.setState(ctx.from.id, stateManager.STATE.AWAITING_REQ_LOCATION);
      const { sendLocationSelection } = require('../views/FormView');
      return sendLocationSelection(ctx, '📍 *الخطوة 5/6: المنطقة*\nاختر منطقتك السكنية في قطاع غزة:');
    }
    default: {
      if (text.startsWith('/register') || text.startsWith('/start') || text.startsWith('/help') || text.startsWith('/tasks')) {
        return;
      }
      return handleGeneralAI(ctx, text);
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

const AI_SYSTEM_PROMPT = `أنت مساعد خدمة عملاء محترف لـ "GazaServe" 🛠️

GazaServe هو بوت ذكي يربط سكان قطاع غزة بفنيي الصيانة المنزلية المتخصصين.

## الخدمات المتاحة:
• 🔧 سباكة - أحواض، مغاسل، حنفيات، مواسير، سخانات مياه، شفاطات مطبخ، تسريبات مياه، كوع صرف
• ⚡ كهرباء - أسلاك، فيش، كشافات، لوحات كهربائية، لمبات، برييزات، فيوزات، عطل عام بالكهرباء
• ☀️ طاقة شمسية - ألواح شمسية، بطاريات، انفرتر، منظومات كاملة
• ❄️ تبريد وتكييف - مكيفات، ثلاجات، غسالات (ملابس/صحون)، برادات، فريزرات

## المناطق: 
غزة - الشمال، غزة - الوسطى، غزة - الجنوب، غزة - المدينة، خان يونس، رفح، دير البلح، جباليا

## شخصيتك:
- محترف، لبق، ودود
- تستخدم العربية الفصحى البسيطة
- تتعاطف مع مشاكل المستخدم
- توجه المستخدم بلطف نحو الخدمة المناسبة

## أسلوب الرد:
- ردود احترافية ولكن دافئة
- استخدم الرموز التعبيرية باعتدال
- اشرح الخطوات القادمة بوضوح
- إذا كان الطلب خارج نطاق الصيانة، اعتذر بلطف ووضح الخدمات المتاحة

مثال على رد احترافي لطلب صيانة:
"أتفهم مشكلتك تماماً! 🤝 تكييف الهواء أمر ضروري خاصة في أجواء غزة. 
يسرني مساعدتك في إيجاد فني تبريد وتكييف متخصص.
سأبدأ معك خطوة بخطوة لإتمام الطلب."

مثال على رد لاستفسار عام:
"أهلاً بك في GazaServe! 👋
نحن هنا لمساعدتك في حل مشاكل الصيانة المنزلية بكل احترافية.
يمكنك طلب فني متخصص في:
🔧 سباكة | ⚡ كهرباء | ☀️ طاقة شمسية | ❄️ تبريد وتكييف

اكتب مشكلتك بالتفصيل وسأقوم بتوجيهك للفني المناسب!"`;

const AI_FUNCTIONS = [
  {
    name: 'submit_request',
    description: 'المستخدم يطلب خدمة صيانة - استخراج التفاصيل بدقة',
    parameters: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['سباكة', 'كهرباء', 'طاقة شمسية', 'تبريد وتكييف'],
          description: 'اختر التخصص بدقة: سباكة لكل ما يتعلق بالمياه والمواسير والمغاسل والأحواض. كهرباء للأسلاك والفيش واللمبات والأعطال الكهربائية. طاقة شمسية للألواح والبطاريات والانفرتر. تبريد وتكييف للمكيفات والثلاجات والغسالات والبرادات.',
        },
        location: {
          type: 'string',
          description: 'المنطقة في قطاع غزة إن ذكرها المستخدم',
        },
        response: {
          type: 'string',
          description: 'رد محترف ومتعاطف يشرح الخطوة القادمة',
        },
      },
      required: ['category', 'response'],
    },
  },
  {
    name: 'respond',
    description: 'الرد على المستخدم في غير طلبات الصيانة',
    parameters: {
      type: 'object',
      properties: {
        response_text: {
          type: 'string',
          description: 'الرد على المستخدم',
        },
        show_menu: {
          type: 'boolean',
          description: 'هل نعرض القائمة الرئيسية بعد الرد',
        },
      },
      required: ['response_text', 'show_menu'],
    },
  },
];

async function handleGeneralAI(ctx, text) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) {
    console.warn('[AI] API key missing, using fallback');
    return handleFallback(ctx, text, 'AI not configured');
  }

  try {
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    stateManager.addMessage(ctx.from.id, 'user', text);
    const history = stateManager.getHistory(ctx.from.id, 4);

    const messages = [
      { role: 'system', content: AI_SYSTEM_PROMPT },
    ];

    for (const msg of history.slice(0, -1)) {
      messages.push({ role: msg.role, content: msg.text });
    }
    messages.push({ role: 'user', content: text });

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages,
      functions: AI_FUNCTIONS,
      function_call: 'auto',
      temperature: 0.3,
    });

    const msg = completion.choices[0].message;

    if (msg.function_call) {
      const fnName = msg.function_call.name;
      const args = JSON.parse(msg.function_call.arguments);

      if (fnName === 'submit_request') {
        stateManager.setData(ctx.from.id, {
          problem_desc: text,
          selected_category: args.category || null,
        });

        if (args.category) {
          const { displayCategory } = require('../views/FormView');
          stateManager.setState(ctx.from.id, stateManager.STATE.AWAITING_REQ_NAME);
          stateManager.addMessage(ctx.from.id, 'assistant', args.response);
          return ctx.reply(`${args.response}\n\n✅ تم تصنيف طلبك كـ: *${displayCategory(args.category)}*\n\n👤 *الخطوة التالية:* أرسل اسمك الثلاثي (مثال: محمد أحمد علي):`, { parse_mode: 'Markdown' });
        } else {
          const { sendCategorySelection } = require('../views/FormView');
          stateManager.setState(ctx.from.id, stateManager.STATE.IDLE);
          stateManager.addMessage(ctx.from.id, 'assistant', 'لم نتمكن من تحديد التخصص');
          return sendCategorySelection(ctx, '📝 لم نتمكن من تحديد التخصص.\nالرجاء اختيار نوع الخدمة:');
        }
      }

      if (fnName === 'respond') {
        stateManager.addMessage(ctx.from.id, 'assistant', args.response_text);
        await ctx.reply(args.response_text, { parse_mode: 'Markdown' });
        if (args.show_menu) {
          const { sendWelcome } = require('../views/MainView');
          return sendWelcome(ctx);
        }
        return;
      }
    }

    const fallbackText = msg.content || 'شكراً لتواصلك مع GazaServe! كيف يمكنني مساعدتك؟';
    stateManager.addMessage(ctx.from.id, 'assistant', fallbackText);
    await ctx.reply(fallbackText, { parse_mode: 'Markdown' });
    const { sendWelcome } = require('../views/MainView');
    return sendWelcome(ctx);
  } catch (err) {
    console.error('[AI] General AI error:', err.message);
    return handleFallback(ctx, text, err.message);
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

    try {
      const matchedTechs = await Technician.findAll({
        where: { category, location },
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
    } catch (notifyErr) {
      console.error('[RequestController] Tech notification error:', notifyErr.message);
      await ctx.reply('📣 تم حفظ طلبك. سنبحث عن فني مناسب وسنعلمك فور توفر أحدهم.');
    }
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
  handleGeneralAI,
};
