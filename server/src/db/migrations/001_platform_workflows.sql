-- TopDent platform workflow upgrade. Safe to apply after the original schema.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'driver';
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'assigned_to_driver';
  ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'archive';
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN CREATE TYPE approval_status AS ENUM ('draft', 'pending', 'approved', 'rejected', 'inactive'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE rental_status AS ENUM ('new', 'pending_review', 'approved', 'rejected', 'ready', 'active', 'returned', 'closed', 'cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE design_request_status AS ENUM ('new', 'quoted', 'in_progress', 'revision', 'completed', 'cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE payment_method_type AS ENUM ('cash_on_delivery', 'external_transfer'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Profiles and account lifecycle.
ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_accepted_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS area VARCHAR(150);
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_unique ON users(phone) WHERE phone IS NOT NULL;

ALTER TABLE merchants ADD COLUMN IF NOT EXISTS area VARCHAR(150);
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS approval_status approval_status NOT NULL DEFAULT 'pending';
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id);
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS website_url VARCHAR(500);
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS contact_details JSONB NOT NULL DEFAULT '{}'::jsonb;
UPDATE merchants SET approval_status = CASE WHEN is_approved THEN 'approved'::approval_status ELSE 'pending'::approval_status END WHERE approval_status IS NULL OR approval_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_merchants_approval_status ON merchants(approval_status, is_active);

CREATE TABLE IF NOT EXISTS driver_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  vehicle_info JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(128) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_password_reset_active ON password_reset_tokens(user_id, expires_at) WHERE used_at IS NULL;

-- Product lifecycle, pricing snapshots, and structured product metadata.
ALTER TABLE products ADD COLUMN IF NOT EXISTS status approval_status NOT NULL DEFAULT 'pending';
ALTER TABLE products ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE products ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id);
ALTER TABLE products ADD COLUMN IF NOT EXISTS original_price NUMERIC(15,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS price_syp NUMERIC(18,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS dollar_rate_snapshot NUMERIC(12,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS expiration_date DATE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS manufacturer VARCHAR(255);
ALTER TABLE products ADD COLUMN IF NOT EXISTS country_of_origin VARCHAR(100);
ALTER TABLE products ADD COLUMN IF NOT EXISTS warranty_details TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS warranty_months INTEGER CHECK (warranty_months IS NULL OR warranty_months >= 0);
ALTER TABLE products ADD COLUMN IF NOT EXISTS accessories TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS maintenance_details TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS delivery_same_province BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE products ADD COLUMN IF NOT EXISTS shipping_other_province BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE products ADD COLUMN IF NOT EXISTS seller_province VARCHAR(100);
ALTER TABLE products ADD COLUMN IF NOT EXISTS seller_area VARCHAR(150);
ALTER TABLE products ADD COLUMN IF NOT EXISTS seller_university VARCHAR(255);
ALTER TABLE products ADD COLUMN IF NOT EXISTS usage_duration_months INTEGER CHECK (usage_duration_months IS NULL OR usage_duration_months >= 0);
ALTER TABLE products ADD COLUMN IF NOT EXISTS defects TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS seller_declaration BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS platform_fee_accepted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
UPDATE products SET
  status = CASE WHEN is_active = false THEN 'inactive'::approval_status WHEN is_approved THEN 'approved'::approval_status ELSE 'pending'::approval_status END,
  original_price = COALESCE(original_price, price),
  price_syp = COALESCE(price_syp, CASE WHEN currency = 'USD' THEN price * COALESCE((SELECT dollar_rate FROM merchants WHERE merchants.id = products.merchant_id), 1) ELSE price END),
  seller_province = COALESCE(seller_province, (SELECT province FROM merchants WHERE merchants.id = products.merchant_id));
CREATE INDEX IF NOT EXISTS idx_products_status_active ON products(status, is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_price_syp ON products(price_syp);
CREATE INDEX IF NOT EXISTS idx_products_search_name ON products USING gin (to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(code, '') || ' ' || coalesce(description, '')));

ALTER TABLE product_images ADD COLUMN IF NOT EXISTS storage_path VARCHAR(500);
ALTER TABLE product_images ADD COLUMN IF NOT EXISTS content_type VARCHAR(100);
ALTER TABLE product_images ADD COLUMN IF NOT EXISTS byte_size INTEGER;
ALTER TABLE product_images ADD COLUMN IF NOT EXISTS width INTEGER;
ALTER TABLE product_images ADD COLUMN IF NOT EXISTS height INTEGER;
ALTER TABLE product_images ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);

CREATE TABLE IF NOT EXISTS product_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason VARCHAR(100) NOT NULL,
  details TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'closed')),
  reviewed_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  UNIQUE(product_id, reporter_id, reason)
);

-- Dynamic catalog management.
ALTER TABLE sub_categories ADD CONSTRAINT sub_categories_category_name_key UNIQUE (category_id, name);
CREATE INDEX IF NOT EXISTS idx_categories_active_order ON categories(is_active, order_index, name);
CREATE INDEX IF NOT EXISTS idx_sub_categories_category_active ON sub_categories(category_id, is_active, name);

