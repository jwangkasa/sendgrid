import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['hdb', 'firebase-admin'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'hatchevent.com',
      },
    ],
  },
};

export default nextConfig;
