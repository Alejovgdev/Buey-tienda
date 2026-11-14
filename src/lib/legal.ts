// Paso 5. Fuente unica de la version del contrato.
//
// La version vive en la cabecera de docs/legal/condiciones-generales-contratacion.md,
// que es la fuente canonica del texto legal (ver docs/legal/README.md). Este
// modulo la replica para el codigo: la pagina publicada y el registro en BD leen
// de aqui, nunca de un literal suelto.
//
// AL SUBIR LA VERSION DEL CONTRATO: cambiar el .md primero y despues estas dos
// constantes, en el mismo commit. Son los unicos dos sitios del repositorio
// donde la version esta escrita.
//
// TERMS_VERSION se persiste en orders.terms_version en cada pedido, asi que el
// formato debe mantenerse estable ("1.1", "1.2", ...): es lo que permite saber
// que texto acepto cada cliente.

/** Version vigente de las Condiciones Generales de Contratacion. */
export const TERMS_VERSION = '1.3';

/** Fecha de esa version, tal y como se muestra al usuario. */
export const TERMS_DATE = '12 de noviembre de 2026';

/** Etiqueta para la cabecera de la pagina publicada: "Version 1.1 · 4 de agosto de 2026". */
export const TERMS_LABEL = `Versión ${TERMS_VERSION} · ${TERMS_DATE}`;

// Paso 7. Texto exacto que acompaña a la casilla opcional de comunicaciones
// comerciales. Sale de docs/legal/politica-de-privacidad.md §9 y se centraliza
// aquí para que la interfaz y la prueba guardada en BD no puedan divergir.
//
// Si cambia este texto: actualizar primero la fuente canónica y después subir
// MARKETING_CONSENT_VERSION en el mismo commit.

/** Versión del texto mostrado junto a la casilla de consentimiento comercial. */
export const MARKETING_CONSENT_VERSION = '1.0';

/** Texto respaldado por la Política de Privacidad vigente. */
export const MARKETING_CONSENT_TEXT =
  'Acepto recibir comunicaciones comerciales, promociones u ofertas de fidelización por correo electrónico.';

// Pasos 7-8. Extractos informativos de las Condiciones Generales v1.1 que se
// muestran antes del pago y se recuerdan en el email de confirmación.
//
// La fuente canónica es docs/legal/condiciones-generales-contratacion.md:
// §3.5 para cambios/cancelaciones y §5.5 para desistimiento. No corregir ni
// reinterpretar aquí el contenido jurídico; cualquier cambio empieza en el .md.

const ORDER_LEGAL_NOTICES_BY_TERMS_VERSION = {
  '1.1': {
    withdrawal:
      'De conformidad con el artículo 103 del Real Decreto Legislativo 1/2007, de 16 de noviembre, por el que se aprueba el texto refundido de la Ley General para la Defensa de los Consumidores y Usuarios, se informa de que NO SE ADMITIRÁ EL EJERCICIO DEL DERECHO DE DESISTIMIENTO ni la devolución voluntaria en los siguientes supuestos: Artículo 103.e): El suministro de bienes que puedan deteriorarse o caducar con rapidez. Esta excepción resulta directamente aplicable a toda la carne madurada, cortes selectos y productos cárnicos derivados frescos de la web, ya que son alimentos perecederos que exigen una cadena de frío estricta e ininterrumpida que no puede ser garantizada una vez entregados. El derecho de desistimiento en la web será del 0% para estos productos.',
    changeCutoff:
      'El cliente podrá solicitar cambios en su pedido siempre que este no haya entrado en fase de preparación o corte. El almacén opera con horarios de corte estrictos a las 9:00 h y a las 15:00 h de días laborables. Una vez superadas estas horas de corte, el producto fresco pasa a fase de corte y envasado, por lo que no se podrá realizar ninguna modificación o cancelación.',
  },
  // v1.2 solo cambia §3.5 (seguimiento) y §3.6; los extractos de §3.5 (cambios)
  // y §5.5 (desistimiento) son idénticos a la v1.1.
  '1.2': {
    withdrawal:
      'De conformidad con el artículo 103 del Real Decreto Legislativo 1/2007, de 16 de noviembre, por el que se aprueba el texto refundido de la Ley General para la Defensa de los Consumidores y Usuarios, se informa de que NO SE ADMITIRÁ EL EJERCICIO DEL DERECHO DE DESISTIMIENTO ni la devolución voluntaria en los siguientes supuestos: Artículo 103.e): El suministro de bienes que puedan deteriorarse o caducar con rapidez. Esta excepción resulta directamente aplicable a toda la carne madurada, cortes selectos y productos cárnicos derivados frescos de la web, ya que son alimentos perecederos que exigen una cadena de frío estricta e ininterrumpida que no puede ser garantizada una vez entregados. El derecho de desistimiento en la web será del 0% para estos productos.',
    changeCutoff:
      'El cliente podrá solicitar cambios en su pedido siempre que este no haya entrado en fase de preparación o corte. El almacén opera con horarios de corte estrictos a las 9:00 h y a las 15:00 h de días laborables. Una vez superadas estas horas de corte, el producto fresco pasa a fase de corte y envasado, por lo que no se podrá realizar ninguna modificación o cancelación.',
  },
  // v1.3: resumen corto para el email (aprobado el 12/11/2026), coherente con
  // §3.5 y §5.5 (art. 103.d). Cada texto se muestra tras su etiqueta en
  // negrita; las Condiciones completas siguen enlazadas en el email.
  '1.3': {
    changeCutoffLabel: 'Cambios y cancelaciones:',
    changeCutoff:
      'puedes pedir cambios o cancelar el pedido mientras no haya entrado en preparación.',
    withdrawalLabel: 'Desistimiento:',
    withdrawal:
      'al ser alimentos frescos que se deterioran con rapidez, estos productos no admiten derecho de desistimiento (art. 103.d de la Ley General para la Defensa de los Consumidores y Usuarios). Si hay algo incorrecto en tu pedido, escríbenos y lo solucionamos.',
  },
} as const;

// Esta indexación es intencionada: si TERMS_VERSION cambia, TypeScript obliga a
// añadir primero los extractos de la nueva versión y conserva los anteriores
// para pedidos pendientes que se confirmen más tarde.
const CURRENT_ORDER_LEGAL_NOTICES = ORDER_LEGAL_NOTICES_BY_TERMS_VERSION[TERMS_VERSION];

/**
 * Resumen informativo para el checkout. El texto contractual completo y
 * versionado se conserva en ORDER_LEGAL_NOTICES_BY_TERMS_VERSION y se incluye
 * en el correo de confirmación.
 */
export const PERISHABLE_WITHDRAWAL_NOTICE =
  'Por su carácter perecedero, estos productos están exceptuados del derecho de desistimiento. Esto no afecta a tus derechos si el pedido llega dañado, en mal estado o no corresponde con lo comprado.';

/** Plazos operativos para solicitar cambios o cancelaciones (§3.5), según la versión vigente. */
export const ORDER_CHANGE_CUTOFF_NOTICE = CURRENT_ORDER_LEGAL_NOTICES.changeCutoff;

/** Recupera exclusivamente el copy correspondiente a la versión aceptada. */
export function getOrderLegalNotices(termsVersion: string | null) {
  if (!termsVersion || !(termsVersion in ORDER_LEGAL_NOTICES_BY_TERMS_VERSION)) {
    return null;
  }

  return ORDER_LEGAL_NOTICES_BY_TERMS_VERSION[
    termsVersion as keyof typeof ORDER_LEGAL_NOTICES_BY_TERMS_VERSION
  ];
}
