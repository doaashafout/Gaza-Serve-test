'use strict';
const { formatDate, starBar, trunc } = require('../utils');
const { displayCategory, STATUS_LABELS, STATUS_EMOJI } = require('./keyboards');

function welcome(firstName) {
  return (
`👋 *مرحباً ${firstName || 'بك'}*
🏠 أهلاً بك في *غزة سيرف*

أنا هنا لمساعدتك في طلب أي خدمة منزلية بسهولة وسرعة.

اختر نوع الخدمة التي تحتاجها:`
  );
}

const selectCategory =
`🏠 *طلب خدمة جديدة*

أنا هنا لمساعدتك في طلب أي خدمة منزلية بسهولة وسرعة.

اختر نوع الخدمة التي تحتاجها:`;

function descPrompt(category) {
  return (
`✅ اخترت: *${displayCategory(category)}*

📝 *يرجى وصف المشكلة التي تواجهها بالتفصيل* لنتمكن من إرسال طلبك للمشرف بدقة.`
  );
}

const photoPrompt =
`✅ شكراً لك.

📷 إذا كانت لديك صورة توضح المشكلة يمكنك إرسالها الآن، أو تخطي هذه الخطوة:`;

const photoReceived =
`✅ تم استلام الصورة بنجاح.
الخطوة التالية: تحديد منطقتك وعنوانك.

الآن يرجى تحديد منطقتك الرئيسية:`;

function selectSubArea(region) {
  return `اختر المحافظة داخل منطقة ${region}:`;
}

function addrPrompt(location) {
  return (
`📍 *المنطقة:* ${location}

✍️ يرجى كتابة عنوانك بالتفصيل مع أقرب معلم معروف ليسهل على مقدم الخدمة الوصول إليك.

مثال: الشارع، الحي، أقرب مسجد، مدرسة، دوار، متجر...`
  );
}

const selectDate = `📅 *اختر التاريخ المناسب*`;
const selectTime = `🕐 *اختر الوقت المناسب*`;

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
━ ━ ━ ━ ━ ━ ━ ━ ━ ━ ━ ━ ━

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

function requestCard(req) {
  const st = STATUS_LABELS[req.status] || req.status;
  const icon = STATUS_EMOJI[req.status] || '📋';
  return (
`━ ━ ━ ━ ━ ━ ━ ━ ━ ━ ━ ━ ━
#GS-${req.request_id}   ${st}

${icon} *نوع الخدمة:* ${displayCategory(req.extracted_category)}
📍 *المنطقة:* ${req.location || '—'}${req.detailed_address ? `\n🏠 *التفاصيل:* ${trunc(req.detailed_address, 80)}` : ''}
📅 *تاريخ الطلب:* ${formatDate(req.created_at)}`
  );
}

function requestDetail(req) {
  const st = STATUS_LABELS[req.status] || req.status;
  const icon = STATUS_EMOJI[req.status] || '📋';

  return (
`📋 *تفاصيل الطلب*
#GS-${req.request_id}   ${st}
━ ━ ━ ━ ━ ━ ━ ━ ━ ━ ━ ━ ━

*▸ تفاصيل الخدمة*
🔧 *نوع الخدمة:* ${displayCategory(req.extracted_category)}
📝 *وصف المشكلة:* ${req.problem_description || '—'}
${req.photo_file_id ? `🖼 *الصورة المرفقة:* ✅\n` : ''}
*▸ الموقع*
📍 *المنطقة:* ${req.location || '—'}
${req.detailed_address ? `🏠 *العنوان:* ${req.detailed_address}\n` : ''}
*▸ الموعد*
📅 *التاريخ:* ${req.scheduled_date || '—'}
🕐 *الوقت:* ${req.scheduled_time || '—'}

*▸ خط سير الطلب*
${_timeline(req)}
📆 *أُرسل في:* ${formatDate(req.created_at)}`
  );
}

function _timeline(req) {
  const statusOrder = ['pending', 'accepted', 'on_the_way', 'in_progress', 'completed'];
  const statusIndex = statusOrder.indexOf(req.status);
  const idx = statusIndex >= 0 ? statusIndex : 0;

  const steps = [
    { icon: '📩', label: 'تم إرسال الطلب', key: 'pending' },
    { icon: '📋', label: 'تم استلام الطلب', key: 'pending' },
    { icon: '🟡', label: 'قيد المراجعة', key: 'pending' },
    { icon: '👤', label: 'تعيين مقدم خدمة', key: 'accepted' },
    { icon: '🚗', label: 'مقدم الخدمة في الطريق', key: 'on_the_way' },
    { icon: '🔧', label: 'جاري تنفيذ الخدمة', key: 'in_progress' },
    { icon: '✅', label: 'تم إنجاز الخدمة', key: 'completed' },
  ];

  const lines = [];
  for (let i = 0; i < steps.length; i++) {
    const done = statusOrder.indexOf(steps[i].key) <= idx;
    const ts = (done && i === idx)
      ? `  (${formatDate(req.updated_at) || 'الآن'})`
      : '';
    lines.push(`${done ? '✅' : '⚪'} ${steps[i].icon} ${steps[i].label}${ts}`);
  }
  return lines.join('\n');
}

