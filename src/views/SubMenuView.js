const { Markup } = require('telegraf');

const SUBMENUS = {
  'كهرباء': [
    '🔌 تمديدات كهربائية',
    '⚙️ إصلاح أعطال الكهرباء',
    '💡 تركيب قواطع ومفاتيح',
    '🔋 صيانة UPS / إنفرتر',
    '🔧 تصليح بطاريات الإنفرتر / الليدات',
  ],
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

  const rows = items.map((item, i) => [Markup.button.callback(item, `sub_${parentIndex}_${i}`)]);
  rows.push([Markup.button.callback('⬅️ رجوع', `back_sub_${parentIndex}`)]);

  return ctx.reply('⚡ *خدمات الكهرباء*\nاختر الخدمة المطلوبة 👇', {
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
