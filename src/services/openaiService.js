const AI_SYSTEM_PROMPT = `أنت مساعد خدمة عملاء محترف لـ "GazaServe" 🛠️

GazaServe هو بوت ذكي يربط سكان قطاع غزة بفنيي الصيانة المنزلية المتخصصين.

## الخدمات المتاحة:
• 🔧 سباكة - أحواض، مغاسل، حنفيات، مواسير، سخانات مياه، شفاطات مطبخ، تسريبات مياه، كوع صرف
• ⚡ كهرباء - أسلاك، فيش، كشافات، لوحات كهربائية، لمبات، برييزات، فيوزات، عطل عام بالكهرباء
• ☀️ طاقة شمسية - ألواح شمسية، بطاريات، انفرتر، منظومات كاملة
• ❄️ تبريد وتكييف - مكيفات، ثلاجات، غسالات (ملابس/صحون)، برادات، فريزرات

## المناطق: 
غزة - الشمال، غزة - الوسطى، غزة - الجنوب، غزة - المدينة، خان يونس، رفح، دير البلح، جباليا

## شخصيتك:
- محترف، لبق، ودود
- تستخدم العربية الفصحى البسيطة
- تتعاطف مع مشاكل المستخدم
- توجه المستخدم بلطف نحو الخدمة المناسبة

## أسلوب الرد:
- ردود احترافية ولكن دافئة
- استخدم الرموز التعبيرية باعتدال
- اشرح الخطوات القادمة بوضوح
- إذا كان الطلب خارج نطاق الصيانة، اعتذر بلطف ووضح الخدمات المتاحة

مثال على رد احترافي لطلب صيانة:
"أتفهم مشكلتك تماماً! 🤝 تكييف الهواء أمر ضروري خاصة في أجواء غزة. 
يسرني مساعدتك في إيجاد فني تبريد وتكييف متخصص.
سأبدأ معك خطوة بخطوة لإتمام الطلب."

مثال على رد لاستفسار عام:
"أهلاً بك في GazaServe! 👋
نحن هنا لمساعدتك في حل مشاكل الصيانة المنزلية بكل احترافية.
يمكنك طلب فني متخصص في:
🔧 سباكة | ⚡ كهرباء | ☀️ طاقة شمسية | ❄️ تبريد وتكييف

اكتب مشكلتك بالتفصيل وسأقوم بتوجيهك للفني المناسب!"`;

const AI_FUNCTIONS = [
  {
    name: 'submit_request',
    description: 'المستخدم يطلب خدمة صيانة - استخراج التفاصيل بدقة',
    parameters: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['سباكة', 'كهرباء', 'طاقة شمسية', 'تبريد وتكييف'],
          description: 'اختر التخصص بدقة: سباكة لكل ما يتعلق بالمياه والمواسير والمغاسل والأحواض. كهرباء للأسلاك والفيش واللمبات والأعطال الكهربائية. طاقة شمسية للألواح والبطاريات والانفرتر. تبريد وتكييف للمكيفات والثلاجات والغسالات والبرادات.',
        },
        location: {
          type: 'string',
          description: 'المنطقة في قطاع غزة إن ذكرها المستخدم',
        },
        response: {
          type: 'string',
          description: 'رد محترف ومتعاطف يشرح الخطوة القادمة',
        },
      },
      required: ['category', 'response'],
    },
  },
  {
    name: 'respond',
    description: 'الرد على المستخدم في غير طلبات الصيانة',
    parameters: {
      type: 'object',
      properties: {
        response_text: {
          type: 'string',
          description: 'الرد على المستخدم',
        },
        show_menu: {
          type: 'boolean',
          description: 'هل نعرض القائمة الرئيسية بعد الرد',
        },
      },
      required: ['response_text', 'show_menu'],
    },
  },
];

async function callOpenAIWithRetry(fn, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isRetryable = err.status === 429 || err.status >= 500 || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT';
      if (attempt < retries && isRetryable) {
        const delay = (attempt + 1) * 1000;
        console.warn(`[AI] Retry ${attempt + 1}/${retries} after ${delay}ms: ${err.message}`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
}

function getOpenAI() {
  const OpenAI = require('openai');
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OpenAI API key not configured');
  return new OpenAI({ apiKey });
}

async function extractWithAI(text) {
  const openai = getOpenAI();
  console.log('[AI] Starting extraction for:', text.substring(0, 50));

  const completion = await callOpenAIWithRetry(() => openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      {
        role: 'system',
        content: 'أنت مساعد لتصنيف طلبات الصيانة. حلل النص وأعد JSON:\n' +
          'إذا كان النص طلب صيانة حقيقي (مثل: مكسور، لا يعمل، يطلب تصليح):\n' +
          '{"type": "request", "category": "التخصص (سباكة/كهرباء/طاقة شمسية/تبريد وتكييف)", "location": "المنطقة"}\n\n' +
          'إذا كان النص تحية، سؤال، أو طلب تسجيل كفني:\n' +
          '{"type": "other"}\n\n' +
          'أمثلة:\n' +
          '"مكيف غرفتي ما يشتغل" → {"type": "request", "category": "تبريد وتكييف", "location": ""}\n' +
          '"مرحبا" → {"type": "other"}\n' +
          '"بدي سجل فني" → {"type": "other"}',
      },
      { role: 'user', content: text },
    ],
    temperature: 0.1,
  }));

  const raw = completion.choices[0].message.content;
  console.log('[AI] Raw response:', raw);
  const parsed = JSON.parse(raw);

  if (parsed.type === 'other') {
    throw new Error('Not a maintenance request');
  }

  return {
    category: parsed.category || 'عام',
    location: parsed.location || 'غير محدد',
  };
}

async function handleGeneralAI(ctx, text, stateManager) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) {
    console.warn('[AI] API key missing, using fallback');
    return null;
  }

  try {
    const openai = getOpenAI();
    stateManager.addMessage(ctx.from.id, 'user', text);
    const history = stateManager.getHistory(ctx.from.id, 4);

    const messages = [
      { role: 'system', content: AI_SYSTEM_PROMPT },
    ];

    for (const msg of history.slice(0, -1)) {
      messages.push({ role: msg.role, content: msg.text });
    }
    messages.push({ role: 'user', content: text });

    const completion = await callOpenAIWithRetry(() => openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages,
      functions: AI_FUNCTIONS,
      function_call: 'auto',
      temperature: 0.3,
    }));

    return completion.choices[0].message;
  } catch (err) {
    console.error('[AI] General AI error:', err.message);
    return null;
  }
}

module.exports = {
  AI_SYSTEM_PROMPT,
  AI_FUNCTIONS,
  callOpenAIWithRetry,
  extractWithAI,
  handleGeneralAI,
};
