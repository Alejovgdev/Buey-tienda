import Image from 'next/image';
import Link from 'next/link';
import { FaWhatsapp } from 'react-icons/fa';
import {
  TbAward, TbClockHour4, TbHeart, TbMail, TbMapPin,
  TbPhone, TbShoppingBag, TbToolsKitchen2,
} from 'react-icons/tb';
import ConditionalMap from '@/components/Cookies/ConditionalMap';
import type { HomeProductData } from '@/types/shop';
import GallerySection from './GallerySection';
import HomeProductCard from './HomeProductCard';
import styles from './HomeLanding.module.css';

const MEAT_IMAGE = '/assets/images/chuleton-corte.webp';
const MAPS_URL = 'https://maps.app.goo.gl/PFgL2Ww84fGHULMp6';
const REVIEWS_URL = 'https://www.google.com/search?sca_esv=2e0ce5bd22b7d86a&rlz=1C1UEAD_esES1083ES1083&si=AL3DRZEsmMGCryMMFSHJ3StBhOdZ2-6yYkXd_doETEE1OR-qOZQSB00aZ9I88OJyJo2CaVn39NapAOp2oRtRFPSbooL-VkyvtQ4Aj3t2f9UyQEvOI7IyvclMC-FVOZ18KA_xjmI4EhBRdN1gAUgChJ6eZhUQ7Tu0EQ%3D%3D&q=Restaurante+el+buey+madurado+Rese%C3%B1as';

const qualities = [
  { icon: TbClockHour4, title: 'Maduración', text: 'Cada pieza reposa varios días en cámara hasta ganar sabor y terneza.' },
  { icon: TbAward, title: 'Experiencia', text: '+2 años trabajando la carne madurada en Xàtiva.' },
  { icon: TbHeart, title: 'Pasión', text: 'Cuidamos cada corte igual, lo comas aquí o en tu casa.' },
];

const shippingSteps = [
  { title: 'Elige tus cortes', text: 'Haz tu pedido en la tienda online cuando quieras.' },
  { title: 'Lo preparamos', text: 'Envasamos tu pedido y sale con SEUR Frío.' },
  { title: 'Te llega en frío', text: 'Lo recibes refrigerado en 24/48 horas.' },
];

