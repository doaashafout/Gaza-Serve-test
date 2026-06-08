const { User, Technician, Request } = require('../Models');
const stateManager = require('../middlewares/stateManager');
const { sendJobNotification } = require('../views/NotificationView');
const { extractWithAI, callOpenAIWithRetry, AI_SYSTEM_PROMPT, AI_FUNCTIONS } = require('../services/openaiService');

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
      return ctx.reply('🖱️ الرجاء استخدام الأزرار أدناه للاختيار.', { parse_mode: 'Markdown' });
    case stateManager.STATE.AWAITING_REQ_DETAILED_ADDR: {
      return handleDetailedAddress(ctx, text);
    }
    case stateManager.STATE.AWAITING_SUPPORT: {
      const { handleSupportMessage } = require('./SupportController');
      return handleSupportMessage(ctx, text);
    }
    case stateManager.STATE.AWAITING_SUPPORT_REPLY: {
      const { handleAdminReplyText } = require('./SupportController');
      return handleAdminReplyText(ctx, text);
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
      stateManager.setState(ctx.from.id, stateManager.STATE.IDLE);
      await ctx.reply(`✅ تم تصنيف طلبك كـ: *${displayCategory(extractedCategory)}*`, { parse_mode: 'Markdown' });
      const { sendMainRegionSelection } = require('../views/FormView');
      stateManager.setState(ctx.from.id, stateManager.STATE.AWAITING_REQ_MAIN_REGION);
      return sendMainRegionSelection(ctx);
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

    const completion = await callOpenAIWithRetry(() => openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages,
      functions: AI_FUNCTIONS,
      function_call: 'auto',
      temperature: 0.3,
    }));

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
          stateManager.setState(ctx.from.id, stateManager.STATE.IDLE);
          stateManager.addMessage(ctx.from.id, 'assistant', args.response);
          await ctx.reply(args.response, { parse_mode: 'Markdown' });
          await ctx.reply(`✅ تم تصنيف طلبك كـ: *${displayCategory(args.category)}*`, { parse_mode: 'Markdown' });
          const { sendMainRegionSelection } = require('../views/FormView');
          stateManager.setState(ctx.from.id, stateManager.STATE.AWAITING_REQ_MAIN_REGION);
          return sendMainRegionSelection(ctx);
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

async function handleFallback(ctx, text, reason) {
  console.log('[AI] Fallback triggered. Reason:', reason);
  const { sendFallbackMenu } = require('../views/FallbackView');
  return sendFallbackMenu(ctx);
}

// Step 1: User selected a category from reply keyboard
async function handleCategorySelection(ctx, category) {
  const { displayCategory } = require('../views/FormView');
  stateManager.setData(ctx.from.id, { selected_category: category });
  stateManager.setState(ctx.from.id, stateManager.STATE.AWAITING_REQ_MAIN_REGION);
  const { sendMainRegionSelection } = require('../views/FormView');
  return ctx.reply(`✅ اخترت: ${displayCategory(category)}`).then(() => {
    return sendMainRegionSelection(ctx);
  });
}

// Step 2: User selected a main region from reply keyboard
async function handleMainRegionSelection(ctx, mainRegion) {
  const { MAIN_REGIONS_CLEAN, sendSubRegionSelection } = require('../views/FormView');
  stateManager.setData(ctx.from.id, { main_region: MAIN_REGIONS_CLEAN[mainRegion] || mainRegion });
  stateManager.setState(ctx.from.id, stateManager.STATE.AWAITING_REQ_SUB_REGION);

  const { SUB_REGIONS } = require('../views/FormView');
  const subs = SUB_REGIONS[mainRegion];
  if (!subs || subs.length === 0) {
    // No sub-regions, go directly to address
    stateManager.setState(ctx.from.id, stateManager.STATE.AWAITING_REQ_DETAILED_ADDR);
    return ctx.reply('✍️ يرجى كتابة عنوانك بالتفصيل مع أقرب معلم معروف ليسهل على مقدم الخدمة الوصول إليك.\n\nمثال: الشارع، الحي، أقرب مسجد، مدرسة، دوار، متجر..');
  }
  return sendSubRegionSelection(ctx, mainRegion);
}

