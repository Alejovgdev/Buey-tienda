'use client';

import Link from 'next/link';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { TbHome, TbBook, TbCalendarEvent, TbDiscount, TbUsers, TbPhone, TbShoppingBag, TbTruck } from 'react-icons/tb';
import type { IconType } from 'react-icons';
import Logo from './Logo';
import CartLink from './CartLink';
import styles from './Navbar.module.css';

type MenuItem = { href: string; label: string; icon: IconType };

const menuGroups: { label: string; items: MenuItem[] }[] = [
  { label: 'Restaurante', items: [
    { href: '/carta', label: 'Carta', icon: TbBook },
    { href: '/reservas', label: 'Reservar mesa', icon: TbCalendarEvent },
  ] },
  { label: 'Tienda online', items: [
    { href: '/tienda', label: 'Comprar carne', icon: TbShoppingBag },
    { href: '/#envios', label: 'Envíos', icon: TbTruck },
  ] },
  { label: 'El Buey', items: [
    { href: '/sorteo', label: 'Descuentos', icon: TbDiscount },
    { href: '/sobre-nosotros', label: 'Sobre nosotros', icon: TbUsers },
    { href: '/contacto', label: 'Contacto', icon: TbPhone },
  ] },
];

const desktopItems = [
  { href: '/carta', label: 'Carta' },
  { href: '/reservas', label: 'Reservar' },
  { href: '/tienda', label: 'Tienda' },
  { href: '/sorteo', label: 'Descuentos' },
  { href: '/sobre-nosotros', label: 'Sobre nosotros' },
  { href: '/contacto', label: 'Contacto' },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [navHidden, setNavHidden] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const lastScrollY = useRef(0);
  const scrollState = useRef({ scrolled: false, navHidden: false });
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const isCartaRoute = pathname === '/carta' || pathname.startsWith('/carta/');
  const reduceMotion = useReducedMotion();
  const isInShopFlow = pathname === '/tienda' || pathname.startsWith('/tienda/') || pathname === '/carrito' || pathname.startsWith('/carrito/');
  const closeMenu = () => setMenuOpen(false);
  const isActive = (href: string) => href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

  useLayoutEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const scrollDelta = currentScrollY - lastScrollY.current;
      const nextScrolled = currentScrollY > 50;
      if (scrollState.current.scrolled !== nextScrolled) {
        scrollState.current.scrolled = nextScrolled;
        setScrolled(nextScrolled);
      }
      let nextHidden = scrollState.current.navHidden;
      if (currentScrollY < 60) nextHidden = false;
      else if (!menuOpen && scrollDelta > 8 && currentScrollY > 120) nextHidden = true;
      else if (scrollDelta < -8) nextHidden = false;
      if (scrollState.current.navHidden !== nextHidden) {
        scrollState.current.navHidden = nextHidden;
        setNavHidden(nextHidden);
      }
      lastScrollY.current = currentScrollY;
    };
    lastScrollY.current = window.scrollY;
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [menuOpen, pathname]);

  useLayoutEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [menuOpen]);

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1280px)');
    const handleResize = () => { if (desktop.matches) setMenuOpen(false); };
    desktop.addEventListener('change', handleResize);
    return () => desktop.removeEventListener('change', handleResize);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const frame = requestAnimationFrame(() => menuRef.current?.querySelector<HTMLAnchorElement>('a')?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
      if (event.key === 'Tab') {
        const links = menuRef.current?.querySelectorAll<HTMLAnchorElement>('a[href]');
        const first = menuButtonRef.current;
        const last = links?.[links.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault(); last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first?.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('keydown', handleKeyDown); };
  }, [menuOpen]);

  useLayoutEffect(() => {
    document.documentElement.style.setProperty('--site-header-visible-offset', navHidden && !menuOpen ? '0px' : 'var(--site-header-height)');
    return () => { document.documentElement.style.setProperty('--site-header-visible-offset', 'var(--site-header-height)'); };
  }, [menuOpen, navHidden]);

  const renderMenuLink = ({ href, label, icon: Icon }: MenuItem) => (
    <Link href={href} onClick={closeMenu} className={`${styles.menuLink} ${isActive(href) ? styles.active : ''}`} aria-current={isActive(href) ? 'page' : undefined}>
      <Icon aria-hidden="true" /><span>{label}</span>
    </Link>
  );

  return (
    <nav aria-label="Navegación principal" className={`site-header ${styles.header} ${navHidden && !menuOpen ? '-translate-y-full' : 'translate-y-0'} ${styles.motionAware}`}>
      <div aria-hidden="true" className={styles.surface} data-carta={isCartaRoute} data-scrolled={scrolled && !isCartaRoute} data-menu-open={menuOpen} />
      <div className={styles.headerInner}>
        <div className={styles.logo} onClick={closeMenu}><Logo /></div>
        <ul className={styles.desktopNav}>
          {desktopItems.map(({ href, label }) => (
            <li key={href}><Link href={href} className={`${styles.desktopLink} ${href === '/tienda' ? styles.shopLink : ''} ${isActive(href) ? styles.current : ''}`} aria-current={isActive(href) ? 'page' : undefined}>{label}</Link></li>
          ))}
        </ul>
        <div className={styles.headerActions}>
          {isInShopFlow && <CartLink />}
          <Link href="/reservas" className={styles.desktopBooking}>Reservar mesa</Link>
          <button ref={menuButtonRef} className={styles.menuButton} onClick={() => setMenuOpen((current) => !current)} aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={menuOpen} aria-controls="mobile-navigation">
            <span className={styles.menuGlyph} data-open={menuOpen} aria-hidden="true"><span /><span /><span /></span>
          </button>
        </div>
      </div>
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div key="menu-overlay" className={styles.menuOverlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduceMotion ? 0 : .18 }} onClick={closeMenu} aria-hidden="true" />
            <motion.div key="menu-panel" id="mobile-navigation" ref={menuRef} className={styles.menuPanel} initial={{ opacity: 0, y: reduceMotion ? 0 : -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduceMotion ? 0 : -8 }} transition={{ duration: reduceMotion ? 0 : .18 }}>
              {renderMenuLink({ href: '/', label: 'Inicio', icon: TbHome })}
              {menuGroups.map((group) => (
                <div key={group.label} className={styles.menuGroup}>
                  <p>{group.label}</p>
                  <ul>{group.items.map((item) => <li key={item.href}>{renderMenuLink(item)}</li>)}</ul>
                </div>
              ))}
              <div className={styles.menuActions}>
                <Link href="/reservas" onClick={closeMenu}><TbCalendarEvent aria-hidden="true" />Reservar</Link>
                <Link href="/tienda" onClick={closeMenu}><TbShoppingBag aria-hidden="true" />Tienda</Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </nav>
  );
}
