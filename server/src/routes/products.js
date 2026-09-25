import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler, AppError, audit, merchantForUser, normalizeArabic, pageRange } from '../lib/http.js';
import { createProductSchema, idParamsSchema, productQuerySchema, reportProductSchema, updateProductSchema } from '../validation/schemas.js';
import { deleteMediaAssetsByUrls, markMediaAssetsAttached } from '../lib/storage.js';

const router = express.Router();

function productPayload(body, merchant) {
  const rate = Number(merchant.dollar_rate || 1);
  const originalPrice = Number(body.price);
  return {
    name: body.name,
    code: body.code || `TD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    category: body.category,
    sub_category: body.subCategory || null,
    description: body.description,
    specifications: body.specifications || null,
    condition: body.condition,
    price: originalPrice,
    original_price: originalPrice,
    currency: body.currency,
    price_syp: body.currency === 'USD' ? originalPrice * rate : originalPrice,
    dollar_rate_snapshot: body.currency === 'USD' ? rate : null,
    stock_quantity: body.stockQuantity,
    expiration_date: body.expirationDate ? new Date(body.expirationDate).toISOString().slice(0, 10) : null,
    manufacturer: body.manufacturer || null,
    country_of_origin: body.countryOfOrigin || null,
    warranty_details: body.warrantyDetails || null,
    warranty_months: body.warrantyMonths ?? null,
    accessories: body.accessories || null,
    maintenance_details: body.maintenanceDetails || null,
    delivery_same_province: body.deliverySameProvince,
    shipping_other_province: body.shippingOtherProvince,
    seller_province: body.sellerProvince,
    seller_area: body.sellerArea,
    seller_university: body.sellerUniversity || null,
    usage_duration_months: body.usageDurationMonths ?? null,
    defects: body.defects || null,
    seller_declaration: body.sellerDeclaration,
    platform_fee_accepted: body.platformFeeAccepted,
    metadata: body.metadata || {}
  };
}

async function replaceImages(productId, images, userId) {
  const { data: previousImages, error: previousError } = await supabaseAdmin
    .from('product_images')
    .select('image_url')
    .eq('product_id', productId);
  if (previousError) throw previousError;
  const { error: deleteError } = await supabaseAdmin.from('product_images').delete().eq('product_id', productId);
  if (deleteError) throw deleteError;
  if (!images?.length) return;
  const { data: assets, error: assetError } = await supabaseAdmin
    .from('media_assets')
    .select('public_url, storage_path, content_type, byte_size, width, height')
    .in('public_url', images)
    .eq('owner_id', userId);
  if (assetError) throw assetError;
  if ((assets || []).length !== images.length) throw new AppError(400, 'استخدم صوراً مرفوعة من حسابك فقط', 'IMAGE_OWNERSHIP_REQUIRED');
  const assetByUrl = new Map(assets.map((asset) => [asset.public_url, asset]));
  const { error } = await supabaseAdmin.from('product_images').insert(images.map((imageUrl, index) => ({
    product_id: productId,
    image_url: imageUrl,
    is_primary: index === 0,
    created_by: userId,
    storage_path: assetByUrl.get(imageUrl).storage_path,
    content_type: assetByUrl.get(imageUrl).content_type,
    byte_size: assetByUrl.get(imageUrl).byte_size,
    width: assetByUrl.get(imageUrl).width,
    height: assetByUrl.get(imageUrl).height
  })));
  if (error) throw error;
  await markMediaAssetsAttached(images);
  await deleteMediaAssetsByUrls((previousImages || []).map((image) => image.image_url), userId);
}

router.get('/', validate({ query: productQuerySchema }), asyncHandler(async (req, res) => {
  const { category, subCategory, condition, province, university, minPrice, maxPrice, currency, minUsageMonths, maxUsageMonths, expiresBefore, createdAfter, sortBy, search, offers } = req.query;
  const { page, limit, from, to } = pageRange(req.query.page, req.query.limit);
  let query = supabaseAdmin.from('products').select(`
    *, merchant:merchants!inner(id, company_name, logo_url, province, area), images:product_images(image_url, is_primary)
  `, { count: 'exact' }).eq('is_active', true).eq('is_approved', true).eq('status', 'approved');

  if (category) query = query.eq('category', category);
  if (subCategory) query = query.eq('sub_category', subCategory);
  if (condition) query = query.eq('condition', condition);
  if (province) query = query.eq('seller_province', province);
  if (university) query = query.ilike('seller_university', `%${university}%`);
  if (minPrice !== undefined) query = query.gte('price_syp', minPrice);
  if (maxPrice !== undefined) query = query.lte('price_syp', maxPrice);
  if (currency) query = query.eq('currency', currency);
  if (minUsageMonths !== undefined) query = query.gte('usage_duration_months', minUsageMonths);
  if (maxUsageMonths !== undefined) query = query.lte('usage_duration_months', maxUsageMonths);
  if (expiresBefore) query = query.lte('expiration_date', expiresBefore.toISOString().slice(0, 10));
  if (createdAfter) query = query.gte('created_at', createdAfter.toISOString());
  if (search) {
    const escaped = search.replace(/[,()]/g, ' ');
    query = query.or(`name.ilike.%${escaped}%,code.ilike.%${escaped}%,description.ilike.%${escaped}%`);
  }
  if (offers === 'true') {
    const { data: links, error } = await supabaseAdmin.from('offer_products').select('product_id, offer:offers!inner(is_active, starts_at, ends_at)').eq('offer.is_active', true);
    if (error) throw error;
    const now = new Date();
    const ids = (links || []).filter((link) => !link.offer.starts_at || new Date(link.offer.starts_at) <= now).filter((link) => !link.offer.ends_at || new Date(link.offer.ends_at) > now).map((link) => link.product_id);
    if (!ids.length) return res.json({ products: [], pagination: { page, limit, total: 0, pages: 0 } });
    query = query.in('id', ids);
  }
  if (sortBy === 'oldest') query = query.order('created_at', { ascending: true });
  else if (sortBy === 'cheapest') query = query.order('price_syp', { ascending: true });
  else if (sortBy === 'expensive') query = query.order('price_syp', { ascending: false });
  else query = query.order('created_at', { ascending: false });

  const { data, error, count } = await query.range(from, to);
  if (error) throw error;
  res.json({ products: data || [], pagination: { page, limit, total: count || 0, pages: Math.ceil((count || 0) / limit) } });
}));

router.get('/:id/related', validate({ params: idParamsSchema }), asyncHandler(async (req, res) => {
  const { data: product, error } = await supabaseAdmin.from('products').select('id, category, merchant_id').eq('id', req.params.id).maybeSingle();
  if (error) throw error;
  if (!product) throw new AppError(404, 'المنتج غير موجود', 'PRODUCT_NOT_FOUND');
  const { data, error: relatedError } = await supabaseAdmin.from('products')
    .select('*, merchant:merchants!inner(id, company_name, logo_url), images:product_images(image_url, is_primary)')
    .eq('category', product.category).neq('id', product.id).eq('is_active', true).eq('is_approved', true).eq('status', 'approved').limit(8);
  if (relatedError) throw relatedError;
  res.json({ products: data || [] });
}));

router.get('/:id', validate({ params: idParamsSchema }), asyncHandler(async (req, res) => {
  const { data, error } = await supabaseAdmin.from('products').select(`
    *, merchant:merchants(id, company_name, logo_url, province, area, dollar_rate), images:product_images(image_url, is_primary)
  `).eq('id', req.params.id).eq('is_active', true).eq('is_approved', true).eq('status', 'approved').maybeSingle();
  if (error) throw error;
  if (!data) throw new AppError(404, 'المنتج غير موجود', 'PRODUCT_NOT_FOUND');
  res.json(data);
}));

router.post('/', verifyToken, requireRole(['merchant']), validate({ body: createProductSchema }), asyncHandler(async (req, res) => {
  const merchant = await merchantForUser(req.user.id);
  if (!merchant) throw new AppError(404, 'ملف الشركة غير موجود', 'MERCHANT_NOT_FOUND');
  const payload = productPayload(req.body, merchant);
  const { data: product, error } = await supabaseAdmin.from('products').insert({
    ...payload,
    merchant_id: merchant.id,
    is_active: true,
    is_approved: false,
    status: 'pending'
  }).select().single();
  if (error) throw error;
  await replaceImages(product.id, req.body.images, req.user.id);
  await audit(req.user.id, 'product_submitted', 'product', product.id, { condition: product.condition, merchantId: merchant.id });
  res.status(201).json({ message: 'تم إرسال المنتج للمراجعة', productId: product.id, status: product.status });
}));

router.put('/:id', verifyToken, requireRole(['merchant']), validate({ params: idParamsSchema, body: updateProductSchema }), asyncHandler(async (req, res) => {
  const merchant = await merchantForUser(req.user.id);
  if (!merchant) throw new AppError(404, 'ملف الشركة غير موجود', 'MERCHANT_NOT_FOUND');
  const { data: product, error: lookupError } = await supabaseAdmin.from('products').select('*').eq('id', req.params.id).maybeSingle();
  if (lookupError) throw lookupError;
  if (!product) throw new AppError(404, 'المنتج غير موجود', 'PRODUCT_NOT_FOUND');
  if (product.merchant_id !== merchant.id) throw new AppError(403, 'لا يمكنك تعديل منتج شركة أخرى', 'PRODUCT_OWNERSHIP_REQUIRED');

  const merged = { ...product, ...req.body, price: req.body.price ?? product.price, currency: req.body.currency ?? product.currency };
  const updates = productPayload({
    ...merged,
    stockQuantity: req.body.stockQuantity ?? product.stock_quantity,
    subCategory: req.body.subCategory ?? product.sub_category,
    expirationDate: req.body.expirationDate ?? product.expiration_date,
    countryOfOrigin: req.body.countryOfOrigin ?? product.country_of_origin,
    warrantyDetails: req.body.warrantyDetails ?? product.warranty_details,
    warrantyMonths: req.body.warrantyMonths ?? product.warranty_months,
    maintenanceDetails: req.body.maintenanceDetails ?? product.maintenance_details,
    deliverySameProvince: req.body.deliverySameProvince ?? product.delivery_same_province,
    shippingOtherProvince: req.body.shippingOtherProvince ?? product.shipping_other_province,
    sellerProvince: req.body.sellerProvince ?? product.seller_province,
    sellerArea: req.body.sellerArea ?? product.seller_area,
    sellerUniversity: req.body.sellerUniversity ?? product.seller_university,
    usageDurationMonths: req.body.usageDurationMonths ?? product.usage_duration_months,
    sellerDeclaration: req.body.sellerDeclaration ?? product.seller_declaration,
    platformFeeAccepted: req.body.platformFeeAccepted ?? product.platform_fee_accepted,
    metadata: req.body.metadata ?? product.metadata
  }, merchant);
  updates.status = 'pending';
  updates.is_approved = false;
  updates.rejection_reason = null;
  updates.updated_at = new Date().toISOString();
  const { error } = await supabaseAdmin.from('products').update(updates).eq('id', product.id);
  if (error) throw error;
  if (req.body.images) await replaceImages(product.id, req.body.images, req.user.id);
  await audit(req.user.id, 'product_updated_resubmitted', 'product', product.id);
  res.json({ message: 'تم تحديث المنتج وإرساله للمراجعة', status: 'pending' });
}));

router.patch('/:id/disable', verifyToken, requireRole(['merchant', 'admin']), validate({ params: idParamsSchema }), asyncHandler(async (req, res) => {
  const { data: product, error } = await supabaseAdmin.from('products').select('id, merchant_id').eq('id', req.params.id).maybeSingle();
  if (error) throw error;
  if (!product) throw new AppError(404, 'المنتج غير موجود', 'PRODUCT_NOT_FOUND');
  if (req.user.role === 'merchant') {
    const merchant = await merchantForUser(req.user.id);
    if (!merchant || merchant.id !== product.merchant_id) throw new AppError(403, 'لا يمكنك إيقاف منتج شركة أخرى', 'PRODUCT_OWNERSHIP_REQUIRED');
  }
  const { error: updateError } = await supabaseAdmin.from('products').update({ is_active: false, status: 'inactive', updated_at: new Date().toISOString() }).eq('id', product.id);
  if (updateError) throw updateError;
  await audit(req.user.id, 'product_disabled', 'product', product.id);
  res.json({ message: 'تم إيقاف المنتج' });
}));

router.delete('/:id', verifyToken, requireRole(['merchant', 'admin']), validate({ params: idParamsSchema }), asyncHandler(async (req, res) => {
  const { data: product, error } = await supabaseAdmin.from('products').select('id, merchant_id').eq('id', req.params.id).maybeSingle();
  if (error) throw error;
  if (!product) throw new AppError(404, 'المنتج غير موجود', 'PRODUCT_NOT_FOUND');
  if (req.user.role === 'merchant') {
    const merchant = await merchantForUser(req.user.id);
    if (!merchant || merchant.id !== product.merchant_id) throw new AppError(403, 'لا يمكنك حذف منتج شركة أخرى', 'PRODUCT_OWNERSHIP_REQUIRED');
  }
  const { error: updateError } = await supabaseAdmin.from('products').update({ is_active: false, status: 'inactive', updated_at: new Date().toISOString() }).eq('id', product.id);
  if (updateError) throw updateError;
  await audit(req.user.id, 'product_deleted_soft', 'product', product.id);
  res.json({ message: 'تم حذف المنتج من العرض بشكل آمن' });
}));

router.post('/:id/report', verifyToken, validate({ params: idParamsSchema, body: reportProductSchema }), asyncHandler(async (req, res) => {
  const { data: product, error: productError } = await supabaseAdmin.from('products').select('id').eq('id', req.params.id).maybeSingle();
  if (productError) throw productError;
  if (!product) throw new AppError(404, 'المنتج غير موجود', 'PRODUCT_NOT_FOUND');
  const { error } = await supabaseAdmin.from('product_reports').insert({ product_id: product.id, reporter_id: req.user.id, reason: req.body.reason, details: req.body.details || null });
  if (error?.code === '23505') throw new AppError(409, 'تم إرسال هذا البلاغ مسبقاً', 'DUPLICATE_REPORT');
  if (error) throw error;
  await audit(req.user.id, 'product_reported', 'product', product.id, { reason: req.body.reason });
  res.status(201).json({ message: 'تم إرسال البلاغ للمراجعة' });
}));

export default router;
