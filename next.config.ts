import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Mark server-only packages as external
  serverExternalPackages: ['ssh2-sftp-client', 'ssh2'],

  // Empty turbopack config to silence the webpack migration warning
  turbopack: {},

  // Webpack config for handling native modules (used in --webpack mode)
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        'ssh2-sftp-client': 'commonjs ssh2-sftp-client',
        'ssh2': 'commonjs ssh2',
      });
    }
    return config;
  },
};

export default nextConfig;
