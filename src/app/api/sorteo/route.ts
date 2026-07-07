import { NextResponse } from 'next/server';

const APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbzr20UApqplefxx4R7Jsr92PFNhc83XhryzBBEDhK4DPB749yn19cu5pyO6p9yopbWA/exec';

type NewsletterPayload = {
  nombre?: string;
  email?: string;
  aceptaCondi?: boolean;
  suscrito?: boolean;
};

type AppsScriptResponse = {
  result?: 'success' | 'error' | string;
  error?: string;
  message?: string;
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function formatRegistrationDate(date: Date) {
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
    .format(date)
    .replace(',', '');
}

function getAppsScriptErrorMessage(upstreamData: AppsScriptResponse | null) {
  const upstreamError = normalizeText(upstreamData?.error);

  if (
    upstreamError.includes('Cannot read properties of null') &&
    upstreamError.includes('getLastRow')
  ) {
    return 'El Apps Script no encuentra la hoja configurada para la newsletter.';
  }

  return (
    upstreamError ||
    normalizeText(upstreamData?.message) ||
    'El servicio de newsletter no ha aceptado la solicitud.'
  );
}

export async function POST(request: Request) {
  let payload: NewsletterPayload;

  try {
    payload = (await request.json()) as NewsletterPayload;
  } catch {
    return NextResponse.json(
      { error: 'No se ha podido leer el formulario enviado.' },
      { status: 400 }
    );
  }

  const nombre = normalizeText(payload.nombre);
  const email = normalizeText(payload.email).toLowerCase();
  const aceptaCondi = payload.aceptaCondi === true;
  const suscrito = payload.suscrito !== false;
  const fecha = formatRegistrationDate(new Date());

  if (!email || !emailRegex.test(email)) {
    return NextResponse.json(
      { error: 'Introduce un correo electrónico válido.' },
      { status: 400 }
    );
  }

  if (suscrito && !nombre) {
    return NextResponse.json(
      { error: 'Indica tu nombre para suscribirte a la newsletter.' },
      { status: 400 }
    );
  }

  if (!aceptaCondi) {
    return NextResponse.json(
      {
        error: suscrito
          ? 'Acepta las condiciones y la política de privacidad para recibir la newsletter.'
          : 'Confirma que quieres darte de baja de la newsletter.',
      },
      { status: 400 }
    );
  }

  try {
    const upstreamResponse = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        nombre: suscrito ? nombre : '',
        email,
        acepta_condi: aceptaCondi ? 'SI' : 'NO',
        fecha,
        suscrito: suscrito ? 'SI' : 'NO',
      }),
      cache: 'no-store',
      redirect: 'follow',
    });

    const upstreamBody = await upstreamResponse.text();
    let upstreamData: AppsScriptResponse | null = null;

    if (upstreamBody) {
      try {
        upstreamData = JSON.parse(upstreamBody) as AppsScriptResponse;
      } catch {
        upstreamData = null;
      }
    }

    if (!upstreamResponse.ok || upstreamData?.result === 'error') {
      return NextResponse.json(
        {
          error: getAppsScriptErrorMessage(upstreamData),
        },
        { status: 502 }
      );
    }

    if (upstreamData?.result !== 'success') {
      return NextResponse.json(
        {
          error:
            'El Apps Script ha respondido con un formato inesperado. Revisa la deployment activa publicada.',
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: suscrito
        ? 'Te has suscrito correctamente. Pronto recibirás descuentos y novedades en tu email.'
        : 'Te has desuscrito correctamente. Ya no recibirás nuestras promociones por email.',
    });
  } catch {
    return NextResponse.json(
      {
        error:
          'No hemos podido conectar con el servicio de newsletter. Inténtalo de nuevo en unos segundos.',
      },
      { status: 502 }
    );
  }
}
