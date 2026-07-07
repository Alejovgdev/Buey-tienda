'use client';

import Script from 'next/script';

export default function Reservas() {
  return (
    <section className="w-full px-4 md:px-0 md:max-w-4xl mx-auto py-12">
      <h2 className="text-amber-500 text-3xl md:text-3xl font-bold text-center mb-6">
        Reservar mesa
      </h2>
      {/* Carga el script de iFrameResizer (solo en esta página) */}
      <Script
        src="https://www.covermanager.com/js/iframeResizer/iframeResizer.min.js"
        strategy="afterInteractive"
        onLoad={() => {
          // Llamamos a iFrameResize cuando el script ya está cargado
          // @ts-ignore
          if (typeof window !== 'undefined' && (window as any).iFrameResize) {
            // @ts-ignore
            (window as any).iFrameResize(
              {},
              '#restaurante-el-buey-madurado-xativa'
            );
          }
        }}
      />

        <div className="bg-amber-100 p-2 md:p-6 rounded-3xl shadow-xl">
          <div className="rounded-2xl overflow-hidden bg-white">
          <iframe
            id="restaurante-el-buey-madurado-xativa"
            title="Reservas"
            src="https://www.covermanager.com/reservation/module_restaurant/restaurante-el-buey-madurado-xativa/spanish"
            allow="payment"
            frameBorder="0"
            height="550"
            width="100%"
          />
        </div>
      </div>

    </section>
  );
}
