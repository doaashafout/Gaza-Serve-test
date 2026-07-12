const { Technician, Request, User } = require('../Models');

async function handleAdminApprove(ctx, techId) {
  try {
    if (String(ctx.from.id) !== String(require('../config/api').ADMIN_ID)) {
      return ctx.reply('❌ ليس لديك صلاحية للقيام بهذا الإجراء.');
    }

    const tech = await Technician.findByPk(techId);
    if (!tech) return ctx.reply('لم يتم العثور على الفني.');

    tech.status = 'approved';
    await tech.save();

    await ctx.telegram.sendMessage(techId, `✅ *تم قبول طلب تسجيلك!*\n\nأهلاً بك في شبكة فنيي GazaServe.\nسيصلك إشعار عند وجود طلبات صيانة تطابق تخصصك ومنطقتك.`, { parse_mode: 'Markdown' });

    return ctx.reply(`✅ تم قبول الفني ${tech.full_name}.`);
  } catch (err) {
    console.error('[TechnicianController] Admin approve error:', err);
    return ctx.reply('❌ حدث خطأ.');
  }
}

async function handleAdminReject(ctx, techId) {
  try {
    if (String(ctx.from.id) !== String(require('../config/api').ADMIN_ID)) {
      return ctx.reply('❌ ليس لديك صلاحية للقيام بهذا الإجراء.');
    }

    const tech = await Technician.findByPk(techId);
    if (!tech) return ctx.reply('لم يتم العثور على الفني.');

    tech.status = 'rejected';
    await tech.save();

    await ctx.telegram.sendMessage(techId, `❌ *عذراً، لم يتم قبول طلب تسجيلك كفني.*\n\nيمكنك التواصل مع الإدارة للمزيد من المعلومات.`, { parse_mode: 'Markdown' });

    return ctx.reply(`❌ تم رفض الفني ${tech.full_name}.`);
  } catch (err) {
    console.error('[TechnicianController] Admin reject error:', err);
    return ctx.reply('❌ حدث خطأ.');
  }
}

async function handleAcceptRequest(ctx, requestId) {
  try {
    const request = await Request.findByPk(requestId);
    if (!request || request.status !== 'pending') {
      return ctx.reply('هذا الطلب لم يعد متاحاً.');
    }
    if (request.tech_id && Number(request.tech_id) !== Number(ctx.from.id)) {
      return ctx.reply('تم اختيار فني آخر لهذا الطلب.');
    }

    request.tech_id = ctx.from.id;
    request.status = 'accepted';
    await request.save();

    const technician = await Technician.findByPk(ctx.from.id);
    const client = await User.findByPk(request.client_id);

    if (client) {
      const { displayCategory } = require('../views/FormView');
      await ctx.telegram.sendMessage(client.user_id, `
✅ *تم قبول طلبك!*

*الفني:* ${technician.full_name}
*رقم الهاتف:* ${technician.phone_number}
*التخصص:* ${displayCategory(technician.category)}
${request.detailed_address ? `📍 *عنوانك المسجل:* ${request.detailed_address}` : ''}

*حالة الطلب:* ✅ تم القبول`, { parse_mode: 'Markdown' });
    }

    const { displayCategory } = require('../views/FormView');
    const { Markup } = require('telegraf');
    return ctx.reply(`
📞 *تم قبول الطلب - بيانات الزبون*

*الاسم:* ${client.full_name}
*رقم الهاتف:* ${client.phone_number}
*المنطقة:* ${client.location}
${request.detailed_address ? `*العنوان:* ${request.detailed_address}\n` : ''}`, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🚗 على الطريق', `onway_${request.request_id}`)],
      ]),
    });
  } catch (err) {
    console.error('[TechnicianController] Accept error:', err);
    return ctx.reply('حدث خطأ أثناء قبول الطلب.');
  }
}

