import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler, AppError, audit, merchantForUser, normalizeArabic } from '../lib/http.js';
import { deliveryQuoteQuerySchema, deliveryRateSchema, deliverySpeedParamsSchema, idParamsSchema } from '../validation/schemas.js';

const router = express.Router();

async function saveRate({ merchantId, speed, sameProvince, otherProvince, actorId }) {
  const { data, error } = await supabaseAdmin.from('delivery_rates').upsert({ merchant_id: merchantId, speed, same_province: sameProvince, other_province: otherProvince, updated_at: new Date().toISOString() }, { onConflict: 'merchant_id,speed' }).select().single();
  if (error) throw error;
  const { error: historyError } = await supabaseAdmin.from('delivery_rate_history').insert({ merchant_id: merchantId, speed, same_province: sameProvince, other_province: otherProvince, changed_by: actorId });
  if (historyError) throw historyError;
  return data;
}

router.get('/provinces', asyncHandler(async (req, res) => {
  const { data, error } = await supabaseAdmin.from('provinces').select('id, name').eq('is_active', true).order('name');
  if (error) throw error;
  res.json({ provinces: data || [] });
}));

router.get('/quote', validate({ query: deliveryQuoteQuerySchema }), asyncHandler(async (req, res) => {
  let merchantId = req.query.merchantId;
  if (req.query.productId) {
    const { data: product, error } = await supabaseAdmin.from('products').select('merchant_id').eq('id', req.query.productId).eq('is_active', true).eq('is_approved', true).eq('status', 'approved').maybeSingle();
    if (error) throw error;
    if (!product) throw new AppError(404, 'المنتج غير متاح', 'PRODUCT_UNAVAILABLE');
    merchantId = product.merchant_id;
  }
  const [{ data: merchant, error: merchantError }, { data: rate, error: rateError }] = await Promise.all([
    supabaseAdmin.from('merchants').select('id, province, company_name').eq('id', merchantId).eq('is_active', true).eq('is_approved', true).eq('approval_status', 'approved').maybeSingle(),
    supabaseAdmin.from('delivery_rates').select('*').eq('merchant_id', merchantId).eq('speed', req.query.speed).maybeSingle()
  ]);
  if (merchantError) throw merchantError;
  if (rateError) throw rateError;
  if (!merchant || !rate) throw new AppError(404, 'سعر التوصيل غير متاح', 'DELIVERY_RATE_NOT_FOUND');
  const sameProvince = normalizeArabic(merchant.province) === normalizeArabic(req.query.province);
  const cost = Number(sameProvince ? rate.same_province : rate.other_province);
  res.json({ merchantId, merchantName: merchant.company_name, speed: rate.speed, province: req.query.province, sameProvince, cost, currency: 'SYP', rateSnapshot: { speed: rate.speed, sameProvince, merchantProvince: merchant.province, customerProvince: req.query.province, cost, capturedAt: new Date().toISOString() } });
}));

router.get('/merchant', verifyToken, requireRole(['merchant']), asyncHandler(async (req, res) => {
  const merchant = await merchantForUser(req.user.id);
  if (!merchant) throw new AppError(404, 'ملف الشركة غير موجود', 'MERCHANT_NOT_FOUND');
  const { data, error } = await supabaseAdmin.from('delivery_rates').select('*').eq('merchant_id', merchant.id).order('speed');
  if (error) throw error;
  res.json({ rates: data || [] });
}));

router.put('/merchant/:speed', verifyToken, requireRole(['merchant']), validate({ params: deliverySpeedParamsSchema, body: deliveryRateSchema }), asyncHandler(async (req, res) => {
  const merchant = await merchantForUser(req.user.id);
  if (!merchant) throw new AppError(404, 'ملف الشركة غير موجود', 'MERCHANT_NOT_FOUND');
  const rate = await saveRate({ merchantId: merchant.id, speed: req.params.speed, sameProvince: req.body.sameProvince, otherProvince: req.body.otherProvince, actorId: req.user.id });
  await audit(req.user.id, 'delivery_rate_updated', 'merchant', merchant.id, { speed: req.params.speed });
  res.json({ message: 'تم حفظ سعر التوصيل. لن تتغير فواتير الطلبات السابقة.', rate });
}));

router.put('/admin/:id/:speed', verifyToken, requireRole(['admin']), validate({ params: idParamsSchema.merge(deliverySpeedParamsSchema), body: deliveryRateSchema }), asyncHandler(async (req, res) => {
  const { data: merchant, error } = await supabaseAdmin.from('merchants').select('id').eq('id', req.params.id).maybeSingle();
  if (error) throw error;
  if (!merchant) throw new AppError(404, 'الشركة غير موجودة', 'MERCHANT_NOT_FOUND');
  const rate = await saveRate({ merchantId: merchant.id, speed: req.params.speed, sameProvince: req.body.sameProvince, otherProvince: req.body.otherProvince, actorId: req.user.id });
  await audit(req.user.id, 'delivery_rate_admin_updated', 'merchant', merchant.id, { speed: req.params.speed });
  res.json({ message: 'تم حفظ سعر التوصيل', rate });
}));

export default router;
