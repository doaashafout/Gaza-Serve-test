require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const apiConfig = require('./src/config/api');
const { router: webhookRouter, setBot } = require('./src/routes/webhook');
const dashboardRouter = require('./src/routes/dashboard');
const adminRouter = require('./src/routes/admin');
const sequelize = require('./src/config/database');
const { User, Technician, Request, Rating } = require('./src/Models');
const bot = require('./src/bot');
const path = require('path');

// Prevent crash on unhandled rejections
process.on('unhandledRejection', (err) => {
  console.error('[Process] Unhandled rejection:', err.message);
});

const app = express();

// Security middleware
app.use(helmet());
app.use(cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Logging
app.use(morgan('short'));

app.use(express.json({ limit: '1mb' }));
app.use('/chart.js', express.static('node_modules/chart.js/dist/chart.umd.min.js'));
app.use('/', webhookRouter);
app.use('/', dashboardRouter);
app.use('/api/admin', adminRouter);

// Serve React admin build
const adminDist = path.join(__dirname, 'admin', 'dist');
const fs = require('fs');
app.use('/admin', (req, res, next) => {
  const filePath = path.join(adminDist, req.path.replace(/^\/admin\//, ''));
  if (fs.existsSync(filePath) && !fs.statSync(filePath).isDirectory()) {
    return res.sendFile(filePath);
  }
  next();
});
app.get('/admin', (req, res) => res.redirect('/admin/'));
app.get(/^\/admin/, (req, res) => {
  res.sendFile(path.join(adminDist, 'index.html'));
});

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
    // Create admins table
    try {
      await sequelize.query(`CREATE TABLE IF NOT EXISTS admins (
        admin_id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        telegram_id BIGINT NOT NULL UNIQUE,
        role ENUM('super_admin','support_admin','moderator') DEFAULT 'moderator',
        is_active BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    } catch (_) {}
    // Create activity_logs table
    try {
      await sequelize.query(`CREATE TABLE IF NOT EXISTS activity_logs (
        log_id INT AUTO_INCREMENT PRIMARY KEY,
        admin_id INT DEFAULT NULL,
        action VARCHAR(100) NOT NULL,
        details TEXT DEFAULT NULL,
        target_type VARCHAR(50) DEFAULT NULL,
        target_id INT DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    } catch (_) {}
    // Seed default categories if empty
    try {
      const catCount = await sequelize.query("SELECT COUNT(*) as c FROM categories", { type: sequelize.QueryTypes.SELECT });
      if (catCount[0].c === 0) {
        const defaultCats = [
          ['كهرباء', 'Electricity', '⚡'],
          ['سباكة', 'Plumbing', '🔧'],
          ['تبريد وتكييف', 'Air Conditioning', '❄️'],
          ['نجارة', 'Carpentry', '🪚'],
          ['دهان', 'Painting', '🎨'],
          ['بناء', 'Construction', '🏗️'],
          ['حدادة', 'Blacksmith', '🔩'],
          ['زجاج', 'Glass Work', '🪟'],
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

    // Set persistent Menu button commands
    if (apiConfig.TELEGRAM_BOT_TOKEN && apiConfig.TELEGRAM_BOT_TOKEN !== 'your_telegram_bot_token_here') {
      try {
        await bot.telegram.setMyCommands([
          { command: 'start', description: '🏠 القائمة الرئيسية' },
          { command: 'help', description: '❓ المساعدة' },
          { command: 'register', description: '📋 تسجيل فني' },
          { command: 'tasks', description: '📌 مهامي' },
          { command: 'support', description: '📞 الدعم الفني' },
          { command: 'myid', description: '🆔 معرفي' },
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
