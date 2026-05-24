require('dotenv').config();

const express = require('express');
const apiConfig = require('./src/config/api');
const { router: webhookRouter, setBot } = require('./src/routes/webhook');
const { User, Technician, Request, Rating } = require('./src/Models');
const bot = require('./src/bot');

// Prevent crash on unhandled rejections
process.on('unhandledRejection', (err) => {
  console.error('[Process] Unhandled rejection:', err.message);
});

const app = express();
app.use(express.json());
app.use('/', webhookRouter);

async function start() {
  try {
    setBot(bot);

    // Set persistent Menu button commands
    if (apiConfig.TELEGRAM_BOT_TOKEN && apiConfig.TELEGRAM_BOT_TOKEN !== 'your_telegram_bot_token_here') {
      try {
        await bot.telegram.setMyCommands([
          { command: 'start', description: '🏠 القائمة الرئيسية' },
          { command: 'help', description: '❓ المساعدة' },
          { command: 'register', description: '📋 تسجيل فني' },
        ]);
        console.log('[Bot] Menu commands set.');
      } catch (err) {
        console.warn('[Bot] Could not set menu commands:', err.message);
      }
    }

    const useWebhook = apiConfig.SERVER_URL
      && apiConfig.SERVER_URL !== 'https://your-domain.com'
      && apiConfig.TELEGRAM_BOT_TOKEN
      && apiConfig.TELEGRAM_BOT_TOKEN !== 'your_telegram_bot_token_here';

    if (useWebhook) {
      const webhookUrl = `${apiConfig.SERVER_URL}/webhook`;
      await bot.telegram.setWebhook(webhookUrl);
      console.log(`[Bot] Webhook set to: ${webhookUrl}`);
    } else {
      console.log('[Bot] Starting in polling mode...');
      bot.launch();
    }

    app.listen(apiConfig.PORT, () => {
      console.log(`[Server] GazaServe running on port ${apiConfig.PORT}`);
      console.log(`[Server] Environment: ${apiConfig.NODE_ENV}`);
    });
  } catch (err) {
    console.error('[Startup] Failed:', err);
    process.exit(1);
  }
}

start();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

module.exports = app;
