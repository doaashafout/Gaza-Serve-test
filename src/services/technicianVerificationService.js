const axios = require('axios');
const sharp = require('sharp');
const OpenAI = require('openai');
const { PendingVerification, VerificationLog } = require('../Models');

const NAME_MATCH_THRESHOLD = 0.75;
const WORD_SIMILARITY_THRESHOLD = 0.8;

function normalizeArabicName(name) {
  if (!name) return '';
  return name
    .trim()
    .replace(/[^\u0600-\u06FF\s]/g, '')
    .replace(/[\u064B-\u0652]/g, '')
    .replace(/[إأٱآا]/g, 'ا')
    .replace(/[ىي]/g, 'ي')
    .replace(/[ؤ]/g, 'و')
    .replace(/[ئ]/g, 'ي')
    .replace(/[ة]/g, 'ه')
    .replace(/ء/g, '')
    .replace(/\bال/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshteinDistance(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function levenshteinSimilarity(str1, str2) {
  if (str1 === str2) return 1;
  const maxLen = Math.max(str1.length, str2.length, 1);
  return 1 - levenshteinDistance(str1, str2) / maxLen;
}

function sortedCharsMatch(w1, w2) {
  return w1.split('').sort().join('') === w2.split('').sort().join('');
}

function compareNames(inputName, extractedName) {
  const normalizedInput = normalizeArabicName(inputName);
  const normalizedExtracted = normalizeArabicName(extractedName);

  console.log('[NameMatch] Input normalized:', normalizedInput);
  console.log('[NameMatch] Extracted normalized:', normalizedExtracted);

  if (!normalizedInput || !normalizedExtracted) {
    console.log('[NameMatch] One or both names empty → no match');
    return false;
  }

  const inputTokens = normalizedInput.split(' ');
  const extractedTokens = normalizedExtracted.split(' ');

  let matchedCount = 0;
  const used = new Array(extractedTokens.length).fill(false);

  for (const inputToken of inputTokens) {
    let bestSim = 0;
    let bestIdx = -1;
    for (let j = 0; j < extractedTokens.length; j++) {
      if (used[j]) continue;
      const leven = levenshteinSimilarity(inputToken, extractedTokens[j]);
      const sorted = sortedCharsMatch(inputToken, extractedTokens[j]) ? 1 : 0;
      const sim = Math.max(leven, sorted);
      if (sim > bestSim) { bestSim = sim; bestIdx = j; }
    }
    if (bestIdx !== -1 && bestSim >= WORD_SIMILARITY_THRESHOLD) {
      matchedCount++;
      used[bestIdx] = true;
    }
  }

  const matchRatio = matchedCount / inputTokens.length;
  console.log(`[NameMatch] matchedCount=${matchedCount}, inputTokens=${inputTokens.length}, matchRatio=${matchRatio.toFixed(4)}`);

  return matchRatio >= NAME_MATCH_THRESHOLD;
}

async function optimizeForAI(imageBuffer) {
  try {
    const info = await sharp(imageBuffer).metadata();
    let buffer = imageBuffer;
    if (info.width > 2048 || info.height > 2048) {
      buffer = await sharp(imageBuffer)
        .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
    } else if (buffer.length > 4 * 1024 * 1024) {
      buffer = await sharp(imageBuffer)
        .jpeg({ quality: 75 })
        .toBuffer();
    }
    return buffer.toString('base64');
  } catch {
    return imageBuffer.toString('base64');
  }
}

async function callOpenAIWithRetry(imageBase64, retries = 3) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const systemPrompt = `أنت مفحّص هويات شخصية. حلّل صورة الهوية (بطاقة شخصية) وأعد JSON فقط بالحقول التالية:
{
  "is_valid_id": true/false,
  "rejection_reason": "السبب إن كان غير صحيح أو null",
  "extracted_name": "الاسم المستخرج من الهوية أو null",
  "id_number": "رقم الهوية (9 أرقام) أو null",
  "confidence": 0.0 إلى 1.0
}

تعليمات:
- is_valid_id: true فقط إذا كانت الصورة تحتوي على بطاقة هوية شخصية حقيقية واضحة
- rejection_reason: نص يشرح سبب الرفض، أو null إذا كانت سليمة
- extracted_name: الاسم العربي الكامل من الهوية (إذا ظهر)، أو null
- id_number: رقم الهوية (9 أرقام) من البطاقة، أو null
- confidence: درجة الثقة من 0.0 إلى 1.0 بناءً على وضوح الصورة وقابلية قراءة البيانات`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'حلل صورة الهوية هذه:' },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: 'high' } },
            ],
          },
        ],
        max_tokens: 500,
        temperature: 0.1,
        response_format: { type: 'json_object' },
      });
      const raw = response.choices[0].message.content;
      return JSON.parse(raw);
    } catch (err) {
      if (attempt < retries) {
        const delay = attempt * 2000;
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
}

async function downloadTelegramImage(fileId, telegram) {
  const fileLink = await telegram.getFileLink(fileId);
  const resp = await axios.get(fileLink.href, { responseType: 'arraybuffer' });
  return Buffer.from(resp.data);
}

async function verifyTechnicianId({ fileId, telegram, fullName, nationalIdNumber }) {
  try {
    const imageBuffer = await downloadTelegramImage(fileId, telegram);
    const imageBase64 = await optimizeForAI(imageBuffer);

    let aiResult;
    try {
      aiResult = await callOpenAIWithRetry(imageBase64);
    } catch (err) {
      console.error('[Verification] OpenAI failed after retries:', err.message);
      await PendingVerification.create({
        user_id: telegram.botInfo?.id || 0,
        full_name: fullName,
        national_id_number: nationalIdNumber,
        status: 'pending',
        ai_response: `OpenAI error: ${err.message}`,
        reason: 'AI service unavailable after retries',
      });
      return {
        status: 'pending_review',
        message: '⚠️ تعذر التحقق الآلي حالياً. سيتم مراجعة طلبك من قبل الإدارة.',
      };
    }

    console.log('[Verification] Full AI result:', JSON.stringify(aiResult));
    console.log('[Verification] User input - nationalIdNumber:', nationalIdNumber, 'fullName:', fullName);

    let decision, reason;

    if (aiResult.is_valid_id === false) {
      decision = 'rejected';
      reason = aiResult.rejection_reason || 'الصورة غير واضحة كهوية، حاول ثانية';
    } else if (aiResult.confidence < 0.6) {
      decision = 'pending_review';
      reason = 'لم نتمكن من التأكد الكافي من بيانات الهوية';
    } else if (aiResult.id_number === null || String(aiResult.id_number).replace(/[^\d]/g, '') === '') {
      decision = 'rejected';
      reason = 'لم نتمكن من قراءة رقم الهوية من الصورة، أعد رفع صورة أوضح';
    } else if (String(aiResult.id_number).replace(/[^\d]/g, '') !== String(nationalIdNumber).replace(/[^\d]/g, '')) {
      console.log(`[Verification] ID mismatch. AI: "${aiResult.id_number}" (cleaned: "${String(aiResult.id_number).replace(/[^\d]/g, '')}"), User: "${nationalIdNumber}"`);
      decision = 'rejected';
      reason = 'رقم الهوية لا يطابق البيانات المدخلة';
    } else if (aiResult.extracted_name === null) {
      decision = 'rejected';
      reason = 'لم نتمكن من قراءة الاسم من الصورة، أعد رفع صورة أوضح';
    } else if (!compareNames(fullName, aiResult.extracted_name)) {
      console.log(`[Verification] Name mismatch. User input: "${fullName}", AI extracted: "${aiResult.extracted_name}"`);
      decision = 'rejected';
      reason = 'الاسم لا يطابق البيانات المدخلة';
    } else {
      decision = 'accepted';
      reason = null;
    }

    const messages = {
      accepted: '✅ تم التحقق من الهوية بنجاح.',
      rejected: `❌ ${reason}\n\nيرجى التأكد من البيانات والمحاولة مرة أخرى.`,
      pending_review: '⏳ لم نتمكن من التأكد الكافي من بيانات الهوية تلقائياً. سيتم مراجعة طلبك من قبل الإدارة وسنرسل لك الرد قريباً.',
    };

    const finalMessage = messages[decision] || messages.pending_review;

    try {
      await VerificationLog.create({
        user_id: telegram.botInfo?.id || 0,
        full_name: fullName,
        national_id_number: nationalIdNumber,
        decision,
        reason: reason || 'all checks passed',
        confidence: aiResult.confidence || null,
        ai_response: JSON.stringify(aiResult),
      });
    } catch (logErr) {
      console.error('[Verification] Failed to log:', logErr.message);
    }

    return { status: decision, message: finalMessage, reason };
  } catch (err) {
    console.error('[Verification] Unexpected error:', err.message);
    return {
      status: 'pending_review',
      message: '⚠️ حدث خطأ غير متوقع. سيتم مراجعة طلبك من قبل الإدارة.',
    };
  }
}

module.exports = { verifyTechnicianId, compareNames, normalizeArabicName };
