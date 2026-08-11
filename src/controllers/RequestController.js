const { User, Technician, Request } = require('../Models');
const stateManager = require('../middlewares/stateManager');
const apiConfig = require('../config/api');
const { sendJobNotification } = require('../views/NotificationView');
const { extractWithAI, callOpenAIWithRetry, AI_SYSTEM_PROMPT, AI_FUNCTIONS } = require('../services/openaiService');

async function handleTextMessage(ctx, text) {
  const state = stateManager.getState(ctx.from.id);

  switch (state) {
    case stateManager.STATE.AWAITING_REQ_DESC: {
      return handleProblemDescription(ctx, text);
    }
    case stateManager.STATE.AWAITING_REQ_DETAILED_ADDR: {
      return handleDetailedAddress(ctx, text);
    }
    case stateManager.STATE.AWAITING_REQ_PHONE: {
      return handleClientPhone(ctx, text);
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
      if (text.startsWith('/')) {
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

// Step 1: User selected a category/sub-service → ask problem description
async function handleCategorySelection(ctx, category) {
  const { displayCategory } = require('../views/FormView');
  const data = stateManager.getData(ctx.from.id);
  // Keep parent category if already set (from submenu), otherwise use this
  if (!data.selected_category) {
    stateManager.setData(ctx.from.id, { selected_category: category });
  }
  stateManager.setState(ctx.from.id, stateManager.STATE.AWAITING_REQ_DESC);
  return ctx.reply(`*خدمة ${displayCategory(category)}*\n\nيرجى وصف المشكلة التي تواجهها بالتفصيل\nلنتمكن من إرسال طلبك للمشرف بدقة.`, {
    parse_mode: 'Markdown',
  });
}

// Step 1b: After problem description → ask for photo (optional)
// If return_to_summary flag is set, go back to summary after saving
async function handleProblemDescription(ctx, text) {
  const { Markup } = require('telegraf');
  const data = stateManager.getData(ctx.from.id);
  stateManager.setData(ctx.from.id, { problem_desc: text });
  if (data.return_to_summary) {
    stateManager.setData(ctx.from.id, { return_to_summary: undefined });
    const { sendRequestSummary } = require('../views/FormView');
    return sendRequestSummary(ctx, { ...stateManager.getData(ctx.from.id), problem_desc: text });
  }
  stateManager.setState(ctx.from.id, stateManager.STATE.AWAITING_REQ_PHOTO);
  return ctx.reply('شكراً لك.\nلتحسين فهم المشكلة ومساعدة مقدم الخدمة\nبشكل أسرع، يرجى إرسال صورة توضح المشكلة.', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '⏭️ تخطي', callback_data: 'skip_photo' }],
      ],
    },
  });
}

// Step 2: User selected a main region from reply keyboard
async function handleMainRegionSelection(ctx, mainRegion) {
  const { MAIN_REGIONS_CLEAN, sendSubRegionSelection } = require('../views/FormView');
  stateManager.setData(ctx.from.id, { main_region: MAIN_REGIONS_CLEAN[mainRegion] || mainRegion });
  stateManager.setState(ctx.from.id, stateManager.STATE.AWAITING_REQ_SUB_REGION);

  await ctx.reply(`✅ تم اختيار: ${mainRegion}`);

  const { SUB_REGIONS } = require('../views/FormView');
  const subs = SUB_REGIONS[mainRegion];
  if (!subs || subs.length === 0) {
    // No sub-regions, go directly to address
    stateManager.setState(ctx.from.id, stateManager.STATE.AWAITING_REQ_DETAILED_ADDR);
    return ctx.reply('يرجى كتابة عنوانك بالتفصيل مع أقرب معلم معروف لتسهيل الوصول إليك.\nمثال: الصبرة - شارع الثلاثيني - بجانب مدرسة فلسطين.');
  }
  return sendSubRegionSelection(ctx, mainRegion);
}

