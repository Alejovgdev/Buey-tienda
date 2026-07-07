// components/Navbar/NavLink.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { IconType } from 'react-icons';

interface NavLinkProps {
  href: string;
  icon: IconType;
  children: React.ReactNode;
  /** 'inline' = fila horizontal del nav de escritorio. 'row' = fila de la lista del menú móvil. */
  variant?: 'inline' | 'row';
  onNavigate?: () => void;
}

function isRouteActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function NavLink({
  href,
  icon: Icon,
  children,
  variant = 'inline',
  onNavigate,
}: NavLinkProps) {
  const pathname = usePathname();
  const isActive = isRouteActive(pathname, href);

  if (variant === 'row') {
    return (
      <Link
        href={href}
        onClick={onNavigate}
        className={`group relative flex w-full items-center gap-3 rounded-xl px-4 py-2.5 transition-colors duration-200 ${
          isActive ? 'bg-amber-500/[0.08] font-bold text-amber-500' : 'text-gray-200 hover:text-amber-500'
        }`}
      >
        {isActive && (
          <span className="absolute bottom-1.5 left-0 top-1.5 w-[3px] rounded-full bg-amber-500" />
        )}
        <Icon
          className={`shrink-0 text-lg transition-colors duration-200 ${
            isActive ? 'text-amber-500' : 'text-gray-500 group-hover:text-amber-500/80'
          }`}
        />
        <span>{children}</span>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={`group flex items-center gap-2 transition-colors duration-200 ${
        isActive ? 'font-bold text-amber-500' : 'hover:text-amber-500'
      }`}
    >
      <Icon
        className={`shrink-0 text-[0.85em] transition-colors duration-200 ${
          isActive ? 'text-amber-500' : 'text-gray-500 group-hover:text-amber-500/80'
        }`}
      />
      <span>{children}</span>
    </Link>
  );
}
