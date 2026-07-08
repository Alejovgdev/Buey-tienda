// Fase 7 (post-auditoria), H-04. Ventana deslizante en memoria del propio
// proceso de Next.js: sin infraestructura adicional (no requiere tabla ni
// RPC), suficiente para un unico admin. Limitacion conocida y aceptada: el
// contador se resetea en cada reinicio/despliegue del servidor, y en un
// entorno serverless con varias instancias en paralelo cada una llevaria su
// propio contador — para el volumen de trafico de un unico panel admin de un
// restaurante esto sigue siendo una mejora real frente a no tener ningun
// limite en absoluto.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;

type AttemptWindow = { count: number; windowStart: number };

const attemptsByKey = new Map<string, AttemptWindow>();

function isExpired(entry: AttemptWindow, now: number): boolean {
  return now - entry.windowStart >= WINDOW_MS;
}

// Barrido barato de ventanas caducadas en cada escritura, para que el Map no
// crezca sin limite con IPs que ya no importan.
function sweepExpired(now: number): void {
  for (const [key, entry] of attemptsByKey) {
    if (isExpired(entry, now)) attemptsByKey.delete(key);
  }
}

export function checkLoginRateLimit(key: string): { allowed: true } | { allowed: false; retryAfterSeconds: number } {
  const entry = attemptsByKey.get(key);
  if (!entry) return { allowed: true };

  const now = Date.now();
  if (isExpired(entry, now)) return { allowed: true };

  if (entry.count >= MAX_FAILED_ATTEMPTS) {
    const retryAfterSeconds = Math.ceil((entry.windowStart + WINDOW_MS - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }

  return { allowed: true };
}

export function recordFailedLoginAttempt(key: string): void {
  const now = Date.now();
  sweepExpired(now);

  const entry = attemptsByKey.get(key);
  if (!entry || isExpired(entry, now)) {
    attemptsByKey.set(key, { count: 1, windowStart: now });
    return;
  }

  entry.count += 1;
}

export function resetLoginRateLimit(key: string): void {
  attemptsByKey.delete(key);
}
