'use strict';
require('dotenv').config();
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME  || 'gazaserve',
  process.env.DB_USER  || 'root',
  process.env.DB_PASS  || '',
  {
    host:    process.env.DB_HOST || 'localhost',
    port:    parseInt(process.env.DB_PORT) || 3306,
    dialect: 'mysql',
    logging: false,
    pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
    define:  { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' },
  }
);

module.exports = sequelize;
