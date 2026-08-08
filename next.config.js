/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: { allowedOrigins: ["localhost:3000", "airvues-ops.vercel.app", "ops.airvues.com"] },
    // Keep ffmpeg-static out of the webpack bundle. It locates its binary with
    // path.join(__dirname, "ffmpeg"); once bundled, webpack rewrites __dirname to
    // the chunk dir and the path resolves to .next/server/chunks/ffmpeg (ENOENT).
    serverComponentsExternalPackages: ["ffmpeg-static"],
    // Ship the ffmpeg binary itself into the functions that need it (Loop analysis
    // extracts audio from uploaded videos before sending to Gemini). On Next 14
    // this option is only honored under `experimental` — at the top level it is
    // silently ignored, which is how the binary went missing in production.
    outputFileTracingIncludes: {
      "/api/**": ["./node_modules/ffmpeg-static/**"],
      "/loops/**": ["./node_modules/ffmpeg-static/**"],
    },
  },
};

module.exports = nextConfig;
