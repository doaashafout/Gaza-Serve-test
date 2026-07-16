async function validateWithAI(text, fieldType) {
  if (!text || text.trim().length < 2) {
    return { valid: false, message: '❌ الإدخال فارغ أو قصير جداً.' };
  }

  if (fieldType === 'name') {
    const arabic = /^[\u0600-\u06FF\s]+$/;
    if (!arabic.test(text.trim())) return { valid: false, message: '❌ الرجاء إدخال الاسم باللغة العربية فقط.' };
    const parts = text.trim().split(/\s+/);
    if (parts.length < 4) return { valid: false, message: '❌ الرجاء إدخال الاسم الرباعي الكامل (4 أسماء).' };
    return { valid: true };
  }

  return { valid: true };
}

function normalizeArabicName(name) {
  return name.trim()
    .replace(/[^\u0600-\u06FF\s]/g, '')
    .replace(/[إأآا]/g, 'ا').replace(/[ىي]/g, 'ي')
    .replace(/[ؤ]/g, 'و').replace(/[ئ]/g, 'ي')
    .replace(/[ة]/g, 'ه').replace(/\s+/g, ' ').trim();
}

async function verifyIdDocument(imageFileId, enteredName, telegram) {
  return { match: true, extractedName: enteredName, message: '✅ تم استلام صورة الهوية.' };
}

async function verifyPersonalPhoto(imageFileId, telegram) {
  return { hasFace: true, message: '✅ تم استلام الصورة الشخصية.' };
}

module.exports = { validateWithAI, verifyIdDocument, verifyPersonalPhoto };