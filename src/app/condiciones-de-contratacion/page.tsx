import type { Metadata } from 'next';
import Link from 'next/link';
import { TERMS_LABEL } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Condiciones Generales de Contratación | El Buey Madurado',
  description:
    'Condiciones generales de contratación de la tienda online de EL BUEY MADURADO, S.L.: proceso de compra, precios, envíos con SEUR Frío, devoluciones, garantías y derecho de desistimiento.',
};

export default function CondicionesDeContratacionPage() {
  return (
    <div className="max-w-3xl mx-auto px-5 py-14 md:px-8 md:py-20">
      {/* Cabecera */}
      <div className="mb-12">
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-500 mb-3">
          Legal
        </p>
        <h1 className="text-3xl md:text-4xl font-black text-white mb-3">
          Condiciones Generales de Contratación
        </h1>
        <p className="text-sm text-gray-500">{TERMS_LABEL}</p>
        <div className="mt-6 h-px bg-gradient-to-r from-amber-500/40 via-amber-500/10 to-transparent" />
      </div>

      <div className="prose-legal">
        <p>
          Las Condiciones Generales de Contratación que aparecen en nuestro portal web
          (www.restauranteelbueymadurado.com) contienen información legal acerca de los derechos del
          comprador de conformidad con la normativa sobre contratos a distancia y comercio
          electrónico.
        </p>

        {/* 1 */}
        <section className="mb-10">
          <h2>1. Alcance y Base de Clientes</h2>
          <p>
            Las presentes Condiciones Generales de Contratación regulan las compras realizadas a
            través del portal web www.restauranteelbueymadurado.com, titularidad de{' '}
            <strong>EL BUEY MADURADO, S.L.</strong> (en adelante, &ldquo;el Titular&rdquo;), con NIF{' '}
            <strong>B-24770836</strong> y domicilio en{' '}
            <strong>C/ La Reina, 41 de Xàtiva (46800) València.</strong>
          </p>
          <p>
            <strong>
              Inscrita en el Registro Mercantil de València Diario 2026, Asiento 5831, Inscripción
              1, folio electrónico IRUS 1000462272773, Hoja: V-230285.
            </strong>
          </p>
          <p>
            Estas Condiciones se aplican a todos los pedidos efectuados por consumidores y usuarios
            conforme al Real Decreto Legislativo 1/2007 (Ley General para la Defensa de los
            Consumidores y Usuarios), así como a clientes profesionales o empresas, si bien la
            normativa de consumidores solo será aplicable cuando el cliente ostente dicha condición.
            No se aceptarán condiciones distintas a las aquí establecidas salvo acuerdo expreso y
            por escrito entre el Titular y el cliente, sin perjuicio de los derechos irrenunciables
            reconocidos a los consumidores.
          </p>
          <p>
            El uso de la web y la realización de un pedido implican la aceptación plena y sin
            reservas de estas Condiciones Generales.
          </p>
        </section>

        {/* 2 */}
        <section className="mb-10">
          <h2>2. Oferta y Registro</h2>
          <p>
            El sitio web www.restauranteelbueymadurado.com es un portal de acceso público en el que
            los usuarios pueden consultar y adquirir los productos comercializados, principalmente{' '}
            <strong>
              carne madurada (Dry Aged), cortes selectos y productos cárnicos derivados
            </strong>
            .
          </p>
          <p>
            Para efectuar cualquier adquisición a través de la plataforma, el usuario deberá seguir
            los pasos técnicos que se le indiquen en pantalla durante la navegación, los cuales
            consisten con carácter general en:
          </p>
          <ol>
            <li>Seleccionar el producto o corte cárnico deseado e incorporarlo al carrito de la compra.</li>
            <li>Acceder al resumen del carrito y proceder a la tramitación de la compra.</li>
            <li>
              Cumplimentar el formulario electrónico de datos solicitados en cada momento, relativos
              a la facturación, los datos de contacto y la dirección exacta de entrega.
            </li>
            <li>
              Validar el importe de los gastos de envío correspondientes y aceptar de forma expresa
              las presentes Condiciones Generales y la Política de Privacidad mediante la casilla
              habilitada.
            </li>
            <li>
              Seleccionar y completar el pago a través de la pasarela de pago seguro habilitada en la
              web.
            </li>
          </ol>
          <p>
            El usuario se obliga a proporcionar datos veraces, exactos y totalmente actualizados,
            siendo el único responsable de cualquier error, omisión o inexactitud que dificulte o
            impida la entrega del producto fresco por parte del transportista. El tratamiento de
            toda la información facilitada se regirá estrictamente por lo dispuesto en nuestra
            Política de Privacidad, de conformidad con el RGPD y la LOPDGDD, garantizando en todo
            momento la trazabilidad del producto alimenticio.
          </p>
          <p>
            El contrato de compraventa entre el Titular y el usuario se entenderá formalizado única
            y exclusivamente cuando el cliente complete el proceso de pago y el Titular confirme la
            recepción del pedido mediante el envío de un correo electrónico a la dirección
            facilitada por el comprador.
          </p>
        </section>

        {/* 3 */}
        <section className="mb-10">
          <h2>3. Contratación y condiciones generales de compra</h2>
          <p>
            La información mostrada en restauranteelbueymadurado.com sobre productos, precios,
            disponibilidad y características constituye información precontractual conforme al
            artículo 97 del Real Decreto Legislativo 1/2007. Dicha información no supone una oferta
            contractual vinculante. El contrato de compraventa se entenderá formalizado cuando:
          </p>
          <ul>
            <li>El cliente complete el proceso de compra y confirme el pedido.</li>
            <li>
              El Titular envíe un correo electrónico de confirmación del pedido a la dirección
              facilitada, aceptando expresamente la formalización del contrato.
            </li>
          </ul>
          <p>
            En caso de que, tras la confirmación del pedido, no sea posible suministrar el producto
            por falta de stock, rotura de cadena de maduración o imposibilidad logística, el Titular
            informará inmediatamente al cliente y procederá al reembolso íntegro del importe abonado
            en <strong>un plazo máximo de 14 días naturales.</strong>
          </p>
          <p>
            La recepción del pago y el envío del correo automático de confirmación de pedido no
            constituyen la aceptación definitiva de la compra si se detecta un error técnico o
            tipográfico flagrante en el precio. En caso de que se produzca un error de tal entidad
            que resulte manifiestamente obvio para un consumidor medio que se trata de un error
            involuntario, el Titular se pondrá en contacto con el cliente para subsanarlo o proceder
            a la cancelación justificada del pedido y al correspondiente reembolso.
          </p>

          <h3>3.1. Precios y características de los productos</h3>
          <ul>
            <li>
              <strong>Los precios de los productos</strong> son los indicados en la web e incluyen el
              Impuesto sobre el Valor Añadido (IVA) aplicable en España.
            </li>
            <li>
              <strong>El Titular se reserva el derecho</strong> a modificar precios, promociones y
              descripciones técnicas sin previo aviso, sin que ello afecte en ningún caso a los
              pedidos que ya hayan sido debidamente confirmados.
            </li>
            <li>
              <strong>Política de fijación de precios promediados</strong>: El precio de las piezas
              de carne es un precio cerrado y fijo en la web, basado en un peso estimado por porción
              (precio por pieza promediada). El cliente acepta que el peso real de la pieza cortada
              puede oscilar levemente por encima o por debajo del peso estimado, asumiendo el Titular
              las diferencias de coste si pesa más, y asumiéndolas el cliente si pesa ligeramente
              menos, sin que procedan ajustes o cargos adicionales posteriores.
            </li>
            <li>
              <strong>Advertencias sobre Alérgenos e Información Alimentaria:</strong> Los
              ingredientes, alérgenos, condiciones de conservación (mantenimiento en frío entre 0ºC y
              4ºC) y las advertencias legales específicas de los productos cárnicos se detallan en la
              ficha técnica de cada producto y en su etiquetado oficial. Es responsabilidad del
              cliente leer detenidamente las fichas técnicas antes de proceder a la compra y respetar
              la cadena de frío tras la entrega.
            </li>
            <li>
              <strong>Las imágenes de los productos tienen carácter orientativo:</strong> Al tratarse
              de productos alimenticios frescos y artesanales, cada corte de carne presenta
              infiltraciones de grasa, coloraciones y morfologías naturales únicas. Pueden existir
              ligeras variaciones respecto a las fotografías de la web, así como diferencias técnicas
              en la visualización de las pantallas empleadas por los usuarios.
            </li>
          </ul>

          <h3 id="envios" className="scroll-mt-28">3.2. Disponibilidad y entrega</h3>
          <ul>
            <li>
              <strong>Ámbito Territorial de Envío:</strong> Se realizan envíos exclusiva y únicamente
              a <strong>España Peninsular</strong>. Debido a las exigencias de transporte urgente
              refrigerado y aduanas, quedan excluidas de las zonas de entrega las Islas Baleares,
              Islas Canarias, Ceuta y Melilla.
            </li>
            <li>
              <strong>Información Sanitaria de los Productos:</strong> Todos los productos cárnicos
              comercializados cumplen rigurosamente con las autorizaciones, registros sanitarios y
              controles de trazabilidad obligatorios exigidos por las autoridades competentes en
              materia de seguridad alimentaria.
            </li>
            <li>
              <strong>Plazos de entrega:</strong> Los envíos se gestionarán exclusivamente a través
              de la empresa de transporte refrigerado urgente <strong>SEUR Frío</strong>, que
              garantiza el mantenimiento estricto de la temperatura controlada (entre 0ºC y 4ºC). Los
              repartos se realizan de{' '}
              <strong>
                Martes a Viernes (excluyendo lunes, sábados, domingos y festivos),
              </strong>{' '}
              con un plazo estimado de entrega de{' '}
              <strong>24 a 48 horas laborables desde la salida del pedido</strong> de nuestras
              instalaciones.
            </li>
            <li>
              <strong>El riesgo de pérdida o deterioro del producto</strong> se transmite al cliente
              únicamente cuando este, o un tercero por él indicado diferente del transportista,
              adquiera la posesión material del mismo, conforme al artículo 105 del Real Decreto
              Legislativo 1/2007.
            </li>
          </ul>

          <h3>3.3. Gastos de envío</h3>
          <p>
            Los gastos de envío para España Peninsular se aplicarán conforme a los siguientes tramos
            fijos:
          </p>
          <ul>
            <li>
              Para pedidos <strong>inferiores a 150€</strong>, los gastos de envío tendrán un coste
              fijo de <strong>10€</strong>.
            </li>
            <li>
              Para pedidos <strong>iguales o superiores a 150€</strong>, el envío será totalmente{' '}
              <strong>gratuito</strong>.
            </li>
          </ul>
          <p>
            La tarifa se mostrará de forma desglosada y transparente en el resumen del carrito antes
            de que el usuario proceda a la confirmación y pago del pedido. El envío se realiza a
            través de <strong>SEUR Frío</strong>.
          </p>

          <h3>3.4. Edad mínima</h3>
          <p>
            Con carácter general, solo pueden formalizar contratos de compra personas mayores de 18
            años. El cliente manifiesta, bajo su exclusiva responsabilidad, que cuenta con la edad
            legal mínima para contratar en el portal web.
          </p>

          <h3>3.5. Confirmación del pedido</h3>
          <p>Una vez formalizado el pedido, el proceso de gestión se desarrollará de la siguiente forma:</p>
          <ul>
            <li>
              <strong>Confirmación y seguimiento:</strong> El cliente recibirá un correo electrónico
              de confirmación con el resumen de la compra. Al iniciar la fase de preparación y
              expedición en frío, el sistema remitirá al cliente un correo electrónico con la
              información y el enlace de seguimiento logístico (tracking) proporcionado por{' '}
              <strong>SEUR Frío.</strong>
            </li>
            <li>
              <strong>Contacto del transportista</strong>: La empresa de mensajería refrigerada{' '}
              <strong>(SEUR Frío)</strong> podrá contactar directamente con el destinatario (vía
              email, SMS o teléfono) para coordinar la franja horaria de entrega o notificar
              incidencias logísticas. Por este motivo, es imprescindible que el cliente facilite
              datos de contacto válidos, exactos y actualizados.
            </li>
            <li>
              <strong>Modificaciones del pedido:</strong> El cliente podrá solicitar cambios en su
              pedido siempre que este no haya entrado en fase de preparación o corte. El almacén
              opera con horarios de corte estrictos a las 9:00h y a las 15:00h de días laborables.
              Una vez superadas estas horas de corte, el producto fresco pasa a fase de corte y
              envasado, por lo que no se podrá realizar ninguna modificación o cancelación
            </li>
          </ul>

          <h3>3.6. Seguimiento del pedido</h3>
          <p>
            El cliente podrá consultar el estado y realizar el seguimiento de su envío a través de
            los siguientes canales:
          </p>
          <ul>
            <li>
              <strong>Notificaciones automáticas</strong>: En el momento en que el pedido sea
              expedido en camión refrigerado, se enviará automáticamente un correo electrónico con el
              número de seguimiento de <strong>SEUR Frío</strong> para monitorizar la entrega.
            </li>
            <li>
              <strong>Atención al Cliente</strong>: Ante cualquier duda, retraso o incidencia con el
              transporte en frío, el cliente puede ponerse en contacto directo a través del canal de
              soporte habilitado por <strong>WhatsApp</strong> al número{' '}
              <strong>670 77 57 86</strong> o al correo electrónico de ventas{' '}
              <a href="mailto:elbueymaduradoxativa@gmail.com">elbueymaduradoxativa@gmail.com</a>
            </li>
          </ul>
        </section>

        {/* 4 */}
        <section className="mb-10">
          <h2>4. Recepción de la Mercancía</h2>
          <p>
            En el momento de la entrega del pedido por parte de SEUR Frío, al tratarse de productos
            vivos y perecederos que requieren refrigeración continua, el cliente deberá tener en
            cuenta las siguientes pautas:
          </p>
          <ul>
            <li>
              <strong>Verificar</strong> que el número de bultos entregados coincida con el albarán
              de la empresa de transportes.
            </li>
            <li>
              <strong>Comprobar visualmente</strong> que las cajas y el embalaje isotérmico no
              presenten roturas, aberturas o signos de haber perdido la temperatura de frío.
            </li>
          </ul>
          <p>
            <strong>Gestión de Entregas Fallidas (Responsabilidad del Producto)</strong>: Debido a la
            naturaleza altamente perecedera de la carne fresca, el paquete no puede permanecer
            almacenado en tránsito sin poner en riesgo la seguridad alimentaria. El cliente tiene la
            obligación de encontrarse en el domicilio o asegurar la recepción en la franja acordada.
            Para minimizar fallos en la entrega, la web dispondrá de un{' '}
            <strong>área de comentarios</strong> durante el proceso de compra donde el cliente podrá
            dar instrucciones específicas. En caso de ausencia injustificada del destinatario tras
            los intentos razonables de SEUR Frío, el paquete podría ser devuelto o destruido por
            razones de salud pública, perdiendo el cliente el derecho al reembolso del dinero debido
            a su negligencia en la recepción del alimento fresco.
          </p>
        </section>

        {/* 5 */}
        <section id="cambios-y-devoluciones" className="mb-10 scroll-mt-28">
          <h2>5. Cambios y devoluciones</h2>

          <h3>5.1. Condiciones de los productos devueltos</h3>
          <p>
            Debido a que el catálogo de la tienda online se compone única y exclusivamente de bienes
            alimenticios perecederos y frescos (carne madurada y derivados),{' '}
            <strong>
              no se admiten devoluciones comerciales voluntarias ni cambios de producto por mero
              arrepentimiento del cliente
            </strong>
            , de conformidad con las excepciones legales de salud e higiene pública.
          </p>

          <h3>5.2. Gastos de devolución e Incidencias</h3>
          <p>
            El coste derivado de la gestión y transporte de la mercancía de vuelta se aplicará
            exclusivamente en casos de fallos imputables a la empresa:
          </p>
          <ul>
            <li>
              <strong>
                Casos de errores de envío o falta de conformidad legal (Producto defectuoso)
              </strong>
              : Si la carne llega en mal estado, ha perdido el envasado al vacío de origen o presenta
              fallos imputables al proveedor, el titular asumirá la totalidad de los costes
              logísticos. Una vez verificada y aprobada la incidencia, se procederá directamente a la{' '}
              <strong>devolución del dinero</strong> en el mismo método de pago utilizado.
            </li>
          </ul>

          <h3>5.3. Reembolso</h3>
          <ul>
            <li>
              En los casos aprobados por incidencias o defectos de fábrica, el reembolso del importe
              íntegro se procesará utilizando el mismo método de pago empleado por el usuario en la
              transacción inicial.
            </li>
            <li>
              El plazo máximo para hacer efectivo el reembolso es de 14 días naturales desde la
              validación de la incidencia alimentaria. El reembolso económico podrá retenerse hasta
              haber recibido físicamente los bienes en el almacén o hasta que el consumidor presente
              una prueba inequívoca de la devolución del producto (como el resguardo de entrega del
              transportista).
            </li>
          </ul>

          <h3>5.4. Limitación territorial</h3>
          <p>
            Solo se aceptarán reclamaciones e incidencias de transacciones comerciales formalizadas
            directamente en el sitio web oficial restauranteelbueymadurado.com. No se asumirá ninguna
            responsabilidad sobre productos comercializados en canales externos o por intermediarios
            ajenos.
          </p>

          <h3 id="derecho-de-desistimiento" className="scroll-mt-28">
            5.5. Ejercicio del derecho de desistimiento
          </h3>
          <p>
            <strong>EXCEPCIONES AL DERECHO DE DESISTIMIENTO</strong>
          </p>
          <p>
            De conformidad con el{' '}
            <strong>artículo 103 del Real Decreto Legislativo 1/2007, de 16 de noviembre</strong>,
            por el que se aprueba el texto refundido de la Ley General para la Defensa de los
            Consumidores y Usuarios, se informa de que{' '}
            <strong>
              NO SE ADMITIRÁ EL EJERCICIO DEL DERECHO DE DESISTIMIENTO ni la devolución voluntaria
            </strong>{' '}
            en los siguientes supuestos:
          </p>
          <ul>
            <li>
              <strong>
                Artículo 103.e): El suministro de bienes que puedan deteriorarse o caducar con
                rapidez.
              </strong>{' '}
              Esta excepción resulta directamente aplicable a toda la carne madurada, cortes selectos
              y productos cárnicos derivados frescos de la web, ya que son alimentos perecederos que
              exigen una cadena de frío estricta e ininterrumpida que no puede ser garantizada una
              vez entregados. El derecho de desistimiento en la web será del <strong>0%</strong> para
              estos productos.
            </li>
          </ul>
          <p>
            <strong>PROCEDIMIENTO ESTRICTO PARA INCIDENCIAS COMERCIALES:</strong>
          </p>
          <p>
            Ante una anomalía (pérdida de vacío, rotura de caja, mal estado del producto), el cliente
            deberá seguir escrupulosamente los siguientes pasos:
          </p>
          <ol>
            <li>
              <strong>Plazo Límite de Aviso</strong>: Al tratarse de productos alimenticios frescos y
              perecederos, el cliente dispone de un plazo máximo e improrrogable de{' '}
              <strong>24 horas desde la entrega física del paquete</strong> para notificar cualquier
              disconformidad. Transcurrido dicho plazo, el Titular no asumirá responsabilidad alguna
              al resultar imposible verificar si la alteración del producto se debe a un defecto de
              origen o a una rotura de la cadena de frío imputable al almacenamiento del consumidor.
            </li>
            <li>
              <strong>Canales de Comunicación Habilitados:</strong> La incidencia deberá notificarse
              de manera preferente a través del canal de <strong>WhatsApp</strong> al número{' '}
              <strong>670 77 57 86</strong> o, en su defecto, mediante comunicación al correo
              electrónico de gestión de ventas, garantizando así la constancia legal de la fecha y
              hora exacta de la reclamación.
            </li>
            <li>
              <strong>La Prueba de la Incidencia (Triple fotografía obligatoria):</strong> De
              conformidad con los protocolos de trazabilidad exigidos por la normativa de seguridad
              alimentaria y para la correcta gestión de las coberturas del transporte, el cliente
              deberá adjuntar de forma obligatoria imágenes nítidas que incluyan:
              <ul>
                <li>
                  <strong>Foto de la pieza de carne afectada</strong>: Donde se visualice claramente
                  el estado del producto o si ha perdido el envasado al vacío.
                </li>
                <li>
                  <strong>Foto de la caja exterior de cartón</strong>: Para constatar si existió
                  impacto, perforación o manipulación indebida durante el tránsito logístico.
                </li>
                <li>
                  <strong>Foto de la etiqueta blanca de la carne</strong>: Donde conste de manera
                  perfectamente legible el{' '}
                  <strong>número de lote y los datos de trazabilidad obligatorios por ley</strong>. La
                  ausencia de esta fotografía eximirá al Titular de tramitar la incidencia al no
                  poder asociar el producto al registro sanitario de origen.
                </li>
              </ul>
            </li>
          </ol>
        </section>

        {/* 6 */}
        <section className="mb-10">
          <h2>6. Métodos de Pago y Pasarelas Autorizadas</h2>
          <p>
            Las transacciones comerciales se gestionarán mediante plataformas seguras que garantizan
            la confidencialidad y protección de los datos bancarios del usuario.
          </p>
          <p>
            <strong>Pasarelas de Pago Habilitadas:</strong>
          </p>
          <ul>
            <li>
              El sitio web utiliza exclusivamente la pasarela oficial de pago seguro{' '}
              <strong>Redsys (TPV Virtual)</strong> para el procesamiento y cobro con tarjetas de
              crédito y débito.
            </li>
          </ul>
          <p>
            <strong>Tarjetas Bancarias Aceptadas y Restricciones Territoriales de Cobro</strong>
          </p>
          <p>
            La pasarela de pago seguro se encargará de validar de forma automatizada las tarjetas
            bancarias aceptadas. De acuerdo con las políticas de seguridad y prevención del fraude
            electrónico aplicadas por la pasarela, el sistema procesará los pagos con tarjetas
            autorizadas emitidas dentro de los marcos de seguridad compatibles con el comercio
            minorista nacional y de la Unión Europea.
          </p>
        </section>

        {/* 7 */}
        <section className="mb-10">
          <h2>7. Normas Aplicables</h2>
          <p>
            Las presentes Condiciones Generales se regirán por la normativa española y europea
            aplicable en materia de contratación electrónica, consumo y protección de datos,
            incluyendo:
          </p>
          <ul>
            <li>Ley 7/1998, de 13 de abril, sobre Condiciones Generales de la Contratación.</li>
            <li>
              Real Decreto Legislativo 1/2007, de 16 de noviembre, por el que se aprueba el Texto
              Refundido de la Ley General para la Defensa de los Consumidores y Usuarios.
            </li>
            <li>
              Ley 34/2002, de 11 de julio, de Servicios de la Sociedad de la Información y de
              Comercio Electrónico (LSSI CE).
            </li>
            <li>
              Normativa vigente en materia de{' '}
              <strong>Seguridad Alimentaria e Higiene</strong>, e Higiene de los Productos
              Alimenticios (Reglamento CE nº 852/2004 y Reglamento CE nº 178/2002).
            </li>
            <li>Reglamento (UE) 2016/679 (RGPD), relativo a la protección de datos personales.</li>
            <li>
              Ley Orgánica 3/2018 (LOPDGDD), de Protección de Datos Personales y garantía de los
              derechos digitales.
            </li>
          </ul>
        </section>

        {/* 8 */}
        <section className="mb-10">
          <h2>8. Privacidad y Protección de Datos Personales</h2>
          <p>
            El responsable del tratamiento de los datos personales facilitados a través de la tienda
            es <strong>EL BUEY MADURADO, S.L.</strong>, NIF B-24770836, con domicilio en C/ La Reina,
            41, 46800 Xàtiva (València) y correo electrónico{' '}
            <a href="mailto:elbueymaduradoxativa@gmail.com">elbueymaduradoxativa@gmail.com</a>.
          </p>
          <p>
            Los datos facilitados durante el proceso de compra se tratan para gestionar el pedido,
            procesar el pago, realizar el envío y atender incidencias, así como para cumplir las
            obligaciones legales de facturación y trazabilidad alimentaria. La información completa
            exigida por el artículo 13 del RGPD —finalidades, bases jurídicas, destinatarios, plazos
            de conservación y forma de ejercer los derechos— está disponible en la{' '}
            <Link href="/politica-de-privacidad">Política de Privacidad</Link>, que forma parte
            integrante de estas Condiciones.
          </p>
        </section>

        {/* 9 */}
        <section className="mb-10">
          <h2>9. Propiedad Intelectual</h2>
          <p>
            Todos los contenidos incluidos en el sitio www.restauranteelbueymadurado.com, tales como
            imágenes de las piezas, fotografías de los cortes de carne madurada, textos explicativos
            de maduración Dry Aged, logotipos, marcas comerciales, gráficos y código fuente, son
            titularidad exclusiva del titular o de terceros que han autorizado su uso, encontrándose
            protegidos por la normativa nacional e internacional sobre propiedad intelectual e
            industrial.
          </p>
          <p>
            Queda expresamente prohibida su reproducción, distribución, comunicación pública o
            transformación comercial, total o parcial, sin la autorización previa, expresa y por
            escrito del Titular.
          </p>
        </section>

        {/* 10 */}
        <section className="mb-10">
          <h2>10. Uso del Servicio y Responsabilidades</h2>
          <p>
            El usuario se compromete a utilizar la plataforma web de forma lícita, de buena fe y
            conforme a estas Condiciones Generales, absteniéndose de realizar cualquier acción que
            pueda dañar el correcto funcionamiento del portal restauranteelbueymadurado.com.
          </p>
          <p>
            El Titular realiza sus mejores esfuerzos técnicos para garantizar la disponibilidad
            continua de la tienda online y el mantenimiento térmico de los stocks, pero no será
            responsable de interrupciones temporales ajenas debidas a fallos en las redes de
            telecomunicaciones, servidores o fuerza mayor.
          </p>
          <p>
            <strong>Advertencia sobre la Información de los Productos:</strong> Las descripciones,
            tiempos de maduración (Dry Aged) y recomendaciones gastronómicas facilitadas en el sitio
            web tienen un carácter meramente informativo y de transparencia culinaria hacia el
            consumidor.
          </p>
        </section>

        {/* 11 */}
        <section className="mb-10">
          <h2>11. Legislación Aplicable y Jurisdicción Competente</h2>
          <p>
            Las presentes Condiciones Generales se regirán e interpretarán conforme a la legislación
            española y europea aplicable.
          </p>
          <p>
            En caso de conflicto, controversia o discrepancia, cuando el cliente tenga la condición
            legal de <strong>consumidor o usuario</strong>, la jurisdicción competente será la
            correspondiente al domicilio habitual del comprador.
          </p>
          <p>
            Cuando el cliente no tenga la condición de consumidor (personas jurídicas, empresas o
            profesionales que actúen dentro del marco de su actividad comercial), ambas partes se
            someten expresamente a los{' '}
            <strong>Juzgados y Tribunales de Xàtiva (València)</strong>, renunciando de forma expresa
            a cualquier otro fuero o jurisdicción que por derecho pudiera corresponderles.
          </p>
        </section>

        {/* 12 */}
        <section className="mb-10">
          <h2>12. Notificaciones</h2>
          <p>
            Todas las notificaciones, comunicaciones o requerimientos relacionados con las presentes
            Condiciones Generales deberán realizarse por escrito y se considerarán válidamente
            efectuados y entregados cuando:
          </p>
          <ul>
            <li>
              <strong>Se entreguen en mano</strong> de forma presencial.
            </li>
            <li>
              <strong>Se envíen por correo postal certificado</strong> o burofax al domicilio legal
              indicado por cada una de las partes.
            </li>
            <li>
              <strong>Se remitan por correo electrónico</strong> a las direcciones explícitamente
              facilitadas para este fin. En el caso del Titular, los canales oficiales de recepción
              serán el correo electrónico de gestión de ventas:{' '}
              <a href="mailto:elbueymaduradoxativa@gmail.com">elbueymaduradoxativa@gmail.com</a> y el
              canal de asistencia habilitado mediante WhatsApp en el número{' '}
              <strong>670 77 57 86</strong>.
            </li>
          </ul>
          <p>
            Cada parte podrá actualizar sus datos de contacto de facturación, entrega o
            notificaciones oficiales comunicándolo a la otra parte por cualquiera de los medios
            descritos anteriormente.
          </p>
        </section>

        {/* 13 */}
        <section className="mb-10">
          <h2>13. Nulidad e Ineficacia de las Cláusulas</h2>
          <p>
            Si alguna de las cláusulas o apartados incluidos en estas Condiciones Generales fuese
            declarada nula o ineficaz por un órgano judicial, dicha nulidad afectará única y
            exclusivamente a la disposición concreta. El resto de las Condiciones Generales
            permanecerán plenamente vigentes y estables.
          </p>
        </section>

        {/* 14 */}
        <section className="mb-10">
          <h2>14. Política de garantías</h2>
          <p>
            El Titular responde de las faltas de conformidad de acuerdo con las siguientes
            especificaciones según la naturaleza exclusiva del catálogo alimenticio:
          </p>
          <p>
            <strong>Productos Cárnicos y Alimentos Frescos (Bienes Perecederos)</strong>
          </p>
          <p>
            Por su propia naturaleza alimenticia y condición de productos perecederos, la garantía
            legal de los productos cárnicos queda limitada y acotada estrictamente a su fecha de
            caducidad o de consumo preferente, siempre y cuando se hayan respetado escrupulosamente
            las instrucciones de conservación en frío (entre 0ºC y 4ºC).
          </p>
          <ul>
            <li>
              La garantía de seguridad alimentaria y conformidad{' '}
              <strong>
                se extingue de forma automática e inmediata en el momento en que el envasado al vacío
                o envoltorio hermético sea abierto, desprecintado o manipulado tras su entrega
              </strong>
              , al romperse de forma irreversible la cadena de custodia higiénica y seguridad del
              alimento.
            </li>
            <li>
              No se aplicará cobertura de garantía sobre productos alimenticios abiertos o cocinados
              a menos que se trate de un defecto organoléptico originario del lote o problemas de
              maduración internos, debidamente notificados en las primeras{' '}
              <strong>24 horas desde la entrega.</strong>
            </li>
          </ul>
          <p>
            <strong>Gestión y Costes de la Garantía</strong>
          </p>
          <p>
            Para gestionar cualquier incidencia con la garantía alimentaria, el cliente debe escribir
            de forma urgente al canal de <strong>WhatsApp</strong> habilitado dentro del plazo de 24
            horas.
          </p>
          <ul>
            <li>
              En caso de que el producto presente un defecto real de origen (pérdida de vacío en
              transporte, mal estado higiénico previo), el Titular asumirá todos los costes y
              gestionará la devolución del dinero.
            </li>
          </ul>

          <h3>14.1. Obligaciones del cliente al solicitar una garantía</h3>
          <p>El cliente se compromete a:</p>
          <ul>
            <li>
              Garantizar que el producto ha permanecido refrigerado de forma continua a temperatura
              idónea y que no ha sido manipulado o congelado de forma indebida.
            </li>
            <li>
              Facilitar de forma obligatoria la <strong>triple prueba visual nítida</strong> (foto de
              la pieza, foto de la caja exterior y foto de la etiqueta de trazabilidad con el lote de
              Sanidad).
            </li>
            <li>
              Realizar la reclamación dentro del estricto plazo límite de <strong>24 horas</strong>{' '}
              tras la recepción material.
            </li>
          </ul>

          <h3>14.2. Obligaciones del titular</h3>
          <p>
            <strong>El titular</strong> se compromete a:
          </p>
          <ul>
            <li>
              Gestionar la incidencia de forma diligente, evaluando las pruebas fotográficas
              aportadas.
            </li>
            <li>
              Proceder al reembolso íntegro del dinero en el menor tiempo posible si la falta de
              conformidad alimentaria resulta plenamente probada.
            </li>
          </ul>
        </section>

        {/* 15 */}
        <section className="mb-10">
          <h2>15. Solución de Litigios en Línea</h2>
          <p>
            De conformidad con la normativa europea vigente, se informa a los usuarios de que la
            antigua plataforma de Resolución de Litigios en Línea (ODR) de la Comisión Europea ha
            sido discontinuada.
          </p>
          <p>
            En su lugar, para garantizar el derecho a la resolución extrajudicial de conflictos, los
            consumidores que tengan una reclamación activa de consumo pueden consultar el listado
            oficial de entidades de resolución alternativa de litigios de consumo de la Comisión
            Europea:{' '}
            <a
              href="https://consumer-redress.ec.europa.eu/dispute-resolution-bodies"
              target="_blank"
              rel="noreferrer"
            >
              https://consumer-redress.ec.europa.eu/dispute-resolution-bodies
            </a>
          </p>
          <p>
            La utilización de estos canales alternativos de mediación y arbitraje es totalmente
            voluntaria para el consumidor y no sustituye ni impide el derecho del comprador a acudir
            directamente ante los juzgados competentes estipulados en estas Condiciones Generales.
          </p>
        </section>

        {/* Navegación a otras páginas legales */}
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
        .prose-legal ol {
          list-style: decimal;
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
