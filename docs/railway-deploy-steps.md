# خطوات نشر المشروع على Railway

## الخطوة 1: أنشئ مشروع جديد
1. افتح https://railway.app
2. اضغط **New Project**
3. اختار **Deploy from GitHub repo**
4. اختار `doaashafout/Gaza-Serve-test`

## الخطوة 2: أضف MySQL
1. داخل المشروع، اضغط **New** → **Database** → **MySQL** (اختر **MySQL** فقط، مش PostgreSQL)
2. استنى لدقيقة لحتى يظهر

## الخطوة 3: ضبط المتغيرات (Variables)
روح على تبويب **Variables** وأضف هذي المتغيرات:

```
NODE_ENV=production
FORCE_POLLING=true
DB_SSL=true
TELEGRAM_BOT_TOKEN=8695454964:AAFroNOWh2iT7tPEXe3vJBW4bw1zeBRQNUk
OPENAI_API_KEY=your_openai_key_here
ADMIN_ID=5290473529
CLOUDINARY_CLOUD_NAME=yzftvu3q
CLOUDINARY_API_KEY=976525649794126
CLOUDINARY_API_SECRET=k6m1L7lTSFAQkFvQMKVW3fs3MBs
```

> **ملاحظة**: `DATABASE_URL` بتظهر تلقائياً بعد ما تضيف MySQL. لا تحتاج تضيفها يدوي.

## الخطوة 4: شغّل المشروع
- Railway بيشتغل تلقائياً بعد ما تحط المتغيرات
- لو ما اشتغل، اضغط **Deploy** يدوي
- شوف **Deploy Logs** لحتى تتأكد:
  ```
  [DB] Database synced.
  [DB] Migrations applied.
  [Bot] Starting in polling mode...
  [Server] GazaServe running on port 8080
  ```

## ما تسوي شي بقاعدة البيانات!!!
- **ما في داعي** لإنشاء جداول أو تشغيل migrations
- الكود بنشئ الجداول تلقائياً أول ما يشتغل
- MySQL plugin على Railway بنشئ قاعدة بيانات اسمه `railway` تلقائياً
- ما في داعي تعمل `npm run db:init` لأن كل شي تلقائي

## لو ظهر خطأ
- **SequelizeConnectionError**: تأكد إنك أضفت MySQL من **Database** (مش PostgreSQL) وإن `DB_SSL=true`
- **Bot token invalid**: روح @BotFather وجدد التوكن
- **ECONNRESET**: مشكلة SSL - الكود يتعامل معها تلقائياً
