# المواصفات الفنية لمشروع GazaServe

## نظرة عامة
نظام يربط المواطنين في غزة بفنيي صيانة عبر بوت تليغرام ولوحة تحكم إدارية، مع تخزين الصور على Cloudinary.

---

## 1. هيكلية المشروع (Project Structure)

```
GazaServe/
├── index.js                    # نقطة الدخول الرئيسية
├── package.json                # اعتماديات Backend
├── .env                        # متغيرات البيئة
├── src/
│   ├── bot.js                  # بوت تليغرام (Telegraf)
│   ├── bot/index.js            # إعادة تصدير البوت
│   ├── config/
│   │   ├── api.js              # متغيرات البيئة (Environment)
│   │   ├── database.js         # اتصال MySQL عبر Sequelize
│   │   └── initDb.js           # تهيئة قاعدة البيانات
│   ├── Models/                 # نماذج Sequelize
│   │   ├── index.js            # تجميع النماذج والعلاقات
│   │   ├── UserModel.js        # نموذج المستخدم
│   │   ├── TechnicianModel.js  # نموذج الفني
│   │   ├── RequestModel.js     # نموذج طلب الصيانة
│   │   ├── RatingModel.js      # نموذج التقييم
│   │   ├── CategoryModel.js    # نموذج التصنيف
│   │   ├── AdminModel.js       # نموذج المشرف
│   │   ├── SupportTicketModel.js # نموذج تذكرة الدعم
│   │   └── ActivityLogModel.js # نموذج سجل النشاطات
│   ├── controllers/
│   │   ├── ClientController.js    # تحكم المستخدم
│   │   ├── RequestController.js   # تحكم الطلبات
│   │   ├── TechnicianController.js# تحكم الفنيين
│   │   └── SupportController.js   # تحكم الدعم الفني
│   ├── scenes/
│   │   ├── techRegistrationScene.js # معالج تسجيل الفني (WizardScene)
│   │   ├── helpers/
│   │   │   └── aiValidator.js      # التحقق بالذكاء الاصطناعي
│   │   └── index.js
│   ├── services/
│   │   ├── cloudinary.js         # رفع الصور وتوقيعها
│   │   ├── orderDistributor.js   # توزيع الطلبات على الفنيين
│   │   ├── scheduledJobs.js      # مهام مجدولة (node-cron)
│   │   └── workingHours.js       # احتساب ساعات العمل
│   ├── helpers/
│   │   └── technicianHelper.js   # دوال مساعدة للفنيين
│   ├── routes/
│   │   ├── admin.js           # API لوحة التحكم
│   │   ├── api.js             # API التسجيل عبر الويب
│   │   ├── dashboard.js       # لوحة تحكم قديمة (HTML)
│   │   └── webhook.js         # Webhook تليغرام
│   ├── views/
│   │   ├── FormView.js        # قوائم التصنيفات والمناطق
│   │   ├── MainView.js        # عرض الرسائل الترحيبية
│   │   └── SubMenuView.js     # قوائم الخدمات الفرعية
│   └── middlewares/
│       ├── stateManager.js    # إدارة حالة المستخدم
│       └── authMiddleware.js  # التحقق من صحة التحديثات
├── admin/                      # واجهة الإدارة (React)
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx
│       ├── index.css           # أنماط Tailwind + Brand
│       ├── api/index.js        # عميل API (Axios)
│       ├── context/
│       │   └── ToastContext.jsx
│       ├── components/
│       │   ├── Layout.jsx      # تخطيط الصفحة
│       │   ├── StatsCard.jsx   # بطاقة إحصائية
│       │   ├── Modal.jsx       # نافذة منبثقة
│       │   ├── ConfirmModal.jsx
│       │   └── Pagination.jsx  # ترقيم الصفحات
│       ├── pages/
│       │   ├── Dashboard.jsx
│       │   ├── Login.jsx
│       │   ├── Technicians.jsx
│       │   ├── Requests.jsx
│       │   ├── Users.jsx
│       │   ├── Categories.jsx
│       │   ├── Tickets.jsx
│       │   ├── Notifications.jsx
│       │   ├── ActivityLogs.jsx
│       │   ├── Settings.jsx
│       │   └── Admins.jsx
│       └── styles/
│           └── brand.css       # نظام التصميم (Design System)
└── docs/
    ├── technical-specification.md
    └── تقرير-تسجيل-الفنيين.md
```

