import express from 'express';
import { supabase, supabaseAdmin } from '../config/supabase.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';
import { validate } from '../middleware/validate.js';
import { createOrderSchema, idParamsSchema, orderStatusSchema } from '../validation/schemas.js';

const router = express.Router();

// Generate order number
const generateOrderNumber = () => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `ORD-${timestamp}-${random}`;
};

// Create order
router.post('/', verifyToken, requireRole(['customer']), validate({ body: createOrderSchema }), async (req, res) => {
  let pendingOrderId = null;
  try {
    const {
      items,
      deliverySpeed,
      deliveryTimeSlot,
      customerName,
      customerPhone,
      customerWhatsapp,
      province,
      address,
      discountCode,
      notes
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'No items in order' });
    }

    // Calculate totals
    let subtotal = 0;
    const orderItems = [];
    let merchantId = null;
    let currency = null;

    for (const item of items) {
      const { data: product, error: productError } = await supabaseAdmin
        .from('products')
        .select('id, merchant_id, code, name, price, currency, stock_quantity')
        .eq('id', item.productId)
        .eq('is_active', true)
        .eq('is_approved', true)
        .maybeSingle();

      if (productError) throw productError;
      if (!product) {
        return res.status(404).json({ error: `Product ${item.productId} not found` });
      }
      if (item.quantity > product.stock_quantity) {
        return res.status(409).json({ error: `Insufficient stock for product ${product.id}` });
      }

      if (!merchantId) merchantId = product.merchant_id;
      if (merchantId !== product.merchant_id) {
        return res.status(400).json({ error: 'All products in an order must belong to one merchant' });
      }
      if (!currency) currency = product.currency;
      if (currency !== product.currency) {
        return res.status(400).json({ error: 'All products in an order must use one currency' });
      }

      const itemTotal = Number(product.price) * item.quantity;
      subtotal += itemTotal;

      orderItems.push({
        product_id: product.id,
        product_code: product.code,
        product_name: product.name,
        quantity: item.quantity,
        price: product.price
      });
    }

    // Apply discount
    let discountAmount = 0;
    let discount = null;
    if (discountCode) {
      const { data, error: discountError } = await supabaseAdmin
        .from('discount_codes')
        .select('*')
        .eq('code', discountCode)
        .eq('is_active', true)
        .maybeSingle();

      if (discountError) throw discountError;
      discount = data;
      if (!discount) return res.status(400).json({ error: 'Invalid discount code' });
      if (discount.expires_at && new Date(discount.expires_at) <= new Date()) {
        return res.status(400).json({ error: 'Discount code has expired' });
      }
      if (discount.max_uses !== null && discount.current_uses >= discount.max_uses) {
        return res.status(409).json({ error: 'Discount code usage limit reached' });
      }

      discountAmount = discount.discount_amount !== null
        ? Number(discount.discount_amount)
        : subtotal * Number(discount.discount_percentage) / 100;
      discountAmount = Math.min(subtotal, discountAmount);
    }

    // Get delivery cost
    const { data: merchant, error: merchantError } = await supabaseAdmin
      .from('merchants')
      .select('id, province, is_active, is_approved')
      .eq('id', merchantId)
      .maybeSingle();
    if (merchantError) throw merchantError;
    if (!merchant?.is_active || !merchant?.is_approved) {
      return res.status(409).json({ error: 'Merchant is not available' });
    }

    const { data: rates, error: ratesError } = await supabaseAdmin
      .from('delivery_rates')
      .select('*')
      .eq('merchant_id', merchantId)
      .eq('speed', deliverySpeed)
      .maybeSingle();

    if (ratesError) throw ratesError;
    if (!rates) return res.status(400).json({ error: 'Delivery is not configured for the selected speed' });
    const sameProvince = merchant.province?.trim().toLocaleLowerCase('ar') === province.trim().toLocaleLowerCase('ar');
    const deliveryCost = Number(sameProvince ? rates.same_province : rates.other_province);

    const total = Math.max(0, subtotal - discountAmount + deliveryCost);

    // Create order
    const orderNumber = generateOrderNumber();
    const orderId = uuidv4();
    pendingOrderId = orderId;

    const { error: orderError } = await supabaseAdmin
      .from('orders')
      .insert([
        {
          id: orderId,
          order_number: orderNumber,
          user_id: req.user.id,
          merchant_id: merchantId,
          status: 'new',
          payment_status: 'pending',
          subtotal,
          discount_amount: discountAmount,
          delivery_cost: deliveryCost,
          total,
          currency,
          delivery_speed: deliverySpeed,
          delivery_time_slot: deliveryTimeSlot,
          customer_name: customerName,
          customer_phone: customerPhone,
          customer_whatsapp: customerWhatsapp,
          province,
          address,
          discount_code: discountCode,
          notes
        }
      ]);

    if (orderError) throw orderError;

    // Add order items
    const itemInserts = orderItems.map(item => ({
      id: uuidv4(),
      order_id: orderId,
      ...item
    }));

    const { error: itemError } = await supabaseAdmin
      .from('order_items')
      .insert(itemInserts);

    if (itemError) throw itemError;

    if (discount) {
      const { data: consumed, error: consumeError } = await supabaseAdmin.rpc('consume_discount_use', {
        discount_id: discount.id
      });
      if (consumeError) throw consumeError;
      if (!consumed) {
        await supabaseAdmin.from('orders').delete().eq('id', orderId);
        pendingOrderId = null;
        return res.status(409).json({ error: 'Discount code usage limit reached' });
      }
    }

    pendingOrderId = null;

    // Clear cart
    await supabaseAdmin
      .from('cart_items')
      .delete()
      .eq('user_id', req.user.id);

    // Create notification
    await supabaseAdmin
      .from('notifications')
      .insert([
        {
          id: uuidv4(),
          user_id: req.user.id,
          type: 'order_created',
          title: 'تم إنشاء طلبك',
          message: `تم إنشاء طلبك رقم ${orderNumber} بنجاح`,
          related_order_id: orderId
        }
      ]);

    res.status(201).json({
      message: 'Order created successfully',
      orderId,
      orderNumber,
      total
    });
  } catch (error) {
    if (pendingOrderId) {
      await supabaseAdmin.from('orders').delete().eq('id', pendingOrderId);
    }
    res.status(500).json({ error: error.message });
  }
});

