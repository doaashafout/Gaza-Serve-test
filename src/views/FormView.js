const { Markup } = require('telegraf');

/**
 * FormView - Interactive selection menus (categories, locations)
 */

// Service categories (with emojis for display)
const CATEGORIES = [
  '🔧 سباكة',
  '⚡ كهرباء',
  '☀️ طاقة شمسية',
  '❄️ تبريد وتكييف',
];

// Clean category names (without emojis) for DB storage & matching
const CATEGORIES_CLEAN = [
  'سباكة',
  'كهرباء',
  'طاقة شمسية',
  'تبريد وتكييف',
];

const CATEGORY_EMOJI_MAP = {
  'سباكة': '🔧',
  'كهرباء': '⚡',
  'طاقة شمسية': '☀️',
  'تبريد وتكييف': '❄️',
};

function cleanCategory(cat) {
  for (const clean of CATEGORIES_CLEAN) {
    if (cat.includes(clean)) return clean;
  }
  return cat.replace(/[^\u0600-\u06FF\s]/g, '').trim();
}

function displayCategory(cat) {
  const emoji = CATEGORY_EMOJI_MAP[cat] || '';
  return emoji ? `${emoji} ${cat}` : cat;
}

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

function sendCategorySelection(ctx, text = 'اختر تخصص الخدمة المطلوبة:') {
  const buttons = [];
  for (let i = 0; i < CATEGORIES.length; i += 2) {
    const row = [
      Markup.button.callback(CATEGORIES[i], `cat_${i}`),
    ];
    if (CATEGORIES[i + 1]) {
      row.push(Markup.button.callback(CATEGORIES[i + 1], `cat_${i + 1}`));
    }
    buttons.push(row);
  }
  return ctx.reply(text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons),
  });
}

function sendLocationSelection(ctx, text = 'اختر منطقتك السكنية في قطاع غزة:') {
  const buttons = [];
  for (let i = 0; i < LOCATIONS.length; i += 2) {
    const row = [
      Markup.button.callback(LOCATIONS[i], `loc_${i}`),
    ];
    if (LOCATIONS[i + 1]) {
      row.push(Markup.button.callback(LOCATIONS[i + 1], `loc_${i + 1}`));
    }
    buttons.push(row);
  }
  buttons.push([Markup.button.callback('🔙 رجوع', 'back_main')]);
  return ctx.reply(text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons),
  });
}

function sendRatingSelection(ctx, requestId) {
  const buttons = [];
  const row = [];
  for (let i = 1; i <= 5; i++) {
    row.push(Markup.button.callback(`${'⭐'.repeat(i)}`, `rate_${requestId}_${i}`));
  }
  buttons.push(row);
  buttons.push([Markup.button.callback('تخطي التقييم', `skip_rate_${requestId}`)]);
  return ctx.reply('*قم بتقييم الفني:*\nاختر عدد النجوم (1-5):', {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons),
  });
}

function sendTechnicianRegistrationForm(ctx) {
  const text = `
📋 *التسجيل كفني صيانة*

سنقوم بإنشاء ملف تعريف لك خطوة بخطوة.

*الخطوة 1/4:* أرسل *اسمك الثلاثي* (مثال: محمد أحمد علي)`;
  return ctx.reply(text, { parse_mode: 'Markdown' });
}

module.exports = {
  CATEGORIES,
  CATEGORIES_CLEAN,
  CATEGORY_EMOJI_MAP,
  LOCATIONS,
  cleanCategory,
  displayCategory,
  sendCategorySelection,
  sendLocationSelection,
  sendRatingSelection,
  sendTechnicianRegistrationForm,
};
