import pg from 'pg';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import '../config/env.js';

const { Client } = pg;
const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const password = 'TopDentDemo@2026!';
const passwordHash = await bcrypt.hash(password, 12);
const now = new Date().toISOString();
const uid = () => crypto.randomUUID();
const q = (text, params = []) => c.query(text, params);

async function user(email, fullName, role, extra = {}) {
  const result = await q(`
    INSERT INTO users (email, password, full_name, phone, whatsapp, province, address, university_clinic, role, is_active, account_status, terms_accepted_at, privacy_accepted_at, password_changed_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'active',$11,$11,$11)
    ON CONFLICT (email) DO UPDATE SET full_name=EXCLUDED.full_name, password=EXCLUDED.password, role=EXCLUDED.role, is_active=true, account_status='active', updated_at=NOW()
    RETURNING id`, [email, passwordHash, fullName, extra.phone || null, extra.whatsapp || null, extra.province || null, extra.address || null, extra.university || null, role, true, now]);
  return result.rows[0].id;
}
async function roleId(key) { return (await q('SELECT id FROM roles WHERE key=$1', [key])).rows[0].id; }
async function assign(userId, roleKey, companyId = null) {
  const role = await roleId(roleKey);
  await q(`INSERT INTO user_role_assignments (user_id, role_id, company_id, scope_type, is_active) VALUES ($1,$2,$3,$4,true) ON CONFLICT DO NOTHING`, [userId, role, companyId, companyId ? 'company' : 'global']);
}
async function merchant(managerUserId, name, email, province, phone, personal = false) {
  const result = await q(`
    INSERT INTO merchants (user_id, company_name, description, phone, whatsapp, province, area, contact_email, dollar_rate, is_active, is_approved, approval_status, approved_at, website_url, contact_details, is_personal_seller, delivery_enabled)
    VALUES ($1,$2,$3,$4,$4,$5,'المزة',$6,15000,true,true,'approved',$7,$8,'{}',$9,true)
    ON CONFLICT (user_id) DO UPDATE SET company_name=EXCLUDED.company_name, description=EXCLUDED.description, phone=EXCLUDED.phone, whatsapp=EXCLUDED.whatsapp, province=EXCLUDED.province, area=EXCLUDED.area, contact_email=EXCLUDED.contact_email, dollar_rate=EXCLUDED.dollar_rate, is_active=true, is_approved=true, approval_status='approved', approved_at=EXCLUDED.approved_at, website_url=EXCLUDED.website_url, is_personal_seller=EXCLUDED.is_personal_seller, delivery_enabled=true, updated_at=NOW()
    RETURNING id`, [managerUserId, name, `شركة تجريبية ${name} لمتجر TopDent، تحتوي على منتجات ومخزون وأسعار جاهزة للتجربة.`, phone, province, email, now, 'https://topdent.example.com', personal]);
  return result.rows[0].id;
}
async function rate(merchantId, speed, same, other) {
  await q(`INSERT INTO delivery_rates (merchant_id, speed, same_province, other_province) VALUES ($1,$2,$3,$4) ON CONFLICT (merchant_id,speed) DO UPDATE SET same_province=EXCLUDED.same_province, other_province=EXCLUDED.other_province, updated_at=NOW()`, [merchantId, speed, same, other]);
}

