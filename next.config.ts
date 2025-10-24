/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Désactiver ESLint pendant les builds de production
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig