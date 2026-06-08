'use strict';
/**
 * AI Service — OpenAI integration for category detection & chat
 */
const { OPENAI_API_KEY } = require('../config/api');

const SYSTEM_PROMPT = `أنت مساعد خدمة عملاء لـ "غزة سيرف" — منصة خدمات منزلية لقطاع غزة.

الخدمات المتاحة:
• 🧹 تنظيف منزل
• ⚡ كهرباء
• 🚿 سباكة
• ❄️ صيانة مكيفات
• 🔧 صيانة عامة
• 🎨 دهان

شخصيتك: محترف، دافئ، مختصر. استخدم العربية الفصحى البسيطة.
إذا طلب المستخدم صيانة → استخدم دالة submit_request.
إذا كان سؤالاً عاماً → استخدم دالة respond.`;

const FUNCTIONS = [
  {
    name: 'submit_request',
    description: 'المستخدم يطلب خدمة صيانة — استخرج التخصص',
    parameters: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['تنظيف منزل', 'كهرباء', 'سباكة', 'صيانة مكيفات', 'صيانة عامة', 'دهان'],
          description: 'التخصص المناسب للمشكلة',
        },
        reply: { type: 'string', description: 'رد مختصر ومتعاطف للمستخدم' },
      },
      required: ['category', 'reply'],
    },
  },
  {
    name: 'respond',
    description: 'رد على سؤال عام أو استفسار',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        show_menu: { type: 'boolean' },
      },
      required: ['text', 'show_menu'],
    },
  },
];

/**
 * Extract category from free text.
 * Returns { category: string|null }
 */
async function extractCategory(text) {
  if (!OPENAI_API_KEY) return { category: null };
  try {
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    const res = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text },
      ],
      functions: FUNCTIONS,
      function_call: 'auto',
      temperature: 0.1,
      max_tokens: 300,
    });
    const msg = res.choices[0].message;
    if (msg.function_call?.name === 'submit_request') {
      const args = JSON.parse(msg.function_call.arguments);
      return { category: args.category || null, reply: args.reply };
    }
    return { category: null };
  } catch (err) {
    console.warn('[AI] extractCategory error:', err.message);
    return { category: null };
  }
}

/**
 * Full AI conversation handler.
 * Returns { action: 'request'|'respond', category?, reply, show_menu? }
 */
async function chat(history, userText) {
  if (!OPENAI_API_KEY) return { action: 'fallback' };
  try {
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    const messages = [{ role: 'system', content: SYSTEM_PROMPT }];
    for (const h of history) messages.push({ role: h.role, content: h.text });
    messages.push({ role: 'user', content: userText });

    const res = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages,
      functions: FUNCTIONS,
      function_call: 'auto',
      temperature: 0.3,
      max_tokens: 500,
    });

    const msg = res.choices[0].message;
    if (msg.function_call) {
      let args;
      try { args = JSON.parse(msg.function_call.arguments); } catch { return { action: 'fallback' }; }
      if (msg.function_call.name === 'submit_request') {
        return { action: 'request', category: args.category, reply: args.reply };
      }
      if (msg.function_call.name === 'respond') {
        return { action: 'respond', reply: args.text, show_menu: args.show_menu };
      }
    }
    return { action: 'respond', reply: msg.content || '...', show_menu: true };
  } catch (err) {
    console.error('[AI] chat error:', err.message);
    return { action: 'fallback' };
  }
}

module.exports = { extractCategory, chat };
