const { Markup } = require('telegraf');
const { Category } = require('../Models');

// Gaza geographical areas
const LOCATIONS = [
  'غزة - الشمال',
  'غزة - الوسطى',
  'غزة - الجنوب',
  'غزة - المدينة',
  'خان يونس',
  'رفح',
  'دير البلح',
  'جباليا',
];

let _categoriesCache = null;
let _categoriesCleanCache = null;
let _emojiMapCache = null;

async function _loadCategories() {
  try {
    const cats = await Category.findAll({ order: [['name_ar', 'ASC']] });
    if (cats.length === 0) return _useDefaults();
    _categoriesCache = cats.map(c => `${c.icon || '🔧'} ${c.name_ar}`);
    _categoriesCleanCache = cats.map(c => c.name_ar);
    _emojiMapCache = {};
    cats.forEach(c => { _emojiMapCache[c.name_ar] = c.icon || '🔧'; });
  } catch (_) {
    _useDefaults();
  }
}

function _useDefaults() {
  _categoriesCache = ['🔧 سباكة', '⚡ كهرباء', '☀️ طاقة شمسية', '❄️ تبريد وتكييف'];
  _categoriesCleanCache = ['سباكة', 'كهرباء', 'طاقة شمسية', 'تبريد وتكييف'];
  _emojiMapCache = { 'سباكة': '🔧', 'كهرباء': '⚡', 'طاقة شمسية': '☀️', 'تبريد وتكييف': '❄️' };
}

function getCategories() {
  if (!_categoriesCache) _loadCategories();
  return _categoriesCache || _useDefaults();
}

function getCategoriesClean() {
  if (!_categoriesCleanCache) _loadCategories();
  return _categoriesCleanCache || _useDefaults();
}

function getEmojiMap() {
  if (!_emojiMapCache) _loadCategories();
  return _emojiMapCache || _useDefaults();
}

function cleanCategory(cat) {
  const clean = getCategoriesClean();
  for (const c of clean) {
    if (cat.includes(c)) return c;
  }
  return cat.replace(/[^\u0600-\u06FF\s]/g, '').trim();
}

function displayCategory(cat) {
  const emoji = getEmojiMap()[cat] || '';
  return emoji ? `${emoji} ${cat}` : cat;
}

function sendCategorySelection(ctx, text = 'اختر تخصص الخدمة المطلوبة:') {
  const cats = getCategories();
  const buttons = [];
  for (let i = 0; i < cats.length; i += 2) {
    const row = [Markup.button.callback(cats[i], `cat_${i}`)];
    if (cats[i + 1]) row.push(Markup.button.callback(cats[i + 1], `cat_${i + 1}`));
    buttons.push(row);
  }
  return ctx.reply(text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons),
  });
}

setInterval(() => { _categoriesCache = null; _categoriesCleanCache = null; _emojiMapCache = null; }, 60000);

module.exports = {
  cleanCategory,
  displayCategory,
  sendCategorySelection,
  getCategories,
  getCategoriesClean,
  LOCATIONS,
};
