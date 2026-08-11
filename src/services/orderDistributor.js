const { Op } = require('sequelize');
const { Technician, Request } = require('../Models');
const { Markup } = require('telegraf');
const { calculateWorkingHoursElapsed } = require('./workingHours');
const { MAIN_REGIONS_CLEAN, SUB_REGIONS } = require('../views/FormView');

const NEIGHBORING_REGIONS = {
  'شمال غزة': ['مدينة غزة'],
  'مدينة غزة': ['شمال غزة', 'الوسطى'],
  'الوسطى': ['مدينة غزة', 'خانيونس'],
  'خانيونس': ['الوسطى', 'رفح'],
  'رفح': ['خانيونس'],
};

const REVERSE_REGION_MAP = {};
for (const [display, clean] of Object.entries(MAIN_REGIONS_CLEAN)) {
  REVERSE_REGION_MAP[clean] = display;
}

function parseMainRegion(location) {
  const parts = location.split(' - ');
  return parts[0].trim();
}

function parseSubRegion(location) {
  const parts = location.split(' - ');
  return parts.length > 1 ? parts.slice(1).join(' - ').trim() : null;
}

function locationMatchesTech(techLocation, orderLocation) {
  const techMain = parseMainRegion(techLocation);
  const techSub = parseSubRegion(techLocation);
  const orderMain = parseMainRegion(orderLocation);
  const orderSub = parseSubRegion(orderLocation);

  if (techMain !== orderMain) return false;
  if (techSub && techSub !== orderSub) return false;
  return true;
}

function parseRejectedTechs(value) {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') {
    try { return JSON.parse(value).map(String); } catch (_) {}
  }
  return [];
}

async function findMatchingTechs(order, expandRegion = false) {
  const mainRegion = parseMainRegion(order.location);
  const subRegion = parseSubRegion(order.location);
  const category = order.extracted_category;
  const rejectedIds = parseRejectedTechs(order.rejected_techs);

  let targetRegions = [mainRegion];
  if (expandRegion) {
    const neighbors = NEIGHBORING_REGIONS[mainRegion] || [];
    targetRegions = [mainRegion, ...neighbors];
  }

  const allTechs = await Technician.findAll({
    where: {
      category,
      status: 'approved',
      is_available: true,
    },
  });

  return allTechs.filter((tech) => {
    if (rejectedIds.includes(String(tech.tech_id))) return false;
    for (const region of targetRegions) {
      if (tech.location === region || tech.location.startsWith(region + ' - ')) {
        if (!expandRegion && subRegion && tech.location.includes(' - ')) {
          if (!tech.location.includes(' - ' + subRegion)) continue;
        }
        return true;
      }
    }
    return false;
  });
}

function parseProblemDescription(desc) {
  let serviceLabel = '';
  let userDesc = '';
  let dateTime = '';
  if (!desc) return { serviceLabel, userDesc, dateTime };
  const dateMatch = desc.match(/\| الموعد: ([^|]*)$/);
  if (dateMatch) dateTime = dateMatch[1].trim();
  const descMatch = desc.match(/📝 وصف المشكلة: (.+?)(?:\s+\|)/);
  if (descMatch) userDesc = descMatch[1].trim();
  const serviceMatch = desc.match(/^طلب صيانة: (.+?) في /);
  if (serviceMatch) serviceLabel = serviceMatch[1].trim();
  return { serviceLabel, userDesc, dateTime };
}

async function notifyTechnicians(telegram, order, techs) {
  const { serviceLabel, userDesc, dateTime } = parseProblemDescription(order.problem_description || '');
  const mainText =
    `🔔 *طلب خدمة جديد #${order.request_id}*\n\n`
    + `⚡ *نوع الخدمة:* ${serviceLabel || order.extracted_category}\n\n`
    + `📍 *المنطقة:* ${order.location}\n\n`
    + (dateTime ? `📅 *التاريخ:* ${dateTime}\n` : '')
    + '\n'
    + (userDesc ? `📝 *وصف المشكلة:*\n"${userDesc}"\n\n` : '')
    + `⏱️ أول فني يقبل ياخد الطلب!`;

  const acceptBtn = Markup.button.callback('✅ قبول الطلب', `accept_order_${order.request_id}`);
  const rejectBtn = Markup.button.callback('❌ رفض', `reject_order_${order.request_id}`);
  const keyboard = Markup.inlineKeyboard([[acceptBtn, rejectBtn]]);

  let successCount = 0;
  for (const tech of techs) {
    try {
      if (order.photo_file_id) {
        await telegram.sendPhoto(tech.tech_id, order.photo_file_id, {
          caption: mainText,
          parse_mode: 'Markdown',
        });
        await telegram.sendMessage(tech.tech_id, 'اختر:', {
          reply_markup: { inline_keyboard: [[{ text: '✅ قبول الطلب', callback_data: `accept_order_${order.request_id}` }, { text: '❌ رفض', callback_data: `reject_order_${order.request_id}` }]] },
        });
      } else {
        await telegram.sendMessage(tech.tech_id, mainText, {
          parse_mode: 'Markdown',
          ...keyboard,
        });
      }
      successCount++;
    } catch (err) {
      console.warn(`[Distributor] Failed to notify tech ${tech.tech_id}: ${err.message}`);
    }
  }
  return successCount;
}

async function acceptOrderAtomic(telegram, requestId, techId) {
  const result = await Request.update(
    {
      status: 'accepted',
      tech_id: techId,
    },
    {
      where: {
        request_id: requestId,
        status: { [Op.in]: ['pending', 'escalated'] },
      },
    }
  );

  if (result[0] === 0) {
    return { success: false, reason: 'taken' };
  }

  const order = await Request.findByPk(requestId);
  const tech = await Technician.findByPk(techId);
  return { success: true, order, tech };
}

async function notifyOtherTechsTaken(telegram, requestId, excludeTechId) {
  const text = `✅ تم قبول الطلب رقم #${requestId} من فني آخر. شكراً لتفاعلك!`;
  const allTechs = await Technician.findAll({
    where: { status: 'approved', is_available: true },
  });

  for (const tech of allTechs) {
    if (tech.tech_id === excludeTechId) continue;
    try {
      await telegram.sendMessage(tech.tech_id, text, { parse_mode: 'Markdown' });
    } catch (_) {}
  }
}

async function notifyClientAccepted(telegram, order, tech) {
  const text =
    `✅ *تم قبول طلبك!*\n\n`
    + `🆔 رقم الطلب: #${order.request_id}\n`
    + `👨‍🔧 *الفني:* ${tech.full_name}\n`
    + `📞 *رقمه:* ${tech.phone_number}\n`
    + `🔧 *التخصص:* ${tech.category}\n\n`
    + `سيتم التواصل معك قريباً لتحديد موعد الزيارة.`;

  try {
    await telegram.sendMessage(order.client_id, text, { parse_mode: 'Markdown' });
  } catch (err) {
    console.warn(`[Distributor] Failed to notify client ${order.client_id}: ${err.message}`);
  }
}

async function notifyClientNoTechs(telegram, order) {
  const text =
    `😔 عذراً، لم يتم العثور على فنيين متاحين لمنطقتك حالياً.\n`
    + `سنواصل البحث وسنخبرك فور توفر فني مناسب.\n`
    + `🆔 رقم الطلب: #${order.request_id}`;
  try {
    await telegram.sendMessage(order.client_id, text, { parse_mode: 'Markdown' });
  } catch (_) {}
}

async function notifyClientStillSearching(telegram, order) {
  const text =
    `⏳ لسا عم نبحثلك عن فني مناسب، شوي وبنوصلك.\n`
    + `🆔 رقم الطلب: #${order.request_id}`;
  try {
    await telegram.sendMessage(order.client_id, text, { parse_mode: 'Markdown' });
  } catch (_) {}
}

async function notifyAdminGroup(telegram, adminId, order) {
  if (!adminId) return;
  const text =
    `⚠️ *طلب معلق منذ أكثر من 6 ساعات عمل*\n\n`
    + `🆔 رقم الطلب: #${order.request_id}\n`
    + `🔧 *الخدمة:* ${order.extracted_category}\n`
    + `📍 *الموقع:* ${order.location}\n`
    + `📝 *الوصف:* ${(order.problem_description || '').substring(0, 300)}\n`
    + `📅 *تم إنشاؤه:* ${order.created_at}\n`
    + `👤 *العميل:* ${order.client_id}`;
  try {
    await telegram.sendMessage(adminId, text, { parse_mode: 'Markdown' });
  } catch (_) {}
}

async function notifyClientSearchingNearby(telegram, order) {
  const text =
    `🔍 *جاري البحث عن فني*\n\n`
    + `لم نعثر على فني في منطقتك الحالية، لكن وجدنا فنيين في المناطق المجاورة.\n`
    + `سيصلك إشعار فور قبول أحدهم لطلبك.\n`
    + `🆔 رقم الطلب: #${order.request_id}`;
  try {
    await telegram.sendMessage(order.client_id, text, { parse_mode: 'Markdown' });
  } catch (_) {}
}

async function distributeOrder(telegram, order, adminId) {
  const local = await findMatchingTechs(order, false);
  if (local.length > 0) {
    const count = await notifyTechnicians(telegram, order, local);
    console.log(`[Distributor] Order #${order.request_id}: notified ${count}/${local.length} local techs`);
    return count;
  }

  // No exact-region tech: engage nearby (adjacent) regions immediately
  const nearby = await findMatchingTechs(order, true);
  if (nearby.length > 0) {
    const count = await notifyTechnicians(telegram, order, nearby);
    await notifyClientSearchingNearby(telegram, order);
    console.log(`[Distributor] Order #${order.request_id}: no local techs, notified ${count}/${nearby.length} nearby techs`);
    return count;
  }

  await notifyClientNoTechs(telegram, order);
  console.log(`[Distributor] Order #${order.request_id}: no matching techs found`);
  return 0;
}

async function escalateOrder(telegram, order, adminId) {
  const elapsed = calculateWorkingHoursElapsed(order.created_at);

  if (elapsed >= 6) {
    await notifyAdminGroup(telegram, adminId, order);
    await notifyClientStillSearching(telegram, order);
    return 'admin_alerted';
  }

  if (elapsed >= 3) {
    const techs = await findMatchingTechs(order, true);
    if (techs.length === 0) {
      console.log(`[Distributor] Escalation order #${order.request_id}: no expanded techs found`);
      return 'no_techs';
    }
    await notifyTechnicians(telegram, order, techs);
    console.log(`[Distributor] Escalation order #${order.request_id}: notified ${techs.length} expanded techs`);
    return 'expanded';
  }

  return 'not_yet';
}

module.exports = {
  findMatchingTechs,
  notifyTechnicians,
  acceptOrderAtomic,
  notifyOtherTechsTaken,
  notifyClientAccepted,
  notifyClientNoTechs,
  notifyClientStillSearching,
  notifyClientSearchingNearby,
  notifyAdminGroup,
  distributeOrder,
  escalateOrder,
  parseMainRegion,
  parseSubRegion,
};
