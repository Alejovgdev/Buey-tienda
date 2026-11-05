'use client';

export default function Marquee({ restaurantHome = false }: { restaurantHome?: boolean }) {
  const message = restaurantHome
    ? '🍔 BURGER DEL MES DE NOVIEMBRE 🍔 LA NAVARRA · Carne de chuletón de vaca frisona madurada · queso Idiazábal de oveja ahumado · pimientos del piquillo · mayonesa de chistorra'
    : '🍔 BURGER DEL MES 🍔 CP BARBER 🔥 Carne de vaca rubia gallega +150 días · salsa casera de bits con quesos · carne desmechada de vaca · mermelada de cecina · pan untado con grasa de buey · bits crujientes y parmesano';
  return (
    <section className="marquee-section" aria-label={restaurantHome ? 'Burger del mes' : 'Marquee'}>
      <div className="marquee">
        <div className="marquee-track">
          <span>{message}</span>

          <span>{message}</span>
        </div>
      </div>
    </section>
  );
}
