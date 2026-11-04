const FALLBACK_PUBLIC_SITE_URL = 'https://restauranteelbueymadurado.com';

/**
 * Construye enlaces absolutos para contenido que se renderiza fuera de la web,
 * principalmente emails. En producción se respeta NEXT_PUBLIC_BASE_URL; el
 * dominio canónico evita enlaces relativos rotos si falta la variable.
 */
export function getPublicSiteUrl(
  path: string,
  configuredBaseUrl = process.env.NEXT_PUBLIC_BASE_URL
): string {
  const baseUrl = (configuredBaseUrl?.trim() || FALLBACK_PUBLIC_SITE_URL).replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  return `${baseUrl}${normalizedPath}`;
}
