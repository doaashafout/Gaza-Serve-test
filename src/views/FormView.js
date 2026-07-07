const { Markup } = require('telegraf');
const { Category } = require('../Models');

// Gaza geographical areas - main governorates
const MAIN_REGIONS = [
  '🏙️ شمال غزة',
  '🏢 مدينة غزة',
  '🏞️ الوسطى',
  '🏘️ خانيونس',
  '🚩 رفح',
];

// Sub-regions for each main region (used as choice values, not display)
const SUB_REGIONS = {
  '🏙️ شمال غزة': ['بيت لاهيا', 'بيت حانون', 'جباليا', 'مشروع بيت لاهيا'],
  '🏢 مدينة غزة': ['الرمال', 'الشجاعية', 'التفاح', 'الزيتون', 'تل الهوى', 'النصر', 'الصبرة'],
  '🏞️ الوسطى': ['النصيرات', 'الزوايدة', 'دير البلح', 'المغازي', 'البريج'],
  '🏘️ خانيونس': ['خانيونس المدينة', 'بني سهيلا', 'عبسان الكبيرة', 'عبسان الجديدة', 'القرارة'],
  '🚩 رفح': ['رفح المدينة', 'حي تل السلطان', 'الشوكة', 'مخيم رفح'],
};

// Time slot mapping: slug → display text
const TIME_SLOTS = {
  '08_10': '08:00 - 10:00 صباحاً',
  '10_12': '10:00 - 12:00 ظهراً',
  '12_14': '12:00 - 02:00 مساءً',
  '14_16': '02:00 - 04:00 مساءً',
  '16_18': '04:00 - 06:00 مساءً',
};

// Clean mapping without emoji for DB storage
const MAIN_REGIONS_CLEAN = {
  '🏙️ شمال غزة': 'شمال غزة',
  '🏢 مدينة غزة': 'مدينة غزة',
  '🏞️ الوسطى': 'الوسطى',
  '🏘️ خانيونس': 'خانيونس',
  '🚩 رفح': 'رفح',
};

let _categoriesCache = null;
let _categoriesCleanCache = null;
let _emojiMapCache = null;

function _useDefaults() {
  _categoriesCache = ['🧹 التنظيف', '⚡ الكهرباء', '🚰 السباكة', '🔧 الصيانة العامة', '☀️ الطاقة الشمسية', '🏗️ الترميم والبناء', '🪟 الألومنيوم والحدادة', '🚚 نقل وتركيب الأثاث'];
  _categoriesCleanCache = ['التنظيف', 'الكهرباء', 'السباكة', 'الصيانة العامة', 'الطاقة الشمسية', 'الترميم والبناء', 'الألومنيوم والحدادة', 'نقل وتركيب الأثاث'];
  _emojiMapCache = { 'التنظيف': '🧹', 'الكهرباء': '⚡', 'السباكة': '🚰', 'الصيانة العامة': '🔧', 'الطاقة الشمسية': '☀️', 'الترميم والبناء': '🏗️', 'الألومنيوم والحدادة': '🪟', 'نقل وتركيب الأثاث': '🚚' };
}

(async () => {
  try {
    const cats = await Category.findAll({ order: [['name_ar', 'ASC']] });
    if (cats.length === 0) { _useDefaults(); return; }
    _categoriesCache = cats.map(c => `${c.icon || '🔧'} ${c.name_ar}`);
    _categoriesCleanCache = cats.map(c => c.name_ar);
    _emojiMapCache = {};
    cats.forEach(c => { _emojiMapCache[c.name_ar] = c.icon || '🔧'; });
  } catch (_) {
    _useDefaults();
  }
})();

function getCategories() {
  if (!_categoriesCache) _useDefaults();
  return _categoriesCache;
}

function getCategoriesClean() {
  if (!_categoriesCleanCache) _useDefaults();
  return _categoriesCleanCache;
}

function getEmojiMap() {
  if (!_emojiMapCache) _useDefaults();
  return _emojiMapCache;
}

function cleanCategory(cat) {
  const clean = getCategoriesClean();
  for (const c of clean) {
    if (cat.includes(c)) return c;
  }
  return cat.replace(/[^\u0600-\u06FF\s]/g, '').trim();
}

function displayCategory(cat) {
  const emoji = getEmojiMap()[cat] || '';
  return emoji ? `${emoji} ${cat}` : cat;
}

// Send main region selection via inline keyboard (Step 2)
function sendMainRegionSelection(ctx, text) {
  const buttons = MAIN_REGIONS.map((r) => [Markup.button.callback(r, `mainregion_${r}`)]);
  return ctx.reply(text || 'الآن، يرجى تحديد منطقتك لتقديم الخدمة.\nاختر المنطقة الرئيسية:', {
    reply_markup: {
      remove_keyboard: true,
      inline_keyboard: buttons,
    },
  });
}

// Send sub-region selection via inline keyboard (Step 3)
function sendSubRegionSelection(ctx, mainRegion) {
  const subRegions = SUB_REGIONS[mainRegion] || [];
  if (subRegions.length === 0) {
    // No sub-regions, go directly to address
    return null;
  }
  const buttons = [];
  for (let i = 0; i < subRegions.length; i += 2) {
    const row = [Markup.button.callback(`📍 ${subRegions[i]}`, `subregion_${subRegions[i]}`)];
    if (subRegions[i + 1]) row.push(Markup.button.callback(`📍 ${subRegions[i + 1]}`, `subregion_${subRegions[i + 1]}`));
    buttons.push(row);
  }
  return ctx.reply('اختر المنطقة الفرعية:', {
    ...Markup.inlineKeyboard(buttons),
  });
}

