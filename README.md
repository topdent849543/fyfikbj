# TopDent Platform

منصة إلكترونية متخصصة ببيع وشراء وعرض أدوات ومنتجات ومستلزمات طب الأسنان.

## 🚀 المميزات

### للزبائن
- ✅ تصفح وشراء منتجات طب الأسنان
- ✅ إضافة المنتجات للمفضلة والسلة
- ✅ متابعة الطلبات
- ✅ تطبيق أكواد الخصم
- ✅ إشعارات للطلبات
- ✅ تقييم المنتجات

### للتجار
- ✅ إدارة المنتجات
- ✅ إدارة الطلبات
- ✅ إدارة أسعار التوصيل
- ✅ عرض الإحصائيات والمبيعات
- ✅ إدارة معامل الدولار
- ✅ لوحة تحكم متقدمة

### للإدارة
- ✅ إدارة المستخدمين والتجار
- ✅ إدارة المنتجات والأقسام
- ✅ إدارة الطلبات والدفع
- ✅ إدارة التوصيل والسائقين
- ✅ أكواد الخصم والعروض
- ✅ التقارير والإحصائيات

## 🛠️ المتطلبات

- Node.js 18+
- npm أو yarn
- Supabase account
- Railway account (للـ deployment)

## 📋 التثبيت

### 1. استنساخ المشروع وتثبيت الرابطات

```bash
# استخرج الملف
unzip topdent-platform.zip
cd topdent-platform

# تثبيت المتعلقات للـ Backend
cd server
npm install

# تثبيت المتعلقات للـ Frontend
cd ../client
npm install
```

### 2. إعداد قاعدة البيانات

