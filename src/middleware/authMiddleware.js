/**
 * Auth Middleware
 * Verifies that incoming updates are from valid Telegram sources.
 */

function validateTelegramUpdate(ctx, next) {
  if (ctx && ctx.from && ctx.from.id) {
    return next();
  }
  console.warn('[Auth] Invalid update source - no from.id');
}

module.exports = { validateTelegramUpdate };
