'use strict';
require('dotenv').config();

module.exports = {
  TELEGRAM_BOT_TOKEN : process.env.TELEGRAM_BOT_TOKEN || '',
  OPENAI_API_KEY     : process.env.OPENAI_API_KEY     || '',
  PORT               : parseInt(process.env.PORT) || 5050,
  SERVER_URL         : process.env.SERVER_URL || '',
  NODE_ENV           : process.env.NODE_ENV   || 'development',
  ADMIN_ID           : process.env.ADMIN_ID   || '',
};
