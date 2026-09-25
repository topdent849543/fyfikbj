'use client';

import Link from 'next/link';
import { FiHeart, FiShoppingCart } from 'react-icons/fi';
import ProductImage from '@/components/ProductImage';
import { useCart } from '@/context/CartContext';
import { useFavorites } from '@/context/FavoritesContext';
import { formatMoney } from '@/lib/format';

export default function ProductCard({ product, delay = 0 }) {
  const { addToCart, busyItemId } = useCart();
  const { isFavorite, toggleFavorite, busyProductId } = useFavorites();
  const image = product.images?.find((item) => item.is_primary)?.image_url || product.images?.[0]?.image_url;
  const soldOut = Number(product.stock_quantity) < 1;
  const saved = isFavorite(product.id);

  return (
    <article className="card-hover flex h-full flex-col overflow-hidden rounded-2xl border border-secondary-100 bg-white" style={{ animationDelay: `${delay}s` }}>
      <div className="group relative h-60 overflow-hidden bg-secondary-100">
        <Link href={`/products/${product.id}`} aria-label={`عرض ${product.name}`}>
          <ProductImage src={image} alt={product.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
        </Link>
        <button
          type="button"
          onClick={() => toggleFavorite(product.id)}
          disabled={busyProductId === product.id}
          aria-label={saved ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'}
          className={`absolute right-4 top-4 rounded-full p-2.5 shadow-lg transition-colors disabled:opacity-60 ${saved ? 'bg-red-500 text-white' : 'bg-white text-secondary-700 hover:bg-red-50 hover:text-red-600'}`}
        >
          <FiHeart className={saved ? 'fill-current' : ''} />
        </button>
        <span className={`absolute left-4 top-4 rounded-full px-3 py-1 text-xs font-bold ${product.condition === 'new' ? 'bg-primary-600 text-white' : 'bg-amber-100 text-amber-800'}`}>
          {product.condition === 'new' ? 'جديد' : 'مستعمل'}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <Link href={`/products/${product.id}`} className="mb-2 line-clamp-2 min-h-12 font-bold text-secondary-900 transition-colors hover:text-primary-600">
          {product.name}
        </Link>
        <p className="mb-4 text-xs text-secondary-500">{product.merchant?.company_name || 'متجر معتمد'}</p>
        <div className="mt-auto">
          <div className="mb-4 text-xl font-bold text-primary-700">{formatMoney(product.price, product.currency)}</div>
          <button
            type="button"
            onClick={() => addToCart(product.id)}
            disabled={soldOut || busyItemId === product.id}
            className="btn-primary w-full disabled:cursor-not-allowed disabled:bg-secondary-300"
          >
            <FiShoppingCart className="ml-2" />
            {soldOut ? 'نفد المخزون' : busyItemId === product.id ? 'جارٍ الإضافة...' : 'أضف للسلة'}
          </button>
        </div>
      </div>
    </article>
  );
}