-- Orders remain a parent record; merchant fulfilment records link through parent_order_id.
ALTER TABLE orders ALTER COLUMN merchant_id DROP NOT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS parent_order_id UUID REFERENCES orders(id) ON DELETE CASCADE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_type VARCHAR(20) NOT NULL DEFAULT 'merchant' CHECK (order_type IN ('parent', 'merchant'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_rate_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS price_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method payment_method_type NOT NULL DEFAULT 'cash_on_delivery';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(150);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS assigned_driver_id UUID REFERENCES driver_profiles(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS university_clinic VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelled_reason TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS idx_orders_parent ON orders(parent_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_driver_status ON orders(assigned_driver_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_customer_created ON orders(user_id, created_at DESC);

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS currency currency_type;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS price_syp NUMERIC(18,2);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS original_price NUMERIC(15,2);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS dollar_rate_snapshot NUMERIC(12,2);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS product_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;
UPDATE order_items SET original_price = COALESCE(original_price, price), currency = COALESCE(currency, (SELECT currency FROM orders WHERE orders.id = order_items.order_id)), price_syp = COALESCE(price_syp, price);

CREATE TABLE IF NOT EXISTS order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status order_status,
  to_status order_status NOT NULL,
  changed_by UUID REFERENCES users(id),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_order_status_history_order ON order_status_history(order_id, created_at DESC);

CREATE TABLE IF NOT EXISTS driver_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES driver_profiles(id),
  assigned_by UUID REFERENCES users(id),
  accepted_at TIMESTAMPTZ,
  arrived_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  notes TEXT,
  proof_url VARCHAR(500),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_driver_assignments_active_order ON driver_assignments(order_id) WHERE active;

CREATE TABLE IF NOT EXISTS money_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  received_by UUID REFERENCES users(id),
  recipient_name VARCHAR(255) NOT NULL,
  amount NUMERIC(18,2) NOT NULL CHECK (amount >= 0),
  currency currency_type NOT NULL DEFAULT 'SYP',
  notes TEXT,
  proof_url VARCHAR(500),
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS external_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider VARCHAR(100) NOT NULL,
  transaction_reference VARCHAR(150) NOT NULL,
  amount NUMERIC(18,2) NOT NULL CHECK (amount >= 0),
  currency currency_type NOT NULL DEFAULT 'SYP',
  receipt_url VARCHAR(500),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
  reviewed_by UUID REFERENCES users(id),
  review_note TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  UNIQUE(provider, transaction_reference)
);

-- Delivery history preserves the amounts used by existing invoices.
CREATE TABLE IF NOT EXISTS delivery_rate_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  speed delivery_speed NOT NULL,
  same_province NUMERIC(10,2) NOT NULL CHECK (same_province >= 0),
  other_province NUMERIC(10,2) NOT NULL CHECK (other_province >= 0),
  changed_by UUID REFERENCES users(id),
  effective_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_delivery_rate_history_merchant ON delivery_rate_history(merchant_id, speed, effective_at DESC);

-- Offers and scoped discounts.
CREATE TABLE IF NOT EXISTS offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  image_url VARCHAR(500),
  merchant_id UUID REFERENCES merchants(id) ON DELETE SET NULL,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);
CREATE TABLE IF NOT EXISTS offer_products (
  offer_id UUID NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  PRIMARY KEY (offer_id, product_id)
);
ALTER TABLE discount_codes ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ;
ALTER TABLE discount_codes ADD COLUMN IF NOT EXISTS min_order_amount NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (min_order_amount >= 0);
ALTER TABLE discount_codes ADD COLUMN IF NOT EXISTS max_user_uses INTEGER CHECK (max_user_uses IS NULL OR max_user_uses > 0);
ALTER TABLE discount_codes ADD COLUMN IF NOT EXISTS merchant_id UUID REFERENCES merchants(id) ON DELETE SET NULL;
ALTER TABLE discount_codes ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);
CREATE TABLE IF NOT EXISTS discount_code_products (
  discount_id UUID NOT NULL REFERENCES discount_codes(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  PRIMARY KEY (discount_id, product_id)
);
CREATE TABLE IF NOT EXISTS discount_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discount_id UUID NOT NULL REFERENCES discount_codes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(discount_id, order_id)
);
CREATE INDEX IF NOT EXISTS idx_discount_usage_user ON discount_usage(discount_id, user_id);

-- Rentals and dental-card service requests are managed workflows, not placeholder actions.
CREATE TABLE IF NOT EXISTS rentals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  daily_price NUMERIC(18,2),
  weekly_price NUMERIC(18,2),
  deposit_amount NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (deposit_amount >= 0),
  return_terms TEXT NOT NULL,
  late_fee_per_day NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (late_fee_per_day >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (daily_price IS NOT NULL OR weekly_price IS NOT NULL)
);
CREATE TABLE IF NOT EXISTS rental_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id UUID NOT NULL REFERENCES rentals(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  calculated_price NUMERIC(18,2) NOT NULL CHECK (calculated_price >= 0),
  deposit_snapshot NUMERIC(18,2) NOT NULL CHECK (deposit_snapshot >= 0),
  status rental_status NOT NULL DEFAULT 'new',
  customer_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  manager_note TEXT,
  return_condition TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_on >= starts_on)
);
CREATE INDEX IF NOT EXISTS idx_rental_requests_user_status ON rental_requests(user_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS dental_card_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  doctor_name VARCHAR(255) NOT NULL,
  specialty VARCHAR(255),
  phone VARCHAR(25) NOT NULL,
  address VARCHAR(500),
  email VARCHAR(255),
  logo_url VARCHAR(500),
  colors VARCHAR(255),
  requested_text TEXT,
  requested_template VARCHAR(100),
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  quoted_price NUMERIC(18,2),
  execution_days INTEGER CHECK (execution_days IS NULL OR execution_days > 0),
  included_revisions INTEGER NOT NULL DEFAULT 0 CHECK (included_revisions >= 0),
  status design_request_status NOT NULL DEFAULT 'new',
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dental_card_requests_status ON dental_card_requests(status, created_at DESC);

-- Initial catalog managed by the database, not client-side constants.
INSERT INTO categories (name, description, order_index) VALUES
  ('الأدوات', 'أدوات طب الأسنان', 1),
  ('المواد السنية الاستهلاكية', 'المواد والاستهلاكيات السنية', 2),
  ('الأجهزة', 'أجهزة وتجهيزات طب الأسنان', 3),
  ('مواد طلابية جامعية', 'مستلزمات الدراسة والتدريب', 4),
  ('إكسسوارات وألبسة طبية', 'إكسسوارات وملابس طبية', 5),
  ('جراحة وزرع الأسنان', 'أدوات الجراحة والزرع', 6)
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description, order_index = EXCLUDED.order_index, is_active = true;

INSERT INTO sub_categories (category_id, name)
SELECT c.id, sub.name FROM categories c
JOIN (VALUES
  ('الأدوات', 'معدنيات'), ('الأدوات', 'أدوات لبية'), ('الأدوات', 'أدوات أملغم'), ('الأدوات', 'أدوات قلع'), ('الأدوات', 'سنابل'), ('الأدوات', 'أدوات لثة'), ('الأدوات', 'أدوات جراحية'), ('الأدوات', 'مساند'), ('الأدوات', 'حاجز مطاطي'), ('الأدوات', 'أدوات كومبوزيت'),
  ('المواد السنية الاستهلاكية', 'حشوات'), ('المواد السنية الاستهلاكية', 'مواد استهلاك مرة واحدة'), ('المواد السنية الاستهلاكية', 'تخدير'), ('المواد السنية الاستهلاكية', 'إسمنتات ومواد إلصاق'), ('المواد السنية الاستهلاكية', 'مطهرات ومعقمات'), ('المواد السنية الاستهلاكية', 'مواد طبع'), ('المواد السنية الاستهلاكية', 'مواد لبية'),
  ('الأجهزة', 'قبضات'), ('الأجهزة', 'كراسي'), ('الأجهزة', 'أجهزة تعقيم'), ('الأجهزة', 'ميكروتور'), ('الأجهزة', 'ضواغط'), ('الأجهزة', 'أجهزة لبية'), ('الأجهزة', 'كاميرات'), ('الأجهزة', 'أجهزة تصليب'), ('الأجهزة', 'أجهزة جراحية'),
  ('مواد طلابية جامعية', 'مواد سنية'), ('مواد طلابية جامعية', 'مداواة لبية'), ('مواد طلابية جامعية', 'مداواة ترميمية'), ('مواد طلابية جامعية', 'تعويضات ثابتة'), ('مواد طلابية جامعية', 'تعويضات متحركة'), ('مواد طلابية جامعية', 'تشريح أسنان'), ('مواد طلابية جامعية', 'لثة'), ('مواد طلابية جامعية', 'تخدير وقلع'), ('مواد طلابية جامعية', 'زرع أسنان'), ('مواد طلابية جامعية', 'تقويم'),
  ('جراحة وزرع الأسنان', 'أدوات جراحية'), ('جراحة وزرع الأسنان', 'أدوات زراعة الأسنان')
) AS sub(category_name, name) ON sub.category_name = c.name
ON CONFLICT (category_id, name) DO UPDATE SET is_active = true;

-- Immutable audit helper used by application code.
CREATE OR REPLACE FUNCTION consume_discount_use(discount_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE updated_rows INTEGER;
BEGIN
  UPDATE discount_codes SET current_uses = current_uses + 1
  WHERE id = discount_id
    AND is_active = true
    AND (starts_at IS NULL OR starts_at <= NOW())
    AND (expires_at IS NULL OR expires_at > NOW())
    AND (max_uses IS NULL OR current_uses < max_uses);
  GET DIAGNOSTICS updated_rows = ROW_COUNT;
  RETURN updated_rows = 1;
END;
$$;