// Step 3: User selected a sub-region from inline keyboard
async function handleSubRegionSelection(ctx, subRegion) {
  const { Markup } = require('telegraf');
  stateManager.setData(ctx.from.id, { sub_region: subRegion });
  stateManager.setState(ctx.from.id, stateManager.STATE.AWAITING_REQ_DETAILED_ADDR);
  await ctx.reply(`✅ تم اختيار: ${subRegion}`, { ...Markup.removeKeyboard() });
  return ctx.reply('يرجى كتابة عنوانك بالتفصيل مع أقرب معلم معروف لتسهيل الوصول إليك.\nمثال: الصبرة - شارع الثلاثيني - بجانب مدرسة فلسطين.');
}

// Step 4: User typed detailed address → confirm + ask phone (for technician contact after acceptance)
async function handleDetailedAddress(ctx, text) {
  stateManager.setData(ctx.from.id, { detailed_address: text });
  stateManager.setState(ctx.from.id, stateManager.STATE.AWAITING_REQ_PHONE);
  return ctx.reply('📱 *رقم هاتفك للتواصل:*\n\nشارك رقمك مباشرة أو اكتبه (مثال: 0599XXXXXX).\n\n🔒 هذا الرقم سيظهر للفني فقط *بعد* قبوله لطلبك.', {
    parse_mode: 'Markdown',
    reply_markup: {
      keyboard: [[{ text: '📲 مشاركة رقمي مباشرة', request_contact: true }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  });
}

// Step 4b: Client phone number (contact sharing or manual entry)
async function handleClientPhone(ctx, text) {
  const { Markup } = require('telegraf');
  const raw = String(text || '').trim();
  const phone = raw.replace(/^\+/, '').replace(/[\s\-\(\)]+/g, '');
  const clean = phone
    .replace(/^(00972|00970|0097)/, '970')
    .replace(/^0/, '970')
    .replace(/^972(?=5[69])/, '970');
  const local = clean.replace(/^970/, '0');
  const valid = /^05[69]\d{7}$/.test(local) || /^9705[69]\d{7}$/.test(clean);
  if (!valid) {
    return ctx.reply('❌ رقم الهاتف غير صحيح. يرجى إدخال رقم فلسطيني صحيح يبدأ بـ 059 أو 056.');
  }

  stateManager.setData(ctx.from.id, { client_phone: clean });
  const data = stateManager.getData(ctx.from.id);
  if (data.return_to_summary) {
    stateManager.setData(ctx.from.id, { return_to_summary: undefined });
    const { sendRequestSummary } = require('../views/FormView');
    return sendRequestSummary(ctx, stateManager.getData(ctx.from.id));
  }

  stateManager.setState(ctx.from.id, stateManager.STATE.AWAITING_REQ_DATE);
  const { sendDateTimeSelection } = require('../views/FormView');
  await ctx.reply('✅ تم حفظ رقم الهاتف.', Markup.removeKeyboard());
  return sendDateTimeSelection(ctx);
}

// Step 5: User selected date → ask time
async function handleDateSelection(ctx, date) {
  stateManager.setData(ctx.from.id, { selected_date: date });
  const { sendTimeSelection } = require('../views/FormView');
  return sendTimeSelection(ctx, date);
}

// Step 5b: User selected time → save & show summary (do NOT submit yet)
async function handleTimeSelection(ctx, timeSlug) {
  const { TIME_SLOTS, sendRequestSummary } = require('../views/FormView');
  const timeDisplay = TIME_SLOTS[timeSlug] || timeSlug;
  const state = stateManager.getState(ctx.from.id);

  // If not in request flow, check for pending request to update time
  if (state !== stateManager.STATE.AWAITING_REQ_DATE) {
    const { Request } = require('../Models');
    const existing = await Request.findOne({ where: { client_id: ctx.from.id, status: 'pending' }, order: [['created_at', 'DESC']] });
    if (!existing) return ctx.reply('❌ لا يوجد طلب قيد الانتظار لتعديل الوقت.');
    const match = existing.problem_description.match(/الموعد: ([^|]*)/);
    const currentDate = match ? match[1].split(' - ')[0].trim() : '';
    const newDateTime = currentDate ? `${currentDate} - ${timeDisplay}` : timeDisplay;
    const oldDesc = existing.problem_description;
    const updatedDesc = oldDesc.replace(/ \| الموعد: [^|]*/, ` | الموعد: ${newDateTime}`);
    existing.problem_description = updatedDesc.includes('| الموعد:') ? updatedDesc : `${oldDesc} | الموعد: ${newDateTime}`;
    await existing.save();
    return ctx.reply(`✅ تم تغيير الوقت بنجاح.\n🕐 الوقت الجديد: ${timeDisplay}`);
  }

  stateManager.setData(ctx.from.id, { selected_time: timeDisplay });
  const data = stateManager.getData(ctx.from.id);
  return sendRequestSummary(ctx, data);
}

// Step 5c (new): User confirmed → create request & submit
async function handleConfirmSubmission(ctx) {
  const data = stateManager.getData(ctx.from.id);
  const category = data.selected_category;
  const subService = data.sub_service;
  const location = `${data.main_region}${data.sub_region ? ` - ${data.sub_region}` : ''}`;
  const fullName = ctx.from.first_name || 'مستخدم';
  const detailedAddress = data.detailed_address || '';
  const dateTimeStr = `${data.selected_date || ''} ${data.selected_time || ''}`.trim();
  const serviceLabel = subService || category;
  const userDesc = data.problem_desc ? `\n📝 وصف المشكلة: ${data.problem_desc}` : '';
  const problemDesc = `طلب صيانة: ${serviceLabel} في ${location}${userDesc}` + (dateTimeStr ? ` | الموعد: ${dateTimeStr}` : '');

  let photoPublicId = null;
  if (data.photo_file_id) {
    try {
      const { uploadFromTelegram } = require('../services/cloudinary');
      const result = await uploadFromTelegram(data.photo_file_id);
      photoPublicId = result.public_id;
      console.log(`[Cloudinary] Uploaded request photo: ${result.public_id}`);
    } catch (err) {
      console.warn('[Cloudinary] Upload failed for request photo:', err.message);
    }
  }

  try {
    const [user] = await User.findOrCreate({
      where: { user_id: ctx.from.id },
      defaults: {
        user_id: ctx.from.id,
        full_name: fullName,
        location,
        phone_number: data.client_phone || null,
      },
    });
    const updates = {};
    if (user.location !== location) updates.location = location;
    if (user.full_name !== fullName) updates.full_name = fullName;
    if (data.client_phone && user.phone_number !== data.client_phone) updates.phone_number = data.client_phone;
    if (Object.keys(updates).length > 0) await user.update(updates);

    const request = await Request.create({
      client_id: ctx.from.id,
      extracted_category: category,
      location,
      detailed_address: detailedAddress,
      problem_description: problemDesc,
      photo_file_id: data.photo_file_id || null,
      photo_url: photoPublicId,
      status: 'pending',
    });

    stateManager.resetAll(ctx.from.id);

    const { Markup: M } = require('telegraf');
    await ctx.reply(`✅ *تم تقديم طلبك بنجاح!*
ستصلك رسالة عند قبول الطلب وتأكيد الموعد.`, { parse_mode: 'Markdown', ...M.removeKeyboard() });

    const { distributeOrder } = require('../services/orderDistributor');
    distributeOrder(ctx.telegram, request, apiConfig.ADMIN_ID).catch((err) => {
      console.error('[RequestController] distributeOrder error:', err.message);
    });
  } catch (err) {
    console.error('[RequestController] handleConfirmSubmission error:', err.message, err.stack);
    return ctx.reply('❌ حدث خطأ أثناء تقديم الطلب. الرجاء المحاولة لاحقاً.');
  }
}

// Step 6: Edit a specific field during review
async function handleEditField(ctx, field) {
  switch (field) {
    case 'category': {
      stateManager.clearData(ctx.from.id);
      stateManager.setState(ctx.from.id, stateManager.STATE.IDLE);
      const { sendCategorySelection } = require('../views/FormView');
      return sendCategorySelection(ctx, '✏️ اختر نوع الخدمة الجديد:');
    }
    case 'desc': {
      stateManager.setData(ctx.from.id, { problem_desc: undefined, return_to_summary: true });
      stateManager.setState(ctx.from.id, stateManager.STATE.AWAITING_REQ_DESC);
      return ctx.reply('✏️ يرجى كتابة وصف المشكلة بالتفصيل:');
    }
    case 'photo': {
      const { Markup } = require('telegraf');
      stateManager.setData(ctx.from.id, { photo_file_id: undefined, return_to_summary: true });
      stateManager.setState(ctx.from.id, stateManager.STATE.AWAITING_REQ_PHOTO);
      return ctx.reply('📷 يرجى إرسال صورة توضح المشكلة:', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '⏭️ تخطي', callback_data: 'skip_photo' }],
          ],
        },
      });
    }
    case 'address': {
      stateManager.setData(ctx.from.id, {
        main_region: undefined, sub_region: undefined,
        detailed_address: undefined, selected_date: undefined, selected_time: undefined,
      });
      stateManager.setState(ctx.from.id, stateManager.STATE.AWAITING_REQ_MAIN_REGION);
      const { sendMainRegionSelection } = require('../views/FormView');
      return sendMainRegionSelection(ctx, '✏️ اختر المنطقة الجديدة:');
    }
    case 'date': {
      stateManager.setData(ctx.from.id, { selected_date: undefined, selected_time: undefined });
      stateManager.setState(ctx.from.id, stateManager.STATE.AWAITING_REQ_DATE);
      const { sendDateTimeSelection } = require('../views/FormView');
      return sendDateTimeSelection(ctx);
    }
    case 'time': {
      stateManager.setData(ctx.from.id, { selected_time: undefined });
      stateManager.setState(ctx.from.id, stateManager.STATE.AWAITING_REQ_DATE);
      const { sendDateTimeSelection } = require('../views/FormView');
      return sendDateTimeSelection(ctx);
    }
    case 'phone': {
      const { Markup } = require('telegraf');
      stateManager.setData(ctx.from.id, { client_phone: undefined, return_to_summary: true });
      stateManager.setState(ctx.from.id, stateManager.STATE.AWAITING_REQ_PHONE);
      return ctx.reply('✏️ يرجى إرسال رقم هاتفك الجديد أو مشاركته مباشرة:', {
        reply_markup: {
          keyboard: [[{ text: '📲 مشاركة رقمي مباشرة', request_contact: true }]],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      });
    }
    case 'all': {
      stateManager.clearData(ctx.from.id);
      stateManager.setState(ctx.from.id, stateManager.STATE.IDLE);
      const { sendCategorySelection } = require('../views/FormView');
      return sendCategorySelection(ctx, '✏️ اختر نوع الخدمة:');
    }
    default:
      return ctx.reply('❌ خيار غير صالح.');
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
      photo_file_id: request.photo_file_id || null,
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
    return ctx.reply(`👨‍🔧 تم إرسال طلبك إلى الفني *${tech.full_name}*.\nسيتم إشعارك عند قبوله.`, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('[RequestController] handleTechSelection error (req=%s, tech=%s):', requestId, techId, err.message, err.stack);
    return ctx.reply('❌ حدث خطأ. الرجاء المحاولة لاحقاً.');
  }
}

// Step 1c: Skip photo → proceed to region or back to summary
async function handleSkipPhoto(ctx) {
  const data = stateManager.getData(ctx.from.id);
  if (data.return_to_summary) {
    stateManager.setData(ctx.from.id, { return_to_summary: undefined });
    const { sendRequestSummary } = require('../views/FormView');
    return sendRequestSummary(ctx, { ...stateManager.getData(ctx.from.id) });
  }
  stateManager.setState(ctx.from.id, stateManager.STATE.AWAITING_REQ_MAIN_REGION);
  const { sendMainRegionSelection } = require('../views/FormView');
  return sendMainRegionSelection(ctx);
}

module.exports = {
  handleTextMessage,
  handleVoiceMessage,
  handleCategorySelection,
  handleMainRegionSelection,
  handleSubRegionSelection,
  handleDetailedAddress,
  handleClientPhone,
  handleDateSelection,
  handleTimeSelection,
  handleConfirmSubmission,
  handleEditField,
  handleTechSelection,
  handleSkipPhoto,
  handleGeneralAI,
};
