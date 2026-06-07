/**
 * State Manager Middleware
 * Tracks the current conversation state for each Telegram chat ID.
 */

const states = {};
const conversations = {};

const STATE = {
  IDLE: 'IDLE',
  AWAITING_REG_NAME: 'AWAITING_REG_NAME',
  AWAITING_REG_PHONE: 'AWAITING_REG_PHONE',
  AWAITING_REG_CATEGORY: 'AWAITING_REG_CATEGORY',
  AWAITING_REG_LOCATION: 'AWAITING_REG_LOCATION',
  AWAITING_PROBLEM_DESC: 'AWAITING_PROBLEM_DESC',
  AWAITING_REQ_DESC: 'AWAITING_REQ_DESC',
  AWAITING_REQ_NAME: 'AWAITING_REQ_NAME',
  AWAITING_REQ_PHONE: 'AWAITING_REQ_PHONE',
  AWAITING_REQ_LOCATION: 'AWAITING_REQ_LOCATION',
  AWAITING_REQ_SUBAREA: 'AWAITING_REQ_SUBAREA',       // NEW: sub-area selection
  AWAITING_REQ_DETAILED_ADDR: 'AWAITING_REQ_DETAILED_ADDR',
  AWAITING_REQ_PHOTO: 'AWAITING_REQ_PHOTO',
  AWAITING_SUPPORT: 'AWAITING_SUPPORT',
  AWAITING_SUPPORT_REPLY: 'AWAITING_SUPPORT_REPLY',
};

function getState(chatId) {
  return states[chatId] || STATE.IDLE;
}

function setState(chatId, state) {
  states[chatId] = state;
}

function resetState(chatId) {
  delete states[chatId];
}

function getData(chatId) {
  return states[`${chatId}_data`] || {};
}

function setData(chatId, data) {
  states[`${chatId}_data`] = { ...getData(chatId), ...data };
}

function clearData(chatId) {
  delete states[`${chatId}_data`];
}

function resetAll(chatId) {
  resetState(chatId);
  clearData(chatId);
  delete conversations[chatId];
}

function addMessage(chatId, role, text) {
  if (!conversations[chatId]) conversations[chatId] = [];
  conversations[chatId].push({ role, text, timestamp: Date.now() });
  if (conversations[chatId].length > 10) {
    conversations[chatId] = conversations[chatId].slice(-10);
  }
}

function getHistory(chatId, count = 4) {
  const msgs = conversations[chatId] || [];
  return msgs.slice(-count);
}

// Cleanup old sessions after 2 hours to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  const TWO_HOURS = 2 * 60 * 60 * 1000;
  for (const key of Object.keys(conversations)) {
    const msgs = conversations[key];
    if (msgs.length > 0 && now - msgs[msgs.length - 1].timestamp > TWO_HOURS) {
      delete conversations[key];
      delete states[key];
      delete states[`${key}_data`];
    }
  }
}, 30 * 60 * 1000); // Run every 30 minutes

module.exports = {
  STATE,
  getState,
  setState,
  resetState,
  getData,
  setData,
  clearData,
  resetAll,
  addMessage,
  getHistory,
};
