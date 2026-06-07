const { User, Technician, Request } = require('../Models');
const stateManager = require('../middlewares/stateManager');
const { sendJobNotification } = require('../views/NotificationView');
const { validateName, validatePhone } = require('../validations');
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
    case stateManager.STATE.AWAITING_REQ_LOCATION:
      return ctx.reply('🖱️ الرجاء استخدام الأزرار أدناه للاختيار.', { parse_mode: 'Markdown' });
    case stateManager.STATE.AWAITING_REQ_PHOTO:
      return ctx.reply('📷 الرجاء إرسال صورة للعطل، أو اضغط على زر التخطي للمتابعة بدون صورة.', { parse_mode: 'Markdown' });
    case stateManager.STATE.AWAITING_SUPPORT: {
      const { handleSupportMessage } = require('./SupportController');
      return handleSupportMessage(ctx, text);
    }
    case stateManager.STATE.AWAITING_SUPPORT_REPLY: {
      const { handleAdminReplyText } = require('./SupportController');
      return handleAdminReplyText(ctx, text);
    }
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
        stateManager.setState(ctx.from.id, stateManager.STATE.IDLE);
        const { displayCategory } = require('../views/FormView');
        await ctx.reply(`✅ تم تصنيف طلبك كـ: *${displayCategory(category)}*`, { parse_mode: 'Markdown' });
        return askForPhoto(ctx);
      } else {
        stateManager.setState(ctx.from.id, stateManager.STATE.IDLE);
        const { sendCategorySelection } = require('../views/FormView');
        return sendCategorySelection(ctx, '📝 لم نتمكن من تحديد التخصص تلقائياً.\nالرجاء اختيار نوع الخدمة:');
      }
    }
    case stateManager.STATE.AWAITING_REQ_DESC: {
      stateManager.setData(ctx.from.id, { problem_desc: text });
      return askForPhoto(ctx);
    }
    default: {
      if (text.startsWith('/')) return;
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

    try { await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id); } catch (_) {}

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
      return askForPhoto(ctx);
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
    return handleFallback(ctx, text, 'AI not configured');
  }

  try {
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    stateManager.addMessage(ctx.from.id, 'user', text);
    const history = stateManager.getHistory(ctx.from.id, 4);

    const messages = [{ role: 'system', content: AI_SYSTEM_PROMPT }];
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
      let args;
      try {
        args = JSON.parse(msg.function_call.arguments);
      } catch (parseErr) {
        console.error('[AI] Failed to parse function args:', parseErr.message);
        return handleFallback(ctx, text, 'invalid function args');
      }

      if (fnName === 'submit_request') {
        stateManager.setData(ctx.from.id, {
          problem_desc: text,
          selected_category: args.category || null,
        });

        if (args.category) {
          const { displayCategory } = require('../views/FormView');
          stateManager.setState(ctx.from.id, stateManager.STATE.IDLE);
          stateManager.addMessage(ctx.from.id, 'assistant', args.response);
          if (args.response) await ctx.reply(args.response, { parse_mode: 'Markdown' });
          await ctx.reply(`✅ تم تصنيف طلبك كـ: *${displayCategory(args.category)}*`, { parse_mode: 'Markdown' });
          return askForPhoto(ctx);
        } else {
          const { sendCategorySelection } = require('../views/FormView');
          stateManager.setState(ctx.from.id, stateManager.STATE.IDLE);
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

    const fallbackText = msg.content || 'كيف يمكنني مساعدتك؟';
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

async function handleCategorySelection(ctx, category) {
  const { displayCategory } = require('../views/FormView');
  stateManager.setData(ctx.from.id, { selected_category: category });
  stateManager.setState(ctx.from.id, stateManager.STATE.AWAITING_REQ_DESC);

  return ctx.reply(
    `✅ اخترت: *${displayCategory(category)}*\n\n📝 *يرجى وصف المشكلة التي تواجهها بالتفصيل*\n\nلنتمكن من إرسال طلبك للمشرف بدقة.`,
    { parse_mode: 'Markdown' }
  );
}

function askForPhoto(ctx) {
  const { Markup } = require('telegraf');
  stateManager.setState(ctx.from.id, stateManager.STATE.AWAITING_REQ_PHOTO);
  return ctx.reply(
    '✅ شكراً لك.\n\nالآن، إذا كانت لديك صورة توضح المشكلة يمكنك إرسالها.',
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📷 إرسال صورة', 'add_photo')],
        [Markup.button.callback('⏭ تخطي هذه الخطوة', 'skip_photo')],
      ]),
    }
  );
}

async function handleSkipPhoto(ctx) {
  stateManager.setState(ctx.from.id, stateManager.STATE.AWAITING_REQ_LOCATION);
  const { sendLocationSelection } = require('../views/FormView');
  return sendLocationSelection(ctx, '✅ تم استلام الصورة بنجاح.\nالخطوة التالية: تحديد منطقتك وعنوانك\n\nالآن يرجى تحديد منطقتك الرئيسية:');
}

