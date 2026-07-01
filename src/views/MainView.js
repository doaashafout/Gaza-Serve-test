const { Markup } = require('telegraf');
const path = require('path');
const { getCategories } = require('./FormView');

function getWelcomeCaption() {
  return (
    'مرحباً بك في غزة سيرف 👋\n\n' +
    'أنا مساعدك الذكي لطلب الخدمات المنزلية\n' +
    'بسهولة وسرعة.'
  );
}

function getWelcomeKeyboard() {
  return Markup.inlineKeyboard([
    Markup.button.callback('Start / ابدأ 🚀', 'welcome_start')
  ]);
}

function getWelcomeLogoPath() {
  return path.join(__dirname, '..', 'assets', 'gazaserve_full_square_1024.png');
}

function sendWelcome(ctx) {
  const name = ctx.from?.first_name || 'بك';
  const text = `👋 مرحباً ${name}

اختر نوع الخدمة التي تحتاجها:`;

  const cats = getCategories();
  const keyboard = cats.map(c => [c]);
  keyboard.push(['─ ─ ─ ─ ─ ─ ─']);
  keyboard.push(['📋 طلباتي الحالية', '🎧 تواصل مع المشرف']);

  return ctx.reply(text, Markup.keyboard(keyboard).resize());
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
- /tasks - 📌 مهامي
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
  sendHelp
};