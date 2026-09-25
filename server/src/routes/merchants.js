import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler, AppError, audit, merchantForUser, pageRange } from '../lib/http.js';
import { merchantProfileSchema } from '../validation/schemas.js';

const router = express.Router();
router.use(verifyToken, requireRole(['merchant']));

router.get('/dashboard', asyncHandler(async (req, res) => {
  const merchant = await merchantForUser(req.user.id);
  if (!merchant) throw new AppError(404, 'ملف الشركة غير موجود', 'MERCHANT_NOT_FOUND');
  const [{ data: products, error: productsError }, { data: orders, error: ordersError }] = await Promise.all([
    supabaseAdmin.from('products').select('id, status, stock_quantity').eq('merchant_id', merchant.id),
    supabaseAdmin.from('orders').select('id, status, total, payment_status').eq('merchant_id', merchant.id).eq('order_type', 'merchant')
  ]);
  if (productsError) throw productsError;
  if (ordersError) throw ordersError;
  const orderRows = orders || [];
  res.json({
    merchant,
    stats: {
      totalSales: orderRows.filter((item) => ['payment_received', 'completed', 'archive'].includes(item.status)).reduce((total, item) => total + Number(item.total), 0),
      totalOrders: orderRows.length,
      newOrders: orderRows.filter((item) => ['new', 'pending_review', 'approved'].includes(item.status)).length,
      preparingOrders: orderRows.filter((item) => item.status === 'preparing').length,
      completedOrders: orderRows.filter((item) => ['completed', 'archive'].includes(item.status)).length,
      pendingProducts: (products || []).filter((item) => item.status === 'pending').length,
      lowStockProducts: (products || []).filter((item) => item.stock_quantity <= 3).length
    }
  });
}));

router.get('/products', asyncHandler(async (req, res) => {
  const merchant = await merchantForUser(req.user.id);
  if (!merchant) throw new AppError(404, 'ملف الشركة غير موجود', 'MERCHANT_NOT_FOUND');
  const { page, limit, from, to } = pageRange(req.query.page, req.query.limit);
  let query = supabaseAdmin.from('products').select('*, images:product_images(image_url, is_primary)', { count: 'exact' }).eq('merchant_id', merchant.id);
  if (req.query.status) query = query.eq('status', req.query.status);
  const { data, error, count } = await query.order('created_at', { ascending: false }).range(from, to);
  if (error) throw error;
  res.json({ products: data || [], pagination: { page, limit, total: count || 0, pages: Math.ceil((count || 0) / limit) } });
}));

router.get('/orders', asyncHandler(async (req, res) => {
  const merchant = await merchantForUser(req.user.id);
  if (!merchant) throw new AppError(404, 'ملف الشركة غير موجود', 'MERCHANT_NOT_FOUND');
  const { page, limit, from, to } = pageRange(req.query.page, req.query.limit);
  let query = supabaseAdmin.from('orders').select('*, items:order_items(*), customer:users(full_name, phone, whatsapp, province, area, address)', { count: 'exact' }).eq('merchant_id', merchant.id).eq('order_type', 'merchant');
  if (req.query.status) query = query.eq('status', req.query.status);
  const { data, error, count } = await query.order('created_at', { ascending: false }).range(from, to);
  if (error) throw error;
  res.json({ orders: data || [], pagination: { page, limit, total: count || 0, pages: Math.ceil((count || 0) / limit) } });
}));

router.get('/sales', asyncHandler(async (req, res) => {
  const merchant = await merchantForUser(req.user.id);
  if (!merchant) throw new AppError(404, 'ملف الشركة غير موجود', 'MERCHANT_NOT_FOUND');
  const { data, error } = await supabaseAdmin.from('orders').select('id, order_number, total, currency, status, created_at, completed_at').eq('merchant_id', merchant.id).eq('order_type', 'merchant').in('status', ['payment_received', 'completed', 'archive']).order('created_at', { ascending: false });
  if (error) throw error;
  res.json({ sales: data || [], total: (data || []).reduce((sum, order) => sum + Number(order.total), 0), currency: 'SYP' });
}));

router.put('/profile', validate({ body: merchantProfileSchema }), asyncHandler(async (req, res) => {
  const merchant = await merchantForUser(req.user.id);
  if (!merchant) throw new AppError(404, 'ملف الشركة غير موجود', 'MERCHANT_NOT_FOUND');
  const { error } = await supabaseAdmin.from('merchants').update({
    company_name: req.body.companyName,
    phone: req.body.phone,
    whatsapp: req.body.whatsapp,
    province: req.body.province,
    area: req.body.area,
    description: req.body.description || null,
    logo_url: req.body.logoUrl || null,
    contact_email: req.body.contactEmail || null,
    website_url: req.body.websiteUrl || null,
    contact_details: req.body.contactDetails,
    dollar_rate: req.body.dollarRate,
    updated_at: new Date().toISOString()
  }).eq('id', merchant.id);
  if (error) throw error;
  await audit(req.user.id, 'merchant_profile_updated', 'merchant', merchant.id, { dollarRate: req.body.dollarRate });
  res.json({ message: 'تم تحديث بيانات الشركة. لا تتغير أسعار الطلبات القديمة.' });
}));

export default router;
