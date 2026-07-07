const apiConfig = require('../../config/api');

const GEMINI_API_KEY = apiConfig.GEMINI_API_KEY;

async function geminiText(prompt, model = 'gemini-2.0-flash') {
  if (!GEMINI_API_KEY) {
    console.warn('[AI] No GEMINI_API_KEY configured, skipping AI check.');
    return { skip: true };
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
  const body = { contents: [{ parts: [{ text: prompt }] }] };
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) {
      console.warn('[AI] Gemini API error:', res.status, await res.text().then(t => t.substring(0, 100)));
      return { skip: false, text: '', error: `HTTP ${res.status}` };
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return { skip: false, text };
  } catch (err) {
    console.error('[AI] Gemini call failed:', err.message);
    return { skip: false, text: '', error: err.message };
  }
}

async function geminiVision(prompt, imageBase64, mimeType, model = 'gemini-2.0-flash') {
  if (!GEMINI_API_KEY) {
    console.warn('[AI] No GEMINI_API_KEY configured, skipping AI check.');
    return { skip: true };
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
  const body = {
    contents: [{
      parts: [
        { text: prompt },
        { inline_data: { mime_type: mimeType, data: imageBase64 } },
      ],
    }],
  };
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) {
      console.warn('[AI] Gemini vision API error:', res.status, await res.text().then(t => t.substring(0, 100)));
      return { skip: false, text: '', error: `HTTP ${res.status}` };
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return { skip: false, text };
  } catch (err) {
    console.error('[AI] Gemini vision call failed:', err.message);
    return { skip: false, text: '', error: err.message };
  }
}

async function fetchImageBase64(fileLink) {
  const res = await fetch(fileLink.href);
  const buf = Buffer.from(await res.arrayBuffer());
  const mimeType = res.headers.get('content-type') || 'image/jpeg';
  return { base64: buf.toString('base64'), mimeType };
}

async function validateWithAI(text, fieldType) {
  if (!text || text.trim().length < 2) {
    return { valid: false, message: '❌ الإدخال فارغ أو قصير جداً.' };
  }

  if (fieldType === 'name') {
    if (!GEMINI_API_KEY) {
      const arabic = /^[\u0600-\u06FF\s]+$/;
      if (!arabic.test(text.trim())) return { valid: false, message: '❌ الرجاء إدخال الاسم باللغة العربية فقط.' };
      const parts = text.trim().split(/\s+/);
      if (parts.length < 2) return { valid: false, message: '❌ الرجاء إدخال الاسم الكامل (اسم وكنية على الأقل).' };
      return { valid: true };
    }
    const result = await geminiText(
      `أنت مساعد تحقق من الأسماء العربية. حدد إذا كان النص يمثل اسماً عربياً حقيقياً (اسم أول واسم عائلة على الأقل).`
      + ` أجب فقط "صحيح" أو "خطأ: [السبب]".`
      + ` أمثلة صحيحة: "محمد أحمد علي"، "سارة خالد". أمثلة خاطئة: رموز، أرقام، إنجليزية.`
      +       `\nالنص: "${text.trim()}"`,
      'gemini-2.0-flash'
    );
    if (result.skip) return { valid: true };
    if (result.error) return { valid: true };
    if (result.text.includes('صحيح')) return { valid: true };
    return { valid: false, message: `❌ ${result.text.replace('خطأ: ', '')}` };
  }

  return { valid: true };
}

