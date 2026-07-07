'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { FaStar } from 'react-icons/fa';

interface Review {
    author: string;
    rating: number;
    text: string;
    date: string;
}

const reviews: Review[] = [
  {
    author: "Naira Mendieta Borja",
    rating: 5,
    text: "Excelente comida, desde la carne hasta los postres. Calidad y sabores increíbles. Volveré sin duda, lo recomiendo 100%.",
    date: "Ene 2026",
  },
  {
    author: "Luis Ballesteros",
    rating: 5,
    text: "Si quieres venir al mejor sitio de Xàtiva de carne madurada, este es tu sitio. Wagyu A5 top y vaca rubia gallega increíble. Trato de otro nivel. Recomendable 100%.",
    date: "Ene 2026",
  },
  {
    author: "Zayra Pavia",
    rating: 5,
    text: "Hamburguesas riquísimas, bien servidas y con ingredientes de calidad. Muy buena atención y ambiente agradable. ¡Súper recomendable!",
    date: "Ene 2026",
  },
  {
    author: "Alejandra Sarr Lladosa",
    rating: 5,
    text: "Las mejores hamburguesas que he probado en mucho tiempo. Ingredientes de calidad, sabor increíble y un ambiente que invita a volver. Servicio rápido y amable. Totalmente recomendado.",
    date: "Dic 2025",
  },
  {
    author: "Laura Santacatalina",
    rating: 5,
    text: "Se come muy bien, se nota la calidad de la carne.",
    date: "Dic 2025",
  },
  {
    author: "Sr. Pons",
    rating: 5,
    text: "Las mejores hamburguesas que encontrarás por la zona, sin duda alguna.",
    date: "Dic 2025",
  },
  {
    author: "Sergi Sarrià Domenech",
    rating: 5,
    text: "Excelente trato, rápido, bueno y a buen precio. Espectacular.",
    date: "Dic 2025",
  },
  {
    author: "Jorgito Caraballo",
    rating: 5,
    text: "Excelente comida, muy especial para cualquier ocasión. Recomendado 100%, 10 de 10. Probé el chuletón de vaca diamante y las hamburguesas cátala y garfield.",
    date: "Nov 2025",
  },
  {
    author: "ElOsOs 96",
    rating: 5,
    text: "No tiene sentido el producto que trabajan aquí. Lo mejor de Xàtiva y alrededores con diferencia. Mis dieces para ellos.",
    date: "Nov 2025",
  },
  {
    author: "Andrea Arenas",
    rating: 5,
    text: "De las mejores hamburguesas que he probado. La calidad de la carne es increíble.",
    date: "Nov 2025",
  },
];

export default function GoogleReviews() {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [direction, setDirection] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            const nextIndex = (currentIndex + 1) % reviews.length;
            setDirection(nextIndex > currentIndex ? 1 : -1);
            setCurrentIndex(nextIndex);
        }, 5000);
        return () => clearInterval(interval);
    }, [currentIndex]);

    return (
        <section className="py-20 bg-gradient-to-b from-black/20 to-black/40">
            <div className="max-w-5xl mx-auto px-6">
                {/* Título */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                    className="text-center mb-16"
                >
                    <h2 className="text-4xl md:text-5xl font-heading text-white uppercase tracking-wide mb-4">
                        Lo que dicen nuestros clientes
                    </h2>
                    <p className="text-white/70 text-lg max-w-2xl mx-auto">
                        Descubre por qué El Buey Madurado es el favorito de nuestros comensales
                    </p>
                    <div className="inline-flex items-center gap-3 text-amber-400 mb-6">
                        <FaStar className="text-3xl" />
                        <span className="text-3xl md:text-4xl font-bold">5.0</span>
                        <span className="text-white/80 text-lg md:text-xl">(55 reseñas en Google)</span>
                    </div>
                </motion.div>

                {/* Carrusel de cartas */}
                <div className="overflow-hidden">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentIndex}
                            initial={{ x: direction > 0 ? 400 : -400, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: direction > 0 ? -400 : 400, opacity: 0 }}
                            transition={{ duration: 0.6, ease: 'easeInOut' }}
                            className="min-h-[450px] md:min-h-[400px] flex items-center justify-center"
                        >
                            <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-8 md:p-12 border border-white/20 max-w-2xl w-full">
                                {/* Estrellas */}
                                <div className="flex gap-2 mb-8">
                                    {Array.from({ length: 5 }).map((_, i) => (
                                        <FaStar
                                            key={i}
                                            className="text-amber-400 fill-amber-400 text-2xl"
                                        />
                                    ))}
                                </div>

                                {/* Texto reseña */}
                                <p className="text-white/90 text-xl md:text-2xl leading-relaxed mb-10 italic font-light">
                                    "{reviews[currentIndex].text}"
                                </p>

                                {/* Autor y fecha */}
                                <div className="border-t border-white/20 pt-6">
                                    <p className="font-semibold text-white text-xl mb-1">
                                        {reviews[currentIndex].author}
                                    </p>
                                    <p className="text-white/60 text-sm flex items-center gap-2">
                                        <span>Verificado en Google</span>
                                        <span>•</span>
                                        <span>{reviews[currentIndex].date}</span>
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>
        </section>
    );
}
