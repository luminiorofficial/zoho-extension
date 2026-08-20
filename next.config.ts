import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value:
              "frame-ancestors 'self' https://projects.zoho.in https://*.zoho.in https://projects.zoho.com https://*.zoho.com;",
          },
        ],
      },
    ];
  },
};

export default nextConfig;