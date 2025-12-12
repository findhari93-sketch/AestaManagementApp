/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  transpilePackages: ['@mui/material', '@mui/system', '@mui/icons-material'],
}

module.exports = nextConfig
