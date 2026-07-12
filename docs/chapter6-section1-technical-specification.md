# الفصل السادس: التنفيذ
## القسم الأول: المواصفات التقنية (Technical Specification)

### 1.1 مقدمة

هذا القسم يوثق جميع التقنيات والمكتبات المستخدمة في بناء نظام GazaServe، وهو منصة تربط بين العملاء والفنيين في قطاع غزة عبر بوت Telegram مع لوحة تحكم إدارية ويب. سيتم شرح كل تقنية ودورها في النظام مع تبرير اختيارها.

---

### 1.2 بيئة التشغيل (Runtime Environment)

#### Node.js
- **الإصدار**: v18.11+ (يتطلب دلالة `--watch` للتطوير)
- **نظام الوحدات**: CommonJS (`"type": "commonjs"`)
- **ميزات JavaScript المستخدمة**:
  - `async/await` للتعامل مع العمليات غير المتزامنة
  - `optional chaining` (`?.`) للوصول الآمن للخصائص
  - `nullish coalescing` (`??`) للقيم الافتراضية
  - `template literals` لبناء النصوص
- **سبب الاختيار**: Node.js مثالي للتطبيقات المعتمدة على الـ I/O غير المتزامن ومعالجة الرسائل الفورية، كما أن نظام npm البيئي يوفر آلاف المكتبات الجاهزة. إصدار LTS يضمن الاستقرار والأمان.

---

### 1.3 الإطار العام للبوت (Bot Framework)

#### Telegraf v4.16.3
- **الموقع**: `src/bot.js` - ملف تعريف البوت الرئيسي
- **الغرض**: إطار عمل للتفاعل مع Telegram Bot API
- **الميزات المستخدمة**:
  - `Telegraf`构造函数 - إنشاء البوت باستخدام التوكن
  - `Telegraf.session()` - إدارة جلسات المستخدمين
  - `Scenes.WizardScene` - إنشاء معالج تسجيل الفنيين المتعدد الخطوات (8 خطوات)
  - `Scenes.Stage` - إدارة التنقل بين خطوات المعالج
  - `Markup.inlineKeyboard()` - إنشاء أزرار تفاعلية (قبول/رفض الطلب، اختيار التصنيف، إلخ)
  - `Markup.keyboard()` - أزرار أسفل الشاشة
  - `ctx.telegram.sendMessage()` - إرسال رسائل مع خيارات متقدمة
  - `ctx.api.setMyCommands()` - تعيين الأوامر ديناميكياً حسب دور المستخدم
  - `Composer` - تجميع المعالجات
- **سبب الاختيار**: Telegraf هو أشهر إطار عمل Node.js للبوتات على Telegram، يدعم بشكل كامل ميزات Bot API مثل WebApp Data والـ Callback Queries والـ Inline Keyboards. كما أنه يسهل إنشاء معالجات متعددة الخطوات (WizardScene) مما يبسط تدفقات التسجيل المعقدة.

---

### 1.4 الإطار العام لخادم الويب (Web Framework)

#### Express v5.1.0
- **الموقع**: `index.js` - نقطة الدخول الرئيسية
- **الغرض**: خادم HTTP لاستقبال webhook من Telegram وتقديم واجهات API
- **الإصدار**: Express 5 (أحدث إصدار رئيسي)
- **الميزات المستخدمة**:
  - `express()` - إنشاء تطبيق الخادم
  - `express.json({ limit: '10mb' })` - تحليل جسم الطلب بصيغة JSON مع حد 10MB
  - `express.urlencoded({ extended: true, limit: '10mb' })` - تحليل الـ URL-encoded data
  - `express.static()` - تقديم الملفات الثابتة (لوحة التحكم الإدارية، صور الرفع)
  - `Router` - تنظيم المسارات في ملفات منفصلة
  - `app.listen()` - تشغيل الخادم على منفذ محدد
- **المسارات المنظمة في ملفات منفصلة**:
  - `src/routes/webhook.js` - استقبال webhook من Telegram + نقطة `/health` للتحقق من الصحة
  - `src/routes/dashboard.js` - لوحة التحكم البسيطة + إحصائيات API
  - `src/routes/api.js` - واجهة تسجيل الفنيين عبر REST API مع رفع الملفات
  - `src/routes/admin.js` - واجهة API كاملة للإدارة (CRUD للمستخدمين، الفنيين، الطلبات، التذاكر، التصنيفات، المشرفين، السجلات)
- **سبب الاختيار**: Express هو إطار الويب الأكثر انتشاراً في Node.js، يتميز بالبساطة والمرونة والتوافق الواسع مع middleware المختلفة. الإصدار 5 يجلب تحسينات في معالجة الأخطاء ودعم الـ async/await مباشرة.

---

### 1.5 إدارة قاعدة البيانات (Database ORM)

#### Sequelize v6.37.6
- **الموقع**: `src/config/database.js` - إعداد الاتصال
- **الغرض**: ORM (Object-Relational Mapping) لقاعدة بيانات MySQL
- **الميزات المستخدمة**:
  - `Sequelize()` - إنشاء اتصال بقاعدة البيانات (يدعم URL و host/port)
  - `Model.init()` - تعريف 8 نماذج بيانات مع الحقول والقيود
  - `sequelize.sync()` - مزامنة النماذج مع قاعدة البيانات (إنشاء/تعديل الجداول)
  - `Model.bulkCreate()` - إدراج بيانات افتراضية للتصنيفات
  - `Model.findOne()` / `Model.findAll()` - استعلامات البحث
  - `Model.create()` / `Model.update()` - إنشاء وتحديث السجلات
  - `Model.hasMany()` / `Model.belongsTo()` - تعريف العلاقات بين الجداول
  - `Op` - عوامل المقارنة المتقدمة (`Op.eq`, `Op.like`, `Op.in`)
  - `fn('RAND')` - ترتيب عشوائي للنتائج
- **النماذج المعرفة (8 نماذج)**:
  1. **UserModel** - `users` - بيانات العملاء (الاسم، رقم الهاتف، الموقع)
  2. **TechnicianModel** - `technicians` - بيانات الفنيين (الاسم، الهاتف، التصنيف، الموقع، سنوات الخبرة، المهارات، صور الهوية)
  3. **RequestModel** - `service_requests` - طلبات الخدمة (العميل، الفني، التصنيف، الوصف، الحالة، الصور)
  4. **RatingModel** - `ratings` - التقييمات (النجوم، التعليق)
  5. **SupportTicketModel** - `support_tickets` - تذاكر الدعم (الرسالة، رد المشرف، الحالة)
  6. **CategoryModel** - `categories` - تصنيفات الخدمات (الاسم عربي/إنجليزي، الأيقونة)
  7. **AdminModel** - `admins` - المشرفين (الاسم، معرف Telegram، الدور)
  8. **ActivityLogModel** - `activity_logs` - سجل النشاطات (المشرف، الإجراء، الهدف)
- **سبب الاختيار**: Sequelize هو ORM ناضج ومستقر مع دعم ممتاز لـ MySQL، يوفر واجهة برمجية نظيفة للتعامل مع قاعدة البيانات مع طبقة أمان مدمجة ضد SQL Injection عبر parameterized queries.

#### mysql2 v3.22.3
- **الموقع**: محدد لـ Sequelize في `src/config/database.js` و `src/config/initDb.js`
- **الغرض**: مشغل MySQL لقاعدة البيانات
- **الميزات المستخدمة**:
  - `createConnection()` - اتصال منخفض المستوى لإنشاء قاعدة البيانات في `initDb.js`
  - Prepared statements لدعم الـ parameterized queries
  - دعم `utf8mb4` لتمثيل الرموز التعبيرية (emojis) والنصوص العربية
- **سبب الاختيار**: mysql2 هو الخيار الموصى به مع Sequelize، أسرع وأحدث من mysql، ويدعم Promise natively.

---

### 1.6 الذكاء الاصطناعي ومعالجة اللغة (AI & NLP)

#### OpenAI API (via openai v4.93.0)
- **الموقع**: `src/services/openaiService.js`
- **الغرض**: تصنيف طلبات الخدمة والمحادثة العامة مع العملاء
- **الميزات المستخدمة**:
  - **Model: `gpt-3.5-turbo`** - تصنيف نصوص طلبات الخدمة واستخراج التصنيف والموقع
    - Temperature: 0.1 (للحصول على نتائج ثابتة وقابلة للتكرار)
    - `response_format: { type: "json_object" }` - إخراج منظم بصيغة JSON
  - **Model: `gpt-3.5-turbo`** - محادثة ذكية عامة مع العملاء
    - Temperature: 0.3 (توازن بين الإبداع والدقة)
    - `functions` - استخدام Function Calling مع دالتين:
      - `submit_request`: عندما يصف المستخدم مشكلة صيانة (يستخرج التصنيف)
      - `respond`: ردود محادثة عامة
  - **Model: `whisper-1`** - تحويل الرسائل الصوتية إلى نص
    - اللغة: العربية (`ar`)
  - **آليات إعادة المحاولة**:
    - `callOpenAIWithRetry()` - إعادة المحاولة تلقائياً عند أخطاء 429 (تجاوز الحد المسموح) و 5xx
    - حتى محاولتين مع تأخير تصاعدي (1 ثانية، 2 ثانية)
- **سبب الاختيار**: OpenAI GPT-3.5-turbo يوفر توازناً ممتازاً بين جودة الفهم والأداء والتكلفة. Whisper-1 دقيق جداً في التعرف على الكلام العربي.

#### Google Gemini API (gemini-2.0-flash)
- **الموقع**: `src/scenes/helpers/aiValidator.js`
- **الغرض**: التحقق من صحة البيانات والصور أثناء تسجيل الفنيين
- **الميزات المستخدمة**:
  - **Model: `gemini-2.0-flash`** - التحقق من صحة الاسم العربي
    - يفحص ما إذا كان النص اسماً عربياً حقيقياً
    - احتياطي: التحقق عبر التعبيرات المنتظمة (regex) في حال عدم توفر مفتاح API
  - **Model: `gemini-2.0-flash`** (Vision) - التحقق من وثيقة الهوية
    - تحميل صورة الهوية من Telegram، تحويلها إلى base64
    - إرسالها إلى Gemini Vision لاستخراج الاسم من البطاقة
    - مقارنة الاسم المستخرج مع الاسم المدخل باستخدام تقنية التطابق الضبابي (Fuzzy Matching)
    - تطبيع الأحرف العربية: إزالة التشكيل، توحيد ألف/ياء/تاء مربوطة
    - عتبة القبول: 50% تشابه في الكلمات المشتركة
  - **Model: `gemini-2.0-flash`** (Vision) - التحقق من الصورة الشخصية
    - فحص ما إذا كانت الصورة تحتوي على وجه بشري واضح
    - إرجاع نجاح/فشل مع سبب
- **سبب الاختيار**: Gemini-2.0-flash يوفر قدرات رؤية مجانية ممتازة (Vision) مع أداء سريع، مما يجعله مثالياً للتحقق من صور الهوية والصور الشخصية دون تكلفة إضافية.

---

### 1.7 إدارة الملفات والصور (File & Image Management)

#### Cloudinary v2.10.0
- **الموقع**: `src/services/cloudinary.js`
- **الغرض**: استضافة وإدارة الصور بشكل آمن
- **الميزات المستخدمة**:
  - `v2.uploader.upload_stream()` - رفع الصور عبر stream مباشر من Telegram دون حفظ محلي
  - `v2.url()` - إنشاء روابط موقعة (signed URLs) مع صلاحية زمنية محدودة (10 دقائق)
  - `cloudinary.config()` - إعدادات السحابة (Cloud Name, API Key, API Secret)
  - المجلد: `gazaserve/` - تنظيم الملفات في مجلد مخصص
  - نوع الرفع: `authenticated` - وصول مصادق عليه فقط
- **العمليات**:
  - `uploadFromTelegram(fileId)` - ينزل الملف من Telegram API ويرفعه إلى Cloudinary
  - `getSignedPhotoUrl(publicId, expiresMinutes)` - يولد رابطاً موقّتاً محدود الصلاحية
  - `getTelegramFilePath(fileId)` - يحصل على مسار الملف من Telegram API
- **سبب الاختيار**: Cloudinary يوفر خدمة استضافة صور سحابية مع ميزات أمان متقدمة (الروابط الموقعة)، ومعالجة آلية للصور، ويدعم الرفع المباشر عبر stream دون الحاجة لتخزين مؤقت.

#### Multer v2.2.0
- **الموقع**: `src/routes/api.js`
- **الغرض**: معالجة رفع الملفات عبر REST API
- **الميزات المستخدمة**:
  - `multer.diskStorage()` - تخزين الملفات على القرص المحلي في مجلد `uploads/`
  - `fileFilter` - السماح فقط بملفات الصور (`image/*`)
  - `limits: { fileSize: 10 * 1024 * 1024 }` - حد أقصى 10MB لكل ملف
  - `fields()` - تعريف حقول متعددة: `national_id` (ملف واحد)، `profile_photo` (ملف واحد)، `certificates` (حتى 5 ملفات)
