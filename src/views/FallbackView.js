const { Markup } = require('telegraf');

/**
 * FallbackView - Text menu used when AI services are unavailable
 */

function sendFallbackMenu(ctx) {
  const text = `
⚠️ *عذراً، خدمة الذكاء الاصطناعي غير متاحة حالياً*
يرجى استخدام القائمة النصية البديلة:

*اختر نوع الخدمة المطلوبة:*`;

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('🔧 سباكة', 'fallback_plumbing')],
    [Markup.button.callback('⚡ كهرباء', 'fallback_electrical')],
    [Markup.button.callback('☀️ طاقة شمسية', 'fallback_solar')],
    [Markup.button.callback('❄️ تبريد وتكييف', 'fallback_hvac')],
    [Markup.button.callback('📋 التسجيل كفني صيانة', 'register_technician')],
    [Markup.button.callback('🔙 رجوع للقائمة الرئيسية', 'back_main')],
  ]);

  return ctx.reply(text, {
    parse_mode: 'Markdown',
    ...keyboard,
  });
}

function sendFallbackLocationPrompt(ctx) {
  return ctx.reply('📌 أرسل منطقتك السكنية في قطاع غزة (نصياً):', {
    parse_mode: 'Markdown',
  });
}

function sendFallbackPhonePrompt(ctx) {
  return ctx.reply('📱 أرسل رقم هاتفك للتواصل (مثال: 0599XXXXXX):', {
    parse_mode: 'Markdown',
  });
}

module.exports = {
  sendFallbackMenu,
  sendFallbackLocationPrompt,
  sendFallbackPhonePrompt,
};
