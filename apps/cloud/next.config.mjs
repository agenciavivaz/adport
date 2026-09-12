/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pacotes do workspace são consumidos como TypeScript-fonte.
  transpilePackages: ['@ai/shared', '@ai/domain'],
  experimental: {
    typedRoutes: false,
  },
};

export default nextConfig;
