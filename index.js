'use strict';
require('dotenv').config();

const express  = require('express');
const helmet   = require('helmet');
const cors     = require('cors');
const morgan   = require('morgan');
const path     = require('path');

const apiConfig              = require('./src/config/api');
const sequelize              = require('./src/config/database');
const { router: webhook, setBot } = require('./src/routes/webhook');
const apiRouter              = require('./src/routes/api');
const bot                    = require('./src/bot');

// ─── Crash guards ─────────────────────────────────────────────────────────────
process.on('unhandledRejection', err => console.error('[Process] unhandledRejection:', err?.message));
process.on('uncaughtException',  err => console.error('[Process] uncaughtException:',  err?.message));

// ─── Express setup ────────────────────────────────────────────────────────────
const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(morgan('short'));
app.use(express.json({ limit: '2mb' }));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/',    webhook);
app.use('/api', apiRouter);

// Health check
app.get('/health', (_, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// Serve static admin dashboard if present
const adminDist = path.join(__dirname, 'admin', 'dist');
app.use('/admin', express.static(adminDist));
app.get(/^\/admin/, (_, res) => res.sendFile(path.join(adminDist, 'index.html')));

// ─── Startup ──────────────────────────────────────────────────────────────────
async function start() {
  // 1. DB connect + sync
  try {
    await sequelize.authenticate();
    await sequelize.sync({ alter: false });
    console.log('[DB] Connected and synced');
  } catch (err) {
    console.error('[DB] Connection failed:', err.message);
  }

  // 2. Register bot with webhook handler
  setBot(bot);

  // 3. Check webhook info
  try {
    const wh = await bot.telegram.getWebhookInfo();
    console.log('[Bot] Current webhook info:', JSON.stringify(wh));
  } catch (e) {
    console.warn('[Bot] Could not get webhook info:', e.message);
  }

  // 4. Register Telegram menu commands
  try {
    await bot.telegram.setMyCommands([
      { command: 'start',    description: '🏠 القائمة الرئيسية' },
      { command: 'tasks',    description: '📌 مهامي (للفنيين)' },
      { command: 'register', description: '🔧 تسجيل كمقدم خدمة' },
      { command: 'support',  description: '🎧 التواصل مع المشرف' },
      { command: 'archive',  description: '📦 الطلبات المؤرشفة' },
      { command: 'myid',     description: '🆔 معرفي' },
    ]);
    console.log('[Bot] Menu commands set');
  } catch (e) {
    console.warn('[Bot] Could not set commands:', e.message);
  }

  // 5. Webhook vs Polling
  const useWebhook =
    apiConfig.SERVER_URL &&
    !apiConfig.SERVER_URL.includes('your-domain') &&
    apiConfig.TELEGRAM_BOT_TOKEN &&
    !apiConfig.TELEGRAM_BOT_TOKEN.includes('your_telegram');

  console.log('[Bot] SERVER_URL:', apiConfig.SERVER_URL || '(not set)');
  console.log('[Bot] useWebhook:', useWebhook);

  if (useWebhook) {
    const webhookUrl = `${apiConfig.SERVER_URL}/webhook`;
    try {
      const r = await bot.telegram.setWebhook(webhookUrl);
      console.log('[Bot] setWebhook result:', JSON.stringify(r));
      console.log('[Bot] Webhook →', webhookUrl);
    } catch (e) {
      console.error('[Bot] Webhook failed:', e.message);
    }
  } else {
    try {
      const r = await bot.telegram.deleteWebhook();
      console.log('[Bot] deleteWebhook result:', JSON.stringify(r));
    } catch (_) {}
    bot.launch();
    console.log('[Bot] Polling mode started');
  }

  // 6. Start HTTP server
  app.listen(apiConfig.PORT, () => {
    console.log(`[Server] GazaServe v2 running on port ${apiConfig.PORT} (${apiConfig.NODE_ENV})`);
  });
}

start();

// Graceful shutdown
process.once('SIGINT',  () => { bot.stop('SIGINT');  process.exit(0); });
process.once('SIGTERM', () => { bot.stop('SIGTERM'); process.exit(0); });

module.exports = app;
