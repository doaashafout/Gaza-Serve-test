const { Markup } = require('telegraf');

function sendWelcome(ctx) {
  const welcomeText = `
🛠️ *مرحباً بك في GazaServe* 🛠️

بوت خدمة الصيانة المنزلية الذكي في قطاع غزة.
يمكنك طلب فني صيانة متخصص للمنزل بكل سهولة.

*اختر أحد الخيارات أدناه:*`;

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('🔧 طلب صيانة جديد', 'new_request')],
    [Markup.button.callback('📋 التسجيل كفني', 'register_technician')],
    [Markup.button.callback('📊 حالة طلباتي', 'my_requests')],
    [Markup.button.callback('✍️ اكتب مشكلتي', 'type_problem')],
    [Markup.button.callback('📞 الدعم الفني', 'support')],
  ]);

  return ctx.reply(welcomeText, { parse_mode: 'Markdown', ...keyboard });
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
