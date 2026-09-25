-- TopDent DEMO SEED DATA
-- Run only after migrations.sql and server/src/db/migrations/001_platform_workflows.sql.
-- Safe to re-run: all demo rows use fixed IDs or demo-* unique keys and ON CONFLICT updates.
-- Demo password for every account: Demo1234!
-- WARNING: this is fake data for staging/demo only. Do not run it on production.

BEGIN;

-- -----------------------------------------------------------------------------
-- Demo users: customer, merchant, manager, driver, administrator.
-- -----------------------------------------------------------------------------
INSERT INTO users (id, email, password, full_name, phone, whatsapp, province, area, address, university_clinic, role, is_active, terms_accepted_at, privacy_accepted_at, password_changed_at)
VALUES
('00000000-0000-4000-8000-000000000001', 'demo.customer@topdent.local', '$2b$10$kGo7S8h3/06eNVnZtIi8O..viAt7eXD3zOMtECJOLJpN.m7FyuwLO', 'د. أحمد Demo', '+963900000001', '+963900000001', 'دمشق', 'المزة', 'شارع الجلاء - بناء تجريبي 1', 'جامعة دمشق', 'customer', true, NOW(), NOW(), NOW()),
('00000000-0000-4000-8000-000000000002', 'demo.merchant@topdent.local', '$2b$10$kGo7S8h3/06eNVnZtIi8O..viAt7eXD3zOMtECJOLJpN.m7FyuwLO', 'مؤسسة النخبة Demo', '+963900000002', '+963900000002', 'دمشق', 'أبو رمانة', 'شارع رئيسي - معرض تجريبي', NULL, 'merchant', true, NOW(), NOW(), NOW()),
('00000000-0000-4000-8000-000000000003', 'demo.merchant2@topdent.local', '$2b$10$kGo7S8h3/06eNVnZtIi8O..viAt7eXD3zOMtECJOLJpN.m7FyuwLO', 'شركة ابتسامة Demo', '+963900000003', '+963900000003', 'حلب', 'الجميلية', 'شارع النيل - معرض تجريبي', NULL, 'merchant', true, NOW(), NOW(), NOW()),
('00000000-0000-4000-8000-000000000004', 'demo.manager@topdent.local', '$2b$10$kGo7S8h3/06eNVnZtIi8O..viAt7eXD3zOMtECJOLJpN.m7FyuwLO', 'مدير العمليات Demo', '+963900000004', '+963900000004', 'دمشق', 'البرامكة', 'مكتب العمليات التجريبي', NULL, 'manager', true, NOW(), NOW(), NOW()),
('00000000-0000-4000-8000-000000000005', 'demo.driver@topdent.local', '$2b$10$kGo7S8h3/06eNVnZtIi8O..viAt7eXD3zOMtECJOLJpN.m7FyuwLO', 'سائق التوصيل Demo', '+963900000005', '+963900000005', 'دمشق', 'كفرسوسة', 'نقطة السائق التجريبية', NULL, 'driver', true, NOW(), NOW(), NOW()),
('00000000-0000-4000-8000-000000000006', 'demo.admin@topdent.local', '$2b$10$kGo7S8h3/06eNVnZtIi8O..viAt7eXD3zOMtECJOLJpN.m7FyuwLO', 'مدير TopDent Demo', '+963900000006', '+963900000006', 'دمشق', 'المالكي', 'مكتب الإدارة التجريبي', NULL, 'admin', true, NOW(), NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name, phone = EXCLUDED.phone, whatsapp = EXCLUDED.whatsapp,
  province = EXCLUDED.province, area = EXCLUDED.area, address = EXCLUDED.address,
  role = EXCLUDED.role, is_active = true, password = EXCLUDED.password, updated_at = NOW();

INSERT INTO merchants (id, user_id, company_name, logo_url, description, phone, whatsapp, province, area, contact_email, dollar_rate, is_active, is_approved, approval_status, approved_at, website_url, contact_details)
VALUES
('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'مؤسسة النخبة للتجهيزات السنية', 'https://images.unsplash.com/photo-1588776814546-daab30f310ce?w=600', 'مورد تجريبي للأدوات والمواد السنية والأجهزة التعليمية.', '+963900000002', '+963900000002', 'دمشق', 'أبو رمانة', 'demo.merchant@topdent.local', 15000, true, true, 'approved', NOW(), 'https://example.com/elite-demo', '{"hours":"09:00-18:00","contact_person":"فريق النخبة"}'),
('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003', 'شركة ابتسامة للأجهزة الطبية', 'https://images.unsplash.com/photo-1609840114035-3c981b782dfe?w=600', 'شركة تجريبية متخصصة بالأجهزة والقبضات ومواد العيادات.', '+963900000003', '+963900000003', 'حلب', 'الجميلية', 'demo.merchant2@topdent.local', 15250, true, true, 'approved', NOW(), 'https://example.com/smile-demo', '{"hours":"10:00-17:00","contact_person":"قسم المبيعات"}')
ON CONFLICT (id) DO UPDATE SET
  company_name = EXCLUDED.company_name, logo_url = EXCLUDED.logo_url, description = EXCLUDED.description,
  province = EXCLUDED.province, area = EXCLUDED.area, dollar_rate = EXCLUDED.dollar_rate,
  is_active = true, is_approved = true, approval_status = 'approved', approved_at = COALESCE(merchants.approved_at, NOW()),
  website_url = EXCLUDED.website_url, contact_details = EXCLUDED.contact_details, updated_at = NOW();

INSERT INTO driver_profiles (id, user_id, vehicle_info, is_available)
VALUES ('20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000005', '{"type":"motorcycle","plate":"DEMO-001","color":"أبيض"}', true)
ON CONFLICT (id) DO UPDATE SET is_available = true, vehicle_info = EXCLUDED.vehicle_info, updated_at = NOW();

-- -----------------------------------------------------------------------------
-- Catalog and provinces.
-- -----------------------------------------------------------------------------
INSERT INTO provinces (name, is_active)
VALUES ('دمشق', true), ('ريف دمشق', true), ('حلب', true), ('حمص', true), ('حماة', true), ('اللاذقية', true), ('طرطوس', true), ('درعا', true), ('السويداء', true)
ON CONFLICT (name) DO UPDATE SET is_active = true;

INSERT INTO categories (name, description, order_index, is_active)
VALUES
('أدوات', 'أدوات طب الأسنان اليدوية', 1, true),
('أجهزة', 'أجهزة وتجهيزات العيادات', 2, true),
('مواد', 'مواد الاستهلاك والحشوات', 3, true),
('طلاب', 'مستلزمات التدريب الجامعي', 4, true),
('وقاية', 'معدات الوقاية والألبسة الطبية', 5, true)
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description, order_index = EXCLUDED.order_index, is_active = true;

INSERT INTO sub_categories (category_id, name, is_active)
SELECT c.id, s.name, true
FROM (VALUES
  ('أدوات', 'أدوات فحص'), ('أدوات', 'أدوات قلع'), ('أجهزة', 'أجهزة تصليب'),
  ('أجهزة', 'أجهزة تعقيم'), ('مواد', 'حشوات وكومبوزيت'), ('طلاب', 'مواد تدريب'),
  ('وقاية', 'كمامات وملابس')
) AS s(category_name, name)
JOIN categories c ON c.name = s.category_name
ON CONFLICT (category_id, name) DO UPDATE SET is_active = true;

-- -----------------------------------------------------------------------------
-- Products: new, used, USD-priced, and rental-eligible.
-- -----------------------------------------------------------------------------
INSERT INTO products (id, merchant_id, name, code, category, sub_category, description, specifications, condition, price, original_price, price_syp, dollar_rate_snapshot, currency, stock_quantity, is_active, is_approved, status, expiration_date, manufacturer, country_of_origin, warranty_details, warranty_months, accessories, maintenance_details, delivery_same_province, shipping_other_province, seller_province, seller_area, seller_university, usage_duration_months, defects, seller_declaration, platform_fee_accepted, metadata)
VALUES
('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'مرآة فموية ومسبار فحص Premium', 'DEMO-EXAM-001', 'أدوات', 'أدوات فحص', 'طقم فحص عملي من الستانلس ستيل مناسب للطلاب والعيادات.', 'مرآة، مسبار، ملقط قطني، مقبض مريح.', 'new', 125000, 125000, 125000, 15000, 'SYP', 25, true, true, 'approved', NULL, 'TopDent Instruments', 'الصين', 'كفالة استبدال 6 أشهر', 6, 'علبة تعقيم', 'تعقيم بالبخار بعد كل استخدام', true, true, 'دمشق', 'أبو رمانة', NULL, NULL, NULL, false, false, '{"featured":true,"badge":"الأكثر مبيعاً"}'),
('40000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'كومبوزيت ضوئي Nano Shade', 'DEMO-FILL-002', 'مواد', 'حشوات وكومبوزيت', 'كومبوزيت ترميمي تجريبي بدرجات متعددة للاستخدام اليومي.', 'حقنة 4 غرام، درجات A1 وA2 وA3.', 'new', 18.50, 18.50, 277500, 15000, 'USD', 40, true, true, 'approved', CURRENT_DATE + 700, 'DentalPro', 'ألمانيا', 'صلاحية حتى التاريخ المطبوع', 0, 'مفتاح ألوان', 'يحفظ بين 2 و25 درجة', true, true, 'دمشق', 'أبو رمانة', NULL, NULL, NULL, false, false, '{"featured":true,"badge":"عرض"}'),
('40000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'مصباح تصليب LED لاسلكي', 'DEMO-CURE-003', 'أجهزة', 'أجهزة تصليب', 'مصباح تصليب محمول بثلاثة برامج وشحن USB.', 'شدة 2200 mW/cm2، مؤقت 5 و10 و20 ثانية.', 'new', 2400000, 2400000, 2400000, 15000, 'SYP', 8, true, true, 'approved', NULL, 'BrightDent', 'الصين', 'ضمان سنة كاملة', 12, 'قاعدة شحن، رأس حماية، كابل USB-C', 'فحص البطارية كل شهر', true, true, 'دمشق', 'أبو رمانة', NULL, NULL, NULL, false, false, '{"featured":true}'),
('40000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', 'جهاز تعقيم حراري صغير', 'DEMO-STER-004', 'أجهزة', 'أجهزة تعقيم', 'جهاز تعقيم تجريبي مناسب للعيادات الصغيرة والتعليم العملي.', 'حجرة 8 ليتر، شاشة رقمية، برنامج 121 درجة.', 'new', 4800000, 4800000, 4800000, 15250, 'SYP', 4, true, true, 'approved', NULL, 'SmileTech', 'إيطاليا', 'ضمان سنتين مع صيانة أولية', 24, 'صينية، حامل أدوات', 'صيانة سنوية', true, true, 'حلب', 'الجميلية', NULL, NULL, NULL, false, false, '{"rental":true,"featured":true}'),
('40000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000002', 'قبضة توربين مستعملة بحالة ممتازة', 'DEMO-USED-005', 'أدوات', 'أدوات فحص', 'قبضة توربين مستعملة موصوفة بوضوح ومفحوصة قبل العرض.', 'رشاش رباعي، اتصال قياسي، صوت تشغيل منخفض.', 'used', 950000, 1100000, 950000, 15000, 'SYP', 1, true, true, 'approved', NULL, 'KaVo', 'ألمانيا', 'تجربة 7 أيام من تاريخ الاستلام', 0, 'علبة أصلية، مفتاح رأس', 'تم تبديل الرولمان وتنظيف الجهاز', true, true, 'دمشق', 'المزة', 'جامعة دمشق', 18, 'خدوش سطحية على المقبض فقط', true, true, '{"used":true,"condition_note":"مفحوص"}'),
('40000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000002', 'طقم تدريب طلابي للمخبر', 'DEMO-STUDENT-006', 'طلاب', 'مواد تدريب', 'حزمة تجريبية للطلاب تشمل أدوات أساسية ومستهلكات تدريب.', 'مقبض، ملاقط، شمع، أسنان تدريب، كتل جبس.', 'new', 325000, 350000, 325000, 15000, 'SYP', 30, true, true, 'approved', NULL, 'StudentDent', 'سوريا', 'استبدال القطع الناقصة خلال 14 يوماً', 0, 'حقيبة حفظ', 'لا يحتاج لصيانة', true, false, 'حلب', 'الجميلية', NULL, NULL, NULL, false, false, '{"student":true,"featured":true}')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, price = EXCLUDED.price, original_price = EXCLUDED.original_price, price_syp = EXCLUDED.price_syp,
  stock_quantity = EXCLUDED.stock_quantity, is_active = true, is_approved = true, status = 'approved',
  description = EXCLUDED.description, metadata = EXCLUDED.metadata, updated_at = NOW();

INSERT INTO product_images (id, product_id, image_url, is_primary, storage_path, content_type, created_by)
VALUES
('41000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'https://images.unsplash.com/photo-1606811971618-4486d14f3f99?w=900', true, NULL, 'image/jpeg', '00000000-0000-4000-8000-000000000002'),
('41000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002', 'https://images.unsplash.com/photo-1609840114035-3c981b782dfe?w=900', true, NULL, 'image/jpeg', '00000000-0000-4000-8000-000000000002'),
('41000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000003', 'https://images.unsplash.com/photo-1588776814546-daab30f310ce?w=900', true, NULL, 'image/jpeg', '00000000-0000-4000-8000-000000000002'),
('41000000-0000-4000-8000-000000000004', '40000000-0000-4000-8000-000000000004', 'https://images.unsplash.com/photo-1588776814546-daab30f310ce?w=900', true, NULL, 'image/jpeg', '00000000-0000-4000-8000-000000000003'),
('41000000-0000-4000-8000-000000000005', '40000000-0000-4000-8000-000000000005', 'https://images.unsplash.com/photo-1588776814546-daab30f310ce?w=900', true, NULL, 'image/jpeg', '00000000-0000-4000-8000-000000000003'),
('41000000-0000-4000-8000-000000000006', '40000000-0000-4000-8000-000000000006', 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=900', true, NULL, 'image/jpeg', '00000000-0000-4000-8000-000000000003')
ON CONFLICT (id) DO UPDATE SET image_url = EXCLUDED.image_url, is_primary = true;

-- -----------------------------------------------------------------------------
-- Merchant delivery rates, settings, banners, offers, discount.
-- -----------------------------------------------------------------------------
INSERT INTO delivery_rates (id, merchant_id, speed, same_province, other_province)
VALUES
('42000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'normal', 15000, 30000),
('42000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'urgent', 25000, 45000),
('42000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'very_urgent', 40000, 70000),
('42000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', 'normal', 18000, 35000),
('42000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000002', 'urgent', 30000, 50000),
('42000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000002', 'very_urgent', 45000, 80000)
ON CONFLICT (id) DO UPDATE SET same_province = EXCLUDED.same_province, other_province = EXCLUDED.other_province, updated_at = NOW();

INSERT INTO settings (id, key, value)
VALUES
('43000000-0000-4000-8000-000000000001', 'about_text', 'TopDent منصة تجريبية متخصصة بأدوات ومنتجات طب الأسنان.'),
('43000000-0000-4000-8000-000000000002', 'contact_phone', '+963900000099'),
('43000000-0000-4000-8000-000000000003', 'contact_whatsapp', '+963900000099'),
('43000000-0000-4000-8000-000000000004', 'facebook_url', 'https://facebook.com/topdent.demo'),
('43000000-0000-4000-8000-000000000005', 'instagram_url', 'https://instagram.com/topdent.demo'),
('43000000-0000-4000-8000-000000000006', 'dollar_rate', '15000')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

INSERT INTO banners (id, title, image_url, link_url, order_index, is_active)
VALUES
('44000000-0000-4000-8000-000000000001', 'كل ما تحتاجه لعيادتك', 'https://images.unsplash.com/photo-1588776814546-daab30f310ce?w=1600', '/products', 1, true),
('44000000-0000-4000-8000-000000000002', 'خصم الطلاب التجريبي', 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=1600', '/offers/45000000-0000-4000-8000-000000000001', 2, true),
('44000000-0000-4000-8000-000000000003', 'أدوات مستعملة موصوفة بوضوح', 'https://images.unsplash.com/photo-1606811971618-4486d14f3f99?w=1600', '/products?condition=used', 3, true)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, image_url = EXCLUDED.image_url, link_url = EXCLUDED.link_url, order_index = EXCLUDED.order_index, is_active = true, updated_at = NOW();

INSERT INTO offers (id, title, description, image_url, merchant_id, starts_at, ends_at, order_index, is_active, created_by)
VALUES
('45000000-0000-4000-8000-000000000001', 'باقة الطالب الذكية', 'خصم تجريبي على مجموعة من مستلزمات التدريب والمواد الأساسية للطلاب.', 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=1200', '10000000-0000-4000-8000-000000000001', NOW() - INTERVAL '1 day', NOW() + INTERVAL '90 days', 1, true, '00000000-0000-4000-8000-000000000006'),
('45000000-0000-4000-8000-000000000002', 'أجهزة العيادة الجديدة', 'تشكيلة تجريبية من الأجهزة مع توصيل مستعجل داخل المحافظة.', 'https://images.unsplash.com/photo-1588776814546-daab30f310ce?w=1200', '10000000-0000-4000-8000-000000000002', NOW() - INTERVAL '1 day', NOW() + INTERVAL '60 days', 2, true, '00000000-0000-4000-8000-000000000006')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description, image_url = EXCLUDED.image_url, ends_at = EXCLUDED.ends_at, is_active = true;

INSERT INTO offer_products (offer_id, product_id)
VALUES
('45000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000006'),
('45000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002'),
('45000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000003'),
('45000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000004')
ON CONFLICT DO NOTHING;

INSERT INTO discount_codes (id, code, discount_percentage, discount_amount, max_uses, current_uses, expires_at, is_active, starts_at, min_order_amount, max_user_uses, merchant_id, created_by)
VALUES
('46000000-0000-4000-8000-000000000001', 'DEMO10', 10, NULL, 100, 0, NOW() + INTERVAL '90 days', true, NOW() - INTERVAL '1 day', 100000, 2, NULL, '00000000-0000-4000-8000-000000000006'),
('46000000-0000-4000-8000-000000000002', 'STUDENT15', 15, NULL, 50, 0, NOW() + INTERVAL '90 days', true, NOW() - INTERVAL '1 day', 100000, 1, '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000006')
ON CONFLICT (id) DO UPDATE SET discount_percentage = EXCLUDED.discount_percentage, expires_at = EXCLUDED.expires_at, is_active = true, current_uses = 0;

-- -----------------------------------------------------------------------------
-- Rentals and service requests.
-- -----------------------------------------------------------------------------
INSERT INTO rentals (id, product_id, daily_price, weekly_price, deposit_amount, return_terms, late_fee_per_day, is_active)
VALUES
('47000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000004', 125000, 650000, 1000000, 'يعاد الجهاز نظيفاً وبحالته التشغيلية خلال 24 ساعة من انتهاء المدة. يتحمل المستأجر كلفة الضرر المثبت.', 50000, true),
('47000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000003', 75000, 350000, 500000, 'تسليم الجهاز مع قاعدة الشحن والملحقات كاملة.', 25000, true)
ON CONFLICT (id) DO UPDATE SET daily_price = EXCLUDED.daily_price, weekly_price = EXCLUDED.weekly_price, deposit_amount = EXCLUDED.deposit_amount, return_terms = EXCLUDED.return_terms, late_fee_per_day = EXCLUDED.late_fee_per_day, is_active = true;

INSERT INTO rental_requests (id, rental_id, user_id, starts_on, ends_on, calculated_price, deposit_snapshot, status, customer_snapshot, manager_note)
VALUES
('48000000-0000-4000-8000-000000000001', '47000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', CURRENT_DATE + 5, CURRENT_DATE + 8, 225000, 500000, 'approved', '{"fullName":"د. أحمد Demo","phone":"+963900000001","province":"دمشق","address":"شارع الجلاء - بناء تجريبي 1"}', 'طلب تجريبي تمت الموافقة عليه'),
('48000000-0000-4000-8000-000000000002', '47000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', CURRENT_DATE + 15, CURRENT_DATE + 18, 375000, 1000000, 'new', '{"fullName":"د. أحمد Demo","phone":"+963900000001","province":"دمشق","address":"شارع الجلاء - بناء تجريبي 1"}', NULL)
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, calculated_price = EXCLUDED.calculated_price, manager_note = EXCLUDED.manager_note, updated_at = NOW();

INSERT INTO dental_card_requests (id, user_id, doctor_name, specialty, phone, address, email, logo_url, colors, requested_text, requested_template, attachments, quoted_price, execution_days, included_revisions, status, admin_note)
VALUES
('49000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'د. أحمد Demo', 'طب أسنان تجميلي', '+963900000001', 'دمشق - المزة', 'demo.customer@topdent.local', 'https://images.unsplash.com/photo-1588776814546-daab30f310ce?w=600', 'أزرق وذهبي', 'د. أحمد Demo - طبيب أسنان تجميلي', 'كلاسيكي طبي', '[]', 175000, 5, 2, 'quoted', 'سعر تجريبي شامل تصميمين ومراجعتين')
ON CONFLICT (id) DO UPDATE SET quoted_price = EXCLUDED.quoted_price, status = EXCLUDED.status, admin_note = EXCLUDED.admin_note, updated_at = NOW();

-- -----------------------------------------------------------------------------
-- Demo multi-merchant orders, cart, favorites, notifications, audit.
-- -----------------------------------------------------------------------------
INSERT INTO orders (id, order_number, user_id, merchant_id, parent_order_id, order_type, status, payment_status, subtotal, discount_amount, delivery_cost, total, currency, delivery_speed, delivery_time_slot, customer_name, customer_phone, customer_whatsapp, province, address, notes, discount_code, delivery_rate_snapshot, price_snapshot, payment_method, version)
VALUES
('50000000-0000-4000-8000-000000000001', 'DEMO-ORDER-0001', '00000000-0000-4000-8000-000000000001', NULL, NULL, 'parent', 'in_delivery', 'pending', 3175000, 317500, 53000, 2910500, 'SYP', 'urgent', NULL, 'د. أحمد Demo', '+963900000001', '+963900000001', 'دمشق', 'شارع الجلاء - بناء تجريبي 1', 'يرجى الاتصال قبل الوصول', 'DEMO10', '{"speed":"urgent","merchants":{"10000000-0000-4000-8000-000000000001":{"sameProvince":25000},"10000000-0000-4000-8000-000000000002":{"sameProvince":30000}}}', '{"dollarRate":15000,"currency":"SYP","demo":true}', 'cash_on_delivery', 4),
('50000000-0000-4000-8000-000000000002', 'DEMO-ORDER-0001-M1', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 'merchant', 'in_delivery', 'pending', 2900000, 290000, 25000, 2635000, 'SYP', 'urgent', NULL, 'د. أحمد Demo', '+963900000001', '+963900000001', 'دمشق', 'شارع الجلاء - بناء تجريبي 1', 'طلب تجريبي من مؤسسة النخبة', 'DEMO10', '{"sameProvince":25000,"otherProvince":45000}', '{"items":[{"product":"DEMO-EXAM-001","unit":125000},{"product":"DEMO-CURE-003","unit":2400000}],"dollarRate":15000}', 'cash_on_delivery', 4),
('50000000-0000-4000-8000-000000000003', 'DEMO-ORDER-0001-M2', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000001', 'merchant', 'assigned_to_driver', 'pending', 275000, 27500, 28000, 275500, 'SYP', 'urgent', NULL, 'د. أحمد Demo', '+963900000001', '+963900000001', 'دمشق', 'شارع الجلاء - بناء تجريبي 1', 'طلب تجريبي من شركة ابتسامة', 'DEMO10', '{"sameProvince":30000,"otherProvince":50000}', '{"items":[{"product":"DEMO-FILL-002","unit":18.5,"priceSyp":277500}],"dollarRate":15000}', 'cash_on_delivery', 4),
('50000000-0000-4000-8000-000000000004', 'DEMO-ORDER-0002', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', NULL, 'merchant', 'pending_review', 'pending', 325000, 0, 15000, 340000, 'SYP', 'normal', NULL, 'د. أحمد Demo', '+963900000001', '+963900000001', 'دمشق', 'شارع الجلاء - بناء تجريبي 1', 'طلب جديد تجريبي بانتظار المراجعة', NULL, '{"sameProvince":15000,"otherProvince":30000}', '{"items":[{"product":"DEMO-STUDENT-006","unit":325000}],"dollarRate":15000}', 'cash_on_delivery', 1)
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, payment_status = EXCLUDED.payment_status, total = EXCLUDED.total, updated_at = NOW();

INSERT INTO order_items (id, order_id, product_id, product_code, product_name, quantity, price, currency, price_syp, original_price, dollar_rate_snapshot, product_snapshot)
VALUES
('51000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000001', 'DEMO-EXAM-001', 'مرآة فموية ومسبار فحص Premium', 4, 125000, 'SYP', 125000, 125000, 15000, '{"name":"مرآة فموية ومسبار فحص Premium","condition":"new"}'),
('51000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000003', 'DEMO-CURE-003', 'مصباح تصليب LED لاسلكي', 1, 2400000, 'SYP', 2400000, 2400000, 15000, '{"name":"مصباح تصليب LED لاسلكي","condition":"new"}'),
('51000000-0000-4000-8000-000000000003', '50000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000002', 'DEMO-FILL-002', 'كومبوزيت ضوئي Nano Shade', 1, 18.5, 'USD', 277500, 18.5, 15000, '{"name":"كومبوزيت ضوئي Nano Shade","condition":"new"}'),
('51000000-0000-4000-8000-000000000004', '50000000-0000-4000-8000-000000000004', '40000000-0000-4000-8000-000000000006', 'DEMO-STUDENT-006', 'طقم تدريب طلابي للمخبر', 1, 325000, 'SYP', 325000, 350000, 15000, '{"name":"طقم تدريب طلابي للمخبر","condition":"new"}')
ON CONFLICT (id) DO UPDATE SET quantity = EXCLUDED.quantity, price = EXCLUDED.price, product_snapshot = EXCLUDED.product_snapshot;

INSERT INTO driver_assignments (id, order_id, driver_id, assigned_by, accepted_at, notes, active)
VALUES ('52000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000004', NOW() - INTERVAL '2 hours', 'تعيين تجريبي للسائق', true)
ON CONFLICT (id) DO UPDATE SET accepted_at = EXCLUDED.accepted_at, active = true, notes = EXCLUDED.notes;

INSERT INTO order_status_history (id, order_id, from_status, to_status, changed_by, reason)
VALUES
('53000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000002', 'preparing', 'assigned_to_driver', '00000000-0000-4000-8000-000000000004', 'تعيين سائق تجريبي'),
('53000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000001', 'arrived', 'in_delivery', '00000000-0000-4000-8000-000000000004', 'تحديث تجريبي لمسار الطلب'),
('53000000-0000-4000-8000-000000000003', '50000000-0000-4000-8000-000000000004', NULL, 'pending_review', '00000000-0000-4000-8000-000000000001', 'إنشاء طلب تجريبي')
ON CONFLICT (id) DO NOTHING;

INSERT INTO favorites (id, user_id, product_id)
VALUES
('54000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000003'),
('54000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000005')
ON CONFLICT (id) DO NOTHING;

INSERT INTO cart_items (id, user_id, product_id, quantity)
VALUES
('55000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000006', 2),
('55000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000005', 1)
ON CONFLICT (id) DO UPDATE SET quantity = EXCLUDED.quantity;

INSERT INTO notifications (id, user_id, type, title, message, related_order_id, is_read)
VALUES
('56000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'order_status', 'تم تعيين سائق لطلبك', 'تم تعيين سائق تجريبي لطلب DEMO-ORDER-0001. يمكنك متابعة الحالة من لوحة التحكم.', '50000000-0000-4000-8000-000000000001', false),
('56000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'offer', 'عرض جديد متاح', 'استخدم الرمز DEMO10 للحصول على خصم تجريبي.', NULL, false),
('56000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000002', 'merchant_approval', 'تم اعتماد الشركة', 'تم اعتماد مؤسسة النخبة التجريبية ويمكنها استقبال الطلبات.', NULL, true)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, message = EXCLUDED.message, is_read = EXCLUDED.is_read;

INSERT INTO activity_log (id, user_id, action, entity_type, entity_id, details)
VALUES
('57000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000006', 'demo_seed_created', 'system', 'demo', '{"source":"server/src/db/demo_seed.sql"}'),
('57000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'demo_order_created', 'order', 'DEMO-ORDER-0001', '{"demo":true}'),
('57000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000004', 'demo_driver_assigned', 'order', 'DEMO-ORDER-0001-M2', '{"demo":true}')
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- Quick verification after the seed:
SELECT 'users' AS entity, COUNT(*) AS demo_count FROM users WHERE email LIKE 'demo.%@topdent.local'
UNION ALL SELECT 'merchants', COUNT(*) FROM merchants WHERE id IN ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002')
UNION ALL SELECT 'products', COUNT(*) FROM products WHERE code LIKE 'DEMO-%'
UNION ALL SELECT 'banners', COUNT(*) FROM banners WHERE id::text LIKE '44%'
UNION ALL SELECT 'offers', COUNT(*) FROM offers WHERE id::text LIKE '45%'
UNION ALL SELECT 'orders', COUNT(*) FROM orders WHERE order_number LIKE 'DEMO-%';