// Date/time selection (Step 5)
function sendDateTimeSelection(ctx) {
  return ctx.reply('✅ تم حفظ عنوانك بنجاح.\n\nالخطوة التالية: اختيار التاريخ والوقت المناسبين للخدمة.', {
    ...Markup.inlineKeyboard([
      [Markup.button.callback('اليوم', 'date_اليوم')],
      [Markup.button.callback('غداً', 'date_غداً')],
      [Markup.button.callback('بعد غد', 'date_بعد غد')],
    ]),
  });
}

function sendTimeSelection(ctx, date) {
  return ctx.reply(`اختر الوقت المناسب (${date}):`, {
    ...Markup.inlineKeyboard([
      [Markup.button.callback('08:00 - 10:00 صباحاً', 'time_08_10')],
      [Markup.button.callback('10:00 - 12:00 ظهراً', 'time_10_12')],
      [Markup.button.callback('12:00 - 02:00 مساءً', 'time_12_14')],
      [Markup.button.callback('02:00 - 04:00 مساءً', 'time_14_16')],
      [Markup.button.callback('04:00 - 06:00 مساءً', 'time_16_18')],
    ]),
  });
}

// Show request summary before final confirmation
function sendRequestSummary(ctx, data) {
  const categoryDisplay = displayCategory(data.selected_category);
  const subServiceStr = data.sub_service ? ` (${data.sub_service})` : '';
  const desc = data.problem_desc || '—';
  const photoStatus = data.photo_file_id ? '✅ موجودة' : '—';
  const regionStr = data.main_region || '';
  const subRegionStr = data.sub_region ? ` - ${data.sub_region}` : '';
  const addrStr = data.detailed_address ? ` | ${data.detailed_address}` : '';
  const address = `${regionStr}${subRegionStr}${addrStr}` || '—';
  const dateVal = data.selected_date || '—';
  const timeVal = data.selected_time || '—';

  const text = `✅ تم حفظ الموعد بنجاح.

قبل إرسال طلبك، يرجى مراجعة ملخص الطلب التالي والتأكد من صحة البيانات.

📋 *ملخص طلب الخدمة*

*نوع الخدمة:* ${categoryDisplay}${subServiceStr}
*وصف المشكلة:* ${desc}
*الصورة المرفقة:* ${photoStatus}
*العنوان:* ${address}
*التاريخ:* ${dateVal}
*الوقت:* ${timeVal}

يرجى التأكد من صحة جميع البيانات قبل الإرسال.`;

  return ctx.replyWithMarkdown(text, {
    reply_markup: {
      remove_keyboard: true,
      inline_keyboard: [
        [{ text: '🖊️ تعديل نوع الخدمة', callback_data: 'edit_category' },
         { text: '🖊️ تعديل الوصف', callback_data: 'edit_desc' }],
        [{ text: '🖊️ تعديل الصورة', callback_data: 'edit_photo' },
         { text: '🖊️ تعديل العنوان', callback_data: 'edit_address' }],
        [{ text: '🖊️ تعديل التاريخ', callback_data: 'edit_date' },
         { text: '🖊️ تعديل الوقت', callback_data: 'edit_time' }],
        [{ text: '✅ تأكيد وإرسال الطلب', callback_data: 'confirm_submit' }],
        [{ text: '🔄 تعديل البيانات بالكامل', callback_data: 'edit_all' }],
      ],
    },
  });
}

function sendLocationSelection(ctx, text = 'اختر منطقتك:') {
  const buttons = MAIN_REGIONS.map((r, i) => [Markup.button.callback(r, `loc_${i}`)]);
  return ctx.reply(text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons),
  });
}

function sendCategorySelection(ctx, text = 'اختر تخصص الخدمة المطلوبة:') {
  const cats = getCategories();
  const buttons = cats.map((c, i) => [Markup.button.callback(c, `cat_${i}`)]);
  return ctx.reply(text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons),
  });
}

// Refresh cache every 60 seconds
setInterval(() => {
  (async () => {
    try {
      const cats = await Category.findAll({ order: [['name_ar', 'ASC']] });
      if (cats.length === 0) { _useDefaults(); return; }
      _categoriesCache = cats.map(c => `${c.icon || '🔧'} ${c.name_ar}`);
      _categoriesCleanCache = cats.map(c => c.name_ar);
      _emojiMapCache = {};
      cats.forEach(c => { _emojiMapCache[c.name_ar] = c.icon || '🔧'; });
    } catch (_) {
      _useDefaults();
    }
  })();
}, 60000);

function sendTechnicianRegistrationForm(ctx) {
  return ctx.reply('📝 *تسجيل فني جديد*\n\n'
    + 'الرجاء إدخال اسمك الثلاثي (مثال: محمد أحمد علي):', { parse_mode: 'Markdown' });
}

function sendRatingSelection(ctx, requestId) {
  const buttons = [];
  for (let i = 1; i <= 5; i++) {
    buttons.push([Markup.button.callback('⭐'.repeat(i), `rate_${requestId}_${i}`)]);
  }
  buttons.push([Markup.button.callback('⏭️ تخطي التقييم', `skip_rate_${requestId}`)]);
  return ctx.reply('🎉 *تم إكمال الطلب!*\n\nقم بتقييم الخدمة:', {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons),
  });
}

module.exports = {
  cleanCategory,
  displayCategory,
  sendCategorySelection,
  sendLocationSelection,
  sendTechnicianRegistrationForm,
  sendRatingSelection,
  sendMainRegionSelection,
  sendSubRegionSelection,
  sendDateTimeSelection,
  sendTimeSelection,
  sendRequestSummary,
  getCategories,
  getCategoriesClean,
  MAIN_REGIONS,
  MAIN_REGIONS_CLEAN,
  SUB_REGIONS,
  TIME_SLOTS,
  LOCATIONS: MAIN_REGIONS,
};
