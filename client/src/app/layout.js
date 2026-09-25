import '@/styles/globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import AppProviders from '@/components/AppProviders';
import { Toaster } from 'react-hot-toast';

export const metadata = {
  title: 'TopDent | منصة أدوات طب الأسنان',
  description: 'منصة عربية متخصصة لشراء وبيع واستئجار أدوات ومنتجات طب الأسنان.',
  keywords: ['طب الأسنان', 'أدوات الأسنان', 'منتجات أسنان', 'TopDent'],
  robots: 'index, follow'
};

export const viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <body className="bg-white">
        <AppProviders>
          <Header />
          <main className="min-h-screen">{children}</main>
          <Footer />
          <Toaster position="top-center" toastOptions={{ duration: 3500 }} />
        </AppProviders>
      </body>
    </html>
  );
}
