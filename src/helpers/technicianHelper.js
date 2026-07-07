const { Technician } = require('../Models');

async function isRegisteredTechnician(userId) {
  try {
    const tech = await Technician.findByPk(userId);
    return !!tech;
  } catch (err) {
    console.error('[Helper] isRegisteredTechnician error:', err.message);
    return false;
  }
}

async function getTechnicianStatus(userId) {
  try {
    const tech = await Technician.findByPk(userId);
    return tech ? tech.status : null;
  } catch (err) {
    console.error('[Helper] getTechnicianStatus error:', err.message);
    return null;
  }
}

const CLIENT_COMMANDS = [
  { command: 'start', description: '🏠 القائمة الرئيسية' },
  { command: 'newrequest', description: '🔧 طلب خدمة جديدة' },
  { command: 'myorders', description: '📄 طلباتي' },
  { command: 'register', description: '👨‍🔧 تسجيل كفني' },
  { command: 'about', description: 'ℹ️ عن المنصة' },
  { command: 'support', description: '📞 التواصل مع الدعم الفني' },
  { command: 'help', description: '❓ كيفية الاستخدام' },
];

const TECHNICIAN_COMMANDS = [
  { command: 'start', description: '🏠 القائمة الرئيسية' },
  { command: 'newrequest', description: '🔧 طلب خدمة (كعميل)' },
  { command: 'mytasks', description: '📋 مهامي كفني' },
  { command: 'myorders', description: '📄 طلباتي (كعميل)' },
  { command: 'unsubscribe', description: '❌ إلغاء الاشتراك كفني' },
  { command: 'about', description: 'ℹ️ عن المنصة' },
  { command: 'support', description: '📞 التواصل مع الدعم الفني' },
  { command: 'help', description: '❓ كيفية الاستخدام' },
];

async function syncUserCommands(bot, userId) {
  try {
    const isTech = await isRegisteredTechnician(userId);
    const commands = isTech ? TECHNICIAN_COMMANDS : CLIENT_COMMANDS;
    await bot.telegram.setMyCommands(commands, {
      scope: { type: 'chat', chat_id: userId },
    });
  } catch (err) {
    console.error('[Helper] syncUserCommands error:', err.message);
  }
}

async function setDefaultCommands(bot) {
  try {
    await bot.telegram.setMyCommands(CLIENT_COMMANDS);
  } catch (err) {
    console.error('[Helper] setDefaultCommands error:', err.message);
  }
}

module.exports = { isRegisteredTechnician, getTechnicianStatus, syncUserCommands, setDefaultCommands, CLIENT_COMMANDS, TECHNICIAN_COMMANDS };
