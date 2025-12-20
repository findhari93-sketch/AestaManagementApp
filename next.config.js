/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  transpilePackages: ['@mui/material', '@mui/system', '@mui/icons-material'],
  eslint: {
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig
