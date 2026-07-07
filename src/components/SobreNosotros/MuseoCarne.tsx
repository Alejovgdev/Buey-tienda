'use client';

import { motion } from "framer-motion";

type PiezaCarneProps = {
  title: string;
  origin: string;
  breed: string;
  aging: string;
  description: string;
  image: string;
  reverse?: boolean;
};

function PiezaCarne({
  title,
  origin,
  breed,
  aging,
  description,
  image,
  reverse = false,
}: PiezaCarneProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 items-center"
    >
      {/* IMAGEN CON TEXTO */}
      <motion.div
        initial={{ scale: 1.04 }}
        whileInView={{ scale: 1 }}
        transition={{ duration: 1.1, ease: "easeOut" }}
        className={`relative ${reverse ? "md:order-2" : ""}`}
      >
        <img
          src={image}
          alt={title}
          className="w-full aspect-[4/5] md:aspect-[3/4] object-cover rounded-2xl shadow-2xl"
        />

        {/* Degradado */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-black/85 via-black/35 to-transparent" />

        {/* Texto dentro */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.6, ease: "easeOut" }}
          className="absolute bottom-5 left-5 right-5 md:bottom-6 md:left-6 md:right-6"
        >
          <h3 className="text-2xl sm:text-3xl md:text-4xl font-heading text-amber-300 uppercase tracking-wide leading-tight">
            {title}
          </h3>

          <ul className="mt-2 space-y-1 text-[11px] sm:text-xs uppercase tracking-widest text-white/80">
            <li><strong>Procedencia:</strong> {origin}</li>
            <li><strong>Raza:</strong> {breed}</li>
            <li><strong>Maduración:</strong> {aging}</li>
          </ul>
        </motion.div>
      </motion.div>

      {/* DESCRIPCIÓN */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.7, ease: "easeOut" }}
        className="space-y-4 md:space-y-6"
      >
        <p className="text-white/90 text-base sm:text-lg leading-relaxed max-w-xl">
          {description}
        </p>
      </motion.div>
    </motion.div>
  );
}

export default function MuseoCarne() {
  return (
    <section className="w-full py-24 md:py-32 px-6">
      <div className="max-w-6xl mx-auto space-y-28 md:space-y-40">
        <PiezaCarne
          title="Lomo alto"
          origin="Galicia"
          breed="Buey gallego"
          aging="+60 días"
          description="Corte jugoso y con carácter, perfecto para disfrutar del sabor y la textura en su punto."
          image="/assets/images/carneSobreNosotros1.jpg"
        />

        <PiezaCarne
          reverse
          title="Lomo bajo"
          origin="Galicia"
          breed="Vaca rubia gallega"
          aging="+ 45 días"
          description="Más fino y equilibrado, con una mordida suave y un sabor redondo que engancha."
          image="/assets/images/carneSobreNosotros2.jpg"
        />

        <PiezaCarne
          title="Wagyu"
          origin="Kobe, Japón"
          breed="Tajima-gyu"
          aging="Seleccionada"
          description="Grasa increíblemente fina y sabor intenso: una pieza para probar sin prisas y disfrutar."
          image="/assets/images/carneSobreNosotros3.png"
        />
      </div>
    </section>
  );
}
