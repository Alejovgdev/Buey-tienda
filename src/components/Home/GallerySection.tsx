'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';

const SLIDE_MS = 3200;

type Slide = { src: string; alt: string };

function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function GallerySection() {
  const baseImages: Slide[] = useMemo(
    () => [
      { src: '/assets/images/local1img.jpeg', alt: 'El local' },
      { src: '/assets/images/local2img.jpeg', alt: 'El local' },
      { src: '/assets/images/local3img.jpeg', alt: 'El local' },
      { src: '/assets/images/carne1.jpeg', alt: 'Carne' },
      { src: '/assets/images/carne2.jpeg', alt: 'Carne' },
      { src: '/assets/images/carne3.jpeg', alt: 'Carne' },
      { src: '/assets/images/carne4.PNG', alt: 'Carne' },
      { src: '/assets/images/carne5.jpeg', alt: 'Carne' },
      { src: '/assets/images/carne6.jpeg', alt: 'Carne' },
      { src: '/assets/images/carne7.PNG', alt: 'Carne' },
      { src: '/assets/images/carne9.PNG', alt: 'Carne' },
      { src: '/assets/images/carne10.jpeg', alt: 'Carne' },
    ],
    []
  );

  // SSR/CSR primer render determinista
  const [images, setImages] = useState<Slide[]>(baseImages);

  // Desktop crossfade
  const [index, setIndex] = useState(0);
  const desktopDirRef = useRef<1 | -1>(1);

  // Mobile scroller
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const mobileIndexRef = useRef(0);
  const mobileDirRef = useRef<1 | -1>(1);

  // Pause on user interaction
  const pauseRef = useRef(false);
  const resumeTimerRef = useRef<number | null>(null);

  // Throttle scroll
  const rafRef = useRef<number | null>(null);

  // Shuffle solo en cliente
  useEffect(() => {
    const shuffled = shuffle(baseImages);
    setImages(shuffled);

    setIndex(0);
    desktopDirRef.current = 1;

    mobileIndexRef.current = 0;
    mobileDirRef.current = 1;

    scrollerRef.current?.scrollTo({ left: 0, behavior: 'auto' });
  }, [baseImages]);

  // Desktop ping-pong
  useEffect(() => {
    const n = images.length;
    if (n <= 1) return;

    const id = window.setInterval(() => {
      setIndex((prev) => {
        let dir = desktopDirRef.current;
        if (prev === n - 1) dir = -1;
        else if (prev === 0) dir = 1;
        desktopDirRef.current = dir;
        return prev + dir;
      });
    }, SLIDE_MS);

    return () => window.clearInterval(id);
  }, [images.length]);

  // Mobile ping-pong
  useEffect(() => {
    const n = images.length;
    if (n <= 1) return;

    const id = window.setInterval(() => {
      if (pauseRef.current) return;

      const el = scrollerRef.current;
      if (!el) return;

      const cur = mobileIndexRef.current;
      let dir = mobileDirRef.current;
      if (cur === n - 1) dir = -1;
      else if (cur === 0) dir = 1;

      const next = cur + dir;
      mobileDirRef.current = dir;
      mobileIndexRef.current = next;

      el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' });
    }, SLIDE_MS);

    return () => window.clearInterval(id);
  }, [images.length]);

  // User interaction / scroll handling (throttled)
  useEffect(() => {
    const el = scrollerRef.current;
    const n = images.length;
    if (!el || n <= 1) return;

    const pauseTemporarily = () => {
      pauseRef.current = true;
      if (resumeTimerRef.current) window.clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = window.setTimeout(() => {
        pauseRef.current = false;
      }, 2500);
    };

    const updateIndexFromScroll = () => {
      rafRef.current = null;
      const w = el.clientWidth || 1;
      const raw = Math.round(el.scrollLeft / w);
      const i = Math.max(0, Math.min(n - 1, raw));
      mobileIndexRef.current = i;

      // prepara dirección “natural” al llegar a extremos
      if (i === n - 1) mobileDirRef.current = -1;
      else if (i === 0) mobileDirRef.current = 1;
    };

    const onScroll = () => {
      pauseTemporarily();
      if (rafRef.current != null) return;
      rafRef.current = window.requestAnimationFrame(updateIndexFromScroll);
    };

    const onPointer = () => pauseTemporarily();

    el.addEventListener('scroll', onScroll, { passive: true });
    el.addEventListener('touchstart', onPointer, { passive: true });
    el.addEventListener('pointerdown', onPointer, { passive: true });

    return () => {
      el.removeEventListener('scroll', onScroll);
      el.removeEventListener('touchstart', onPointer);
      el.removeEventListener('pointerdown', onPointer);

      if (resumeTimerRef.current) window.clearTimeout(resumeTimerRef.current);
      if (rafRef.current != null) window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [images.length]);

  return (
    <section className="w-full px-4 md:px-6 py-10 md:py-14">
      <div className="max-w-6xl mx-auto">
        <div className="mb-5 md:mb-7">
          <h2 className="text-white text-2xl md:text-4xl font-bold leading-tight">
            El producto mas exclusivo.
            <span className="text-amber-500"> Todo por vosotros.</span>
          </h2>
          <p className="text-white/70 text-sm md:text-base mt-3 max-w-2xl">
            Maduración · Experiencia · Pasión
          </p>
        </div>

        <div className="relative overflow-hidden rounded-3xl ring-1 ring-white/10 shadow-2xl">
          {/* MÓVIL */}
          <div className="md:hidden -mx-4">
            <div
              ref={scrollerRef}
              className="
                flex overflow-x-auto overflow-y-hidden
                snap-x snap-mandatory
                scroll-smooth
                [scrollbar-width:none]
                overscroll-x-contain
              "
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              <style>{`
                .hide-scrollbar::-webkit-scrollbar { display: none; }
              `}</style>

              {images.map((img, i) => (
                <div key={img.src} className="hide-scrollbar w-full flex-none snap-center">
                  <div className="relative w-full aspect-[3/4] bg-black">
                    <Image
                      src={img.src}
                      alt=""
                      fill
                      sizes="100vw"
                      priority={i === 0}
                      className="object-cover blur-2xl scale-110 opacity-55"
                    />
                    <Image
                      src={img.src}
                      alt={img.alt}
                      fill
                      sizes="100vw"
                      priority={i === 0}
                      className="object-cover object-center"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* DESKTOP */}
          <div className="hidden md:block">
            <div className="relative w-full aspect-[16/7] bg-black">
              {images.map((img, i) => (
                <div
                  key={img.src}
                  className={`absolute inset-0 transition-opacity duration-700 ${
                    i === index ? 'opacity-100' : 'opacity-0'
                  }`}
                >
                  <Image
                    src={img.src}
                    alt=""
                    fill
                    sizes="(min-width: 768px) 1200px, 100vw"
                    className="object-cover blur-2xl scale-110 opacity-50"
                  />
                  <Image
                    src={img.src}
                    alt={img.alt}
                    fill
                    sizes="(min-width: 768px) 1200px, 100vw"
                    className="object-cover object-center"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="md:hidden text-white/60 text-sm mt-4">
          Un vistazo rápido al local y nuestro producto. Puro disfrute.
        </p>
      </div>
    </section>
  );
}