async function handleRejectRequest(ctx, requestId) {
  try {
    const request = await Request.findByPk(requestId);
    if (!request) return ctx.reply('❌ الطلب غير موجود.');
    if (request.status !== 'pending') return ctx.reply('هذا الطلب لم يعد متاحاً.');

    const rejectingTech = await Technician.findByPk(ctx.from.id);
    const rejectingTechName = rejectingTech ? rejectingTech.full_name : 'الفني';

    // Find another matching tech (same category, location, approved, not the one who rejected)
    const anotherTech = await Technician.findOne({
      where: {
        category: request.extracted_category,
        location: request.location,
        status: 'approved',
        tech_id: { [require('sequelize').Op.ne]: ctx.from.id },
      },
      order: [['created_at', 'DESC']],
    });

    const client = await User.findByPk(request.client_id);

    if (anotherTech) {
      // Send notification to the next tech
      const { sendJobNotification } = require('../views/NotificationView');
      const { displayCategory } = require('../views/FormView');
      const notificationData = {
        request_id: request.request_id,
        client_name: client ? client.full_name : 'مستخدم',
        extracted_category: request.extracted_category,
        location: request.location,
        detailed_address: request.detailed_address,
        problem_description: (request.problem_description || '').substring(0, 200),
        photo_file_id: request.photo_file_id || null,
      };
      const nextTechChatId = Number(anotherTech.tech_id);
      const techCtx = { telegram: ctx.telegram, from: { id: nextTechChatId } };

      try {
        await sendJobNotification(techCtx, notificationData);
      } catch (notifyErr) {
        console.error('[TechnicianController] notify next tech failed:', notifyErr.message);
        // Fall through - still set tech_id
      }

      // Assign to the new tech
      request.tech_id = nextTechChatId;
      await request.save();

      // Notify the client
      if (client) {
        try {
          await ctx.telegram.sendMessage(client.user_id,
            `❌ تم رفض طلب الصيانة رقم #${request.request_id} من قبل ${rejectingTechName}.\n`
            + `✅ تم تحويل الطلب إلى الفني *${anotherTech.full_name}*.\n`
            + `⏳ يرجى انتظار قبوله.`,
            { parse_mode: 'Markdown' });
        } catch (_) {}
      }

      return ctx.reply('❌ تم رفض الطلب.', { parse_mode: 'Markdown' });
    }

    // No other techs available
    request.tech_id = null;
    request.status = 'pending';
    await request.save();

    if (client) {
      try {
        await ctx.telegram.sendMessage(client.user_id,
          `❌ رفض ${rejectingTechName} الطلب #${request.request_id}.\n`
          + `😔 لا يوجد فنيين متاحين حالياً في منطقتك. سيتم إشعارك عندما يتوفر فني.`);
      } catch (_) {}
    }
    return ctx.reply('❌ تم رفض الطلب. لا يوجد فنيين آخرين متاحين.', { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('[TechnicianController] Reject error:', err.message);
    return ctx.reply('حدث خطأ أثناء رفض الطلب.');
  }
}

async function handleTasks(ctx) {
  try {
    const tasks = await Request.findAll({
      where: { tech_id: ctx.from.id, status: ['accepted', 'on_the_way', 'in_progress'] },
      order: [['created_at', 'DESC']],
    });

    if (!tasks || tasks.length === 0) {
      return ctx.reply('📭 لا توجد مهام حالية.', { parse_mode: 'Markdown' });
    }

    for (const task of tasks) {
      const { displayCategory } = require('../views/FormView');
      const { Markup } = require('telegraf');
      const statusLabels = {
        accepted: '✅ تم القبول',
        on_the_way: '🚗 في الطريق',
        in_progress: '🔧 قيد التنفيذ',
      };
      const text = `🆔 *#${task.request_id}*
📋 *${displayCategory(task.extracted_category)}*
📍 ${task.location || 'غير محدد'}
📝 ${(task.problem_description || '').substring(0, 100)}
📌 *الحالة:* ${statusLabels[task.status] || task.status}`;

      let buttons = [];
      if (task.status === 'accepted') {
        buttons = [[Markup.button.callback('🚗 على الطريق', `onway_${task.request_id}`)]];
      } else if (task.status === 'on_the_way') {
        buttons = [[Markup.button.callback('🔧 قيد التنفيذ', `progress_${task.request_id}`)]];
      } else if (task.status === 'in_progress') {
        buttons = [[Markup.button.callback('✅ إتمام المهمة', `complete_${task.request_id}`)]];
      }

      await ctx.reply(text, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons),
      });
    }
  } catch (err) {
    console.error('[TechnicianController] Tasks error:', err);
    return ctx.reply('حدث خطأ أثناء جلب المهام.');
  }
}

