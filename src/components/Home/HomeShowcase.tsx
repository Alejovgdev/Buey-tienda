// Vitrina de prueba del home: imagen recortada (fondo transparente) con el
// nombre y el precio debajo. Datos fijos, no vienen del catálogo.
// Para revertir: poner SHOW_TEST_SHOWCASE = false en HomeLanding.tsx
// (o borrar este archivo, HomeShowcase.module.css y ese interruptor).
import Image from 'next/image';
import Link from 'next/link';
import { formatPriceFromCents } from '@/lib/format-price';
import landingStyles from './HomeLanding.module.css';
import styles from './HomeShowcase.module.css';

const showcaseItems = [
  { name: 'Buey nacional madurado 200 días', price: 8900, image: '/assets/images/carne-fondo-trans-buey.png' },
  { name: 'Vaca Simmental madurada 90 días', price: 5450, image: '/assets/images/carne-fondo-trans-simmental.png' },
  { name: 'Wagyu A5 máximo marmoleado', price: 18900, image: '/assets/images/carne-fondo-trans-Wagyu.png' },
];

export default function HomeShowcase() {
  return (
    <ul className={`${landingStyles.productGrid} ${styles.grid}`} aria-label="Productos de la tienda">
      {showcaseItems.map((item) => (
        <li key={item.name} className={styles.item}>
          <Link href="/tienda" className={styles.link}>
            <span className={styles.image}>
              <Image src={item.image} alt={item.name} fill loading="eager" sizes="(min-width: 1280px) 380px, (min-width: 768px) 30vw, 46vw" />
            </span>
            <h3 className={styles.name}>{item.name}</h3>
            <strong className={styles.price}>{formatPriceFromCents(item.price)}</strong>
          </Link>
        </li>
      ))}
    </ul>
  );
}
