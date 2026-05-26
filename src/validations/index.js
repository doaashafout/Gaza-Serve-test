function validateName(name) {
  if (!name || name.trim().length < 3) {
    return { valid: false, message: '❌ الاسم قصير جداً. الرجاء إدخال اسمك الثلاثي (مثال: محمد أحمد علي).' };
  }
  const parts = name.trim().split(/\s+/);
  if (parts.length < 3) {
    return { valid: false, message: '❌ الرجاء إدخال الاسم الثلاثي كاملاً (مثال: محمد أحمد علي).' };
  }
  const arabicPattern = /^[\u0600-\u06FF\s]+$/;
  if (!arabicPattern.test(name.trim())) {
    return { valid: false, message: '❌ الرجاء إدخال الاسم باللغة العربية فقط.' };
  }
  return { valid: true, message: null };
}

function validatePhone(phone) {
  const cleaned = phone.replace(/[\s\-\(\)]+/g, '');
  if (!/^05[69]\d{7}$/.test(cleaned) && !/^\+9705[69]\d{7}$/.test(cleaned) && !/^009705[69]\d{7}$/.test(cleaned)) {
    return { valid: false, message: '❌ رقم الهاتف غير صحيح. الرجاء إدخال رقم فلسطيني صحيح يبدأ بـ 059 أو 056 (مثال: 0599XXXXXX).' };
  }
  return { valid: true, message: null };
}

module.exports = { validateName, validatePhone };
