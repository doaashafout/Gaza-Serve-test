/**
 * State Manager Middleware
 * Tracks the current conversation state for each Telegram chat ID.
 * Telegram is stateless, so this middleware maintains session state in memory.
 */

const states = {};
const conversations = {};

// --- System States (matching design document) ---
const STATE = {
  IDLE: 'IDLE',
  AWAITING_REG_NAME: 'AWAITING_REG_NAME',
  AWAITING_REG_PHONE: 'AWAITING_REG_PHONE',
  AWAITING_REG_CATEGORY: 'AWAITING_REG_CATEGORY',
  AWAITING_REG_LOCATION: 'AWAITING_REG_LOCATION',
  AWAITING_PROBLEM_DESC: 'AWAITING_PROBLEM_DESC',
  AWAITING_REQ_DESC: 'AWAITING_REQ_DESC',
  AWAITING_REQ_NAME: 'AWAITING_REQ_NAME',
  AWAITING_REQ_MAIN_REGION: 'AWAITING_REQ_MAIN_REGION',
  AWAITING_REQ_SUB_REGION: 'AWAITING_REQ_SUB_REGION',
  AWAITING_REQ_LOCATION: 'AWAITING_REQ_LOCATION',
  AWAITING_REQ_DETAILED_ADDR: 'AWAITING_REQ_DETAILED_ADDR',
  AWAITING_REQ_PHONE: 'AWAITING_REQ_PHONE',
  AWAITING_REQ_DATE: 'AWAITING_REQ_DATE',
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
