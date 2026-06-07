const { Markup } = require('telegraf');

/**
 * MainView - Welcome and main menu messages
 * Styled to match GazaServe design system
 */

async function sendWelcome(ctx) {
  const firstName = ctx.from?.first_name || 'مستخدم';

  const welcomeText =
`👋 *مرحباً ${firstName}*
🏠 أهلاً بك في *غزة سيرف*

أنا مساعدك الذكي لطلب الخدمات المنزلية بسهولة وسرعة.

يمكنني مساعدتك في:
🏠 • طلب خدمة منزلية
📋 • متابعة طلباتك
🎧 • التواصل مع المشرف
🔧 • التسجيل كمقدم خدمة

اضغط على *Start* للبدء.`;

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('🏠 طلب خدمة جديدة', 'new_request')],
    [Markup.button.callback('📋 متابعة طلباتي', 'my_requests')],
    [Markup.button.callback('🎧 تواصل مع المشرف', 'support')],
    [Markup.button.callback('🔧 تسجيل كمقدم خدمة', 'register_technician')],
  ]);

  return ctx.reply(welcomeText, { parse_mode: 'Markdown', ...keyboard });
}

function sendHelp(ctx) {
  const helpText =
`*❓ كيفية استخدام غزة سيرف*

*لطلب خدمة منزلية:*
• اختر "طلب خدمة جديدة" من القائمة
• حدد نوع الخدمة والوصف والموقع
• سيتم إرسال طلبك لأقرب مقدم خدمة

*لمتابعة الطلبات:*
• اختر "متابعة طلباتي"

*للتسجيل كمقدم خدمة:*
• اختر "تسجيل كمقدم خدمة"

*الأوامر المتاحة:*
• /start - 🏠 القائمة الرئيسية
• /help - ❓ المساعدة
• /register - 🔧 تسجيل مقدم خدمة
• /tasks - 📌 مهامي (للفنيين)
• /myid - 🆔 معرفي
• /archive - 📦 الطلبات المؤرشفة`;

  return ctx.reply(helpText, { parse_mode: 'Markdown' });
}

module.exports = { sendWelcome, sendHelp };
