/**
 * Routes - Webhook handler for Telegram updates
 * Receives updates from Telegram servers and dispatches to controllers
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  message: { error: 'Too many requests' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Will be set from index.js to avoid circular dependency
let botInstance = null;

function setBot(bot) {
  botInstance = bot;
}

router.post('/webhook', webhookLimiter, (req, res) => {
  const update = req.body;
  if (!update) {
    return res.sendStatus(400);
  }

  console.log('[Webhook] Update received:', update?.update_id);

  if (botInstance) {
    botInstance.handleUpdate(update).catch((err) => {
      console.error('[Webhook] Error handling update:', err.message, err.stack);
    });
  }

  res.sendStatus(200);
});

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'GazaServe Bot',
  });
});

module.exports = { router, setBot };
