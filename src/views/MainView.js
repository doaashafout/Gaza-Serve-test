const { Markup } = require('telegraf');
const path = require('path');
const { getCategories } = require('./FormView');

const DIVIDER_CB = '___';

function getWelcomeCaption() {
  return (
    '👋 *مرحباً بك في غزة سيرف*\n\n' +
    'أنا مساعدك الذكي لطلب الخدمات المنزلية\n' +
    'بسهولة وسرعة.'
  );
}

function getWelcomeKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🚀 ابدأ', 'welcome_start')],
  ]);
}

function getWelcomeLogoPath() {
  return path.join(__dirname, '..', 'assets', 'gazaserve_full_square_1024.png');
}

function sendWelcome(ctx) {
  const name = ctx.from?.first_name || 'بك';
  const text = `
👋 *مرحباً ${name}*

━━━━━━━━━━━━━━━━━━
🏠 *طلب خدمة منزلية*
اختر نوع الخدمة التي تحتاجها من الأزرار أدناه:
━━━━━━━━━━━━━━━━━━
`;

  const cats = getCategories();
  const rows = cats.map((c, i) => [Markup.button.callback(c, `cat_${i}`)]);
  rows.push([Markup.button.callback('─ ─ ─ خيارات أخرى ─ ─ ─', DIVIDER_CB)]);
  rows.push([Markup.button.callback('📋 طلباتي الحالية', 'my_requests')]);
  rows.push([Markup.button.callback('🎧 تواصل مع المشرف', 'support')]);
  rows.push([Markup.button.callback('🗑️ حذف تسجيلي كفني', 'deregister_tech')]);

  return ctx.reply(text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(rows),
  });
}

function sendHelp(ctx) {
  const helpText = `
*❓ كيفية استخدام GazaServe*

*لطلب صيانة:*
بعد اختيار الخدمة من القائمة، اتبع التعليمات.

*للتسجيل كفني:*
استخدم الأمر /register

*الأوامر المتاحة:*
- /start - 🏠 القائمة الرئيسية
- /help - ❓ المساعدة
- /register - 📋 تسجيل فني
- /mytasks - 📌 مهامي (للفني)
- /support - 📞 الدعم الفني
- /myid - 🆔 معرفي
- /archive - 📦 الطلبات المؤرشفة
`;

  return ctx.reply(helpText, { parse_mode: 'Markdown' });
}

module.exports = {
  getWelcomeCaption,
  getWelcomeKeyboard,
  getWelcomeLogoPath,
  sendWelcome,
  sendHelp,
  DIVIDER_CB,
};
