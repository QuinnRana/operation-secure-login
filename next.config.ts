import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Bound form parsing as well as the credential lengths checked by actions.
      // Allows UTF-8 credentials and framework metadata without accepting 1 MiB forms.
      bodySizeLimit: '16kb',
    },
  },
};

export default nextConfig;
