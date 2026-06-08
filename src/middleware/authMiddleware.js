'use strict';
/**
 * Auth Middleware — validates Telegram updates & blocks inactive users
 */
const { User } = require('../Models');

async function validateTelegramUpdate(ctx, next) {
  // Ignore non-user sources (channels, etc.)
  if (!ctx.from) return;

  try {
    const user = await User.findByPk(ctx.from.id);
    if (user && user.is_active === false) {
      return ctx.reply('⛔ تم تعليق حسابك. تواصل مع الإدارة.');
    }
  } catch (_) { /* DB not ready yet — allow through */ }

  return next();
}

module.exports = { validateTelegramUpdate };
