import crypto from 'crypto';
import { supabaseAdmin } from '../config/supabase.js';

const invoiceNumber = () => `TD-INV-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

export async function ensureInvoiceForOrder(order) {
  const { data: existing, error: existingError } = await supabaseAdmin.from('invoices').select('*').eq('order_id', order.id).maybeSingle();
  if (existingError) throw existingError;
  if (existing) return existing;

  const snapshot = {
    orderNumber: order.order_number,
    customer: order.customer ? { id: order.customer.id, fullName: order.customer.full_name, phone: order.customer.phone } : null,
    company: order.merchant ? { id: order.merchant.id, name: order.merchant.company_name } : null,
    priceSnapshot: order.price_snapshot || {},
    deliverySnapshot: order.delivery_rate_snapshot || {},
    issuedAt: new Date().toISOString()
  };
  const { data: invoice, error } = await supabaseAdmin.from('invoices').insert({
    invoice_number: invoiceNumber(),
    order_id: order.id,
    customer_id: order.user_id,
    company_id: order.merchant_id || null,
    currency: order.currency || 'SYP',
    subtotal: order.subtotal,
    discount_amount: order.discount_amount || 0,
    delivery_cost: order.delivery_cost || 0,
    total: order.total,
    snapshot
  }).select().single();
  if (error?.code === '23505') {
    const { data: racedInvoice, error: raceError } = await supabaseAdmin.from('invoices').select('*').eq('order_id', order.id).single();
    if (raceError) throw raceError;
    return racedInvoice;
  }
  if (error) throw error;

  const items = (order.items || []).map((item) => ({
    invoice_id: invoice.id,
    order_item_id: item.id || null,
    product_id: item.product_id || null,
    name: item.product_name,
    quantity: item.quantity,
    unit_price: item.price_syp ?? item.price,
    line_total: Number(item.price_syp ?? item.price) * Number(item.quantity),
    currency: order.currency || 'SYP',
    snapshot: item.product_snapshot || {}
  }));
  if (items.length) {
    const { error: itemsError } = await supabaseAdmin.from('invoice_items').insert(items);
    if (itemsError) throw itemsError;
  }
  return invoice;
}
