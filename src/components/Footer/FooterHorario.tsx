// src/components/Footer/FooterHorario.tsx
import { FaPhoneAlt } from "react-icons/fa";

export default function FooterHorario() {
  return (
    <div className="text-center md:text-left">
      {/* TÍTULO */}
      <h3 className="text-amber-500 font-extrabold tracking-widest text-sm md:text-base uppercase mb-4">
        Horario
      </h3>

      {/* LISTA DE HORARIOS */}
      <ul className="space-y-2 text-sm md:text-[0.95rem] text-gray-300">
        <li className="flex flex-col md:flex-row md:items-center md:justify-between gap-1">
          <span className="font-semibold text-gray-200">Miércoles</span>
          <span className="text-white/90">Cerrado</span>
        </li>

        <li className="flex flex-col md:flex-row md:items-center md:justify-between gap-1">
          <span className="font-semibold text-gray-200">Lunes a Jueves</span>
          <span className="text-white/90">20:00 – 00:00</span>
        </li>

        <li className="flex flex-col md:flex-row md:items-start md:justify-between gap-1">
          <span className="font-semibold text-gray-200">Viernes</span>
          <span className="text-white/90 md:text-right leading-relaxed">
            13:00 – 16:30
            <br />
            20:00 – 00:00
          </span>
        </li>

        <li className="flex flex-col md:flex-row md:items-start md:justify-between gap-1">
          <span className="font-semibold text-gray-200">Sábado y Domingo</span>
          <span className="text-white/90 md:text-right leading-relaxed">
            13:00 – 16:30
            <br />
            20:15 – 00:30
          </span>
        </li>
      </ul>

      {/* BOTÓN LLAMADA */}
      <div className="mt-5 flex justify-center md:justify-start">
        <a
          href="tel:+34670775786"
          aria-label="Llamar al restaurante"
          className="
            inline-flex items-center gap-3
            px-5 py-2.5 rounded-full
            font-semibold text-sm
            bg-amber-500 text-[#1a1410]
            border-2 border-amber-500
            shadow-md
            transition-all duration-300
            hover:bg-[#1a1410] hover:text-amber-500
            hover:scale-105
          "
        >
          <FaPhoneAlt className="text-base" />
          Llamar ahora
        </a>
      </div>

      {/* NOTA */}
      <p className="mt-4 text-xs text-gray-400">
        Recomendamos reservar con antelación.
      </p>
    </div>
  );
}