---

## 2. التقنيات والمكتبات المستخدمة (Technologies & Libraries)

### 2.1 Backend (Node.js)

| المكتبة | الإصدار | الوظيفة |
|---------|---------|---------|
| **Node.js** | v24 | بيئة تشغيل JavaScript على الخادم |
| **Express** | 5.1.0 | إطار عمل لبناء API وخدمة الملفات الثابتة |
| **Telegraf** | 4.16.3 | مكتبة التفاعل مع Telegram Bot API |
| **Sequelize** | 6.37.6 | ORM لإدارة قاعدة البيانات (MySQL) |
| **MySQL2** | 3.22.3 | مشغل MySQL لـ Node.js |
| **Cloudinary** | 2.10.0 | رفع وتخزين الصور في السحابة |
| **Axios** | 1.18.1 | عميل HTTP للتواصل مع API خارجية |
| **OpenAI** | 4.93.0 | SDK للذكاء الاصطناعي (GPT/Gemini) |
| **dotenv** | 16.4.7 | إدارة متغيرات البيئة |
| **node-cron** | 4.6.0 | جدولة المهام (رفع الطلبات المعلقة) |
| **helmet** | 8.2.0 | تعزيز أمان HTTP |
| **cors** | 2.8.6 | تمكين المشاركة بين النطاقات |
| **morgan** | 1.10.1 | تسجيل طلبات HTTP |
| **express-rate-limit** | 8.5.2 | تحديد معدل الطلبات |
| **multer** | 2.2.0 | رفع الملفات (للتسجيل عبر الويب) |
| **crypto** | 1.0.1 | تشفير البيانات |
| **chart.js** | 4.5.1 | رسومات بيانية (في لوحة HTML القديمة) |

### 2.2 Frontend (React Admin Dashboard)

| المكتبة | الإصدار | الوظيفة |
|---------|---------|---------|
| **React** | 19.2.6 | إطار عمل واجهة المستخدم |
| **Vite** | 8.0.12 | أداة بناء وتطوير |
| **React Router DOM** | 7.15.1 | التوجيه بين الصفحات |
| **Recharts** | 3.8.1 | مكتبة الرسوم البيانية |
| **Tailwind CSS** | 4.3.0 | إطار عمل CSS |
| **Axios** | 1.16.1 | عميل API |
| **React DOM** | 19.2.6 | عرض المكونات في المتصفح |

### 2.3 قاعدة البيانات (Database)

| التقنية | الوظيفة |
|---------|---------|
| **MySQL** (عبر Railway) | قاعدة البيانات العلائقية |
| **Sequelize ORM** | إدارة الجداول والعلاقات والترحيل (Migration) |

### 2.4 التخزين السحابي (Cloud Storage)

| الخدمة | الوظيفة |
|--------|---------|
| **Cloudinary** | رفع الصور بنوع `authenticated` وتوليد روابط موقعة |

---

## 3. بنية قاعدة البيانات (Database Schema)

### 3.1 `users` — المستخدمون
| الحقل | النوع | الوصف |
|-------|------|-------|
| user_id | BIGINT (PK) | معرف تليغرام |
| full_name | STRING(150) | الاسم الكامل |
| phone_number | STRING(20) | رقم الهاتف |
| location | STRING(100) | المنطقة السكنية |
| is_active | BOOLEAN | حالة الحظر/التفعيل |

### 3.2 `technicians` — الفنيون
| الحقل | النوع | الوصف |
|-------|------|-------|
| tech_id | BIGINT (PK) | معرف تليغرام |
| full_name | STRING(150) | الاسم الكامل |
| phone_number | STRING(20) | رقم الهاتف |
| category | STRING(100) | التخصص |
| location | STRING(100) | المنطقة |
| national_id_url | STRING(500) | public_id صورة الهوية (Cloudinary) |
| experience_years | INTEGER | سنوات الخبرة |
| status | ENUM('pending','approved','rejected') | حالة التسجيل |
| is_available | BOOLEAN | متاح لاستقبال الطلبات |

