'use client';

import { useEffect, useRef, useState } from 'react';
import { menuItems, type MenuItem } from '@/data/menu';
import './carta.css';

const slides: { key: MenuItem['categoria']; titulo: string }[] = [
  { key: 'Entrantes', titulo: 'Entrantes' },
  { key: 'Carnes', titulo: 'Carnes' },
  { key: 'Hamburguesas', titulo: 'Burgers' },
  { key: 'Postres', titulo: 'Postres' },
  { key: 'Bebidas', titulo: 'Bebidas' },
];

const NAV_OFFSET_FALLBACK = 150;
const SECTION_ACTIVATION_OFFSET = 80;
const SECTION_SCROLL_GAP = 16;

export default function CartaPage() {
  const [currentSlide, setCurrentSlide] = useState(0);

  const categoryNavRef = useRef<HTMLElement>(null);
  const cartaSectionRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<(HTMLDivElement | null)[]>(
    new Array(slides.length).fill(null)
  );

  const getCategoryNavOffset = () => {
    return (
      categoryNavRef.current?.getBoundingClientRect().bottom ??
      NAV_OFFSET_FALLBACK
    );
  };

  // Scrollspy: mark category as active when its section enters the visible area
  useEffect(() => {
    const handleScroll = () => {
      // Iterate from last section to first; first match from bottom = active section
      for (let i = slides.length - 1; i >= 0; i--) {
        const el = sectionRefs.current[i];
        if (!el) continue;
        const top = el.getBoundingClientRect().top;
        if (top <= getCategoryNavOffset() + SECTION_ACTIVATION_OFFSET) {
          setCurrentSlide(i);
          return;
        }
      }
      setCurrentSlide(0);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // sync on mount
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleNavegaCategoria = (index: number) => {
    const el = sectionRefs.current[index];
    if (!el) return;
    const top =
      el.getBoundingClientRect().top +
      window.scrollY -
      getCategoryNavOffset() -
      SECTION_SCROLL_GAP;
    window.scrollTo({ top, behavior: 'smooth' });
  };

  const handleAbrirProducto = () => {};

  const renderBebidasLista = (items: MenuItem[]) => (
    <ul className="bebidas-list">
      {items.map((bebida) => (
        <li key={bebida.id} className="bebidas-item">
          <div className="bebidas-info">
            <span className="bebidas-name">{bebida.nombre}</span>
            {bebida.descripcion && (
              <span className="bebidas-desc">{bebida.descripcion}</span>
            )}
          </div>
          <span className="bebidas-price">{bebida.precio}</span>
        </li>
      ))}
    </ul>
  );

  const renderProductoCard = (producto: MenuItem, itemClassName?: string) => {
    const esSuplemento = producto.tipo === 'Suplemento';
    const className = [
      'carta-product-item',
      'carta-product-item--noimage',
      itemClassName,
      esSuplemento
        ? 'bg-gradient-to-br from-amber-50 to-amber-100 border-2 border-amber-500 shadow-lg shadow-amber-300 ring-2 ring-amber-400'
        : '',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <button
        key={producto.id}
        type="button"
        className={className}
        onClick={() => handleAbrirProducto()}
      >
        <div className="carta-product-info">
          <div className="carta-product-header">
            <h3
              className={`carta-product-name ${
                esSuplemento ? 'text-amber-900 font-bold text-lg' : ''
              }`}
            >
              {esSuplemento && '⭐ '}
              {producto.nombre}
            </h3>
          </div>

          <p
            className={`carta-product-description ${
              esSuplemento ? 'text-amber-800 italic' : ''
            }`}
            style={{ whiteSpace: 'pre-line' }}
          >
            {producto.descripcion}
          </p>

          {producto.alergenos && (
            <p className="carta-product-allergens">
              <span>Alérgenos:</span> {producto.alergenos}
            </p>
          )}

          <div
            className={`carta-product-price-bottom ${
              esSuplemento ? 'text-amber-700 font-bold text-lg' : ''
            }`}
          >
            {producto.precio}
          </div>
        </div>
      </button>
    );
  };

  const renderProductosGrid = (
    items: MenuItem[],
    options?: { gridClassName?: string; itemClassName?: string }
  ) => (
    <div
      className={['carta-products-grid', options?.gridClassName]
        .filter(Boolean)
        .join(' ')}
    >
      {items.map((producto) =>
        renderProductoCard(producto, options?.itemClassName)
      )}
    </div>
  );

  const renderSeccionProductos = (
    categoria: MenuItem['categoria'],
    productos: MenuItem[]
  ) => {
    const esBebidas = categoria === 'Bebidas';
    const esCarnes = categoria === 'Carnes';
    const bebidasPrincipales = ['Cervezas', 'Refrescos', 'Cafes', 'Cavas'] as const;
    const esPostres = categoria === 'Postres';
    const postresBuey = [
      'postre carnívoro',
      'coulant de lotus',
      'coulant de baileys',
      'helado',
    ];

    const postresLetis = productos.filter(
      (item) => !postresBuey.includes(item.nombre.toLowerCase())
    );
    const otrosPostres = productos.filter((item) =>
      postresBuey.includes(item.nombre.toLowerCase())
    );
    const vinos = productos.filter((item) => item.subcategoria === 'Vinos');
    const vinosPorTipo = [
      { tipo: 'Copa', titulo: 'Por copa' },
      { tipo: 'Blanco', titulo: 'Blancos' },
      { tipo: 'Tinto', titulo: 'Tintos' },
    ] as const;
    const chuletones = productos.filter((item) =>
      item.nombre.startsWith('Chulet')
    );
    const carnesBase = productos.filter(
      (item) => !item.nombre.startsWith('Chulet')
    );

    if (productos.length === 0) {
      return (
        <div className="carta-empty">
          <p>No hay productos en esta categoría</p>
        </div>
      );
    }

    if (esBebidas) {
      return (
        <div className="bebidas-wrapper">
          <div className="bebidas-main">
            {bebidasPrincipales.map((subcat) => {
              const items = productos.filter(
                (item) => item.subcategoria === subcat
              );
              if (items.length === 0) return null;
              return (
                <div key={subcat} className="bebidas-block">
                  <h3 className="bebidas-title">{subcat}</h3>
                  {renderBebidasLista(items)}
                </div>
              );
            })}
          </div>

          {vinos.length > 0 && (
            <div className="carta-vinos-section">
              <div className="carta-vinos-block">
                <div className="carta-vinos-text">
                  <span className="carta-vinos-title">Selección de vinos</span>
                  <p className="carta-vinos-description">
                    Una propuesta pensada para acompañar la maduración con
                    equilibrio y carácter.
                  </p>
                </div>
              </div>
              <div className="bebidas-vinos-grid">
                {vinosPorTipo.map(({ tipo, titulo }) => {
                  const items = vinos.filter((vino) => vino.tipo === tipo);
                  if (items.length === 0) return null;
                  return (
                    <div key={tipo} className="bebidas-block bebidas-block--vino">
                      <h3 className="bebidas-title bebidas-title--vino">
                        {titulo}
                      </h3>
                      {renderBebidasLista(items)}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      );
    }

    if (esCarnes) {
      return (
        <div className="carta-carnes-section">
          {carnesBase.length > 0 && renderProductosGrid(carnesBase)}
          {chuletones.length > 0 && (
            <div className="carta-chuletones-section">
              <div className="carta-chuletones-block">
                <div className="carta-chuletones-text">
                  <span className="carta-chuletones-title">
                    Selección de chuletones
                  </span>
                  <p className="carta-chuletones-description">
                    Maduraciones largas y cortes nobles.
                  </p>
                </div>
              </div>
              {renderProductosGrid(chuletones, {
                itemClassName: 'carta-product-item--premium',
              })}
            </div>
          )}
        </div>
      );
    }

    if (esPostres) {
      return (
        <div className="carta-postres-section">
          {postresLetis.length > 0 && renderProductosGrid(postresLetis)}
          {postresLetis.length > 0 && otrosPostres.length > 0 && (
            <div className="carta-postres-divider" />
          )}
          {otrosPostres.length > 0 && (
            <>
              <div className="carta-postres-subtitle">Postres Buey</div>
              {renderProductosGrid(otrosPostres)}
            </>
          )}
        </div>
      );
    }

    return renderProductosGrid(productos);
  };

  return (
    <>
      <nav ref={categoryNavRef} className="carta-nav-categorias carta-nav-grid">
        {slides.map((slide, index) => {
          const isBebidas = slide.key === 'Bebidas';
          return (
            <button
              key={slide.key}
              onClick={() => handleNavegaCategoria(index)}
              className={`carta-nav-btn ${
                index === currentSlide ? 'carta-nav-btn-active' : ''
              } ${isBebidas ? 'carta-nav-btn-bebidas' : ''}`}
              aria-label={`Ver categoría ${slide.titulo}`}
            >
              {slide.titulo}
            </button>
          );
        })}
      </nav>

      <section className="carta-section" ref={cartaSectionRef}>
        <div className="carta-container">
          <div className="carta-header">
            <p className="carta-subtitle">
              Descubre nuestras especialidades elaboradas con carne madurada y
              productos de proximidad.
            </p>
          </div>

          <div className="carta-wrapper">
            <div className="carta-page carta-page-single">
              <div className="carta-corner carta-corner-top-left"></div>
              <div className="carta-corner carta-corner-top-right"></div>
              <div className="carta-corner carta-corner-bottom-left"></div>
              <div className="carta-corner carta-corner-bottom-right"></div>

              {slides.map((slide, index) => {
                const productos = menuItems.filter(
                  (item) => item.categoria === slide.key
                );
                return (
                  <div
                    key={slide.key}
                    ref={(el) => {
                      sectionRefs.current[index] = el;
                    }}
                    className={`carta-menu-section${
                      index > 0 ? ' carta-menu-section--divided' : ''
                    }`}
                  >
                    {/* Category header */}
                    <div className="carta-category-header">
                      <div className="carta-decorative-line"></div>
                      <h2 className="carta-category-title">{slide.titulo}</h2>
                      <div className="carta-decorative-line"></div>
                    </div>

                    {/* Postres: Leti's block */}
                    {slide.key === 'Postres' && (
                      <div className="carta-letis-block">
                        <img
                          src="/assets/images/letis.webp"
                          alt="Leti's Pastelería"
                          className="carta-letis-logo"
                          loading="lazy"
                        />
                        <div className="carta-letis-text">
                          <span className="carta-letis-title">
                            Postres de autor by Leti's Atelier Gourmet
                          </span>
                          <p className="carta-letis-description">
                            Postres elaborados artesanalmente en Xàtiva.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Hamburguesas: guarnición */}
                    {slide.key === 'Hamburguesas' && (
                      <div className="carta-guarnicion">
                        <div className="carta-guarnicion-title">
                          Guarnición a elegir
                        </div>
                        <ul className="carta-guarnicion-list">
                          <li className="carta-guarnicion-item">
                            <span className="carta-guarnicion-name">
                              Patatas fritas artesanas
                            </span>
                            <span className="carta-guarnicion-price">2,5€</span>
                          </li>
                          <li className="carta-guarnicion-item">
                            <span className="carta-guarnicion-name">
                              Patatas de boniato frito
                            </span>
                            <span className="carta-guarnicion-price">3€</span>
                          </li>
                        </ul>
                      </div>
                    )}

                    {renderSeccionProductos(slide.key, productos)}
                  </div>
                );
              })}

              <div className="carta-footer">
                <p className="carta-footer-text">
                  Restaurante el Buey Madurado
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
