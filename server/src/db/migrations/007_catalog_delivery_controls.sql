-- Catalog, university, and platform-delivery controls.
-- Additive migration: preserves all existing columns and records.
CREATE TABLE IF NOT EXISTS universities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  province_id UUID REFERENCES provinces(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT universities_name_province_key UNIQUE (name, province_id)
);
CREATE INDEX IF NOT EXISTS idx_universities_active_order ON universities(is_active, order_index, name);

CREATE TABLE IF NOT EXISTS platform_delivery_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  speed delivery_speed NOT NULL,
  same_province NUMERIC(10,2) NOT NULL CHECK (same_province >= 0),
  other_province NUMERIC(10,2) NOT NULL CHECK (other_province >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT platform_delivery_rates_speed_key UNIQUE(speed)
);

ALTER TABLE merchants ADD COLUMN IF NOT EXISTS delivery_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE products ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE SET NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sub_category_id UUID REFERENCES sub_categories(id) ON DELETE SET NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS delivery_provider VARCHAR(20) NOT NULL DEFAULT 'auto' CHECK (delivery_provider IN ('auto', 'merchant', 'platform'));
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_sub_category_id ON products(sub_category_id);
CREATE INDEX IF NOT EXISTS idx_products_code_lower ON products(LOWER(code));

UPDATE products p SET category_id = c.id
FROM categories c WHERE p.category_id IS NULL AND c.name = p.category;
UPDATE products p SET sub_category_id = s.id
FROM sub_categories s WHERE p.sub_category_id IS NULL AND s.name = p.sub_category
  AND s.category_id = p.category_id;

INSERT INTO platform_delivery_rates(speed, same_province, other_province)
VALUES ('normal', 0, 0), ('urgent', 0, 0), ('very_urgent', 0, 0)
ON CONFLICT (speed) DO NOTHING;

INSERT INTO universities(name, province_id, order_index)
SELECT seed.name, p.id, seed.order_index
FROM (VALUES
  ('جامعة دمشق', 'دمشق', 1), ('الجامعة السورية الخاصة', 'ريف دمشق', 2),
  ('جامعة القلمون الخاصة', 'ريف دمشق', 3), ('جامعة حلب', 'حلب', 4),
  ('جامعة تشرين', 'اللاذقية', 5), ('جامعة طرطوس', 'طرطوس', 6),
  ('جامعة البعث', 'حمص', 7), ('جامعة حماة', 'حماة', 8),
  ('جامعة إدلب', 'إدلب', 9), ('جامعة الفرات', 'دير الزور', 10)
) AS seed(name, province_name, order_index)
LEFT JOIN provinces p ON p.name = seed.province_name
ON CONFLICT (name, province_id) DO NOTHING;

INSERT INTO permissions(key, name_ar, description, module) VALUES
  ('catalog.view', 'عرض الكتالوج', 'عرض التصنيفات والجامعات وإعدادات الكتالوج.', 'catalog'),
  ('catalog.manage', 'إدارة الكتالوج', 'إضافة وتعديل وتعطيل وترتيب التصنيفات والجامعات.', 'catalog'),
  ('delivery.platform.manage', 'إدارة توصيل المنصة', 'إدارة تعرفة توصيل TopDent الاحتياطية.', 'delivery')
ON CONFLICT (key) DO NOTHING;

INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.key IN ('platform_owner', 'legacy_platform_operator')
  AND p.key IN ('catalog.view', 'catalog.manage', 'delivery.platform.manage')
ON CONFLICT DO NOTHING;
