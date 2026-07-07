const cloudinary = require('cloudinary').v2;
const axios = require('axios');
const { Readable } = require('stream');
const apiConfig = require('../config/api');

cloudinary.config({
  cloud_name: apiConfig.CLOUDINARY_CLOUD_NAME,
  api_key: apiConfig.CLOUDINARY_API_KEY,
  api_secret: apiConfig.CLOUDINARY_API_SECRET,
});

async function uploadFromTelegram(fileId) {
  const filePath = await getTelegramFilePath(fileId);
  if (!filePath) throw new Error('Could not resolve Telegram file path');
  const fileUrl = `https://api.telegram.org/file/bot${apiConfig.TELEGRAM_BOT_TOKEN}/${filePath}`;
  const resp = await axios({ url: fileUrl, method: 'GET', responseType: 'stream', timeout: 15000 });
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: 'gazaserve', resource_type: 'image', type: 'authenticated' },
      (err, result) => {
        if (err) return reject(err);
        resolve({ public_id: result.public_id, secure_url: result.secure_url });
      }
    );
    resp.data.pipe(uploadStream);
  });
}

function getSignedPhotoUrl(publicId, expiresMinutes = 10) {
  if (!publicId) return null;
  if (publicId.startsWith('http')) return publicId;
  try {
    const url = cloudinary.url(publicId, {
      type: 'authenticated',
      sign_url: true,
      expires_at: Math.floor(Date.now() / 1000) + expiresMinutes * 60,
      secure: true,
    });
    console.log(`[Cloudinary] Signed URL for ${publicId}: ${url}`);
    return url;
  } catch (e) {
    console.error(`[Cloudinary] Failed to sign URL for ${publicId}:`, e.message);
    return null;
  }
}

async function getTelegramFilePath(fileId) {
  try {
    const resp = await axios.get(
      `https://api.telegram.org/bot${apiConfig.TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`,
      { timeout: 10000 }
    );
    return resp.data.result.file_path;
  } catch {
    return null;
  }
}

module.exports = { uploadFromTelegram, getSignedPhotoUrl, getTelegramFilePath };
