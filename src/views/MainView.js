const { Markup } = require('telegraf');
const { getCategories } = require('./FormView');

function sendWelcome(ctx) {
  const name = ctx.from?.first_name || 'بك';
  const text = `👋 مرحباً ${name}
🏠 أهلاً بك في غزة سيرف

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
• /start - 🏠 القائمة الرئيسية
• /help - ❓ المساعدة
• /register - 📋 تسجيل فني
• /tasks - 📌 مهامي
• /support - 📞 الدعم الفني
• /myid - 🆔 معرفي
• /archive - 📦 الطلبات المؤرشفة
`;

  return ctx.reply(helpText, { parse_mode: 'Markdown' });
}

module.exports = { sendWelcome, sendHelp };
