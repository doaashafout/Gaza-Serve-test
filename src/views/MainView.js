const { Markup } = require('telegraf');
const { getCategories } = require('./FormView');

const DIVIDER_CB = '___';

function sendWelcome(ctx) {
  const name = ctx.from?.first_name || 'بك';
  const text = `👋 مرحباً ${name}
🏠 أهلاً بك في غزة سيرف

أنا هنا لمساعدتك في طلب أي خدمة منزلية بسهولة وسرعة.

اختر نوع الخدمة التي تحتاجها:`;

  const cats = getCategories();
  const rows = cats.map((c, i) => [Markup.button.callback(c, `cat_${i}`)]);
  rows.push([Markup.button.callback('─ ─ ─ خيارات أخرى ─ ─ ─', DIVIDER_CB)]);
  rows.push([Markup.button.callback('📋 طلباتي الحالية', 'my_requests')]);
  rows.push([Markup.button.callback('🎧 تواصل مع المشرف', 'support')]);
  rows.push([Markup.button.callback('🔧 تسجيل كمقدم خدمة', 'register_technician')]);

  return ctx.reply(text, Markup.inlineKeyboard(rows));
}

function sendHelp(ctx) {
  const helpText = `
*❓ كيفية استخدام GazaServe*

*لطلب صيانة:*
• أرسل وصف المشكلة (نص أو صوت)
• سيحلل الذكاء الاصطناعي طلبك تلقائياً
• سيتم إرسال طلبك للفنيين المختصين في منطقتك

*للتسجيل كفني:*
• اختر "التسجيل كفني" من القائمة
• أدخل بياناتك (الاسم، رقم الهاتف، التخصص، المنطقة)

*للاستفسار:* تواصل معنا عبر البوت مباشرة.

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

module.exports = { sendWelcome, sendHelp, DIVIDER_CB };
