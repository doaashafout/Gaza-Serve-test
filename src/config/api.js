require('dotenv').config();

module.exports = {
  // Telegram
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,

  // AI
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,

  // Server
  PORT: process.env.PORT || 5050,
  SERVER_URL: process.env.SERVER_URL,
  NODE_ENV: process.env.NODE_ENV || 'development',

  // Admin
  ADMIN_ID: process.env.ADMIN_ID,

  // Cloudinary
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
};
