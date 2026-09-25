import express from 'express';
import { supabase } from '../config/supabase.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';
import { validate } from '../middleware/validate.js';
import { createDiscountSchema } from '../validation/schemas.js';

const router = express.Router();

// Dashboard
router.get('/dashboard', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    const { data: users } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'customer');

    const { data: merchants } = await supabase
      .from('merchants')
      .select('id');

    const { data: products } = await supabase
      .from('products')
      .select('id');

    const { data: orders } = await supabase
      .from('orders')
      .select('*');

    const stats = {
      totalUsers: users?.length || 0,
      totalMerchants: merchants?.length || 0,
      totalProducts: products?.length || 0,
      totalOrders: orders?.length || 0,
      totalRevenue: orders?.reduce((sum, o) => sum + o.total, 0) || 0,
      newOrders: orders?.filter(o => o.status === 'new').length || 0,
      pendingPayments: orders?.filter(o => o.payment_status === 'pending').length || 0
    };

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Manage merchants
router.get('/merchants', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('merchants')
      .select('*');

    if (error) throw error;
    res.json({ merchants: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Approve/reject merchant
router.patch('/merchants/:id/approval', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    const { isApproved } = req.body;

    const { error } = await supabase
      .from('merchants')
      .update({ is_approved: isApproved })
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ message: 'Merchant status updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Manage products
router.get('/products', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*');

    if (error) throw error;
    res.json({ products: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Approve product
router.patch('/products/:id/approval', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    const { isApproved } = req.body;

    const { error } = await supabase
      .from('products')
      .update({ is_approved: isApproved })
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ message: 'Product approval updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Manage orders
router.get('/orders', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    const { status, paymentStatus } = req.query;

    let query = supabase
      .from('orders')
      .select(`
        *,
        customer:users(full_name, email),
        merchant:merchants(company_name),
        items:order_items(*)
      `);

    if (status) query = query.eq('status', status);
    if (paymentStatus) query = query.eq('payment_status', paymentStatus);

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ orders: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Confirm payment
router.patch('/orders/:id/payment', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    const { error } = await supabase
      .from('orders')
      .update({ payment_status: 'received', status: 'completed' })
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ message: 'Payment confirmed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create discount code
router.post(
  '/discounts',
  verifyToken,
  requireRole(['admin']),
  validate({ body: createDiscountSchema }),
  async (req, res) => {
  try {
    const { code, discountPercentage, discountAmount, maxUses, expiresAt } = req.body;

    const { error } = await supabase
      .from('discount_codes')
      .insert([{
        id: uuidv4(),
        code,
        discount_percentage: discountPercentage,
        discount_amount: discountAmount,
        max_uses: maxUses,
        current_uses: 0,
        expires_at: expiresAt?.toISOString() || null,
        is_active: true
      }]);

    if (error) throw error;
    res.status(201).json({ message: 'Discount code created' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
  }
);

// Manage banners
router.get('/banners', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('banners')
      .select('*')
      .order('order_index', { ascending: true });

    if (error) throw error;
    res.json({ banners: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create banner
router.post('/banners', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    const { title, imageUrl, linkUrl, orderIndex } = req.body;

    const { error } = await supabase
      .from('banners')
      .insert([{
        id: uuidv4(),
        title,
        image_url: imageUrl,
        link_url: linkUrl,
        order_index: orderIndex
      }]);

    if (error) throw error;
    res.status(201).json({ message: 'Banner created' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
