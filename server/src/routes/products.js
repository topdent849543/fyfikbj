import express from 'express';
import { supabase } from '../config/supabase.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';
import { validate } from '../middleware/validate.js';
import {
  createProductSchema,
  idParamsSchema,
  productQuerySchema,
  updateProductSchema
} from '../validation/schemas.js';

const router = express.Router();

// Get all products with filters
router.get('/', validate({ query: productQuerySchema }), async (req, res) => {
  try {
    const {
      category,
      subCategory,
      condition,
      province,
      minPrice,
      maxPrice,
      currency,
      sortBy = 'newest',
      page = 1,
      limit = 20,
      search,
      merchantId
    } = req.query;

    let query = supabase
      .from('products')
      .select(`
        *,
        merchant:merchants!inner(company_name, logo_url, province),
        images:product_images(image_url, is_primary)
      `, { count: 'exact' })
      .eq('is_active', true)
      .eq('is_approved', true);

    // Filters
    if (category) query = query.eq('category', category);
    if (subCategory) query = query.eq('sub_category', subCategory);
    if (condition) query = query.eq('condition', condition);
    if (merchantId) query = query.eq('merchant_id', merchantId);
    if (province) query = query.eq('merchant.province', province);
    if (minPrice !== undefined) query = query.gte('price', minPrice);
    if (maxPrice !== undefined) query = query.lte('price', maxPrice);
    if (currency) query = query.eq('currency', currency);
    if (search) query = query.ilike('name', `%${search}%`);

    // Sorting
    switch (sortBy) {
      case 'oldest':
        query = query.order('created_at', { ascending: true });
        break;
      case 'cheapest':
        query = query.order('price', { ascending: true });
        break;
      case 'expensive':
        query = query.order('price', { ascending: false });
        break;
      default:
        query = query.order('created_at', { ascending: false });
    }

    // Pagination
    const pageNum = page;
    const limitNum = limit;
    const offset = (pageNum - 1) * limitNum;

    query = query.range(offset, offset + limitNum - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    res.json({
      products: data,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count ?? 0,
        pages: Math.ceil((count ?? 0) / limitNum)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single product
router.get('/:id', validate({ params: idParamsSchema }), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        merchant:merchants(company_name, logo_url, dollar_rate),
        images:product_images(image_url, is_primary)
      `)
      .eq('id', req.params.id)
      .eq('is_active', true)
      .eq('is_approved', true)
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Product not found' });
    res.json(data);
  } catch (error) {
    res.status(404).json({ error: 'Product not found' });
  }
});

// Create product (merchant)
router.post('/', verifyToken, requireRole(['merchant']), validate({ body: createProductSchema }), async (req, res) => {
  try {
    const {
      name,
      code,
      category,
      subCategory,
      description,
      specifications,
      condition,
      price,
      currency,
      stockQuantity,
      images
    } = req.body;

    // Get merchant
    const { data: merchant } = await supabase
      .from('merchants')
      .select('id')
      .eq('user_id', req.user.id)
      .single();

    if (!merchant) {
      return res.status(404).json({ error: 'Merchant not found' });
    }

    const productId = uuidv4();

    // Create product
    const { error: productError } = await supabase
      .from('products')
      .insert([
        {
          id: productId,
          merchant_id: merchant.id,
          name,
          code: code || `PROD-${Date.now()}`,
          category,
          sub_category: subCategory,
          description,
          specifications,
          condition,
          price,
          currency,
          stock_quantity: stockQuantity,
          is_active: true,
          is_approved: false
        }
      ]);

    if (productError) throw productError;

    // Add images
    if (images?.length) {
      const imageInserts = images.map((img, idx) => ({
        id: uuidv4(),
        product_id: productId,
        image_url: img,
        is_primary: idx === 0
      }));

      const { error: imageError } = await supabase
        .from('product_images')
        .insert(imageInserts);

      if (imageError) throw imageError;
    }

    res.status(201).json({
      message: 'Product created successfully',
      productId
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update product (merchant)
router.put(
  '/:id',
  verifyToken,
  requireRole(['merchant']),
  validate({ params: idParamsSchema, body: updateProductSchema }),
  async (req, res) => {
  try {
    const { name, code, category, subCategory, description, specifications, price, currency, stockQuantity, condition, images } = req.body;

    const { data: product, error: productLookupError } = await supabase
      .from('products')
      .select('merchant_id')
      .eq('id', req.params.id)
      .maybeSingle();

    const { data: merchant, error: merchantLookupError } = await supabase
      .from('merchants')
      .select('id')
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (productLookupError) throw productLookupError;
    if (merchantLookupError) throw merchantLookupError;
    if (!product) return res.status(404).json({ error: 'Product not found' });
    if (!merchant) return res.status(404).json({ error: 'Merchant not found' });

    if (product.merchant_id !== merchant.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const updates = {
      ...(name !== undefined && { name }),
      ...(code !== undefined && { code }),
      ...(category !== undefined && { category }),
      ...(subCategory !== undefined && { sub_category: subCategory }),
      ...(description !== undefined && { description }),
      ...(specifications !== undefined && { specifications }),
      ...(price !== undefined && { price }),
      ...(currency !== undefined && { currency }),
      ...(stockQuantity !== undefined && { stock_quantity: stockQuantity }),
      ...(condition !== undefined && { condition }),
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', req.params.id);

    if (error) throw error;

    if (images !== undefined) {
      const { error: deleteError } = await supabase.from('product_images').delete().eq('product_id', req.params.id);
      if (deleteError) throw deleteError;
      if (images.length > 0) {
        const { error: imageError } = await supabase.from('product_images').insert(images.map((imageUrl, index) => ({
          id: uuidv4(),
          product_id: req.params.id,
          image_url: imageUrl,
          is_primary: index === 0
        })));
        if (imageError) throw imageError;
      }
    }
    res.json({ message: 'Product updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
  }
);

// Delete product (merchant/admin)
router.delete('/:id', verifyToken, validate({ params: idParamsSchema }), async (req, res) => {
  try {
    if (req.user.role === 'merchant') {
      const { data: merchant } = await supabase
        .from('merchants')
        .select('id')
        .eq('user_id', req.user.id)
        .maybeSingle();

      const { data: product } = await supabase
        .from('products')
        .select('merchant_id')
        .eq('id', req.params.id)
        .maybeSingle();

      if (!product) return res.status(404).json({ error: 'Product not found' });
      if (!merchant || product.merchant_id !== merchant.id) {
        return res.status(403).json({ error: 'Unauthorized' });
      }
    } else if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
