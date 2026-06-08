const mysql = require('mysql2/promise');
const sequelize = require('./database');
require('../Models');

async function initDatabase() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
    });

    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
    );
    await connection.end();
    console.log(`[DB] Database '${process.env.DB_NAME}' ensured.`);

    await sequelize.authenticate();
    console.log('[DB] Connection established successfully.');

    await sequelize.sync({ alter: true });
    console.log('[DB] All models synchronized successfully.');

    process.exit(0);
  } catch (error) {
    console.error('[DB] Initialization failed:', error);
    process.exit(1);
  }
}

initDatabase();