1. انشئ حساب على [Supabase](https://supabase.com)
2. أنشئ مشروع جديد
3. انسخ الـ SQL من `server/src/db/migrations.sql`
4. الصق في SQL Editor في Supabase
5. شغّل الـ migrations

### 3. إعداد متغيرات البيئة

```bash
# انسخ .env.example إلى .env
cp .env.example .env

# عدّل القيم:
# - SUPABASE_URL
# - SUPABASE_ANON_KEY
# - SUPABASE_SERVICE_KEY
# - DATABASE_URL (Supabase PostgreSQL connection string, for migrations)
# - JWT_SECRET
# - CORS_ORIGINS (comma-separated frontend origins)
# - NEXT_PUBLIC_API_URL
```

### 4. تهيئة قاعدة البيانات والتحقق

```bash
# من مجلد المشروع؛ يسجل الـ migration ويمنع إعادة تطبيق نسخة مختلفة
npm run migrate

# فحوصات الخادم والواجهة واختبارات smoke
npm run check
npm test
npm run build
```

> في الإنتاج يجب أن تكون قيمة `JWT_SECRET` عشوائية وبطول 32 محرفاً على الأقل، ويجب ضبط `CORS_ORIGINS` على نطاقات الواجهة الفعلية فقط.

### 5. تشغيل المشروع محلياً

```bash
# Backend (من مجلد server)
npm run dev

# Frontend (من مجلد client، في terminal جديد)
npm run dev
```

افتح http://localhost:3001 في المتصفح (يعمل الـ Backend على المنفذ 3000)

## 🌐 النشر على Railway

### 1. إنشاء حساب على Railway
- انتقل إلى https://railway.app
- سجل الدخول باستخدام GitHub

### 2. إنشاء مشروع جديد

```bash
# تثبيت Railway CLI
npm i -g @railway/cli

# تسجيل الدخول
railway login

# إنشاء مشروع جديد
cd topdent-platform
railway init
```

### 3. نشر Backend

```bash
cd server

# ربط المشروع
railway link

# تعيين ملفات البيئة
railway variables set SUPABASE_URL="your-url"
railway variables set SUPABASE_ANON_KEY="your-key"
railway variables set SUPABASE_SERVICE_KEY="your-key"
railway variables set JWT_SECRET="your-secret"
railway variables set PORT=3000

# النشر
railway up
```

### 4. نشر Frontend

```bash
cd ../client

# تعيين ملفات البيئة
railway variables set NEXT_PUBLIC_API_URL="https://your-backend-url.railway.app/api"

# النشر
railway up
```

### 5. الحصول على الـ URLs

```bash
railway status
```

## 📁 هيكل المشروع

```
topdent-platform/
├── server/
│   ├── src/
│   │   ├── index.js              # نقطة البداية
│   │   ├── routes/               # المسارات
│   │   ├── middleware/           # Middleware
│   │   ├── config/               # الإعدادات
│   │   └── db/                   # Database
│   ├── uploads/                  # رفع الملفات
│   ├── package.json
│   └── .env
├── client/
│   ├── src/
│   │   ├── app/                  # صفحات Next.js
│   │   ├── components/           # المكونات
│   │   ├── lib/                  # المساعدات
│   │   └── styles/               # CSS
│   ├── package.json
│   ├── tailwind.config.js
│   └── next.config.js
├── .env.example
└── README.md
```

## 🔑 المسارات الرئيسية للـ API

### المصادقة
- `POST /api/auth/register` - تسجيل مستخدم جديد
- `POST /api/auth/login` - تسجيل الدخول
- `GET /api/auth/verify` - التحقق من التوكن

### المنتجات
- `GET /api/products` - جميع المنتجات
- `GET /api/products/:id` - تفاصيل المنتج
- `POST /api/products` - إضافة منتج (تاجر)
- `PUT /api/products/:id` - تعديل منتج
- `DELETE /api/products/:id` - حذف منتج

### الطلبات
- `POST /api/orders` - إنشاء طلب
- `GET /api/orders/customer/my-orders` - طلبات الزبون
- `GET /api/orders/:id` - تفاصيل الطلب
- `PATCH /api/orders/:id/status` - تحديث حالة الطلب

### السلة
- `GET /api/cart` - عرض السلة
- `POST /api/cart` - إضافة للسلة
- `PATCH /api/cart/:itemId` - تحديث الكمية
- `DELETE /api/cart/:itemId` - حذف من السلة

### المفضلة والتوصيل
- `GET /api/favorites` - عرض المفضلة
- `POST /api/favorites/:productId` - إضافة منتج للمفضلة
- `DELETE /api/favorites/:productId` - إزالة منتج من المفضلة
- `GET /api/delivery-rates/provinces` - المحافظات المتاحة
- `GET /api/delivery-rates/quote` - حساب تكلفة التوصيل
- `GET /api/delivery-rates/merchant` - أسعار التاجر
- `PUT /api/delivery-rates/merchant/:speed` - إنشاء أو تحديث سعر توصيل

### المستخدمين
- `GET /api/users/me` - بيانات المستخدم الحالي
- `PUT /api/users/me` - تحديث الملف الشخصي
- `GET /api/users/notifications` - الإشعارات

### الإدارة
- `GET /api/admin/dashboard` - لوحة التحكم
- `GET /api/admin/merchants` - إدارة التجار
- `GET /api/admin/orders` - جميع الطلبات
- `GET /api/admin/products` - جميع المنتجات
- `PATCH /api/admin/orders/:id/payment` - تأكيد الدفع

## 🎨 التصميم

### الألوان الأساسية
- **Primary Blue**: `#2563eb`
- **Secondary Gray**: `#64748b`
- **White**: `#ffffff`

### الخطوط
- العربية: Arial/sans-serif
- الحجم الأساسي: 16px

### التفاعلات
- Smooth transitions
- Hover effects
- Loading states
- Toast notifications

## 📊 دورة الطلب الكاملة

```
1. الزبون يختار المنتج
2. إضافة للسلة
3. اختيار سرعة التوصيل
4. إكمال عملية الطلب
5. مراجعة الطلب من الإدارة/Manager
6. الموافقة
7. التاجر يجهز المنتج
8. تعيين السائق
9. التوصيل
10. استلام الأموال
11. اكتمال الطلب
```

## 🔒 الأمان

- JWT authentication
- Password hashing (bcrypt)
- Input validation
- CORS enabled
- Rate limiting (يُنصح به)
- SQL injection prevention (Supabase)

## 🐛 استكشاف الأخطاء

### خطأ الاتصال بـ Supabase
- تحقق من `SUPABASE_URL` و `SUPABASE_ANON_KEY`
- تأكد من إنشاء جداول قاعدة البيانات
- تحقق من صحة مفاتيح الـ API

### خطأ في تحميل الصور
- تحقق من وجود مجلد `uploads`
- تأكد من صلاحيات الكتابة في المجلد
- تحقق من حجم الملف

### مشاكل في الـ Frontend
- امسح `.next` folder
- أعد تثبيت المتعلقات
- تحقق من متغيرات البيئة

## 📞 الدعم والمساعدة

- البريد الإلكتروني: support@topdent.com
- WhatsApp: +1234567890
- الموقع: https://topdent.com

## 📄 الترخيص

MIT License - جميع الحقوق محفوظة © 2024 TopDent

## 🤝 المساهمة

نرحب بالمساهمات! يرجى:
1. عمل Fork للمشروع
2. إنشاء فرع جديد
3. Commit التغييرات
4. Push إلى الفرع
5. فتح Pull Request

---

**استمتع ببناء منصة TopDent! 🚀**
