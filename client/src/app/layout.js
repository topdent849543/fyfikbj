import '@/styles/globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { AuthProvider } from '@/context/AuthContext';
import { Toaster } from 'react-hot-toast';

export const metadata = {
  title: 'TopDent - منصة متخصصة بأدوات طب الأسنان',
  description: 'منصة إلكترونية متخصصة ببيع وشراء وعرض أدوات ومنتجات ومستلزمات طب الأسنان',
  keywords: ['طب الأسنان', 'أدوات الأسنان', 'منتجات الأسنان', 'e-commerce'],
  robots: 'index, follow',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <meta charSet="utf-8" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="bg-white">
        <AuthProvider>
          <Header />
          <main className="min-h-screen">{children}</main>
          <Footer />
        </AuthProvider>
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
