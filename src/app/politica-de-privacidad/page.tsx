import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Política de Privacidad | El Buey Madurado',
  description:
    'Política de privacidad de EL BUEY MADURADO, S.L. conforme al RGPD y la LOPDGDD. Cómo recogemos, usamos y protegemos tus datos personales.',
};

export default function PoliticaPrivacidadPage() {
  return (
    <div className="max-w-3xl mx-auto px-5 py-14 md:px-8 md:py-20">
      {/* Cabecera */}
      <div className="mb-12">
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-500 mb-3">
          Legal
        </p>
        <h1 className="text-3xl md:text-4xl font-black text-white mb-3">
          Política de Privacidad
        </h1>
        <p className="text-sm text-gray-500">Última actualización: junio de 2026</p>
        <div className="mt-6 h-px bg-gradient-to-r from-amber-500/40 via-amber-500/10 to-transparent" />
      </div>

      <div className="prose-legal">
        <p>
          EL BUEY MADURADO, S.L. concede una gran importancia a la protección de los datos
          personales de los usuarios de su sitio web{' '}
          <code>restauranteelbueymadurado.com</code>. La presente Política de Privacidad explica
          cómo se recogen, utilizan y protegen dichos datos, de conformidad con el Reglamento (UE)
          2016/679 General de Protección de Datos (RGPD) y la Ley Orgánica 3/2018, de 5 de
          diciembre, de Protección de Datos Personales y garantía de los derechos digitales
          (LOPDGDD).
        </p>

        {/* 1 */}
        <section className="mb-10">
          <h2>1. Responsable del tratamiento</h2>
          <ul>
            <li><strong>Responsable:</strong> EL BUEY MADURADO, S.L.</li>
            <li><strong>NIF:</strong> B-24770836</li>
            <li><strong>Domicilio:</strong> C/ La Reina, 41, 46800 Xàtiva (València), España</li>
            <li><strong>Teléfono:</strong> +34 670 77 57 86</li>
            <li>
              <strong>Correo electrónico:</strong>{' '}
              <a href="mailto:elbueymaduradoxativa@gmail.com">
                elbueymaduradoxativa@gmail.com
              </a>
            </li>
          </ul>
        </section>

        {/* 2 */}
        <section className="mb-10">
          <h2>2. ¿Qué datos tratamos y con qué finalidad?</h2>
          <p>
            Tratamos los datos que el usuario nos facilita de forma voluntaria a través de los
            distintos canales del Sitio Web. A continuación se detallan los tratamientos según la
            finalidad:
          </p>

          <h3>a) Gestión de reservas</h3>
          <ul>
            <li>
              <strong>Datos tratados:</strong> nombre, número de teléfono, correo electrónico, fecha
              y hora de la reserva, número de comensales y, en su caso, observaciones o peticiones
              especiales que el usuario facilite.
            </li>
            <li>
              <strong>Finalidad:</strong> gestionar y confirmar la reserva de mesa solicitada por el
              usuario y comunicarnos con él en relación con dicha reserva.
            </li>
            <li>
              <strong>Plataforma:</strong> la reserva se gestiona a través del proveedor{' '}
              <strong>CoverManager</strong>, que actúa como encargado del tratamiento.
            </li>
          </ul>

          <h3>b) Suscripción a la newsletter / Club de descuentos</h3>
          <ul>
            <li><strong>Datos tratados:</strong> nombre y correo electrónico.</li>
            <li>
              <strong>Finalidad:</strong> enviar comunicaciones comerciales por correo electrónico
              sobre descuentos, promociones, ventajas para suscriptores y novedades del Restaurante.
            </li>
            <li>
              <strong>Plataforma:</strong> los envíos se gestionan a través del proveedor{' '}
              <strong>Brevo</strong>, que actúa como encargado del tratamiento. El usuario podrá
              darse de baja en cualquier momento, bien desde el enlace habilitado en cada
              comunicación, bien desde el formulario de baja disponible en el propio Sitio Web.
            </li>
          </ul>

          <h3>c) Atención de consultas</h3>
          <ul>
            <li>
              <strong>Datos tratados:</strong> los datos que el usuario facilite voluntariamente al
              ponerse en contacto con nosotros por correo electrónico, teléfono o WhatsApp (como
              nombre, número de teléfono, correo electrónico y el contenido de su mensaje).
            </li>
            <li>
              <strong>Finalidad:</strong> atender y dar respuesta a las consultas, dudas o
              solicitudes planteadas.
            </li>
          </ul>

          <h3>d) Navegación y cookies</h3>
          <ul>
            <li>
              <strong>Datos tratados:</strong> datos de navegación y dispositivo (como dirección IP,
              tipo de navegador o páginas visitadas) recogidos mediante cookies y tecnologías
              similares.
            </li>
            <li>
              <strong>Finalidad:</strong> garantizar el correcto funcionamiento del Sitio Web y, en
              caso de prestar el usuario su consentimiento, elaborar estadísticas de uso. Puede
              consultar el detalle en nuestra{' '}
              <Link href="/politica-de-cookies">Política de Cookies</Link>.
            </li>
          </ul>

          <p>
            No tratamos categorías especiales de datos (datos de salud, ideología, etc.) a través
            del Sitio Web. El usuario no está obligado a facilitarnos sus datos, pero la falta de
            los datos mínimos necesarios puede impedir la prestación del servicio correspondiente.
          </p>
        </section>

        {/* 3 */}
        <section className="mb-10">
          <h2>3. Legitimación (base jurídica)</h2>
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Tratamiento</th>
                  <th>Base jurídica</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Gestión de reservas</td>
                  <td>Ejecución de un contrato o de medidas precontractuales a petición del interesado (art. 6.1.b RGPD)</td>
                </tr>
                <tr>
                  <td>Newsletter / Club de descuentos</td>
                  <td>Consentimiento del interesado (art. 6.1.a RGPD)</td>
                </tr>
                <tr>
                  <td>Atención de consultas</td>
                  <td>Consentimiento del interesado (art. 6.1.a RGPD)</td>
                </tr>
                <tr>
                  <td>Cookies analíticas y no esenciales</td>
                  <td>Consentimiento del interesado (art. 6.1.a RGPD)</td>
                </tr>
                <tr>
                  <td>Cookies técnicas necesarias</td>
                  <td>Interés legítimo en el correcto funcionamiento del Sitio Web (art. 6.1.f RGPD)</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            El usuario podrá retirar en cualquier momento el consentimiento prestado, sin que ello
            afecte a la licitud del tratamiento basado en el consentimiento previo a su retirada.
          </p>
        </section>

        {/* 4 */}
        <section className="mb-10">
          <h2>4. Plazos de conservación</h2>
          <ul>
            <li>
              <strong>Reservas:</strong> los datos se conservarán durante el tiempo necesario para
              gestionar la reserva y, posteriormente, durante los plazos legalmente exigibles para
              atender posibles responsabilidades o reclamaciones.
            </li>
            <li>
              <strong>Newsletter:</strong> los datos se conservarán mientras el usuario no revoque su
              consentimiento o solicite su baja.
            </li>
            <li>
              <strong>Consultas:</strong> los datos se conservarán durante el tiempo necesario para
              atender la consulta y un plazo prudencial posterior; en caso de derivarse una relación
              contractual, mientras esta se mantenga.
            </li>
          </ul>
          <p>
            Transcurridos dichos plazos, los datos serán suprimidos o anonimizados, conservándose
            debidamente bloqueados durante los plazos de prescripción de las acciones que pudieran
            derivarse.
          </p>
        </section>

        {/* 5 */}
        <section className="mb-10">
          <h2>5. Destinatarios de los datos</h2>
          <p>
            Los datos personales no serán cedidos a terceros, salvo obligación legal. No obstante,
            para la prestación de determinados servicios, podrán acceder a ellos los siguientes
            proveedores que actúan como encargados del tratamiento, habiéndose suscrito con ellos
            los correspondientes contratos de encargo:
          </p>
          <ul>
            <li><strong>CoverManager</strong> — gestión del sistema de reservas.</li>
            <li><strong>Brevo</strong> — gestión y envío de la newsletter y comunicaciones comerciales.</li>
            <li>
              <strong>Google</strong> — servicios de correo electrónico (Gmail) y, en su caso,
              mapas y analítica web.
            </li>
            <li>
              <strong>Vercel Inc.</strong> — alojamiento del Sitio Web y analítica de tráfico
              web sin cookies.
            </li>
          </ul>

          <h3>Transferencias internacionales</h3>
          <p>
            Algunos de los proveedores indicados (como Google o Brevo) pueden tratar datos en
            servidores ubicados fuera del Espacio Económico Europeo, principalmente en Estados
            Unidos. Dichas transferencias se amparan en la decisión de adecuación de la Comisión
            Europea relativa al <strong>Marco de Privacidad de Datos UE-EE. UU. (EU-U.S. Data
            Privacy Framework)</strong> para las entidades certificadas en él y, con carácter
            complementario, en las <strong>Cláusulas Contractuales Tipo</strong> aprobadas por la
            Comisión Europea, garantizando un nivel de protección adecuado.
          </p>
        </section>

        {/* 6 */}
        <section className="mb-10">
          <h2>6. Derechos del usuario</h2>
          <p>El usuario puede ejercer en cualquier momento los siguientes derechos:</p>
          <ul>
            <li><strong>Acceso:</strong> conocer si tratamos sus datos y obtener una copia de los mismos.</li>
            <li><strong>Rectificación:</strong> solicitar la corrección de los datos inexactos o incompletos.</li>
            <li><strong>Supresión:</strong> solicitar la eliminación de sus datos cuando, entre otros motivos, ya no sean necesarios.</li>
            <li><strong>Oposición:</strong> oponerse al tratamiento de sus datos por motivos relacionados con su situación particular.</li>
            <li><strong>Limitación:</strong> solicitar la limitación del tratamiento en los supuestos previstos por la normativa.</li>
            <li><strong>Portabilidad:</strong> recibir sus datos en un formato estructurado y de uso común, o solicitar su transmisión a otro responsable.</li>
            <li><strong>Retirada del consentimiento:</strong> revocar el consentimiento prestado en cualquier momento.</li>
          </ul>
          <p>
            Para ejercer estos derechos, el usuario puede dirigirse por escrito a EL BUEY MADURADO,
            S.L., C/ La Reina, 41, 46800 Xàtiva (València), o al correo electrónico{' '}
            <a href="mailto:elbueymaduradoxativa@gmail.com">elbueymaduradoxativa@gmail.com</a>,
            indicando el derecho que desea ejercer y adjuntando, en su caso, copia de un documento
            que acredite su identidad.
          </p>
          <p>
            Asimismo, el usuario tiene derecho a presentar una reclamación ante la{' '}
            <strong>Agencia Española de Protección de Datos (AEPD)</strong>{' '}
            (<a href="https://www.aepd.es" target="_blank" rel="noreferrer">www.aepd.es</a>),
            especialmente cuando considere que no ha obtenido satisfacción en el ejercicio de sus
            derechos.
          </p>
        </section>

        {/* 7 */}
        <section className="mb-10">
          <h2>7. Seguridad de los datos</h2>
          <p>
            EL BUEY MADURADO, S.L. tiene implantadas las medidas de seguridad de índole técnica y
            organizativa necesarias para garantizar la seguridad de los datos personales y evitar su
            alteración, pérdida, tratamiento o acceso no autorizado, de acuerdo con lo dispuesto en
            el RGPD y la LOPDGDD.
          </p>
        </section>

        {/* 8 */}
        <section className="mb-10">
          <h2>8. Menores de edad</h2>
          <p>
            El Sitio Web no está dirigido a menores de 14 años. EL BUEY MADURADO, S.L. no recoge
            intencionadamente datos de menores de dicha edad. En caso de detectarse, se procederá a
            su supresión.
          </p>
        </section>

        {/* 9 */}
        <section className="mb-10">
          <h2>9. Comunicaciones comerciales</h2>
          <p>
            De conformidad con la Ley 34/2002, de Servicios de la Sociedad de la Información y de
            Comercio Electrónico (LSSI-CE), el Restaurante solo enviará comunicaciones comerciales
            por medios electrónicos cuando el usuario haya prestado previamente su consentimiento.
            El usuario podrá revocar dicho consentimiento en cualquier momento mediante el enlace de
            baja incluido en cada comunicación o escribiendo a{' '}
            <a href="mailto:elbueymaduradoxativa@gmail.com">elbueymaduradoxativa@gmail.com</a>.
          </p>
        </section>

        {/* 10 */}
        <section className="mb-10">
          <h2>10. Cambios en la Política de Privacidad</h2>
          <p>
            EL BUEY MADURADO, S.L. se reserva el derecho de modificar la presente Política de
            Privacidad para adaptarla a novedades legislativas o jurisprudenciales, así como a
            cambios en los tratamientos realizados. Cualquier modificación será publicada en esta
            misma página con indicación de su fecha de actualización.
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
          <Link href="/politica-de-cookies" className="text-amber-500 hover:text-amber-400 transition-colors">
            Política de cookies →
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
          font-size: 0.875rem;
          margin-bottom: 1rem;
        }
        .prose-legal thead tr {
          background: rgba(245,158,11,0.1);
        }
        .prose-legal th {
          text-align: left;
          padding: 0.625rem 0.875rem;
          color: rgb(245 158 11);
          font-weight: 600;
          border: 1px solid rgba(255,255,255,0.08);
        }
        .prose-legal td {
          padding: 0.625rem 0.875rem;
          color: rgb(209 213 219);
          border: 1px solid rgba(255,255,255,0.08);
          vertical-align: top;
        }
        .prose-legal tbody tr:nth-child(even) {
          background: rgba(255,255,255,0.02);
        }
      `}</style>
    </div>
  );
}
