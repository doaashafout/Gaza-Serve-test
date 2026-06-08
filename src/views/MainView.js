const { Markup } = require('telegraf');
const { getCategories } = require('./FormView');

function sendWelcome(ctx) {
  const name = ctx.from?.first_name || 'بك';
  const text = `👋 مرحباً ${name}
🏠 أهلاً بك في غزة سيرف

أنا هنا لمساعدتك في طلب أي خدمة منزلية بسهولة وسرعة.

اختر نوع الخدمة التي تحتاجها:`;

  const cats = getCategories();
  const rows = [];
  for (let i = 0; i < cats.length; i += 2) {
    const row = [Markup.button.callback(cats[i], `cat_${i}`)];
    if (cats[i + 1]) row.push(Markup.button.callback(cats[i + 1], `cat_${i + 1}`));
    rows.push(row);
  }
  rows.push([Markup.button.callback('📋 طلباتي الحالية', 'my_requests')]);
  rows.push([Markup.button.callback('📞 الدعم الفني', 'support')]);
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

module.exports = { sendWelcome, sendHelp };