async function handleReceivePhoto(ctx) {
  const photos = ctx.message.photo;
  if (!photos || photos.length === 0) {
    return ctx.reply('❌ لم أتمكن من استلام الصورة. الرجاء المحاولة مرة أخرى.');
  }
  const fileId = photos[photos.length - 1].file_id;
  stateManager.setData(ctx.from.id, { photo_file_id: fileId });
  stateManager.setState(ctx.from.id, stateManager.STATE.AWAITING_REQ_LOCATION);

  const { sendLocationSelection } = require('../views/FormView');
  return sendLocationSelection(ctx, '✅ تم استلام الصورة بنجاح.\nالخطوة التالية: تحديد منطقتك وعنوانك\n\nالآن يرجى تحديد منطقتك الرئيسية:');
}

async function handleLocationSelection(ctx, location) {
  const { sendSubAreaSelection, LOCATIONS } = require('../views/FormView');

  // Find the matched location object
  const locObj = LOCATIONS.find(l => l.value === location);
  stateManager.setData(ctx.from.id, { location });

  if (locObj && locObj.subAreas && locObj.subAreas.length > 0) {
    // Ask for sub-area
    stateManager.setState(ctx.from.id, stateManager.STATE.AWAITING_REQ_SUBAREA);
    return sendSubAreaSelection(ctx, location);
  }

  // No sub-areas, go straight to detailed address
  stateManager.setState(ctx.from.id, stateManager.STATE.AWAITING_REQ_DETAILED_ADDR);
  return ctx.reply(
    `📍 *المنطقة:* ${location}\n\n✍️ يرجى كتابة عنوانك بالتفصيل مع أقرب معلم معروف ليسهل على مقدم الخدمة الوصول إليك.\n\nمثال: الشارع، الحي، أقرب مسجد، مدرسة، دوار، متجر...`,
    { parse_mode: 'Markdown' }
  );
}

async function handleSubAreaSelection(ctx, subArea, mainLocation) {
  stateManager.setData(ctx.from.id, { sub_area: subArea });
  stateManager.setState(ctx.from.id, stateManager.STATE.AWAITING_REQ_DETAILED_ADDR);
  return ctx.reply(
    `📍 *المنطقة:* ${mainLocation} - ${subArea}\n\n✍️ يرجى كتابة عنوانك بالتفصيل مع أقرب معلم معروف ليسهل على مقدم الخدمة الوصول إليك.\n\nمثال: الشارع، الحي، أقرب مسجد، مدرسة، دوار، متجر...`,
    { parse_mode: 'Markdown' }
  );
}

