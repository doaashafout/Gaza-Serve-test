const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const prefix = file.fieldname === 'national_id' ? 'nid' : file.fieldname === 'profile_photo' ? 'photo' : 'cert';
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) return cb(null, true);
    cb(new Error('الرجاء رفع صورة فقط'));
  },
});

// POST /api/register/technician - Register a new technician via Web App
router.post(
  '/register/technician',
  upload.fields([
    { name: 'national_id', maxCount: 1 },
    { name: 'profile_photo', maxCount: 1 },
    { name: 'certificates', maxCount: 5 },
  ]),
  async (req, res) => {
    try {
      const { full_name, phone_number, category, governorate, city, experience_years, skills, work_description, has_certificate, telegram_id } = req.body;

      // Validation
      const errors = [];
      if (!full_name || full_name.trim().length < 3) errors.push('الاسم الثلاثي مطلوب');
      if (!phone_number || !/^[0-9+\s\-]{7,20}$/.test(phone_number.trim())) errors.push('رقم الهاتف غير صحيح');
      if (!category) errors.push('التخصص مطلوب');
      if (!governorate) errors.push('المحافظة مطلوبة');
      if (!telegram_id) errors.push('معرف تيليغرام مطلوب');
      if (errors.length > 0) return res.status(400).json({ ok: false, error: errors.join('، ') });

      const nationalIdUrl = req.files?.national_id?.[0] ? `/uploads/${req.files.national_id[0].filename}` : null;
      const profilePhotoUrl = req.files?.profile_photo?.[0] ? `/uploads/${req.files.profile_photo[0].filename}` : null;
      const certFiles = req.files?.certificates || [];
      const certUrls = certFiles.map(f => `/uploads/${f.filename}`);

      const { Technician } = require('../Models');
      const apiConfig = require('../config/api');

      // Check if already registered
      const existing = await Technician.findByPk(telegram_id);
      if (existing) return res.status(409).json({ ok: false, error: 'هذا الحساب مسجل مسبقاً كفني' });

      const isAdmin = String(telegram_id) === String(apiConfig.ADMIN_ID);

      await Technician.create({
        tech_id: telegram_id,
        full_name: full_name.trim(),
        phone_number: phone_number.trim(),
        category,
        governorate,
        city,
        location: governorate,
        experience_years: experience_years || null,
        skills: skills || null,
        work_description: work_description || null,
        national_id_url: nationalIdUrl,
        profile_photo_url: profilePhotoUrl,
        certificates: JSON.stringify(certUrls),
        has_certificate: has_certificate === 'true',
        status: isAdmin ? 'approved' : 'pending',
      });

      console.log(`[API] New technician registered: ${full_name} (${telegram_id})`);

      if (!isAdmin && apiConfig.ADMIN_ID) {
        try {
          await fetch(`https://api.telegram.org/bot${apiConfig.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: apiConfig.ADMIN_ID,
              text: `🆕 طلب تسجيل فني جديد\n\nالاسم: ${full_name}\nرقم الهاتف: ${phone_number}\nالتخصص: ${category}\nالمحافظة: ${governorate}\nالمدينة: ${city || '—'}\nسنوات الخبرة: ${experience_years || '—'}\nحساب تيليغرام: ${telegram_id}`,
              parse_mode: 'Markdown',
              reply_markup: JSON.stringify({
                inline_keyboard: [
                  [
                    { text: '✅ قبول الفني', callback_data: `admin_accept_${telegram_id}` },
                    { text: '❌ رفض الفني', callback_data: `admin_reject_${telegram_id}` },
                  ],
                ],
              }),
            }),
          });
        } catch (notifyErr) {
          console.warn('[API] Admin notification failed:', notifyErr.message);
        }
      }

      res.json({ ok: true });
    } catch (err) {
      console.error('[API] Register error:', err);
      res.status(500).json({ ok: false, error: 'حدث خطأ أثناء التسجيل. يرجى المحاولة لاحقاً.' });
    }
  }
);

module.exports = router;