await c.connect();
await q('BEGIN');
try {
  // Remove only records owned by this demo seed so reruns stay clean and safe.
  await q(`DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE invoice_number='DEMO-INV-0001')`);
  await q(`DELETE FROM invoices WHERE invoice_number='DEMO-INV-0001'`);
  await q(`DELETE FROM order_status_history WHERE order_id IN (SELECT id FROM orders WHERE order_number='DEMO-ORDER-0001')`);
  await q(`DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE order_number='DEMO-ORDER-0001')`);
  await q(`DELETE FROM orders WHERE order_number='DEMO-ORDER-0001'`);
  await q(`DELETE FROM dental_card_requests WHERE email='demo.customer@topdent.test'`);
  await q(`DELETE FROM rentals WHERE product_id IN (SELECT id FROM products WHERE code='TOP-DRL-001')`);
  await q(`DELETE FROM offer_products WHERE offer_id IN (SELECT id FROM offers WHERE title='خصم افتتاح متجر TopDent')`);
  await q(`DELETE FROM offers WHERE title='خصم افتتاح متجر TopDent'`);
  await q(`DELETE FROM banners WHERE title IN ('عروض تجهيز العيادات','مستلزمات الطلاب والجامعات')`);

  const owner = await user('demo.owner@topdent.test', 'المدير العام التجريبي', 'admin', { phone: '0999000001', province: 'دمشق', address: 'مكتب TopDent الرئيسي' });
  const platformAdmin = await user('demo.admin@topdent.test', 'الأدمن العام التجريبي', 'admin', { phone: '0999000002', province: 'دمشق' });
  const alphaManager = await user('demo.alpha.manager@topdent.test', 'مدير شركة الشام التجريبي', 'manager', { phone: '0999000003', province: 'دمشق' });
  const alphaAdmin = await user('demo.alpha.admin@topdent.test', 'أدمن شركة الشام التجريبي', 'manager', { phone: '0999000004', province: 'دمشق' });
  const betaManager = await user('demo.beta.manager@topdent.test', 'مدير شركة حلب التجريبي', 'manager', { phone: '0999000005', province: 'حلب' });
  const platformDriverUser = await user('demo.platform.driver@topdent.test', 'سائق TopDent التجريبي', 'driver', { phone: '0999000006', province: 'دمشق' });
  const buyer = await user('demo.customer@topdent.test', 'العميل التجريبي أحمد', 'customer', { phone: '0999000007', whatsapp: '0999000007', province: 'دمشق', address: 'المزة - شارع الجلاء', university: 'جامعة دمشق' });
  const guestBuyer = await user('demo.student@topdent.test', 'الطالبة التجريبية سارة', 'customer', { phone: '0999000008', province: 'حلب', address: 'حلب - الفرقان', university: 'جامعة حلب' });

  const alpha = await merchant(alphaManager, 'شركة الشام للتجهيزات السنية', 'demo.alpha@topdent.test', 'دمشق', '0111111111');
  const beta = await merchant(betaManager, 'مركز حلب الطبي للتجهيزات', 'demo.beta@topdent.test', 'حلب', '0212222222');
  await assign(owner, 'platform_owner');
  await assign(platformAdmin, 'platform_admin');
  await assign(platformAdmin, 'legacy_platform_operator');
  await assign(alphaManager, 'company_manager', alpha);
  await assign(alphaAdmin, 'company_admin', alpha);
  await assign(betaManager, 'company_manager', beta);
  await assign(platformDriverUser, 'platform_driver');

  // Give demo platform admin and company admin useful dashboard access without changing owner protection.
  await q(`INSERT INTO role_permissions(role_id, permission_id) SELECT $1, id FROM permissions ON CONFLICT DO NOTHING`, [await roleId('platform_admin')]);
  await q(`INSERT INTO role_permissions(role_id, permission_id) SELECT $1, permission_id FROM role_permissions WHERE role_id=$2 ON CONFLICT DO NOTHING`, [await roleId('company_admin'), await roleId('company_manager')]);

  const driverProfile = await q(`INSERT INTO driver_profiles (user_id, vehicle_info, is_available, driver_type, company_id, plate_number, is_active) VALUES ($1,$2,true,'platform',NULL,'TOP-001',true) ON CONFLICT (user_id) DO UPDATE SET is_available=true,is_active=true,vehicle_info=EXCLUDED.vehicle_info,plate_number=EXCLUDED.plate_number RETURNING id`, [platformDriverUser, JSON.stringify({ vehicle: 'سيارة توصيل TopDent', color: 'أبيض' })]);
  const companyDriverUser = await user('demo.company.driver@topdent.test', 'سائق شركة الشام التجريبي', 'driver', { phone: '0999000009', province: 'دمشق' });
  const companyDriver = await q(`INSERT INTO driver_profiles (user_id, vehicle_info, is_available, driver_type, company_id, plate_number, is_active) VALUES ($1,$2,true,'company',$3,'SHAM-007',true) ON CONFLICT (user_id) DO UPDATE SET company_id=EXCLUDED.company_id,is_available=true,is_active=true,vehicle_info=EXCLUDED.vehicle_info,plate_number=EXCLUDED.plate_number RETURNING id`, [companyDriverUser, JSON.stringify({ vehicle: 'فان شركة الشام', color: 'أزرق' }), alpha]);
  await assign(companyDriverUser, 'company_driver', alpha);

  await rate(alpha, 'normal', 15000, 30000); await rate(alpha, 'urgent', 25000, 45000); await rate(alpha, 'very_urgent', 40000, 70000);
  await rate(beta, 'normal', 18000, 28000); await rate(beta, 'urgent', 28000, 48000); await rate(beta, 'very_urgent', 45000, 75000);
  await q(`UPDATE platform_delivery_rates SET same_province=12000, other_province=25000, updated_at=NOW() WHERE speed='normal'`);
  await q(`UPDATE platform_delivery_rates SET same_province=22000, other_province=42000, updated_at=NOW() WHERE speed='urgent'`);
  await q(`UPDATE platform_delivery_rates SET same_province=35000, other_province=65000, updated_at=NOW() WHERE speed='very_urgent'`);

  const cats = await q(`SELECT id,name FROM categories WHERE is_active ORDER BY order_index,name`);
  const cat = Object.fromEntries(cats.rows.map(x => [x.name, x.id]));
  const subs = await q(`SELECT id,name,category_id FROM sub_categories WHERE is_active`);
  const subFor = (categoryId, fallback) => subs.rows.find(x => x.category_id === categoryId && x.name === fallback)?.id || subs.rows.find(x => x.category_id === categoryId)?.id || null;
  const products = [
    [alpha,'TOP-DRL-001','قبضة توربين عالية السرعة LED','الأجهزة','قبضات',185,'USD',12,'جهاز احترافي مناسب للعيادات والطلاب، جاهز للتجربة والشراء.'],
    [alpha,'TOP-CMP-002','كومبوزيت ترميمي Nano Hybrid','المواد السنية الاستهلاكية','حشوات',35,'USD',40,'مادة ترميم عالية الجودة مع ألوان متعددة.'],
    [alpha,'TOP-INS-003','مرآة فموية ومسبار فحص','الأدوات','معدنيات',18,'USD',75,'طقم أدوات أساسي للطلاب والعيادات.'],
    [alpha,'TOP-STU-004','عدة طالب طب أسنان متكاملة','مواد طلابية جامعية','مواد سنية',95,'USD',20,'عدة تدريب متكاملة مناسبة للطلاب الجامعيين.'],
    [beta,'TOP-STE-005','جهاز تعقيم حراري Class B','الأجهزة','أجهزة تعقيم',1250,'USD',5,'جهاز تعقيم احترافي مع برنامج تجفيف وتخزين.'],
    [beta,'TOP-IMP-006','طقم زرعات سنية تجريبي','جراحة وزرع الأسنان','أدوات زراعة الأسنان',480,'USD',8,'طقم تجريبي كامل للتدريب والعيادات المتخصصة.'],
    [beta,'TOP-PPE-007','كمامات وقفازات طبية - صندوق','إكسسوارات وألبسة طبية','ألبسة طبية',22,'USD',100,'مستلزمات وقاية للاستخدام اليومي.'],
    [beta,'TOP-LMP-008','مصباح تصليب LED احترافي','الأجهزة','أجهزة تصليب',165,'USD',15,'مصباح تصليب لاسلكي مع شاشة رقمية.']
  ];
  const productIds = {};
  for (const [merchantId, code, name, category, subCategory, price, currency, stock, description] of products) {
    const categoryId = cat[category]; const subId = categoryId ? subFor(categoryId, subCategory) : null;
    const r = await q(`INSERT INTO products (merchant_id,name,code,category,sub_category,description,specifications,condition,price,currency,stock_quantity,is_active,is_approved,status,approved_at,original_price,price_syp,dollar_rate_snapshot,seller_province,seller_area,seller_declaration,platform_fee_accepted,category_id,sub_category_id,delivery_provider,delivery_same_province,shipping_other_province,metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,'new',$8,$9,$10,true,true,'approved',$11,$8,$12,15000,$13,$14,true,true,$15,$16,'auto',true,true,$17) ON CONFLICT (code) DO UPDATE SET merchant_id=EXCLUDED.merchant_id,name=EXCLUDED.name,category=EXCLUDED.category,sub_category=EXCLUDED.sub_category,description=EXCLUDED.description,price=EXCLUDED.price,currency=EXCLUDED.currency,stock_quantity=EXCLUDED.stock_quantity,is_active=true,is_approved=true,status='approved',category_id=EXCLUDED.category_id,sub_category_id=EXCLUDED.sub_category_id,updated_at=NOW() RETURNING id`, [merchantId,name,code,category,subCategory,description,'منتج تجريبي موثق ضمن بيئة العرض.',price,currency,stock,now,price*15000,merchantId===alpha?'دمشق':'حلب','المنطقة التجارية',categoryId,subId,JSON.stringify({ demo: true, origin: 'TopDent Demo' })]);
    productIds[code] = r.rows[0].id;
  }

  const bannerImages = ['https://images.unsplash.com/photo-1609840114035-3c981b782dfe?auto=format&fit=crop&w=1600&q=80','https://images.unsplash.com/photo-1588776814546-daab30f310ce?auto=format&fit=crop&w=1600&q=80'];
  await q(`INSERT INTO banners (title,image_url,link_url,order_index,is_active) VALUES ('عروض تجهيز العيادات','${bannerImages[0]}','/products',1,true),('مستلزمات الطلاب والجامعات','${bannerImages[1]}','/products?category=مواد%20طلابية%20جامعية',2,true) ON CONFLICT DO NOTHING`);
  const offer = await q(`INSERT INTO offers (title,description,image_url,merchant_id,order_index,is_active,created_by) VALUES ('خصم افتتاح متجر TopDent','خصم تجريبي على مجموعة مختارة من المنتجات لتجربة رحلة الشراء كاملة.',$1,$2,1,true,$3) ON CONFLICT DO NOTHING RETURNING id`, [bannerImages[0],alpha,owner]);
  if (offer.rows[0]) await q(`INSERT INTO offer_products(offer_id,product_id) VALUES ($1,$2),($1,$3),($1,$4) ON CONFLICT DO NOTHING`, [offer.rows[0].id, productIds['TOP-DRL-001'], productIds['TOP-CMP-002'], productIds['TOP-STU-004']]);
  await q(`INSERT INTO discount_codes (code,discount_percentage,max_uses,current_uses,expires_at,is_active,starts_at,min_order_amount,max_user_uses,merchant_id,created_by) VALUES ('DEMO10',10,500,0,NOW()+INTERVAL '90 days',true,NOW()-INTERVAL '1 day',0,3,NULL,$1) ON CONFLICT (code) DO UPDATE SET discount_percentage=10,is_active=true,expires_at=NOW()+INTERVAL '90 days'`, [owner]);
  await q(`INSERT INTO settings(key,value) VALUES ('demo_mode','true'),('platform_name','TopDent'),('support_phone','011-555-5555'),('support_whatsapp','0999-555-555'),('default_currency','SYP'),('demo_notice','هذه بيانات تجريبية للعرض والاختبار') ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()`);

  await q(`INSERT INTO rentals(product_id,daily_price,weekly_price,deposit_amount,return_terms,late_fee_per_day,is_active) VALUES ($1,25000,120000,300000,'إعادة الجهاز بحالته الأصلية خلال المدة المتفق عليها.',10000,true) ON CONFLICT DO NOTHING`, [productIds['TOP-DRL-001']]);
  await q(`INSERT INTO dental_card_requests(user_id,doctor_name,specialty,phone,address,email,colors,requested_text,requested_template,quoted_price,execution_days,included_revisions,status,admin_note) VALUES ($1,'د. أحمد التجريبي','طب أسنان عام','0999000007','دمشق - المزة','demo.customer@topdent.test','أزرق وذهبي','عيادة الدكتور أحمد - ابتسامتك أولويتنا','modern',750000,5,2,'quoted','طلب تجريبي جاهز للمراجعة') ON CONFLICT DO NOTHING`, [buyer]);

  const existingOrder = await q(`SELECT id FROM orders WHERE order_number='DEMO-ORDER-0001'`);
  if (!existingOrder.rows[0]) {
    const productId = productIds['TOP-CMP-002'];
    const order = await q(`INSERT INTO orders (order_number,user_id,merchant_id,status,payment_status,subtotal,discount_amount,delivery_cost,total,currency,delivery_speed,customer_name,customer_phone,customer_whatsapp,province,address,notes,order_type,delivery_rate_snapshot,price_snapshot,payment_method,university_clinic) VALUES ('DEMO-ORDER-0001',$1,$2,'delivered','received',525000,52500,15000,487500,'SYP','normal','العميل التجريبي أحمد','0999000007','0999000007','دمشق','المزة - شارع الجلاء','طلب تجريبي للعرض فقط','merchant',$3,$4,'cash_on_delivery','جامعة دمشق') RETURNING id`, [buyer,alpha,JSON.stringify({ provider:'merchant',providerName:'شركة الشام للتجهيزات السنية',speed:'normal',cost:15000 }),JSON.stringify({ currency:'USD', unitPrice:35, quantity:1, dollarRate:15000 })]);
    await q(`INSERT INTO order_items(order_id,product_id,product_code,product_name,quantity,price,currency,price_syp,original_price,dollar_rate_snapshot,product_snapshot) VALUES ($1,$2,'TOP-CMP-002','كومبوزيت ترميمي Nano Hybrid',1,525000,'SYP',525000,35,15000,$3)`, [order.rows[0].id,productId,JSON.stringify({ code:'TOP-CMP-002',name:'كومبوزيت ترميمي Nano Hybrid',demo:true })]);
    await q(`INSERT INTO invoices(invoice_number,order_id,customer_id,company_id,currency,subtotal,discount_amount,delivery_cost,total,snapshot) VALUES ('DEMO-INV-0001',$1,$2,$3,'SYP',525000,52500,15000,487500,$4) ON CONFLICT DO NOTHING`, [order.rows[0].id,buyer,alpha,JSON.stringify({demo:true,orderNumber:'DEMO-ORDER-0001'})]);
    await q(`INSERT INTO order_status_history(order_id,from_status,to_status,changed_by,reason) VALUES ($1,NULL,'new',$2,'إنشاء طلب تجريبي'),($1,'new','approved',$2,'اعتماد تجريبي'),($1,'approved','delivered',$2,'تسليم تجريبي')`, [order.rows[0].id,owner]);
  }

  await q('COMMIT');
  console.log(JSON.stringify({ ok:true, message:'Demo seed completed', demoPassword:password, accounts:{ owner:'demo.owner@topdent.test', platformAdmin:'demo.admin@topdent.test', alphaManager:'demo.alpha.manager@topdent.test', alphaAdmin:'demo.alpha.admin@topdent.test', betaManager:'demo.beta.manager@topdent.test', platformDriver:'demo.platform.driver@topdent.test', companyDriver:'demo.company.driver@topdent.test', customer:'demo.customer@topdent.test', student:'demo.student@topdent.test' }, companies:['شركة الشام للتجهيزات السنية','مركز حلب الطبي للتجهيزات'], products:products.length, coupon:'DEMO10', order:'DEMO-ORDER-0001'}, null, 2));
} catch (e) { await q('ROLLBACK'); console.error(e); process.exitCode=1; } finally { await c.end(); }
