'use client';

import RequireAuth from '@/components/RequireAuth';
import ProductCard from '@/components/ProductCard';
import { useFavorites } from '@/context/FavoritesContext';

function FavoritesContent() { const { favorites, isLoading } = useFavorites(); const products = favorites.map((item) => item.product).filter(Boolean); return <div className="min-h-screen bg-secondary-50 py-8"><div className="container-main"><h1 className="text-3xl font-black">المفضلة</h1>{isLoading ? <p className="mt-8">جارٍ تحميل المفضلة...</p> : products.length ? <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{products.map((product) => <ProductCard key={product.id} product={product} />)}</div> : <div className="mt-8 rounded-2xl bg-white p-10 text-center shadow-card">لا توجد منتجات محفوظة في المفضلة بعد.</div>}</div></div>; }
export default function FavoritesPage() { return <RequireAuth><FavoritesContent /></RequireAuth>; }