export default function HomeLanding({ products }: { products: HomeProductData[] }) {
  return (
    <div className={styles.home}>
      <section className={styles.hero} aria-labelledby="home-title">
        <div className={styles.heroVideo} aria-hidden="true">
          <video autoPlay muted loop playsInline preload="metadata" poster="/hero-poster.webp">
            <source src="/hero-restaurante.mp4" type="video/mp4" />
          </video>
        </div>
        <div className={`${styles.container} ${styles.heroGrid}`}>
          <div className={styles.heroContent}>
            <div>
              <h1 id="home-title">Carne madurada en Xàtiva.<br /><span>Cómela aquí o llévatela a casa.</span></h1>
              <p className={styles.heroDescription}>Nuestro restaurante en Calle Reina y una tienda online que te envía la carne en frío.</p>
            </div>
            <div className={styles.heroActions}>
              <Link href="/reservas" className={styles.choiceCard}>
                <TbToolsKitchen2 aria-hidden="true" />
                <span>En el restaurante</span>
                <strong>Reservar mesa</strong>
              </Link>
              <Link href="/tienda" className={styles.choiceCard}>
                <TbShoppingBag aria-hidden="true" />
                <span>En tu casa</span>
                <strong>Comprar carne</strong>
              </Link>
            </div>
          </div>
          <div className={styles.heroPhoto}>
            <video autoPlay muted loop playsInline preload="metadata" poster="/hero-poster.webp" aria-label="Preparación de nuestros platos en El Buey Madurado">
              <source src="/hero-restaurante.mp4" type="video/mp4" />
            </video>
          </div>
        </div>
      </section>

      <section className={styles.shopSection} aria-labelledby="home-shop-title">
        <div className={`${styles.container} ${styles.shopLayout}`}>
          <header className={styles.sectionHeading}>
            <h2 id="home-shop-title">Llévatela a casa</h2>
            <p>Nuestra carne madurada, envasada y enviada con SEUR Frío.</p>
          </header>
          <Link href="/tienda" className={`${styles.button} ${styles.outlineButton} ${styles.shopLink}`}>Ver toda la tienda</Link>
          <ul className={styles.productGrid} aria-label="Productos de la tienda">
            {products.map((product) => (
              <HomeProductCard product={product} key={product.slug} />
            ))}
          </ul>
          {products.length === 0 && <p className={styles.productsUnavailable}>Consulta los productos disponibles en la tienda.</p>}
        </div>
      </section>

      <section className={styles.qualitySection} aria-labelledby="home-quality-title">
        <div className={`${styles.container} ${styles.splitGrid}`}>
          <div className={styles.qualityPhoto}>
            <Image src={MEAT_IMAGE} alt="Detalle del corte y la textura de nuestra carne madurada" fill sizes="(min-width: 1280px) 560px, (min-width: 768px) 45vw, 90vw" />
          </div>
          <div>
            <h2 id="home-quality-title">Por qué sabe así</h2>
            <ul className={styles.qualityList}>
              {qualities.map(({ icon: Icon, title, text }) => (
                <li key={title}>
                  <span className={styles.roundIcon}><Icon aria-hidden="true" /></span>
                  <div><h3>{title}</h3><p>{text}</p></div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section id="envios" className={styles.shippingSection} aria-labelledby="home-shipping-title">
        <div className={styles.container}>
          <h2 id="home-shipping-title">Cómo llega a tu casa</h2>
          <ol className={styles.shippingSteps}>
            {shippingSteps.map((step, index) => (
              <li key={step.title}>
                <span className={styles.stepNumber} aria-hidden="true">{index + 1}</span>
                <div><h3>{step.title}</h3><p>{step.text}</p></div>
              </li>
            ))}
          </ol>
          <p className={styles.shippingNote}>Enviamos a toda la peninsula.</p>
        </div>
      </section>

      <section className={styles.restaurantSection} aria-labelledby="home-restaurant-title">
        <div className={`${styles.container} ${styles.splitGrid} ${styles.restaurantGrid}`}>
          <div className={styles.restaurantContent}>
            <h2 id="home-restaurant-title">Ven a comer</h2>
            <p>Te esperamos en Calle Reina, 41, Xàtiva. Mira la carta y reserva tu mesa.</p>
            <div className={styles.restaurantActions}>
              <Link href="/carta" className={`${styles.button} ${styles.outlineButton}`}>Ver carta</Link>
              <Link href="/reservas" className={styles.button}>Reservar mesa</Link>
            </div>
            <div className={styles.reviews}>
              <div className={styles.reviewHeading}>
                <div><span>Opiniones</span><h3>Nuestras reseñas en Google</h3></div>
                <span className={styles.stars} aria-label="Cinco estrellas">★★★★★</span>
              </div>
              <div className={styles.reviewActions}>
                <a href={REVIEWS_URL} target="_blank" rel="noreferrer" className={styles.reviewLink}>Ver reseñas</a>
                <a href={REVIEWS_URL} target="_blank" rel="noreferrer" className={styles.button}>Déjanos tu opinión</a>
              </div>
            </div>
          </div>
          <div className={styles.restaurantGallery}>
            <GallerySection embedded />
          </div>
        </div>
      </section>

      <section id="contact" className={styles.contactSection} aria-labelledby="home-contact-title">
        <div className={`${styles.container} ${styles.contactGrid}`}>
          <div>
            <h2 id="home-contact-title">Contacto y ubicación</h2>
            <p className={styles.contactIntro}>Reservas, pedidos de la tienda o dudas: escríbenos y te respondemos.</p>
            <a href="https://wa.me/34670775786" target="_blank" rel="noreferrer" className={styles.whatsapp}>
              <span><span className={styles.whatsappIcon}><FaWhatsapp aria-hidden="true" /></span>WhatsApp</span>
              <span>Escríbenos</span>
            </a>
            <dl className={styles.contactDetails}>
              <div><TbPhone aria-hidden="true" /><div><dt>Teléfono</dt><dd><a href="tel:+34670775786">+34 670 77 57 86</a></dd></div></div>
              <div><TbMail aria-hidden="true" /><div><dt>Email</dt><dd><a href="mailto:elbueymaduradoxativa@gmail.com">elbueymaduradoxativa@gmail.com</a></dd></div></div>
              <div><TbMapPin aria-hidden="true" /><div><dt>Dirección</dt><dd>Calle Reina, 41. Xàtiva, Valencia</dd></div></div>
            </dl>
          </div>
          <div className={styles.map}>
            <ConditionalMap />
            <a href={MAPS_URL} target="_blank" rel="noreferrer" className={styles.mapsLink}>Abrir en Maps</a>
          </div>
        </div>
      </section>
    </div>
  );
}
