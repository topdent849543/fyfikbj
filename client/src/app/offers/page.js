'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import ProductCard from '@/components/ProductCard';

export default function OffersPage() { const [offers, setOffers] = useState([]); useEffect(() => { api.get('/catalog/offers').then((response) => setOffers(response.offers || [])).catch(() => setOffers([])); }, []); return <div className="min-h-screen bg-secondary-50 py-8"><div className="container-main"><h1 className="text-3xl font-black">العروض والخصومات</h1><p className="mt-2 text-secondary-600">عروض نشطة تُدار من قاعدة البيانات وتربط مباشرة بمنتجاتها أو بالشركة صاحبة العرض.</p><div className="mt-8 space-y-7">{offers.map((offer) => <article key={offer.id} className="overflow-hidden rounded-2xl bg-white shadow-card"><div className="grid lg:grid-cols-[300px_1fr]"><img src={offer.image_url} alt={offer.title} className="h-56 w-full object-cover" /><div className="p-6"><h2 className="text-2xl font-black">{offer.title}</h2><p className="mt-3 leading-7 text-secondary-600">{offer.description}</p><Link href={`/offers/${offer.id}`} className="btn-primary mt-5">تفاصيل العرض</Link></div></div>{offer.products?.length > 0 && <div className="grid gap-5 border-t border-secondary-100 p-6 sm:grid-cols-2 lg:grid-cols-4">{offer.products.map((link) => link.product && <ProductCard key={link.product.id} product={link.product} />)}</div>}</article>)}</div>{!offers.length && <div className="mt-8 rounded-2xl bg-white p-10 text-center shadow-card">لا توجد عروض نشطة حالياً.</div>}</div></div>; }
