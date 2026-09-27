# تقرير تسليم توسعة TopDent — RBAC وScope ولوحات التحكم

**الفرع:** `feature/rbac-scope-dashboards`
**تاريخ التنفيذ:** 2026-09-27

## 1. ملخص التنفيذ

تمت ترقية المشروع من نظام أدوار أحادي قديم (`admin / merchant / manager / driver / customer`) إلى طبقة تفويض فعلية تعتمد على:

```text
User + Account Status + active Role Assignments + Permissions + Scope + Company Assignment
```

التنفيذ **إضافي ومتوافق** مع الجداول والمسارات السابقة:

- Migration جديدة فقط: `006_rbac_permissions.sql`؛ لم يُعدّل أي Migration مطبّق سابقًا.
- أدوار النظام الأساسية: `platform_owner`, `platform_admin`, `company_manager`, `company_admin`, `platform_driver`, `company_driver`, `customer`.
- `platform_admin` لا يحصل على صلاحيات افتراضية؛ الصلاحيات تُمنح صراحةً.
- `platform_owner` لا يُنشأ من التسجيل العام، ولا يُعطّل أو يُخفّض عبر API.
- حماية Backend مفعلة عبر Middleware للصلاحيات والنطاق، وليس عبر إخفاء عناصر الواجهة فقط.
- تحديث دورة الطلب لتشمل `ready_for_delivery` و`final_review` و`failed_delivery` و`needs_follow_up`.
- فواتير ذات snapshot ثابت عند إكمال طلب الشركة، وتحصلات قابلة للتأكيد والتدقيق.
- لوحات RTL مقسمة حسب الدور والصلاحية، مع Sidebar وBreadcrumb وLoading/Empty/Error states وModal للعمليات الحساسة.

## 2. الملفات المعدّلة

| الملف | التغيير الرئيسي |
|---|---|
| `README.md` | توثيق RBAC، Migration 006، API المنصة، bootstrap، التشغيل، وسير العمل الجديد. |
| `client/src/app/dashboard/page.js` | اختيار لوحة التحكم من الدور/التعيينات الفعّالة بدل شرط `user.role` وحده. |
| `client/src/components/RequireAuth.js` | دعم `permission` و`permissions` مع شاشة منع واضحة. |
| `client/src/context/AuthContext.js` | دعم `can`, `canAny`, `canAll` وبيانات الجلسة الموسعة. |
| `client/src/lib/format.js` | تسميات الأدوار وحالات دورة الطلب الجديدة. |
| `server/package.json` | إضافة `seed:owner` مع إبقاء alias القديم. |
| `server/src/db/seedAdmin.js` | تحويل bootstrap إلى إنشاء Platform Owner آمن عبر متغيرات بيئة. |
| `server/src/index.js` | تسجيل `/api/platform`. |
| `server/src/lib/http.js` | Audit log يدعم الشركة والقيم القديمة/الجديدة والدور المنفذ. |
| `server/src/lib/orderWorkflow.js` | انتقالات جديدة، تدقيق الصلاحيات، أسباب إلزامية، وإنشاء فاتورة عند الإكمال. |
| `server/src/middleware/auth.js` | تحميل الأدوار والصلاحيات والنطاقات وحالة الحساب عند كل طلب محمي. |
| `server/src/routes/admin.js` | إبقاء الإدارة القديمة للتوافق مع اشتراط صلاحية وإغلاق تعديل المالك. |
| `server/src/routes/auth.js` | إنشاء تعيينات `customer` أو `company_manager` عند التسجيل. |
| `server/src/routes/orders.js` | حماية مسارات السائق بالصلاحيات بدل الدور، مع توافق انتقالات آمن. |
| `server/src/routes/products.js` | حماية إنشاء/تعديل/إخفاء/أرشفة المنتجات بالصلاحية ونطاق الشركة. |
| `server/src/validation/schemas.js` | عقود Zod للأدوار، الشركات، السائقين، الحسابات، المشاكل، وإدارة المنصة. |

## 3. الملفات الجديدة

| الملف | الغرض |
|---|---|
| `server/src/db/migrations/006_rbac_permissions.sql` | الجداول، البذور، القيود، حسابات الحالة، السائقون، المشاكل، الفواتير، وحماية owner. |
| `server/src/middleware/permissions.js` | `requirePermission`, `requireAnyPermission`, `requireAllPermissions`. |
| `server/src/middleware/scope.js` | `requireScope`, `requireCompanyScope`, وفلاتر نطاق الشركة. |
| `server/src/services/permissionService.js` | حل الوصول الفعلي، الصلاحيات، ومنع تصعيد الأدوار. |
| `server/src/services/invoiceService.js` | إنشاء الفاتورة وعناصرها من snapshot ثابت للطلب. |
| `server/src/routes/platform.js` | API الإدارة المقيد بالصلاحيات والنطاقات. |
| `server/test/rbac.test.js` | اختبارات RBAC، scope، وحالات سير الطلب الجديدة. |
| `client/src/components/dashboard/*` | Shell، Sidebar، Gates، Tables، Dialogs، Matrix، ولوحات الأدوار. |

## 4. الأدوار والصلاحيات والنطاقات

| الدور | النطاق | السياسة |
|---|---|---|
| `platform_owner` | عام | تجاوز مضبوط ومسجل؛ لا يُنشأ أو يُسحب أو يُعطل من API. |
| `platform_admin` | عام | لا توجد صلاحيات افتراضية. المدير العام يمنح أقل مجموعة لازمة. |
| `company_manager` | شركة واحدة | إدارة فريق ومنتجات وطلبات وسائقين وتحصلات شركة واحدة فقط. |
| `company_admin` | شركة واحدة | لا يملك شيئًا حتى يمنحه مدير الشركة الصلاحيات المناسبة. |
| `platform_driver` | عام + طلبات معيّنة | لا يرى إلا مهام التوصيل المعيّنة له. |
| `company_driver` | شركة واحدة + طلبات معيّنة | لا يصل إلى طلبات شركات أخرى. |
| `customer` | ذاتي | المتجر والسلة والطلبات والخدمات الخاصة به. |

- كل Assignment فعال يحتوي `scope_type` و`company_id` عند الحاجة.
- كل طلب محمي يعيد `403` عند غياب الصلاحية أو محاولة تجاوز company scope.
- حالات الحساب: `active`, `inactive`, `suspended`, `pending`. فقط `active` يسمح بجلسة محمية.
- يدعم الـsession endpoint: `roles`, `permissions`, `scopeType`, `companyIds`, `accountStatus`, `roleAssignments`, و`isActive`.

## 5. دورة الطلب الجديدة

```text
new → pending_review → approved → preparing → ready_for_delivery
→ assigned_to_driver → in_delivery → arrived → delivered
→ final_review → completed → archive
```

- الرفض والإلغاء يحتاجان سببًا.
- مشاكل التوصيل تنتج `needs_follow_up` أو `failed_delivery` وتُسجّل في `delivery_issues`.
- لا يستطيع السائق إكمال الطلب مباشرةً؛ بعد التسليم يرفعه للمراجعة النهائية.
- كل انتقال يحفظ في `order_status_history` و`activity_log` ويرسل إشعارًا.
- طلبات قديمة في `awaiting_payment` و`payment_received` لها جسور انتقال متوافقة وآمنة فقط.

## 6. لوحات التحكم

- **المدير العام:** إحصائيات قابلة للنقر، شركات، منتجات، طلبات، أدوار، سائقون، فواتير، وسجل تدقيق.
- **الأدمن العام:** نفس shell مع ظهور الأقسام والأزرار بناءً على الصلاحيات الممنوحة فقط.
- **مدير/أدمن الشركة:** نفس العمليات ضمن الشركة المعيّنة فقط؛ يمكن عرض/إدارة المنتجات والطلبات بحسب الصلاحيات.
- **السائق العام/سائق الشركة:** مهام معيّنة، بدء التوصيل، الوصول، التسليم، وتسجيل مشكلة عبر Modal.
- **العميل:** الطلبات، طلبات الإيجار، وطلبات تصميم الكرت.

