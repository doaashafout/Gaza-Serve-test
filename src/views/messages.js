'use strict';
/**
 * messages.js — Centralised message templates
 * All bot text lives here. No scattered strings in controllers.
 */
const { formatDate, starBar, trunc } = require('../utils');
const { displayCategory } = require('./keyboards');

// ─── Welcome ─────────────────────────────────────────────────────────────────
function welcome(firstName) {
  return (
`👋 *مرحباً ${firstName || 'بك'}*
🏠 أهلاً بك في *غزة سيرف*

أنا مساعدك الذكي لطلب الخدمات المنزلية بسهولة وسرعة.

يمكنني مساعدتك في:
🏠 • طلب خدمة منزلية
📋 • متابعة طلباتك
🎧 • التواصل مع المشرف
🔧 • التسجيل كمقدم خدمة`
  );
}

// ─── Request flow ────────────────────────────────────────────────────────────
const selectCategory =
`🏠 *طلب خدمة جديدة*

أنا هنا لمساعدتك في طلب أي خدمة منزلية بسهولة وسرعة.

اختر نوع الخدمة التي تحتاجها:`;

function descPrompt(category) {
  return (
`✅ اخترت: *${displayCategory(category)}*

📝 *يرجى وصف المشكلة التي تواجهها بالتفصيل*

لنتمكن من إرسال طلبك للمشرف بدقة.`
  );
}

const photoPrompt =
`✅ شكراً لك.

📷 إذا كانت لديك صورة توضح المشكلة يمكنك إرسالها الآن، أو تخطي هذه الخطوة:`;

const photoReceived =
`✅ تم استلام الصورة بنجاح.
الخطوة التالية: تحديد منطقتك وعنوانك

الآن يرجى تحديد منطقتك الرئيسية:`;

const selectSubArea = (region) =>
`اختر المحافظة داخل منطقة ${region}:`;

const addrPrompt = (location) =>
`📍 *المنطقة:* ${location}

✍️ يرجى كتابة عنوانك بالتفصيل مع أقرب معلم معروف ليسهل على مقدم الخدمة الوصول إليك.

مثال: الشارع، الحي، أقرب مسجد، مدرسة، دوار، متجر...`;

const selectDate =
`📅 *اختر التاريخ المناسب*`;

const selectTime =
`🕐 *اختر الوقت المناسب*`;

const phonePrompt =
`📱 *أرسل رقم هاتفك للتواصل*

مثال: 0599123456`;

function requestSummary(data, reqId) {
  const cat  = displayCategory(data.selected_category);
  const addr = data.sub_area
    ? `${data.location} - ${data.sub_area}`
    : (data.location || '—');

  return (
`📋 *ملخص طلب الخدمة*
━━━━━━━━━━━━━━━━━━

🔧 *نوع الخدمة:* ${cat}
📝 *وصف المشكلة:* ${trunc(data.problem_desc, 120) || '—'}
${data.photo_file_id ? '🖼 *الصورة المرفقة:* ✅\n' : ''}📍 *العنوان:* ${addr}
🏠 *التفاصيل:* ${data.detailed_addr || '—'}
📅 *التاريخ:* ${data.scheduled_date || '—'}
🕐 *الوقت:* ${data.scheduled_time || '—'}
📞 *هاتف التواصل:* ${data.client_phone || '—'}

🛡 يرجى التأكد من صحة جميع البيانات قبل الإرسال.`
  );
}

function requestSent(reqId) {
  return (
`✅ *تم إرسال طلبك بنجاح!*

شكراً لك، تم استلام طلبك بنجاح.
سيتم مراجعته من قبل فريقنا ومقدم الخدمة المناسب، وسنتواصل معك قريباً لتأكيد الموعد.

ℹ️ ستصلك رسالة عند قبول الطلب وتأكيد الموعد.`
  );
}

// ─── My Requests list ─────────────────────────────────────────────────────────
const STATUS_LABELS = {
  pending:    '🕐 قيد المراجعة',
  accepted:   '✅ تم القبول',
  on_the_way: '🚗 في الطريق',
  in_progress:'🔧 قيد التنفيذ',
  completed:  '✅ مكتمل',
  canceled:   '❌ ملغي',
  archived:   '📦 مؤرشف',
};

function requestCard(req) {
  const st = STATUS_LABELS[req.status] || req.status;
  return (
`#GS-${req.request_id}   ${st}

🔧 *نوع الخدمة:* ${displayCategory(req.extracted_category)}
📍 *العنوان:* ${req.location || '—'}${req.detailed_address ? `\n🏠 *التفاصيل:* ${trunc(req.detailed_address, 80)}` : ''}
📅 *تاريخ الطلب:* ${formatDate(req.created_at)}`
  );
}

function requestDetail(req) {
  const st = STATUS_LABELS[req.status] || req.status;
  return (
`📋 *تفاصيل الطلب*
#GS-${req.request_id}
━━━━━━━━━━━━━━━━━━

🔧 *نوع الخدمة:* ${displayCategory(req.extracted_category)}
📝 *وصف المشكلة:* ${req.problem_description || '—'}
📍 *العنوان:* ${req.location || '—'}${req.detailed_address ? `\n🏠 *التفاصيل:* ${req.detailed_address}` : ''}
📅 *التاريخ:* ${req.scheduled_date || '—'}
🕐 *الوقت:* ${req.scheduled_time || '—'}
📌 *الحالة:* ${st}
📆 *أُرسل في:* ${formatDate(req.created_at)}`
  );
}

