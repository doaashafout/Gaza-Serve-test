const { Markup } = require('telegraf');
const { Category } = require('../Models');

// Gaza geographical areas (matching screenshots)
const LOCATIONS = [
  { label: '🕌 غزة (الشمال)', value: 'غزة (الشمال)', subAreas: ['جباليا', 'بيت لاهيا', 'بيت حانون'] },
  { label: '🕌 غزة (مدينة غزة)', value: 'غزة (مدينة غزة)', subAreas: ['الشجاعية', 'الرمال', 'التفاح', 'الزيتون'] },
  { label: '🕌 غزة (الوسطى)', value: 'غزة (الوسطى)', subAreas: ['النصيرات', 'الزوايدة', 'البريج', 'المغازي', 'دير البلح'] },
  { label: '🌴 غزة (الجنوب)', value: 'غزة (الجنوب)', subAreas: ['خان يونس', 'رفح', 'المواصي'] },
];

const SUB_AREAS = {
  'غزة (الشمال)': ['جباليا', 'بيت لاهيا', 'بيت حانون'],
  'غزة (مدينة غزة)': ['الشجاعية', 'الرمال', 'التفاح', 'الزيتون'],
  'غزة (الوسطى)': ['النصيرات', 'الزوايدة', 'البريج', 'المغازي', 'دير البلح'],
  'غزة (الجنوب)': ['خان يونس', 'رفح', 'المواصي'],
};

let _categoriesCache = null;
let _categoriesCleanCache = null;
let _emojiMapCache = null;

function _useDefaults() {
  _categoriesCache = ['🧹 تنظيف منزل', '⚡ كهرباء', '🚿 سباكة', '🔧 صيانة عامة', '🎨 دهان'];
  _categoriesCleanCache = ['تنظيف منزل', 'كهرباء', 'سباكة', 'صيانة عامة', 'دهان'];
  _emojiMapCache = {
    'تنظيف منزل': '🧹',
    'كهرباء': '⚡',
    'سباكة': '🚿',
    'صيانة عامة': '🔧',
    'دهان': '🎨',
    'طاقة شمسية': '☀️',
    'تبريد وتكييف': '❄️',
    'صيانة مكيفات': '❄️',
  };
}

// Eager load on startup
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
  const emoji = (getEmojiMap())[cat] || '';
  return emoji ? `${emoji} ${cat}` : (cat || '');
}

function sendLocationSelection(ctx, text = 'اختر منطقتك:') {
  const buttons = LOCATIONS.map((loc, i) => [
    Markup.button.callback(loc.label, `loc_${i}`)
  ]);
  return ctx.reply(text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons),
  });
}

function sendSubAreaSelection(ctx, mainLocation) {
  const subs = SUB_AREAS[mainLocation] || [];
  if (subs.length === 0) return null;

  const buttons = [];
  for (let i = 0; i < subs.length; i += 3) {
    const row = subs.slice(i, i + 3).map((s, j) =>
      Markup.button.callback(`📍 ${s}`, `subarea_${i + j}_${mainLocation}`)
    );
    buttons.push(row);
  }

  return ctx.reply(`اختر المحافظة داخل منطقة ${mainLocation}:`, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons),
  });
}

function sendCategorySelection(ctx, text = 'اختر تخصص الخدمة المطلوبة:') {
  const cats = getCategories();
  const buttons = [];
  for (let i = 0; i < cats.length; i++) {
    buttons.push([Markup.button.callback(cats[i], `cat_${i}`)]);
  }
  return ctx.reply(text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons),
  });
}

// Refresh cache every 5 minutes
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
}, 300000);

function sendTechnicianRegistrationForm(ctx) {
  return ctx.reply(
    '📝 *تسجيل كمقدم خدمة*\n\n'
    + 'الرجاء إدخال اسمك الثلاثي (مثال: محمد أحمد علي):',
    { parse_mode: 'Markdown' }
  );
}

module.exports = {
  cleanCategory,
  displayCategory,
  sendCategorySelection,
  sendLocationSelection,
  sendSubAreaSelection,
  sendTechnicianRegistrationForm,
  getCategories,
  getCategoriesClean,
  LOCATIONS,
  SUB_AREAS,
};
