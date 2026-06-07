const { Markup } = require('telegraf');

/**
 * NotificationView - Job notifications and status messages
 */

function sendJobNotification(ctx, requestData) {
  const { displayCategory } = require('./FormView');
  const cat = displayCategory(requestData.extracted_category);
  const now = new Date().toLocaleString('ar', { timeZone: 'Asia/Gaza' });

  const notificationText =
`🔔 *طلب صيانة جديد*

👤 *الزبون:* ${requestData.client_name || 'مستخدم'}
🔧 *نوع الخدمة:* ${cat}
📍 *المنطقة:* ${requestData.location}${requestData.sub_area ? ` - ${requestData.sub_area}` : ''}
${requestData.detailed_address ? `🏠 *العنوان:* ${requestData.detailed_address}\n` : ''}📝 *وصف المشكلة:*
${requestData.problem_description || 'لا يوجد وصف'}

📅 *تاريخ الطلب:* ${now}

⚡ اختر أحد الخيارات:`;

  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ قبول الطلب', `accept_${requestData.request_id}`),
      Markup.button.callback('❌ رفض الطلب', `reject_${requestData.request_id}`),
    ],
  ]);

  if (requestData.photo_file_id) {
    return ctx.telegram.sendPhoto(ctx.from.id, requestData.photo_file_id, {
      caption: notificationText,
      parse_mode: 'Markdown',
      ...keyboard,
    });
  }

  return ctx.telegram.sendMessage(ctx.from.id, notificationText, {
    parse_mode: 'Markdown',
    ...keyboard,
  });
}

function sendRequestSummary(ctx, data, requestId) {
  const { displayCategory } = require('./FormView');
  const text =
`📋 *ملخص طلب الخدمة*
━━━━━━━━━━━━━━━━━━

🔧 *نوع الخدمة:* ${displayCategory(data.selected_category)}
📝 *وصف المشكلة:* ${data.problem_desc || '—'}
${data.photo_file_id ? '🖼 *الصورة المرفقة:* ✅ تم إرفاق صورة\n' : ''}📍 *العنوان:* ${data.location || '—'}${data.sub_area ? ` - ${data.sub_area}` : ''}
${data.detailed_address ? `🏠 *التفاصيل:* ${data.detailed_address}\n` : ''}
🛡 يرجى التأكد من صحة جميع البيانات قبل الإرسال.`;

  return ctx.reply(text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('✅ تأكيد وإرسال الطلب', `confirm_request_${requestId || 'new'}`)],
      [Markup.button.callback('✏️ تعديل البيانات', 'back_main')],
    ]),
  });
}

function sendAcceptanceToClient(ctx, technicianData, requestId) {
  const starsDisplay = technicianData.rating_avg > 0
    ? `${'⭐'.repeat(Math.round(technicianData.rating_avg))} (${Number(technicianData.rating_avg).toFixed(1)})`
    : 'لا يوجد تقييم بعد';

  const text =
`✅ *تم تعيين مقدم خدمة لطلبك!*
🎉 #GS-${requestId}

تم تعيين مقدم خدمة مناسب لطلبك.
سيتم التواصل معك قريباً لتأكيد الموعد والتفاصيل.

👤 *مقدم الخدمة*
━━━━━━━━━━━━━━━━
👤 الاسم: ${technicianData.full_name}
⚡ نوع الخدمة: ${technicianData.category}
⭐ التقييم: ${starsDisplay}
📞 رقم الهاتف: ${technicianData.phone_number}
━━━━━━━━━━━━━━━━

ℹ️ سيتواصل مقدم الخدمة معك خلال وقت قصير لتأكيد الموعد وللإجابة على أي استفسارات.`;

  return ctx.reply(text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback('📋 تفاصيل الطلب', `my_requests`),
        Markup.button.callback('+ خدمة جديدة', 'new_request'),
      ],
    ]),
  });
}

function sendClientContactToTechnician(ctx, clientData) {
  const text =
`📞 *بيانات الزبون - تم قبول الطلب*

👤 *الاسم:* ${clientData.full_name}
📞 *رقم الهاتف:* ${clientData.phone_number}
📍 *الموقع:* ${clientData.location}${clientData.detailed_address ? `\n🏠 *العنوان:* ${clientData.detailed_address}` : ''}`;

  return ctx.reply(text, { parse_mode: 'Markdown' });
}

function sendRequestStatusUpdate(ctx, requestId, status, techName) {
  const statusMessages = {
    accepted: `✅ *تم قبول طلبك #GS-${requestId}*\n\n👨‍🔧 الفني *${techName}* وافق على الطلب.\nسيتم التواصل معك قريباً.`,
    on_the_way: `🚗 *مقدم الخدمة في الطريق إليك!*\n\n#GS-${requestId}\nالفني *${techName}* في طريقه إلى موقعك الآن.`,
    in_progress: `🔧 *جاري تنفيذ الخدمة*\n\n#GS-${requestId}\nالفني *${techName}* يعمل الآن على إصلاح المشكلة.`,
    completed: `✅ *تم إنجاز الخدمة بنجاح!*\n\n#GS-${requestId}\nشكراً لاستخدامك غزة سيرف.\nهل يمكنك تقييم الخدمة؟`,
  };

  const msg = statusMessages[status] || `تحديث حالة الطلب #GS-${requestId}: ${status}`;
  return ctx.telegram
    ? ctx.telegram.sendMessage(ctx.from?.id || ctx.chat?.id, msg, { parse_mode: 'Markdown' })
    : ctx.reply(msg, { parse_mode: 'Markdown' });
}

function sendOrderStatus(ctx, requests) {
  if (!requests || requests.length === 0) {
    return ctx.reply('📭 لا توجد طلبات حالية.', { parse_mode: 'Markdown' });
  }

  let text = '*📊 حالة طلباتك:*\n\n';
  requests.forEach((req, index) => {
    const statusMap = {
      pending: '⏳ قيد الانتظار',
      accepted: '✅ تم القبول',
      on_the_way: '🚗 الفني في الطريق',
      in_progress: '🔧 قيد التنفيذ',
      completed: '✔️ مكتمل',
      canceled: '❌ ملغي',
    };
    text += `${index + 1}. *${req.extracted_category}*\n`;
    text += `   الحالة: ${statusMap[req.status] || req.status}\n`;
    text += `   التاريخ: ${new Date(req.created_at).toLocaleDateString('ar-EG')}\n\n`;
  });

  return ctx.reply(text, { parse_mode: 'Markdown' });
}

module.exports = {
  sendJobNotification,
  sendRequestSummary,
  sendAcceptanceToClient,
  sendClientContactToTechnician,
  sendRequestStatusUpdate,
  sendOrderStatus,
};
