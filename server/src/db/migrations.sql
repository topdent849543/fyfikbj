-- Create enum types
DO $$ BEGIN CREATE TYPE user_role AS ENUM ('customer', 'merchant', 'admin', 'manager'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE product_condition AS ENUM ('new', 'used'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE order_status AS ENUM (
    'new', 'pending_review', 'approved', 'preparing',
    'in_delivery', 'arrived', 'delivered', 'awaiting_payment',
    'payment_received', 'rejected', 'cancelled', 'completed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE payment_status AS ENUM ('pending', 'received', 'failed', 'cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE delivery_speed AS ENUM ('normal', 'urgent', 'very_urgent'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE currency_type AS ENUM ('SYP', 'USD'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  whatsapp VARCHAR(20),
  province VARCHAR(100),
  address VARCHAR(500),
  university_clinic VARCHAR(255),
  role user_role DEFAULT 'customer',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Merchants table
CREATE TABLE IF NOT EXISTS merchants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_name VARCHAR(255) NOT NULL,
  logo_url VARCHAR(500),
  description TEXT,
  phone VARCHAR(20),
  whatsapp VARCHAR(20),
  province VARCHAR(100),
  contact_email VARCHAR(255),
  dollar_rate DECIMAL(10, 2) DEFAULT 15000,
  is_active BOOLEAN DEFAULT true,
  is_approved BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(100) UNIQUE,
  category VARCHAR(100) NOT NULL,
  sub_category VARCHAR(100),
  description TEXT,
  specifications TEXT,
  condition product_condition DEFAULT 'new',
  price DECIMAL(15, 2) NOT NULL,
  currency currency_type DEFAULT 'SYP',
  stock_quantity INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  is_approved BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Product images
CREATE TABLE IF NOT EXISTS product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_url VARCHAR(500) NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Categories
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  icon_url VARCHAR(500),
  order_index INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Sub categories
CREATE TABLE IF NOT EXISTS sub_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Favorites
CREATE TABLE IF NOT EXISTS favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

-- Shopping cart
CREATE TABLE IF NOT EXISTS cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT cart_items_user_product_key UNIQUE(user_id, product_id)
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR(50) UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  status order_status DEFAULT 'new',
  payment_status payment_status DEFAULT 'pending',
  subtotal DECIMAL(15, 2) NOT NULL,
  discount_amount DECIMAL(15, 2) DEFAULT 0,
  delivery_cost DECIMAL(15, 2) DEFAULT 0,
  total DECIMAL(15, 2) NOT NULL,
  currency currency_type DEFAULT 'SYP',
  delivery_speed delivery_speed DEFAULT 'normal',
  delivery_time_slot VARCHAR(100),
  customer_name VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(20) NOT NULL,
  customer_whatsapp VARCHAR(20),
  province VARCHAR(100) NOT NULL,
  address VARCHAR(500) NOT NULL,
  notes TEXT,
  discount_code VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  delivered_at TIMESTAMP,
  completed_at TIMESTAMP
);

-- Order items
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  product_code VARCHAR(100),
  product_name VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price DECIMAL(15, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Provinces
CREATE TABLE IF NOT EXISTS provinces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Delivery rates
CREATE TABLE IF NOT EXISTS delivery_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  speed delivery_speed NOT NULL,
  same_province DECIMAL(10, 2) NOT NULL,
  other_province DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT delivery_rates_merchant_speed_key UNIQUE(merchant_id, speed),
  CHECK (same_province >= 0 AND other_province >= 0)
);

-- Discount codes
CREATE TABLE IF NOT EXISTS discount_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  discount_percentage DECIMAL(5, 2),
  discount_amount DECIMAL(15, 2),
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  expires_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  CHECK (current_uses >= 0),
  CHECK (max_uses IS NULL OR max_uses > 0),
  CHECK (
    (discount_percentage IS NOT NULL AND discount_amount IS NULL AND discount_percentage > 0 AND discount_percentage <= 100)
    OR (discount_percentage IS NULL AND discount_amount IS NOT NULL AND discount_amount > 0)
  )
);

-- Banners
CREATE TABLE IF NOT EXISTS banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255),
  image_url VARCHAR(500) NOT NULL,
  link_url VARCHAR(500),
  order_index INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  related_order_id UUID REFERENCES orders(id),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Activity log
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(255) NOT NULL,
  entity_type VARCHAR(100),
  entity_id VARCHAR(100),
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- System settings
CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(255) UNIQUE NOT NULL,
  value TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_merchant ON products(merchant_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_active_approved ON products(is_active, is_approved);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_merchant ON orders(merchant_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_user ON cart_items(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_log(user_id);

-- Upgrade invariants for databases that were created with the original schema.
WITH ranked AS (
  SELECT
    id,
    SUM(quantity) OVER (PARTITION BY user_id, product_id) AS total_quantity,
    ROW_NUMBER() OVER (PARTITION BY user_id, product_id ORDER BY created_at, id) AS row_number
  FROM cart_items
)
UPDATE cart_items AS item
SET quantity = ranked.total_quantity
FROM ranked
WHERE item.id = ranked.id AND ranked.row_number = 1;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY user_id, product_id ORDER BY created_at, id) AS row_number
  FROM cart_items
)
DELETE FROM cart_items AS item
USING ranked
WHERE item.id = ranked.id AND ranked.row_number > 1;

DO $$ BEGIN
  ALTER TABLE cart_items ADD CONSTRAINT cart_items_user_product_key UNIQUE (user_id, product_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY merchant_id, speed ORDER BY updated_at DESC, created_at DESC, id) AS row_number
  FROM delivery_rates
)
DELETE FROM delivery_rates AS rate
USING ranked
WHERE rate.id = ranked.id AND ranked.row_number > 1;

DO $$ BEGIN
  ALTER TABLE delivery_rates ADD CONSTRAINT delivery_rates_merchant_speed_key UNIQUE (merchant_id, speed);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

UPDATE discount_codes SET current_uses = 0 WHERE current_uses IS NULL;
ALTER TABLE discount_codes ALTER COLUMN current_uses SET NOT NULL;

-- Atomically reserves one use of a discount code. The API calls this after the
-- order rows are created and deletes the order if no use remains.
CREATE OR REPLACE FUNCTION consume_discount_use(discount_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  updated_rows INTEGER;
BEGIN
  UPDATE discount_codes
  SET current_uses = current_uses + 1
  WHERE id = discount_id
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > NOW())
    AND (max_uses IS NULL OR current_uses < max_uses);

  GET DIAGNOSTICS updated_rows = ROW_COUNT;
  RETURN updated_rows = 1;
END;
$$;

-- Initial catalog data. Names intentionally match the values used by the UI.
INSERT INTO categories (name, description, order_index)
VALUES
  ('أدوات', 'أدوات طب الأسنان', 1),
  ('أجهزة', 'أجهزة طب الأسنان', 2),
  ('مواد', 'مواد طب الأسنان', 3),
  ('طلاب', 'مستلزمات الطلاب', 4),
  ('عيادات', 'مستلزمات العيادات', 5),
  ('وقاية', 'معدات الوقاية', 6)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  order_index = EXCLUDED.order_index,
  is_active = true;

INSERT INTO provinces (name)
VALUES
  ('دمشق'), ('ريف دمشق'), ('حلب'), ('حمص'), ('حماة'), ('اللاذقية'), ('طرطوس'),
  ('إدلب'), ('درعا'), ('السويداء'), ('القنيطرة'), ('دير الزور'), ('الرقة'), ('الحسكة')
ON CONFLICT (name) DO UPDATE SET is_active = true;
