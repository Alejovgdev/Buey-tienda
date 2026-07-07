'use client';

import { motion } from 'framer-motion';

export default function HeroSectionSobreNosotros() {
  return (
    <section className="relative h-screen w-full overflow-hidden flex flex-col items-center justify-start pt-16 pb-10">
      {/* Background imagen */}
      <img
        src="/assets/images/hero-Sobre-Nosotros.jpeg"
        alt="Sobre nosotros - fondo"
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: 'easeOut' }}
        className="relative z-10 flex flex-col items-center text-center px-6 max-w-4xl"
      >
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-heading text-white/90 uppercase tracking-wide leading-tight">
          El bienestar de los animales es importante para nosotros
        </h1>
      </motion.div>
    </section>
  );
}
