import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Aviso Legal y Condiciones de Uso | El Buey Madurado',
  description:
    'Aviso legal, condiciones de uso y datos identificativos de EL BUEY MADURADO, S.L., titular del sitio web restauranteelbueymadurado.com.',
};

export default function AvisoLegalPage() {
  return (
    <div className="max-w-3xl mx-auto px-5 py-14 md:px-8 md:py-20">
      {/* Cabecera */}
      <div className="mb-12">
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-500 mb-3">
          Legal
        </p>
        <h1 className="text-3xl md:text-4xl font-black text-white mb-3">
          Aviso Legal y Condiciones de Uso
        </h1>
        <p className="text-sm text-gray-500">Última actualización: junio de 2026</p>
        <div className="mt-6 h-px bg-gradient-to-r from-amber-500/40 via-amber-500/10 to-transparent" />
      </div>

      <div className="prose-legal">

        {/* 1 */}
        <section className="mb-10">
          <h2>1. Datos identificativos del titular</h2>
          <p>
            En cumplimiento del deber de información recogido en el artículo 10 de la Ley 34/2002,
            de 11 de julio, de Servicios de la Sociedad de la Información y de Comercio Electrónico
            (LSSI-CE), se facilitan a continuación los datos identificativos del titular de este
            sitio web.
          </p>
          <ul>
            <li><strong>Titular:</strong> EL BUEY MADURADO, S.L.</li>
            <li><strong>NIF:</strong> B-24770836</li>
            <li><strong>Domicilio:</strong> C/ La Reina, 41, 46800 Xàtiva (València), España</li>
            <li><strong>Teléfono:</strong> +34 670 77 57 86</li>
            <li>
              <strong>Correo electrónico:</strong>{' '}
              <a href="mailto:elbueymaduradoxativa@gmail.com">
                elbueymaduradoxativa@gmail.com
              </a>
            </li>
            <li>
              <strong>Sitio web:</strong>{' '}
              <a href="https://www.restauranteelbueymadurado.com" target="_blank" rel="noreferrer">
                https://www.restauranteelbueymadurado.com
              </a>
            </li>
            <li>
              <strong>Datos registrales:</strong> Inscrita en el Registro Mercantil de València,
              Diario 2026, Asiento 5831, Inscripción 1, folio electrónico IRUS 1000462272773,
              Hoja V-230285.
            </li>
          </ul>
        </section>

        {/* 2 */}
        <section className="mb-10">
          <h2>2. Objeto</h2>
          <p>
            El presente Aviso Legal regula el acceso, la navegación y el uso del sitio web{' '}
            <code>restauranteelbueymadurado.com</code> (en adelante, &ldquo;el Sitio Web&rdquo;),
            titularidad de EL BUEY MADURADO, S.L. (en adelante, &ldquo;el Restaurante&rdquo;). El
            Sitio Web tiene como finalidad ofrecer información sobre el restaurante, su carta y sus
            servicios, permitir la gestión de reservas de mesa, la suscripción a su newsletter de
            descuentos y poner a disposición de los usuarios distintas vías de contacto.
          </p>
          <p>
            El acceso al Sitio Web y la utilización de sus contenidos y servicios atribuye la
            condición de usuario e implica la aceptación plena y sin reservas de todas las
            disposiciones incluidas en este Aviso Legal. Si el usuario no estuviera de acuerdo con
            su contenido, deberá abstenerse de utilizar el Sitio Web.
          </p>
        </section>

        {/* 3 */}
        <section className="mb-10">
          <h2>3. Condiciones de uso</h2>
          <p>
            El usuario se compromete a hacer un uso adecuado y lícito del Sitio Web y de sus
            contenidos, de conformidad con la legislación aplicable, el presente Aviso Legal, la
            moral y las buenas costumbres. En particular, se compromete a no utilizar el Sitio Web
            con fines o efectos ilícitos, lesivos de los derechos e intereses de terceros, o que de
            cualquier forma puedan dañar, inutilizar, sobrecargar o deteriorar el Sitio Web o
            impedir su normal utilización por otros usuarios.
          </p>
          <p>
            El Restaurante se reserva el derecho de efectuar, en cualquier momento y sin previo
            aviso, modificaciones en la información, configuración y presentación del Sitio Web, así
            como de suspender temporal o definitivamente su funcionamiento.
          </p>
        </section>

        {/* 4 */}
        <section className="mb-10">
          <h2>4. Reservas</h2>
          <p>
            El servicio de reserva de mesa disponible en el Sitio Web se gestiona a través de la
            plataforma de terceros <strong>CoverManager</strong> (CoverManager, S.L.), integrada
            mediante un formulario externo. Al realizar una reserva, los datos facilitados son
            tratados conforme a lo indicado en la{' '}
            <Link href="/politica-de-privacidad">Política de Privacidad</Link> del Restaurante y a
            las condiciones del propio proveedor. El Restaurante no se hace responsable de las
            incidencias técnicas ajenas a su control que puedan producirse en dicha plataforma.
          </p>
        </section>

        {/* 5 */}
        <section className="mb-10">
          <h2>5. Propiedad intelectual e industrial</h2>
          <p>
            Todos los contenidos del Sitio Web —incluyendo, a título enunciativo y no limitativo,
            textos, fotografías, vídeos, gráficos, imágenes, iconos, logotipos, marcas, nombres
            comerciales, diseño y código fuente— son propiedad de EL BUEY MADURADO, S.L. o de
            terceros que han autorizado su uso, y están protegidos por la normativa nacional e
            internacional de propiedad intelectual e industrial.
          </p>
          <p>
            Queda expresamente prohibida la reproducción, distribución, comunicación pública,
            transformación o cualquier otra forma de explotación, total o parcial, de los contenidos
            del Sitio Web sin la autorización previa y por escrito del Restaurante. El acceso al
            Sitio Web no otorga al usuario ningún derecho ni titularidad sobre los contenidos que en
            él se incluyen.
          </p>
          <p>
            Las marcas, nombres comerciales o signos distintivos de terceros que pudieran aparecer
            en el Sitio Web pertenecen a sus respectivos propietarios.
          </p>
        </section>

        {/* 6 */}
        <section className="mb-10">
          <h2>6. Enlaces a terceros</h2>
          <p>
            El Sitio Web puede contener enlaces a sitios o servicios de terceros (entre otros,
            Google Maps, Google, Instagram, TikTok, WhatsApp o CoverManager) con el fin de facilitar
            el acceso a información de interés para el usuario. El Restaurante no asume ninguna
            responsabilidad sobre los contenidos, servicios, políticas de privacidad o prácticas de
            dichos sitios externos, cuyo acceso se realiza bajo la exclusiva responsabilidad del
            usuario.
          </p>
        </section>

        {/* 7 */}
        <section className="mb-10">
          <h2>7. Exención de responsabilidad</h2>
          <p>
            El Restaurante no garantiza la disponibilidad y continuidad ininterrumpida del Sitio
            Web, ni la ausencia de errores en sus contenidos, si bien adoptará las medidas
            razonables para evitarlos. El Restaurante queda exonerado de cualquier responsabilidad
            por los daños y perjuicios de toda naturaleza que pudieran derivarse de:
          </p>
          <ul>
            <li>La falta de disponibilidad o de continuidad del Sitio Web.</li>
            <li>
              La presencia de virus u otros elementos lesivos introducidos por terceros y ajenos al
              control del Restaurante.
            </li>
            <li>El uso indebido o inadecuado del Sitio Web por parte de los usuarios.</li>
            <li>El mal funcionamiento del navegador o el uso de versiones no actualizadas del mismo.</li>
          </ul>
        </section>

        {/* 8 */}
        <section className="mb-10">
          <h2>8. Protección de datos personales</h2>
          <p>
            El tratamiento de los datos personales que el usuario facilite a través del Sitio Web
            (formularios de reserva, suscripción a la newsletter o comunicaciones por correo
            electrónico, teléfono o WhatsApp) se rige por lo dispuesto en la{' '}
            <Link href="/politica-de-privacidad">Política de Privacidad</Link>, que forma parte
            integrante de este Aviso Legal.
          </p>
        </section>

        {/* 9 */}
        <section className="mb-10">
          <h2>9. Legislación aplicable y jurisdicción</h2>
          <p>
            El presente Aviso Legal se rige íntegramente por la legislación española. Para la
            resolución de cualquier controversia que pudiera derivarse del acceso o uso del Sitio
            Web, las partes se someten a los Juzgados y Tribunales de la ciudad de València, salvo
            que la normativa de protección de los consumidores y usuarios disponga otra cosa.
          </p>
        </section>

        {/* 10 */}
        <section className="mb-10">
          <h2>10. Modificaciones</h2>
          <p>
            El Restaurante se reserva el derecho de modificar el presente Aviso Legal con el fin de
            adaptarlo a novedades legislativas o a cambios en el Sitio Web. Las modificaciones serán
            publicadas en esta misma página y entrarán en vigor desde el momento de su publicación.
          </p>
        </section>

        {/* Navegación a otras páginas legales */}
        <nav
          aria-label="Otras páginas legales"
          className="mt-14 pt-8 border-t border-white/10 flex flex-wrap gap-4 text-sm"
        >
          <Link href="/politica-de-privacidad" className="text-amber-500 hover:text-amber-400 transition-colors">
            Política de privacidad →
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
      `}</style>
    </div>
  );
}
