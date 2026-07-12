# دليل نشر المشروع على Railway

## 1. رفع الكود على GitHub ✅ (تم)

تم رفع جميع التعديلات إلى:
https://github.com/doaashafout/Gaza-Serve-test.git

---

## 2. إنشاء حساب على Railway

1. ادخل على https://railway.app
2. سجل دخول بحساب GitHub
3. اضغط "New Project"

---

## 3. ربط المشروع من GitHub

1. في Railway، اختار **"Deploy from GitHub repo"**
2. اختار repo: `doaashafout/Gaza-Serve-test`
3. Railway会自动 يكتشف Node.js ويشتغل

---

## 4. إضافة قاعدة بيانات MySQL

1. داخل المشروع على Railway، اضغط **"New"** → **"Database"** → **"MySQL"**
2. استنى لدقيقة عشان تنشأ
3. رح يظهرلك `DATABASE_URL` تلقائياً
4. القيمة رح تكون شي زي:
   ```
   mysql://root:randompassword@mysql.railway.internal:3306/railway
   ```

---

## 5. ضبط المتغيرات (Environment Variables)

في تبويب **Variables** داخل المشروع على Railway، أضف:

```
NODE_ENV=production
PORT=8080

# MySQL - رح ينضاف تلقائياً من MySQL plugin
# DATABASE_URL=mysql://... (بيظهر لحاله)

# SSL للـ MySQL (مهم عشان اتصال Railway الداخلي)
DB_SSL=true

# توكن البوت (من @BotFather على Telegram)
TELEGRAM_BOT_TOKEN=xxxxx:xxxxxxxxxxxxxxxxxxxxxxxxxx

# مفتاح OpenAI API (للتصنيف الذكي - اختياري)
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxx

# معرف المشرف على تيليغرام (يرسله إشعارات التسجيل)
ADMIN_ID=5290473529

# Cloudinary (لرفع صور الهوية)
CLOUDINARY_CLOUD_NAME=yzftvu3q
CLOUDINARY_API_KEY=976525649794126
CLOUDINARY_API_SECRET=k6m1L7lTSFAQkFvQMKVW3fs3MBs
```

**مهم جداً**: اترك `FORCE_POLLING=true` في متغيرات Railway (مش `SERVER_URL`) عشان يشتغل البوت بدون Webhook.

---

## 6. إنشاء قاعدة البيانات (تلقائي)

أول ما المشروع يشتغل، الكود بيعمل:
1. `sequelize.sync()` → ينشئ الجداول تلقائياً
2. `CREATE TABLE IF NOT EXISTS` → للجداول
3. `ALTER TABLE` → يضيف الأعمدة المفقودة
4. `INSERT INTO categories` → يضيف التصنيفات الافتراضية (8 تصنيفات)

**ما في داعي لعمل "migration" يدوي**. الجداول رح تتنشأ أول启动了.

---

## 7. تشغيل المشروع

1. بعد ما ضبطت المتغيرات، رح يشتغل تلقائياً
2. رح تشوف في logs:
   ```
   [DB] Database synced.
   [DB] Migrations applied.
   [Bot] Starting in polling mode...
   [Server] GazaServe running on port 8080
   ```
3. جرب افتح البوت على تيليغرام واكتب `/start`

---

## 8. لو صار خطأ

شيك على **Deploy Logs** في Railway وشوف:
- هل `TELEGRAM_BOT_TOKEN` مضبوط؟
- هل `DATABASE_URL` ظاهرة؟
- هل `DB_SSL=true` مضبوط؟

لو المشكلة:
- **SequelizeConnectionError**: تأكد من `DATABASE_URL` و `DB_SSL=true`
- **ECONNRESET**: زود `DB_SSL=true` ومتغير `rejectUnauthorized: false` (موجود بالكود)
- **Bot token invalid**: جدد التوكن من @BotFather

---

## 9. رابط البوت

https://t.me/GazaServeBot
