import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
  experimental: {
    optimizePackageImports: ["react-icons"],
  },
  // H-06 (auditoria pre-lanzamiento): cabeceras minimas de defensa en
  // profundidad. Nada de Content-Security-Policy todavia — el checkout
  // depende de Framer Motion, imagenes servidas desde Supabase Storage y el
  // auto-submit del formulario hacia Redsys, y una CSP mal calibrada podria
  // romper cualquiera de los tres sin que sea evidente en pruebas rapidas.
  // Queda pendiente de un analisis dedicado, no de esta ronda de fixes.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        source: "/:path*",
        // El mismo build puede servirse en producción, vercel.app o una preview
        // con dominio propio. Decidir por Host, nunca solo por NODE_ENV/VERCEL_ENV.
        // Next compara el hostname completo, sin puerto y en minúsculas.
        missing: [{ type: "host", value: "(?:www\\.)?restauranteelbueymadurado\\.com" }],
        headers: [{ key: "X-Robots-Tag", value: "noindex" }],
      },
      // Mantener estas rutas fuera del índice también en el dominio definitivo.
      // Se conservan sus metadatos y las comprobaciones de autenticación existentes.
      ...["/carrito", "/checkout", "/pedido/confirmacion", "/admin/:path*"].map(source => ({
        source,
        headers: [{ key: "X-Robots-Tag", value: "noindex" }],
      })),
    ];
  },
};

export default nextConfig;
