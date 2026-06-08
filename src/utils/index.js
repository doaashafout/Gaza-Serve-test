function formatDate(date, locale = 'ar-EG') {
  if (!date) return '—';
  try {
    return new Date(date).toLocaleDateString(locale);
  } catch {
    return '—';
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function truncate(str, maxLen = 200) {
  if (!str) return '';
  return str.length > maxLen ? str.substring(0, maxLen) : str;
}

module.exports = { formatDate, sleep, truncate };
