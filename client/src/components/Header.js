'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { FiBell, FiChevronDown, FiHeart, FiMenu, FiSearch, FiShoppingCart, FiUser, FiX } from 'react-icons/fi';
import SearchBar from './SearchBar';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import api from '@/lib/api';
import { roleLabels } from '@/lib/format';

const primaryLinks = [
  ['المنتجات', '/products'], ['جديد', '/products?condition=new'], ['مستعمل', '/products?condition=used'],
  ['اعرض منتجك', '/sell'], ['الإيجار', '/rentals'], ['تصميم كرت طبيب', '/dental-card'], ['العروض', '/offers']
];

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const { itemCount } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) return setUnread(0);
    api.get('/users/notifications?limit=100').then((response) => setUnread((response.notifications || []).filter((item) => !item.is_read).length)).catch(() => setUnread(0));
  }, [isAuthenticated, pathname]);

  const signOut = () => {
    logout();
    setUserOpen(false);
    router.push('/');
  };
  const dashboard = user?.role ? '/dashboard' : '/profile';

  return (
    <header className="sticky top-0 z-50 border-b border-secondary-100 bg-white/95 shadow-sm backdrop-blur">
      <div className="hidden border-b border-secondary-100 bg-secondary-50 md:block">
        <div className="container-main flex items-center justify-between py-2 text-xs text-secondary-600">
          <p>منصة TopDent المتخصصة بأدوات ومنتجات طب الأسنان</p>
          <nav className="flex gap-5"><Link href="/guide">دليل المستخدم</Link><Link href="/policy">سياسة التطبيق</Link><Link href="/services">خدمات المنصة</Link></nav>
        </div>
      </div>
      <div className="container-main py-3">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="الصفحة الرئيسية">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-600 text-lg font-black text-white">TD</span>
            <span className="hidden text-xl font-black tracking-tight text-secondary-900 sm:block">TopDent</span>
          </Link>
          <div className="hidden max-w-xl flex-1 lg:block"><SearchBar /></div>
          <div className="flex items-center gap-1 sm:gap-2">
            <button onClick={() => setMenuOpen((value) => !value)} className="rounded-lg p-2 hover:bg-secondary-100 lg:hidden" aria-label="فتح القائمة">{menuOpen ? <FiX /> : <FiMenu />}</button>
            <Link href="/favorites" className="rounded-lg p-2 hover:bg-secondary-100" aria-label="المفضلة"><FiHeart /></Link>
            <Link href="/cart" className="relative rounded-lg p-2 hover:bg-secondary-100" aria-label="السلة"><FiShoppingCart />{itemCount > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-primary-600 px-1 text-[10px] text-white">{itemCount}</span>}</Link>
            {isAuthenticated && <Link href="/notifications" className="relative rounded-lg p-2 hover:bg-secondary-100" aria-label="الإشعارات"><FiBell />{unread > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[10px] text-white">{unread > 99 ? '99+' : unread}</span>}</Link>}
            <div className="relative">
              <button onClick={() => setUserOpen((value) => !value)} className="flex items-center gap-1 rounded-lg p-2 hover:bg-secondary-100" aria-expanded={userOpen} aria-label="قائمة الحساب"><FiUser /><span className="hidden max-w-28 truncate text-sm sm:block">{isLoading ? '' : isAuthenticated ? user.fullName || user.email : 'الحساب'}</span><FiChevronDown className={userOpen ? 'rotate-180 transition-transform' : 'transition-transform'} /></button>
              {userOpen && <div className="absolute left-0 top-full mt-2 w-64 overflow-hidden rounded-xl border border-secondary-100 bg-white shadow-xl">
                {isAuthenticated ? <>
                  <div className="border-b border-secondary-100 px-4 py-3"><p className="font-bold">{user.fullName || user.email}</p><p className="mt-1 text-xs text-secondary-500">{roleLabels[user.role] || user.role}</p></div>
                  <Link onClick={() => setUserOpen(false)} href={dashboard} className="block px-4 py-3 hover:bg-secondary-50">لوحة التحكم</Link>
                  <Link onClick={() => setUserOpen(false)} href="/profile" className="block px-4 py-3 hover:bg-secondary-50">الملف الشخصي</Link>
                  <button onClick={signOut} className="block w-full px-4 py-3 text-right text-red-600 hover:bg-red-50">تسجيل الخروج</button>
                </> : <>
                  <Link onClick={() => setUserOpen(false)} href="/auth/login" className="block px-4 py-3 hover:bg-secondary-50">تسجيل الدخول</Link>
                  <Link onClick={() => setUserOpen(false)} href="/auth/register" className="block px-4 py-3 hover:bg-secondary-50">إنشاء حساب</Link>
                  <Link onClick={() => setUserOpen(false)} href="/merchant/register" className="block px-4 py-3 font-bold text-primary-700 hover:bg-primary-50">تسجيل شركة</Link>
                </>}
              </div>}
            </div>
          </div>
        </div>
        <div className="mt-3 lg:hidden"><SearchBar /></div>
      </div>
      <nav className="hidden border-t border-secondary-100 lg:block"><div className="container-main flex items-center gap-1 overflow-x-auto py-2">{primaryLinks.map(([label, href]) => <Link key={href} href={href} className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${pathname === href ? 'bg-primary-50 text-primary-700' : 'text-secondary-700 hover:bg-secondary-50'}`}>{label}</Link>)}</div></nav>
      {menuOpen && <nav className="border-t border-secondary-100 bg-white lg:hidden"><div className="container-main grid gap-1 py-3">{primaryLinks.map(([label, href]) => <Link key={href} onClick={() => setMenuOpen(false)} href={href} className="rounded-lg px-4 py-3 hover:bg-secondary-50">{label}</Link>)}</div></nav>}
    </header>
  );
}
