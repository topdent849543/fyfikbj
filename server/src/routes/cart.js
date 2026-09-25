import express from 'express';
import { supabase } from '../config/supabase.js';
import { verifyToken } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';
import { validate } from '../middleware/validate.js';
import { addCartItemSchema, itemIdParamsSchema, updateCartItemSchema } from '../validation/schemas.js';

const router = express.Router();

// Get cart items
router.get('/', verifyToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('cart_items')
      .select(`
        *,
        product:products(
          id, name, code, price, currency, stock_quantity, is_active, is_approved,
          images:product_images(image_url, is_primary)
        )
      `)
      .eq('user_id', req.user.id);

    if (error) throw error;
    res.json({ items: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add to cart
router.post('/', verifyToken, validate({ body: addCartItemSchema }), async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;

    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, stock_quantity')
      .eq('id', productId)
      .eq('is_active', true)
      .eq('is_approved', true)
      .maybeSingle();

    if (productError) throw productError;
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const { data: existing, error: existingError } = await supabase
      .from('cart_items')
      .select('id, quantity')
      .eq('user_id', req.user.id)
      .eq('product_id', productId)
      .maybeSingle();

    if (existingError) throw existingError;

    const nextQuantity = (existing?.quantity || 0) + quantity;
    if (nextQuantity > product.stock_quantity) {
      return res.status(409).json({ error: 'Requested quantity exceeds available stock' });
    }

    if (existing) {
      const { error } = await supabase
        .from('cart_items')
        .update({ quantity: nextQuantity, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('cart_items')
        .insert([{
          id: uuidv4(),
          user_id: req.user.id,
          product_id: productId,
          quantity: nextQuantity
        }]);
      if (error?.code === '23505') {
        return res.status(409).json({ error: 'Cart was updated concurrently; please retry' });
      }
      if (error) throw error;
    }

    res.json({ message: 'Item added to cart' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update cart item
router.patch(
  '/:itemId',
  verifyToken,
  validate({ params: itemIdParamsSchema, body: updateCartItemSchema }),
  async (req, res) => {
  try {
    const { quantity } = req.body;

    const { data: item, error: itemError } = await supabase
      .from('cart_items')
      .select('id, product:products(stock_quantity, is_active, is_approved)')
      .eq('id', req.params.itemId)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (itemError) throw itemError;
    if (!item) return res.status(404).json({ error: 'Cart item not found' });
    if (!item.product?.is_active || !item.product?.is_approved) {
      return res.status(409).json({ error: 'Product is no longer available' });
    }
    if (quantity > item.product.stock_quantity) {
      return res.status(409).json({ error: 'Requested quantity exceeds available stock' });
    }

    const { error } = await supabase
      .from('cart_items')
      .update({ quantity, updated_at: new Date().toISOString() })
      .eq('id', req.params.itemId)
      .eq('user_id', req.user.id);

    if (error) throw error;
    res.json({ message: 'Cart updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
  }
);

// Remove from cart
router.delete('/:itemId', verifyToken, validate({ params: itemIdParamsSchema }), async (req, res) => {
  try {
    const { error } = await supabase
      .from('cart_items')
      .delete()
      .eq('id', req.params.itemId)
      .eq('user_id', req.user.id);

    if (error) throw error;
    res.json({ message: 'Item removed from cart' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Clear cart
router.delete('/', verifyToken, async (req, res) => {
  try {
    const { error } = await supabase
      .from('cart_items')
      .delete()
      .eq('user_id', req.user.id);

    if (error) throw error;
    res.json({ message: 'Cart cleared' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