### 3.3 `service_requests` — طلبات الصيانة
| الحقل | النوع | الوصف |
|-------|------|-------|
| request_id | INT (PK) | رقم الطلب |
| client_id | BIGINT (FK → users) | معرف العميل |
| tech_id | BIGINT (FK → technicians) | معرف الفني |
| extracted_category | STRING | التصنيف المطلوب |
| location | STRING | موقع الخدمة |
| detailed_address | STRING | العنوان التفصيلي |
| problem_description | TEXT | وصف المشكلة |
| photo_url | STRING(500) | public_id صورة المشكلة (Cloudinary) |
| status | ENUM | pending/accepted/on_the_way/in_progress/completed/canceled/archived |
| escalated_3h | BOOLEAN | تم رفع بعد 3 ساعات |
| escalated_6h | BOOLEAN | تم رفع بعد 6 ساعات |

### 3.4 `categories` — التصنيفات
| الحقل | النوع | الوصف |
|-------|------|-------|
| category_id | INT (PK) | المعرف |
| name_ar | VARCHAR(100) | الاسم بالعربية |
| name_en | VARCHAR(100) | الاسم بالإنجليزية |
| icon | VARCHAR(10) | الأيقونة |

### 3.5 `support_tickets` — تذاكر الدعم الفني
| الحقل | النوع | الوصف |
|-------|------|-------|
| ticket_id | INT (PK) | رقم التذكرة |
| user_id | BIGINT (FK → users) | معرف المستخدم |
| message | TEXT | الرسالة |
| admin_reply | TEXT | رد المشرف |
| status | ENUM('open','replied','closed') | حالة التذكرة |

---

## 4. سير العمل (Flow of Operations)

### 4.1 تسجيل فني جديد
```
مستخدم → /start → يضغط "تسجيل كفني"
     → WizardScene (8 خطوات):
       1. الاسم الكامل
       2. رقم الهاتف (مشاركة جهة اتصال أو كتابة)
       3. التخصص (8 تصنيفات)
       4. المنطقة (رئيسية + فرعية)
       5. سنوات الخبرة (5 خيارات)
       6. صورة الهوية → Cloudinary (type: authenticated)
       7. مراجعة وتأكيد
       8. حفظ pending → إشعار للمشرف
```

### 4.2 طلب صيانة جديد
```
مستخدم → يضغط "🔧 طلب خدمة"
     → اختيار التصنيف (8 تصنيفات)
     → اختيار المنطقة (5 محافظات + مناطق فرعية)
     → إدخال العنوان التفصيلي
     → وصف المشكلة (نص)
     → صورة (اختياري) → Cloudinary
     → تأكيد → distributeOrder()
       ↓
    orderDistributor:
      → البحث عن فنيين بنفس التصنيف والمنطقة
      → إرسال إشعار لجميع الفنيين المؤهلين
      → أول فني يقبل (atomic UPDATE) يأخذ الطلب
      → إشعار باقي الفنيين أن الطلب أخذ
      → إشعار العميل بمعلومات الفني
```

### 4.3 رفع الطلب المعلق (Escalation)
```
ScheduledJob (كل 15 دقيقة):
  → خدمة workingHours (8 صباحاً - 12 منتصف الليل)
  → 3 ساعات: توسيع نطاق المنطقة للمحافظات المجاورة
  → 6 ساعات: إشعار المشرف (ADMIN_ID)
```

### 4.4 عرض صورة الهوية في لوحة التحكم
```
Admin يفتح /admin/ → صفحة الفنيين
  → API GET /technicians
    → getSignedPhotoUrl(public_id)
      → cloudinary.url(publicId, { type: authenticated, sign_url: true })
      → URL موقع لمدة 10 دقائق
  → Frontend يعرض زر "عرض"
  → الضغط يفتح Modal بالصورة الموقعة
```

---

## 5. الأمان (Security)