// Step 3: User selected a sub-region from inline keyboard
async function handleSubRegionSelection(ctx, subRegion) {
  const { Markup } = require('telegraf');
  stateManager.setData(ctx.from.id, { sub_region: subRegion });
  stateManager.setState(ctx.from.id, stateManager.STATE.AWAITING_REQ_DETAILED_ADDR);
  return ctx.reply('✍️ يرجى كتابة عنوانك بالتفصيل مع أقرب معلم معروف ليسهل على مقدم الخدمة الوصول إليك.\n\nمثال: الشارع، الحي، أقرب مسجد، مدرسة، دوار، متجر..', { ...Markup.removeKeyboard() });
}

// Step 4: User typed detailed address → confirm + ask date/time
async function handleDetailedAddress(ctx, text) {
  stateManager.setData(ctx.from.id, { detailed_address: text });
  stateManager.setState(ctx.from.id, stateManager.STATE.AWAITING_REQ_DATE);
  const { sendDateTimeSelection } = require('../views/FormView');
  return sendDateTimeSelection(ctx);
}

// Step 5: User selected date → ask time
async function handleDateSelection(ctx, date) {
  stateManager.setData(ctx.from.id, { selected_date: date });
  const { sendTimeSelection } = require('../views/FormView');
  return sendTimeSelection(ctx, date);
}

