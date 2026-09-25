'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { FiShoppingCart, FiHeart, FiChevronRight } from 'react-icons/fi';
import api from '@/lib/api';

const categories = [
  { id: 1, name: 'أدوات طب الأسنان', icon: '🦷' },
  { id: 2, name: 'أجهزة طب الأسنان', icon: '⚙️' },
  { id: 3, name: 'مواد طب الأسنان', icon: '🧪' },
  { id: 4, name: 'مستلزمات الطلاب', icon: '📚' },
  { id: 5, name: 'مستلزمات العيادات', icon: '🏥' },
  { id: 6, name: 'معدات الوقاية', icon: '🛡️' },
];

export default function HomePage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await api.get('/products?limit=12');
      setProducts(response.products);
    } catch (error) {
      console.error('Failed to fetch products', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative h-screen bg-gradient-to-br from-primary-600 to-primary-800 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 right-20 w-72 h-72 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 left-20 w-72 h-72 bg-primary-300 rounded-full blur-3xl"></div>
        </div>
        
        <div className="relative container-main h-full flex flex-col justify-center items-center text-center">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 animate-slide-up">
            TopDent
          </h1>
          <p className="text-xl md:text-2xl mb-8 text-primary-100 max-w-2xl animate-slide-up" style={{animationDelay: '0.1s'}}>
            منصة متخصصة بيع وشراء أدوات ومنتجات ومستلزمات طب الأسنان
          </p>
          <div className="flex gap-4 animate-slide-up" style={{animationDelay: '0.2s'}}>
            <Link href="/products" className="btn-primary bg-white text-primary-600 hover:bg-primary-50">
              تسوق الآن
              <FiChevronRight className="mr-2" />
            </Link>
            <Link href="/about" className="btn-outline border-white text-white hover:bg-white/10">
              تعرف أكثر
            </Link>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-20 bg-secondary-50">
        <div className="container-main">
          <h2 className="section-title text-center mb-16">الأقسام الرئيسية</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map((category, idx) => (
              <div
                key={category.id}
                className="card-hover group bg-white p-8 rounded-2xl text-center cursor-pointer border-2 border-transparent hover:border-primary-600"
                style={{animationDelay: `${idx * 0.05}s`}}
              >
                <div className="text-6xl mb-4">{category.icon}</div>
                <h3 className="text-xl font-bold text-secondary-900 group-hover:text-primary-600 transition-colors">
                  {category.name}
                </h3>
                <p className="text-secondary-600 mt-2 text-sm">استكشف المزيد من المنتجات</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Products Section */}
      <section className="py-20 bg-white">
        <div className="container-main">
          <div className="flex justify-between items-center mb-12">
            <h2 className="section-title">المنتجات المميزة</h2>
            <Link href="/products" className="flex items-center text-primary-600 hover:text-primary-700 font-medium">
              عرض الجميع
              <FiChevronRight className="mr-2" />
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(8)].map((_, idx) => (
                <div key={idx} className="animate-pulse">
                  <div className="bg-secondary-200 h-64 rounded-xl mb-4"></div>
                  <div className="bg-secondary-200 h-4 rounded mb-2 w-3/4"></div>
                  <div className="bg-secondary-200 h-4 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {products.map((product, idx) => (
                <ProductCard key={product.id} product={product} delay={idx * 0.05} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-primary-600 to-primary-700 text-white">
        <div className="container-main text-center">
          <h2 className="text-4xl font-bold mb-6">هل أنت تاجر أو مختص؟</h2>
          <p className="text-xl text-primary-100 mb-8 max-w-2xl mx-auto">
            انضم إلى منصة TopDent وابدأ عرض منتجاتك أمام آلاف المشترين
          </p>
          <Link href="/merchant/register" className="btn-primary bg-white text-primary-600 hover:bg-primary-50">
            افتح متجرك الآن
          </Link>
        </div>
      </section>
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
          
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="text-2xl font-bold text-primary-600">
                {product.price}
              </span>
              <span className="text-secondary-600 mr-2 text-sm">
                {product.currency === 'USD' ? '$' : 'ل.س'}
              </span>
            </div>
            <span className="text-xs bg-secondary-100 text-secondary-600 px-2 py-1 rounded">
              {product.merchant?.company_name}
            </span>
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