- **سبب الاختيار**: Multer هو أشهر مكتبة لمعالجة `multipart/form-data` في Express، بسيطة وموثوقة وقابلة للتخصيص.

---

### 1.8 الأمان والحماية (Security)

#### Helmet v8.2.0
- **الموقع**: `index.js`
- **الغرض**: تعيين رؤوس أمان HTTP
- **الرؤوس المطبقة**:
  - `X-Content-Type-Options: nosniff` - منع تخمين نوع المحتوى
  - `X-Frame-Options: SAMEORIGIN` - منع التضمين في iframes خارجية
  - `Strict-Transport-Security` - فرض HTTPS
  - `X-XSS-Protection` - حماية من هجمات XSS
- **سبب الاختيار**: Helmet يطبق أفضل ممارسات الأمان على مستوى HTTP headers بخطوة واحدة، ويحمي من هجمات XSS و clickjacking.

#### CORS v2.8.6
- **الموقع**: `index.js`
- **الغرض**: التحكم في المشاركة بين المصادر المختلفة
- **سبب الاختيار**: ضروري لتمكين لوحة التحكم الإدارية في React من التواصل مع خادم API.

#### express-rate-limit v8.5.2
- **الموقع**: `src/routes/webhook.js`، `src/routes/dashboard.js`، `src/routes/admin.js`
- **الغرض**: الحد من عدد الطلبات لمنع هجمات DDoS وإساءة الاستخدام
- **الحدود المطبقة**:
  - Webhook: 60 طلب لكل دقيقة
  - Dashboard API: 100 طلب لكل 15 دقيقة
  - Admin API: 300 طلب لكل 15 دقيقة
- **سبب الاختيار**: مكتبة خفيفة وسهلة التكوين توفر حماية أساسية ضد الهجمات.

#### Morgan v1.10.1
- **الموقع**: `index.js`
- **الغرض**: تسجيل طلبات HTTP للتدقيق والتصحيح
- **الصيغة المستخدمة**: `short` (عنوان IP، الطريقة، المسار، رمز الحالة، وقت المعالجة)
- **سبب الاختيار**: أداة تسجيل قياسية وخفيضة التأثير.

---

### 1.9 الجدولة والمهام المجدولة (Scheduling)

#### node-cron v4.6.0
- **الموقع**: `src/services/scheduledJobs.js`
- **الغرض**: تشغيل مهام دورية لفحص الطلبات المعلقة
- **الجدول**: كل 15 دقيقة (`*/15 * * * *`)
- **المهام**:
  - فحص جميع الطلبات المعلقة (pending) بدون فني معين
  - بعد 3 ساعات عمل: توسيع نطاق البحث إلى المناطق المجاورة
  - بعد 6 ساعات عمل: إخطار المشرف مباشرة
  - يعمل فقط خلال ساعات العمل (08:00 - 24:00)
- **سبب الاختيار**: node-cron مكتبة بسيطة وموثوقة لجدولة المهام، تدعم تنسيق Cron التقليدي.

---

### 1.10 أدوات التطوير والاختبار (Development Tools)

#### @faker-js/faker v9.7.0
- **الموقع**: `src/Seeders/UserSeed.js`
- **الغرض**: توليد بيانات اختبارية وهمية لقاعدة البيانات
- **الاستخدام**:
  - أسماء عربية (مع `locale: 'ar'`)
  - أرقام هواتف فلسطينية
  - مواقع في قطاع غزة
  - أوصاف مشاكل عشوائية
- **سبب الاختيار**: يوفر بيانات واقعية للاختبار والتطوير، مع دعم جيد للغة العربية.

#### dotenv v16.4.7
- **الموقع**: `index.js`، `src/config/api.js`، `src/config/database.js`
- **الغرض**: تحميل متغيرات البيئة من ملف `.env`
- **سبب الاختيار**: المكتبة القياسية والأكثر استخداماً لإدارة متغيرات البيئة في Node.js.

---

### 1.11 النمط المعماري (Architecture Pattern)

يتبع النظام نمط **MVC المعدّل (Modified MVC)** المناسب لتطبيقات البوتات:

```
View Layer          Controller Layer        Service Layer         Data Layer
(src/views/)        (src/controllers/)      (src/services/)       (src/Models/)
                                                                   
MainView.js         ClientController.js     openaiService.js      UserModel.js
FormView.js         TechnicianController    cloudinary.js         TechnicianModel.js
SubMenuView.js      RequestController.js    orderDistributor.js   RequestModel.js
NotificationView    SupportController.js    scheduledJobs.js      RatingModel.js
FallbackView.js                            workingHours.js       SupportTicketModel.js
                                                                  CategoryModel.js
                                                                  AdminModel.js
                                                                  ActivityLogModel.js
```

- **View Layer**: بناء الرسائل ولوحات المفاتيح المرسلة إلى المستخدم
- **Controller Layer**: معالجة منطق الأعمال وتوجيه التفاعلات
- **Service Layer**: عمليات معقدة وقابلة لإعادة الاستخدام (AI, Cloudinary, توزيع الطلبات)
- **Data Layer**: نماذج قاعدة البيانات والعلاقات

بالإضافة إلى:
- **Scenes Layer** (`src/scenes/`): معالجات متعددة الخطوات باستخدام WizardScene
- **Middleware Layer** (`src/middlewares/`): إدارة الحالة والمصادقة
- **Helpers Layer** (`src/helpers/`): دوال مساعدة للفنيين
- **Validations Layer** (`src/validations/`): التحقق من صحة المدخلات

---

### 1.12 إدارة الحالة (State Management)

#### In-Memory State Manager
- **الموقع**: `src/middlewares/stateManager.js`
- **الغرض**: تتبع حالة كل مستخدم أثناء التفاعل مع البوت
- **الحالات المعرفة**:
  - `IDLE` - حالة الانتظار
  - `AWAITING_REQ_CATEGORY` - انتظار اختيار التصنيف
  - `AWAITING_REQ_DESCRIPTION` - انتظار وصف المشكلة
  - `AWAITING_REQ_MAIN_REGION` - انتظار اختيار المنطقة الرئيسية
  - `AWAITING_REQ_SUB_REGION` - انتظار اختيار المنطقة الفرعية
  - `AWAITING_REQ_ADDRESS` - انتظار العنوان التفصيلي
  - `AWAITING_REQ_DATE` - انتظار التاريخ
  - `AWAITING_REQ_TIME` - انتظار الوقت
  - `AWAITING_REQ_PHOTO` - انتظار الصورة
  - `AWAITING_REQ_CONFIRM` - انتظار التأكيد
  - `AWAITING_SUPPORT_MESSAGE` - انتظار رسالة الدعم
  - `AWAITING_ADMIN_REPLY` - انتظار رد المشرف
- **الميزات**:
  - تخزين بيانات الحالة لكل محادثة
  - حفظ تاريخ المحادثة (آخر 10 رسائل) لسياق AI
- **سبب الاختيار**: إدارة الحالة في الذاكرة مناسبة لبوت Telegram لأن الجلسات قصيرة الأمد، ولا تتطلب قاعدة بيانات إضافية مما يقلل زمن الاستجابة.

---

### 1.13 إدارة سير العمل (Workflow Management)

#### تدفق تسجيل الفنيين (WizardScene - 8 خطوات)
1. **الخطوة 0**: طلب الاسم الكامل
2. **الخطوة 1**: التحقق من الاسم عبر AI (Gemini)، حفظه، طلب رقم الهاتف
3. **الخطوة 2**: التحقق من رقم الهاتف الفلسطيني (059/056)، طلب التصنيف
4. **الخطوة 3**: اختيار التصنيف (لوحة مفاتيح من التصنيفات المسجلة)
5. **الخطوة 4**: اختيار المنطقة + المنطقة الفرعية
6. **الخطوة 5**: اختيار سنوات الخبرة (1-5 سنوات فأكثر)
7. **الخطوة 6**: رفع صورة الهوية + التحقق عبر Gemini Vision
8. **الخطوة 7**: عرض الملخص للتأكيد/التعديل/الإلغاء، ثم الحفظ في قاعدة البيانات و Cloudinary

#### تدفق تقديم الطلب (State Machine - 9 حالات)
```
IDLE
  -> AWAITING_REQ_CATEGORY (اختيار التصنيف)
    -> AWAITING_REQ_DESCRIPTION (وصف المشكلة - نص أو صوت)
      -> AWAITING_REQ_MAIN_REGION (المنطقة الرئيسية)
        -> AWAITING_REQ_SUB_REGION (المنطقة الفرعية)
          -> AWAITING_REQ_ADDRESS (العنوان التفصيلي)
            -> AWAITING_REQ_DATE (التاريخ)
              -> AWAITING_REQ_TIME (الوقت)
                -> AWAITING_REQ_PHOTO (صورة اختيارية)
                  -> AWAITING_REQ_CONFIRM (تأكيد الطلب)
```

#### توزيع الطلبات (Order Distribution)
```
طلب جديد (pending, no tech)
  -> البحث عن فنيين: نفس التصنيف + نفس المنطقة
    -> إذا وُجد: إرسال إشعار مع أزرار قبول/رفض
      -> أول من يقبل: يحصل على الطلب (atomic UPDATE)
      -> من يرفض: يمرر للفني التالي (حسب التقييم الأعلى)
      -> رفض الجميع: إعلام العميل
    -> إذا لم يوجد: إعلام العميل

بعد 3 ساعات عمل (escalated_3h)
  -> توسيع البحث للمناطق المجاورة
  -> إعادة المحاولة

بعد 6 ساعات عمل (escalated_6h)
  -> إخطار المشرف (ADMIN_ID)
```

---

### 1.14 الاستضافة والنشر (Hosting & Deployment)

- **المنصة**: Railway.app (PaaS)
- **نظام إدارة قواعد البيانات**: MySQL 9.4.0 (Plugin داخل Railway)
  - اتصال داخلي عبر `mysql.railway.internal` (بدون رسوم نقل بيانات)
- **وضع التشغيل**: Polling (بدون Webhook) - `FORCE_POLLING=true`
- **المنفذ**: 8080 (يحدده Railway ديناميكياً)
- **SSL**: `rejectUnauthorized: false` للتعامل مع شهادات Railway الذاتية التوقيع

---

### 1.15 ملخص التقنيات

| التقنية | الإصدار | الاستخدام | البدائل الممكنة |
|---|---|---|---|
| Node.js | v18.11+ | بيئة التشغيل | Python, PHP, Java |
| Express | 5.1.0 | خادم HTTP و REST API | Fastify, Koa, Hapi |
| Telegraf | 4.16.3 | إطار بوت Telegram | node-telegram-bot-api |
| Sequelize | 6.37.6 | ORM لقاعدة البيانات | Prisma, TypeORM, Knex |
| MySQL | 9.4.0 | قاعدة البيانات | PostgreSQL, SQLite |
| mysql2 | 3.22.3 | مشغل MySQL | mysql (القديم) |
| OpenAI | 4.93.0 | ذكاء اصطناعي (تصنيف، محادثة، صوت) | Claude API, Cohere |
| Gemini | 2.0-flash | ذكاء اصطناعي (رؤية، تحقق) | Claude Vision, GPT-4 Vision |
| Cloudinary | 2.10.0 | استضافة الصور | AWS S3, Cloudflare R2 |
| Multer | 2.2.0 | رفع الملفات | formidable, busboy |
| Helmet | 8.2.0 | أمان HTTP | - |
| CORS | 2.8.6 | مشاركة المصادر | - |
| express-rate-limit | 8.5.2 | تحديد المعدل | rate-limiter-flexible |
| node-cron | 4.6.0 | جدولة المهام | node-schedule, cron |
| Morgan | 1.10.1 | تسجيل الطلبات | winston, pino |
| dotenv | 16.4.7 | متغيرات البيئة | - |
| @faker-js/faker | 9.7.0 | بيانات اختبارية | chance, casual |

---

### 1.16 متطلبات النظام (System Requirements)

- **Node.js**: v18.11+ (للميزات الحديثة كـ `node --watch`)
- **RAM**: 512MB+ (للتشغيل الأساسي)
- **التخزين**: 100MB+ (للشفرة المصدرية والملفات المرفوعة)
- **نظام التشغيل**: Windows, Linux, أو macOS (مُختبر على Windows)
- **قاعدة البيانات**: MySQL 8.0+
- **اتصال الإنترنت**: مطلوب للتواصل مع Telegram API, OpenAI API, Gemini API, Cloudinary
