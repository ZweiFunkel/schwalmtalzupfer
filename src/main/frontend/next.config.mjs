/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production'

// Nur im Dev-Modus relevant: lokaler Backend-Port für den Next.js-Proxy.
// Im Production-Build läuft kein Proxy – dort muss NEXT_PUBLIC_API_URL gesetzt sein.
const DEV_BACKEND = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081'

const nextConfig = {
  ...(isProd ? { output: 'export', distDir: 'out' } : {}),
  trailingSlash: false, // Set to false for consistent URL handling without trailing slashes
  images: {
    unoptimized: true,
  },
  // Dev-only: Proxy API- und R2-Aufrufe zum Spring Boot Backend
  ...(!isProd ? {
    async rewrites() {
      return [
        { source: '/api/:path*', destination: `${DEV_BACKEND}/api/:path*` },
        { source: '/r2/:path*',  destination: `${DEV_BACKEND}/r2/:path*`  },
      ]
    },
  } : {}),
}
export default nextConfig