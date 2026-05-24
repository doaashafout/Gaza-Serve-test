const { Markup } = require('telegraf');

/**
 * FormView - Interactive selection menus (categories, locations)
 */

// Service categories matching the design document
const CATEGORIES = [
  '🔧 سباكة',
  '⚡ كهرباء',
  '☀️ طاقة شمسية',
  '❄️ تبريد وتكييف',
];

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
  LOCATIONS,
  sendCategorySelection,
  sendLocationSelection,
  sendRatingSelection,
  sendTechnicianRegistrationForm,
};
