/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Only use standalone output in production builds
  ...(process.env.NODE_ENV === 'production' && { output: 'standalone' }),
  transpilePackages: ['@mui/material', '@mui/system', '@mui/icons-material'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production'
      ? { exclude: ['error'] }
      : false,
  },
  // Cache headers: aggressive for static PWA assets, revalidate for everything else
  headers: async () => [
    {
      source: '/icons/:path*',
      headers: [
        { key: 'Cache-Control', value: 'public, max-age=2592000, immutable' },
      ],
    },
    {
      source: '/sw.js',
      headers: [
        { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
        { key: 'Service-Worker-Allowed', value: '/' },
      ],
    },
    {
      source: '/(.*)',
      headers: [
        { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
      ],
    },
  ],
}

module.exports = nextConfig
