const { Markup } = require('telegraf');
const { Category } = require('../Models');

// Gaza geographical areas
const LOCATIONS = [
  'غزة - الشمال',
  'غزة - الوسطى',
  'غزة - الجنوب',
  'غزة - المدينة',
  'خان يونس',
  'رفح',
  'دير البلح',
  'جباليا',
];

let _categoriesCache = null;
let _categoriesCleanCache = null;
let _emojiMapCache = null;

function _useDefaults() {
  _categoriesCache = ['🧹 تنظيف منزل', '⚡ كهرباء', '🚰 سباكة', '🛠️ صيانة عامة', '🖌️ دهان'];
  _categoriesCleanCache = ['تنظيف منزل', 'كهرباء', 'سباكة', 'صيانة عامة', 'دهان'];
  _emojiMapCache = { 'تنظيف منزل': '🧹', 'كهرباء': '⚡', 'سباكة': '🚰', 'صيانة عامة': '🛠️', 'دهان': '🖌️' };
}

// Eager load on startup, fall back to defaults on failure
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

function sendLocationSelection(ctx, text = 'اختر منطقتك:') {
  const buttons = LOCATIONS.map((loc, i) => [Markup.button.callback(loc, `loc_${i}`)]);
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
  getCategories,
  getCategoriesClean,
  LOCATIONS,
};