// Get customer orders
router.get('/customer/my-orders', verifyToken, requireRole(['customer']), async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    let query = supabase
      .from('orders')
      .select('*')
      .eq('user_id', req.user.id);

    if (status) query = query.eq('status', status);

    query = query.order('created_at', { ascending: false });

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    query = query.range(offset, offset + limitNum - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    res.json({ orders: data, total: count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get order details
router.get('/:id', verifyToken, validate({ params: idParamsSchema }), async (req, res) => {
  try {
    const { data: order, error } = await supabase
      .from('orders')
      .select(`
        *,
        items:order_items(*),
        merchant:merchants(company_name, phone),
        customer:users(full_name, email, phone)
      `)
      .eq('id', req.params.id)
      .single();

    if (error) throw error;

    // Check authorization
    if (req.user.role === 'customer' && order.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    res.json(order);
  } catch (error) {
    res.status(404).json({ error: 'Order not found' });
  }
});

// Update order status (admin/merchant)
router.patch(
  '/:id/status',
  verifyToken,
  validate({ params: idParamsSchema, body: orderStatusSchema }),
  async (req, res) => {
  try {
    const { status } = req.body;

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('merchant_id')
      .eq('id', req.params.id)
      .maybeSingle();

    if (orderError) throw orderError;
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (req.user.role === 'merchant') {
      const { data: merchant, error: merchantError } = await supabase
        .from('merchants')
        .select('id')
        .eq('user_id', req.user.id)
        .maybeSingle();

      if (merchantError) throw merchantError;
      if (!merchant || order.merchant_id !== merchant.id) {
        return res.status(403).json({ error: 'Unauthorized' });
      }
    } else if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { error } = await supabase
      .from('orders')
      .update({ status, updated_at: new Date() })
      .eq('id', req.params.id);

    if (error) throw error;

    res.json({ message: 'Order status updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
  }
);

export default router;
