'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import api from '@/lib/api';
import ProductCard from '@/components/ProductCard';

export default function OfferDetailPage() { const { id } = useParams(); const [offer, setOffer] = useState(null); const [error, setError] = useState(''); useEffect(() => { api.get(`/catalog/offers/${id}`).then(setOffer).catch(() => setError('العرض غير متاح أو انتهت مدته')); }, [id]); if (error) return <div className="container-main py-20 text-center text-xl font-black">{error}</div>; if (!offer) return <div className="container-main py-20 text-center">جارٍ تحميل العرض...</div>; const products = (offer.products || []).map((link) => link.product).filter(Boolean); return <div className="min-h-screen bg-secondary-50 py-8"><div className="container-main"><article className="overflow-hidden rounded-3xl bg-white shadow-card"><img src={offer.image_url} alt={offer.title} className="h-72 w-full object-cover" /><div className="p-7"><h1 className="text-3xl font-black">{offer.title}</h1><p className="mt-4 whitespace-pre-line leading-8 text-secondary-700">{offer.description}</p></div></article>{products.length > 0 && <section className="mt-10"><h2 className="mb-6 text-2xl font-black">المنتجات المرتبطة بالعرض</h2><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{products.map((product) => <ProductCard key={product.id} product={product} />)}</div></section>}</div></div>; }
