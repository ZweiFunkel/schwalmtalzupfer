/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production'

const BACKEND = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

const nextConfig = {
  ...(isProd ? { output: 'export', distDir: 'out' } : {}),
  trailingSlash: isProd,
  images: {
    unoptimized: true,
  },
  // Dev-only: Proxy API- und R2-Aufrufe zum Spring Boot Backend
  ...(!isProd ? {
    async rewrites() {
      return [
        { source: '/api/:path*', destination: `${BACKEND}/api/:path*` },
        { source: '/r2/:path*',  destination: `${BACKEND}/r2/:path*`  },
      ]
    },
  } : {}),
}
export default nextConfig
