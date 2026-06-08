# 🏠 GazaServe Bot v2

منصة خدمات منزلية ذكية عبر تيليجرام لقطاع غزة.

---

## 📁 هيكل المشروع

```
gazaserve-bot/
├── index.js                        # نقطة الدخول الرئيسية (Express + Bot)
├── .env.example                    # متغيرات البيئة (انسخها إلى .env)
├── package.json
└── src/
    ├── bot/
    │   └── index.js                # إعداد البوت + توجيه callback_query
    ├── config/
    │   ├── api.js                  # متغيرات البيئة
    │   ├── database.js             # Sequelize connection
    │   └── initDb.js               # إنشاء الجداول وبيانات البداية
    ├── controllers/
    │   ├── clientController.js     # طلبات العملاء + التقييم
    │   ├── technicianController.js # تسجيل الفنيين + قبول/رفض الطلبات
    │   ├── supportController.js    # تذاكر الدعم الفني
    │   └── textController.js       # توجيه الرسائل النصية + AI
    ├── middleware/
    │   ├── stateManager.js         # إدارة حالة المحادثة
    │   └── authMiddleware.js       # التحقق من المستخدمين
    ├── models/
    │   └── index.js                # Sequelize models (User, Technician, Request…)
    ├── routes/
    │   ├── webhook.js              # POST /webhook
    │   └── api.js                  # REST API للوحة الإدارة
    ├── services/
    │   └── aiService.js            # OpenAI (تصنيف الفئة + المحادثة)
    ├── utils/
    │   └── index.js                # دوال مساعدة
    └── views/
        ├── keyboards.js            # لوحات المفاتيح المُعاد استخدامها
        └── messages.js             # قوالب الرسائل
```

---

## ⚡ التشغيل السريع

### 1. تثبيت المتطلبات
```bash
npm install
```

### 2. إعداد البيئة
```bash
cp .env.example .env
# ثم عدّل .env بالقيم الصحيحة
```

### 3. إنشاء قاعدة البيانات
```bash
# أنشئ قاعدة بيانات MySQL باسم gazaserve
mysql -u root -e "CREATE DATABASE IF NOT EXISTS gazaserve CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# ثم شغّل المايجريشن
node src/config/initDb.js
```

### 4. تشغيل البوت
```bash
# وضع التطوير (Polling)
npm run dev

# وضع الإنتاج (Webhook)
npm start
```

---

## 🔧 المتغيرات المطلوبة في `.env`

| المتغير | الوصف |
|---------|-------|
| `TELEGRAM_BOT_TOKEN` | توكن البوت من @BotFather |
| `ADMIN_ID` | معرف تيليجرام للأدمن (احصل عليه بـ /myid) |
| `DB_HOST` | عنوان قاعدة البيانات |
| `DB_NAME` | اسم قاعدة البيانات |
| `DB_USER` | مستخدم قاعدة البيانات |
| `DB_PASS` | كلمة مرور قاعدة البيانات |
| `OPENAI_API_KEY` | (اختياري) لتصنيف الطلبات بالذكاء الاصطناعي |
| `SERVER_URL` | (للإنتاج) رابط السيرفر للـ Webhook |

---

## 🤖 مسار طلب الخدمة

```
/start
  → اختيار الخدمة (فئة)
  → وصف المشكلة
  → صورة اختيارية
  → اختيار المنطقة + المنطقة الفرعية
  → العنوان التفصيلي
  → التاريخ + الوقت
  → رقم الهاتف
  → مراجعة وتأكيد
  → إرسال إشعار للفنيين المناسبين
  → قبول/رفض من الفني
  → تتبع الحالة (في الطريق → قيد التنفيذ → مكتمل)
  → تقييم الخدمة
```

---

## 📡 REST API

جميع المسارات تتطلب header: `x-admin-id: <ADMIN_ID>`

| الطريقة | المسار | الوصف |
|---------|--------|-------|
| GET | `/api/stats` | إحصائيات عامة |
| GET | `/api/requests` | قائمة الطلبات |
| PATCH | `/api/requests/:id/status` | تحديث حالة طلب |
| GET | `/api/technicians` | قائمة الفنيين |
| PATCH | `/api/technicians/:id/status` | قبول/رفض فني |
| DELETE | `/api/technicians/:id` | حذف فني |
| GET | `/api/users` | قائمة المستخدمين |
| PATCH | `/api/users/:id/block` | حظر/إلغاء حظر مستخدم |
| GET | `/api/tickets` | تذاكر الدعم |
| GET | `/api/categories` | الفئات |
| POST | `/api/categories` | إضافة فئة |
| DELETE | `/api/categories/:id` | حذف فئة |
