/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: { allowedOrigins: ["localhost:3000", "airvues-ops.vercel.app", "ops.airvues.com"] },
  },
};

module.exports = nextConfig;
