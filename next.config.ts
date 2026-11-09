import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async headers() {
    // vinext's wildcard route does not match the root path; include it explicitly.
    return ['/', '/:path*'].map(source => ({
      source,
      headers: [
        { key: 'Content-Security-Policy', value: "base-uri 'self'; form-action 'self'; object-src 'none'" },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'no-referrer' },
      ],
    }));
  },
};

export default nextConfig;
