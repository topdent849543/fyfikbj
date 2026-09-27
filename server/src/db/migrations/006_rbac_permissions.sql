-- TopDent RBAC, company scope, invoices, delivery issues, and account lifecycle.
-- This migration is additive and intentionally leaves legacy users.role and is_active intact.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE account_status_type AS ENUM ('active', 'inactive', 'suspended', 'pending');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'ready_for_delivery';
  ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'final_review';
  ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'failed_delivery';
  ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'needs_follow_up';
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status account_status_type NOT NULL DEFAULT 'active';
UPDATE users
SET account_status = CASE WHEN COALESCE(is_active, true) THEN 'active'::account_status_type ELSE 'inactive'::account_status_type END
WHERE account_status IS NULL OR (account_status = 'active' AND COALESCE(is_active, true) = false);
CREATE INDEX IF NOT EXISTS idx_users_account_status ON users(account_status, is_active);

CREATE OR REPLACE FUNCTION sync_user_account_status()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.is_active IS DISTINCT FROM OLD.is_active AND NEW.account_status = OLD.account_status THEN
    NEW.account_status := CASE WHEN NEW.is_active THEN 'active'::account_status_type ELSE 'inactive'::account_status_type END;
  END IF;
  NEW.is_active := NEW.account_status = 'active'::account_status_type;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_sync_user_account_status ON users;
CREATE TRIGGER trg_sync_user_account_status
BEFORE INSERT OR UPDATE OF is_active, account_status ON users
FOR EACH ROW EXECUTE FUNCTION sync_user_account_status();

CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) NOT NULL UNIQUE,
  name_ar VARCHAR(255) NOT NULL,
  description TEXT,
  module VARCHAR(80) NOT NULL,
  is_system BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) NOT NULL UNIQUE,
  name_ar VARCHAR(255) NOT NULL,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS user_role_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  company_id UUID REFERENCES merchants(id) ON DELETE CASCADE,
  scope_type VARCHAR(20) NOT NULL CHECK (scope_type IN ('global', 'company')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((scope_type = 'global' AND company_id IS NULL) OR (scope_type = 'company' AND company_id IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_role_assignment_global_unique
ON user_role_assignments(user_id, role_id) WHERE company_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_role_assignment_company_unique
ON user_role_assignments(user_id, role_id, company_id) WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_role_assignments_access ON user_role_assignments(user_id, is_active, company_id);
CREATE INDEX IF NOT EXISTS idx_user_role_assignments_company ON user_role_assignments(company_id, is_active);

INSERT INTO roles (key, name_ar, description, is_system, is_active) VALUES
  ('platform_owner', 'المدير العام', 'المالك الأعلى للمنصة ويُنشأ حصراً عبر bootstrap آمن.', true, true),
  ('platform_admin', 'الأدمن العام', 'إدارة مركزية بصلاحيات يحددها المدير العام.', true, true),
  ('company_manager', 'مدير الشركة', 'إدارة شركة واحدة ضمن نطاقها فقط.', true, true),
  ('company_admin', 'أدمن الشركة', 'إدارة محددة الصلاحيات ضمن شركة واحدة.', true, true),
  ('platform_driver', 'سائق عام', 'سائق يتعامل فقط مع الطلبات المعيّنة أو المتاحة له.', true, true),
  ('company_driver', 'سائق شركة', 'سائق مقيّد بطلبات شركة معيّنة.', true, true),
  ('customer', 'عميل', 'مستخدم متجر TopDent العادي.', true, true),
  ('legacy_platform_operator', 'مشغل منصة موروث', 'دور توافق مؤقت للحسابات الإدارية القديمة فقط.', true, true)
ON CONFLICT (key) DO UPDATE SET name_ar = EXCLUDED.name_ar, description = EXCLUDED.description, is_active = true, updated_at = NOW();

INSERT INTO permissions (key, name_ar, description, module) VALUES
  ('dashboard.view', 'عرض لوحة التحكم', 'عرض إحصاءات ونوافذ التشغيل.', 'dashboard'),
  ('reports.view', 'عرض التقارير', 'عرض تقارير المنصة أو الشركة.', 'reports'),
  ('reports.export', 'تصدير التقارير', 'تصدير تقارير CSV.', 'reports'),
  ('users.view', 'عرض المستخدمين', 'عرض المستخدمين ضمن النطاق.', 'users'),
  ('users.create', 'إنشاء مستخدم', 'إنشاء مستخدم إداري أو موظف.', 'users'),
  ('users.update', 'تعديل مستخدم', 'تعديل بيانات المستخدم الإدارية.', 'users'),
  ('users.disable', 'تعطيل مستخدم', 'تفعيل أو تعطيل حساب مستخدم.', 'users'),
  ('users.assign_role', 'تعيين دور', 'تعيين أدوار ونطاقات للمستخدمين.', 'users'),
  ('roles.view', 'عرض الأدوار', 'عرض مصفوفة الأدوار والصلاحيات.', 'roles'),
  ('roles.create', 'إنشاء دور', 'إنشاء دور مخصص.', 'roles'),
  ('roles.update', 'تعديل دور', 'تعديل دور مخصص.', 'roles'),
  ('roles.assign', 'تعيين صلاحيات دور', 'تعديل صلاحيات دور أو إسناده.', 'roles'),
  ('companies.view', 'عرض الشركات', 'عرض الشركات ضمن النطاق.', 'companies'),
  ('companies.create', 'إنشاء شركة', 'إضافة شركة جديدة.', 'companies'),
  ('companies.update', 'تعديل شركة', 'تعديل بيانات الشركة.', 'companies'),
  ('companies.disable', 'تعطيل شركة', 'تفعيل أو تعطيل الشركة.', 'companies'),
  ('companies.manage_team', 'إدارة فريق الشركة', 'إدارة موظفي وسائقي الشركة.', 'companies'),
  ('products.view', 'عرض المنتجات', 'عرض المنتجات الإدارية.', 'products'),
  ('products.create', 'إضافة منتج', 'إنشاء منتج للشركة.', 'products'),
  ('products.update', 'تعديل منتج', 'تعديل منتج للشركة.', 'products'),
  ('products.copy', 'نسخ منتج', 'نسخ بيانات منتج.', 'products'),
  ('products.hide', 'إخفاء منتج', 'إخفاء منتج من العرض.', 'products'),
  ('products.archive', 'أرشفة منتج', 'أرشفة منتج من العرض.', 'products'),
  ('products.approve', 'اعتماد منتج', 'اعتماد منتج معلق.', 'products'),
  ('products.reject', 'رفض منتج', 'رفض منتج مع سبب.', 'products'),
  ('products.price.update', 'تعديل السعر', 'تحديث سعر المنتج.', 'products'),
  ('products.stock.update', 'تعديل المخزون', 'تحديث مخزون المنتج.', 'products'),
  ('orders.view', 'عرض الطلبات', 'عرض الطلبات ضمن النطاق.', 'orders'),
  ('orders.review', 'مراجعة الطلبات', 'بدء مراجعة الطلب.', 'orders'),
  ('orders.approve', 'اعتماد الطلبات', 'اعتماد أو رفض الطلب.', 'orders'),
  ('orders.reject', 'رفض الطلبات', 'رفض الطلب مع سبب.', 'orders'),
  ('orders.cancel', 'إلغاء الطلبات', 'إلغاء طلب مع سبب.', 'orders'),
  ('orders.assign_driver', 'تعيين سائق', 'تعيين سائق لطلب.', 'orders'),
  ('orders.change_status', 'تغيير حالة الطلب', 'تغيير حالات التجهيز أو التوصيل المصرح بها.', 'orders'),
  ('orders.confirm_delivery', 'تأكيد التسليم', 'تأكيد مراحل التسليم كسائق.', 'orders'),
  ('orders.confirm_payment', 'تأكيد التحصيل', 'تسجيل أو تأكيد التحصيل.', 'orders'),
  ('orders.final_review', 'المراجعة النهائية', 'إغلاق الطلب بعد المراجعة.', 'orders'),
  ('orders.archive', 'أرشفة الطلبات', 'أرشفة الطلبات المكتملة.', 'orders'),
  ('drivers.view', 'عرض السائقين', 'عرض السائقين ضمن النطاق.', 'drivers'),
  ('drivers.create', 'إضافة سائق', 'إنشاء أو تفعيل ملف سائق.', 'drivers'),
  ('drivers.update', 'تعديل سائق', 'تعديل بيانات السائق.', 'drivers'),
  ('drivers.disable', 'تعطيل سائق', 'تعطيل أو تفعيل السائق.', 'drivers'),
  ('drivers.assign', 'تعيين سائق', 'ربط سائق بشركة أو طلب.', 'drivers'),
  ('finance.view', 'عرض المالية', 'عرض التحصيلات المالية.', 'finance'),
  ('finance.confirm_payment', 'تأكيد دفعة', 'تأكيد تحصيل مالي.', 'finance'),
  ('invoices.view', 'عرض الفواتير', 'عرض فواتير النطاق.', 'invoices'),
  ('invoices.export', 'تصدير الفواتير', 'تصدير فواتير النطاق.', 'invoices'),
  ('notifications.view', 'عرض الإشعارات', 'عرض الإشعارات الإدارية.', 'notifications'),
  ('notifications.send', 'إرسال إشعار', 'إرسال إشعارات إدارية.', 'notifications'),
  ('audit.view', 'عرض سجل النشاط', 'عرض سجل العمليات الحساسة.', 'audit'),
  ('settings.view', 'عرض الإعدادات', 'عرض إعدادات المنصة.', 'settings'),
  ('settings.manage', 'إدارة الإعدادات', 'تعديل إعدادات المنصة.', 'settings'),
  ('rentals.view', 'عرض الإيجارات', 'عرض طلبات الإيجار.', 'rentals'),
  ('rentals.manage', 'إدارة الإيجارات', 'إدارة الإيجارات وطلباتها.', 'rentals'),
  ('dental_cards.view', 'عرض طلبات الكروت', 'عرض طلبات تصميم الكروت.', 'dental_cards'),
  ('dental_cards.manage', 'إدارة طلبات الكروت', 'إدارة أسعار وحالات الكروت.', 'dental_cards'),
  ('coupons.view', 'عرض الكوبونات', 'عرض كوبونات الخصم.', 'coupons'),
  ('coupons.create', 'إنشاء كوبون', 'إنشاء كوبون خصم.', 'coupons'),
  ('coupons.update', 'تعديل كوبون', 'تعديل كوبون خصم.', 'coupons'),
  ('coupons.disable', 'تعطيل كوبون', 'تعطيل كوبون خصم.', 'coupons'),
  ('offers.view', 'عرض العروض', 'عرض العروض والبنرات.', 'offers'),
  ('offers.create', 'إنشاء عرض', 'إنشاء عرض أو بنر.', 'offers'),
  ('offers.update', 'تعديل عرض', 'تعديل عرض أو بنر.', 'offers'),
  ('offers.disable', 'تعطيل عرض', 'تعطيل عرض أو بنر.', 'offers')
ON CONFLICT (key) DO UPDATE SET name_ar = EXCLUDED.name_ar, description = EXCLUDED.description, module = EXCLUDED.module;

-- The platform owner is an explicit application-level bypass. Platform admins are deliberately not given defaults.
-- Company managers retain the operational permissions required by current company workflows.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.key = 'company_manager' AND p.key IN (
  'dashboard.view','companies.view','companies.update','companies.manage_team','users.view','users.create','users.update','users.disable','users.assign_role',
  'products.view','products.create','products.update','products.copy','products.hide','products.archive','products.price.update','products.stock.update',
  'orders.view','orders.review','orders.change_status','orders.assign_driver','orders.confirm_delivery','orders.confirm_payment','drivers.view','drivers.create','drivers.update','drivers.disable','drivers.assign',
  'finance.view','invoices.view','rentals.view','rentals.manage','dental_cards.view','dental_cards.manage','notifications.view'
)
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.key IN ('platform_driver','company_driver') AND p.key IN ('dashboard.view','orders.view','orders.change_status','orders.confirm_delivery','orders.confirm_payment','drivers.view','notifications.view')
ON CONFLICT DO NOTHING;

-- Compatibility only: pre-existing legacy administrators retain their existing capabilities through a dedicated role.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.key = 'legacy_platform_operator'
ON CONFLICT DO NOTHING;

-- Backfill active assignments without changing legacy primary roles.
INSERT INTO user_role_assignments (user_id, role_id, company_id, scope_type, assigned_by)
SELECT u.id, r.id, NULL, 'global', NULL
FROM users u JOIN roles r ON r.key = CASE
  WHEN u.role::text = 'admin' THEN 'platform_admin'
  WHEN u.role::text = 'manager' THEN 'platform_admin'
  WHEN u.role::text = 'driver' THEN 'platform_driver'
  ELSE 'customer'
END
WHERE NOT EXISTS (SELECT 1 FROM user_role_assignments a WHERE a.user_id = u.id AND a.role_id = r.id AND a.company_id IS NULL)
ON CONFLICT DO NOTHING;

INSERT INTO user_role_assignments (user_id, role_id, company_id, scope_type, assigned_by)
SELECT m.user_id, r.id, m.id, 'company', NULL
FROM merchants m JOIN roles r ON r.key = 'company_manager'
WHERE NOT EXISTS (SELECT 1 FROM user_role_assignments a WHERE a.user_id = m.user_id AND a.role_id = r.id AND a.company_id = m.id)
ON CONFLICT DO NOTHING;

INSERT INTO user_role_assignments (user_id, role_id, company_id, scope_type, assigned_by)
SELECT u.id, r.id, NULL, 'global', NULL
FROM users u JOIN roles r ON r.key = 'legacy_platform_operator'
WHERE u.role::text = 'admin'
  AND NOT EXISTS (SELECT 1 FROM user_role_assignments a WHERE a.user_id = u.id AND a.role_id = r.id AND a.company_id IS NULL)
ON CONFLICT DO NOTHING;

ALTER TABLE driver_profiles ADD COLUMN IF NOT EXISTS driver_type VARCHAR(20) NOT NULL DEFAULT 'platform';
ALTER TABLE driver_profiles ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES merchants(id) ON DELETE SET NULL;
ALTER TABLE driver_profiles ADD COLUMN IF NOT EXISTS plate_number VARCHAR(100);
ALTER TABLE driver_profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
DO $$ BEGIN
  ALTER TABLE driver_profiles ADD CONSTRAINT driver_profiles_type_check CHECK (driver_type IN ('platform', 'company'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE driver_profiles ADD CONSTRAINT driver_profiles_company_check CHECK ((driver_type = 'platform' AND company_id IS NULL) OR (driver_type = 'company' AND company_id IS NOT NULL));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS idx_driver_profiles_company_active ON driver_profiles(company_id, is_active, is_available);

CREATE TABLE IF NOT EXISTS delivery_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES driver_profiles(id) ON DELETE RESTRICT,
  issue_type VARCHAR(50) NOT NULL CHECK (issue_type IN ('customer_not_available','customer_refused','wrong_address','payment_problem','missing_product','other')),
  notes TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','closed')),
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_delivery_issues_order_status ON delivery_issues(order_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number VARCHAR(80) NOT NULL UNIQUE,
  order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  company_id UUID REFERENCES merchants(id) ON DELETE SET NULL,
  currency currency_type NOT NULL DEFAULT 'SYP',
  subtotal NUMERIC(18,2) NOT NULL,
  discount_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  delivery_cost NUMERIC(18,2) NOT NULL DEFAULT 0,
  total NUMERIC(18,2) NOT NULL,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_invoices_company_issued ON invoices(company_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_issued ON invoices(customer_id, issued_at DESC);

CREATE TABLE IF NOT EXISTS invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  order_item_id UUID REFERENCES order_items(id) ON DELETE SET NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(18,2) NOT NULL,
  line_total NUMERIC(18,2) NOT NULL,
  currency currency_type NOT NULL DEFAULT 'SYP',
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE money_receipts ADD COLUMN IF NOT EXISTS confirmed_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE money_receipts ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS actor_role VARCHAR(100);
ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES merchants(id) ON DELETE SET NULL;
ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS old_values JSONB;
ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS new_values JSONB;

CREATE OR REPLACE FUNCTION protect_platform_owner_assignment()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE owner_role UUID;
BEGIN
  SELECT id INTO owner_role FROM roles WHERE key = 'platform_owner';
  IF owner_role IS NOT NULL AND (
    (TG_OP = 'DELETE' AND OLD.role_id = owner_role) OR
    (TG_OP = 'UPDATE' AND OLD.role_id = owner_role AND (NEW.role_id <> OLD.role_id OR NEW.is_active = false))
  ) THEN
    RAISE EXCEPTION 'Platform owner assignments are protected and must be managed through the bootstrap recovery procedure';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
DROP TRIGGER IF EXISTS trg_protect_platform_owner_assignment ON user_role_assignments;
CREATE TRIGGER trg_protect_platform_owner_assignment
BEFORE UPDATE OR DELETE ON user_role_assignments
FOR EACH ROW EXECUTE FUNCTION protect_platform_owner_assignment();