async function handleOnTheWay(ctx, requestId) {
  try {
    const request = await Request.findOne({
      where: { request_id: requestId, tech_id: ctx.from.id },
    });

    if (!request) {
      return ctx.reply('لم يتم العثور على الطلب أو غير مصرح لك.');
    }

    if (request.status !== 'accepted') {
      return ctx.reply('لا يمكن تحديث الحالة. الحالة الحالية: ' + request.status);
    }

    request.status = 'on_the_way';
    await request.save();

    const client = await User.findByPk(request.client_id);
    if (client) {
      await ctx.telegram.sendMessage(client.user_id, `
🚗 *الفني في الطريق إليك!*

الفني في طريقه إليك الآن.
📍 ${request.location || 'المنطقة المحددة'}
${request.detailed_address ? `*العنوان:* ${request.detailed_address}` : ''}`, { parse_mode: 'Markdown' });
    }

    const { Markup } = require('telegraf');
    return ctx.reply('✅ *تم تحديث الحالة:* 🚗 في الطريق', {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🔧 قيد التنفيذ', `progress_${request.request_id}`)],
      ]),
    });
  } catch (err) {
    console.error('[TechnicianController] OnTheWay error:', err);
    return ctx.reply('حدث خطأ أثناء تحديث الحالة.');
  }
}

async function handleInProgress(ctx, requestId) {
  try {
    const request = await Request.findOne({
      where: { request_id: requestId, tech_id: ctx.from.id },
    });

    if (!request) {
      return ctx.reply('لم يتم العثور على الطلب أو غير مصرح لك.');
    }

    if (request.status !== 'on_the_way') {
      return ctx.reply('لا يمكن تحديث الحالة. الحالة الحالية: ' + request.status);
    }

    request.status = 'in_progress';
    await request.save();

    const client = await User.findByPk(request.client_id);
    if (client) {
      await ctx.telegram.sendMessage(client.user_id, `
🔧 *بدأ الفني بالعمل!*

الفني بدأ بالعمل على طلبك الآن.
سيتم إشعارك عند الانتهاء.`, { parse_mode: 'Markdown' });
    }

    const { Markup } = require('telegraf');
    return ctx.reply('✅ *تم تحديث الحالة:* 🔧 قيد التنفيذ', {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('✅ إتمام المهمة', `complete_${request.request_id}`)],
      ]),
    });
  } catch (err) {
    console.error('[TechnicianController] InProgress error:', err);
    return ctx.reply('حدث خطأ أثناء تحديث الحالة.');
  }
}

async function handleCompleteRequest(ctx, requestId) {
  try {
    const request = await Request.findOne({
      where: { request_id: requestId, tech_id: ctx.from.id },
    });

    if (!request) {
      return ctx.reply('لم يتم العثور على الطلب أو غير مصرح لك.');
    }

    request.status = 'completed';
    await request.save();

    const client = await User.findByPk(request.client_id);
    if (client) {
      await ctx.telegram.sendMessage(client.user_id, '✅ *تم إكمال طلبك بنجاح!*\n\nنأمل أن تكون الخدمة قد نالت رضاك. شكراً لثقتك بـ GazaServe!', { parse_mode: 'Markdown' });
      await request.update({ is_archived: true, status: 'archived' });
    }

    return ctx.reply('✅ تم تحديث حالة الطلب إلى "مكتمل". شكراً لعملك!');
  } catch (err) {
    console.error('[TechnicianController] Complete error:', err);
    return ctx.reply('حدث خطأ أثناء تحديث حالة الطلب.');
  }
}

module.exports = {
  handleAcceptRequest,
  handleRejectRequest,
  handleTasks,
  handleOnTheWay,
  handleInProgress,
  handleCompleteRequest,
  handleAdminApprove,
  handleAdminReject,
};
