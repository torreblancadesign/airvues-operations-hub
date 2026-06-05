/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: { allowedOrigins: ["localhost:3000", "airvues-ops.vercel.app", "ops.airvues.com"] },
  },
  // Bundle the ffmpeg-static binary into serverless functions that need it
  // (Loop analysis extracts audio from uploaded videos before sending to Gemini).
  outputFileTracingIncludes: {
    "/api/**": ["./node_modules/ffmpeg-static/**"],
    "/loops/**": ["./node_modules/ffmpeg-static/**"],
  },
};

module.exports = nextConfig;
