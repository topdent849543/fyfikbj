import crypto from 'crypto';
import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler, AppError, audit, normalizeArabic, pageRange, notify } from '../lib/http.js';
import { assertOrderAccess, getOrderWithRelations, transitionOrder } from '../lib/orderWorkflow.js';
import { assignDriverSchema, createOrderSchema, driverProofSchema, idParamsSchema, moneyReceiptSchema, orderQuoteSchema, orderStatusSchema } from '../validation/schemas.js';

const router = express.Router();
const nowIso = () => new Date().toISOString();
const orderNumber = (prefix = 'TD') => `${prefix}-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

function asNumber(value) {
  return Number(value || 0);
}

function safeProductSnapshot(product) {
  return {
    id: product.id,
    name: product.name,
    code: product.code,
    condition: product.condition,
    category: product.category,
    originalPrice: asNumber(product.price),
    currency: product.currency,
    priceSyp: asNumber(product.price_syp),
    dollarRateSnapshot: product.dollar_rate_snapshot,
    manufacturer: product.manufacturer,
    countryOfOrigin: product.country_of_origin,
    warrantyDetails: product.warranty_details,
    images: product.images || []
  };
}

async function collectCheckoutLines(items) {
  const productIds = items.map((item) => item.productId);
  const { data: products, error } = await supabaseAdmin.from('products').select(`
    *, merchant:merchants!inner(id, user_id, company_name, province, area, dollar_rate, is_active, is_approved, approval_status), images:product_images(image_url, is_primary)
  `).in('id', productIds).eq('is_active', true).eq('is_approved', true).eq('status', 'approved');
  if (error) throw error;
  if ((products || []).length !== items.length) throw new AppError(404, 'أحد المنتجات لم يعد متاحاً', 'PRODUCT_UNAVAILABLE');
  const byId = new Map(products.map((product) => [product.id, product]));
  return items.map((item) => {
    const product = byId.get(item.productId);
    if (!product) throw new AppError(404, 'أحد المنتجات لم يعد متاحاً', 'PRODUCT_UNAVAILABLE');
    if (item.quantity > product.stock_quantity) throw new AppError(409, `المخزون غير كافٍ للمنتج: ${product.name}`, 'INSUFFICIENT_STOCK');
    if (!product.merchant.is_active || !product.merchant.is_approved || product.merchant.approval_status !== 'approved') {
      throw new AppError(409, 'الشركة البائعة غير متاحة حالياً', 'MERCHANT_UNAVAILABLE');
    }
    return { ...item, product, unitSyp: asNumber(product.price_syp), lineSyp: asNumber(product.price_syp) * item.quantity };
  });
}

async function deliveryQuoteForMerchant(merchant, deliverySpeed, province) {
  const { data: rate, error } = await supabaseAdmin.from('delivery_rates').select('*').eq('merchant_id', merchant.id).eq('speed', deliverySpeed).maybeSingle();
  if (error) throw error;
  if (!rate) throw new AppError(400, `خدمة التوصيل غير مهيأة لدى ${merchant.company_name} للسرعة المطلوبة`, 'DELIVERY_NOT_CONFIGURED');
  const sameProvince = normalizeArabic(merchant.province) === normalizeArabic(province);
  const cost = asNumber(sameProvince ? rate.same_province : rate.other_province);
  return { cost, snapshot: { speed: deliverySpeed, sameProvince, merchantProvince: merchant.province, customerProvince: province, cost, capturedAt: nowIso() } };
}

async function eligibleDiscount(discountCode, userId, lines) {
  if (!discountCode) return null;
  const { data: discount, error } = await supabaseAdmin.from('discount_codes').select('*, products:discount_code_products(product_id)').eq('code', discountCode).eq('is_active', true).maybeSingle();
  if (error) throw error;
  if (!discount) throw new AppError(400, 'رمز الخصم غير صالح', 'INVALID_DISCOUNT');
  const current = new Date();
  if ((discount.starts_at && new Date(discount.starts_at) > current) || (discount.expires_at && new Date(discount.expires_at) <= current)) throw new AppError(400, 'رمز الخصم غير متاح في هذا الوقت', 'DISCOUNT_INACTIVE');
  const scopedProducts = new Set((discount.products || []).map((link) => link.product_id));
  const eligibleLines = lines.filter((line) => {
    const merchantMatches = !discount.merchant_id || discount.merchant_id === line.product.merchant_id;
    const productMatches = scopedProducts.size === 0 || scopedProducts.has(line.product.id);
    return merchantMatches && productMatches;
  });
  const eligibleSubtotal = eligibleLines.reduce((total, line) => total + line.lineSyp, 0);
  if (!eligibleLines.length) throw new AppError(400, 'رمز الخصم لا ينطبق على منتجات السلة', 'DISCOUNT_NOT_APPLICABLE');
  if (eligibleSubtotal < asNumber(discount.min_order_amount)) throw new AppError(400, 'لم يصل الطلب إلى الحد الأدنى لاستخدام رمز الخصم', 'DISCOUNT_MINIMUM_NOT_MET');
  const amount = discount.discount_amount !== null ? Math.min(eligibleSubtotal, asNumber(discount.discount_amount)) : eligibleSubtotal * asNumber(discount.discount_percentage) / 100;
  return { discount, eligibleLines, eligibleSubtotal, amount };
}

function groupLines(lines) {
  const groups = new Map();
  for (const line of lines) {
    const merchantId = line.product.merchant_id;
    if (!groups.has(merchantId)) groups.set(merchantId, { merchant: line.product.merchant, lines: [] });
    groups.get(merchantId).lines.push(line);
  }
  return [...groups.values()];
}

async function buildQuote({ items, deliverySpeed, province, discountCode, userId }) {
  const lines = await collectCheckoutLines(items);
  const groups = groupLines(lines);
  const discountInfo = await eligibleDiscount(discountCode, userId, lines);
  const merchantQuotes = [];
  for (const group of groups) {
    const delivery = await deliveryQuoteForMerchant(group.merchant, deliverySpeed, province);
    const subtotal = group.lines.reduce((total, line) => total + line.lineSyp, 0);
    const eligibleSubtotal = discountInfo ? group.lines.filter((line) => discountInfo.eligibleLines.includes(line)).reduce((total, line) => total + line.lineSyp, 0) : 0;
    const discountAmount = discountInfo && eligibleSubtotal ? discountInfo.amount * (eligibleSubtotal / discountInfo.eligibleSubtotal) : 0;
    merchantQuotes.push({
      merchant: group.merchant,
      lines: group.lines,
      subtotal,
      discountAmount,
      delivery,
      total: subtotal - discountAmount + delivery.cost
    });
  }
  const subtotal = merchantQuotes.reduce((total, quote) => total + quote.subtotal, 0);
  const discountAmount = merchantQuotes.reduce((total, quote) => total + quote.discountAmount, 0);
  const deliveryCost = merchantQuotes.reduce((total, quote) => total + quote.delivery.cost, 0);
  return { lines, merchantQuotes, discountInfo, subtotal, discountAmount, deliveryCost, total: subtotal - discountAmount + deliveryCost };
}

router.post('/quote', verifyToken, requireRole(['customer']), validate({ body: orderQuoteSchema }), asyncHandler(async (req, res) => {
  const quote = await buildQuote({ ...req.body, userId: req.user.id });
  res.json({
    currency: 'SYP', subtotal: quote.subtotal, discountAmount: quote.discountAmount, deliveryCost: quote.deliveryCost, total: quote.total,
    merchants: quote.merchantQuotes.map((entry) => ({ merchantId: entry.merchant.id, merchantName: entry.merchant.company_name, subtotal: entry.subtotal, discountAmount: entry.discountAmount, deliveryCost: entry.delivery.cost, total: entry.total, delivery: entry.delivery.snapshot }))
  });
}));

router.post('/', verifyToken, requireRole(['customer']), validate({ body: createOrderSchema }), asyncHandler(async (req, res) => {
  const request = req.body;
  const quote = await buildQuote({ ...request, userId: req.user.id });
  const reserved = [];
  const createdOrderIds = [];
  let discountConsumed = false;
  let parentOrderId = null;
  try {
    for (const line of quote.lines) {
      const { data: reservedStock, error } = await supabaseAdmin.rpc('reserve_product_stock', { product_uuid: line.product.id, requested_quantity: line.quantity });
      if (error) throw error;
      if (!reservedStock) throw new AppError(409, `تم تحديث المخزون، لم تعد الكمية متاحة للمنتج: ${line.product.name}`, 'INSUFFICIENT_STOCK');
      reserved.push(line);
    }

    const parentNumber = orderNumber('TDP');
    const parent = {
      order_number: parentNumber,
      user_id: req.user.id,
      merchant_id: null,
      parent_order_id: null,
      order_type: 'parent',
      status: 'new',
      payment_status: request.paymentMethod === 'external_transfer' ? 'pending' : 'pending',
      subtotal: quote.subtotal,
      discount_amount: quote.discountAmount,
      delivery_cost: quote.deliveryCost,
      total: quote.total,
      currency: 'SYP',
      delivery_speed: request.deliverySpeed,
      delivery_time_slot: request.deliveryTimeSlot || null,
      customer_name: request.customerName,
      customer_phone: request.customerPhone,
      customer_whatsapp: request.customerWhatsapp || null,
      province: request.province,
      address: request.address,
      university_clinic: request.universityClinic || null,
      payment_method: request.paymentMethod,
      payment_reference: request.paymentReference || null,
      discount_code: request.discountCode || null,
      notes: request.notes || null,
      price_snapshot: { currency: 'SYP', subtotal: quote.subtotal, discount: quote.discountAmount, delivery: quote.deliveryCost, total: quote.total, capturedAt: nowIso() }
    };
    const { data: parentOrder, error: parentError } = await supabaseAdmin.from('orders').insert(parent).select().single();
    if (parentError) throw parentError;
    parentOrderId = parentOrder.id;
    createdOrderIds.push(parentOrder.id);

    for (const group of quote.merchantQuotes) {
      const childNumber = orderNumber('TDM');
      const child = {
        order_number: childNumber,
        user_id: req.user.id,
        merchant_id: group.merchant.id,
        parent_order_id: parentOrder.id,
        order_type: 'merchant',
        status: 'new',
        payment_status: 'pending',
        subtotal: group.subtotal,
        discount_amount: group.discountAmount,
        delivery_cost: group.delivery.cost,
        total: group.total,
        currency: 'SYP',
        delivery_speed: request.deliverySpeed,
        delivery_time_slot: request.deliveryTimeSlot || null,
        customer_name: request.customerName,
        customer_phone: request.customerPhone,
        customer_whatsapp: request.customerWhatsapp || null,
        province: request.province,
        address: request.address,
        university_clinic: request.universityClinic || null,
        payment_method: request.paymentMethod,
        payment_reference: request.paymentReference || null,
        discount_code: group.discountAmount ? request.discountCode || null : null,
        notes: request.notes || null,
        delivery_rate_snapshot: group.delivery.snapshot,
        price_snapshot: { currency: 'SYP', subtotal: group.subtotal, discount: group.discountAmount, delivery: group.delivery.cost, total: group.total, capturedAt: nowIso() }
      };
      const { data: childOrder, error: childError } = await supabaseAdmin.from('orders').insert(child).select().single();
      if (childError) throw childError;
      createdOrderIds.push(childOrder.id);
      const entries = group.lines.map((line) => ({
        order_id: childOrder.id,
        product_id: line.product.id,
        product_code: line.product.code,
        product_name: line.product.name,
        quantity: line.quantity,
        price: asNumber(line.product.price),
        original_price: asNumber(line.product.price),
        price_syp: line.unitSyp,
        currency: line.product.currency,
        dollar_rate_snapshot: line.product.dollar_rate_snapshot,
        product_snapshot: safeProductSnapshot(line.product)
      }));
      const { error: itemsError } = await supabaseAdmin.from('order_items').insert(entries);
      if (itemsError) throw itemsError;
      await supabaseAdmin.from('order_status_history').insert({ order_id: childOrder.id, from_status: null, to_status: 'new', changed_by: req.user.id, reason: 'إنشاء الطلب' });
      await notify(group.merchant.user_id, 'new_order', 'طلب جديد', `لديك طلب جديد رقم ${childNumber}`, childOrder.id);
    }
    await supabaseAdmin.from('order_status_history').insert({ order_id: parentOrder.id, from_status: null, to_status: 'new', changed_by: req.user.id, reason: 'إنشاء الطلب المجمع' });

    if (quote.discountInfo) {
      const { data: consumed, error } = await supabaseAdmin.rpc('consume_discount_for_user', { discount_uuid: quote.discountInfo.discount.id, customer_uuid: req.user.id, parent_order_uuid: parentOrder.id });
      if (error) throw error;
      if (!consumed) throw new AppError(409, 'تم استنفاد رمز الخصم، أعد المحاولة دون الرمز أو برمز آخر', 'DISCOUNT_LIMIT_REACHED');
      discountConsumed = true;
    }

    if (request.paymentMethod === 'external_transfer') {
      const { error } = await supabaseAdmin.from('external_payments').insert({
        order_id: parentOrder.id, provider: request.paymentProvider, transaction_reference: request.paymentReference,
        amount: quote.total, currency: 'SYP', receipt_url: request.paymentReceiptUrl || null, status: 'pending'
      });
      if (error) throw error;
    }
    const { error: cartError } = await supabaseAdmin.from('cart_items').delete().eq('user_id', req.user.id).in('product_id', quote.lines.map((line) => line.product.id));
    if (cartError) throw cartError;
    await notify(req.user.id, 'order_created', 'تم إنشاء طلبك', `تم إنشاء الطلب رقم ${parentNumber} بنجاح`, parentOrder.id);
    await audit(req.user.id, 'order_created', 'order', parentOrder.id, { merchantOrders: quote.merchantQuotes.length, total: quote.total, currency: 'SYP' });
    res.status(201).json({ message: 'تم إنشاء الطلب بنجاح', orderId: parentOrder.id, orderNumber: parentNumber, total: quote.total, currency: 'SYP', merchantOrderCount: quote.merchantQuotes.length });
  } catch (error) {
    if (discountConsumed && quote.discountInfo && parentOrderId) await supabaseAdmin.rpc('release_discount_use', { discount_uuid: quote.discountInfo.discount.id, parent_order_uuid: parentOrderId });
    if (createdOrderIds.length) await supabaseAdmin.from('orders').delete().in('id', createdOrderIds);
    for (const line of reserved) await supabaseAdmin.rpc('release_product_stock', { product_uuid: line.product.id, released_quantity: line.quantity });
    throw error;
  }
}));

router.get('/customer/my-orders', verifyToken, requireRole(['customer']), asyncHandler(async (req, res) => {
  const { page, limit, from, to } = pageRange(req.query.page, req.query.limit);
  let query = supabaseAdmin.from('orders').select('*, children:orders!parent_order_id(id, order_number, merchant_id, status, payment_status, total, currency, merchant:merchants(company_name))', { count: 'exact' }).eq('user_id', req.user.id).eq('order_type', 'parent');
  if (req.query.status) query = query.eq('status', req.query.status);
  const { data, error, count } = await query.order('created_at', { ascending: false }).range(from, to);
  if (error) throw error;
  res.json({ orders: data || [], pagination: { page, limit, total: count || 0, pages: Math.ceil((count || 0) / limit) } });
}));

router.get('/manager/queue', verifyToken, requireRole(['manager', 'admin']), asyncHandler(async (req, res) => {
  const { page, limit, from, to } = pageRange(req.query.page, req.query.limit);
  let query = supabaseAdmin.from('orders').select('*, customer:users(full_name, phone, province, address), merchant:merchants(company_name), items:order_items(*)', { count: 'exact' }).eq('order_type', 'merchant');
  if (req.query.status) query = query.eq('status', req.query.status);
  if (req.query.paymentStatus) query = query.eq('payment_status', req.query.paymentStatus);
  const { data, error, count } = await query.order('created_at', { ascending: false }).range(from, to);
  if (error) throw error;
  res.json({ orders: data || [], pagination: { page, limit, total: count || 0, pages: Math.ceil((count || 0) / limit) } });
}));

router.get('/driver/assignments', verifyToken, requireRole(['driver']), asyncHandler(async (req, res) => {
  const { data: driver, error: driverError } = await supabaseAdmin.from('driver_profiles').select('id').eq('user_id', req.user.id).maybeSingle();
  if (driverError) throw driverError;
  if (!driver) throw new AppError(404, 'ملف السائق غير موجود', 'DRIVER_NOT_FOUND');
  const { data, error } = await supabaseAdmin.from('orders').select('*, customer:users(full_name, phone, whatsapp, province, address), merchant:merchants(company_name, phone), items:order_items(*)').eq('assigned_driver_id', driver.id).in('status', ['assigned_to_driver', 'in_delivery', 'arrived']).order('created_at', { ascending: false });
  if (error) throw error;
  res.json({ orders: data || [] });
}));

router.get('/:id', verifyToken, validate({ params: idParamsSchema }), asyncHandler(async (req, res) => {
  const order = await getOrderWithRelations(req.params.id);
  await assertOrderAccess(order, req.user);
  const { data: history, error } = await supabaseAdmin.from('order_status_history').select('*, actor:users(full_name, role)').eq('order_id', order.id).order('created_at');
  if (error) throw error;
  res.json({ ...order, history: history || [] });
}));

router.patch('/:id/status', verifyToken, validate({ params: idParamsSchema, body: orderStatusSchema }), asyncHandler(async (req, res) => {
  const order = await getOrderWithRelations(req.params.id);
  await assertOrderAccess(order, req.user);
  const updated = await transitionOrder({ order, actor: req.user, toStatus: req.body.status, reason: req.body.reason });
  res.json({ message: 'تم تحديث حالة الطلب', order: updated });
}));

router.post('/:id/assign-driver', verifyToken, requireRole(['manager', 'admin']), validate({ params: idParamsSchema, body: assignDriverSchema }), asyncHandler(async (req, res) => {
  const order = await getOrderWithRelations(req.params.id);
  if (order.order_type !== 'merchant') throw new AppError(400, 'يجب تعيين السائق لطلب شركة فرعي', 'PARENT_ORDER_NOT_DELIVERABLE');
  const { data: driver, error } = await supabaseAdmin.from('driver_profiles').select('*, user:users(id, full_name, is_active)').eq('id', req.body.driverId).maybeSingle();
  if (error) throw error;
  if (!driver?.is_available || !driver.user?.is_active) throw new AppError(409, 'السائق غير متاح', 'DRIVER_UNAVAILABLE');
  const updated = await transitionOrder({ order, actor: req.user, toStatus: 'assigned_to_driver', reason: req.body.note, extra: { assigned_driver_id: driver.id } });
  const { error: assignmentError } = await supabaseAdmin.from('driver_assignments').insert({ order_id: order.id, driver_id: driver.id, assigned_by: req.user.id, notes: req.body.note || null });
  if (assignmentError) throw assignmentError;
  await notify(driver.user.id, 'driver_assignment', 'مهمة توصيل جديدة', `تم تعيين الطلب ${order.order_number} لك`, order.id);
  res.json({ message: 'تم تعيين السائق', order: updated });
}));

async function driverTransition(req, res, status, noteAction) {
  const order = await getOrderWithRelations(req.params.id);
  await assertOrderAccess(order, req.user);
  const assignmentUpdate = status === 'in_delivery' ? { accepted_at: nowIso() } : status === 'arrived' ? { arrived_at: nowIso() } : { delivered_at: nowIso(), notes: req.body.note || null, proof_url: req.body.proofUrl || null };
  const { error } = await supabaseAdmin.from('driver_assignments').update(assignmentUpdate).eq('order_id', order.id).eq('active', true);
  if (error) throw error;
  const updated = await transitionOrder({ order, actor: req.user, toStatus: status, reason: req.body.note });
  await audit(req.user.id, noteAction, 'order', order.id, { proofUrl: req.body.proofUrl || null });
  res.json({ message: 'تم تحديث مهمة التوصيل', order: updated });
}

router.post('/:id/driver/accept', verifyToken, requireRole(['driver']), validate({ params: idParamsSchema, body: driverProofSchema }), asyncHandler((req, res) => driverTransition(req, res, 'in_delivery', 'driver_assignment_accepted')));
router.post('/:id/driver/arrive', verifyToken, requireRole(['driver']), validate({ params: idParamsSchema, body: driverProofSchema }), asyncHandler((req, res) => driverTransition(req, res, 'arrived', 'driver_arrived')));
router.post('/:id/driver/deliver', verifyToken, requireRole(['driver']), validate({ params: idParamsSchema, body: driverProofSchema }), asyncHandler((req, res) => driverTransition(req, res, 'delivered', 'driver_delivered')));

router.post('/:id/driver/cash-collected', verifyToken, requireRole(['driver']), validate({ params: idParamsSchema, body: moneyReceiptSchema }), asyncHandler(async (req, res) => {
  const order = await getOrderWithRelations(req.params.id);
  await assertOrderAccess(order, req.user);
  const updated = await transitionOrder({ order, actor: req.user, toStatus: 'awaiting_payment', reason: req.body.notes });
  const { error } = await supabaseAdmin.from('money_receipts').insert({ order_id: order.id, received_by: req.user.id, recipient_name: req.body.recipientName, amount: req.body.amount, currency: req.body.currency, notes: req.body.notes || null, proof_url: req.body.proofUrl || null });
  if (error) throw error;
  res.json({ message: 'تم تسجيل استلام الأموال بانتظار تأكيد الإدارة', order: updated });
}));

router.post('/:id/receipt', verifyToken, requireRole(['manager', 'admin']), validate({ params: idParamsSchema, body: moneyReceiptSchema }), asyncHandler(async (req, res) => {
  const order = await getOrderWithRelations(req.params.id);
  const updated = await transitionOrder({ order, actor: req.user, toStatus: 'payment_received', reason: req.body.notes, extra: { payment_status: 'received' } });
  const { error } = await supabaseAdmin.from('money_receipts').insert({ order_id: order.id, received_by: req.user.id, recipient_name: req.body.recipientName, amount: req.body.amount, currency: req.body.currency, notes: req.body.notes || null, proof_url: req.body.proofUrl || null });
  if (error) throw error;
  res.json({ message: 'تم تأكيد استلام الأموال', order: updated });
}));

export default router;
