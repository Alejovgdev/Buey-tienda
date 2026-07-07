import type { Metadata } from 'next';
import Link from 'next/link';
import CookiePanelTrigger from '@/components/Cookies/CookiePanelTrigger';

export const metadata: Metadata = {
  title: 'Política de Cookies | El Buey Madurado',
  description:
    'Política de cookies de restauranteelbueymadurado.com conforme a las directrices de la AEPD. Qué cookies usamos, cómo gestionarlas y tus derechos.',
};

export default function PoliticaDeCookiesPage() {
  return (
    <div className="max-w-3xl mx-auto px-5 py-14 md:px-8 md:py-20">
      {/* Cabecera */}
      <div className="mb-12">
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-500 mb-3">
          Legal
        </p>
        <h1 className="text-3xl md:text-4xl font-black text-white mb-3">
          Política de Cookies
        </h1>
        <p className="text-sm text-gray-500">Última actualización: junio de 2026</p>
        <div className="mt-6 h-px bg-gradient-to-r from-amber-500/40 via-amber-500/10 to-transparent" />
      </div>

      <div className="prose-legal">
        <p>
          Esta Política de Cookies explica qué son las cookies, qué tipos utiliza el sitio web{' '}
          <code>restauranteelbueymadurado.com</code> (en adelante, &ldquo;el Sitio Web&rdquo;),
          titularidad de <strong>EL BUEY MADURADO, S.L.</strong>, y cómo el usuario puede
          gestionarlas o desactivarlas. Su contenido se ha elaborado siguiendo las directrices de la
          Agencia Española de Protección de Datos (AEPD).
        </p>

        {/* 1 */}
        <section className="mb-10">
          <h2>1. ¿Qué es una cookie?</h2>
          <p>
            Una cookie es un pequeño fichero de texto que un sitio web almacena en el navegador o
            dispositivo del usuario cuando lo visita. Las cookies permiten que la web recuerde
            información sobre la visita, como las preferencias del usuario o ciertos datos técnicos,
            con el fin de facilitar la navegación y mejorar la experiencia de uso. Las cookies no
            son virus ni dañan el dispositivo, y por sí solas no identifican a una persona, sino a
            un navegador o dispositivo.
          </p>
        </section>

        {/* 2 */}
        <section className="mb-10">
          <h2>2. ¿Qué tipos de cookies existen?</h2>

          <h3>Según quién las gestiona</h3>
          <ul>
            <li>
              <strong>Cookies propias:</strong> las que se envían y gestionan desde el propio Sitio
              Web.
            </li>
            <li>
              <strong>Cookies de terceros:</strong> las que se envían y gestionan desde un dominio o
              servicio externo (por ejemplo, Google).
            </li>
          </ul>

          <h3>Según su finalidad</h3>
          <ul>
            <li>
              <strong>Cookies técnicas o necesarias:</strong> permiten el funcionamiento básico del
              Sitio Web y la prestación de los servicios solicitados. No requieren consentimiento.
            </li>
            <li>
              <strong>Cookies de preferencias o personalización:</strong> permiten recordar opciones
              del usuario (idioma, configuración, etc.).
            </li>
            <li>
              <strong>Cookies de análisis o medición:</strong> permiten elaborar estadísticas sobre
              el uso y el tráfico del Sitio Web.
            </li>
            <li>
              <strong>Cookies de publicidad o comportamiento:</strong> permiten mostrar publicidad
              en función de la navegación del usuario.
            </li>
          </ul>

          <h3>Según su duración</h3>
          <ul>
            <li>
              <strong>Cookies de sesión:</strong> se eliminan al cerrar el navegador.
            </li>
            <li>
              <strong>Cookies persistentes:</strong> permanecen almacenadas durante un periodo
              determinado.
            </li>
          </ul>
        </section>

        {/* 3 */}
        <section className="mb-10">
          <h2>3. Cookies y servicios utilizados en este Sitio Web</h2>
          <p>
            A continuación se detallan las cookies y servicios de terceros que utiliza el Sitio
            Web. Esta tabla refleja los servicios activos verificados en el código del sitio.
          </p>
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Cookie / Servicio</th>
                  <th>Titular</th>
                  <th>Tipo</th>
                  <th>Finalidad</th>
                  <th>Duración</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>ebm_consent_v1</code></td>
                  <td>Propia</td>
                  <td>Técnica / necesaria</td>
                  <td>Recordar la elección del usuario sobre el uso de cookies para no volver a mostrar el banner</td>
                  <td>24 meses</td>
                </tr>
                <tr>
                  <td>CoverManager</td>
                  <td>Tercero (CoverManager, S.L.)</td>
                  <td>Técnica / funcional</td>
                  <td>
                    Permite el funcionamiento del módulo de reserva de mesa en la página{' '}
                    <code>/reservas</code>. Solo se activa cuando el usuario navega a dicha página
                    para realizar una reserva (servicio solicitado expresamente).
                  </td>
                  <td>Sesión / persistente</td>
                </tr>
                <tr>
                  <td>Google Maps</td>
                  <td>Tercero (Google LLC)</td>
                  <td>Funcional</td>
                  <td>
                    Muestra el mapa interactivo de localización del restaurante. Solo se carga si el
                    usuario activa las cookies funcionales. De lo contrario, se muestra un
                    placeholder con enlace a Google Maps.
                  </td>
                  <td>Persistente</td>
                </tr>
                <tr>
                  <td>Vercel Analytics</td>
                  <td>Tercero (Vercel Inc.)</td>
                  <td>Análisis</td>
                  <td>
                    Recopila datos anónimos de navegación (páginas visitadas, dispositivo) para
                    mejorar el sitio web. Vercel Analytics opera sin cookies persistentes de
                    rastreo; utiliza métricas agregadas y anónimas. Solo se activa si el usuario
                    acepta las cookies de análisis.
                  </td>
                  <td>Sin cookie persistente</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            <strong className="text-gray-400">Nota:</strong> Este sitio web no utiliza actualmente
            Google Analytics, Meta Pixel ni otras herramientas de publicidad o marketing.
          </p>
        </section>

        {/* 4 */}
        <section className="mb-10">
          <h2>4. Consentimiento</h2>
          <p>
            Al acceder por primera vez al Sitio Web, se muestra un aviso de cookies que informa al
            usuario sobre su uso y le permite <strong>aceptarlas, rechazarlas o
            configurarlas</strong> de forma diferenciada, con igual facilidad y prominencia para
            cada opción. Las cookies que no sean estrictamente necesarias no se instalan hasta que
            el usuario haya dado su consentimiento.
          </p>
          <p>
            El usuario puede modificar o retirar su elección en cualquier momento desde el panel de
            configuración disponible en el pie de página del Sitio Web o desde el botón a
            continuación:
          </p>
          <CookiePanelTrigger />
        </section>

        {/* 5 */}
        <section className="mb-10">
          <h2>5. ¿Cómo gestionar o eliminar las cookies?</h2>
          <p>
            Además del panel de configuración del propio Sitio Web, el usuario puede permitir,
            bloquear o eliminar las cookies instaladas en su dispositivo desde la configuración de
            su navegador:
          </p>
          <ul>
            <li>
              <strong>Google Chrome:</strong>{' '}
              <a
                href="https://support.google.com/chrome/answer/95647"
                target="_blank"
                rel="noreferrer"
              >
                support.google.com/chrome/answer/95647
              </a>
            </li>
            <li>
              <strong>Mozilla Firefox:</strong>{' '}
              <a
                href="https://support.mozilla.org/es/kb/Borrar%20cookies"
                target="_blank"
                rel="noreferrer"
              >
                support.mozilla.org
              </a>
            </li>
            <li>
              <strong>Safari:</strong>{' '}
              <a
                href="https://support.apple.com/es-es/HT201265"
                target="_blank"
                rel="noreferrer"
              >
                support.apple.com/es-es/HT201265
              </a>
            </li>
            <li>
              <strong>Microsoft Edge:</strong>{' '}
              <a
                href="https://support.microsoft.com/es-es/microsoft-edge/eliminar-las-cookies-en-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09"
                target="_blank"
                rel="noreferrer"
              >
                support.microsoft.com
              </a>
            </li>
          </ul>
          <p>
            Tenga en cuenta que la desactivación de determinadas cookies puede afectar al correcto
            funcionamiento de algunas secciones del Sitio Web.
          </p>
        </section>

        {/* 6 */}
        <section className="mb-10">
          <h2>6. Transferencias internacionales</h2>
          <p>
            Algunos proveedores de cookies de terceros (como Google o Vercel) pueden tratar datos
            en servidores ubicados fuera del Espacio Económico Europeo. Dichas transferencias se
            amparan en la decisión de adecuación de la Comisión Europea relativa al{' '}
            <strong>Marco de Privacidad de Datos UE-EE. UU. (EU-U.S. Data Privacy Framework)</strong>{' '}
            y, con carácter complementario, en las Cláusulas Contractuales Tipo aprobadas por la
            Comisión Europea. EL BUEY MADURADO, S.L. no se hace responsable del contenido ni de la
            veracidad de las políticas de privacidad de dichos terceros, por lo que recomienda al
            usuario consultarlas directamente.
          </p>
        </section>

        {/* 7 */}
        <section className="mb-10">
          <h2>7. Actualización de la Política de Cookies</h2>
          <p>
            EL BUEY MADURADO, S.L. puede modificar esta Política de Cookies en función de novedades
            legislativas, de las directrices de la AEPD o de cambios en las cookies utilizadas. Se
            recomienda al usuario revisarla periódicamente.
          </p>
          <p>
            Para cualquier duda sobre esta Política de Cookies, puede contactar a través del correo
            electrónico{' '}
            <a href="mailto:elbueymaduradoxativa@gmail.com">elbueymaduradoxativa@gmail.com</a>.
          </p>
        </section>

        {/* Navegación */}
        <nav
          aria-label="Otras páginas legales"
          className="mt-14 pt-8 border-t border-white/10 flex flex-wrap gap-4 text-sm"
        >
          <Link href="/aviso-legal" className="text-amber-500 hover:text-amber-400 transition-colors">
            Aviso legal →
          </Link>
          <Link
            href="/politica-de-privacidad"
            className="text-amber-500 hover:text-amber-400 transition-colors"
          >
            Política de privacidad →
          </Link>
        </nav>
      </div>

      <style>{`
        .prose-legal h2 {
          font-size: 1.125rem;
          font-weight: 700;
          color: rgb(245 158 11);
          margin-bottom: 0.75rem;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid rgba(255,255,255,0.07);
        }
        .prose-legal h3 {
          font-size: 0.9375rem;
          font-weight: 600;
          color: rgb(229 231 235);
          margin-top: 1.25rem;
          margin-bottom: 0.5rem;
        }
        .prose-legal p {
          color: rgb(209 213 219);
          line-height: 1.75;
          margin-bottom: 1rem;
          font-size: 0.9375rem;
        }
        .prose-legal ul {
          list-style: disc;
          padding-left: 1.5rem;
          color: rgb(209 213 219);
          line-height: 1.75;
          margin-bottom: 1rem;
          font-size: 0.9375rem;
        }
        .prose-legal li {
          margin-bottom: 0.375rem;
        }
        .prose-legal strong {
          color: rgb(229 231 235);
          font-weight: 600;
        }
        .prose-legal a {
          color: rgb(245 158 11);
          text-decoration: underline;
          text-underline-offset: 2px;
          transition: color 0.2s;
        }
        .prose-legal a:hover {
          color: rgb(252 211 77);
        }
        .prose-legal code {
          font-family: monospace;
          font-size: 0.875em;
          color: rgb(209 213 219);
          background: rgba(255,255,255,0.05);
          padding: 0.1em 0.35em;
          border-radius: 0.25rem;
        }
        .prose-legal table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.8125rem;
          margin-bottom: 1rem;
        }
        .prose-legal thead tr {
          background: rgba(245,158,11,0.1);
        }
        .prose-legal th {
          text-align: left;
          padding: 0.625rem 0.75rem;
          color: rgb(245 158 11);
          font-weight: 600;
          border: 1px solid rgba(255,255,255,0.08);
          white-space: nowrap;
        }
        .prose-legal td {
          padding: 0.625rem 0.75rem;
          color: rgb(209 213 219);
          border: 1px solid rgba(255,255,255,0.08);
          vertical-align: top;
          line-height: 1.6;
        }
        .prose-legal tbody tr:nth-child(even) {
          background: rgba(255,255,255,0.02);
        }
      `}</style>
    </div>
  );
}