### 5.1 الصور (Cloudinary Authenticated)
- الرفع بـ `type: 'authenticated'`
- التخزين: `public_id` فقط في قاعدة البيانات
- العرض: روابط موقعة بصلاحية 10 دقائق (`sign_url: true` مع `expires_at`)
- الحماية: حتى مع معرف `public_id` لا يمكن الوصول للصورة بدون توقيع

### 5.2 API Admin
- التحقق عبر `auth` middleware
- الجلسة مخزنة في متغيرات البيئة (`ADMIN_ID`)
- تحديد معدل الطلبات (`express-rate-limit`)

### 5.3 حماية HTTP
- `helmet` لتعيين رؤوس أمان HTTP
- `cors` للتحكم في النطاقات المسموح بها

---

## 6. متغيرات البيئة (Environment Variables)

| المتغير | الوصف |
|---------|-------|
| `TELEGRAM_BOT_TOKEN` | توكن بوت تليغرام |
| `ADMIN_ID` | معرف المشرف (رقم تليغرام) |
| `DATABASE_URL` | رابط اتصال MySQL |
| `DB_SSL` | تفعيل SSL لقاعدة البيانات |
| `CLOUDINARY_CLOUD_NAME` | اسم سحابة Cloudinary |
| `CLOUDINARY_API_KEY` | مفتاح API لـ Cloudinary |
| `CLOUDINARY_API_SECRET` | المفتاح السري لـ Cloudinary |
| `GEMINI_API_KEY` | مفتاح Gemini API (للتحقق بالذكاء الاصطناعي) |
| `FORCE_POLLING` | تفعيل وضع Polling (بدل Webhook) |
| `PORT` | منفذ الخادم |
| `NODE_ENV` | بيئة التشغيل (development/production) |
| `SERVER_URL` | رابط الخادم (لـ Webhook) |

---

## 7. النشر (Deployment)

### 7.1 Railway.app
- **Service**: Node.js (تطبيق البوت ولوحة التحكم)
- **Plugin**: MySQL (قاعدة البيانات)
- **Start Command**: `npm start` → `node index.js`
- **Polling Mode**: يعمل على Railway بدون Webhook

### 7.2 البناء المحلي
```bash
npm install                    # تثبيت اعتماديات Backend
cd admin && npm install        # تثبيت اعتماديات Frontend
npm run build                  # بناء واجهة الإدارة
cd .. && npm start             # تشغيل الخادم
```

---

## 8. التصميم البصري (Brand Design System)

| العنصر | اللون/القيمة |
|--------|-------------|
| الأخضر الأساسي | `#13964F` |
| الأخضر الداكن | `#016E3E` |
| خلفية الشريط الجانبي | `#40525D` |
| الخلفية الرئيسية | `#F7F7F7` |
| حالة قيد المراجعة | `#F59E0B` |
| حالة مقبول | `#13964F` |
| حالة مرفوض | `#EF4444` |
| حالة قيد التنفيذ | `#3B82F6` |
| حالة مكتمل | `#059669` |

---

## 9. التصنيفات والخدمات (Categories & Services)

| التصنيف | الأيقونة | الخدمات الفرعية |
|---------|----------|-----------------|
| التنظيف | 🧹 | تنظيف منازل، سجاد، مكاتب، واجهات زجاج، خزانات |
| الكهرباء | ⚡ | كهرباء منازل، كاميرات مراقبة، جرس باب، مروحة شفط، أجهزة إنذار |
| السباكة | 🚰 | تسريبات مياه، سخانات، صرف صحي، مواسير، أحواض |
| الصيانة العامة | 🔧 | — |
| الطاقة الشمسية | ☀️ | — |
| الترميم والبناء | 🏗️ | — |
| الألومنيوم والحدادة | 🪟 | — |
| نقل وتركيب الأثاث | 🚚 | — |

---

## 10. الذكاء الاصطناعي (AI Integration)

- **Google Gemini API** (`gemini-2.0-flash`): التحقق من صحة أسماء الفنيين والتحقق من بطاقات الهوية
- **Fallback**: عند انتهاء الحصة أو فشل API، يستخدم التحقق الأساسي (Regular Expressions)
- **OpenAI SDK**: مثبت للاستخدام المستقبلي (اختياري)
