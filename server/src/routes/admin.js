import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler, AppError, audit, notify, pageRange } from '../lib/http.js';
import { adminUserSchema, approvalSchema, bannerSchema, createCategorySchema, createDiscountSchema, createOfferSchema, createSubCategorySchema, idParamsSchema, paymentReviewSchema, provinceSchema, settingSchema } from '../validation/schemas.js';

const router = express.Router();
router.use(verifyToken, requireRole(['admin']));

async function list(table, query, res) {
  const { page, limit, from, to } = pageRange(query.page, query.limit);
  const { data, error, count } = await supabaseAdmin.from(table).select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(from, to);
  if (error) throw error;
  res.json({ items: data || [], pagination: { page, limit, total: count || 0, pages: Math.ceil((count || 0) / limit) } });
}

router.get('/dashboard', asyncHandler(async (req, res) => {
  const [users, merchants, products, orders, payments] = await Promise.all([
    supabaseAdmin.from('users').select('id, role, is_active'),
    supabaseAdmin.from('merchants').select('id, approval_status'),
    supabaseAdmin.from('products').select('id, status'),
    supabaseAdmin.from('orders').select('id, total, status, payment_status').eq('order_type', 'merchant'),
    supabaseAdmin.from('external_payments').select('id, status')
  ]);
  for (const result of [users, merchants, products, orders, payments]) if (result.error) throw result.error;
  res.json({
    totalUsers: users.data?.length || 0,
    activeUsers: users.data?.filter((user) => user.is_active).length || 0,
    totalMerchants: merchants.data?.length || 0,
    pendingMerchants: merchants.data?.filter((merchant) => merchant.approval_status === 'pending').length || 0,
    totalProducts: products.data?.length || 0,
    pendingProducts: products.data?.filter((product) => product.status === 'pending').length || 0,
    totalOrders: orders.data?.length || 0,
    pendingOrders: orders.data?.filter((order) => ['new', 'pending_review'].includes(order.status)).length || 0,
    pendingPayments: (orders.data?.filter((order) => order.payment_status === 'pending').length || 0) + (payments.data?.filter((payment) => payment.status === 'pending').length || 0),
    totalRevenue: orders.data?.filter((order) => ['payment_received', 'completed', 'archive'].includes(order.status)).reduce((total, order) => total + Number(order.total), 0) || 0,
    currency: 'SYP'
  });
}));

router.get('/users', asyncHandler(async (req, res) => {
  const { page, limit, from, to } = pageRange(req.query.page, req.query.limit);
  let query = supabaseAdmin.from('users').select('id, full_name, email, phone, role, is_active, created_at, last_login_at', { count: 'exact' });
  if (req.query.role) query = query.eq('role', req.query.role);
  const { data, error, count } = await query.order('created_at', { ascending: false }).range(from, to);
  if (error) throw error;
  res.json({ users: data || [], pagination: { page, limit, total: count || 0, pages: Math.ceil((count || 0) / limit) } });
}));

router.patch('/users/:id', validate({ params: idParamsSchema, body: adminUserSchema }), asyncHandler(async (req, res) => {
  if (req.params.id === req.user.id && (req.body.role || req.body.isActive === false)) throw new AppError(409, 'لا يمكنك تعديل صلاحية أو تعطيل حسابك من هذه الشاشة', 'SELF_ADMIN_CHANGE_BLOCKED');
  const { data: user, error } = await supabaseAdmin.from('users').update({
    ...(req.body.role !== undefined ? { role: req.body.role } : {}),
    ...(req.body.isActive !== undefined ? { is_active: req.body.isActive, disabled_at: req.body.isActive ? null : new Date().toISOString() } : {}),
    updated_at: new Date().toISOString()
  }).eq('id', req.params.id).select('id, full_name, role, is_active').maybeSingle();
  if (error) throw error;
  if (!user) throw new AppError(404, 'المستخدم غير موجود', 'USER_NOT_FOUND');
  if (req.body.role === 'driver') {
    const { error: driverError } = await supabaseAdmin.from('driver_profiles').upsert({ user_id: user.id }, { onConflict: 'user_id', ignoreDuplicates: true });
    if (driverError) throw driverError;
  }
  await audit(req.user.id, 'admin_user_updated', 'user', user.id, req.body);
  res.json({ message: 'تم تحديث المستخدم', user });
}));

router.get('/drivers', asyncHandler(async (req, res) => {
  const { data, error } = await supabaseAdmin.from('driver_profiles').select('*, user:users(id, full_name, phone, whatsapp, is_active)').order('created_at', { ascending: false });
  if (error) throw error;
  res.json({ drivers: data || [] });
}));

router.get('/merchants', asyncHandler(async (req, res) => {
  const { page, limit, from, to } = pageRange(req.query.page, req.query.limit);
  let query = supabaseAdmin.from('merchants').select('*, user:users(full_name, email, is_active)', { count: 'exact' });
  if (req.query.status) query = query.eq('approval_status', req.query.status);
  const { data, error, count } = await query.order('created_at', { ascending: false }).range(from, to);
  if (error) throw error;
  res.json({ merchants: data || [], pagination: { page, limit, total: count || 0, pages: Math.ceil((count || 0) / limit) } });
}));

router.patch('/merchants/:id/approval', validate({ params: idParamsSchema, body: approvalSchema }), asyncHandler(async (req, res) => {
  const { data: merchant, error } = await supabaseAdmin.from('merchants').select('id, user_id, company_name').eq('id', req.params.id).maybeSingle();
  if (error) throw error;
  if (!merchant) throw new AppError(404, 'الشركة غير موجودة', 'MERCHANT_NOT_FOUND');
  if (!req.body.approved && !req.body.reason) throw new AppError(400, 'أدخل سبب الرفض', 'REJECTION_REASON_REQUIRED');
  const { error: updateError } = await supabaseAdmin.from('merchants').update({
    is_approved: req.body.approved,
    approval_status: req.body.approved ? 'approved' : 'rejected',
    rejection_reason: req.body.approved ? null : req.body.reason,
    approved_by: req.body.approved ? req.user.id : null,
    approved_at: req.body.approved ? new Date().toISOString() : null,
    updated_at: new Date().toISOString()
  }).eq('id', merchant.id);
  if (updateError) throw updateError;
  await notify(merchant.user_id, 'merchant_approval', req.body.approved ? 'تمت الموافقة على شركتك' : 'تم رفض تسجيل الشركة', req.body.approved ? `أصبحت شركة ${merchant.company_name} جاهزة للعمل.` : req.body.reason);
  await audit(req.user.id, 'merchant_approval_updated', 'merchant', merchant.id, req.body);
  res.json({ message: req.body.approved ? 'تمت الموافقة على الشركة' : 'تم رفض الشركة مع تسجيل السبب' });
}));

router.get('/products', asyncHandler(async (req, res) => {
  const { page, limit, from, to } = pageRange(req.query.page, req.query.limit);
  let query = supabaseAdmin.from('products').select('*, merchant:merchants(company_name, user_id), images:product_images(image_url, is_primary)', { count: 'exact' });
  if (req.query.status) query = query.eq('status', req.query.status);
  const { data, error, count } = await query.order('created_at', { ascending: false }).range(from, to);
  if (error) throw error;
  res.json({ products: data || [], pagination: { page, limit, total: count || 0, pages: Math.ceil((count || 0) / limit) } });
}));

router.patch('/products/:id/approval', validate({ params: idParamsSchema, body: approvalSchema }), asyncHandler(async (req, res) => {
  const { data: product, error } = await supabaseAdmin.from('products').select('id, name, merchant:merchants(user_id)').eq('id', req.params.id).maybeSingle();
  if (error) throw error;
  if (!product) throw new AppError(404, 'المنتج غير موجود', 'PRODUCT_NOT_FOUND');
  if (!req.body.approved && !req.body.reason) throw new AppError(400, 'أدخل سبب الرفض', 'REJECTION_REASON_REQUIRED');
  const { error: updateError } = await supabaseAdmin.from('products').update({
    status: req.body.approved ? 'approved' : 'rejected', is_approved: req.body.approved,
    rejection_reason: req.body.approved ? null : req.body.reason,
    approved_by: req.body.approved ? req.user.id : null, approved_at: req.body.approved ? new Date().toISOString() : null, updated_at: new Date().toISOString()
  }).eq('id', product.id);
  if (updateError) throw updateError;
  await notify(product.merchant.user_id, 'product_approval', req.body.approved ? 'تمت الموافقة على المنتج' : 'تم رفض المنتج', req.body.approved ? `تم نشر المنتج ${product.name}.` : req.body.reason);
  await audit(req.user.id, 'product_approval_updated', 'product', product.id, req.body);
  res.json({ message: req.body.approved ? 'تمت الموافقة على المنتج' : 'تم رفض المنتج مع تسجيل السبب' });
}));

router.get('/orders', asyncHandler(async (req, res) => {
  const { page, limit, from, to } = pageRange(req.query.page, req.query.limit);
  let query = supabaseAdmin.from('orders').select('*, customer:users(full_name, email), merchant:merchants(company_name), items:order_items(*)', { count: 'exact' }).eq('order_type', 'merchant');
  if (req.query.status) query = query.eq('status', req.query.status);
  if (req.query.paymentStatus) query = query.eq('payment_status', req.query.paymentStatus);
  const { data, error, count } = await query.order('created_at', { ascending: false }).range(from, to);
  if (error) throw error;
  res.json({ orders: data || [], pagination: { page, limit, total: count || 0, pages: Math.ceil((count || 0) / limit) } });
}));

router.get('/external-payments', asyncHandler(async (req, res) => {
  const { data, error } = await supabaseAdmin.from('external_payments').select('*, order:orders(order_number, total, user_id, customer:users(full_name, phone))').order('submitted_at', { ascending: false });
  if (error) throw error;
  res.json({ payments: data || [] });
}));

router.patch('/external-payments/:id', validate({ params: idParamsSchema, body: paymentReviewSchema }), asyncHandler(async (req, res) => {
  const { data: payment, error } = await supabaseAdmin.from('external_payments').select('*, order:orders(user_id, order_number)').eq('id', req.params.id).maybeSingle();
  if (error) throw error;
  if (!payment) throw new AppError(404, 'عملية الدفع غير موجودة', 'PAYMENT_NOT_FOUND');
  const { error: updateError } = await supabaseAdmin.from('external_payments').update({ status: req.body.approved ? 'verified' : 'rejected', reviewed_by: req.user.id, review_note: req.body.note || null, reviewed_at: new Date().toISOString() }).eq('id', payment.id);
  if (updateError) throw updateError;
  await notify(payment.order.user_id, 'external_payment_review', req.body.approved ? 'تم التحقق من التحويل' : 'تم رفض التحويل', req.body.note || `حالة التحويل للطلب ${payment.order.order_number} تم تحديثها.`);
  await audit(req.user.id, 'external_payment_reviewed', 'external_payment', payment.id, req.body);
  res.json({ message: 'تمت مراجعة التحويل' });
}));

router.get('/categories', asyncHandler(async (req, res) => {
  const { data, error } = await supabaseAdmin.from('categories').select('*, subCategories:sub_categories(*)').order('order_index');
  if (error) throw error;
  res.json({ categories: data || [] });
}));

router.post('/categories', validate({ body: createCategorySchema }), asyncHandler(async (req, res) => {
  const { data, error } = await supabaseAdmin.from('categories').insert({ name: req.body.name, description: req.body.description || null, icon_url: req.body.iconUrl || null, order_index: req.body.orderIndex }).select().single();
  if (error?.code === '23505') throw new AppError(409, 'اسم التصنيف مستخدم بالفعل', 'CATEGORY_EXISTS');
  if (error) throw error;
  await audit(req.user.id, 'category_created', 'category', data.id);
  res.status(201).json({ category: data });
}));

router.put('/categories/:id', validate({ params: idParamsSchema, body: createCategorySchema }), asyncHandler(async (req, res) => {
  const { data, error } = await supabaseAdmin.from('categories').update({ name: req.body.name, description: req.body.description || null, icon_url: req.body.iconUrl || null, order_index: req.body.orderIndex }).eq('id', req.params.id).select().maybeSingle();
  if (error) throw error;
  if (!data) throw new AppError(404, 'التصنيف غير موجود', 'CATEGORY_NOT_FOUND');
  await audit(req.user.id, 'category_updated', 'category', data.id);
  res.json({ category: data });
}));

router.post('/sub-categories', validate({ body: createSubCategorySchema }), asyncHandler(async (req, res) => {
  const { data, error } = await supabaseAdmin.from('sub_categories').insert({ category_id: req.body.categoryId, name: req.body.name, description: req.body.description || null }).select().single();
  if (error?.code === '23505') throw new AppError(409, 'اسم التصنيف الفرعي مستخدم بالفعل', 'SUBCATEGORY_EXISTS');
  if (error) throw error;
  await audit(req.user.id, 'subcategory_created', 'sub_category', data.id);
  res.status(201).json({ subCategory: data });
}));

router.get('/provinces', asyncHandler(async (req, res) => {
  const { data, error } = await supabaseAdmin.from('provinces').select('*').order('name');
  if (error) throw error;
  res.json({ provinces: data || [] });
}));

router.post('/provinces', validate({ body: provinceSchema }), asyncHandler(async (req, res) => {
  const { data, error } = await supabaseAdmin.from('provinces').upsert({ name: req.body.name, is_active: req.body.isActive }, { onConflict: 'name' }).select().single();
  if (error) throw error;
  await audit(req.user.id, 'province_saved', 'province', data.id);
  res.status(201).json({ province: data });
}));

router.get('/discounts', asyncHandler(async (req, res) => list('discount_codes', req.query, res)));
router.post('/discounts', validate({ body: createDiscountSchema }), asyncHandler(async (req, res) => {
  const body = req.body;
  const { data: discount, error } = await supabaseAdmin.from('discount_codes').insert({
    code: body.code, discount_percentage: body.discountPercentage ?? null, discount_amount: body.discountAmount ?? null,
    max_uses: body.maxUses ?? null, max_user_uses: body.maxUserUses ?? null, min_order_amount: body.minOrderAmount,
    starts_at: body.startsAt?.toISOString() || null, expires_at: body.expiresAt?.toISOString() || null,
    merchant_id: body.merchantId || null, created_by: req.user.id, current_uses: 0, is_active: true
  }).select().single();
  if (error?.code === '23505') throw new AppError(409, 'رمز الخصم مستخدم بالفعل', 'DISCOUNT_EXISTS');
  if (error) throw error;
  if (body.productIds.length) {
    const { error: linksError } = await supabaseAdmin.from('discount_code_products').insert(body.productIds.map((productId) => ({ discount_id: discount.id, product_id: productId })));
    if (linksError) throw linksError;
  }
  await audit(req.user.id, 'discount_created', 'discount', discount.id);
  res.status(201).json({ discount });
}));

router.get('/offers', asyncHandler(async (req, res) => list('offers', req.query, res)));
router.post('/offers', validate({ body: createOfferSchema }), asyncHandler(async (req, res) => {
  const body = req.body;
  const { data: offer, error } = await supabaseAdmin.from('offers').insert({ title: body.title, description: body.description || null, image_url: body.imageUrl, merchant_id: body.merchantId || null, starts_at: body.startsAt?.toISOString() || null, ends_at: body.endsAt?.toISOString() || null, order_index: body.orderIndex, is_active: body.isActive, created_by: req.user.id }).select().single();
  if (error) throw error;
  if (body.productIds.length) {
    const { error: linksError } = await supabaseAdmin.from('offer_products').insert(body.productIds.map((productId) => ({ offer_id: offer.id, product_id: productId })));
    if (linksError) throw linksError;
  }
  await audit(req.user.id, 'offer_created', 'offer', offer.id);
  res.status(201).json({ offer });
}));

router.get('/banners', asyncHandler(async (req, res) => list('banners', req.query, res)));
router.post('/banners', validate({ body: bannerSchema }), asyncHandler(async (req, res) => {
  const { data, error } = await supabaseAdmin.from('banners').insert({ title: req.body.title || null, image_url: req.body.imageUrl, link_url: req.body.linkUrl || null, order_index: req.body.orderIndex, is_active: req.body.isActive }).select().single();
  if (error) throw error;
  await audit(req.user.id, 'banner_created', 'banner', data.id);
  res.status(201).json({ banner: data });
}));

router.get('/settings', asyncHandler(async (req, res) => {
  const { data, error } = await supabaseAdmin.from('settings').select('*').order('key');
  if (error) throw error;
  res.json({ settings: data || [] });
}));
router.put('/settings', validate({ body: settingSchema }), asyncHandler(async (req, res) => {
  const { data, error } = await supabaseAdmin.from('settings').upsert({ key: req.body.key, value: req.body.value, updated_at: new Date().toISOString() }, { onConflict: 'key' }).select().single();
  if (error) throw error;
  await audit(req.user.id, 'setting_updated', 'setting', data.id, { key: data.key });
  res.json({ setting: data });
}));

router.get('/audit-log', asyncHandler(async (req, res) => {
  const { page, limit, from, to } = pageRange(req.query.page, req.query.limit);
  const { data, error, count } = await supabaseAdmin.from('activity_log').select('*, user:users(full_name, email)', { count: 'exact' }).order('created_at', { ascending: false }).range(from, to);
  if (error) throw error;
  res.json({ entries: data || [], pagination: { page, limit, total: count || 0, pages: Math.ceil((count || 0) / limit) } });
}));

router.get('/product-reports', asyncHandler(async (req, res) => {
  const { data, error } = await supabaseAdmin.from('product_reports').select('*, product:products(name, code), reporter:users(full_name, email)').order('created_at', { ascending: false });
  if (error) throw error;
  res.json({ reports: data || [] });
}));

export default router;
