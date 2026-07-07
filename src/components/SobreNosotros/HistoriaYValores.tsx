'use client';

import { motion } from 'framer-motion';
import { FaStar } from 'react-icons/fa';

export default function HistoriaYValores() {
  return (
    <section className="py-20 bg-black">
      <div className="max-w-5xl mx-auto px-6">
        {/* Encabezado */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-heading text-white uppercase tracking-wide mb-6">
            Nuestra Historia
          </h2>
          <p className="text-amber-400 text-lg font-semibold">
            Tradición, pasión y excelencia en cada corte
          </p>
        </motion.div>

        {/* Contenido principal */}
        <div className="grid md:grid-cols-2 gap-12 items-center mb-20">
          {/* Texto */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="space-y-6"
          >
            <p className="text-white/90 text-lg leading-relaxed">
              <span className="text-amber-400 font-bold text-2xl">El Buey Madurado</span> nace de la pasión por la<span className="text-amber-400"> carne de calidad</span>. <br />En Xátiva, Valencia, decidimos crear un espacio donde la tradición gastronómica se encuentra con la excelencia.
            </p>

            <p className="text-white/90 text-lg leading-relaxed">
              Somos dos socios que comparten una <span className="text-amber-400">visión común</span>: ofrecer la mejor experiencia en carnes maduradas. Cada producto que llega a nuestra mesa ha sido cuidadosamente seleccionado.
            </p>

            <p className="text-white/90 text-lg leading-relaxed">
              <span className="text-amber-400">Si hay una frase que nos define es:</span>{" "}
              <span className="italic">< br/>“Cuñao, prueba esto que vas a flipar”.</span>
            </p>
          </motion.div>

          {/* Valores */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="space-y-6"
          >
            {/* Valor 1 */}
            <div className="bg-white/5 border border-amber-400/30 rounded-xl p-8 hover:border-amber-400/60 transition-all">
              <div className="flex items-start gap-4">
                <FaStar className="text-amber-400 text-2xl flex-shrink-0 mt-1" />
                <div>
                  <h3 className="text-white font-bold text-xl mb-2">Selección del producto</h3>
                    <p className="text-white/70">
                      De la mano de especialistas como Cárnicas LYO, escogemos cada pieza para que la carne hable por sí sola en cada plato.
                    </p>
                </div>
              </div>
            </div>

            {/* Valor 2 */}
            <div className="bg-white/5 border border-amber-400/30 rounded-xl p-8 hover:border-amber-400/60 transition-all">
              <div className="flex items-start gap-4">
                <FaStar className="text-amber-400 text-2xl flex-shrink-0 mt-1" />
                <div>
                  <h3 className="text-white font-bold text-xl mb-2">Bienestar Animal</h3>
                  <p className="text-white/70">
                    El bienestar de los animales es fundamental. Seleccionamos proveedores que comparten nuestros valores éticos y de sostenibilidad.
                  </p>
                </div>
              </div>
            </div>

            {/* Valor 3 */}
            <div className="bg-white/5 border border-amber-400/30 rounded-xl p-8 hover:border-amber-400/60 transition-all">
              <div className="flex items-start gap-4">
                <FaStar className="text-amber-400 text-2xl flex-shrink-0 mt-1" />
                <div>
                  <h3 className="text-white font-bold text-xl mb-2">Experiencia Premium</h3>
                  <p className="text-white/70">
                    Cada detalle importa. Desde la selección de la carne hasta la presentación final, buscamos crear momentos inolvidables.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Sección de filosofía */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="bg-gradient-to-r from-amber-900/20 via-black to-amber-900/20 border border-amber-400/20 rounded-2xl p-10 md:p-14 text-center"
        >
          <h3 className="text-3xl md:text-4xl font-heading text-white uppercase tracking-wide mb-6">
            Nuestra Filosofía
          </h3>
          <p className="text-white/90 text-lg md:text-xl leading-relaxed max-w-3xl mx-auto">
            <span className="text-amber-400 font-bold">"La carne no se explica, se respeta."</span> Este es nuestro mantra. 
            Desde el origen del animal hasta el fuego que lo cocina, cada proceso refleja nuestro compromiso con la <span className="text-amber-400">excelencia gastronómica</span>.
          </p>
          <p className="text-white/70 text-lg mt-6">
            En El Buey Madurado, no vendemos solo carne. Vendemos <span className="text-amber-400">experiencias</span>, 
            <span className="text-amber-400"> tradición</span> y la <span className="text-amber-400">dedicación</span> de quienes creen que los detalles son lo que hace grande un restaurante.
          </p>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="grid md:grid-cols-4 gap-6 mt-20"
        >
          {[
            { number: "5.0", label: "Rating en Google" },
            { number: "55+", label: "Reseñas verificadas" },
            { number: "100%", label: "Carne Premium" },
            { number: "2", label: "Socios apasionados" }
          ].map((stat, i) => (
            <div key={i} className="text-center">
              <p className="text-4xl font-bold text-amber-400 mb-2">{stat.number}</p>
              <p className="text-white/70 text-sm">{stat.label}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}