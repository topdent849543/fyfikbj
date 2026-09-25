'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { apiError } from '@/lib/format';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [busyItemId, setBusyItemId] = useState(null);

  const requireAccount = useCallback(() => {
    if (isAuthenticated) return true;
    toast.error('سجّل الدخول لإضافة المنتجات إلى السلة.');
    router.push(`/auth/login?next=${encodeURIComponent(pathname || '/')}`);
    return false;
  }, [isAuthenticated, pathname, router]);

  const refreshCart = useCallback(async () => {
    if (!isAuthenticated) {
      setItems([]);
      return;
    }
    setIsLoading(true);
    try {
      const response = await api.get('/cart');
      setItems(response.items || []);
    } catch (error) {
      toast.error(apiError(error, 'تعذر تحميل السلة.'));
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!authLoading) refreshCart();
  }, [authLoading, refreshCart]);

  const addToCart = useCallback(async (productId, quantity = 1) => {
    if (!requireAccount()) return false;
    setBusyItemId(productId);
    try {
      await api.post('/cart', { productId, quantity });
      await refreshCart();
      toast.success('تمت إضافة المنتج إلى السلة.');
      return true;
    } catch (error) {
      toast.error(apiError(error));
      return false;
    } finally {
      setBusyItemId(null);
    }
  }, [refreshCart, requireAccount]);

  const updateQuantity = useCallback(async (itemId, quantity) => {
    setBusyItemId(itemId);
    try {
      await api.patch(`/cart/${itemId}`, { quantity });
      await refreshCart();
    } catch (error) {
      toast.error(apiError(error));
    } finally {
      setBusyItemId(null);
    }
  }, [refreshCart]);

  const removeItem = useCallback(async (itemId) => {
    setBusyItemId(itemId);
    try {
      await api.delete(`/cart/${itemId}`);
      setItems((current) => current.filter((item) => item.id !== itemId));
      toast.success('تم حذف المنتج من السلة.');
    } catch (error) {
      toast.error(apiError(error));
    } finally {
      setBusyItemId(null);
    }
  }, []);

  const clearCart = useCallback(async () => {
    setIsLoading(true);
    try {
      await api.delete('/cart');
      setItems([]);
      toast.success('تم إفراغ السلة.');
    } catch (error) {
      toast.error(apiError(error));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const value = useMemo(() => ({
    items,
    isLoading,
    busyItemId,
    itemCount: items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    addToCart,
    updateQuantity,
    removeItem,
    clearCart,
    refreshCart,
  }), [items, isLoading, busyItemId, addToCart, updateQuantity, removeItem, clearCart, refreshCart]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used inside a CartProvider');
  return context;
}
