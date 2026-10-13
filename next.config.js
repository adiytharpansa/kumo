/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  // Rute proksi satu-origin (pengganti Worker proksi lama):
  // /px -> app/api/px (ambil halaman sisi server), /img -> app/api/img.
  async rewrites() {
    return [
      { source: '/px', destination: '/api/px' },
      { source: '/img', destination: '/api/img' },
    ];
  },
};

module.exports = nextConfig;
