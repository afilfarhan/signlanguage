import type { NextConfig } from "next";

const lessonCSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval' https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/ https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils@0.3.1675466124/ https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3.1675466862/ https://cdn.jsdelivr.net/npm/onnxruntime-web@1.26.0/",
  "connect-src 'self' https://cdn.jsdelivr.net/npm/@mediapipe/",
  "img-src 'self' data: blob: https://upload.wikimedia.org",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "media-src blob:",
  "worker-src 'self' blob:",
].join("; ");

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "upload.wikimedia.org" },
    ],
  },
  async headers() {
    return [
      {
        source: "/learn/:path*",
        headers: [
          { key: "Content-Security-Policy", value: lessonCSP },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
      {
        source: "/practice",
        headers: [
          { key: "Content-Security-Policy", value: lessonCSP },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
