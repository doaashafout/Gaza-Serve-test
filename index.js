require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const apiConfig = require('./src/config/api');
const { router: webhookRouter, setBot } = require('./src/routes/webhook');
const apiRouter = require('./src/routes/api');
const sequelize = require('./src/config/database');
const { User, Technician, Request } = require('./src/Models');
const bot = require('./src/bot/index');

// Prevent crash on unhandled rejections
process.on('unhandledRejection', (err) => {
  console.error('[Process] Unhandled rejection:', err.message);
});

const app = express();

// Security middleware
app.use(helmet());
app.use(cors());

// Logging
app.use(morgan('short'));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/', webhookRouter);
app.use('/api', apiRouter);

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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
    // Ensure created_at exists on service_requests
    try {
      await sequelize.query('ALTER TABLE service_requests ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP');
    } catch (_) {}
    try {
      await sequelize.query('ALTER TABLE service_requests ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
    } catch (_) {}
    // Add is_archived flag to service_requests
    try {
      await sequelize.query("ALTER TABLE service_requests ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT FALSE AFTER photo_file_id");
    } catch (_) {}
    try {
      await sequelize.query("ALTER TABLE service_requests ADD COLUMN photo_url VARCHAR(500) DEFAULT NULL AFTER photo_file_id");
    } catch (_) {}
    try {
      await sequelize.query("ALTER TABLE service_requests MODIFY COLUMN status ENUM('pending','accepted','on_the_way','in_progress','completed','canceled','archived') NOT NULL DEFAULT 'pending'");
    } catch (_) {}
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
      await sequelize.query("ALTER TABLE technicians ADD COLUMN status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending'");
    } catch (_) {}
    // Add new technician registration fields
    try { await sequelize.query("ALTER TABLE technicians ADD COLUMN birth_date DATE DEFAULT NULL"); } catch (_) {}
    try { await sequelize.query("ALTER TABLE technicians ADD COLUMN gender ENUM('male','female') DEFAULT NULL"); } catch (_) {}
    try { await sequelize.query("ALTER TABLE technicians ADD COLUMN national_id_url VARCHAR(500) DEFAULT NULL"); } catch (_) {}
    try { await sequelize.query("ALTER TABLE technicians ADD COLUMN profile_photo_url VARCHAR(500) DEFAULT NULL"); } catch (_) {}
    try { await sequelize.query("ALTER TABLE technicians ADD COLUMN governorate VARCHAR(100) DEFAULT NULL"); } catch (_) {}
    try { await sequelize.query("ALTER TABLE technicians ADD COLUMN city VARCHAR(100) DEFAULT NULL"); } catch (_) {}
    try { await sequelize.query("ALTER TABLE technicians ADD COLUMN experience_years INT DEFAULT NULL"); } catch (_) {}
    try { await sequelize.query("ALTER TABLE technicians ADD COLUMN skills TEXT DEFAULT NULL"); } catch (_) {}
    try { await sequelize.query("ALTER TABLE technicians ADD COLUMN work_description TEXT DEFAULT NULL"); } catch (_) {}
    try { await sequelize.query("ALTER TABLE technicians ADD COLUMN certificates TEXT DEFAULT NULL COMMENT 'JSON array of certificate file URLs'"); } catch (_) {}
    try { await sequelize.query("ALTER TABLE technicians ADD COLUMN has_certificate BOOLEAN NOT NULL DEFAULT FALSE"); } catch (_) {}
    // Drop FK constraint on technicians.category (causes issues with custom service names)
    try { await sequelize.query('ALTER TABLE technicians DROP FOREIGN KEY technicians_ibfk_1'); } catch (_) {}
    try { await sequelize.query('ALTER TABLE technicians DROP INDEX technicians_ibfk_1'); } catch (_) {}
    try { await sequelize.query('ALTER TABLE technicians DROP INDEX category'); } catch (_) {}
    try {
      await sequelize.query("UPDATE technicians SET status = 'approved' WHERE status IS NULL OR status = ''");
    } catch (_) {}
    try {
      await sequelize.query("ALTER TABLE service_requests MODIFY COLUMN status ENUM('pending','accepted','on_the_way','in_progress','completed','canceled','archived') NOT NULL DEFAULT 'pending'");
    } catch (_) {}
    try {
      await sequelize.query(`CREATE TABLE IF NOT EXISTS support_tickets (
        ticket_id INT AUTO_INCREMENT PRIMARY KEY,
        user_id BIGINT NOT NULL,
        message TEXT NOT NULL,
        admin_reply TEXT DEFAULT NULL,
        status ENUM('open','replied','closed') NOT NULL DEFAULT 'open',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    } catch (_) {}
    // Add is_active to users (for block/unblock)
    try { await sequelize.query("ALTER TABLE users ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE"); } catch (_) {}
    // Create categories table
    try {
      await sequelize.query(`CREATE TABLE IF NOT EXISTS categories (
        category_id INT AUTO_INCREMENT PRIMARY KEY,
        name_ar VARCHAR(100) NOT NULL,
        name_en VARCHAR(100) NOT NULL,
        icon VARCHAR(10) DEFAULT '🔧',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    } catch (_) {}
    // Seed default categories if empty
    try {
      const catCount = await sequelize.query("SELECT COUNT(*) as c FROM categories", { type: sequelize.QueryTypes.SELECT });
      if (catCount[0].c === 0) {
        const defaultCats = [
          ['التنظيف', 'Cleaning', '🧹'],
          ['الكهرباء', 'Electricity', '⚡'],
          ['السباكة', 'Plumbing', '🚰'],
          ['الصيانة العامة', 'General Maintenance', '🔧'],
          ['الطاقة الشمسية', 'Solar Energy', '☀️'],
          ['الترميم والبناء', 'Restoration & Construction', '🏗️'],
          ['الألومنيوم والحدادة', 'Aluminum & Blacksmithing', '🪟'],
          ['نقل وتركيب الأثاث', 'Furniture Transport & Installation', '🚚'],
        ];
        for (const [ar, en, icon] of defaultCats) {
          await sequelize.query("INSERT INTO categories (name_ar, name_en, icon) VALUES (?, ?, ?)", { replacements: [ar, en, icon] });
        }
      }
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

    // Set persistent Menu button commands (default = client view)
    if (apiConfig.TELEGRAM_BOT_TOKEN && apiConfig.TELEGRAM_BOT_TOKEN !== 'your_telegram_bot_token_here') {
      try {
        const { setDefaultCommands } = require('./src/helpers/technicianHelper');
        await setDefaultCommands(bot);
        console.log('[Bot] Menu commands set.');
      } catch (err) {
        console.warn('[Bot] Could not set menu commands:', err.message);
      }
    }

    const useWebhook = apiConfig.SERVER_URL
      && apiConfig.SERVER_URL !== 'https://your-domain.com'
      && apiConfig.TELEGRAM_BOT_TOKEN
      && apiConfig.TELEGRAM_BOT_TOKEN !== 'your_telegram_bot_token_here'
      && process.env.FORCE_POLLING !== 'true';

    if (useWebhook) {
      const webhookUrl = `${apiConfig.SERVER_URL}/webhook`;
      await bot.telegram.setWebhook(webhookUrl);
      console.log(`[Bot] Webhook set to: ${webhookUrl}`);
    } else {
      console.log('[Bot] Starting in polling mode...');
      bot.launch();
    }

    const { startScheduler } = require('./src/services/scheduledJobs');
    startScheduler(bot.telegram, apiConfig.ADMIN_ID);

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
