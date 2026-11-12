// Configuración de remitente y "responder a" de los emails de la tienda.
//
// Producción = despliegue de producción en Vercel (VERCEL_ENV=production).
// NODE_ENV no sirve: también vale 'production' en `next build`/`next start`
// locales y en las previews de Vercel.
//
// - EMAIL_FROM: obligatorio en producción. Sin él, el envío falla con un error
//   claro en los logs; nunca se usa el dominio de pruebas de Resend en real.
//   En local y en previews se usa onboarding@resend.dev por defecto.
// - EMAIL_REPLY_TO: recomendado. Si falta en producción se avisa en los logs,
//   pero el email se envía igual (sin "responder a").

export const RESEND_TEST_FROM = 'onboarding@resend.dev';

type EmailEnv = { EMAIL_FROM?: string; EMAIL_REPLY_TO?: string; VERCEL_ENV?: string; [key: string]: string | undefined };

function isProduction(env: EmailEnv): boolean {
  return env.VERCEL_ENV === 'production';
}

export function resolveEmailFrom(env: EmailEnv = process.env): string {
  const from = env.EMAIL_FROM?.trim();
  if (from) return from;

  if (isProduction(env)) {
    const message = 'EMAIL_FROM no está configurado en producción: no se envía el email. Configúralo en las variables de entorno de Vercel.';
    console.error(`[email] ${message}`);
    throw new Error(message);
  }
  return RESEND_TEST_FROM;
}

export function resolveReplyTo(env: EmailEnv = process.env): string | undefined {
  const replyTo = env.EMAIL_REPLY_TO?.trim();
  if (replyTo) return replyTo;

  if (isProduction(env)) {
    console.warn('[email] EMAIL_REPLY_TO no está configurado en producción: el email se envía sin dirección de respuesta.');
  }
  return undefined;
}