async function verifyIdDocument(imageFileId, enteredName, telegram) {
  if (!GEMINI_API_KEY) {
    return { match: true, extractedName: enteredName, message: '✅ تم استلام صورة الهوية.' };
  }
  let fileLink;
  try {
    fileLink = await telegram.getFileLink(imageFileId);
  } catch (err) {
    return { match: false, extractedName: '', message: '❌ تعذر الوصول إلى الصورة.' };
  }
  try {
    const { base64, mimeType } = await fetchImageBase64(fileLink);
    const result = await geminiVision(
      `أنت مساعد استخراج بيانات من الهويات الشخصية.`
      + ` استخرج الاسم الكامل المكتوب على الهوية.`
      + ` أجب فقط بصيغة: NAME: [الاسم المستخرج].`
      + ` إذا لم تتمكن من قراءة الاسم بوضوح، أجب: NAME: غير واضح.`,
      base64, mimeType, 'gemini-2.0-flash'
    );
    if (result.skip || result.error) {
      return { match: true, extractedName: enteredName, message: 'تم تجاوز التحقق البصري.' };
    }
    const response = result.text;
    const nameMatch = response.match(/NAME:\s*(.+)/);
    const extractedName = nameMatch ? nameMatch[1].trim() : '';
    if (!extractedName || extractedName === 'غير واضح') {
      return { match: false, extractedName: '', message: '😕 لم أتمكن من قراءة الاسم بوضوح من الصورة. يرجى إعادة رفع صورة أوضح.' };
    }
    const normalizedInput = normalizeArabicName(enteredName);
    const normalizedExtracted = normalizeArabicName(extractedName);
    const inputTokens = normalizedInput.split(/\s+/).filter(Boolean);
    const extractedTokens = normalizedExtracted.split(/\s+/).filter(Boolean);
    let matchedTokens = 0;
    for (const token of inputTokens) {
      if (extractedTokens.some(et => et.includes(token) || token.includes(et))) matchedTokens++;
    }
    const overlapRatio = matchedTokens / Math.max(inputTokens.length, extractedTokens.length);
    if (overlapRatio >= 0.5) {
      return { match: true, extractedName, message: `✅ تم التحقق: الاسم المستخرح "${extractedName}" متطابق مع الاسم المدخل.` };
    }
    return {
      match: false, extractedName,
      message: `⚠️ الاسم المستخرج من الهوية "${extractedName}" لا يتطابق مع "${enteredName}".\nيرجى التأكد من البيانات أو إعادة رفع صورة أوضح.`,
    };
  } catch (err) {
    console.error('[AI] verifyIdDocument error:', err.message);
    return { match: true, extractedName: enteredName, message: '✅ تم استلام صورة الهوية.' };
  }
}

async function verifyPersonalPhoto(imageFileId, telegram) {
  if (!GEMINI_API_KEY) {
    return { hasFace: true, message: '✅ تم استلام الصورة الشخصية.' };
  }
  let fileLink;
  try {
    fileLink = await telegram.getFileLink(imageFileId);
  } catch (err) {
    return { hasFace: false, message: '❌ تعذر الوصول إلى الصورة.' };
  }
  try {
    const { base64, mimeType } = await fetchImageBase64(fileLink);
    const result = await geminiVision(
      `أنت مساعد تحقق من الصور الشخصية. حدد إذا كانت الصورة تحتوي على وجه بشري واضح لشخص واحد.`
      + ` أجب فقط: "FACE: yes" إذا كان هناك وجه بشري واضح، أو "FACE: no: [السبب]" إذا لم يكن.`
      + ` أسباب الرفض: صورة فارغة، مستند، منتج، كرتون، شعار، مجموعة أشخاص، وجه غير واضح.`,
      base64, mimeType, 'gemini-2.0-flash'
    );
    if (result.skip || result.error) {
      return { hasFace: true, message: 'تم تجاوز التحقق البصري.' };
    }
    const response = result.text;
    if (response.includes('FACE: yes')) {
      return { hasFace: true, message: '✅ الصورة تحتوي على وجه بشري واضح.' };
    }
    const reason = response.replace('FACE: no:', '').trim();
    return { hasFace: false, message: `😕 ${reason || 'لم يتم التعرف على وجه بشري واضح.'}` };
  } catch (err) {
    console.error('[AI] verifyPersonalPhoto error:', err.message);
    return { hasFace: true, message: '✅ تم استلام الصورة الشخصية.' };
  }
}

function normalizeArabicName(name) {
  return name.trim()
    .replace(/[^\u0600-\u06FF\s]/g, '')
    .replace(/[إأآا]/g, 'ا').replace(/[ىي]/g, 'ي')
    .replace(/[ؤ]/g, 'و').replace(/[ئ]/g, 'ي')
    .replace(/[ة]/g, 'ه').replace(/\s+/g, ' ').trim();
}

module.exports = { validateWithAI, verifyIdDocument, verifyPersonalPhoto };
