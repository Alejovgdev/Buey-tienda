'use client';

import Link from 'next/link';
import { FaBalanceScale, FaFingerprint, FaCookie } from 'react-icons/fa';
import { useConsent } from '@/contexts/ConsentContext';

export default function FooterLegal() {
  const { openPanel } = useConsent();

  return (
    <div className="text-center md:text-left">
      <h3 className="text-amber-500 font-bold text-lg mb-3 uppercase">Legal</h3>
      <ul className="space-y-2 text-sm">
        <li className="flex justify-center md:justify-start items-center gap-2">
          <FaBalanceScale className="text-amber-500 shrink-0" aria-hidden="true" />
          <Link
            href="/aviso-legal"
            className="hover:text-amber-500 transition-colors"
          >
            Términos y condiciones
          </Link>
        </li>
        <li className="flex justify-center md:justify-start items-center gap-2">
          <FaFingerprint className="text-amber-500 shrink-0" aria-hidden="true" />
          <Link
            href="/politica-de-privacidad"
            className="hover:text-amber-500 transition-colors"
          >
            Política de privacidad
          </Link>
        </li>
        <li className="flex justify-center md:justify-start items-center gap-2">
          <FaCookie className="text-amber-500 shrink-0" aria-hidden="true" />
          <button
            onClick={openPanel}
            className="hover:text-amber-500 transition-colors text-left focus:outline-none focus-visible:underline"
          >
            Configuración de cookies
          </button>
        </li>
      </ul>
    </div>
  );
}