تمت إزالة جميع استخدامات `window.prompt`. توجد Modals لتعيين السائق ورفض الطلب/المنتج وتسجيل مشكلة التوصيل، و`ConfirmDialog` جاهز للعمليات التأكيدية.

## 7. Migration المطلوبة

1. أضف متغير `DATABASE_URL` لخادم Supabase PostgreSQL إلى بيئة الـAPI/terminal.
2. شغّل:

   ```bash
   npm --prefix server run migrate
   ```

3. Runner يستخدم `schema_migrations` وchecksum ويمنع تعديل Migrations سابقة أو إعادة تطبيق Migration بشكل غير آمن.
4. لا تُشغّل migration على production من جهاز محلي إلا بمفاتيح وبيئة production المعتمدة.

## 8. حسابات Seed التجريبية

لا توجد كلمات مرور أو حسابات حقيقية داخل المستودع.

لإنشاء أول مالك منصة بعد Migration 006:

```bash
PLATFORM_OWNER_EMAIL=owner@example.com \
PLATFORM_OWNER_PASSWORD='a-long-unique-secret-of-at-least-16-characters' \
PLATFORM_OWNER_NAME='مالك TopDent' \
npm --prefix server run seed:owner
```

السكربت يرفض إنشاء مالك ثانٍ تلقائيًا. recovery mode مصمم فقط لإجراء تشغيلي مقصود ومُوثّق.

## 9. نتائج الاختبارات

```text
npm run check  → PASS (server syntax + frontend ESLint: no warnings/errors)
npm test       → PASS (11 / 11)
npm run build  → PASS (Next.js production build completed)
```

تشمل الاختبارات الجديدة: عدم منح Platform Admin أي صلاحية تلقائية، عزل الشركة، صحة نطاقات الأدوار، المراجعة النهائية، والتحقق من حالات الطلب الجديدة.

## 10. نتائج build وlint

- **Backend syntax:** Passed
- **Frontend lint:** Passed with no warnings or errors
- **Production build:** Passed; تم توليد صفحات Next.js بنجاح
- **Diff whitespace check:** Passed

## 11. نقاط لم تُنفذ أو تحتاج بيئة تشغيل حقيقية

- لم يُطبّق Migration على Supabase حقيقي لأن بيانات اتصال قاعدة الإنتاج غير متاحة في بيئة التنفيذ؛ الملفات والـrunner جاهزان.
- اختبارات التكامل الحية ضد Supabase (تفعيل مستخدمين، صفوف فعلية، وسياسات RLS في مشروع العميل) تحتاج مشروع Supabase منفصل للتشغيل الآمن.
- تصدير الفواتير والتقارير منفذ كـCSV. يمكن إضافة قالب PDF لاحقًا دون المساس بالـsnapshot أو الصلاحيات.

## 12. التشغيل المحلي

```bash
npm ci
npm --prefix server ci
npm --prefix client ci
cp .env.example .env
# اضبط Supabase وJWT_SECRET وCORS_ORIGINS وDATABASE_URL
npm --prefix server run migrate
npm run dev:server
NEXT_PUBLIC_API_URL=http://localhost:3000/api npm run dev:client
```

## 13. تطبيق Migration على Supabase

استخدم PostgreSQL connection string في `DATABASE_URL` وليس public URL فقط:

```bash
DATABASE_URL='postgresql://...' npm --prefix server run migrate
```

ثم راجع جدول `schema_migrations` وتأكد من وجود `006_rbac_permissions.sql` قبل تشغيل bootstrap owner.

## 14. إنشاء أول Platform Owner

1. طبّق migrations.
2. اختر بريدًا إداريًا جديدًا أو حسابًا معروفًا وآمنًا.
3. شغّل `seed:owner` بالمتغيرات أعلاه.
4. سجّل الدخول بهذا الحساب؛ ستعيد `/api/auth/verify` الصلاحيات والنطاق العام.
5. أنشئ Platform Admin أو أدوار مخصصة من `/api/platform/roles`، ثم امنح أقل صلاحيات ممكنة عبر `/api/platform/roles/assign`.