async function handleDetailedAddress(ctx, text) {
  const data = stateManager.getData(ctx.from.id);
  const category = data.selected_category;
  const location = data.location;
  const subArea = data.sub_area || null;
  const fullLocation = subArea ? `${location} - ${subArea}` : location;
  const problemDesc = data.problem_desc || `طلب صيانة: ${category}`;
  const detailedAddress = text;

  if (!category || !location) {
    stateManager.resetAll(ctx.from.id);
    return ctx.reply('⚠️ بيانات ناقصة. الرجاء البدء من جديد.', {
      ...require('telegraf').Markup.inlineKeyboard([
        [require('telegraf').Markup.button.callback('🏠 القائمة الرئيسية', 'back_main')],
      ]),
    });
  }

  try {
    const firstName = ctx.from?.first_name || 'مستخدم';
    const lastName = ctx.from?.last_name || '';
    const telegramName = `${firstName} ${lastName}`.trim();

    const [user] = await User.findOrCreate({
      where: { user_id: ctx.from.id },
      defaults: {
        user_id: ctx.from.id,
        full_name: telegramName,
        phone_number: '—',
        location,
      },
    });

    const updates = {};
    if (user.location !== location) updates.location = location;
    if (Object.keys(updates).length > 0) await user.update(updates);

    const request = await Request.create({
      client_id: ctx.from.id,
      extracted_category: category,
      location: fullLocation,
      detailed_address: detailedAddress,
      problem_description: problemDesc,
      status: 'pending',
      photo_file_id: data.photo_file_id || null,
    });

    stateManager.resetAll(ctx.from.id);

    const { displayCategory } = require('../views/FormView');
    const reqId = request.request_id;

    // Show success message
    await ctx.reply(
      `✅ *تم إرسال طلبك بنجاح!*\n\nشكراً لك، تم استلام طلبك بنجاح.\nسيتم مراجعته من قبل فريقنا ومقدم الخدمة المناسب، وسنتواصل معك قريباً لتأكيد الموعد.\n\nيمكنك متابعة حالة طلبك من خلال /طلباتي`,
      { parse_mode: 'Markdown' }
    );

    // Show summary
    await ctx.reply(
      `📋 *ملخص طلبك*
━━━━━━━━━━━━━━━━━━
🔧 *نوع الخدمة:* ${displayCategory(category)}
📝 *وصف المشكلة:* ${problemDesc.substring(0, 100)}
${data.photo_file_id ? '🖼 *الصورة المرفقة:* ✅\n' : ''}📍 *العنوان:* ${fullLocation}
🏠 *التفاصيل:* ${detailedAddress}
━━━━━━━━━━━━━━━━━━

ℹ️ ستصلك رسالة عند قبول الطلب وتأكيد الموعد.`,
      {
        parse_mode: 'Markdown',
        ...require('telegraf').Markup.inlineKeyboard([
          [require('telegraf').Markup.button.callback('📋 طلباتي', 'my_requests'), require('telegraf').Markup.button.callback('+ خدمة جديدة', 'new_request')],
        ]),
      }
    );

    // Notify technicians
    try {
      const matchedTechs = await Technician.findAll({
        where: { category, location: { [require('sequelize').Op.like]: `%${location.split(' ')[0]}%` }, status: 'approved' },
      });

      const notificationData = {
        request_id: request.request_id,
        client_name: user.full_name || telegramName,
        extracted_category: category,
        location: fullLocation,
        detailed_address: detailedAddress,
        problem_description: problemDesc.substring(0, 300),
        photo_file_id: data.photo_file_id || null,
      };

      if (matchedTechs.length === 0) {
        // Try broader search
        const allTechs = await Technician.findAll({ where: { category, status: 'approved' } });
        for (const tech of allTechs) {
          try {
            const techCtx = { telegram: ctx.telegram, from: { id: Number(tech.tech_id) } };
            await sendJobNotification(techCtx, notificationData);
          } catch (e) { /* tech hasn't started bot */ }
        }
        return;
      }

      for (const tech of matchedTechs) {
        try {
          const techCtx = { telegram: ctx.telegram, from: { id: Number(tech.tech_id) } };
          await sendJobNotification(techCtx, notificationData);
        } catch (notifyErr) {
          console.warn('[RequestController] notify failed for tech', tech.tech_id, ':', notifyErr.message);
        }
      }
    } catch (notifyErr) {
      console.error('[RequestController] Tech notify error:', notifyErr.message);
    }
  } catch (err) {
    console.error('[RequestController] handleDetailedAddress error:', err.message, err.stack);
    return ctx.reply('❌ حدث خطأ أثناء تقديم الطلب. الرجاء المحاولة لاحقاً.');
  }
}

async function handleTechSelection(ctx, requestId, techId) {
  try {
    const request = await Request.findByPk(requestId);
    if (!request || request.status !== 'pending') {
      return ctx.reply('⚠️ هذا الطلب لم يعد متاحاً.');
    }

    if (request.tech_id) {
      return ctx.reply('ℹ️ تم اختيار فني لهذا الطلب مسبقاً.');
    }

    const tech = await Technician.findByPk(techId);
    if (!tech) {
      return ctx.reply('⚠️ لم يتم العثور على الفني.');
    }

    const techChatId = Number(tech.tech_id);
    if (!techChatId || isNaN(techChatId)) {
      return ctx.reply('❌ معرف الفني غير صالح.');
    }

    const client = await User.findByPk(request.client_id);
    const notificationData = {
      request_id: request.request_id,
      client_name: client ? client.full_name : 'مستخدم',
      extracted_category: request.extracted_category,
      location: request.location,
      detailed_address: request.detailed_address,
      problem_description: (request.problem_description || '').substring(0, 300),
      photo_file_id: request.photo_file_id || null,
    };

    const techCtx = { telegram: ctx.telegram, from: { id: techChatId } };
    try {
      await sendJobNotification(techCtx, notificationData);
    } catch (notifyErr) {
      console.error('[RequestController] notify failed:', notifyErr.message);
      return ctx.reply(`❌ لم يتم إرسال الإشعار للفني ${tech.full_name}. قد لا يكون الفني قد بدأ استخدام البوت بعد.`);
    }

    request.tech_id = techChatId;
    await request.save();

    const { displayCategory } = require('../views/FormView');
    const avg = Number(tech.rating_avg);
    const ratingStar = avg > 0 ? ` ⭐${avg.toFixed(1)}` : '';
    return ctx.reply(
      `👨‍🔧 تم إرسال طلبك إلى الفني *${tech.full_name}*${ratingStar}.\nسيتم إشعارك عند قبوله.`,
      { parse_mode: 'Markdown' }
    );
  } catch (err) {
    console.error('[RequestController] handleTechSelection error:', err.message, err.stack);
    return ctx.reply('❌ حدث خطأ. الرجاء المحاولة لاحقاً.');
  }
}

module.exports = {
  handleTextMessage,
  handleVoiceMessage,
  handleCategorySelection,
  handleLocationSelection,
  handleSubAreaSelection,
  handleDetailedAddress,
  handleTechSelection,
  handleGeneralAI,
  handleSkipPhoto,
  handleReceivePhoto,
};
