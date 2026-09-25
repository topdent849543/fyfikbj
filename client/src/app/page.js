'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FiArrowLeft, FiBookOpen, FiBox, FiGift, FiPenTool, FiRepeat, FiShoppingBag, FiX } from 'react-icons/fi';
import api from '@/lib/api';
import ProductCard from '@/components/ProductCard';

const serviceTiles = [
  ['شراء أدوات جديدة', 'تصفح المنتجات الجديدة المعتمدة', '/products?condition=new', FiShoppingBag],
  ['شراء أدوات مستعملة', 'منتجات مستعملة بوصف واضح ومراجعة إدارية', '/products?condition=used', FiRepeat],
  ['عرض أدوات للبيع', 'ارفع منتجك المستعمل وارسله للمراجعة', '/sell', FiBox],
  ['استئجار أدوات', 'اطلب أدوات الإيجار وحدد المدة المناسبة', '/rentals', FiBookOpen],
  ['تصميم كرت طبيب أسنان', 'أرسل طلب التصميم ومتابعته من حسابك', '/dental-card', FiPenTool],
  ['العروض', 'شاهد عروض الشركات والمنتجات المرتبطة', '/offers', FiGift]
];

function ProductSection({ title, products, href }) {
  if (!products?.length) return null;
  return <section className="py-10"><div className="container-main"><div className="mb-6 flex items-center justify-between"><h2 className="text-2xl font-black text-secondary-900">{title}</h2><Link href={href} className="inline-flex items-center gap-1 font-bold text-primary-700">عرض الكل <FiArrowLeft /></Link></div><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{products.map((product, index) => <ProductCard key={product.id} product={product} delay={index * 0.03} />)}</div></div></section>;
}

