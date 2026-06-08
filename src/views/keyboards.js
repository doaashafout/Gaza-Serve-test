'use strict';
const { Markup } = require('telegraf');

// ─── Main menu ───────────────────────────────────────────────────────────────
const mainMenu = () => Markup.inlineKeyboard([
  [Markup.button.callback('🏠 طلب خدمة جديدة',       'new_request')],
  [Markup.button.callback('📋 متابعة طلباتي',         'my_requests')],
  [Markup.button.callback('🎧 تواصل مع المشرف',       'support')],
  [Markup.button.callback('🔧 تسجيل كمقدم خدمة',     'register_tech')],
]);

// ─── Categories ──────────────────────────────────────────────────────────────
const CATEGORIES = [
  { ar: 'تنظيف منزل',    icon: '🧹' },
  { ar: 'كهرباء',        icon: '⚡' },
  { ar: 'سباكة',         icon: '🚿' },
  { ar: 'صيانة مكيفات', icon: '❄️' },
  { ar: 'صيانة عامة',   icon: '🔧' },
  { ar: 'دهان',          icon: '🎨' },
];

function categoryKeyboard() {
  const rows = CATEGORIES.map((c, i) => [
    Markup.button.callback(`${c.icon} ${c.ar}`, `cat_${i}`),
  ]);
  return Markup.inlineKeyboard(rows);
}

function displayCategory(name) {
  const c = CATEGORIES.find(x => x.ar === name);
  return c ? `${c.icon} ${c.ar}` : (name || '—');
}

function categoryFromIndex(i) {
  return CATEGORIES[i] ? CATEGORIES[i].ar : null;
}

// ─── Locations ───────────────────────────────────────────────────────────────
const REGIONS = [
  { label: '🕌 غزة (الشمال)',     value: 'غزة (الشمال)',     subs: ['جباليا', 'بيت لاهيا', 'بيت حانون'] },
  { label: '🏙 غزة (مدينة غزة)', value: 'غزة (مدينة غزة)', subs: ['الشجاعية', 'الرمال', 'التفاح', 'الزيتون', 'الشيخ رضوان'] },
  { label: '🕌 غزة (الوسطى)',     value: 'غزة (الوسطى)',     subs: ['النصيرات', 'الزوايدة', 'البريج', 'المغازي', 'دير البلح'] },
  { label: '🌴 غزة (الجنوب)',     value: 'غزة (الجنوب)',     subs: ['خان يونس', 'رفح', 'المواصي', 'عبسان'] },
];

function regionKeyboard() {
  return Markup.inlineKeyboard(
    REGIONS.map((r, i) => [Markup.button.callback(r.label, `region_${i}`)])
  );
}

function subAreaKeyboard(regionIndex) {
  const reg = REGIONS[regionIndex];
  if (!reg) return null;
  const rows = [];
  const subs = reg.subs;
  for (let i = 0; i < subs.length; i += 3) {
    rows.push(
      subs.slice(i, i + 3).map((s, j) =>
        Markup.button.callback(`📍 ${s}`, `sub_${regionIndex}_${i + j}`)
      )
    );
  }
  return Markup.inlineKeyboard(rows);
}

function regionFromIndex(i) {
  return REGIONS[i] ? REGIONS[i].value : null;
}

function subAreaFromIndex(regionIdx, subIdx) {
  const reg = REGIONS[regionIdx];
  return reg && reg.subs[subIdx] ? reg.subs[subIdx] : null;
}

// ─── Time slots ──────────────────────────────────────────────────────────────
const TIME_SLOTS = [
  '08:00 - 10:00 صباحاً',
  '10:00 - 12:00 ظهراً',
  '12:00 - 02:00 مساءً',
  '02:00 - 04:00 مساءً',
  '04:00 - 06:00 مساءً',
];

function timeKeyboard() {
  return Markup.inlineKeyboard(
    TIME_SLOTS.map((t, i) => [Markup.button.callback(`🕐 ${t}`, `time_${i}`)])
  );
}

function timeFromIndex(i) {
  return TIME_SLOTS[i] || null;
}

// ─── Photo step ──────────────────────────────────────────────────────────────
const photoKeyboard = () => Markup.inlineKeyboard([
  [Markup.button.callback('📷 إرسال صورة',        'add_photo')],
  [Markup.button.callback('⏭ تخطي هذه الخطوة',   'skip_photo')],
]);

// ─── Date step ───────────────────────────────────────────────────────────────
function dateKeyboard() {
  const today = new Date();
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const dayAfter  = new Date(today); dayAfter.setDate(today.getDate() + 2);

  const fmt = d => d.toLocaleDateString('ar', { timeZone: 'Asia/Gaza', weekday: 'short', day: 'numeric', month: 'short' });
  const iso  = d => d.toISOString().split('T')[0];

  return Markup.inlineKeyboard([
    [Markup.button.callback(`📅 اليوم — ${fmt(today)}`,       `date_${iso(today)}`)],
    [Markup.button.callback(`📅 غداً — ${fmt(tomorrow)}`,     `date_${iso(tomorrow)}`)],
    [Markup.button.callback(`📅 بعد غد — ${fmt(dayAfter)}`,   `date_${iso(dayAfter)}`)],
  ]);
}

// ─── Rating ──────────────────────────────────────────────────────────────────
function ratingKeyboard(requestId) {
  return Markup.inlineKeyboard([
    [1,2,3,4,5].map(s => Markup.button.callback('⭐'.repeat(s), `rate_${requestId}_${s}`)),
    [Markup.button.callback('⏭ تخطي التقييم', `skip_rate_${requestId}`)],
  ]);
}

// ─── Back to main ─────────────────────────────────────────────────────────────
const backMain = () => Markup.inlineKeyboard([
  [Markup.button.callback('🏠 القائمة الرئيسية', 'back_main')],
]);

module.exports = {
  mainMenu, categoryKeyboard, displayCategory, categoryFromIndex,
  REGIONS, regionKeyboard, subAreaKeyboard, regionFromIndex, subAreaFromIndex,
  TIME_SLOTS, timeKeyboard, timeFromIndex,
  photoKeyboard, dateKeyboard, ratingKeyboard, backMain,
  CATEGORIES,
};
