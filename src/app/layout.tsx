import type { Metadata, Viewport } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar/Navbar';
import Footer from '@/components/Footer/Footer';
import WhatsAppButton from '@/components/ui/WhatsAppButton';
import { ConsentProvider } from '@/contexts/ConsentContext';
import { CartProvider } from '@/contexts/CartContext';
import CookieBanner from '@/components/Cookies/CookieBanner';
import CookiePanel from '@/components/Cookies/CookiePanel';
import AnalyticsLoader from '@/components/Cookies/AnalyticsLoader';

export const metadata: Metadata = {
  title: 'El Buey Madurado - Carne Madurada Premium',
  description: 'Tienda online de carne madurada...',
  icons: {
    icon: '/logo-fondo-blanco.ico',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" data-scroll-behavior="smooth">
      <body className="bg-[#160a00] text-white overflow-x-hidden">
        <ConsentProvider>
          <CartProvider>
            <Navbar />
            <main className="relative min-h-screen pt-[var(--site-header-height)]">
              {children}
            </main>
            <Footer />
            <WhatsAppButton />
            <CookieBanner />
            <CookiePanel />
            <AnalyticsLoader />
          </CartProvider>
        </ConsentProvider>
      </body>
    </html>
  );
}
