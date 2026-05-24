/**
 * State Manager Middleware
 * Tracks the current conversation state for each Telegram chat ID.
 * Telegram is stateless, so this middleware maintains session state in memory.
 */

const states = {};

// --- System States (matching design document) ---
const STATE = {
  IDLE: 'IDLE',
  AWAITING_REG_NAME: 'AWAITING_REG_NAME',
  AWAITING_REG_PHONE: 'AWAITING_REG_PHONE',
  AWAITING_REG_CATEGORY: 'AWAITING_REG_CATEGORY',
  AWAITING_REG_LOCATION: 'AWAITING_REG_LOCATION',
  AWAITING_CONFIRMATION_CODE: 'AWAITING_CONFIRMATION_CODE',
  AWAITING_PROBLEM_DESC: 'AWAITING_PROBLEM_DESC',
  AWAITING_REQ_DESC: 'AWAITING_REQ_DESC',
  AWAITING_REQ_PHONE: 'AWAITING_REQ_PHONE',
  AWAITING_REQ_LOCATION: 'AWAITING_REQ_LOCATION',
  AWAITING_REQ_DETAILED_ADDR: 'AWAITING_REQ_DETAILED_ADDR',
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
};
