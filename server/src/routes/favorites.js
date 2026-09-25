import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '../config/supabase.js';
import { verifyToken } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { productIdParamsSchema } from '../validation/schemas.js';

const router = express.Router();

router.use(verifyToken);

router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('favorites')
      .select(`
        id, created_at,
        product:products!inner(
          id, name, code, price, currency, stock_quantity, condition,
          merchant:merchants(company_name, logo_url),
          images:product_images(image_url, is_primary)
        )
      `)
      .eq('user_id', req.user.id)
      .eq('product.is_active', true)
      .eq('product.is_approved', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ favorites: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

async function addFavorite(req, res) {
  try {
    const { productId } = req.params;
    const { data: product, error: productError } = await supabaseAdmin
      .from('products')
      .select('id')
      .eq('id', productId)
      .eq('is_active', true)
      .eq('is_approved', true)
      .maybeSingle();

    if (productError) throw productError;
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const { data: existing, error: existingError } = await supabaseAdmin
      .from('favorites')
      .select('id')
      .eq('user_id', req.user.id)
      .eq('product_id', productId)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existing) return res.json({ message: 'Product already in favorites', favoriteId: existing.id });

    const favoriteId = uuidv4();
    const { error } = await supabaseAdmin.from('favorites').insert({
      id: favoriteId,
      user_id: req.user.id,
      product_id: productId
    });

    if (error?.code === '23505') {
      return res.json({ message: 'Product already in favorites' });
    }
    if (error) throw error;

    res.status(201).json({ message: 'Product added to favorites', favoriteId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

router.post('/:productId', validate({ params: productIdParamsSchema }), addFavorite);

router.delete('/:productId', validate({ params: productIdParamsSchema }), async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('favorites')
      .delete()
      .eq('user_id', req.user.id)
      .eq('product_id', req.params.productId);

    if (error) throw error;
    res.json({ message: 'Product removed from favorites' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
