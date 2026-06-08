'use strict';
/**
 * initDb.js — Run once to create tables, apply migrations, seed defaults.
 * Usage: node src/config/initDb.js
 */
require('dotenv').config();
const sequelize = require('./database');

const MIGRATIONS = [
  // service_requests
  `CREATE TABLE IF NOT EXISTS service_requests (
    request_id          INT AUTO_INCREMENT PRIMARY KEY,
    client_id           BIGINT NOT NULL,
    tech_id             BIGINT DEFAULT NULL,
    extracted_category  VARCHAR(100) NOT NULL,
    location            VARCHAR(150) DEFAULT NULL,
    detailed_address    VARCHAR(400) DEFAULT NULL,
    problem_description TEXT DEFAULT NULL,
    photo_file_id       VARCHAR(500) DEFAULT NULL,
    scheduled_date      DATE DEFAULT NULL,
    scheduled_time      VARCHAR(30) DEFAULT NULL,
    client_phone        VARCHAR(25) DEFAULT NULL,
    status ENUM('pending','accepted','on_the_way','in_progress','completed','canceled','archived')
           NOT NULL DEFAULT 'pending',
    is_archived         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // users
  `CREATE TABLE IF NOT EXISTS users (
    user_id      BIGINT PRIMARY KEY,
    full_name    VARCHAR(150) NOT NULL DEFAULT 'مستخدم',
    phone_number VARCHAR(25)  NOT NULL DEFAULT '—',
    location     VARCHAR(100) DEFAULT NULL,
    username     VARCHAR(100) DEFAULT NULL,
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // technicians
  `CREATE TABLE IF NOT EXISTS technicians (
    tech_id      BIGINT PRIMARY KEY,
    full_name    VARCHAR(150) NOT NULL,
    phone_number VARCHAR(25)  NOT NULL,
    category     VARCHAR(100) NOT NULL,
    location     VARCHAR(100) NOT NULL,
    username     VARCHAR(100) DEFAULT NULL,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    rating_avg   DECIMAL(3,2) NOT NULL DEFAULT 0.00,
    total_jobs   INT NOT NULL DEFAULT 0,
    status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // ratings
  `CREATE TABLE IF NOT EXISTS ratings (
    rating_id  INT AUTO_INCREMENT PRIMARY KEY,
    request_id INT NOT NULL,
    stars      TINYINT NOT NULL,
    comment    TEXT DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // support_tickets
  `CREATE TABLE IF NOT EXISTS support_tickets (
    ticket_id   INT AUTO_INCREMENT PRIMARY KEY,
    user_id     BIGINT NOT NULL,
    message     TEXT NOT NULL,
    admin_reply TEXT DEFAULT NULL,
    status ENUM('open','replied','closed') NOT NULL DEFAULT 'open',
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // categories
  `CREATE TABLE IF NOT EXISTS categories (
    category_id INT AUTO_INCREMENT PRIMARY KEY,
    name_ar     VARCHAR(100) NOT NULL,
    name_en     VARCHAR(100) NOT NULL,
    icon        VARCHAR(10) DEFAULT '🔧',
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // ── Add new columns safely (ALTER IF NOT EXISTS pattern) ──────────────────
  `ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS scheduled_date DATE DEFAULT NULL`,
  `ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS scheduled_time VARCHAR(30) DEFAULT NULL`,
  `ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS client_phone VARCHAR(25) DEFAULT NULL`,
  `ALTER TABLE technicians ADD COLUMN IF NOT EXISTS username VARCHAR(100) DEFAULT NULL`,
  `ALTER TABLE technicians ADD COLUMN IF NOT EXISTS total_jobs INT NOT NULL DEFAULT 0`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(100) DEFAULT NULL`,
];

const DEFAULT_CATEGORIES = [
  ['تنظيف منزل', 'Home Cleaning',      '🧹'],
  ['كهرباء',     'Electricity',         '⚡'],
  ['سباكة',      'Plumbing',            '🚿'],
  ['صيانة مكيفات','AC Maintenance',     '❄️'],
  ['صيانة عامة', 'General Maintenance', '🔧'],
  ['دهان',       'Painting',            '🎨'],
];

async function run() {
  try {
    await sequelize.authenticate();
    console.log('✅ DB connected');

    for (const sql of MIGRATIONS) {
      try {
        await sequelize.query(sql);
      } catch (e) {
        // Ignore duplicate column / already-exists errors
        if (!e.message.includes('Duplicate') && !e.message.includes('already exists')) {
          console.warn('⚠️  Migration skipped:', e.message.split('\n')[0]);
        }
      }
    }
    console.log('✅ Migrations applied');

    // Seed categories if empty
    const [rows] = await sequelize.query('SELECT COUNT(*) AS c FROM categories');
    if (rows[0].c === 0) {
      for (const [ar, en, icon] of DEFAULT_CATEGORIES) {
        await sequelize.query(
          'INSERT INTO categories (name_ar, name_en, icon) VALUES (?, ?, ?)',
          { replacements: [ar, en, icon] }
        );
      }
      console.log('✅ Default categories seeded');
    }

    console.log('🎉 Database ready');
    process.exit(0);
  } catch (err) {
    console.error('❌ DB init failed:', err.message);
    process.exit(1);
  }
}

run();