// Step 5b: User selected time → create request & submit
async function handleTimeSelection(ctx, timeStr) {
  stateManager.setData(ctx.from.id, { selected_time: timeStr });
  const data = stateManager.getData(ctx.from.id);
  const category = data.selected_category;
  const location = `${data.main_region}${data.sub_region ? ` - ${data.sub_region}` : ''}`;
  const fullName = ctx.from.first_name || 'مستخدم';
  const detailedAddress = data.detailed_address || '';
  const dateTimeStr = `${data.selected_date || ''} ${data.selected_time || ''}`.trim();
  const problemDesc = `طلب صيانة: ${category} في ${location}` + (dateTimeStr ? ` | الموعد: ${dateTimeStr}` : '');

  try {
    const [user] = await User.findOrCreate({
      where: { user_id: ctx.from.id },
      defaults: {
        user_id: ctx.from.id,
        full_name: fullName,
        location,
      },
    });
    const updates = {};
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

    const { Markup: M } = require('telegraf');
    const { displayCategory } = require('../views/FormView');
    await ctx.reply(`✅ *تم تقديم طلبك بنجاح!*
┌──────────────────────
│📋 الخدمة: ${displayCategory(category)}
│📍 المنطقة: ${location}
│🏠 العنوان: ${detailedAddress}
│🕐 الموعد: ${dateTimeStr || 'في أقرب وقت'}
└──────────────────────
⏳ جاري البحث عن فني متاح...`, { parse_mode: 'Markdown', ...M.removeKeyboard() });

    try {
      const matchedTechs = await Technician.findAll({
        where: { category, location: data.main_region, status: 'approved', is_available: true },
      });

      if (matchedTechs.length === 0) {
        return ctx.reply('😔 عذراً، لم نجد فنيين متاحين في منطقتك حالياً. سيتم إشعارك عندما يتوفر فني.');
      }

      const ratingOf = (t) => { try { return t.rating_avg ? ` ⭐${Number(t.rating_avg).toFixed(1)}` : ''; } catch(e) { return ''; } };

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
        const techChatId = Number(tech.tech_id);
        const techCtx = { telegram: ctx.telegram, from: { id: techChatId } };
        try {
          await sendJobNotification(techCtx, notificationData);
        } catch (notifyErr) {
          console.error('[RequestController] single-tech notify failed:', notifyErr.message);
          return ctx.reply(`❌ لم يتم إرسال الإشعار للفني ${tech.full_name}. قد لا يكون الفني قد بدأ استخدام البوت بعد.\nرابط البوت: https://t.me/GazaServeBot`);
        }
        return ctx.reply(`👨‍🔧 تم إرسال طلبك إلى الفني *${tech.full_name}*${ratingOf(tech)}.\nسيتم إشعارك عند قبوله.`, { parse_mode: 'Markdown' });
      }

      const { Markup } = require('telegraf');
      const buttons = [];
      for (let i = 0; i < Math.min(matchedTechs.length, 5); i++) {
        const t = matchedTechs[i];
        buttons.push([Markup.button.callback(`${t.full_name}${ratingOf(t)}`, `seltech_${request.request_id}_${t.tech_id}`)]);
      }
      await ctx.reply(`*👨‍🔧 اختر الفني المناسب لك في ${location}:*`, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons),
      });
    } catch (notifyErr) {
      console.error('[RequestController] Tech notify error:', notifyErr.message, notifyErr.stack);
      try {
        const fallbackTechs = await Technician.findAll({ where: { category, status: 'approved' } });
        if (fallbackTechs.length > 0) {
          const { Markup } = require('telegraf');
          const btns = fallbackTechs.map(t => [Markup.button.callback(t.full_name, `seltech_${request.request_id}_${t.tech_id}`)]);
          return ctx.reply(`*👨‍🔧 اختر الفني المناسب (تم تبسيط الاختيار):*`, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard(btns),
          });
        }
      } catch (_) {}
      try { await ctx.reply('📣 تم حفظ طلبك. سنبحث عن فني مناسب وسنعلمك فور توفر أحدهم.'); } catch (_2) {}
    }
  } catch (err) {
    console.error('[RequestController] handleTimeSelection error:', err.message, err.stack);
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

    if (request.tech_id) {
      return ctx.reply('❌ تم اختيار فني لهذا الطلب مسبقاً.');
    }

    const client = await User.findByPk(request.client_id);
    const notificationData = {
      request_id: request.request_id,
      client_name: client ? client.full_name : 'مستخدم',
      extracted_category: request.extracted_category,
      location: request.location,
      detailed_address: request.detailed_address,
      problem_description: (request.problem_description || '').substring(0, 200),
    };

    const techChatId = Number(tech.tech_id);
    if (!techChatId || isNaN(techChatId)) {
      return ctx.reply('❌ معرف الفني غير صالح.');
    }

    const techCtx = { telegram: ctx.telegram, from: { id: techChatId } };
    try {
      await sendJobNotification(techCtx, notificationData);
    } catch (notifyErr) {
      console.error('[RequestController] notify failed (chat not found?):', notifyErr.message);
      return ctx.reply(`❌ لم يتم إرسال الإشعار للفني ${tech.full_name}. قد لا يكون الفني قد بدأ استخدام البوت بعد.\nيمكنك مشاركة رابط البوت معه: https://t.me/GazaServeBot`);
    }

    request.tech_id = techChatId;
    await request.save();

    const { displayCategory } = require('../views/FormView');
    const avg = Number(tech.rating_avg);
    const ratingStar = avg > 0 ? ` ⭐${avg.toFixed(1)}` : '';
    return ctx.reply(`👨‍🔧 تم إرسال طلبك إلى الفني *${tech.full_name}*${ratingStar}.\nسيتم إشعارك عند قبوله.`, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('[RequestController] handleTechSelection error (req=%s, tech=%s):', requestId, techId, err.message, err.stack);
    return ctx.reply('❌ حدث خطأ. الرجاء المحاولة لاحقاً.');
  }
}

module.exports = {
  handleTextMessage,
  handleVoiceMessage,
  handleCategorySelection,
  handleMainRegionSelection,
  handleSubRegionSelection,
  handleDetailedAddress,
  handleDateSelection,
  handleTimeSelection,
  handleTechSelection,
  handleGeneralAI,
};
