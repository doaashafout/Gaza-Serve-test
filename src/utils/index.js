'use strict';

/** Format a JS Date for Arabic Gaza timezone display */
function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('ar', {
    timeZone: 'Asia/Gaza',
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

/** Star emoji string, e.g. ⭐⭐⭐☆☆ */
function starBar(avg, max = 5) {
  const n = Math.round(Number(avg) || 0);
  return '⭐'.repeat(n) + '☆'.repeat(Math.max(0, max - n));
}

/** Safe parseInt — returns NaN-safe 0 fallback */
function safeInt(v, fallback = 0) {
  const n = parseInt(v);
  return isNaN(n) ? fallback : n;
}

/** Truncate string */
function trunc(s, n = 200) {
  if (!s) return '';
  return s.length > n ? s.substring(0, n) + '…' : s;
}

/** Validate Palestinian phone number */
function validatePhone(phone) {
  const cleaned = (phone || '').replace(/[\s\-\(\)]+/g, '');
  const ok = /^05[69]\d{7}$/.test(cleaned)
           || /^\+9705[69]\d{7}$/.test(cleaned)
           || /^009705[69]\d{7}$/.test(cleaned);
  return {
    valid: ok,
    message: ok ? null : '❌ رقم الهاتف غير صحيح.\nأدخل رقماً فلسطينياً صحيحاً يبدأ بـ 059 أو 056.\nمثال: 0599123456',
  };
}

/** Validate Arabic full name (3 parts) */
function validateName(name) {
  if (!name || name.trim().length < 5)
    return { valid: false, message: '❌ الاسم قصير جداً. أدخل اسمك الثلاثي.' };
  if (name.trim().split(/\s+/).length < 2)
    return { valid: false, message: '❌ أدخل اسمك الثلاثي كاملاً (مثال: محمد أحمد علي).' };
  return { valid: true, message: null };
}

module.exports = { formatDate, starBar, safeInt, trunc, validatePhone, validateName };
