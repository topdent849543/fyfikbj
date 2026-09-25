'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { apiError } from '@/lib/format';

const FavoritesContext = createContext(null);

export function FavoritesProvider({ children }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [favorites, setFavorites] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [busyProductId, setBusyProductId] = useState(null);

  const refreshFavorites = useCallback(async () => {
    if (!isAuthenticated) {
      setFavorites([]);
      return;
    }
    setIsLoading(true);
    try {
      const response = await api.get('/favorites');
      setFavorites(response.favorites || []);
    } catch (error) {
      toast.error(apiError(error, 'تعذر تحميل المفضلة.'));
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!authLoading) refreshFavorites();
  }, [authLoading, refreshFavorites]);

  const favoriteIds = useMemo(() => new Set(favorites.map((item) => item.product?.id)), [favorites]);

  const toggleFavorite = useCallback(async (productId) => {
    if (!isAuthenticated) {
      toast.error('سجّل الدخول لحفظ المنتجات في المفضلة.');
      router.push(`/auth/login?next=${encodeURIComponent(pathname || '/')}`);
      return false;
    }
    setBusyProductId(productId);
    const exists = favoriteIds.has(productId);
    try {
      if (exists) {
        await api.delete(`/favorites/${productId}`);
        setFavorites((current) => current.filter((item) => item.product?.id !== productId));
        toast.success('تمت إزالة المنتج من المفضلة.');
      } else {
        await api.post(`/favorites/${productId}`);
        await refreshFavorites();
        toast.success('تم حفظ المنتج في المفضلة.');
      }
      return true;
    } catch (error) {
      toast.error(apiError(error));
      return false;
    } finally {
      setBusyProductId(null);
    }
  }, [favoriteIds, isAuthenticated, pathname, refreshFavorites, router]);

  const value = useMemo(() => ({
    favorites,
    favoriteIds,
    isLoading,
    busyProductId,
    isFavorite: (productId) => favoriteIds.has(productId),
    toggleFavorite,
    refreshFavorites,
  }), [favorites, favoriteIds, isLoading, busyProductId, toggleFavorite, refreshFavorites]);

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (!context) throw new Error('useFavorites must be used inside a FavoritesProvider');
  return context;
}