export default function HomePage() {
  const [data, setData] = useState({ categories: [], featured: [], latest: [], used: [], banners: [] });
  const [loading, setLoading] = useState(true); const [bannerIndex, setBannerIndex] = useState(0); const [welcomeOpen, setWelcomeOpen] = useState(true);
  useEffect(() => { Promise.all([
    api.get('/catalog/categories'), api.get('/products?limit=8&sortBy=newest'), api.get('/products?limit=8&sortBy=newest&condition=used'), api.get('/catalog/banners')
  ]).then(([categories, products, used, banners]) => setData({ categories: categories.categories || [], featured: (products.products || []).slice(0, 4), latest: products.products || [], used: used.products || [], banners: banners.banners || [] })).catch(() => setData({ categories: [], featured: [], latest: [], used: [], banners: [] })).finally(() => setLoading(false)); }, []);
  useEffect(() => { if (data.banners.length < 2) return undefined; const timer = setInterval(() => setBannerIndex((current) => (current + 1) % data.banners.length), 5000); return () => clearInterval(timer); }, [data.banners.length]);
  const activeBanner = data.banners[bannerIndex];
  return <div className="bg-white">
    {welcomeOpen && <div className="fixed inset-0 z-[60] grid place-items-center bg-secondary-950/45 p-4"><div role="dialog" aria-modal="true" className="relative max-w-lg rounded-2xl bg-white p-7 shadow-2xl"><button onClick={() => setWelcomeOpen(false)} className="absolute left-4 top-4 rounded-full p-2 hover:bg-secondary-100" aria-label="إغلاق"><FiX /></button><p className="pl-8 text-xl font-black">مرحباً بك في TopDent</p><p className="mt-4 leading-8 text-secondary-700">بإمكانك طلب المنتجات والاطلاع على سعرها بشكل مباشر وهي تشمل أجور التوصيل، ويمكنك متابعتنا على فيسبوك وإنستغرام للاطلاع على عروضنا بشكل مستمر، وللمزيد من التفاصيل اطلع على دليل المستخدم ضمن إعدادات التطبيق.</p><button onClick={() => setWelcomeOpen(false)} className="btn-primary mt-6">متابعة التسوق</button></div></div>}
    <section className="relative overflow-hidden bg-gradient-to-bl from-primary-800 via-primary-700 to-secondary-900 py-16 text-white sm:py-24"><div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" /><div className="absolute -bottom-28 left-0 h-80 w-80 rounded-full bg-primary-300/20 blur-3xl" /><div className="container-main relative grid items-center gap-9 lg:grid-cols-2"><div><p className="mb-4 inline-flex rounded-full bg-white/10 px-4 py-2 text-sm">منصة متخصصة بطب الأسنان</p><h1 className="max-w-xl text-4xl font-black leading-tight sm:text-6xl">كل ما تحتاجه لعيادتك أو دراستك في مكان واحد</h1><p className="mt-6 max-w-xl text-lg leading-8 text-primary-100">تسوق من شركات معتمدة، اعرض منتجاتك المستعملة، واستأجر الأدوات أو اطلب خدمات التصميم بمتابعة واضحة لكل خطوة.</p><div className="mt-8 flex flex-wrap gap-3"><Link href="/products" className="btn-primary bg-white text-primary-800 hover:bg-primary-50">تصفح المنتجات</Link><Link href="/merchant/register" className="btn-outline border-white text-white hover:bg-white/10">سجل شركتك</Link></div></div>
      <div className="rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur">{activeBanner ? <Link href={activeBanner.link_url || '/offers'} className="block"><div className="relative overflow-hidden rounded-2xl bg-primary-900/30"><img src={activeBanner.image_url} alt={activeBanner.title || 'عرض TopDent'} className="h-64 w-full object-cover" /><div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-secondary-950/90 p-5"><p className="text-xl font-black">{activeBanner.title || 'عرض مميز'}</p><p className="mt-1 text-sm text-primary-100">اضغط لعرض التفاصيل</p></div></div></Link> : <div className="rounded-2xl border border-dashed border-white/25 p-8 text-center text-primary-100"><FiGift className="mx-auto mb-3 text-4xl" /><p className="font-bold">تظهر العروض والبنرات النشطة هنا</p><p className="mt-2 text-sm">تُدار من لوحة الإدارة وترتبط بصفحة أو عرض حقيقي.</p></div>}</div>
    </div></section>
    <section className="border-b border-secondary-100 bg-secondary-50 py-10"><div className="container-main"><h2 className="mb-6 text-2xl font-black">اختر الخدمة المناسبة</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{serviceTiles.map(([title, description, href, Icon]) => <Link key={href} href={href} className="group rounded-2xl bg-white p-5 shadow-card transition hover:-translate-y-1 hover:shadow-lg"><Icon className="mb-4 text-3xl text-primary-700" /><h3 className="font-black group-hover:text-primary-700">{title}</h3><p className="mt-2 text-sm leading-6 text-secondary-600">{description}</p></Link>)}</div></div></section>
    <section className="py-12"><div className="container-main"><div className="mb-6 flex items-center justify-between"><h2 className="text-2xl font-black">التصنيفات الرئيسية</h2><Link href="/products" className="font-bold text-primary-700">عرض المنتجات</Link></div>{loading ? <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-xl bg-secondary-100" />)}</div> : data.categories.length ? <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">{data.categories.map((category) => <Link key={category.id} href={`/products?category=${encodeURIComponent(category.name)}`} className="rounded-2xl border border-secondary-100 bg-secondary-50 p-4 text-center transition hover:border-primary-300 hover:bg-primary-50"><p className="font-black text-secondary-900">{category.name}</p><p className="mt-2 line-clamp-2 text-xs leading-5 text-secondary-500">{category.description || 'استكشف المنتجات'}</p></Link>)}</div> : <p className="rounded-xl bg-secondary-50 p-6 text-secondary-600">ستظهر التصنيفات بعد تهيئة قاعدة بيانات المنصة.</p>}</div></section>
    <ProductSection title="المنتجات المميزة" products={data.featured} href="/products" /><ProductSection title="أحدث المنتجات" products={data.latest} href="/products?sortBy=newest" /><ProductSection title="منتجات مستعملة" products={data.used} href="/products?condition=used" />
  </div>;
}
