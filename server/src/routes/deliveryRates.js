import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  deliveryQuoteQuerySchema,
  deliveryRateSchema,
  deliverySpeedParamsSchema
} from '../validation/schemas.js';

const router = express.Router();

const normalize = (value) => value?.trim().toLocaleLowerCase('ar');

async function getMerchantForUser(userId) {
  const { data, error } = await supabaseAdmin
    .from('merchants')
    .select('id, province')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

router.get('/provinces', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('provinces')
      .select('id, name')
      .eq('is_active', true)
      .order('name');
    if (error) throw error;
    res.json({ provinces: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/quote', validate({ query: deliveryQuoteQuerySchema }), async (req, res) => {
  try {
    let merchantId = req.query.merchantId;

    if (req.query.productId) {
      const { data: product, error: productError } = await supabaseAdmin
        .from('products')
        .select('merchant_id')
        .eq('id', req.query.productId)
        .eq('is_active', true)
        .eq('is_approved', true)
        .maybeSingle();
      if (productError) throw productError;
      if (!product) return res.status(404).json({ error: 'Product not found' });
      merchantId = product.merchant_id;
    }

    const [{ data: merchant, error: merchantError }, { data: rate, error: rateError }] = await Promise.all([
      supabaseAdmin.from('merchants').select('id, province').eq('id', merchantId).eq('is_active', true).eq('is_approved', true).maybeSingle(),
      supabaseAdmin.from('delivery_rates').select('*').eq('merchant_id', merchantId).eq('speed', req.query.speed).maybeSingle()
    ]);

    if (merchantError) throw merchantError;
    if (rateError) throw rateError;
    if (!merchant || !rate) return res.status(404).json({ error: 'Delivery rate not found' });

    const sameProvince = normalize(merchant.province) === normalize(req.query.province);
    res.json({
      merchantId,
      speed: rate.speed,
      province: req.query.province,
      sameProvince,
      cost: Number(sameProvince ? rate.same_province : rate.other_province)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/merchant', verifyToken, requireRole(['merchant']), async (req, res) => {
  try {
    const merchant = await getMerchantForUser(req.user.id);
    if (!merchant) return res.status(404).json({ error: 'Merchant not found' });

    const { data, error } = await supabaseAdmin
      .from('delivery_rates')
      .select('*')
      .eq('merchant_id', merchant.id)
      .order('speed');
    if (error) throw error;
    res.json({ rates: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put(
  '/merchant/:speed',
  verifyToken,
  requireRole(['merchant']),
  validate({ params: deliverySpeedParamsSchema, body: deliveryRateSchema }),
  async (req, res) => {
    try {
      const merchant = await getMerchantForUser(req.user.id);
      if (!merchant) return res.status(404).json({ error: 'Merchant not found' });

      const { data, error } = await supabaseAdmin
        .from('delivery_rates')
        .upsert({
          merchant_id: merchant.id,
          speed: req.params.speed,
          same_province: req.body.sameProvince,
          other_province: req.body.otherProvince,
          updated_at: new Date().toISOString()
        }, { onConflict: 'merchant_id,speed' })
        .select()
        .single();

      if (error) throw error;
      res.json({ message: 'Delivery rate saved', rate: data });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

export default router;
