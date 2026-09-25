import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { verifyToken } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler, AppError, audit } from '../lib/http.js';
import { productIdParamsSchema } from '../validation/schemas.js';

const router = express.Router();
router.use(verifyToken);

router.get('/', asyncHandler(async (req, res) => {
  const { data, error } = await supabaseAdmin.from('favorites').select(`
    id, created_at, product:products!inner(id, name, code, price, price_syp, currency, stock_quantity, condition, is_active, is_approved, status,
      merchant:merchants(company_name, logo_url), images:product_images(image_url, is_primary))
  `).eq('user_id', req.user.id).order('created_at', { ascending: false });
  if (error) throw error;
  res.json({ favorites: data || [] });
}));

router.post('/:productId', validate({ params: productIdParamsSchema }), asyncHandler(async (req, res) => {
  const { data: product, error: productError } = await supabaseAdmin.from('products').select('id').eq('id', req.params.productId).eq('is_active', true).eq('is_approved', true).eq('status', 'approved').maybeSingle();
  if (productError) throw productError;
  if (!product) throw new AppError(404, 'المنتج غير متاح', 'PRODUCT_UNAVAILABLE');
  const { data, error } = await supabaseAdmin.from('favorites').upsert({ user_id: req.user.id, product_id: product.id }, { onConflict: 'user_id,product_id', ignoreDuplicates: true }).select().maybeSingle();
  if (error) throw error;
  await audit(req.user.id, 'favorite_added', 'product', product.id);
  res.status(201).json({ message: 'تمت إضافة المنتج إلى المفضلة', favoriteId: data?.id || null });
}));

router.delete('/:productId', validate({ params: productIdParamsSchema }), asyncHandler(async (req, res) => {
  const { error } = await supabaseAdmin.from('favorites').delete().eq('user_id', req.user.id).eq('product_id', req.params.productId);
  if (error) throw error;
  await audit(req.user.id, 'favorite_removed', 'product', req.params.productId);
  res.json({ message: 'تمت إزالة المنتج من المفضلة' });
}));

router.delete('/', asyncHandler(async (req, res) => {
  const { error } = await supabaseAdmin.from('favorites').delete().eq('user_id', req.user.id);
  if (error) throw error;
  await audit(req.user.id, 'favorites_cleared', 'favorite', req.user.id);
  res.json({ message: 'تم مسح المفضلة' });
}));

export default router;
