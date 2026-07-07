const { Markup } = require('telegraf');

const SUBMENUS = {
  'الكهرباء': [
    '🔌 تمديدات كهربائية',
    '⚙️ إصلاح أعطال الكهرباء',
    '💡 تركيب قواطع ومفاتيح',
    '🔋 صيانة UPS / إنفرتر',
  ],
  'السباكة': [
    'تسليك مواسير',
    'تصليح تسريبات المياه',
    'تركيب سخانات',
    'تركيب حنفيات وخلاطات',
    'صيانة خزانات المياه',
  ],
  'التنظيف': [
    'تنظيف منازل',
    'تنظيف واجهات',
    'تنظيف خزانات مياه',
    'تنظيف سجاد وكنب',
  ],
  'الطاقة الشمسية': [
    'تركيب أنظمة طاقة شمسية',
    'صيانة ألواح شمسية',
    'تركيب بطاريات طاقة شمسية',
    '🔧 تصليح بطاريات الإنفرتر / الليدات',
  ],
  'الترميم والبناء': [
    'أعمال بناء',
    'ترميم وتشطيبات',
    'دهان',
    'تلييس وبلاط',
  ],
  'الألومنيوم والحدادة': [
    'أبواب وشبابيك ألمنيوم',
    'حدادة وأبواب حديد',
    'شبابيك حماية',
  ],
};

const SUBMENU_TITLES = {
  'الكهرباء': '⚡ *خدمات الكهرباء*',
  'السباكة': '🚰 *خدمات السباكة*',
  'التنظيف': '🧹 *خدمات التنظيف*',
  'الطاقة الشمسية': '☀️ *خدمات الطاقة الشمسية*',
  'الترميم والبناء': '🏗️ *خدمات الترميم والبناء*',
  'الألومنيوم والحدادة': '🪟 *خدمات الألومنيوم والحدادة*',
};

function hasSubmenu(category) {
  return !!SUBMENUS[category];
}

function getParentCategory(subServiceClean) {
  for (const [parent, items] of Object.entries(SUBMENUS)) {
    for (const item of items) {
      const clean = item.replace(/[^\u0600-\u06FF\s\/]/g, '').trim();
      if (clean === subServiceClean) return parent;
    }
  }
  return null;
}

function cleanSubService(subService) {
  return subService.replace(/[^\u0600-\u06FF\s\/]/g, '').trim();
}

function sendSubMenu(ctx, category, parentIndex) {
  const items = SUBMENUS[category];
  if (!items || items.length === 0) return null;

  const title = SUBMENU_TITLES[category] || `🔧 *خدمات ${category}*`;
  const rows = items.map((item, i) => [Markup.button.callback(item, `sub_${parentIndex}_${i}`)]);
  rows.push([Markup.button.callback('⬅️ رجوع', `back_sub_${parentIndex}`)]);

  return ctx.reply(title, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(rows),
  });
}

module.exports = {
  SUBMENUS,
  hasSubmenu,
  getParentCategory,
  cleanSubService,
  sendSubMenu,
};
