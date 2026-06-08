'use strict';
const express = require('express');
const router  = express.Router();
let _bot = null;

function setBot(bot) { _bot = bot; }

router.post('/webhook', (req, res) => {
  if (!_bot) return res.sendStatus(503);
  try {
    _bot.handleUpdate(req.body, res);
  } catch (err) {
    console.error('[webhook]', err.message);
    res.sendStatus(500);
  }
});

module.exports = { router, setBot };