// ─── Technician notifications ─────────────────────────────────────────────────
function jobNotification(req) {
  const now = new Date().toLocaleString('ar', { timeZone: 'Asia/Gaza' });
  return (
`🔔 *طلب خدمة جديد*
━━━━━━━━━━━━━━━━━━

👤 *اسم العميل:* ${req.client_name || 'مستخدم'}
🔧 *نوع الخدمة:* ${displayCategory(req.extracted_category)}
📍 *المنطقة:* ${req.location || '—'}
${req.detailed_address ? `🏠 *العنوان:* ${req.detailed_address}\n` : ''}📅 *الموعد:* ${req.scheduled_date || '—'} — ${req.scheduled_time || '—'}
📝 *وصف المشكلة:*
${trunc(req.problem_description, 200) || '—'}

📆 ${now}

⚡ اختر أحد الخيارات:`
  );
}

function clientAcceptedMsg(tech, reqId) {
  const avg = Number(tech.rating_avg);
  return (
`✅ *تم تعيين مقدم خدمة لطلبك!*
🎉 #GS-${reqId}

تم تعيين مقدم خدمة مناسب لطلبك.
سيتم التواصل معك قريباً لتأكيد الموعد والتفاصيل.

👤 *مقدم الخدمة*
━━━━━━━━━━━━━━━━
👤 الاسم: ${tech.full_name}
⚡ التخصص: ${displayCategory(tech.category)}
⭐ التقييم: ${avg > 0 ? `${starBar(avg)} (${avg.toFixed(1)})` : 'لا يوجد تقييم بعد'}
📞 رقم الهاتف: ${tech.phone_number}
━━━━━━━━━━━━━━━━

ℹ️ سيتواصل مقدم الخدمة معك خلال وقت قصير لتأكيد الموعد.`
  );
}

function techClientData(req, client) {
  return (
`📞 *بيانات العميل — تم قبول الطلب*
━━━━━━━━━━━━━━━━
👤 *الاسم:* ${client?.full_name || 'مستخدم'}
📞 *رقم الهاتف:* ${req.client_phone || client?.phone_number || '—'}
📍 *المنطقة:* ${req.location || '—'}
${req.detailed_address ? `🏠 *العنوان:* ${req.detailed_address}\n` : ''}📅 *الموعد:* ${req.scheduled_date || '—'} — ${req.scheduled_time || '—'}`
  );
}

function statusUpdateToClient(status, reqId) {
  const msgs = {
    on_the_way:  `🚗 *مقدم الخدمة في الطريق إليك!*\n#GS-${reqId}\nمقدم الخدمة في طريقه إلى موقعك الآن.`,
    in_progress: `🔧 *جاري تنفيذ الخدمة*\n#GS-${reqId}\nمقدم الخدمة يعمل الآن على إصلاح المشكلة.`,
    completed:   `🎉 *تم إنجاز الخدمة بنجاح!*\n#GS-${reqId}\nشكراً لاستخدامك غزة سيرف.\n\nكيف تقيّم الخدمة؟`,
  };
  return msgs[status] || `تم تحديث حالة طلبك #GS-${reqId}.`;
}

// ─── Registration ─────────────────────────────────────────────────────────────
const regStep1 =
`📝 *تسجيل كمقدم خدمة*
━━━━━━━━━━━━━━━━

*الخطوة 1/4:* أدخل اسمك الثلاثي
مثال: محمد أحمد علي`;

const regStep2 =
`*الخطوة 2/4:* أرسل رقم هاتفك
مثال: 0599123456`;

const regStep3 = `*الخطوة 3/4:* اختر تخصصك المهني:`;
const regStep4 = `*الخطوة 4/4:* اختر منطقة عملك:`;

function regSubmitted(name) {
  return (
`✅ *تم إرسال طلب تسجيلك!*

أهلاً ${name} 👋
سيتم مراجعة طلبك من قبل الإدارة وسيصلك إشعار عند الموافقة.`
  );
}

function adminNewTechMsg(tech, ctx) {
  return (
`🆕 *طلب تسجيل مقدم خدمة جديد*
━━━━━━━━━━━━━━━━
👤 *الاسم:* ${tech.full_name}
📞 *الهاتف:* ${tech.phone_number}
🔧 *التخصص:* ${displayCategory(tech.category)}
📍 *المنطقة:* ${tech.location}
🔗 *حساب تيليجرام:* [${ctx.from.first_name}](tg://user?id=${ctx.from.id})`
  );
}

// ─── Support ──────────────────────────────────────────────────────────────────
const supportIntro =
`🎧 *تواصل مع المشرف*
━━━━━━━━━━━━━━━━

صف مشكلتك أو استفسارك بالتفصيل وسيتم إرسالها لفريق الدعم.

مثال: "لا أستطيع تقديم طلب خدمة"
مثال: "مقدم الخدمة لم يصل في الموعد"`;

function supportTicketSent(id) {
  return `✅ *تم إرسال رسالتك بنجاح!*\nرقم المحادثة: #${id}\n\nسيتم الرد عليك في أقرب وقت ممكن.`;
}

function adminNewTicket(ticket, user) {
  return (
`🚨 *رسالة دعم جديدة*
━━━━━━━━━━━━━━━━
رقم: #${ticket.ticket_id}
👤 المستخدم: ${user?.full_name || 'مستخدم'}
📝 الرسالة:
${ticket.message}`
  );
}

module.exports = {
  welcome, selectCategory, descPrompt, photoPrompt, photoReceived,
  selectSubArea, addrPrompt, selectDate, selectTime, phonePrompt,
  requestSummary, requestSent, requestCard, requestDetail,
  STATUS_LABELS,
  jobNotification, clientAcceptedMsg, techClientData, statusUpdateToClient,
  regStep1, regStep2, regStep3, regStep4, regSubmitted, adminNewTechMsg,
  supportIntro, supportTicketSent, adminNewTicket,
};
