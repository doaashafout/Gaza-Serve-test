const { Markup } = require('telegraf');
const { Category } = require('../Models');

// Gaza geographical areas - main regions
const MAIN_REGIONS = [
  '🏛️ غزة (الشمال)',
  '🏛️ غزة (مدينة غزة)',
  '🏛️ غزة (الوسطى)',
  '🏛️ غزة (الجنوب)',
];

// Sub-regions for each main region (used as choice values, not display)
const SUB_REGIONS = {
  '🏛️ غزة (الشمال)': ['بيت لاهيا', 'بيت حانون', 'الشيخ زايد', 'الكرامة'],
  '🏛️ غزة (مدينة غزة)': ['الشجاعية', 'الرمال', 'النصر', 'الصبرة', 'الدرج', 'الزيتون', 'الشاطئ', 'المغراقة'],
  '🏛️ غزة (الوسطى)': ['النصيرات', 'الزوايدة', 'دير البلح', 'البريج', 'المغازي'],
  '🏛️ غزة (الجنوب)': ['خان يونس', 'رفح', 'القرارة', 'بني سهيلا', 'عبسان', 'النصر'],
};

// Clean mapping without emoji for DB storage
const MAIN_REGIONS_CLEAN = {
  '🏛️ غزة (الشمال)': 'غزة - الشمال',
  '🏛️ غزة (مدينة غزة)': 'غزة - المدينة',
  '🏛️ غزة (الوسطى)': 'غزة - الوسطى',
  '🏛️ غزة (الجنوب)': 'غزة - الجنوب',
};

let _categoriesCache = null;
let _categoriesCleanCache = null;
let _emojiMapCache = null;

function _useDefaults() {
  _categoriesCache = ['🧹 تنظيف منزل', '⚡ كهرباء', '🚰 سباكة', '🛠️ صيانة عامة', '🖌️ دهان'];
  _categoriesCleanCache = ['تنظيف منزل', 'كهرباء', 'سباكة', 'صيانة عامة', 'دهان'];
  _emojiMapCache = { 'تنظيف منزل': '🧹', 'كهرباء': '⚡', 'سباكة': '🚰', 'صيانة عامة': '🛠️', 'دهان': '🖌️' };
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

// Send main region selection via reply keyboard (Step 2)
function sendMainRegionSelection(ctx, text) {
  const keyboard = MAIN_REGIONS.map(r => [r]);
  return ctx.reply(text || 'الآن، يرجى تحديد منطقتك لتقديم الخدمة.\nاختر المنطقة الرئيسية:', Markup.keyboard(keyboard).resize());
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
      [Markup.button.callback('الفترة الصباحية (8 ص - 12 م)', `time_صباح`),
       Markup.button.callback('الفترة المسائية (12 م - 5 م)', `time_مساء`)],
      [Markup.button.callback('الفترة المسائية (5 م - 9 م)', `time_ليلة`),
       Markup.button.callback('أي وقت مناسب', `time_أي وقت`)],
    ]),
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
  getCategories,
  getCategoriesClean,
  MAIN_REGIONS,
  MAIN_REGIONS_CLEAN,
  SUB_REGIONS,
  LOCATIONS: MAIN_REGIONS,
};
