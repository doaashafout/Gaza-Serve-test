const { Scenes, Markup } = require('telegraf');
const { validateWithAI, verifyIdDocument } = require('./helpers/aiValidator');
const { Technician } = require('../Models');
const apiConfig = require('../config/api');
const { TECHNICIAN_COMMANDS } = require('../helpers/technicianHelper');
const { getCategories, cleanCategory, SUB_REGIONS } = require('../views/FormView');

const MAIN_REGIONS_DISPLAY = [
  '🏙️ شمال غزة',
  '🏢 مدينة غزة',
  '🌾 الوسطى',
  '🏘️ خانيونس',
  '🚩 رفح',
];

const MAIN_REGIONS_CLEAN = {
  '🏙️ شمال غزة': 'شمال غزة',
  '🏢 مدينة غزة': 'مدينة غزة',
  '🌾 الوسطى': 'الوسطى',
  '🏘️ خانيونس': 'خانيونس',
  '🚩 رفح': 'رفح',
};

const EXPERIENCE_OPTIONS = { labels: [
  '1 سنة',
  '2 سنوات',
  '3 سنوات',
  '4 سنوات',
  '5 سنوات فأكثر',
], values: [1, 2, 3, 4, 5] };

const registrationWizard = new Scenes.WizardScene(
  'tech-registration',

  // Step 0: Full Name prompt
  async (ctx) => {
    ctx.wizard.state = {};
    await ctx.reply(
      '✍️ *الخطوة 1 من 6*\n\nشو اسمك الكامل (ثلاثي)؟',
      { parse_mode: 'Markdown' }
    );
    return ctx.wizard.next();
  },

  // Step 1: Full Name handler
  async (ctx) => {
    if (ctx.message?.text === '/cancel') return cancelRegistration(ctx);
    const text = ctx.message?.text;
    if (!text) return ctx.reply('❌ يرجى إرسال الاسم كنص مكتوب.');
    if (text.startsWith('/') && text !== '/cancel')
      return ctx.reply('⚠️ أنت في مرحلة التسجيل حالياً. الرجاء إرسال اسمك.');
    const validation = await validateWithAI(text, 'name');
    if (!validation.valid)
      return ctx.reply(validation.message + '\n\nيرجى إدخال اسم صحيح.');
    ctx.wizard.state.full_name = text.trim();
    await ctx.reply(`✅ تم حفظ الاسم: ${text.trim()}`);
    await ctx.reply(
      '📱 *الخطوة 2 من 6*\n\nشو رقم هاتفك؟ (يفضل يكون نفس رقم الواتساب حتى يقدر الزباين يتواصلوا معك)',
      {
        parse_mode: 'Markdown',
        reply_markup: {
          keyboard: [[{ text: '📲 مشاركة رقمي مباشرة', request_contact: true }]],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      }
    );
    return ctx.wizard.next();
  },

  // Step 2: Phone Number handler
  async (ctx) => {
    if (ctx.message?.text === '/cancel') return cancelRegistration(ctx);
    if (ctx.message?.text?.startsWith('/') && ctx.message.text !== '/cancel')
      return ctx.reply('⚠️ أنت في مرحلة التسجيل حالياً. الرجاء إرسال رقم هاتفك.');

    let phone = '';
    if (ctx.message?.contact) {
      phone = ctx.message.contact.phone_number.replace(/^\+/, '');
    } else if (ctx.message?.text) {
      phone = ctx.message.text.trim().replace(/[\s\-\(\)\+]+/g, '');
    } else {
      return ctx.reply('❌ يرجى إرسال رقم الهاتف أو استخدام زر المشاركة.');
    }
    const clean = phone
      .replace(/^(00972|00970|0097)/, '970')
      .replace(/^0/, '970')
      .replace(/^972(?=5[69])/, '970');
    const local = clean.replace(/^970/, '0');
    const valid = /^05[69]\d{7}$/.test(local) || /^9705[69]\d{7}$/.test(clean);
    if (!valid)
      return ctx.reply('❌ رقم الهاتف غير صحيح. يرجى إدخال رقم فلسطيني صحيح يبدأ بـ 059 أو 056.');
    ctx.wizard.state.phone_number = clean;
    await ctx.reply('✅ تم حفظ رقم الهاتف.', Markup.removeKeyboard());

    const cats = getCategories();
    const buttons = cats.map((c, i) => [Markup.button.callback(c, `cat_${i}`)]);
    await ctx.reply(
      '🔧 *الخطوة 3 من 6*\n\nشو تخصصك؟ اختار من القائمة:',
      { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) }
    );
    return ctx.wizard.next();
  },

  // Step 3: Category handler
  async (ctx) => {
    if (ctx.message?.text === '/cancel') return cancelRegistration(ctx);
    if (ctx.message?.text?.startsWith('/'))
      return ctx.reply('⚠️ أنت في مرحلة التسجيل حالياً. الرجاء اختيار التخصص من الأزرار.');
    if (!ctx.callbackQuery) return ctx.reply('❌ يرجى اختيار التخصص من الأزرار أعلاه.');
    await ctx.answerCbQuery();
    const data = ctx.callbackQuery.data;
    if (!data.startsWith('cat_')) return ctx.reply('❌ يرجى اختيار التخصص من الأزرار.');
    const index = parseInt(data.split('_')[1]);
    ctx.wizard.state.service = cleanCategory(getCategories()[index]);
    await ctx.reply(`✅ تم اختيار: ${getCategories()[index]}`);

    const regionButtons = MAIN_REGIONS_DISPLAY.map((r, i) =>
      [Markup.button.callback(r, `mreg_${i}`)]
    );
    await ctx.reply(
      '📍 *الخطوة 4 من 6*\n\nوين بتشتغل؟ اختر المنطقة الرئيسية:',
      { parse_mode: 'Markdown', ...Markup.inlineKeyboard(regionButtons) }
    );
    return ctx.wizard.next();
  },

  // Step 4: Region handler (main + sub)
  async (ctx) => {
    if (ctx.message?.text === '/cancel') return cancelRegistration(ctx);
    if (ctx.message?.text?.startsWith('/'))
      return ctx.reply('⚠️ أنت في مرحلة التسجيل حالياً. الرجاء اختيار المنطقة من الأزرار.');
    if (!ctx.callbackQuery) return ctx.reply('❌ يرجى اختيار المنطقة من الأزرار أعلاه.');
    await ctx.answerCbQuery();
    const data = ctx.callbackQuery.data;

    if (data.startsWith('subreg_')) {
      const subIdx = parseInt(data.split('_')[1]);
      const subs = ctx.wizard.state._subs;
      if (subs && subs[subIdx]) {
        ctx.wizard.state.region = ctx.wizard.state._mainRegion + ' - ' + subs[subIdx];
        await ctx.reply(`✅ تم اختيار: ${ctx.wizard.state.region}`);
        return showExperience(ctx);
      }
      return ctx.reply('❌ خيار غير صالح.');
    }

    if (data.startsWith('mreg_')) {
      const index = parseInt(data.split('_')[1]);
      const display = MAIN_REGIONS_DISPLAY[index];
      const cleanName = MAIN_REGIONS_CLEAN[display] || display;
      ctx.wizard.state._mainRegion = cleanName;

      const subs = SUB_REGIONS[display];
      if (subs && subs.length > 0) {
        ctx.wizard.state._subs = subs;
        const subButtons = subs.map((s, i) => [Markup.button.callback(s, `subreg_${i}`)]);
        await ctx.reply(`✅ تم اختيار: ${display}\nاختر المنطقة الفرعية:`, {
          ...Markup.inlineKeyboard(subButtons),
        });
        return;
      }

      ctx.wizard.state.region = cleanName;
      await ctx.reply(`✅ تم اختيار: ${display}`);
      return showExperience(ctx);
    }

    return ctx.reply('❌ يرجى اختيار المنطقة من الأزرار.');
  },

  // Step 5: Experience handler
  async (ctx) => {
    if (ctx.message?.text === '/cancel') return cancelRegistration(ctx);
    if (ctx.message?.text?.startsWith('/'))
      return ctx.reply('⚠️ أنت في مرحلة التسجيل حالياً.');
    if (!ctx.callbackQuery) return ctx.reply('❌ يرجى الاختيار من الأزرار أعلاه.');
    await ctx.answerCbQuery();
    const data = ctx.callbackQuery.data;
    if (!data.startsWith('exp_')) return ctx.reply('❌ يرجى اختيار سنوات الخبرة من الأزرار.');
    const idx = parseInt(data.split('_')[1]);
    ctx.wizard.state.experience = EXPERIENCE_OPTIONS.values[idx];
    ctx.wizard.state.experience_label = EXPERIENCE_OPTIONS.labels[idx];
    await ctx.reply(`✅ تم اختيار: ${EXPERIENCE_OPTIONS[idx]}`);
    await ctx.reply(
      '🪪 *الخطوة 6 من 6*\n\nآخر خطوة! لتوثيق حسابك، بدنا صورة واضحة لبطاقة هويتك.\n\n'
      + '📌 تأكد إنه:\n'
      + '- الصورة واضحة وغير مشوشة\n'
      + '- كل البيانات ظاهرة (الاسم، الرقم، الصورة)\n'
      + '- ما في إضاءة قوية أو ظل عالبطاقة',
      { parse_mode: 'Markdown' }
    );
    return ctx.wizard.next();
  },

  // Step 6: National ID Photo handler
  async (ctx) => {
    if (ctx.message?.text === '/cancel') return cancelRegistration(ctx);
    if (ctx.message?.text?.startsWith('/'))
      return ctx.reply('⚠️ أنت في مرحلة التسجيل حالياً. الرجاء إرسال صورة الهوية.');

    if (ctx.callbackQuery) {
      await ctx.answerCbQuery();
      if (ctx.callbackQuery.data === 'id_retry') {
        await ctx.reply('📷 الرجاء إرسال صورة أخرى للهوية.');
      } else if (ctx.callbackQuery.data === 'cancel') {
        return cancelRegistration(ctx);
      }
      return;
    }

    if (!ctx.message?.photo) return ctx.reply('❌ يرجى إرسال صورة وليس نصاً.');

    const photoFileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
    const statusMsg = await ctx.reply('🔄 جاري التحقق من الهوية... يرجى الانتظار.');
    const verification = await verifyIdDocument(photoFileId, ctx.wizard.state.full_name, ctx.telegram);

    if (!verification.match) {
      try {
        await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, null, '⚠️ ما قدرنا نقرأ بيانات الهوية بوضوح.');
      } catch (_) {}
      await ctx.reply(
        'ممكن ترفع صورة أوضح؟',
        Markup.inlineKeyboard([
          [Markup.button.callback('🔄 إعادة المحاولة', 'id_retry')],
          [Markup.button.callback('❌ إلغاء التسجيل', 'cancel')],
        ])
      );
      return;
    }

    ctx.wizard.state.national_id_file_id = photoFileId;
    ctx.wizard.state.extracted_name = verification.extractedName;
    try {
      await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, null, '✅ تم التحقق من الهوية بنجاح.');
    } catch (_) {}

    const s = ctx.wizard.state;
    const summary =
      '📋 *راجع معلوماتك قبل الإرسال:*\n\n'
      + `👤 *الاسم:* ${s.full_name}\n`
      + `📱 *الهاتف:* ${s.phone_number}\n`
      + `🔧 *التخصص:* ${s.service}\n`
      + `📍 *المنطقة:* ${s.region}\n`
      + `📅 *الخبرة:* ${s.experience_label || s.experience}\n`
      + `🪪 *الهوية:* ✅ تم التحقق\n\n`
      + 'كل شي صحيح؟';
    await ctx.reply(summary, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('✅ تأكيد وإرسال', 'confirm')],
        [Markup.button.callback('✏️ تعديل معلوماتي', 'edit')],
        [Markup.button.callback('❌ إلغاء', 'cancel')],
      ]),
    });
    return ctx.wizard.next();
  },

  // Step 7: Confirm / Edit / Cancel
  async (ctx) => {
    if (ctx.message?.text === '/cancel') return cancelRegistration(ctx);
    if (ctx.message?.text?.startsWith('/'))
      return ctx.reply('⚠️ أنت في مرحلة التسجيل حالياً. الرجاء الاختيار من الأزرار أعلاه.');
    if (!ctx.callbackQuery) return ctx.reply('❌ يرجى الاختيار من الأزرار أعلاه.');
    await ctx.answerCbQuery();
    const data = ctx.callbackQuery.data;

    if (data === 'cancel') return cancelRegistration(ctx);

    if (data === 'edit') {
      ctx.wizard.state = {};
      await ctx.reply('✏️ تم إعادة التشغيل. الرجاء إدخال الاسم من جديد.', Markup.removeKeyboard());
      await ctx.reply(
        '✍️ *الخطوة 1 من 6*\n\nشو اسمك الكامل (ثلاثي)؟',
        { parse_mode: 'Markdown' }
      );
      return ctx.wizard.selectStep(1);
    }

    if (data === 'confirm') {
      const s = ctx.wizard.state;
      let nationalIdPublicId = s.national_id_file_id;
      try {
        const { uploadFromTelegram } = require('../services/cloudinary');
        const result = await uploadFromTelegram(s.national_id_file_id);
        nationalIdPublicId = result.public_id;
        console.log(`[Cloudinary] Uploaded tech ID photo: ${result.public_id}`);
      } catch (err) {
        console.warn('[Cloudinary] Upload failed for tech ID:', err.message);
      }
      try {
        await Technician.create({
          tech_id: ctx.from.id,
          full_name: s.full_name,
          phone_number: s.phone_number,
          category: s.service,
          location: s.region,
          national_id_url: nationalIdPublicId,
          experience_years: s.experience,
          status: 'approved',
        });

        await ctx.reply(
          '🎉 *تم تسجيلك كفني في GazaServe بنجاح!*\n\n'
          + 'أصبح بإمكانك استقبال طلبات الخدمة فور ظهورها حسب تخصصك ومنطقتك.\n\n'
          + 'شكراً لانضمامك! 💚',
          { parse_mode: 'Markdown' }
        );

        if (apiConfig.ADMIN_ID) {
          try {
            await ctx.telegram.sendMessage(
              apiConfig.ADMIN_ID,
              `🆕 *تسجيل فني جديد (تلقائي)*\n\n`
              + `👤 *الاسم:* ${s.full_name}\n`
              + `📞 *الهاتف:* ${s.phone_number}\n`
              + `🔧 *التخصص:* ${s.service}\n`
              + `📍 *المنطقة:* ${s.region}\n`
               + `📅 *الخبرة:* ${s.experience_label || s.experience}\n`
              + `🆔 *الهوية:* ✅\n`
              + `حساب تيليغرام: [${ctx.from.first_name}](tg://user?id=${ctx.from.id})`,
              { parse_mode: 'Markdown' }
            );
          } catch (_) {}
        }

        try {
          await ctx.telegram.setMyCommands(TECHNICIAN_COMMANDS, {
            scope: { type: 'chat', chat_id: ctx.from.id },
          });
        } catch (_) {}
        return ctx.scene.leave();
      } catch (err) {
        console.error('[TechRegistration] Save error:', err?.message || err?.name || 'Unknown');
        if (err?.name === 'SequelizeUniqueConstraintError') {
          await ctx.reply('⚠️ أنت مسجل مسبقاً كفني في النظام.');
        } else if (err?.name?.includes('Sequelize') || err?.message?.includes('connect')) {
          await ctx.reply('❌ قاعدة البيانات غير متصلة. يرجى تشغيل MySQL محلياً أو التحقق من إعدادات .env');
        } else {
          await ctx.reply(`❌ حدث خطأ أثناء حفظ البيانات: ${err?.message || 'خطأ غير معروف'}`);
        }
        return ctx.scene.leave();
      }
    }
  },
);

async function showExperience(ctx) {
  const buttons = EXPERIENCE_OPTIONS.labels.map((o, i) => [Markup.button.callback(o, `exp_${i}`)]);
  await ctx.reply(
    '📅 *الخطوة 5 من 6*\n\nكم سنة خبرة عندك بهاد المجال؟',
    { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) }
  );
  return ctx.wizard.next();
}

async function cancelRegistration(ctx) {
  if (ctx.callbackQuery) await ctx.answerCbQuery();
  await ctx.reply('✅ تم إلغاء التسجيل.', Markup.removeKeyboard());
  return ctx.scene.leave();
}

module.exports = registrationWizard;
