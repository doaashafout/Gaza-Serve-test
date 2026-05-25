require('dotenv').config();

module.exports = {
  // Telegram
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,

  // OpenAI
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,

  // Server
  PORT: process.env.PORT || 5050,
  SERVER_URL: process.env.SERVER_URL,
  NODE_ENV: process.env.NODE_ENV || 'development',

  // Admin
  ADMIN_ID: process.env.ADMIN_ID,
};
