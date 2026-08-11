const { Markup } = require('telegraf');

/**
 * NotificationView - Job notifications and status messages for technicians
 */

function sendJobNotification(ctx, requestData) {
  const { displayCategory } = require('./FormView');
  const notificationText = `
🔔 *طلب صيانة جديد* 🔔

*نوع الخدمة:* ${displayCategory(requestData.extracted_category)}
*المنطقة:* ${requestData.location}
*وصف المشكلة:*
${requestData.problem_description}

🕐 تاريخ الطلب: ${new Date().toLocaleString('ar-EG')}

*اختر أحد الخيارات:*`;

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

function sendAcceptanceToClient(ctx, technicianData) {
  const text = `
✅ *تم قبول طلبك!*

*الفني:* ${technicianData.full_name}
*رقم الهاتف:* ${technicianData.phone_number}
*التخصص:* ${technicianData.category}`;

  return ctx.reply(text, { parse_mode: 'Markdown' });
}

function sendClientContactToTechnician(ctx, clientData) {
  const text = `
📞 *تم قبول الطلب - بيانات الزبون*

*الاسم:* ${clientData.full_name}
*رقم الهاتف:* ${clientData.phone_number}
*الموقع:* ${clientData.location}`;

  return ctx.reply(text, { parse_mode: 'Markdown' });
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
  sendAcceptanceToClient,
  sendClientContactToTechnician,
  sendOrderStatus,
};
