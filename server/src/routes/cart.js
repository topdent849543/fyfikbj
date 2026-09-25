import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler, AppError, audit } from '../lib/http.js';
import { addCartItemSchema, itemIdParamsSchema, updateCartItemSchema } from '../validation/schemas.js';

const router = express.Router();
router.use(verifyToken, requireRole(['customer']));

router.get('/', asyncHandler(async (req, res) => {
  const { data, error } = await supabaseAdmin.from('cart_items').select(`
    *, product:products(id, name, code, price, price_syp, currency, stock_quantity, is_active, is_approved, status, merchant_id,
      merchant:merchants(company_name, logo_url), images:product_images(image_url, is_primary))
  `).eq('user_id', req.user.id).order('created_at', { ascending: false });
  if (error) throw error;
  const items = (data || []).map((item) => ({ ...item, available: Boolean(item.product?.is_active && item.product?.is_approved && item.product?.status === 'approved' && item.product.stock_quantity >= item.quantity) }));
  const subtotal = items.reduce((total, item) => total + (item.available ? Number(item.product.price_syp || 0) * item.quantity : 0), 0);
  res.json({ items, subtotal, currency: 'SYP' });
}));

router.post('/', validate({ body: addCartItemSchema }), asyncHandler(async (req, res) => {
  const { productId, quantity } = req.body;
  const { data: product, error: productError } = await supabaseAdmin.from('products').select('id, stock_quantity').eq('id', productId).eq('is_active', true).eq('is_approved', true).eq('status', 'approved').maybeSingle();
  if (productError) throw productError;
  if (!product) throw new AppError(404, 'المنتج غير متاح', 'PRODUCT_UNAVAILABLE');
  const { data: existing, error: existingError } = await supabaseAdmin.from('cart_items').select('id, quantity').eq('user_id', req.user.id).eq('product_id', productId).maybeSingle();
  if (existingError) throw existingError;
  const nextQuantity = Number(existing?.quantity || 0) + quantity;
  if (nextQuantity > product.stock_quantity) throw new AppError(409, 'الكمية المطلوبة أكبر من المخزون المتاح', 'INSUFFICIENT_STOCK');
  const { error } = existing
    ? await supabaseAdmin.from('cart_items').update({ quantity: nextQuantity, updated_at: new Date().toISOString() }).eq('id', existing.id).eq('user_id', req.user.id)
    : await supabaseAdmin.from('cart_items').insert({ user_id: req.user.id, product_id: productId, quantity: nextQuantity });
  if (error?.code === '23505') throw new AppError(409, 'تم تحديث السلة في جلسة أخرى، أعد المحاولة', 'CART_CONFLICT');
  if (error) throw error;
  await audit(req.user.id, 'cart_item_added', 'product', productId, { quantity });
  res.status(201).json({ message: 'تمت إضافة المنتج إلى السلة' });
}));

router.patch('/:itemId', validate({ params: itemIdParamsSchema, body: updateCartItemSchema }), asyncHandler(async (req, res) => {
  const { data: item, error } = await supabaseAdmin.from('cart_items').select('id, product:products(stock_quantity, is_active, is_approved, status)').eq('id', req.params.itemId).eq('user_id', req.user.id).maybeSingle();
  if (error) throw error;
  if (!item) throw new AppError(404, 'عنصر السلة غير موجود', 'CART_ITEM_NOT_FOUND');
  if (!item.product?.is_active || !item.product?.is_approved || item.product?.status !== 'approved') throw new AppError(409, 'المنتج لم يعد متاحاً', 'PRODUCT_UNAVAILABLE');
  if (req.body.quantity > item.product.stock_quantity) throw new AppError(409, 'الكمية المطلوبة أكبر من المخزون المتاح', 'INSUFFICIENT_STOCK');
  const { error: updateError } = await supabaseAdmin.from('cart_items').update({ quantity: req.body.quantity, updated_at: new Date().toISOString() }).eq('id', item.id).eq('user_id', req.user.id);
  if (updateError) throw updateError;
  res.json({ message: 'تم تحديث السلة' });
}));

router.delete('/:itemId', validate({ params: itemIdParamsSchema }), asyncHandler(async (req, res) => {
  const { error } = await supabaseAdmin.from('cart_items').delete().eq('id', req.params.itemId).eq('user_id', req.user.id);
  if (error) throw error;
  res.json({ message: 'تم حذف المنتج من السلة' });
}));

router.delete('/', asyncHandler(async (req, res) => {
  const { error } = await supabaseAdmin.from('cart_items').delete().eq('user_id', req.user.id);
  if (error) throw error;
  await audit(req.user.id, 'cart_cleared', 'cart', req.user.id);
  res.json({ message: 'تم إفراغ السلة' });
}));

export default router;
