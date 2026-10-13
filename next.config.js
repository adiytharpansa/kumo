/** @type {import('next').NextConfig} */
const nextConfig = {
  // @consumet/extensions hanya berjalan di server (Server Components /
  // route handlers). Jangan pernah diimpor dari komponen klien:
  // mencegah bundle bloat, masalah hidrasi, dan pelanggaran CORS.
  serverExternalPackages: ['@consumet/extensions'],
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
};

module.exports = nextConfig;
