import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler, AppError, audit } from '../lib/http.js';
import { createProductSchema, idParamsSchema, userProfileSchema } from '../validation/schemas.js';
import { markMediaAssetsAttached } from '../lib/storage.js';

const router = express.Router();
router.use(verifyToken);

async function personalMerchant(user) {
  const { data: existing, error } = await supabaseAdmin.from('merchants').select('*').eq('user_id', user.id).maybeSingle();
  if (error) throw error;
  if (existing) return existing;
  const { data, error: insertError } = await supabaseAdmin.from('merchants').insert({
    user_id: user.id,
    company_name: user.fullName || 'بائع TopDent',
    phone: null,
    province: null,
    is_active: true,
    is_approved: true,
    approval_status: 'approved',
    is_personal_seller: true,
    dollar_rate: 1
  }).select().single();
  if (insertError) throw insertError;
  return data;
}

router.get('/me', asyncHandler(async (req, res) => {
  const { data: user, error } = await supabaseAdmin.from('users').select('id, email, full_name, phone, whatsapp, province, area, address, university_clinic, role, is_active, avatar_url, created_at, last_login_at').eq('id', req.user.id).single();
  if (error) throw error;
  res.json(user);
}));

router.put('/me', validate({ body: userProfileSchema }), asyncHandler(async (req, res) => {
  const { error } = await supabaseAdmin.from('users').update({
    full_name: req.body.fullName,
    phone: req.body.phone,
    whatsapp: req.body.whatsapp,
    province: req.body.province,
    area: req.body.area,
    address: req.body.address || null,
    university_clinic: req.body.universityClinic || null,
    avatar_url: req.body.avatarUrl || null,
    updated_at: new Date().toISOString()
  }).eq('id', req.user.id);
  if (error?.code === '23505') throw new AppError(409, 'رقم الهاتف مستخدم بالفعل', 'PHONE_IN_USE');
  if (error) throw error;
  await audit(req.user.id, 'profile_updated', 'user', req.user.id);
  res.json({ message: 'تم تحديث الملف الشخصي' });
}));

router.get('/notifications', asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const { data, error, count } = await supabaseAdmin.from('notifications').select('*', { count: 'exact' }).eq('user_id', req.user.id).order('created_at', { ascending: false }).range((page - 1) * limit, page * limit - 1);
  if (error) throw error;
  res.json({ notifications: data || [], pagination: { page, limit, total: count || 0 } });
}));

router.patch('/notifications/:id/read', validate({ params: idParamsSchema }), asyncHandler(async (req, res) => {
  const { data, error } = await supabaseAdmin.from('notifications').update({ is_read: true }).eq('id', req.params.id).eq('user_id', req.user.id).select('id').maybeSingle();
  if (error) throw error;
  if (!data) throw new AppError(404, 'الإشعار غير موجود', 'NOTIFICATION_NOT_FOUND');
  res.json({ message: 'تم تعليم الإشعار كمقروء' });
}));

router.get('/listings', requireRole(['customer']), asyncHandler(async (req, res) => {
  const { data: merchant, error } = await supabaseAdmin.from('merchants').select('id').eq('user_id', req.user.id).maybeSingle();
  if (error) throw error;
  if (!merchant) return res.json({ products: [] });
  const { data, error: productsError } = await supabaseAdmin.from('products').select('*, images:product_images(image_url, is_primary)').eq('merchant_id', merchant.id).eq('condition', 'used').order('created_at', { ascending: false });
  if (productsError) throw productsError;
  res.json({ products: data || [] });
}));

router.post('/listings', requireRole(['customer']), validate({ body: createProductSchema }), asyncHandler(async (req, res) => {
  if (req.body.condition !== 'used') throw new AppError(400, 'يمكن للحساب الشخصي عرض منتجات مستعملة فقط', 'USED_ONLY_LISTING');
  const merchant = await personalMerchant(req.user);
  const rate = Number(merchant.dollar_rate || 1);
  const { data: assets, error: assetsError } = await supabaseAdmin.from('media_assets').select('public_url').in('public_url', req.body.images).eq('owner_id', req.user.id);
  if (assetsError) throw assetsError;
  if ((assets || []).length !== req.body.images.length) throw new AppError(400, 'استخدم صوراً مرفوعة من حسابك فقط', 'IMAGE_OWNERSHIP_REQUIRED');
  const { data: product, error } = await supabaseAdmin.from('products').insert({
    merchant_id: merchant.id,
    name: req.body.name,
    code: req.body.code || `USED-${Date.now().toString(36).toUpperCase()}`,
    category: req.body.category,
    sub_category: req.body.subCategory || null,
    description: req.body.description,
    specifications: req.body.specifications || null,
    condition: 'used',
    price: req.body.price,
    original_price: req.body.price,
    currency: req.body.currency,
    price_syp: req.body.currency === 'USD' ? Number(req.body.price) * rate : req.body.price,
    dollar_rate_snapshot: req.body.currency === 'USD' ? rate : null,
    stock_quantity: req.body.stockQuantity,
    manufacturer: req.body.manufacturer || null,
    country_of_origin: req.body.countryOfOrigin || null,
    seller_province: req.body.sellerProvince,
    seller_area: req.body.sellerArea,
    seller_university: req.body.sellerUniversity || null,
    usage_duration_months: req.body.usageDurationMonths,
    defects: req.body.defects,
    seller_declaration: true,
    platform_fee_accepted: true,
    is_active: true,
    is_approved: false,
    status: 'pending',
    metadata: req.body.metadata || {}
  }).select().single();
  if (error) throw error;
  const { error: imageError } = await supabaseAdmin.from('product_images').insert(req.body.images.map((imageUrl, index) => ({ product_id: product.id, image_url: imageUrl, is_primary: index === 0, created_by: req.user.id })));
  if (imageError) throw imageError;
  await markMediaAssetsAttached(req.body.images);
  await audit(req.user.id, 'used_product_submitted', 'product', product.id);
  res.status(201).json({ message: 'تم إرسال المنتج المستعمل للمراجعة', productId: product.id });
}));

export default router;