function jobNotification(req) {
  const now = new Date().toLocaleString('ar', { timeZone: 'Asia/Gaza' });
  return (
`🔔 *طلب خدمة جديد*
━ ━ ━ ━ ━ ━ ━ ━ ━ ━ ━ ━ ━

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
  const star = avg > 0 ? `${starBar(avg)} ${avg.toFixed(1)}` : 'لا يوجد تقييم بعد';
  return (
`✅ *تم تعيين مقدم خدمة لطلبك!*
🎉 #GS-${reqId}

تم تعيين مقدم خدمة مناسب لطلبك.
سيتم التواصل معك قريباً لتأكيد الموعد والتفاصيل.

👤 *مقدم الخدمة*
━ ━ ━ ━ ━ ━ ━ ━ ━ ━ ━ ━ ━
👤 الاسم: ${tech.full_name}
⚡ نوع الخدمة: ${displayCategory(tech.category)}
⭐ التقييم: ${star}
📞 رقم الهاتف: ${tech.phone_number}
━ ━ ━ ━ ━ ━ ━ ━ ━ ━ ━ ━ ━

ℹ️ سيتواصل مقدم الخدمة معك خلال وقت قصير لتأكيد الموعد وللإجابة على أي استفسارات.`
  );
}

function techClientData(req, client) {
  return (
`📞 *بيانات العميل — تم قبول الطلب*
━ ━ ━ ━ ━ ━ ━ ━ ━ ━ ━ ━ ━
👤 *الاسم:* ${client?.full_name || 'مستخدم'}
📞 *رقم الهاتف:* ${req.client_phone || client?.phone_number || '—'}
📍 *المنطقة:* ${req.location || '—'}
${req.detailed_address ? `🏠 *العنوان:* ${req.detailed_address}\n` : ''}📅 *الموعد:* ${req.scheduled_date || '—'} — ${req.scheduled_time || '—'}`
  );
}

function statusUpdateToClient(status, reqId, extra) {
  const msgs = {
    on_the_way:
`🚗 *مقدم الخدمة في الطريق إليك!*
#GS-${reqId}

مقدم الخدمة في طريقه إلى موقعك الآن.${extra ? `
━━━━━━━━━━━━━━━━
👤 الاسم: ${extra.full_name || ''}
📞 الهاتف: ${extra.phone || ''}
🚗 رقم المركبة: ${extra.vehicle || '—'}
━━━━━━━━━━━━━━━━
📍 المسافة المتبقية: ${extra.distance || '—'}
⏱ وقت الوصول المتوقع: ${extra.eta || '—'}` : ''}`,

    in_progress:
`🔧 *جاري تنفيذ الخدمة*
#GS-${reqId}

مقدم الخدمة يعمل الآن على إصلاح المشكلة.
سنعلمك فور الانتهاء.`,

    completed:
`🎉 *تم إنجاز الخدمة بنجاح!*
#GS-${reqId}

شكراً لاستخدامك غزة سيرف.

كيف تقيّم الخدمة؟`,
  };
  return msgs[status] || `تم تحديث حالة طلبك #GS-${reqId}.`;
}

const regStep1 =
`📝 *تسجيل كمقدم خدمة*
━ ━ ━ ━ ━ ━ ━ ━ ━ ━ ━ ━ ━

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
━ ━ ━ ━ ━ ━ ━ ━ ━ ━ ━ ━ ━
👤 *الاسم:* ${tech.full_name}
📞 *الهاتف:* ${tech.phone_number}
🔧 *التخصص:* ${displayCategory(tech.category)}
📍 *المنطقة:* ${tech.location}
🔗 *حساب تيليجرام:* [${ctx.from.first_name}](tg://user?id=${ctx.from.id})`
  );
}

const supportIntro =
`🎧 *تواصل مع المشرف*
━ ━ ━ ━ ━ ━ ━ ━ ━ ━ ━ ━ ━

صف مشكلتك أو استفسارك بالتفصيل وسيتم إرسالها لفريق الدعم.

مثال: "لا أستطيع تقديم طلب خدمة"
مثال: "مقدم الخدمة لم يصل في الموعد"`;

function supportTicketSent(id) {
  return `✅ *تم إرسال رسالتك بنجاح!*\nرقم المحادثة: #${id}\n\nسيتم الرد عليك في أقرب وقت ممكن.`;
}

function adminNewTicket(ticket, user) {
  return (
`🚨 *رسالة دعم جديدة*
━ ━ ━ ━ ━ ━ ━ ━ ━ ━ ━ ━ ━
رقم: #${ticket.ticket_id}
👤 المستخدم: ${user?.full_name || 'مستخدم'}
📝 الرسالة:
${ticket.message}`
  );
}

function adminReplySent(ticketId) {
  return `✉️ *الرد على المحادثة #${ticketId}*\n\nاكتب ردك الآن:`;
}

module.exports = {
  welcome, selectCategory, descPrompt, photoPrompt, photoReceived,
  selectSubArea, addrPrompt, selectDate, selectTime, phonePrompt,
  requestSummary, requestSent, requestCard, requestDetail,
  jobNotification, clientAcceptedMsg, techClientData, statusUpdateToClient,
  regStep1, regStep2, regStep3, regStep4, regSubmitted, adminNewTechMsg,
  supportIntro, supportTicketSent, adminNewTicket, adminReplySent,
};
