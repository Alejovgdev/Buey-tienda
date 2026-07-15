'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';

export default function AdminHeader({ title }: { title: string }) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/admin/login');
    router.refresh();
  }

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-300 bg-white px-4 py-3 sm:px-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/pedidos" className="text-sm font-semibold uppercase tracking-wide text-gray-500 hover:text-gray-700">
          El Buey Madurado — Panel admin
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-base font-bold text-gray-900 sm:text-lg">{title}</h1>
      </div>
      <div className="flex items-center gap-3">
        <Link href="/admin/configuracion/etiquetas" className="text-sm font-medium text-gray-600 hover:text-gray-900">
          Configuración de etiquetas
        </Link>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {loggingOut ? 'Saliendo…' : 'Cerrar sesión'}
        </button>
      </div>
    </header>
  );
}
