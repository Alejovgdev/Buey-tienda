'use client';

import Link from 'next/link';
import { CldImage } from 'next-cloudinary';
import { useState } from 'react';

export default function Logo() {
  const [animKey, setAnimKey] = useState(0);

  return (
    <Link
      href="/"
      className="group flex min-w-0 flex-1 items-center gap-3 sm:gap-5 md:gap-5 lg:gap-6 xl:gap-7"
      onClick={() => setAnimKey((k) => k + 1)}
      aria-label="Ir al inicio"
    >
      <span className="flex w-[68px] shrink-0 flex-col items-center gap-1.5 sm:w-[100px] md:w-[110px] md:gap-2 lg:w-[130px] xl:w-[150px]">
        <CldImage
          src="Logo-Buey_t9mc4b"
          alt="El Buey Madurado"
          width={190}
          height={190}
          className="h-16 w-auto object-contain sm:h-24 md:h-24 lg:h-28 xl:h-32"
        />
        <span
          className="h-px w-full bg-gradient-to-l from-amber-500/85 to-transparent"
          aria-hidden="true"
        />
      </span>

      <div className="flex min-w-0 flex-col justify-center leading-none">
        <div className="mb-1 flex items-center gap-3 md:mb-2 md:gap-6">
          <span
            key={`el-${animKey}`}
            className="logo-slide logo-slide-1 font-serif text-xs font-bold uppercase tracking-[0.16em] text-amber-400 sm:text-base md:text-lg lg:text-xl xl:text-2xl"
          >
            EL
          </span>
          <span
            className="h-px w-14 bg-gradient-to-r from-amber-500/85 to-transparent sm:w-28 md:w-40 lg:w-56 xl:w-72"
            aria-hidden="true"
          />
        </div>
        <span
          key={`buey-${animKey}`}
          className="logo-slide logo-slide-2 bg-gradient-to-b from-amber-200 via-amber-400 to-amber-600 bg-clip-text font-serif text-[2.625rem] font-bold uppercase leading-[0.82] tracking-normal text-transparent [text-shadow:0_2px_14px_rgba(245,158,11,0.2)] sm:text-[4rem] md:text-[4rem] lg:text-[4.625rem] xl:text-[5.25rem]"
        >
          BUEY
        </span>
        <span
          key={`madurado-${animKey}`}
          className="logo-slide logo-slide-3 mt-2 font-serif text-[10px] font-semibold uppercase tracking-[0.26em] text-white/90 sm:text-sm sm:tracking-[0.36em] md:mt-2 md:text-lg md:tracking-[0.42em] lg:text-xl xl:text-2xl"
        >
          MADURADO
        </span>
      </div>
    </Link>
  );
}
