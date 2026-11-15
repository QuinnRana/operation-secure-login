import type { NextConfig } from 'next';

// Sent on every page. Only `frame-ancestors` is set in the CSP: a full script
// policy would need nonces for the framework's inline scripts.
export const securityHeaders = [
  // Other sites cannot frame these pages, so they cannot trick a click on Log in or Log out.
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  { key: 'X-Frame-Options', value: 'DENY' },
  // Browsers must not guess a different content type than the one sent.
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Other sites see only this site's origin, never full page URLs.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
];

const nextConfig: NextConfig = {
  async headers() {
    // vinext's `/:path*` does not match the bare root, so `/` gets its own rule.
    return [
      { source: '/', headers: securityHeaders },
      { source: '/:path*', headers: securityHeaders },
    ];
  },
};

export default nextConfig;
