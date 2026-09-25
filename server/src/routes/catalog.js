import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { asyncHandler, pageRange } from '../lib/http.js';

const router = express.Router();

router.get('/settings', asyncHandler(async (req, res) => {
  const publicKeys = ['social_whatsapp', 'social_facebook', 'social_instagram', 'social_telegram', 'contact_email', 'contact_phone', 'about_text'];
  const { data, error } = await supabaseAdmin.from('settings').select('key, value').in('key', publicKeys);
  if (error) throw error;
  res.json({ settings: Object.fromEntries((data || []).map((item) => [item.key, item.value])) });
}));

router.get('/banners', asyncHandler(async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('banners')
    .select('id, title, image_url, link_url, order_index')
    .eq('is_active', true)
    .order('order_index', { ascending: true });
  if (error) throw error;
  res.json({ banners: data || [] });
}));

router.get('/categories', asyncHandler(async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('categories')
    .select('id, name, description, icon_url, order_index, subCategories:sub_categories(id, name, description)')
    .eq('is_active', true)
    .eq('sub_categories.is_active', true)
    .order('order_index', { ascending: true })
    .order('name', { foreignTable: 'sub_categories', ascending: true });
  if (error) throw error;
  res.json({ categories: data || [] });
}));

router.get('/offers', asyncHandler(async (req, res) => {
  const { page, limit, from, to } = pageRange(req.query.page, req.query.limit);
  const now = new Date().toISOString();
  const { data, error, count } = await supabaseAdmin
    .from('offers')
    .select('*, products:offer_products(product:products(id, name, code, price, currency, images:product_images(image_url, is_primary)))', { count: 'exact' })
    .eq('is_active', true)
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gt.${now}`)
    .order('order_index', { ascending: true })
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) throw error;
  res.json({ offers: data || [], pagination: { page, limit, total: count || 0, pages: Math.ceil((count || 0) / limit) } });
}));

router.get('/offers/:id', asyncHandler(async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('offers')
    .select('*, merchant:merchants(id, company_name, logo_url), products:offer_products(product:products(id, name, code, description, price, currency, condition, images:product_images(image_url, is_primary)))')
    .eq('id', req.params.id)
    .eq('is_active', true)
    .maybeSingle();
  if (error) throw error;
  if (!data) return res.status(404).json({ error: 'العرض غير موجود', code: 'OFFER_NOT_FOUND' });
  return res.json(data);
}));

export default router;
