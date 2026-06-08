'use strict';
/**
 * StateManager — in-memory session store per Telegram user
 * Stores: current state + form data + chat history
 */

const _states = {};   // chatId → STATE string
const _data   = {};   // chatId → plain object
const _history= {};   // chatId → [{role,text,ts}]

const STATE = {
  IDLE:                    'IDLE',
  // Client request flow
  AWAITING_REQ_DESC:       'AWAITING_REQ_DESC',
  AWAITING_REQ_PHOTO:      'AWAITING_REQ_PHOTO',
  AWAITING_REQ_LOCATION:   'AWAITING_REQ_LOCATION',
  AWAITING_REQ_SUBAREA:    'AWAITING_REQ_SUBAREA',
  AWAITING_REQ_ADDR:       'AWAITING_REQ_ADDR',
  AWAITING_REQ_DATE:       'AWAITING_REQ_DATE',
  AWAITING_REQ_TIME:       'AWAITING_REQ_TIME',
  AWAITING_REQ_PHONE:      'AWAITING_REQ_PHONE',
  // AI free-text
  AWAITING_PROBLEM_DESC:   'AWAITING_PROBLEM_DESC',
  // Technician registration
  AWAITING_REG_NAME:       'AWAITING_REG_NAME',
  AWAITING_REG_PHONE:      'AWAITING_REG_PHONE',
  AWAITING_REG_CATEGORY:   'AWAITING_REG_CATEGORY',
  AWAITING_REG_LOCATION:   'AWAITING_REG_LOCATION',
  // Support
  AWAITING_SUPPORT:        'AWAITING_SUPPORT',
  AWAITING_SUPPORT_REPLY:  'AWAITING_SUPPORT_REPLY',
};

function getState(id)      { return _states[id] || STATE.IDLE; }
function setState(id, s)   { _states[id] = s; }
function resetState(id)    { delete _states[id]; }

function getData(id)       { return _data[id] || {}; }
function setData(id, obj)  { _data[id] = { ...getData(id), ...obj }; }
function clearData(id)     { delete _data[id]; }

function resetAll(id) {
  resetState(id);
  clearData(id);
  delete _history[id];
}

function addMsg(id, role, text) {
  if (!_history[id]) _history[id] = [];
  _history[id].push({ role, text, ts: Date.now() });
  if (_history[id].length > 12) _history[id] = _history[id].slice(-12);
}
function getHistory(id, n = 6) {
  return (_history[id] || []).slice(-n);
}

// Cleanup sessions idle > 3 h
setInterval(() => {
  const cutoff = Date.now() - 3 * 60 * 60 * 1000;
  for (const id of Object.keys(_history)) {
    const msgs = _history[id];
    if (msgs.length && msgs[msgs.length - 1].ts < cutoff) {
      delete _history[id]; delete _states[id]; delete _data[id];
    }
  }
}, 30 * 60 * 1000);

module.exports = { STATE, getState, setState, resetState, getData, setData, clearData, resetAll, addMsg, getHistory };
