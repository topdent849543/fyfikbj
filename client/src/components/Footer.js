'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FaFacebook, FaInstagram, FaTelegramPlane, FaWhatsapp } from 'react-icons/fa';
import { FiMail, FiPhone } from 'react-icons/fi';
import api from '@/lib/api';

export default function Footer() {
  const [settings, setSettings] = useState({});
  useEffect(() => { api.get('/catalog/settings').then((result) => setSettings(result.settings || {})).catch(() => setSettings({})); }, []);
  const social = [
    [settings.social_whatsapp, FaWhatsapp, 'واتساب', 'text-emerald-300'], [settings.social_facebook, FaFacebook, 'فيسبوك', 'text-blue-300'],
    [settings.social_instagram, FaInstagram, 'إنستغرام', 'text-pink-300'], [settings.social_telegram, FaTelegramPlane, 'تيليغرام', 'text-sky-300']
  ].filter(([href]) => href);

  return <footer className="bg-secondary-900 text-secondary-200"><div className="container-main py-14">
    <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
      <section><h2 className="mb-4 text-2xl font-black text-white">TopDent</h2><p className="leading-7 text-secondary-300">{settings.about_text || 'منصة متخصصة تربط طلاب وأطباء وعيادات الأسنان بالشركات والتجار، مع طلبات قابلة للمتابعة من البداية حتى التسليم.'}</p>{social.length > 0 && <div className="mt-5 flex items-center gap-3">{social.map(([href, Icon, label, color]) => <a key={label} href={href} target="_blank" rel="noreferrer" aria-label={label} className={`rounded-lg bg-secondary-800 p-3 text-lg hover:bg-secondary-700 ${label === 'واتساب' ? 'scale-110 bg-emerald-700 text-white' : color}`}><Icon /></a>)}</div>}</section>
      <section><h3 className="mb-4 font-bold text-white">التسوق والخدمات</h3><nav className="space-y-3 text-sm"><Link href="/products" className="block hover:text-primary-300">المنتجات</Link><Link href="/products?condition=used" className="block hover:text-primary-300">الأدوات المستعملة</Link><Link href="/sell" className="block hover:text-primary-300">عرض منتج للبيع</Link><Link href="/rentals" className="block hover:text-primary-300">استئجار أدوات</Link><Link href="/dental-card" className="block hover:text-primary-300">تصميم كرت طبيب</Link><Link href="/offers" className="block hover:text-primary-300">العروض</Link></nav></section>
      <section><h3 className="mb-4 font-bold text-white">معلومات المنصة</h3><nav className="space-y-3 text-sm"><Link href="/about" className="block hover:text-primary-300">من نحن</Link><Link href="/guide" className="block hover:text-primary-300">دليل المستخدم</Link><Link href="/policy" className="block hover:text-primary-300">سياسة التطبيق</Link><Link href="/services" className="block hover:text-primary-300">خدمات التطبيق</Link><Link href="/terms" className="block hover:text-primary-300">الشروط والخصوصية</Link></nav></section>
      <section><h3 className="mb-4 font-bold text-white">التواصل</h3><div className="space-y-4 text-sm">{settings.contact_phone && <a href={`tel:${settings.contact_phone}`} className="flex items-center gap-3 hover:text-primary-300"><FiPhone />{settings.contact_phone}</a>}{settings.contact_email && <a href={`mailto:${settings.contact_email}`} className="flex items-center gap-3 hover:text-primary-300"><FiMail />{settings.contact_email}</a>}{!settings.contact_phone && !settings.contact_email && <p className="leading-6 text-secondary-400">تُدار بيانات التواصل وروابط الشبكات الاجتماعية من لوحة الإدارة قبل الإطلاق.</p>}</div></section>
    </div><div className="mt-12 border-t border-secondary-700 pt-6 text-center text-xs text-secondary-400">© {new Date().getFullYear()} TopDent. جميع الحقوق محفوظة.</div>
  </div></footer>;
}
