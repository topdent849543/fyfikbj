'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { FiShoppingCart, FiHeart, FiFilter, FiX } from 'react-icons/fi';
import api from '@/lib/api';

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(true);
  const [filters, setFilters] = useState({
    category: '',
    condition: '',
    minPrice: '',
    maxPrice: '',
    sortBy: 'newest'
  });

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      
      if (filters.category) queryParams.append('category', filters.category);
      if (filters.condition) queryParams.append('condition', filters.condition);
      if (filters.minPrice) queryParams.append('minPrice', filters.minPrice);
      if (filters.maxPrice) queryParams.append('maxPrice', filters.maxPrice);
      queryParams.append('sortBy', filters.sortBy);

      const response = await api.get(`/products?${queryParams}`);
      setProducts(response.products);
    } catch (error) {
      console.error('Failed to fetch products', error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="min-h-screen bg-secondary-50">
      <div className="container-main py-8">
        <h1 className="section-title mb-8">جميع المنتجات</h1>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Filters */}
          <div className={`lg:col-span-1 ${showFilters ? '' : 'hidden lg:block'}`}>
            <div className="bg-white rounded-xl p-6 sticky top-24">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-lg">الفلترة</h3>
                <button
                  onClick={() => setShowFilters(false)}
                  className="lg:hidden p-1 hover:bg-secondary-100 rounded"
                >
                  <FiX />
                </button>
              </div>

              <div className="space-y-6">
                {/* Category Filter */}
                <div>
                  <label className="block font-medium mb-3 text-secondary-900">القسم</label>
                  <select
                    value={filters.category}
                    onChange={(e) => handleFilterChange('category', e.target.value)}
                    className="input-base text-sm"
                  >
                    <option value="">جميع الأقسام</option>
                    <option value="أدوات">أدوات طب الأسنان</option>
                    <option value="أجهزة">أجهزة</option>
                    <option value="مواد">مواد</option>
                    <option value="طلاب">مستلزمات الطلاب</option>
                  </select>
                </div>

                {/* Condition Filter */}
                <div>
                  <label className="block font-medium mb-3 text-secondary-900">الحالة</label>
                  <select
                    value={filters.condition}
                    onChange={(e) => handleFilterChange('condition', e.target.value)}
                    className="input-base text-sm"
                  >
                    <option value="">جميع الحالات</option>
                    <option value="new">جديد</option>
                    <option value="used">مستعمل</option>
                  </select>
                </div>

                {/* Price Filter */}
                <div>
                  <label className="block font-medium mb-3 text-secondary-900">السعر</label>
                  <div className="space-y-2">
                    <input
                      type="number"
                      placeholder="السعر الأدنى"
                      value={filters.minPrice}
                      onChange={(e) => handleFilterChange('minPrice', e.target.value)}
                      className="input-base text-sm"
                    />
                    <input
                      type="number"
                      placeholder="السعر الأقصى"
                      value={filters.maxPrice}
                      onChange={(e) => handleFilterChange('maxPrice', e.target.value)}
                      className="input-base text-sm"
                    />
                  </div>
                </div>

                {/* Sort */}
                <div>
                  <label className="block font-medium mb-3 text-secondary-900">الترتيب</label>
                  <select
                    value={filters.sortBy}
                    onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                    className="input-base text-sm"
                  >
                    <option value="newest">الأحدث</option>
                    <option value="oldest">الأقدم</option>
                    <option value="cheapest">الأرخص</option>
                    <option value="expensive">الأغلى</option>
                  </select>
                </div>

                <button
                  onClick={() => setFilters({
                    category: '',
                    condition: '',
                    minPrice: '',
                    maxPrice: '',
                    sortBy: 'newest'
                  })}
                  className="w-full btn-secondary text-sm"
                >
                  مسح الفلاتر
                </button>
              </div>
            </div>
          </div>

          {/* Products */}
          <div className="lg:col-span-3">
            <div className="flex justify-between items-center mb-6 lg:hidden">
              <span className="text-sm text-secondary-600">
                {products.length} منتج
              </span>
              <button
                onClick={() => setShowFilters(true)}
                className="btn-secondary text-sm"
              >
                <FiFilter className="ml-2" />
                فلترة
              </button>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(12)].map((_, idx) => (
                  <div key={idx} className="animate-pulse">
                    <div className="bg-secondary-200 h-64 rounded-xl mb-4"></div>
                    <div className="bg-secondary-200 h-4 rounded mb-2 w-3/4"></div>
                    <div className="bg-secondary-200 h-4 rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            ) : products.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {products.map((product, idx) => (
                  <ProductCard key={product.id} product={product} delay={idx * 0.05} />
                ))}
              </div>
            ) : (
              <div className="text-center py-20">
                <p className="text-secondary-600 mb-4">لم نجد منتجات تطابق بحثك</p>
                <button
                  onClick={() => setFilters({
                    category: '',
                    condition: '',
                    minPrice: '',
                    maxPrice: '',
                    sortBy: 'newest'
                  })}
                  className="btn-primary"
                >
                  مسح الفلاتر والبحث مجدداً
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductCard({ product, delay }) {
  const image = product.images?.[0]?.image_url || '/placeholder.jpg';
  
  return (
    <Link href={`/products/${product.id}`}>
      <div 
        className="card-hover bg-white rounded-xl overflow-hidden border border-secondary-100"
        style={{animationDelay: `${delay}s`}}
      >
        <div className="relative h-64 bg-secondary-100 overflow-hidden group">
          <img
            src={image}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
          />
          <button className="absolute top-4 right-4 p-2 bg-white rounded-full shadow-lg hover:bg-primary-600 hover:text-white transition-colors">
            <FiHeart className="text-xl" />
          </button>
          {product.condition === 'new' && (
            <span className="absolute top-4 left-4 bg-primary-600 text-white px-3 py-1 rounded-full text-sm font-medium">
              جديد
            </span>
          )}
        </div>
        
        <div className="p-4">
          <h3 className="font-bold text-secondary-900 mb-2 line-clamp-2 group-hover:text-primary-600">
            {product.name}
          </h3>
          
          <p className="text-xs text-secondary-600 mb-3">
            {product.merchant?.company_name}
          </p>
          
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="text-2xl font-bold text-primary-600">
                {product.price}
              </span>
              <span className="text-secondary-600 mr-2 text-sm">
                {product.currency === 'USD' ? '$' : 'ل.س'}
              </span>
            </div>
          </div>
          
          <button className="w-full btn-primary">
            <FiShoppingCart className="ml-2" />
            أضف للسلة
          </button>
        </div>
      </div>
    </Link>
  );
}
