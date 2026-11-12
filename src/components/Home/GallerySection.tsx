'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';

const SLIDE_MS = 3200;

// Tablet y escritorio: 2 fotos. En móvil se conserva una foto por pantalla.
const TABLET_QUERY = '(min-width: 768px)';

const DESKTOP_SIZES = '(min-width: 1200px) 560px, 50vw';
const EMBEDDED_SIZES = '(min-width: 1600px) 330px, (min-width: 1280px) 264px, (min-width: 1024px) 23vw, 50vw';

// position: encuadre propio (clase object-*) para fotos que el recorte de móvil corta mal
type Slide = { src: string; alt: string; position?: string };

function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function GallerySection({ embedded = false }: { embedded?: boolean }) {
  const Container = embedded ? 'div' : 'section';
  const baseImages: Slide[] = useMemo(
    () => [
      { src: '/assets/images/local-fachada.webp', alt: 'Fachada de El Buey Madurado', position: 'object-[65%_center]' },
      { src: '/assets/images/local-sala.webp', alt: 'Sala del restaurante con las mesas preparadas', position: 'object-[85%_center]' },
      { src: '/assets/images/local-camara-maduracion.webp', alt: 'Cámara de maduración con piezas de carne', position: 'object-[25%_center]' },
      { src: '/assets/images/chuleton-corte.webp', alt: 'Chuletón madurado cortado en lonchas' },
      { src: '/assets/images/chuleton-bandeja.webp', alt: 'Chuletón fileteado servido en bandeja' },
      { src: '/assets/images/cecina.webp', alt: 'Plato de cecina en lonchas con sal en escamas' },
      { src: '/assets/images/burger-salsa.webp', alt: 'Hamburguesa con queso fundido y salsa' },
      { src: '/assets/images/burger-cecina.webp', alt: 'Hamburguesa con cecina y patatas fritas' },
      { src: '/assets/images/carne6.webp', alt: 'Pieza de carne madurada muy veteada junto al fuego' },
      { src: '/assets/images/carne7.webp', alt: 'Lomo de vaca madurado sobre una mesa de madera' },
      { src: '/assets/images/burger-cheddar.webp', alt: 'Hamburguesa con cheddar fundido y salsa' },
      { src: '/assets/images/local-equipo.webp', alt: 'Dos personas se abrazan en el local' },
    ],
    []
  );

  // SSR/CSR primer render determinista
  const [images, setImages] = useState<Slide[]>(baseImages);

  // Tablet/desktop carrusel: fotos visibles a la vez (0 en móvil)
  const [visible, setVisible] = useState(0);
  // index: primera foto visible; furthest: el index más alto alcanzado (decide qué fotos se montan)
  const [pos, setPos] = useState({ index: 0, furthest: 0 });
  const desktopDirRef = useRef<1 | -1>(1);
  const desktopRef = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);
  const [activated, setActivated] = useState(false);

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

    setPos({ index: 0, furthest: 0 });
    desktopDirRef.current = 1;

    mobileIndexRef.current = 0;
    mobileDirRef.current = 1;

    scrollerRef.current?.scrollTo({ left: 0, behavior: 'auto' });
  }, [baseImages]);

  // Desktop: cuántas fotos caben según el breakpoint
  useEffect(() => {
    const md = window.matchMedia(TABLET_QUERY);
    const update = () => setVisible(md.matches ? 2 : 0);

    update();
    md.addEventListener('change', update);
    return () => {
      md.removeEventListener('change', update);
    };
  }, []);

  // Desktop: solo carga y avanza cuando la galería está (casi) en pantalla
  useEffect(() => {
    const el = desktopRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
        if (entry.isIntersecting) setActivated(true);
      },
      { rootMargin: '200px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Al cambiar de tamaño, que no quede hueco vacío al final.
  const maxIndex = Math.max(0, images.length - visible);
  useEffect(() => {
    setPos((p) => (p.index > maxIndex ? { ...p, index: maxIndex } : p));
  }, [maxIndex]);

  // Desktop ping-pong, de una en una
  useEffect(() => {
    const n = images.length;
    if (!visible || !inView || n <= visible) return;
    const max = n - visible;

    const id = window.setInterval(() => {
      setPos(({ index, furthest }) => {
        let dir = desktopDirRef.current;
        if (index >= max) dir = -1;
        else if (index <= 0) dir = 1;
        desktopDirRef.current = dir;
        const next = index + dir;
        return { index: next, furthest: Math.max(furthest, next) };
      });
    }, SLIDE_MS);

    return () => window.clearInterval(id);
  }, [images.length, visible, inView]);

  // Se montan las fotos ya vistas + la siguiente que va a entrar por la derecha
  const mountUpTo = activated ? pos.furthest + visible : -1;

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
    <Container className={embedded ? 'w-full min-w-0' : 'w-full px-4 md:px-6 py-10 md:py-14'} aria-label="Fotos del restaurante y nuestros platos">
      <div className="max-w-6xl mx-auto">
        {!embedded && <div className="mb-5 md:mb-7">
          <h2 className="text-white text-2xl md:text-4xl font-bold leading-tight">
            El producto mas exclusivo.
            <span className="text-amber-500"> Todo por vosotros.</span>
          </h2>
          <p className="text-white/70 text-sm md:text-base mt-3 max-w-2xl">
            Maduración · Experiencia · Pasión
          </p>
        </div>}

        {/* En md+ solo recorta el carrusel; el borde lo lleva cada foto */}
        <div className="relative overflow-hidden rounded-3xl ring-1 ring-white/10 shadow-2xl md:ring-0 md:shadow-none">
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

              {images.map((img) => (
                <div key={img.src} className="hide-scrollbar w-full flex-none snap-center">
                  <div className="relative w-full aspect-[3/4] bg-black">
                    <Image
                      src={img.src}
                      alt=""
                      fill
                      sizes="100vw"
                      className="object-cover blur-2xl scale-110 opacity-55"
                    />
                    <Image
                      src={img.src}
                      alt={img.alt}
                      fill
                      sizes="100vw"
                      className={`object-cover ${img.position ?? 'object-center'}`}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* DESKTOP */}
          <div ref={desktopRef} className="hidden md:block">
            {/* Separación con padding + margen negativo: cada paso sigue siendo 100%/visible del track */}
            <div
              className="flex -mx-2 lg:-mx-3 transition-transform duration-700 ease-in-out"
              style={visible ? { transform: `translateX(-${(pos.index * 100) / visible}%)` } : undefined}
            >
              {images.map((img, i) => (
                <div key={img.src} className="w-1/2 flex-none px-2 lg:px-3">
                  <div className="relative aspect-[3/4] overflow-hidden rounded-3xl bg-black">
                    {i <= mountUpTo && (
                      <Image
                        src={img.src}
                        alt={img.alt}
                        fill
                        loading="eager"
                        sizes={embedded ? EMBEDDED_SIZES : DESKTOP_SIZES}
                        className={`object-cover ${img.position ?? 'object-center'}`}
                      />
                    )}
                    <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-white/10" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="md:hidden text-white/60 text-sm mt-4">
          Un vistazo rápido al local y nuestro producto. Puro disfrute.
        </p>
      </div>
    </Container>
  );
}
