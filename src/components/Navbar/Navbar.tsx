// components/Navbar/Navbar.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { TbHome, TbBook, TbCalendarEvent, TbDiscount, TbUsers, TbPhone } from 'react-icons/tb';
import Logo from './Logo';
import NavLink from './NavLink';
import ShopNavLink from './ShopNavLink';
import CartLink from './CartLink';

// Enlace a la tienda online (Fase 2, sección 7 del documento MVP) y al
// carrito (Fase 3). Activado: la tienda ya está en producción.
const SHOP_NAV_ENABLED = true;

const baseNavItems = [
  { href: '/', label: 'Home', icon: TbHome },
  { href: '/carta', label: 'Carta', icon: TbBook },
  { href: '/reservas', label: 'Reservar', icon: TbCalendarEvent },
  { href: '/sorteo', label: 'Descuentos', icon: TbDiscount },
  { href: '/sobre-nosotros', label: 'Sobre Nosotros', icon: TbUsers },
  { href: '/contacto', label: 'Contacto', icon: TbPhone },
] as const;

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [navHidden, setNavHidden] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const lastScrollY = useRef(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  // El icono del carrito solo aporta contexto útil dentro del flujo de compra;
  // en el resto del sitio (Carta, Reservas...) es ruido, así que se oculta ahí.
  const isInShopFlow = pathname.startsWith('/tienda') || pathname.startsWith('/carrito');

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const scrollDelta = currentScrollY - lastScrollY.current;

      setScrolled(currentScrollY > 50);

      if (currentScrollY < 60) {
        setNavHidden(false);
      } else if (!menuOpen && scrollDelta > 8 && currentScrollY > 120) {
        setNavHidden(true);
      } else if (scrollDelta < -8) {
        setNavHidden(false);
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [menuOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuOpen &&
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  useEffect(() => {
    document.documentElement.style.setProperty(
      '--site-header-visible-offset',
      navHidden && !menuOpen ? '0px' : 'var(--site-header-height)'
    );

    return () => {
      document.documentElement.style.setProperty(
        '--site-header-visible-offset',
        'var(--site-header-height)'
      );
    };
  }, [menuOpen, navHidden]);

  const bgClass = scrolled || menuOpen ? 'bg-black shadow-md' : 'bg-black';
  const visibilityClass = navHidden && !menuOpen ? '-translate-y-full' : 'translate-y-0';
  const closeMenu = () => setMenuOpen(false);

  return (
    <nav
      className={`fixed left-0 top-0 z-50 h-[var(--site-header-height)] w-full border-b border-amber-500/70 transition-all duration-300 ease-in-out ${bgClass} ${visibilityClass}`}
    >
      <div className="relative mx-auto flex h-full w-full max-w-[1800px] items-center gap-4 px-4 pr-20 sm:px-8 sm:pr-28 md:px-14 md:pr-32 lg:px-20 lg:pr-40 xl:px-24 xl:pr-44">
        <Logo />

        <div className="absolute right-4 top-1/2 z-10 flex -translate-y-1/2 shrink-0 items-center gap-2 sm:right-8 sm:gap-3 md:right-14 lg:right-20 xl:right-24">
          {SHOP_NAV_ENABLED && isInShopFlow && (
            <>
              <CartLink />
              <span className="h-8 w-px bg-white/10" aria-hidden="true" />
            </>
          )}

          <div>
            <button
              className="group flex h-12 w-12 items-center justify-center text-white transition-opacity duration-200 hover:opacity-85 sm:h-14 sm:w-14 md:h-16 md:w-16 lg:h-[4.5rem] lg:w-[4.5rem] xl:h-20 xl:w-20"
              onClick={() => setMenuOpen((current) => !current)}
              aria-label="Toggle menu"
              aria-expanded={menuOpen}
            >
              <span className="relative block h-7 w-9 sm:h-8 sm:w-11 md:h-8 md:w-12 lg:h-9 lg:w-14 xl:h-10 xl:w-16" aria-hidden="true">
                <span
                  className={`absolute left-0 h-1.5 w-full rounded-sm bg-white shadow-[0_0_8px_rgba(255,255,255,0.35)] transition-transform duration-200 md:h-2 ${
                    menuOpen ? 'top-1/2 -translate-y-1/2 rotate-45' : 'top-0'
                  }`}
                />
                <span
                  className={`absolute left-0 top-1/2 h-1.5 w-full -translate-y-1/2 rounded-sm bg-white shadow-[0_0_8px_rgba(255,255,255,0.35)] transition-opacity duration-200 md:h-2 ${
                    menuOpen ? 'opacity-0' : 'opacity-100'
                  }`}
                />
                <span
                  className={`absolute left-0 h-1.5 w-full rounded-sm bg-white shadow-[0_0_8px_rgba(255,255,255,0.35)] transition-transform duration-200 md:h-2 ${
                    menuOpen ? 'top-1/2 -translate-y-1/2 -rotate-45' : 'bottom-0'
                  }`}
                />
              </span>
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div
              key="menu-overlay"
              className="fixed inset-0 z-40 bg-black/60"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 0.22, ease: 'easeOut' } }}
              exit={{ opacity: 0, transition: { duration: 0.15, ease: 'easeIn' } }}
              onClick={closeMenu}
            />

            <motion.div
              key="menu-panel"
              ref={menuRef}
              className="fixed right-4 top-[calc(var(--site-header-height)+1rem)] z-50 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-md bg-[#1a1410] p-3 text-white shadow-2xl ring-1 ring-white/10 sm:right-8 md:right-14 md:w-80 lg:right-20 xl:right-24"
              initial={{ opacity: 0, y: -12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.22, ease: 'easeOut' } }}
              exit={{ opacity: 0, y: -8, scale: 0.96, transition: { duration: 0.15, ease: 'easeIn' } }}
            >
              <ul className="space-y-1 rounded-xl bg-white/5 p-2">
                {baseNavItems.map((item) => (
                  <li key={item.href}>
                    <NavLink href={item.href} icon={item.icon} variant="row" onNavigate={closeMenu}>
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>

              {SHOP_NAV_ENABLED && (
                <div className="mt-2 border-t border-white/10 pt-3">
                  <ShopNavLink variant="row" onNavigate={closeMenu} />
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </nav>
  );
}
