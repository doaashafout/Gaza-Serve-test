require('dotenv').config();

const express = require('express');
const apiConfig = require('./src/config/api');
const { router: webhookRouter, setBot } = require('./src/routes/webhook');
const sequelize = require('./src/config/database');
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

    // Sync database tables (create if not exist)
    try {
      await sequelize.authenticate();
      await sequelize.sync();
      console.log('[DB] Database synced.');
    } catch (err) {
      console.warn('[DB] Sync failed:', err.message);
    }

    // Migrate: add new columns to existing tables
    try {
      await sequelize.query('ALTER TABLE service_requests ADD COLUMN location VARCHAR(100) DEFAULT NULL AFTER extracted_category');
    } catch (_) {}
    try {
      await sequelize.query('ALTER TABLE service_requests ADD COLUMN detailed_address VARCHAR(300) DEFAULT NULL AFTER location');
    } catch (_) {}
    try {
      await sequelize.query("ALTER TABLE technicians ADD COLUMN is_available BOOLEAN NOT NULL DEFAULT TRUE");
    } catch (_) {}
    try {
      await sequelize.query("ALTER TABLE technicians ADD COLUMN rating_avg DECIMAL(3,2) NOT NULL DEFAULT 0.00");
    } catch (_) {}
    try {
      await sequelize.query("ALTER TABLE technicians ADD COLUMN status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending'");
    } catch (_) {}
    try {
      await sequelize.query("UPDATE technicians SET status = 'approved' WHERE status IS NULL OR status = ''");
    } catch (_) {}
    try {
      await sequelize.query("ALTER TABLE service_requests MODIFY COLUMN status ENUM('pending','accepted','on_the_way','in_progress','completed','canceled') NOT NULL DEFAULT 'pending'");
    } catch (_) {}
    try {
      await sequelize.query('ALTER TABLE service_requests ADD COLUMN photo_file_id VARCHAR(500) DEFAULT NULL AFTER voice_note_url');
    } catch (_) {}
    console.log('[DB] Migrations applied.');

    // Normalize existing categories (strip emojis from stored data)
    try {
      const { cleanCategory } = require('./src/views/FormView');
      const { Op } = require('sequelize');
      const catRows = await Request.findAll({
        attributes: ['request_id', 'extracted_category'],
        where: { extracted_category: { [Op.notLike]: '' } },
      });
      for (const row of catRows) {
        const cleaned = cleanCategory(row.extracted_category);
        if (cleaned !== row.extracted_category) {
          await row.update({ extracted_category: cleaned });
        }
      }
      const techRows = await Technician.findAll({
        attributes: ['tech_id', 'category'],
        where: { category: { [Op.notLike]: '' } },
      });
      for (const row of techRows) {
        const cleaned = cleanCategory(row.category);
        if (cleaned !== row.category) {
          await row.update({ category: cleaned });
        }
      }
      console.log('[DB] Categories normalized.');
    } catch (err) {
      console.warn('[DB] Category normalization skipped:', err.message);
    }

    // Set persistent Menu button commands
    if (apiConfig.TELEGRAM_BOT_TOKEN && apiConfig.TELEGRAM_BOT_TOKEN !== 'your_telegram_bot_token_here') {
      try {
        await bot.telegram.setMyCommands([
          { command: 'start', description: '🏠 القائمة الرئيسية' },
          { command: 'help', description: '❓ المساعدة' },
          { command: 'register', description: '📋 تسجيل فني' },
          { command: 'tasks', description: '📌 مهامي' },
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
